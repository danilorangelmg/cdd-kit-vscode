import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "./services/configService";
import { CddTreeProvider } from "./providers/CddTreeProvider";
import { CddAgentService } from "./services/cddAgentService";
import { CddChatViewProvider } from "./providers/CddChatViewProvider";
import { CddClaudeMdViewProvider } from "./providers/CddClaudeMdViewProvider";
import { ClaudeMdService } from "./services/claudeMdService";
import { SkillEditorProvider } from "./providers/SkillEditorProvider";
import {
  AnthropicAuthProvider,
  getApiKey,
} from "./auth/anthropicAuthProvider";
import { initProjectCommand } from "./commands/initProject";
import { addModuleCommand } from "./commands/addModule";
import { addStackCommand } from "./commands/addStack";
import { runDoctorCommand } from "./commands/runDoctor";
import { regenerateCommand } from "./commands/regenerate";
import { toggleRuleCommand } from "./commands/toggleRule";
import { createSkillCommand } from "./commands/createSkill";
import { createHookCommand } from "./commands/createHook";
import { applyPresetCommand } from "./commands/applyPreset";

let projectStatusBar: vscode.StatusBarItem;
let connectionStatusBar: vscode.StatusBarItem;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  // Core services
  const configService = new ConfigService();
  const agentService = new CddAgentService();
  const authProvider = new AnthropicAuthProvider(context);
  const claudeMdService = new ClaudeMdService(configService);

  // TreeView
  const treeProvider = new CddTreeProvider(configService);
  const treeView = vscode.window.createTreeView("cddExplorer", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Skill Editor (WebviewPanel)
  const skillEditor = new SkillEditorProvider(configService, treeProvider);

  // WebviewView providers
  const chatViewProvider = new CddChatViewProvider(
    context,
    configService,
    agentService,
    treeProvider
  );
  const claudeMdViewProvider = new CddClaudeMdViewProvider(
    configService,
    claudeMdService
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("cddChat", chatViewProvider),
    vscode.window.registerWebviewViewProvider(
      "cddClaudeMd",
      claudeMdViewProvider
    ),
    claudeMdViewProvider, // Disposable for watcher cleanup
    claudeMdService // Disposable for event emitter cleanup
  );

  // Status bar — Project info
  projectStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50
  );
  projectStatusBar.command = "cddExplorer.focus";

  // Status bar — Connection status
  connectionStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    49
  );

  updateProjectStatusBar(configService);
  await updateConnectionStatusBar(context, agentService);

  configService.onDidChangeConfig(() => {
    updateProjectStatusBar(configService);
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("cdd.initProject", () =>
      initProjectCommand(configService, treeProvider)
    ),
    vscode.commands.registerCommand("cdd.addModule", () =>
      addModuleCommand(configService, treeProvider)
    ),
    vscode.commands.registerCommand("cdd.addStack", () =>
      addStackCommand(configService, treeProvider)
    ),
    vscode.commands.registerCommand("cdd.runDoctor", () =>
      runDoctorCommand(configService)
    ),
    vscode.commands.registerCommand("cdd.regenerate", () =>
      regenerateCommand(configService, treeProvider)
    ),
    vscode.commands.registerCommand("cdd.askAgent", () =>
      vscode.commands.executeCommand("cddChat.focus")
    ),
    vscode.commands.registerCommand("cdd.toggleRule", (item) =>
      toggleRuleCommand(
        typeof item === "string" ? item : item?.ruleId,
        configService,
        treeProvider
      )
    ),
    vscode.commands.registerCommand("cdd.createSkill", () =>
      createSkillCommand(configService, treeProvider)
    ),
    vscode.commands.registerCommand("cdd.createHook", () =>
      createHookCommand(configService, treeProvider)
    ),
    vscode.commands.registerCommand("cdd.applyPreset", () =>
      applyPresetCommand(configService, treeProvider)
    ),
    vscode.commands.registerCommand("cdd.editSkill", (item) => {
      const skillName = typeof item === "string" ? item : item?.label;
      skillEditor.openSkillEditor(skillName);
    }),
    vscode.commands.registerCommand("cdd.deleteSkill", async (item) => {
      const skillName = typeof item === "string" ? item : item?.label;
      if (!skillName) return;

      const root = configService.getWorkspaceRoot();
      if (!root) return;

      const confirm = await vscode.window.showWarningMessage(
        `Delete skill "${skillName}"?`,
        "Delete",
        "Cancel"
      );
      if (confirm !== "Delete") return;

      const skillDir = path.join(root, ".claude", "skills", skillName);
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true });
        treeProvider.refresh();
        vscode.window.showInformationMessage(
          `Skill "${skillName}" deleted.`
        );
      }
    }),
    vscode.commands.registerCommand("cdd.loginAnthropic", async () => {
      try {
        const session = await vscode.authentication.getSession(
          "anthropic",
          [],
          { createIfNone: true }
        );
        if (session) {
          await agentService.initialize(session.accessToken);
          await updateConnectionStatusBar(context, agentService);
          chatViewProvider.updateContent();
          vscode.window.showInformationMessage(
            "Anthropic API connected. CDD Agent ready."
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Login failed: ${err}`);
      }
    }),
    vscode.commands.registerCommand("cdd.logoutAnthropic", async () => {
      await authProvider.removeSession("anthropic-session");
      await updateConnectionStatusBar(context, agentService);
      chatViewProvider.updateContent();
      vscode.window.showInformationMessage("Anthropic API disconnected.");
    }),
    vscode.commands.registerCommand("cdd.refreshTree", () =>
      treeProvider.refresh()
    ),
    treeView,
    projectStatusBar,
    connectionStatusBar,
    configService,
    authProvider
  );

  // Initialize agent if API key already stored
  const existingKey = await getApiKey(context);
  if (existingKey) {
    try {
      await agentService.initialize(existingKey);
    } catch {
      // Silent fail — agent will prompt for login when used
    }
  }

  await updateConnectionStatusBar(context, agentService);
}

function updateProjectStatusBar(configService: ConfigService): void {
  const config = configService.getConfig();

  if (!config) {
    projectStatusBar.text = "$(layers) CDD: No project";
    projectStatusBar.tooltip = "Click to open CDD Explorer";
    projectStatusBar.command = "cdd.initProject";
  } else {
    const moduleCount = config.modules.length;
    const preset = config.methodology.preset;
    projectStatusBar.text = `$(layers) CDD: ${preset} | ${moduleCount}m`;
    projectStatusBar.tooltip = `CDD Project: ${config.project.name}\nPreset: ${preset}\nModules: ${moduleCount}`;
    projectStatusBar.command = "cddExplorer.focus";
  }

  projectStatusBar.show();
}

async function updateConnectionStatusBar(
  context: vscode.ExtensionContext,
  agentService: CddAgentService
): Promise<void> {
  const apiKey = await getApiKey(context);
  const isConnected = !!apiKey && agentService.isReady();

  const vscodeConfig = vscode.workspace.getConfiguration("cdd");
  const modelId = vscodeConfig.get<string>(
    "anthropic.model",
    "claude-sonnet-4-6-20250414"
  );

  if (isConnected) {
    const modelName = getModelDisplayName(modelId);
    connectionStatusBar.text = `$(circle-filled) ${modelName}`;
    connectionStatusBar.tooltip = `Connected to ${modelName}\nClick to disconnect`;
    connectionStatusBar.color = new vscode.ThemeColor(
      "testing.iconPassed"
    );
    connectionStatusBar.command = "cdd.logoutAnthropic";
  } else {
    connectionStatusBar.text = "$(circle-slash) Disconnected";
    connectionStatusBar.tooltip = "Click to connect to Anthropic";
    connectionStatusBar.color = new vscode.ThemeColor(
      "testing.iconFailed"
    );
    connectionStatusBar.command = "cdd.loginAnthropic";
  }

  connectionStatusBar.show();
}

function getModelDisplayName(modelId: string): string {
  if (modelId.includes("haiku")) return "Claude Haiku 4.5";
  if (modelId.includes("sonnet")) return "Claude Sonnet 4.6";
  if (modelId.includes("opus")) return "Claude Opus 4.6";
  return modelId;
}

export function deactivate(): void {
  // Cleanup handled by disposables
}

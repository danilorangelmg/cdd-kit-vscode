import * as vscode from "vscode";
import { ConfigService } from "./services/configService";
import { CddTreeProvider } from "./providers/CddTreeProvider";
import { CddAgentService } from "./services/cddAgentService";
import {
  AnthropicAuthProvider,
  getApiKey,
} from "./auth/anthropicAuthProvider";
import { initProjectCommand } from "./commands/initProject";
import { addModuleCommand } from "./commands/addModule";
import { addStackCommand } from "./commands/addStack";
import { runDoctorCommand } from "./commands/runDoctor";
import { regenerateCommand } from "./commands/regenerate";
import { askAgentCommand } from "./commands/askAgent";

let statusBarItem: vscode.StatusBarItem;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  // Core services
  const configService = new ConfigService();
  const agentService = new CddAgentService();
  const authProvider = new AnthropicAuthProvider(context);

  // TreeView
  const treeProvider = new CddTreeProvider(configService);
  const treeView = vscode.window.createTreeView("cddModules", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50
  );
  updateStatusBar(configService, context);
  configService.onDidChangeConfig(() =>
    updateStatusBar(configService, context)
  );

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
      askAgentCommand(context, configService, agentService)
    ),
    vscode.commands.registerCommand("cdd.loginAnthropic", async () => {
      try {
        const session = await vscode.authentication.getSession(
          "anthropic",
          [],
          { createIfNone: true }
        );
        if (session) {
          await agentService.initialize(session.accessToken);
          updateStatusBar(configService, context);
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
      updateStatusBar(configService, context);
      vscode.window.showInformationMessage("Anthropic API disconnected.");
    }),
    vscode.commands.registerCommand("cdd.refreshTree", () =>
      treeProvider.refresh()
    ),
    treeView,
    statusBarItem,
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
}

async function updateStatusBar(
  configService: ConfigService,
  context: vscode.ExtensionContext
): Promise<void> {
  const config = configService.getConfig();
  const apiKey = await getApiKey(context);

  if (!config) {
    statusBarItem.text = "$(layers) CDD: No project";
    statusBarItem.tooltip = "Click to initialize a CDD project";
    statusBarItem.command = "cdd.initProject";
  } else {
    const moduleCount = config.modules.length;
    const preset = config.methodology.preset;
    const agentStatus = apiKey ? "$(check)" : "$(circle-slash)";
    statusBarItem.text = `$(layers) CDD: ${preset} | ${moduleCount}m ${agentStatus}`;
    statusBarItem.tooltip = `CDD Project: ${config.project.name}\nPreset: ${preset}\nModules: ${moduleCount}\nAgent: ${apiKey ? "Connected" : "Not connected"}`;
    statusBarItem.command = "cdd.askAgent";
  }

  statusBarItem.show();
}

export function deactivate(): void {
  // Cleanup handled by disposables
}

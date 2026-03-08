import * as vscode from "vscode";
import { ConfigService } from "../services/configService.js";
import { CddTreeProvider } from "../providers/CddTreeProvider.js";

export async function toggleRuleCommand(
  ruleId: string,
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const config = configService.getConfig();
  const root = configService.getWorkspaceRoot();
  if (!config || !root) {
    vscode.window.showErrorMessage("No CDD project found.");
    return;
  }

  const currentState = config.methodology.rules[ruleId] ?? false;
  const newState = !currentState;

  // Update config
  config.methodology.rules[ruleId] = newState;
  await configService.saveConfig(config);

  // Regenerate infrastructure
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `${newState ? "Enabling" : "Disabling"} rule ${ruleId}...`,
    },
    async () => {
      const { generateClaudeInfra } = await import("cdd-kit/api");
      await generateClaudeInfra(root, config as never);
    }
  );

  treeProvider.refresh();

  vscode.window.showInformationMessage(
    `Rule ${ruleId} ${newState ? "enabled" : "disabled"}.`
  );
}

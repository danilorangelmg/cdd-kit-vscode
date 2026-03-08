import * as vscode from "vscode";
import { ConfigService } from "../services/configService";
import { CddTreeProvider } from "../providers/CddTreeProvider";

export async function regenerateCommand(
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const config = configService.getConfig();
  const workspaceRoot = configService.getWorkspaceRoot();

  if (!config || !workspaceRoot) {
    vscode.window.showErrorMessage(
      "No cdd.json found. Run CDD: Init Project first."
    );
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    "Regenerate all CDD infrastructure? This will overwrite existing .claude/ files.",
    "Yes",
    "No"
  );
  if (confirm !== "Yes") return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "CDD: Regenerating infrastructure...",
      cancellable: false,
    },
    async () => {
      try {
        const cddKit = await import("cdd-kit/api");
        await cddKit.generateOrchestrator(workspaceRoot, config as any);
        await cddKit.generateClaudeInfra(workspaceRoot, config as any);
        await cddKit.generateDocs(workspaceRoot, config as any);

        for (const mod of config.modules) {
          await cddKit.generateModule(workspaceRoot, config as any, mod as any);
        }

        treeProvider.refresh();
        vscode.window.showInformationMessage(
          "CDD infrastructure regenerated successfully."
        );
      } catch (err) {
        vscode.window.showErrorMessage(`Regeneration failed: ${err}`);
      }
    }
  );
}

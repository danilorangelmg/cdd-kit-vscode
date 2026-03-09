import * as vscode from "vscode";
import { ConfigService } from "../services/configService.js";
import { CddTreeProvider } from "../providers/CddTreeProvider.js";

export async function applyPresetCommand(
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const config = configService.getConfig();
  const root = configService.getWorkspaceRoot();
  if (!config || !root) {
    vscode.window.showErrorMessage("No CDD project found.");
    return;
  }

  let presetOptions: Array<{ label: string; description: string; rules: Record<string, boolean> }>;

  try {
    const cddKit = await import("cdd-kit/api");
    presetOptions = cddKit.PRESETS.map((p: any) => ({
      label: p.label,
      description: p.description,
      rules: p.rules,
    }));
  } catch {
    // Fallback
    presetOptions = [
      { label: "Minimal", description: "Rules #0, #5 only", rules: {} },
      { label: "Standard (Recommended)", description: "Core + TDD + Feature Gate + Changelog", rules: {} },
      { label: "Full", description: "All 10 rules enabled", rules: {} },
    ];
  }

  const selected = await vscode.window.showQuickPick(
    presetOptions.map((p) => ({
      label: p.label,
      description: p.description,
    })),
    {
      title: "Apply Governance Preset",
      placeHolder: `Current: ${config.methodology.preset}`,
    }
  );

  if (!selected) return;

  const preset = presetOptions.find((p) => p.label === selected.label);
  if (!preset || !Object.keys(preset.rules).length) {
    vscode.window.showWarningMessage("Preset data not available. Install cdd-kit.");
    return;
  }

  config.methodology.preset = preset.label.toLowerCase().replace(/\s.*/, "");
  config.methodology.rules = { ...preset.rules };

  await configService.saveConfig(config);

  // Regenerate infrastructure
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Applying ${selected.label} preset...`,
    },
    async () => {
      try {
        const cddKit = await import("cdd-kit/api");
        await cddKit.generateClaudeInfra(root, config as never);
      } catch {
        // Generation optional
      }
    }
  );

  treeProvider.refresh();
  vscode.window.showInformationMessage(
    `Preset "${selected.label}" applied. ${Object.values(preset.rules).filter(Boolean).length} rules active.`
  );
}

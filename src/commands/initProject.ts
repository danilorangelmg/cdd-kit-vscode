import * as vscode from "vscode";
import { ConfigService } from "../services/configService";
import { CddTreeProvider } from "../providers/CddTreeProvider";

const PRESETS = [
  {
    label: "standard",
    description: "(Recommended) Rules #0, #1, #3, #4, #5, #8, #9",
  },
  { label: "minimal", description: "Rules #0, #5 only" },
  { label: "full", description: "All 10 rules enabled" },
];

const PRESET_RULES: Record<string, Record<string, boolean>> = {
  minimal: {
    "0": true, "1": false, "2": false, "3": false, "4": false,
    "5": true, "6": false, "7": false, "8": false, "9": false,
  },
  standard: {
    "0": true, "1": true, "2": false, "3": true, "4": true,
    "5": true, "6": false, "7": false, "8": true, "9": true,
  },
  full: {
    "0": true, "1": true, "2": true, "3": true, "4": true,
    "5": true, "6": true, "7": true, "8": true, "9": true,
  },
};

export async function initProjectCommand(
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const workspaceRoot = configService.getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const existingConfig = configService.getConfig();
  if (existingConfig) {
    const overwrite = await vscode.window.showWarningMessage(
      "cdd.json already exists. Overwrite?",
      "Yes",
      "No"
    );
    if (overwrite !== "Yes") return;
  }

  // 1. Project name
  const name = await vscode.window.showInputBox({
    title: "Project Name",
    prompt: "Enter the project name",
    value: workspaceRoot.split("/").pop() || "my-project",
  });
  if (!name) return;

  // 2. Description
  const description = await vscode.window.showInputBox({
    title: "Project Description",
    prompt: "Brief description of the project",
    placeHolder: "A multi-module project with...",
  });
  if (description === undefined) return;

  // 3. Language
  const language = await vscode.window.showQuickPick(
    [
      { label: "en", description: "English" },
      { label: "pt-BR", description: "Portuguese (Brazil)" },
    ],
    { title: "Language", placeHolder: "Select project language" }
  );
  if (!language) return;

  // 4. Preset
  const preset = await vscode.window.showQuickPick(PRESETS, {
    title: "Methodology Preset",
    placeHolder: "Select governance preset",
  });
  if (!preset) return;

  // 5. Create initial config
  const config = {
    version: "1.0.0",
    project: {
      name,
      description: description || "",
      language: language.label,
    },
    modules: [] as Array<{
      name: string;
      role: string;
      directory: string;
      stack?: string;
    }>,
    methodology: {
      preset: preset.label,
      rules: PRESET_RULES[preset.label],
    },
  };

  await configService.saveConfig(config as any);

  // 6. Generate infrastructure
  try {
    const cddKit = await import("cdd-kit/api");
    await cddKit.generateOrchestrator(workspaceRoot, config as any);
    await cddKit.generateClaudeInfra(workspaceRoot, config as any);
    await cddKit.generateDocs(workspaceRoot, config as any);
  } catch (err) {
    vscode.window.showWarningMessage(
      `cdd.json created but generation failed: ${err}`
    );
  }

  treeProvider.refresh();
  vscode.window.showInformationMessage(
    `CDD project "${name}" initialized with ${preset.label} preset. Add modules with CDD: Add Module.`
  );
}

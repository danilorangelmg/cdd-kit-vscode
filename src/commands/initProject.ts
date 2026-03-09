import * as vscode from "vscode";
import { ConfigService } from "../services/configService";
import { CddTreeProvider } from "../providers/CddTreeProvider";

const PRESET_OPTIONS = [
  {
    label: "standard",
    description: "(Recommended) Core + TDD + Feature Gate + Changelog",
  },
  { label: "minimal", description: "Rules #0, #5 only" },
  { label: "full", description: "All 10 rules enabled" },
];

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
  const preset = await vscode.window.showQuickPick(PRESET_OPTIONS, {
    title: "Methodology Preset",
    placeHolder: "Select governance preset",
  });
  if (!preset) return;

  // 5. Get preset rules from cdd-kit (proper string IDs)
  let presetRules: Record<string, boolean>;
  try {
    const cddKit = await import("cdd-kit/api");
    const presetData = cddKit.getPresetById(preset.label);
    if (presetData) {
      presetRules = { ...presetData.rules };
    } else {
      // Fallback with proper IDs
      presetRules = buildFallbackRules(preset.label);
    }
  } catch {
    presetRules = buildFallbackRules(preset.label);
  }

  // 6. Create initial config
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
      rules: presetRules,
    },
  };

  await configService.saveConfig(config as any);

  // 7. Generate infrastructure
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

function buildFallbackRules(preset: string): Record<string, boolean> {
  const allRules = [
    "absolute-delegation", "changelog-by-date", "conditional-mermaid",
    "feature-planning-gate", "api-response-contract", "scope-of-responsibility",
    "e2e-test-protection", "post-dev-e2e-validation", "tdd-enforcement",
    "tdd-sequential-enforcement",
  ];
  const rules: Record<string, boolean> = {};
  for (const r of allRules) rules[r] = false;

  rules["absolute-delegation"] = true;
  rules["scope-of-responsibility"] = true;

  if (preset === "standard" || preset === "full") {
    rules["changelog-by-date"] = true;
    rules["feature-planning-gate"] = true;
    rules["api-response-contract"] = true;
    rules["tdd-enforcement"] = true;
    rules["tdd-sequential-enforcement"] = true;
  }

  if (preset === "full") {
    rules["conditional-mermaid"] = true;
    rules["e2e-test-protection"] = true;
    rules["post-dev-e2e-validation"] = true;
  }

  return rules;
}

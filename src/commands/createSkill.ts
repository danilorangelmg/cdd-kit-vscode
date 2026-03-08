import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "../services/configService.js";
import { CddTreeProvider } from "../providers/CddTreeProvider.js";

export async function createSkillCommand(
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const config = configService.getConfig();
  const root = configService.getWorkspaceRoot();
  if (!config || !root) {
    vscode.window.showErrorMessage("No CDD project found.");
    return;
  }

  // Pick module
  const moduleItems = config.modules.map((m) => ({
    label: m.name,
    description: `${m.role}${m.stack ? ` / ${m.stack}` : ""}`,
  }));

  const selectedModule = await vscode.window.showQuickPick(moduleItems, {
    placeHolder: "Select module for the new skill",
  });
  if (!selectedModule) return;

  // Skill name
  const skillName = await vscode.window.showInputBox({
    prompt: "Skill name",
    placeHolder: "component",
    validateInput: (v) => {
      if (!v.trim()) return "Name is required";
      if (!/^[a-z0-9-]+$/.test(v))
        return "Use only lowercase letters, numbers and hyphens";
      return undefined;
    },
  });
  if (!skillName) return;

  // Skill description
  const description = await vscode.window.showInputBox({
    prompt: "Brief description (optional)",
    placeHolder: "Create React components with TypeScript",
  });

  // Create skill directory and files
  const skillDir = path.join(root, ".claude", "skills", skillName);
  if (fs.existsSync(skillDir)) {
    vscode.window.showWarningMessage(`Skill "${skillName}" already exists.`);
    return;
  }

  fs.mkdirSync(skillDir, { recursive: true });

  const mod = config.modules.find((m) => m.name === selectedModule.label);
  const skillMd = `# Skill: ${skillName}

## Module
${selectedModule.label} (${mod?.role || "generic"})

## Description
${description || "TODO: Describe this skill"}

## When to Use
- TODO: Define when this skill should be applied

## Implementation Pattern
\`\`\`
TODO: Add implementation pattern
\`\`\`

## Quality Checklist
- [ ] TODO: Add quality criteria
`;

  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMd, "utf-8");

  // Optional supporting files
  const addSupporting = await vscode.window.showQuickPick(
    [
      { label: "Yes", description: "Create patterns.md and testing.md" },
      { label: "No", description: "Only SKILL.md" },
    ],
    { placeHolder: "Add supporting files?" }
  );

  if (addSupporting?.label === "Yes") {
    fs.writeFileSync(
      path.join(skillDir, "patterns.md"),
      `# Patterns: ${skillName}\n\n## Common Patterns\n\nTODO: Add patterns\n`,
      "utf-8"
    );
    fs.writeFileSync(
      path.join(skillDir, "testing.md"),
      `# Testing: ${skillName}\n\n## Test Strategy\n\nTODO: Add testing guidelines\n`,
      "utf-8"
    );
  }

  treeProvider.refresh();

  // Open the created SKILL.md
  const doc = await vscode.workspace.openTextDocument(
    path.join(skillDir, "SKILL.md")
  );
  await vscode.window.showTextDocument(doc);

  vscode.window.showInformationMessage(
    `Skill "${skillName}" created for ${selectedModule.label}.`
  );
}

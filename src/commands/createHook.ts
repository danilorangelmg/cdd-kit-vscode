import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "../services/configService.js";
import { CddTreeProvider } from "../providers/CddTreeProvider.js";

const HOOK_TYPES = [
  { label: "PreToolUse", description: "Runs before a tool is used" },
  { label: "PostToolUse", description: "Runs after a tool is used" },
  { label: "UserPromptSubmit", description: "Runs when user submits a prompt" },
  { label: "Stop", description: "Runs when agent stops" },
];

export async function createHookCommand(
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const root = configService.getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("No workspace found.");
    return;
  }

  // Pick hook type
  const hookType = await vscode.window.showQuickPick(HOOK_TYPES, {
    placeHolder: "Select hook type",
  });
  if (!hookType) return;

  // Hook name
  const hookName = await vscode.window.showInputBox({
    prompt: "Hook script name",
    placeHolder: `${hookType.label.toLowerCase()}-check`,
    validateInput: (v) => {
      if (!v.trim()) return "Name is required";
      if (!/^[a-z0-9-]+$/.test(v))
        return "Use only lowercase letters, numbers and hyphens";
      return undefined;
    },
  });
  if (!hookName) return;

  // Create hook
  const hooksDir = path.join(root, ".claude", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookPath = path.join(hooksDir, `${hookName}.sh`);
  if (fs.existsSync(hookPath)) {
    vscode.window.showWarningMessage(`Hook "${hookName}" already exists.`);
    return;
  }

  const hookContent = `#!/bin/bash
# Hook: ${hookName}
# Type: ${hookType.label}
# Description: ${hookType.description}
#
# This hook is triggered on: ${hookType.label}
# Exit 0 to allow, exit non-zero to block.

# TODO: Add your hook logic here

exit 0
`;

  fs.writeFileSync(hookPath, hookContent, "utf-8");
  fs.chmodSync(hookPath, 0o755);

  treeProvider.refresh();

  // Open the created hook
  const doc = await vscode.workspace.openTextDocument(hookPath);
  await vscode.window.showTextDocument(doc);

  vscode.window.showInformationMessage(
    `Hook "${hookName}" (${hookType.label}) created.`
  );
}

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "../services/configService.js";
import { CddTreeProvider } from "../providers/CddTreeProvider.js";

interface ChatAction {
  action: string;
  params: Record<string, string>;
}

export async function applyChatAction(
  action: ChatAction,
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const root = configService.getWorkspaceRoot();
  if (!root) return;

  switch (action.action) {
    case "createSkill": {
      const { name, module: modName, description } = action.params;
      const skillDir = path.join(root, ".claude", "skills", name);
      fs.mkdirSync(skillDir, { recursive: true });

      const content = `# Skill: ${name}\n\n## Module\n${modName || "all"}\n\n## Description\n${description || "Created by CDD Agent"}\n`;
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");

      if (action.params.patterns) {
        fs.writeFileSync(
          path.join(skillDir, "patterns.md"),
          action.params.patterns,
          "utf-8"
        );
      }
      if (action.params.testing) {
        fs.writeFileSync(
          path.join(skillDir, "testing.md"),
          action.params.testing,
          "utf-8"
        );
      }

      treeProvider.refresh();
      const doc = await vscode.workspace.openTextDocument(
        path.join(skillDir, "SKILL.md")
      );
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`Skill "${name}" created.`);
      break;
    }

    case "createHook": {
      const { name, type } = action.params;
      const hooksDir = path.join(root, ".claude", "hooks");
      fs.mkdirSync(hooksDir, { recursive: true });

      const hookPath = path.join(hooksDir, `${name}.sh`);
      const content = `#!/bin/bash\n# Hook: ${name}\n# Type: ${type || "PreToolUse"}\n\nexit 0\n`;
      fs.writeFileSync(hookPath, content, "utf-8");
      fs.chmodSync(hookPath, 0o755);

      treeProvider.refresh();
      const doc = await vscode.workspace.openTextDocument(hookPath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`Hook "${name}" created.`);
      break;
    }

    case "toggleRule": {
      const { ruleId } = action.params;
      await vscode.commands.executeCommand("cdd.toggleRule", ruleId);
      break;
    }

    case "addModule": {
      await vscode.commands.executeCommand("cdd.addModule");
      break;
    }

    default:
      vscode.window.showWarningMessage(
        `Unknown action: ${action.action}`
      );
  }
}

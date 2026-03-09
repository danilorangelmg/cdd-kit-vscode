import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "../services/configService.js";
import { CddTreeProvider } from "./CddTreeProvider.js";
import { getSkillEditorHtml } from "../webviews/skillEditorView.js";
import type { SkillFormData } from "../webviews/protocol.js";

export class SkillEditorProvider {
  private panels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private configService: ConfigService,
    private treeProvider: CddTreeProvider
  ) {}

  openSkillEditor(skillName?: string): void {
    const config = this.configService.getConfig();
    const root = this.configService.getWorkspaceRoot();
    if (!config || !root) {
      vscode.window.showErrorMessage("No CDD project found.");
      return;
    }

    const panelKey = skillName || "__new__";

    // Reuse existing panel if open
    const existing = this.panels.get(panelKey);
    if (existing) {
      existing.reveal();
      return;
    }

    const isNew = !skillName;
    let skillData: SkillFormData | undefined;

    if (skillName) {
      skillData = this.loadSkillData(root, skillName);
    }

    const panel = vscode.window.createWebviewPanel(
      "cddSkillEditor",
      isNew ? "CDD: New Skill" : `CDD: ${skillName}`,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const modules = config.modules.map((m) => ({
      name: m.name,
      role: m.role,
    }));

    panel.webview.html = getSkillEditorHtml({
      skill: skillData,
      modules,
      isNew,
    });

    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "saveSkill":
          await this.saveSkill(root, message.data, message.originalName);
          this.treeProvider.refresh();
          panel.dispose();
          break;

        case "deleteSkill":
          await this.deleteSkill(root, message.name);
          this.treeProvider.refresh();
          panel.dispose();
          break;

        case "cancel":
          panel.dispose();
          break;
      }
    });

    panel.onDidDispose(() => {
      this.panels.delete(panelKey);
    });

    this.panels.set(panelKey, panel);
  }

  private loadSkillData(root: string, skillName: string): SkillFormData | undefined {
    const skillDir = path.join(root, ".claude", "skills", skillName);
    const skillMdPath = path.join(skillDir, "SKILL.md");

    if (!fs.existsSync(skillMdPath)) return undefined;

    const raw = fs.readFileSync(skillMdPath, "utf-8");

    // Parse SKILL.md sections
    const data: SkillFormData = {
      name: skillName,
      module: "",
      description: "",
      whenToUse: "",
      implementationPattern: "",
      qualityChecklist: "",
    };

    const sections = raw.split(/^## /gm);
    for (const section of sections) {
      const lines = section.trim().split("\n");
      const heading = lines[0]?.trim().toLowerCase() || "";
      const content = lines.slice(1).join("\n").trim();

      if (heading.includes("module")) {
        data.module = content.split("\n")[0]?.trim().split(" ")[0] || "";
      } else if (heading.includes("description")) {
        data.description = content;
      } else if (heading.includes("when to use")) {
        data.whenToUse = content;
      } else if (heading.includes("implementation")) {
        data.implementationPattern = content;
      } else if (heading.includes("quality") || heading.includes("checklist")) {
        data.qualityChecklist = content;
      }
    }

    // Check for supporting files
    const patternsPath = path.join(skillDir, "patterns.md");
    if (fs.existsSync(patternsPath)) {
      data.patternsContent = fs.readFileSync(patternsPath, "utf-8");
    }

    const testingPath = path.join(skillDir, "testing.md");
    if (fs.existsSync(testingPath)) {
      data.testingContent = fs.readFileSync(testingPath, "utf-8");
    }

    return data;
  }

  private async saveSkill(
    root: string,
    data: SkillFormData,
    originalName?: string
  ): Promise<void> {
    const skillDir = path.join(root, ".claude", "skills", data.name);
    fs.mkdirSync(skillDir, { recursive: true });

    // Build SKILL.md
    const parts = [`# Skill: ${data.name}`];

    if (data.module) {
      parts.push(`\n## Module\n${data.module}`);
    }
    if (data.description) {
      parts.push(`\n## Description\n${data.description}`);
    }
    if (data.whenToUse) {
      parts.push(`\n## When to Use\n${data.whenToUse}`);
    }
    if (data.implementationPattern) {
      parts.push(`\n## Implementation Pattern\n${data.implementationPattern}`);
    }
    if (data.qualityChecklist) {
      parts.push(`\n## Quality Checklist\n${data.qualityChecklist}`);
    }

    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      parts.join("\n") + "\n",
      "utf-8"
    );

    // Supporting files
    if (data.patternsContent) {
      fs.writeFileSync(
        path.join(skillDir, "patterns.md"),
        data.patternsContent,
        "utf-8"
      );
    }

    if (data.testingContent) {
      fs.writeFileSync(
        path.join(skillDir, "testing.md"),
        data.testingContent,
        "utf-8"
      );
    }

    // If renamed, remove old directory
    if (originalName && originalName !== data.name) {
      const oldDir = path.join(root, ".claude", "skills", originalName);
      if (fs.existsSync(oldDir)) {
        fs.rmSync(oldDir, { recursive: true });
      }
    }

    vscode.window.showInformationMessage(`Skill "${data.name}" saved.`);
  }

  private async deleteSkill(root: string, name: string): Promise<void> {
    const skillDir = path.join(root, ".claude", "skills", name);
    if (fs.existsSync(skillDir)) {
      const confirm = await vscode.window.showWarningMessage(
        `Delete skill "${name}"? This cannot be undone.`,
        "Delete",
        "Cancel"
      );
      if (confirm !== "Delete") return;

      fs.rmSync(skillDir, { recursive: true });
      vscode.window.showInformationMessage(`Skill "${name}" deleted.`);
    }
  }
}

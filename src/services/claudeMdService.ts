import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ConfigService } from "./configService.js";
import type {
  ClaudeMdFileData,
  ClaudeMdSectionData,
} from "../webviews/protocol.js";

export { ClaudeMdFileData, ClaudeMdSectionData };

// Re-export for backward compat
export type ClaudeMdFile = ClaudeMdFileData;
export type ClaudeMdSection = ClaudeMdSectionData;

export class ClaudeMdService {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private configService: ConfigService) {}

  parseClaudeMd(filePath: string, label: string): ClaudeMdFile | null {
    try {
      if (!fs.existsSync(filePath)) return null;
    } catch {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split("\n");
    const sections: ClaudeMdSection[] = [];

    let currentSection: ClaudeMdSection | null = null;
    const preambleLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Support h1-h6 headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

      if (headingMatch) {
        // Save preamble (content before first heading)
        if (!currentSection && preambleLines.length > 0) {
          const preambleContent = preambleLines.join("\n").trim();
          if (preambleContent) {
            sections.push({
              heading: "(Preamble)",
              level: 0,
              content: preambleContent,
              lineStart: 1,
              lineEnd: i,
            });
          }
        }

        if (currentSection) {
          currentSection.lineEnd = i; // line before this heading (0-indexed, but stored as-is)
          currentSection.content = currentSection.content.trim();
          sections.push(currentSection);
        }

        currentSection = {
          heading: headingMatch[2].trim(),
          level: headingMatch[1].length,
          content: "",
          lineStart: i + 1, // 1-indexed for VS Code
          lineEnd: i + 1,
        };
      } else if (currentSection) {
        currentSection.content += line + "\n";
      } else {
        preambleLines.push(line);
      }
    }

    // Handle preamble-only file (no headings at all)
    if (!currentSection && preambleLines.length > 0) {
      const preambleContent = preambleLines.join("\n").trim();
      if (preambleContent) {
        sections.push({
          heading: "(Preamble)",
          level: 0,
          content: preambleContent,
          lineStart: 1,
          lineEnd: lines.length,
        });
      }
    }

    if (currentSection) {
      currentSection.lineEnd = lines.length;
      currentSection.content = currentSection.content.trim();
      sections.push(currentSection);
    }

    return { path: filePath, label, sections };
  }

  getAllClaudeMdFiles(): ClaudeMdFile[] {
    const config = this.configService.getConfig();
    const root = this.configService.getWorkspaceRoot();
    if (!root) return [];

    const files: ClaudeMdFile[] = [];

    // Root CLAUDE.md
    const rootFile = this.parseClaudeMd(
      path.join(root, "CLAUDE.md"),
      "Root"
    );
    if (rootFile) files.push(rootFile);

    // Module CLAUDE.md files
    if (config) {
      for (const mod of config.modules) {
        const modFile = this.parseClaudeMd(
          path.join(root, mod.directory, "CLAUDE.md"),
          mod.name
        );
        if (modFile) files.push(modFile);
      }
    }

    return files;
  }

  updateSection(
    filePath: string,
    sectionIndex: number,
    newContent: string
  ): boolean {
    const file = this.parseClaudeMd(filePath, "");
    if (!file || sectionIndex >= file.sections.length) return false;

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split("\n");
    const section = file.sections[sectionIndex];

    // Determine the content lines range (after the heading line)
    const headingLineIndex = section.lineStart - 1; // 0-indexed
    const endLineIndex = section.lineEnd - 1; // 0-indexed

    // For preamble (level 0), replace all lines
    if (section.level === 0) {
      const newLines = newContent.split("\n");
      lines.splice(0, endLineIndex + 1, ...newLines);
    } else {
      // Replace content after heading, before next section
      const contentStart = headingLineIndex + 1;
      const contentEnd = endLineIndex + 1;
      const headingLine = lines[headingLineIndex];
      const newLines = [headingLine, "", ...newContent.split("\n"), ""];
      lines.splice(headingLineIndex, contentEnd - headingLineIndex, ...newLines);
    }

    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    this._onDidChange.fire();
    return true;
  }

  addRuleSection(filePath: string, ruleId: string, ruleName: string, ruleDescription: string): boolean {
    if (!fs.existsSync(filePath)) return false;

    const raw = fs.readFileSync(filePath, "utf-8");
    const newSection = `\n## Rule: ${ruleName}\n\n${ruleDescription}\n`;
    fs.writeFileSync(filePath, raw + newSection, "utf-8");
    this._onDidChange.fire();
    return true;
  }

  removeRuleSection(filePath: string, ruleId: string): boolean {
    const file = this.parseClaudeMd(filePath, "");
    if (!file) return false;

    // Find section matching rule name pattern
    const sectionIndex = file.sections.findIndex(
      (s) => s.heading.toLowerCase().includes(ruleId.toLowerCase())
    );
    if (sectionIndex === -1) return false;

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split("\n");
    const section = file.sections[sectionIndex];
    const start = section.lineStart - 1;
    const end = section.lineEnd;
    lines.splice(start, end - start);

    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    this._onDidChange.fire();
    return true;
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

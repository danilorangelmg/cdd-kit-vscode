import * as fs from "fs";
import * as path from "path";
import { ConfigService } from "./configService.js";
import type { ClaudeMdFile, ClaudeMdSection } from "../webviews/claudeMdView.js";

export { ClaudeMdFile, ClaudeMdSection };

export class ClaudeMdService {
  constructor(private configService: ConfigService) {}

  parseClaudeMd(filePath: string, label: string): ClaudeMdFile | null {
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split("\n");
    const sections: ClaudeMdSection[] = [];

    let currentSection: ClaudeMdSection | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/);

      if (headingMatch) {
        if (currentSection) {
          currentSection.lineEnd = i - 1;
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
      }
    }

    if (currentSection) {
      currentSection.lineEnd = lines.length;
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
      "Root CLAUDE.md"
    );
    if (rootFile) files.push(rootFile);

    // Module CLAUDE.md files
    if (config) {
      for (const mod of config.modules) {
        const modFile = this.parseClaudeMd(
          path.join(root, mod.directory, "CLAUDE.md"),
          `${mod.name} CLAUDE.md`
        );
        if (modFile) files.push(modFile);
      }
    }

    return files;
  }
}

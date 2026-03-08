import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ConfigService, CddConfig } from "../services/configService";

type NodeType =
  | "project"
  | "module"
  | "category"
  | "skill"
  | "rule"
  | "agent"
  | "methodology"
  | "preset"
  | "ruleItem"
  | "hookItem"
  | "doctor";

interface CddNode {
  type: NodeType;
  label: string;
  description?: string;
  tooltip?: string;
  filePath?: string;
  children?: CddNode[];
  contextValue?: string;
  iconId?: string;
}

const ROLE_ICONS: Record<string, string> = {
  frontend: "browser",
  backend: "server",
  database: "database",
  "agent-ai": "hubot",
  mobile: "device-mobile",
  e2e: "beaker",
  generic: "package",
};

export class CddTreeProvider implements vscode.TreeDataProvider<CddNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    CddNode | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private rootNodes: CddNode[] = [];

  constructor(private configService: ConfigService) {
    this.configService.onDidChangeConfig(() => this.refresh());
    this.buildTree();
  }

  refresh(): void {
    this.configService.loadConfig();
    this.buildTree();
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: CddNode): vscode.TreeItem {
    const hasChildren = element.children && element.children.length > 0;
    const item = new vscode.TreeItem(
      element.label,
      hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    item.description = element.description;
    item.tooltip = element.tooltip;
    item.contextValue = element.contextValue || element.type;

    if (element.iconId) {
      item.iconPath = new vscode.ThemeIcon(element.iconId);
    }

    if (element.filePath) {
      item.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(element.filePath)],
      };
    }

    // Auto-expand project and methodology
    if (element.type === "project" || element.type === "methodology") {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }

    return item;
  }

  getChildren(element?: CddNode): CddNode[] {
    if (!element) {
      return this.rootNodes;
    }
    return element.children || [];
  }

  private buildTree(): void {
    const config = this.configService.getConfig();
    if (!config) {
      this.rootNodes = [
        {
          type: "project",
          label: "No cdd.json found",
          description: "Run CDD: Init Project",
          iconId: "warning",
        },
      ];
      return;
    }

    const workspaceRoot = this.configService.getWorkspaceRoot();
    if (!workspaceRoot) return;

    const moduleNodes = config.modules.map((mod) =>
      this.buildModuleNode(config, mod, workspaceRoot)
    );

    const methodologyNode = this.buildMethodologyNode(config);
    const doctorNode = this.buildDoctorNode(config, workspaceRoot);

    this.rootNodes = [
      {
        type: "project",
        label: config.project.name,
        description: `${config.methodology.preset} | ${config.modules.length} modules`,
        iconId: "layers",
        children: moduleNodes,
      },
      methodologyNode,
      doctorNode,
    ];
  }

  private buildModuleNode(
    config: CddConfig,
    mod: { name: string; role: string; directory: string; stack?: string },
    workspaceRoot: string
  ): CddNode {
    const moduleDir = path.join(workspaceRoot, mod.directory);
    const claudeDir = path.join(workspaceRoot, ".claude");

    const stackLabel = mod.stack ? ` [${mod.stack}]` : "";
    const skills = this.findSkills(config, mod, claudeDir);
    const rules = this.findRules(claudeDir);
    const agents = this.findAgents(mod.name, claudeDir);

    return {
      type: "module",
      label: mod.name + stackLabel,
      description: mod.role,
      iconId: ROLE_ICONS[mod.role] || "package",
      contextValue: "module",
      children: [
        {
          type: "category",
          label: "Skills",
          description: `${skills.length}`,
          iconId: "symbol-method",
          children: skills,
        },
        {
          type: "category",
          label: "Rules",
          description: `${rules.length} active`,
          iconId: "law",
          children: rules,
        },
        {
          type: "category",
          label: "Agents",
          description: `${agents.length}`,
          iconId: "hubot",
          children: agents,
        },
      ],
    };
  }

  private findSkills(
    config: CddConfig,
    mod: { name: string; role: string; stack?: string },
    claudeDir: string
  ): CddNode[] {
    const skillsDir = path.join(claudeDir, "skills");
    if (!fs.existsSync(skillsDir)) return [];

    const skills: CddNode[] = [];
    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
        if (!fs.existsSync(skillMdPath)) continue;

        const supportingFiles: CddNode[] = [];
        const skillDir = path.join(skillsDir, entry.name);
        for (const sf of ["patterns.md", "testing.md"]) {
          const sfPath = path.join(skillDir, sf);
          if (fs.existsSync(sfPath)) {
            supportingFiles.push({
              type: "skill",
              label: sf,
              iconId: "file",
              filePath: sfPath,
            });
          }
        }

        skills.push({
          type: "skill",
          label: entry.name,
          description: supportingFiles.length > 0 ? `+${supportingFiles.length} files` : undefined,
          iconId: "symbol-method",
          filePath: skillMdPath,
          children: supportingFiles.length > 0 ? supportingFiles : undefined,
        });
      }
    } catch {
      // skills dir not readable
    }

    return skills;
  }

  private findRules(claudeDir: string): CddNode[] {
    const rulesDir = path.join(claudeDir, "rules");
    if (!fs.existsSync(rulesDir)) return [];

    const rules: CddNode[] = [];
    try {
      const scanDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.name.endsWith(".md")) {
            rules.push({
              type: "rule",
              label: entry.name.replace(".md", ""),
              iconId: "law",
              filePath: fullPath,
            });
          }
        }
      };
      scanDir(rulesDir);
    } catch {
      // rules dir not readable
    }

    return rules;
  }

  private findAgents(moduleName: string, claudeDir: string): CddNode[] {
    const agentsDir = path.join(claudeDir, "agents");
    if (!fs.existsSync(agentsDir)) return [];

    const agents: CddNode[] = [];
    try {
      const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.name.endsWith(".md")) continue;
        const fullPath = path.join(agentsDir, entry.name);
        agents.push({
          type: "agent",
          label: entry.name.replace(".md", ""),
          iconId: "hubot",
          filePath: fullPath,
        });
      }
    } catch {
      // agents dir not readable
    }

    return agents;
  }

  private buildMethodologyNode(config: CddConfig): CddNode {
    const activeRules = Object.entries(config.methodology.rules)
      .filter(([, v]) => v)
      .map(([k]) => `#${k}`);

    return {
      type: "methodology",
      label: "Methodology",
      iconId: "gear",
      children: [
        {
          type: "preset",
          label: `Preset: ${config.methodology.preset}`,
          iconId: "symbol-enum",
        },
        {
          type: "ruleItem",
          label: `Rules: ${activeRules.join(", ") || "none"}`,
          iconId: "law",
        },
      ],
    };
  }

  private buildDoctorNode(config: CddConfig, workspaceRoot: string): CddNode {
    const claudeDir = path.join(workspaceRoot, ".claude");
    const hasClaudeDir = fs.existsSync(claudeDir);
    const hasCddJson = fs.existsSync(path.join(workspaceRoot, "cdd.json"));

    const status = hasClaudeDir && hasCddJson ? "OK" : "Issues found";
    const icon = hasClaudeDir && hasCddJson ? "pass" : "warning";

    return {
      type: "doctor",
      label: `Doctor: ${status}`,
      iconId: icon,
    };
  }
}

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ConfigService, CddConfig } from "../services/configService";

type NodeType =
  | "project"
  | "module"
  | "category"
  | "skill"
  | "skillFile"
  | "rule"
  | "agent"
  | "hook"
  | "claudeMd"
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
  ruleId?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  core: "shield",
  documentation: "book",
  testing: "beaker",
  quality: "verified",
};

let cachedRules: Array<{
  id: string;
  number: number;
  name: string;
  description: string;
  category: string;
  alwaysActive: boolean;
  requires: string[];
}> | null = null;

async function loadRuleMetadata(): Promise<typeof cachedRules> {
  if (cachedRules) return cachedRules;
  try {
    const cddKit = await import("cdd-kit/api");
    cachedRules = cddKit.RULES.map((r: any) => ({
      id: r.id,
      number: r.number,
      name: r.name,
      description: r.description,
      category: r.category,
      alwaysActive: r.alwaysActive,
      requires: r.requires || [],
    }));
  } catch {
    cachedRules = null;
  }
  return cachedRules;
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

    // Auto-expand project
    if (element.type === "project") {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }

    return item;
  }

  getChildren(element?: CddNode): CddNode[] {
    if (!element) return this.rootNodes;
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

    const doctorNode = this.buildDoctorNode(workspaceRoot);

    this.rootNodes = [
      {
        type: "project",
        label: config.project.name,
        description: `${config.methodology.preset} | ${config.modules.length} modules`,
        iconId: "layers",
        children: moduleNodes,
      },
      doctorNode,
    ];
  }

  private buildModuleNode(
    config: CddConfig,
    mod: { name: string; role: string; directory: string; stack?: string },
    workspaceRoot: string
  ): CddNode {
    const claudeDir = path.join(workspaceRoot, ".claude");
    const moduleMdPath = path.join(workspaceRoot, mod.directory, "CLAUDE.md");

    const stackLabel = mod.stack ? ` [${mod.stack}]` : "";
    const skills = this.findSkills(claudeDir);
    const rules = this.buildRuleNodes(config);
    const agents = this.findAgents(claudeDir);
    const hooks = this.findHooks(claudeDir);

    const children: CddNode[] = [];

    // CLAUDE.md as first item
    if (fs.existsSync(moduleMdPath)) {
      children.push({
        type: "claudeMd",
        label: "CLAUDE.md",
        iconId: "file-text",
        filePath: moduleMdPath,
        contextValue: "claudeMdFile",
      });
    }

    // Skills
    children.push({
      type: "category",
      label: "Skills",
      description: `${skills.length}`,
      iconId: "symbol-method",
      contextValue: "skillsCategory",
      children: skills,
    });

    // Rules
    children.push({
      type: "category",
      label: "Rules",
      description: `${rules.filter((r) => r.iconId === "pass-filled").length} active`,
      iconId: "law",
      children: rules,
    });

    // Hooks
    children.push({
      type: "category",
      label: "Hooks",
      description: `${hooks.length}`,
      iconId: "git-commit",
      contextValue: "hooksCategory",
      children: hooks,
    });

    // Agents
    if (agents.length > 0) {
      children.push({
        type: "category",
        label: "Agents",
        description: `${agents.length}`,
        iconId: "hubot",
        children: agents,
      });
    }

    return {
      type: "module",
      label: mod.name + stackLabel,
      description: mod.role,
      iconId: ROLE_ICONS[mod.role] || "package",
      contextValue: "module",
      children,
    };
  }

  private findSkills(claudeDir: string): CddNode[] {
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
              type: "skillFile",
              label: sf,
              iconId: "file",
              filePath: sfPath,
            });
          }
        }

        // Show SKILL.md + supporting files as children
        const children: CddNode[] = [
          {
            type: "skillFile",
            label: "SKILL.md",
            iconId: "file-text",
            filePath: skillMdPath,
          },
          ...supportingFiles,
        ];

        skills.push({
          type: "skill",
          label: entry.name,
          description:
            supportingFiles.length > 0
              ? `+${supportingFiles.length} files`
              : undefined,
          iconId: "zap",
          contextValue: "skill",
          children,
        });
      }
    } catch {
      // skills dir not readable
    }

    return skills;
  }

  private buildRuleNodes(config: CddConfig): CddNode[] {
    // Try to use cached metadata for richer display
    // Also trigger async load for next refresh
    loadRuleMetadata().then(() => {});

    return Object.entries(config.methodology.rules).map(
      ([ruleId, isActive]) => {
        const meta = cachedRules?.find((r) => r.id === ruleId);

        const label = meta
          ? `#${meta.number} ${meta.name}`
          : ruleId;

        const description = isActive ? "enabled" : "disabled";
        const iconId = isActive ? "pass-filled" : "circle-large-outline";

        // Check for missing dependencies
        let tooltip = meta?.description || "";
        if (meta && isActive) {
          const missingDeps = meta.requires.filter(
            (dep) => !config.methodology.rules[dep]
          );
          if (missingDeps.length > 0) {
            tooltip += `\n⚠️ Requires: ${missingDeps.join(", ")}`;
          }
        }

        return {
          type: "rule" as NodeType,
          label,
          description,
          iconId: meta && isActive
            ? CATEGORY_ICONS[meta.category] || iconId
            : iconId,
          contextValue: "rule",
          ruleId,
          tooltip,
        };
      }
    );
  }

  private findHooks(claudeDir: string): CddNode[] {
    const hooksDir = path.join(claudeDir, "hooks");
    if (!fs.existsSync(hooksDir)) return [];

    const hooks: CddNode[] = [];
    try {
      const entries = fs.readdirSync(hooksDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) continue;
        const fullPath = path.join(hooksDir, entry.name);
        hooks.push({
          type: "hook",
          label: entry.name,
          iconId: "git-commit",
          filePath: fullPath,
        });
      }
    } catch {
      // hooks dir not readable
    }

    return hooks;
  }

  private findAgents(claudeDir: string): CddNode[] {
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

  private buildDoctorNode(workspaceRoot: string): CddNode {
    const claudeDir = path.join(workspaceRoot, ".claude");
    const hasClaudeDir = fs.existsSync(claudeDir);
    const hasCddJson = fs.existsSync(path.join(workspaceRoot, "cdd.json"));

    const status = hasClaudeDir && hasCddJson ? "All passed" : "Issues found";
    const icon = hasClaudeDir && hasCddJson ? "pass" : "warning";

    return {
      type: "doctor",
      label: `Doctor: ${status}`,
      iconId: icon,
    };
  }
}

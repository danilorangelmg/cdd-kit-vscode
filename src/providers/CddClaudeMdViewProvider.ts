import * as vscode from "vscode";
import { ClaudeMdService } from "../services/claudeMdService.js";
import { ConfigService } from "../services/configService.js";
import { getClaudeMdHtml } from "../webviews/claudeMdView.js";
import type { RuleMetadata } from "../webviews/protocol.js";

export class CddClaudeMdViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly viewType = "cddClaudeMd";

  private view?: vscode.WebviewView;
  private watcher?: vscode.FileSystemWatcher;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private configService: ConfigService,
    private claudeMdService: ClaudeMdService
  ) {
    // Refresh when config changes
    const configSub = configService.onDidChangeConfig(() => this.refresh());
    this.disposables.push(configSub);

    // Refresh when CLAUDE.md files change
    const mdSub = claudeMdService.onDidChange(() => this.refresh());
    this.disposables.push(mdSub);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    this.updateContent();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "openFile":
          vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(message.path)
          );
          break;

        case "openFileAtLine": {
          const uri = vscode.Uri.file(message.path);
          const line = Math.max(0, (message.line || 1) - 1);
          vscode.window.showTextDocument(uri, {
            selection: new vscode.Range(line, 0, line, 0),
          });
          break;
        }

        case "editSection":
          this.claudeMdService.updateSection(
            message.filePath,
            message.sectionIndex,
            message.content
          );
          this.refresh();
          break;

        case "addRule":
          this.claudeMdService.addRuleSection(
            message.filePath,
            message.ruleId,
            message.ruleName || message.ruleId,
            message.ruleDescription || ""
          );
          this.refresh();
          break;

        case "removeRule":
          this.claudeMdService.removeRuleSection(
            message.filePath,
            message.ruleId
          );
          this.refresh();
          break;

        case "toggleRule":
          await vscode.commands.executeCommand(
            "cdd.toggleRule",
            message.ruleId
          );
          break;
      }
    });

    // Setup file watcher (dispose previous if any)
    this.setupWatcher();
  }

  private setupWatcher(): void {
    this.watcher?.dispose();

    const root = this.configService.getWorkspaceRoot();
    if (!root) return;

    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, "**/CLAUDE.md")
    );
    this.watcher.onDidChange(() => this.refresh());
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
  }

  refresh(): void {
    this.updateContent();
  }

  private async updateContent(): Promise<void> {
    if (!this.view) return;

    const files = this.claudeMdService.getAllClaudeMdFiles();

    // Get rule metadata for display
    let rules: RuleMetadata[] = [];
    try {
      const config = this.configService.getConfig();
      if (config) {
        const cddKit = await import("cdd-kit/api");
        rules = cddKit.RULES.map((r: any) => ({
          id: r.id,
          number: r.number,
          name: r.name,
          description: r.description,
          category: r.category,
          alwaysActive: r.alwaysActive,
          requires: r.requires || [],
          enabled: config.methodology.rules[r.id] ?? r.alwaysActive,
        }));
      }
    } catch {
      // cdd-kit not available — render without rule metadata
    }

    this.view.webview.html = getClaudeMdHtml(files, rules);
  }

  dispose(): void {
    this.watcher?.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

import * as vscode from "vscode";
import { ClaudeMdService } from "../services/claudeMdService.js";
import { ConfigService } from "../services/configService.js";
import { getClaudeMdHtml } from "../webviews/claudeMdView.js";

export class CddClaudeMdViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cddClaudeMd";

  private view?: vscode.WebviewView;
  private claudeMdService: ClaudeMdService;

  constructor(
    private configService: ConfigService,
    claudeMdService: ClaudeMdService
  ) {
    this.claudeMdService = claudeMdService;

    // Refresh when config changes
    configService.onDidChangeConfig(() => this.refresh());
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    this.updateContent();

    webviewView.webview.onDidReceiveMessage((message) => {
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
      }
    });

    // Watch for CLAUDE.md file changes
    const root = this.configService.getWorkspaceRoot();
    if (root) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(root, "**/CLAUDE.md")
      );
      watcher.onDidChange(() => this.refresh());
      watcher.onDidCreate(() => this.refresh());
      watcher.onDidDelete(() => this.refresh());
    }
  }

  refresh(): void {
    this.updateContent();
  }

  private updateContent(): void {
    if (!this.view) return;
    const files = this.claudeMdService.getAllClaudeMdFiles();
    this.view.webview.html = getClaudeMdHtml(files);
  }
}

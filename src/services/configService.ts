import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface CddConfig {
  version: string;
  project: {
    name: string;
    description: string;
    language: string;
  };
  modules: Array<{
    name: string;
    role: string;
    directory: string;
    stack?: string;
  }>;
  methodology: {
    preset: string;
    rules: Record<string, boolean>;
  };
  git?: {
    submodules: boolean;
    org: string;
    provider: string;
    prefix: string;
  };
}

export class ConfigService {
  private _onDidChangeConfig = new vscode.EventEmitter<CddConfig | undefined>();
  readonly onDidChangeConfig = this._onDidChangeConfig.event;

  private config: CddConfig | undefined;
  private watcher: vscode.FileSystemWatcher | undefined;
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (this.workspaceRoot) {
      this.loadConfig();
      this.watchConfig();
    }
  }

  getConfig(): CddConfig | undefined {
    return this.config;
  }

  getWorkspaceRoot(): string | undefined {
    return this.workspaceRoot;
  }

  getCddJsonPath(): string | undefined {
    if (!this.workspaceRoot) return undefined;
    return path.join(this.workspaceRoot, "cdd.json");
  }

  loadConfig(): CddConfig | undefined {
    const configPath = this.getCddJsonPath();
    if (!configPath || !fs.existsSync(configPath)) {
      this.config = undefined;
      this._onDidChangeConfig.fire(undefined);
      return undefined;
    }

    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      this.config = JSON.parse(raw) as CddConfig;
      this._onDidChangeConfig.fire(this.config);
      return this.config;
    } catch {
      this.config = undefined;
      this._onDidChangeConfig.fire(undefined);
      return undefined;
    }
  }

  async saveConfig(config: CddConfig): Promise<void> {
    const configPath = this.getCddJsonPath();
    if (!configPath) return;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    this.config = config;
    this._onDidChangeConfig.fire(config);
  }

  private watchConfig(): void {
    if (!this.workspaceRoot) return;

    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, "cdd.json")
    );

    this.watcher.onDidChange(() => this.loadConfig());
    this.watcher.onDidCreate(() => this.loadConfig());
    this.watcher.onDidDelete(() => {
      this.config = undefined;
      this._onDidChangeConfig.fire(undefined);
    });
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidChangeConfig.dispose();
  }
}

import * as vscode from "vscode";
import { CddAgentService } from "../services/cddAgentService.js";
import { ConfigService } from "../services/configService.js";
import { getApiKey } from "../auth/anthropicAuthProvider.js";
import { getChatHtml } from "../webviews/chatView.js";
import { applyChatAction } from "../commands/chatActions.js";
import { CddTreeProvider } from "./CddTreeProvider.js";

export class CddChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cddChat";

  private view?: vscode.WebviewView;

  constructor(
    private context: vscode.ExtensionContext,
    private configService: ConfigService,
    private agentService: CddAgentService,
    private treeProvider: CddTreeProvider
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    this.updateContent();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "send":
          await this.handleSend(message.text);
          break;
        case "connect":
          await vscode.commands.executeCommand("cdd.loginAnthropic");
          this.updateContent();
          break;
        case "disconnect":
          await vscode.commands.executeCommand("cdd.logoutAnthropic");
          this.updateContent();
          break;
        case "applyAction":
          await applyChatAction(
            message.action,
            this.configService,
            this.treeProvider
          );
          break;
      }
    });
  }

  async updateContent(): Promise<void> {
    if (!this.view) return;

    const apiKey = await getApiKey(this.context);
    const isConnected = !!apiKey && this.agentService.isReady();

    const vscodeConfig = vscode.workspace.getConfiguration("cdd");
    const modelId = vscodeConfig.get<string>(
      "anthropic.model",
      "claude-sonnet-4-6-20250414"
    );
    const modelName = getModelDisplayName(modelId);

    this.view.webview.html = getChatHtml(isConnected, modelName);
  }

  private async handleSend(text: string): Promise<void> {
    if (!this.view) return;

    const apiKey = await getApiKey(this.context);
    if (!apiKey) {
      this.view.webview.postMessage({
        command: "error",
        text: "Not connected. Click Connect to login.",
      });
      return;
    }

    if (!this.agentService.isReady()) {
      await this.agentService.initialize(apiKey);
    }

    const config = this.configService.getConfig();

    this.view.webview.postMessage({ command: "startResponse" });

    try {
      await this.agentService.sendMessage(text, config, (token) => {
        this.view?.webview.postMessage({ command: "token", text: token });
      });
      this.view.webview.postMessage({ command: "endResponse" });
    } catch (err) {
      this.view.webview.postMessage({
        command: "error",
        text: `${err}`,
      });
    }
  }
}

function getModelDisplayName(modelId: string): string {
  if (modelId.includes("haiku")) return "Claude Haiku 4.5";
  if (modelId.includes("sonnet")) return "Claude Sonnet 4.6";
  if (modelId.includes("opus")) return "Claude Opus 4.6";
  return modelId;
}

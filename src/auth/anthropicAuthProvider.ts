import * as vscode from "vscode";

const AUTH_PROVIDER_ID = "anthropic";
const AUTH_PROVIDER_LABEL = "Anthropic";
const SECRET_KEY = "cdd.anthropic.apiKey";

export class AnthropicAuthProvider
  implements vscode.AuthenticationProvider, vscode.Disposable
{
  private _onDidChangeSessions =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.authentication.registerAuthenticationProvider(
        AUTH_PROVIDER_ID,
        AUTH_PROVIDER_LABEL,
        this,
        { supportsMultipleAccounts: false }
      )
    );
  }

  async getSessions(): Promise<vscode.AuthenticationSession[]> {
    const apiKey = await this.context.secrets.get(SECRET_KEY);
    if (!apiKey) return [];

    return [
      {
        id: "anthropic-session",
        accessToken: apiKey,
        account: { id: "anthropic", label: "Anthropic API" },
        scopes: [],
      },
    ];
  }

  async createSession(): Promise<vscode.AuthenticationSession> {
    const apiKey = await vscode.window.showInputBox({
      title: "Anthropic API Key",
      prompt: "Enter your Anthropic API key to enable the CDD Agent",
      placeHolder: "sk-ant-...",
      password: true,
      validateInput: (value) => {
        if (!value) return "API key is required";
        if (!value.startsWith("sk-ant-"))
          return "Invalid format: key should start with sk-ant-";
        return undefined;
      },
    });

    if (!apiKey) {
      throw new Error("API key input cancelled");
    }

    // Validate the key by making a lightweight request
    const valid = await this.validateApiKey(apiKey);
    if (!valid) {
      throw new Error("Invalid API key — could not authenticate with Anthropic");
    }

    await this.context.secrets.store(SECRET_KEY, apiKey);

    const session: vscode.AuthenticationSession = {
      id: "anthropic-session",
      accessToken: apiKey,
      account: { id: "anthropic", label: "Anthropic API" },
      scopes: [],
    };

    this._onDidChangeSessions.fire({
      added: [session],
      removed: [],
      changed: [],
    });

    return session;
  }

  async removeSession(_sessionId: string): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY);
    this._onDidChangeSessions.fire({
      added: [],
      removed: [
        {
          id: "anthropic-session",
          accessToken: "",
          account: { id: "anthropic", label: "Anthropic API" },
          scopes: [],
        },
      ],
      changed: [],
    });
  }

  private async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await globalThis.fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      // 200 = valid, 401 = invalid, anything else = network issue (assume valid)
      return response.status !== 401;
    } catch {
      // Network error — assume key is valid, will fail later on actual use
      return true;
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeSessions.dispose();
  }
}

export async function getApiKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return await context.secrets.get(SECRET_KEY);
}

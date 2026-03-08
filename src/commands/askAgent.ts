import * as vscode from "vscode";
import { ConfigService } from "../services/configService";
import { CddAgentService } from "../services/cddAgentService";
import { getApiKey } from "../auth/anthropicAuthProvider";

let currentPanel: vscode.WebviewPanel | undefined;

export async function askAgentCommand(
  context: vscode.ExtensionContext,
  configService: ConfigService,
  agentService: CddAgentService
): Promise<void> {
  // Check auth
  const apiKey = await getApiKey(context);
  if (!apiKey) {
    const login = await vscode.window.showWarningMessage(
      "CDD Agent requires Anthropic API key. Login now?",
      "Login",
      "Cancel"
    );
    if (login === "Login") {
      await vscode.commands.executeCommand("cdd.loginAnthropic");
      const newKey = await getApiKey(context);
      if (!newKey) return;
      await agentService.initialize(newKey);
    } else {
      return;
    }
  } else if (!agentService.isReady()) {
    await agentService.initialize(apiKey);
  }

  // Create or reveal panel
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "cddAgent",
    "CDD Agent",
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  currentPanel.webview.html = getWebviewContent();

  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === "send") {
        const config = configService.getConfig();

        // Send "thinking" state
        currentPanel?.webview.postMessage({
          command: "startResponse",
        });

        try {
          await agentService.sendMessage(
            message.text,
            config,
            (token) => {
              currentPanel?.webview.postMessage({
                command: "token",
                text: token,
              });
            }
          );

          currentPanel?.webview.postMessage({
            command: "endResponse",
          });
        } catch (err) {
          currentPanel?.webview.postMessage({
            command: "error",
            text: `${err}`,
          });
        }
      } else if (message.command === "clear") {
        agentService.clearHistory();
      }
    },
    undefined,
    context.subscriptions
  );

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CDD Agent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .header {
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h3 { font-size: 14px; font-weight: 600; }
    .header button {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 2px;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .message {
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
    }
    .message.user {
      background: var(--vscode-input-background);
      margin-left: 24px;
    }
    .message.assistant {
      background: var(--vscode-editor-inactiveSelectionBackground);
      margin-right: 24px;
    }
    .message.error {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }
    .input-area {
      padding: 8px 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
    }
    .input-area textarea {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 8px;
      border-radius: 4px;
      resize: none;
      font-family: inherit;
      font-size: inherit;
      min-height: 40px;
      max-height: 120px;
    }
    .input-area button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 4px;
      align-self: flex-end;
    }
    .input-area button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .thinking {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <h3>CDD Agent</h3>
    <button id="clearBtn">Clear</button>
  </div>
  <div class="messages" id="messages"></div>
  <div class="input-area">
    <textarea id="input" placeholder="Ask the CDD agent..." rows="2"></textarea>
    <button id="sendBtn">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    let currentResponseEl = null;
    let isStreaming = false;

    function addMessage(role, text) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    sendBtn.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (!text || isStreaming) return;
      addMessage('user', text);
      vscode.postMessage({ command: 'send', text });
      inputEl.value = '';
      sendBtn.disabled = true;
      isStreaming = true;
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    clearBtn.addEventListener('click', () => {
      messagesEl.innerHTML = '';
      vscode.postMessage({ command: 'clear' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.command) {
        case 'startResponse':
          currentResponseEl = addMessage('assistant', '');
          break;
        case 'token':
          if (currentResponseEl) {
            currentResponseEl.textContent += msg.text;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          break;
        case 'endResponse':
          currentResponseEl = null;
          sendBtn.disabled = false;
          isStreaming = false;
          break;
        case 'error':
          addMessage('error', msg.text);
          currentResponseEl = null;
          sendBtn.disabled = false;
          isStreaming = false;
          break;
      }
    });

    inputEl.focus();
  </script>
</body>
</html>`;
}

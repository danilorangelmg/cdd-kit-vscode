import { sharedCss } from "./shared.js";

export function getChatHtml(isConnected: boolean, modelName: string): string {
  const statusDot = isConnected ? "connected" : "disconnected";
  const statusText = isConnected ? modelName : "Not connected";
  const actionBtn = isConnected
    ? `<button class="secondary" id="disconnectBtn">Disconnect</button>`
    : `<button id="connectBtn">Connect</button>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${sharedCss}
    body { display: flex; flex-direction: column; height: 100vh; }
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
    }
    .status-bar .left { display: flex; align-items: center; }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .message {
      margin-bottom: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
      font-size: 12px;
    }
    .message.user {
      background: var(--vscode-input-background);
      margin-left: 20px;
    }
    .message.assistant {
      background: var(--vscode-editor-inactiveSelectionBackground);
      margin-right: 8px;
    }
    .message.error {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }
    .action-btn {
      margin-top: 6px;
      padding: 4px 12px;
      font-size: 11px;
    }
    .input-area {
      padding: 6px 8px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 6px;
    }
    .input-area textarea {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      padding: 6px 8px;
      border-radius: 3px;
      resize: none;
      font-family: inherit;
      font-size: inherit;
      min-height: 34px;
      max-height: 100px;
    }
    .input-area button { align-self: flex-end; padding: 6px 12px; }
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      padding: 20px;
      gap: 12px;
    }
    .empty-state p { font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="status-bar">
    <div class="left">
      <span class="status-dot ${statusDot}"></span>
      <span>${statusText}</span>
    </div>
    ${actionBtn}
  </div>

  <div class="messages" id="messages">
    ${!isConnected ? `
    <div class="empty-state">
      <p>Connect to Anthropic API to chat with the CDD specialist agent.</p>
      <p>The agent can help you create skills, hooks, rules, and manage your CDD infrastructure.</p>
    </div>
    ` : `
    <div class="empty-state">
      <p>Ask the CDD agent to help you:</p>
      <p>• Create skills, hooks, and rules<br>• Suggest module architecture<br>• Explain governance rules<br>• Plan new modules</p>
    </div>
    `}
  </div>

  <div class="input-area">
    <textarea id="input" placeholder="${isConnected ? "Ask the CDD agent..." : "Connect to start chatting..."}" rows="1" ${!isConnected ? "disabled" : ""}></textarea>
    <button id="sendBtn" ${!isConnected ? "disabled" : ""}>Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    let currentResponseEl = null;
    let isStreaming = false;

    function addMessage(role, text) {
      // Clear empty state
      const emptyState = messagesEl.querySelector('.empty-state');
      if (emptyState) emptyState.remove();

      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    sendBtn?.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (!text || isStreaming) return;
      addMessage('user', text);
      vscode.postMessage({ command: 'send', text });
      inputEl.value = '';
      sendBtn.disabled = true;
      isStreaming = true;
    });

    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn?.click();
      }
    });

    document.getElementById('connectBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'connect' });
    });

    document.getElementById('disconnectBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'disconnect' });
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
          // Check for action blocks in the response
          if (currentResponseEl) {
            const text = currentResponseEl.textContent;
            const actionMatch = text.match(/\`\`\`json\\n(\\{[\\s\\S]*?"action"[\\s\\S]*?\\})\\n\`\`\`/);
            if (actionMatch) {
              try {
                const action = JSON.parse(actionMatch[1]);
                const btn = document.createElement('button');
                btn.className = 'action-btn';
                btn.textContent = '✅ Apply: ' + action.action;
                btn.addEventListener('click', () => {
                  vscode.postMessage({ command: 'applyAction', action });
                  btn.disabled = true;
                  btn.textContent = '✓ Applied';
                });
                currentResponseEl.appendChild(btn);
              } catch {}
            }
          }
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
        case 'updateStatus':
          location.reload();
          break;
      }
    });

    if (inputEl && !inputEl.disabled) inputEl.focus();
  </script>
</body>
</html>`;
}

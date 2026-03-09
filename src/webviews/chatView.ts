import { sharedCss } from "./shared.js";
import { componentsCss } from "./components.js";

export function getChatHtml(isConnected: boolean, modelName: string): string {
  if (!isConnected) {
    return buildDisconnectedHtml();
  }

  return buildConnectedHtml(modelName);
}

function buildDisconnectedHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    ${sharedCss}
    ${componentsCss}
    body { display:flex;align-items:center;justify-content:center;height:100vh; }
    .onboarding {
      text-align:center;
      padding: 24px 16px;
      max-width: 280px;
    }
    .onboarding-icon { font-size:36px; margin-bottom:12px; }
    .onboarding-title { font-size:15px; font-weight:600; margin-bottom:6px; }
    .onboarding-desc {
      font-size:12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom:20px;
      line-height: 1.5;
    }
    .onboarding-actions { display:flex; flex-direction:column; gap:8px; }
    .onboarding-actions button { padding: 8px 16px; font-size: 12px; }
    .onboarding-link {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      margin-top: 8px;
      background: none;
      border: none;
    }
  </style>
</head>
<body>
  <div class="onboarding">
    <div class="onboarding-icon">🌻</div>
    <div class="onboarding-title">CDD Agent</div>
    <div class="onboarding-desc">
      Connect to Anthropic to use the CDD methodology agent.
      Create skills, analyze rules, and manage your CDD infrastructure.
    </div>
    <div class="onboarding-actions">
      <button id="connectBtn">🔌 I have an API key</button>
      <button class="onboarding-link" id="getKeyBtn">🔑 Get an API key from Anthropic</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('connectBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'connect' });
    });

    document.getElementById('getKeyBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'openExternal', url: 'https://console.anthropic.com/settings/keys' });
      // Then trigger connect
      setTimeout(() => vscode.postMessage({ command: 'connect' }), 1000);
    });
  </script>
</body>
</html>`;
}

function buildConnectedHtml(modelName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${sharedCss}
    ${componentsCss}
    body { display:flex; flex-direction:column; height:100vh; }
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
      flex-shrink: 0;
    }
    .status-left { display:flex; align-items:center; gap:4px; }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .message {
      margin-bottom: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      line-height: 1.5;
      font-size: 12px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .message.user {
      background: var(--vscode-input-background);
      margin-left: 20px;
      white-space: pre-wrap;
    }
    .message.assistant {
      background: var(--vscode-editor-inactiveSelectionBackground);
      margin-right: 8px;
    }
    .message.assistant h1,.message.assistant h2,.message.assistant h3 {
      font-size: 13px;
      font-weight: 600;
      margin: 8px 0 4px;
    }
    .message.assistant ul { margin: 4px 0; padding-left: 18px; }
    .message.assistant li { margin-bottom: 2px; }
    .message.assistant strong { font-weight: 600; }
    .message.error {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      white-space: pre-wrap;
    }
    .action-btn {
      margin-top: 8px;
      padding: 4px 12px;
      font-size: 11px;
      display: inline-block;
    }
    .welcome {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      text-align: center;
      padding: 16px;
      color: var(--vscode-descriptionForeground);
    }
    .welcome-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--vscode-foreground); }
    .welcome-desc { font-size: 12px; line-height: 1.5; max-width: 240px; }
    .input-area {
      padding: 6px 8px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 6px;
      flex-shrink: 0;
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
    .input-area textarea:focus { outline: 1px solid var(--vscode-focusBorder); }
    .input-area button { align-self: flex-end; padding: 6px 12px; }
  </style>
</head>
<body>
  <div class="status-bar">
    <div class="status-left">
      <span class="status-dot connected"></span>
      <span>${modelName}</span>
    </div>
    <button class="secondary" id="disconnectBtn" style="padding:2px 8px;font-size:10px;">Disconnect</button>
  </div>

  <div class="messages" id="messages">
    <div class="welcome" id="welcome">
      <div class="welcome-title">CDD Agent ready</div>
      <div class="welcome-desc">Ask me to create skills, hooks, analyze rules, or plan module architecture.</div>
    </div>
  </div>

  <div class="quick-actions" id="quickActions">
    <button class="quick-action-chip" data-prompt="Create a new skill for ">Create Skill</button>
    <button class="quick-action-chip" data-prompt="Add rule #">Add Rule</button>
    <button class="quick-action-chip" data-prompt="Explain rule #">Explain Rule</button>
    <button class="quick-action-chip" data-prompt="Plan a new module for ">Plan Module</button>
  </div>

  <div class="input-area">
    <textarea id="input" placeholder="Ask the CDD agent..." rows="1"></textarea>
    <button id="sendBtn">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    let currentResponseEl = null;
    let fullResponseText = '';
    let isStreaming = false;

    function renderMarkdown(text) {
      // Escape HTML first
      let html = text
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');

      // Code blocks
      html = html.replace(
        /\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g,
        (m, lang, code) => '<pre class="md-code-block"><code>' + code.trim() + '</code></pre>'
      );

      // Inline code
      html = html.replace(/\`([^\`]+)\`/g, '<code class="md-inline-code">$1</code>');

      // Bold
      html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');

      // Italic
      html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');

      // Headings
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

      // Lists
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\\/li>\\n?)+/g, (m) => '<ul>' + m + '</ul>');

      // Line breaks
      html = html.replace(/\\n\\n/g, '<br/><br/>');
      html = html.replace(/\\n/g, '<br/>');

      return html;
    }

    function addMessage(role, text) {
      const welcome = document.getElementById('welcome');
      if (welcome) welcome.remove();

      const div = document.createElement('div');
      div.className = 'message ' + role;

      if (role === 'user') {
        div.textContent = text;
      } else {
        div.innerHTML = text ? renderMarkdown(text) : '';
      }

      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function checkForActions(text) {
      // Look for cdd-action code blocks
      const actionMatch = text.match(/\`\`\`cdd-action\\n([\\s\\S]*?)\`\`\`/);
      if (!actionMatch) return null;
      try {
        return JSON.parse(actionMatch[1].trim());
      } catch {
        return null;
      }
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

    document.getElementById('disconnectBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'disconnect' });
    });

    // Quick actions
    document.getElementById('quickActions').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-prompt]');
      if (chip) {
        inputEl.value = chip.dataset.prompt;
        inputEl.focus();
        // Place cursor at end
        inputEl.selectionStart = inputEl.value.length;
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.command) {
        case 'startResponse':
          fullResponseText = '';
          currentResponseEl = addMessage('assistant', '');
          break;
        case 'token':
          if (currentResponseEl) {
            fullResponseText += msg.text;
            currentResponseEl.innerHTML = renderMarkdown(fullResponseText);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          break;
        case 'endResponse':
          if (currentResponseEl && fullResponseText) {
            // Final render with markdown
            currentResponseEl.innerHTML = renderMarkdown(fullResponseText);

            // Check for action blocks
            const action = checkForActions(fullResponseText);
            if (action) {
              const btn = document.createElement('button');
              btn.className = 'action-btn';
              btn.textContent = '✅ Apply: ' + action.action;
              btn.addEventListener('click', () => {
                vscode.postMessage({ command: 'applyAction', action });
                btn.disabled = true;
                btn.textContent = '✓ Applied';
              });
              currentResponseEl.appendChild(btn);
            }
          }
          currentResponseEl = null;
          fullResponseText = '';
          sendBtn.disabled = false;
          isStreaming = false;
          break;
        case 'error':
          addMessage('error', msg.text);
          currentResponseEl = null;
          fullResponseText = '';
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

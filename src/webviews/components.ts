// Shared HTML component generators for webviews
// Pure functions returning HTML strings — no framework needed

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderCard(
  title: string,
  content: string,
  options?: {
    actions?: string;
    badge?: string;
    open?: boolean;
    headerClass?: string;
    id?: string;
  }
): string {
  const openClass = options?.open ? " open" : "";
  const idAttr = options?.id ? ` id="${escapeHtml(options.id)}"` : "";
  const badgeHtml = options?.badge
    ? `<span class="badge">${escapeHtml(options.badge)}</span>`
    : "";
  const actionsHtml = options?.actions || "";
  const headerClass = options?.headerClass
    ? ` ${options.headerClass}`
    : "";

  return `
    <div class="card"${idAttr}>
      <div class="card-header${headerClass}" onclick="this.nextElementSibling.classList.toggle('open')">
        <span>${badgeHtml}${title}</span>
        <span class="card-actions">${actionsHtml}</span>
      </div>
      <div class="card-content${openClass}">${content}</div>
    </div>
  `;
}

export function renderToggle(
  id: string,
  label: string,
  checked: boolean,
  disabled?: boolean
): string {
  const checkedAttr = checked ? " checked" : "";
  const disabledAttr = disabled ? " disabled" : "";
  return `
    <label class="toggle-row">
      <input type="checkbox" class="toggle-input" id="${escapeHtml(id)}"${checkedAttr}${disabledAttr} />
      <span class="toggle-slider"></span>
      <span class="toggle-label">${escapeHtml(label)}</span>
    </label>
  `;
}

export function renderBadge(
  text: string,
  variant: "info" | "success" | "warning" | "error" | "core" | "docs" | "testing" | "quality" = "info"
): string {
  return `<span class="badge badge-${variant}">${escapeHtml(text)}</span>`;
}

export function renderFormField(
  label: string,
  inputHtml: string,
  helpText?: string
): string {
  const helpHtml = helpText
    ? `<div class="field-help">${escapeHtml(helpText)}</div>`
    : "";
  return `
    <div class="form-field">
      <label class="field-label">${escapeHtml(label)}</label>
      ${inputHtml}
      ${helpHtml}
    </div>
  `;
}

export function renderEmptyState(
  icon: string,
  title: string,
  description: string,
  action?: { label: string; command: string }
): string {
  const actionHtml = action
    ? `<button onclick="vscode.postMessage({command:'${escapeHtml(action.command)}'})">${escapeHtml(action.label)}</button>`
    : "";
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-desc">${escapeHtml(description)}</div>
      ${actionHtml}
    </div>
  `;
}

export function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Code blocks (must come before inline code)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, lang, code) =>
      `<pre class="md-code-block"><code class="lang-${lang}">${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code class=\"md-inline-code\">$1</code>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Headings (### → h3, ## → h2, # → h1)
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // Line breaks (double newline → paragraph break)
  html = html.replace(/\n\n/g, "<br/><br/>");

  return html;
}

// Extended CSS for new components (toggles, forms, badges, markdown)
export const componentsCss = `
  /* Toggle switch */
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 2px 0;
  }
  .toggle-input { display: none; }
  .toggle-slider {
    width: 32px;
    height: 16px;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    border-radius: 8px;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle-slider::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--vscode-foreground);
    top: 1px;
    left: 1px;
    transition: transform 0.2s;
    opacity: 0.5;
  }
  .toggle-input:checked + .toggle-slider {
    background: var(--vscode-button-background);
    border-color: var(--vscode-button-background);
  }
  .toggle-input:checked + .toggle-slider::after {
    transform: translateX(16px);
    opacity: 1;
    background: var(--vscode-button-foreground);
  }
  .toggle-input:disabled + .toggle-slider { opacity: 0.4; }
  .toggle-label { font-size: 12px; }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
    margin-right: 6px;
    vertical-align: middle;
  }
  .badge-info { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .badge-success { background: #2d6a2d; color: #d4edda; }
  .badge-warning { background: #856404; color: #fff3cd; }
  .badge-error { background: #721c24; color: #f8d7da; }
  .badge-core { background: #4a2882; color: #e8dafc; }
  .badge-docs { background: #1a5276; color: #d6eaf8; }
  .badge-testing { background: #1e6e50; color: #d1f2eb; }
  .badge-quality { background: #7d5a00; color: #fdf2d8; }

  /* Form fields */
  .form-field {
    margin-bottom: 12px;
  }
  .field-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--vscode-foreground);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .field-help {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
  }
  .form-input {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 5px 8px;
    border-radius: 3px;
    font-family: inherit;
    font-size: inherit;
  }
  .form-input:focus {
    outline: 1px solid var(--vscode-focusBorder);
    border-color: var(--vscode-focusBorder);
  }
  .form-textarea {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 6px 8px;
    border-radius: 3px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    resize: vertical;
    min-height: 60px;
    line-height: 1.5;
  }
  .form-textarea:focus {
    outline: 1px solid var(--vscode-focusBorder);
    border-color: var(--vscode-focusBorder);
  }
  select.form-input {
    cursor: pointer;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    min-height: 200px;
  }
  .empty-icon { font-size: 32px; margin-bottom: 12px; }
  .empty-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .empty-desc {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 16px;
    max-width: 240px;
  }

  /* Card enhancements */
  .card-actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .card .edit-area {
    margin-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    padding-top: 8px;
  }
  .card .edit-area .form-textarea { min-height: 100px; }
  .card .edit-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
    justify-content: flex-end;
  }

  /* Markdown rendering */
  .md-code-block {
    background: var(--vscode-textCodeBlock-background, var(--vscode-input-background));
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 8px 10px;
    margin: 8px 0;
    overflow-x: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    line-height: 1.5;
  }
  .md-inline-code {
    background: var(--vscode-textCodeBlock-background, var(--vscode-input-background));
    padding: 1px 4px;
    border-radius: 3px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.9em;
  }

  /* File tabs */
  .file-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--vscode-panel-border);
    overflow-x: auto;
    padding: 0 4px;
  }
  .file-tab {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    background: none;
    color: var(--vscode-foreground);
    opacity: 0.6;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .file-tab:hover { opacity: 0.9; }
  .file-tab.active {
    opacity: 1;
    border-bottom-color: var(--vscode-focusBorder);
    font-weight: 600;
  }

  /* Quick action chips */
  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 10px;
    border-top: 1px solid var(--vscode-panel-border);
  }
  .quick-action-chip {
    padding: 3px 8px;
    font-size: 11px;
    border-radius: 10px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    cursor: pointer;
    white-space: nowrap;
  }
  .quick-action-chip:hover {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  /* Toolbar row */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .toolbar-title {
    font-weight: 600;
    font-size: 12px;
  }
`;

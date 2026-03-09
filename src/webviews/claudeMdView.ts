import { sharedCss } from "./shared.js";
import { componentsCss, escapeHtml } from "./components.js";
import type { ClaudeMdFileData, RuleMetadata } from "./protocol.js";

// Re-export types for backward compat
export type ClaudeMdSection = ClaudeMdFileData["sections"][number];
export type ClaudeMdFile = ClaudeMdFileData;

export function getClaudeMdHtml(
  files: ClaudeMdFile[],
  rules?: RuleMetadata[]
): string {
  if (files.length === 0) {
    return buildEmptyHtml();
  }

  const filesJson = JSON.stringify(files);
  const rulesJson = JSON.stringify(rules || []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${sharedCss}
    ${componentsCss}
    body { overflow-y: auto; height: 100vh; }

    .section {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .section:last-child { border-bottom: none; }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .section-header:hover { background: var(--vscode-list-hoverBackground); }
    .section-heading {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    .section-heading span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .section-actions {
      display: flex;
      gap: 2px;
      flex-shrink: 0;
    }
    .section-content {
      padding: 6px 10px 10px;
      display: none;
    }
    .section-content.open { display: block; }
    .section-preview {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
      white-space: pre-wrap;
      word-wrap: break-word;
      max-height: 200px;
      overflow-y: auto;
    }
    .edit-area { margin-top: 8px; }
    .edit-area textarea {
      width: 100%;
      min-height: 120px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      line-height: 1.4;
      padding: 6px 8px;
      border-radius: 3px;
      resize: vertical;
    }
    .edit-area textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .edit-actions {
      display: flex;
      gap: 6px;
      margin-top: 6px;
      justify-content: flex-end;
    }
    .preamble-badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 6px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .rule-badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 6px;
      font-weight: 600;
    }
    .add-rule-bar {
      padding: 8px 10px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .add-rule-bar select {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      padding: 4px 6px;
      border-radius: 3px;
      font-size: 11px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const allFiles = ${filesJson};
    const allRules = ${rulesJson};
    let currentFileIndex = 0;
    let editingSection = -1;

    function render() {
      const app = document.getElementById('app');
      if (!allFiles.length) {
        app.innerHTML = renderEmpty();
        return;
      }

      const tabs = renderTabs();
      const file = allFiles[currentFileIndex];
      const sections = renderSections(file);
      const addRule = allRules.length ? renderAddRule(file) : '';

      app.innerHTML = tabs + sections + addRule;
    }

    function renderTabs() {
      return '<div class="file-tabs">' +
        allFiles.map((f, i) =>
          '<button class="file-tab' + (i === currentFileIndex ? ' active' : '') +
          '" data-tab="' + i + '">' + esc(f.label) + '</button>'
        ).join('') +
        '</div>';
    }

    function renderSections(file) {
      if (!file.sections.length) {
        return '<div style="padding:16px;text-align:center;color:var(--vscode-descriptionForeground);font-size:12px;">Empty file. <button class="icon-btn" data-open-file="' + esc(file.path) + '">Open in editor</button></div>';
      }

      return file.sections.map((s, i) => {
        const isEditing = editingSection === i;
        const isPreamble = s.level === 0;
        const isRule = isRuleSection(s.heading);
        const ruleMatch = isRule ? findRuleForSection(s.heading) : null;

        let badge = '';
        if (isPreamble) {
          badge = '<span class="preamble-badge">preamble</span>';
        } else if (ruleMatch) {
          badge = '<span class="rule-badge badge-' + ruleMatch.category + '">#' + ruleMatch.number + '</span>';
        }

        const levelPrefix = isPreamble ? '' : ('#'.repeat(s.level) + ' ');

        const editBtn = '<button class="icon-btn" data-edit-section="' + i + '" title="Edit inline">✏️</button>';
        const openBtn = '<button class="icon-btn" data-open-line="' + esc(file.path) + ':' + s.lineStart + '" title="Open in editor">📄</button>';

        let contentHtml;
        if (isEditing) {
          contentHtml = '<div class="section-content open">' +
            '<div class="edit-area">' +
            '<textarea id="edit-textarea">' + esc(s.content) + '</textarea>' +
            '<div class="edit-actions">' +
            '<button class="secondary" data-cancel-edit>Cancel</button>' +
            '<button data-save-edit="' + i + '">Save</button>' +
            '</div></div></div>';
        } else {
          contentHtml = '<div class="section-content">' +
            '<div class="section-preview">' + esc(s.content || '(empty)') + '</div>' +
            '</div>';
        }

        return '<div class="section">' +
          '<div class="section-header" data-toggle-section="' + i + '">' +
          '<div class="section-heading">' + badge + '<span>' + levelPrefix + esc(s.heading) + '</span></div>' +
          '<div class="section-actions">' + editBtn + openBtn + '</div>' +
          '</div>' +
          contentHtml +
          '</div>';
      }).join('');
    }

    function renderAddRule(file) {
      const existingHeadings = file.sections.map(s => s.heading.toLowerCase());
      const available = allRules.filter(r =>
        !existingHeadings.some(h => h.includes(r.name.toLowerCase()) || h.includes(r.id))
      );

      if (!available.length) return '';

      const options = available.map(r =>
        '<option value="' + esc(r.id) + '" data-name="' + esc(r.name) + '" data-desc="' + esc(r.description) + '">' +
        '#' + r.number + ' ' + esc(r.name) + '</option>'
      ).join('');

      return '<div class="add-rule-bar">' +
        '<select id="add-rule-select">' +
        '<option value="">+ Add rule section...</option>' +
        options +
        '</select></div>';
    }

    function renderEmpty() {
      return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;">' +
        '<div style="font-size:24px;margin-bottom:8px;">📄</div>' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">No CLAUDE.md files found</div>' +
        '<div style="font-size:12px;color:var(--vscode-descriptionForeground);">Run CDD: Init Project to create your CDD infrastructure.</div>' +
        '</div>';
    }

    function isRuleSection(heading) {
      return heading.match(/rule|#\d|delegation|changelog|mermaid|planning|contract|scope|e2e|tdd/i);
    }

    function findRuleForSection(heading) {
      const lower = heading.toLowerCase();
      return allRules.find(r =>
        lower.includes(r.name.toLowerCase()) ||
        lower.includes(r.id.replace(/-/g, ' ')) ||
        lower.includes('#' + r.number)
      ) || null;
    }

    function esc(text) {
      if (!text) return '';
      return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    // Event delegation
    document.addEventListener('click', (e) => {
      const target = e.target;

      // Tab switch
      const tab = target.closest('[data-tab]');
      if (tab) {
        currentFileIndex = parseInt(tab.dataset.tab);
        editingSection = -1;
        render();
        return;
      }

      // Toggle section
      const toggle = target.closest('[data-toggle-section]');
      if (toggle && !target.closest('.section-actions')) {
        const idx = toggle.dataset.toggleSection;
        const content = toggle.nextElementSibling;
        if (content) content.classList.toggle('open');
        return;
      }

      // Edit section
      const editBtn = target.closest('[data-edit-section]');
      if (editBtn) {
        e.stopPropagation();
        editingSection = parseInt(editBtn.dataset.editSection);
        render();
        const textarea = document.getElementById('edit-textarea');
        if (textarea) textarea.focus();
        return;
      }

      // Cancel edit
      if (target.closest('[data-cancel-edit]')) {
        editingSection = -1;
        render();
        return;
      }

      // Save edit
      const saveBtn = target.closest('[data-save-edit]');
      if (saveBtn) {
        const idx = parseInt(saveBtn.dataset.saveEdit);
        const textarea = document.getElementById('edit-textarea');
        if (textarea) {
          vscode.postMessage({
            command: 'editSection',
            filePath: allFiles[currentFileIndex].path,
            sectionIndex: idx,
            content: textarea.value
          });
        }
        editingSection = -1;
        return;
      }

      // Open file
      const openFile = target.closest('[data-open-file]');
      if (openFile) {
        e.stopPropagation();
        vscode.postMessage({ command: 'openFile', path: openFile.dataset.openFile });
        return;
      }

      // Open file at line
      const openLine = target.closest('[data-open-line]');
      if (openLine) {
        e.stopPropagation();
        const [path, line] = openLine.dataset.openLine.split(':');
        vscode.postMessage({ command: 'openFileAtLine', path, line: parseInt(line) });
        return;
      }
    });

    // Add rule select
    document.addEventListener('change', (e) => {
      if (e.target.id === 'add-rule-select' && e.target.value) {
        const select = e.target;
        const option = select.selectedOptions[0];
        vscode.postMessage({
          command: 'addRule',
          filePath: allFiles[currentFileIndex].path,
          ruleId: select.value,
          ruleName: option.dataset.name,
          ruleDescription: option.dataset.desc
        });
        select.value = '';
      }
    });

    render();
  </script>
</body>
</html>`;
}

function buildEmptyHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    ${sharedCss}
    body { display:flex;align-items:center;justify-content:center;height:100vh; }
    .empty { text-align:center;color:var(--vscode-descriptionForeground); }
    .empty-icon { font-size:32px;margin-bottom:8px; }
    .empty-title { font-size:13px;font-weight:600;margin-bottom:4px; }
    .empty-desc { font-size:12px; }
  </style>
</head>
<body>
  <div class="empty">
    <div class="empty-icon">📄</div>
    <div class="empty-title">No CLAUDE.md files found</div>
    <div class="empty-desc">Run CDD: Init Project to create your CDD infrastructure.</div>
  </div>
</body>
</html>`;
}

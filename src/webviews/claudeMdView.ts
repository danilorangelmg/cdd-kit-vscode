import { sharedCss } from "./shared.js";

export interface ClaudeMdSection {
  heading: string;
  level: number;
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface ClaudeMdFile {
  path: string;
  label: string;
  sections: ClaudeMdSection[];
}

export function getClaudeMdHtml(files: ClaudeMdFile[]): string {
  const filesHtml = files
    .map(
      (file, fi) => `
    <div class="card">
      <div class="card-header" data-toggle="file-${fi}">
        <span>📄 ${escapeHtml(file.label)}</span>
        <button class="icon-btn" data-edit="${escapeHtml(file.path)}" title="Open in editor">✏️</button>
      </div>
      <div class="card-content" id="file-${fi}">
        ${file.sections
          .map(
            (s, si) => `
          <div class="section">
            <div class="section-header" data-toggle="section-${fi}-${si}">
              <span>${"#".repeat(s.level)} ${escapeHtml(s.heading)}</span>
              <button class="icon-btn" data-edit-line="${escapeHtml(file.path)}:${s.lineStart}" title="Edit section">✏️</button>
            </div>
            <div class="section-content" id="section-${fi}-${si}">
              <pre>${escapeHtml(s.content.trim())}</pre>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `
    )
    .join("");

  const emptyState =
    files.length === 0
      ? `<div class="empty-state"><p>No CLAUDE.md files found.</p><p>Run <strong>CDD: Init Project</strong> to create your CDD infrastructure.</p></div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${sharedCss}
    body { overflow-y: auto; height: 100vh; }
    .section { border-bottom: 1px solid var(--vscode-panel-border); }
    .section:last-child { border-bottom: none; }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      color: var(--vscode-foreground);
    }
    .section-header:hover { background: var(--vscode-list-hoverBackground); }
    .section-content {
      padding: 4px 8px 8px;
      display: none;
    }
    .section-content.open { display: block; }
    .section-content pre {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      padding: 20px;
      height: 100%;
      gap: 8px;
    }
    .empty-state p { font-size: 12px; }
    .title-bar {
      padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="title-bar">CLAUDE.md Files</div>
  ${emptyState || filesHtml}

  <script>
    const vscode = acquireVsCodeApi();

    document.addEventListener('click', (e) => {
      const target = e.target;

      // Toggle card/section
      const toggleId = target.closest('[data-toggle]')?.dataset.toggle;
      if (toggleId) {
        const el = document.getElementById(toggleId);
        if (el) el.classList.toggle('open');
        return;
      }

      // Edit file
      const editPath = target.closest('[data-edit]')?.dataset.edit;
      if (editPath) {
        e.stopPropagation();
        vscode.postMessage({ command: 'openFile', path: editPath });
        return;
      }

      // Edit at line
      const editLine = target.closest('[data-edit-line]')?.dataset.editLine;
      if (editLine) {
        e.stopPropagation();
        const [path, line] = editLine.split(':');
        vscode.postMessage({ command: 'openFileAtLine', path, line: parseInt(line) });
        return;
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

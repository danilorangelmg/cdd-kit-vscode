import { sharedCss } from "./shared.js";
import { componentsCss, escapeHtml } from "./components.js";
import type { SkillFormData } from "./protocol.js";

interface SkillEditorState {
  skill?: SkillFormData;
  modules: Array<{ name: string; role: string }>;
  isNew: boolean;
}

export function getSkillEditorHtml(state: SkillEditorState): string {
  const s = state.skill || {
    name: "",
    module: state.modules[0]?.name || "",
    description: "",
    whenToUse: "",
    implementationPattern: "",
    qualityChecklist: "- [ ] ",
    patternsContent: undefined,
    testingContent: undefined,
  };

  const title = state.isNew ? "Create New Skill" : `Edit Skill — "${escapeHtml(s.name)}"`;
  const stateJson = JSON.stringify(state);

  const moduleOptions = state.modules
    .map(
      (m) =>
        `<option value="${escapeHtml(m.name)}"${m.name === s.module ? " selected" : ""}>${escapeHtml(m.name)} (${escapeHtml(m.role)})</option>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${sharedCss}
    ${componentsCss}
    body { padding: 16px 20px; overflow-y: auto; }
    h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .form-row {
      display: flex;
      gap: 12px;
    }
    .form-row .form-field { flex: 1; }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin: 16px 0 8px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .supporting-section {
      margin-top: 8px;
    }
    .supporting-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .supporting-content { display: none; margin-top: 4px; }
    .supporting-content.open { display: block; }
    .actions-bar {
      display: flex;
      gap: 8px;
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .actions-bar .spacer { flex: 1; }
    button.danger {
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      color: var(--vscode-inputValidation-errorForeground, #f8d7da);
    }
  </style>
</head>
<body>
  <h2>${title}</h2>

  <div class="form-row">
    <div class="form-field">
      <label class="field-label">Name</label>
      <input type="text" class="form-input" id="skill-name" value="${escapeHtml(s.name)}"
        placeholder="component" ${state.isNew ? "" : "readonly"} />
    </div>
    <div class="form-field">
      <label class="field-label">Module</label>
      <select class="form-input" id="skill-module">${moduleOptions}</select>
    </div>
  </div>

  <div class="form-field">
    <label class="field-label">Description</label>
    <input type="text" class="form-input" id="skill-description" value="${escapeHtml(s.description)}"
      placeholder="React component creation patterns" />
  </div>

  <div class="section-title">When to Use</div>
  <textarea class="form-textarea" id="skill-when" rows="3"
    placeholder="- When creating new components&#10;- When refactoring existing components">${escapeHtml(s.whenToUse)}</textarea>

  <div class="section-title">Implementation Pattern</div>
  <textarea class="form-textarea" id="skill-pattern" rows="6" style="min-height:100px"
    placeholder="Describe the implementation pattern or include code examples...">${escapeHtml(s.implementationPattern)}</textarea>

  <div class="section-title">Quality Checklist</div>
  <textarea class="form-textarea" id="skill-checklist" rows="4"
    placeholder="- [ ] TypeScript strict mode&#10;- [ ] Tests included&#10;- [ ] No console.log">${escapeHtml(s.qualityChecklist)}</textarea>

  <div class="section-title">Supporting Files</div>

  <div class="supporting-section">
    <div class="supporting-header" onclick="toggleSupporting('patterns')">
      <span>patterns.md ${s.patternsContent !== undefined ? "✓" : "(optional)"}</span>
      <span id="patterns-toggle">${s.patternsContent !== undefined ? "▾" : "▸"}</span>
    </div>
    <div class="supporting-content${s.patternsContent !== undefined ? " open" : ""}" id="patterns-area">
      <textarea class="form-textarea" id="skill-patterns" rows="4"
        placeholder="# Patterns&#10;&#10;## Common Patterns&#10;&#10;...">${escapeHtml(s.patternsContent || "")}</textarea>
    </div>
  </div>

  <div class="supporting-section">
    <div class="supporting-header" onclick="toggleSupporting('testing')">
      <span>testing.md ${s.testingContent !== undefined ? "✓" : "(optional)"}</span>
      <span id="testing-toggle">${s.testingContent !== undefined ? "▾" : "▸"}</span>
    </div>
    <div class="supporting-content${s.testingContent !== undefined ? " open" : ""}" id="testing-area">
      <textarea class="form-textarea" id="skill-testing" rows="4"
        placeholder="# Testing&#10;&#10;## Test Strategy&#10;&#10;...">${escapeHtml(s.testingContent || "")}</textarea>
    </div>
  </div>

  <div class="actions-bar">
    ${state.isNew ? "" : '<button class="danger" id="delete-btn">Delete Skill</button>'}
    <span class="spacer"></span>
    <button class="secondary" id="cancel-btn">Cancel</button>
    <button id="save-btn">Save</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const editorState = ${stateJson};

    function toggleSupporting(id) {
      const area = document.getElementById(id + '-area');
      const toggle = document.getElementById(id + '-toggle');
      if (area) {
        area.classList.toggle('open');
        toggle.textContent = area.classList.contains('open') ? '▾' : '▸';
      }
    }

    document.getElementById('save-btn').addEventListener('click', () => {
      const name = document.getElementById('skill-name').value.trim();
      if (!name) {
        alert('Skill name is required');
        return;
      }

      const patternsArea = document.getElementById('patterns-area');
      const testingArea = document.getElementById('testing-area');
      const patternsVal = document.getElementById('skill-patterns').value;
      const testingVal = document.getElementById('skill-testing').value;

      vscode.postMessage({
        command: 'saveSkill',
        data: {
          name,
          module: document.getElementById('skill-module').value,
          description: document.getElementById('skill-description').value,
          whenToUse: document.getElementById('skill-when').value,
          implementationPattern: document.getElementById('skill-pattern').value,
          qualityChecklist: document.getElementById('skill-checklist').value,
          patternsContent: patternsArea.classList.contains('open') && patternsVal ? patternsVal : undefined,
          testingContent: testingArea.classList.contains('open') && testingVal ? testingVal : undefined,
        },
        originalName: editorState.isNew ? undefined : editorState.skill?.name
      });
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      vscode.postMessage({ command: 'cancel' });
    });

    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'deleteSkill', name: editorState.skill?.name });
      });
    }
  </script>
</body>
</html>`;
}

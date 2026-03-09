// Typed message protocol for all webview <-> extension communication

// ---- Shared data types ----

export interface SkillFormData {
  name: string;
  module: string;
  description: string;
  whenToUse: string;
  implementationPattern: string;
  qualityChecklist: string;
  patternsContent?: string;
  testingContent?: string;
}

export interface HookFormData {
  name: string;
  type: "PreToolUse" | "PostToolUse" | "UserPromptSubmit" | "Stop";
  module?: string;
  script: string;
}

export interface ChatAction {
  action: string;
  params: Record<string, string>;
}

export interface ClaudeMdSectionData {
  heading: string;
  level: number;
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface ClaudeMdFileData {
  path: string;
  label: string;
  sections: ClaudeMdSectionData[];
}

export interface RuleMetadata {
  id: string;
  number: number;
  name: string;
  description: string;
  category: string;
  alwaysActive: boolean;
  requires: string[];
  enabled: boolean;
}

// ---- Extension → Webview messages ----

export type ExtensionToWebview =
  | { type: "updateState"; state: unknown }
  | { type: "token"; text: string }
  | { type: "startResponse" }
  | { type: "endResponse" }
  | { type: "error"; text: string };

// ---- Webview → Extension messages ----

// Chat messages
export type ChatWebviewMessage =
  | { command: "send"; text: string }
  | { command: "connect" }
  | { command: "disconnect" }
  | { command: "applyAction"; action: ChatAction }
  | { command: "quickAction"; prompt: string };

// CLAUDE.md manager messages
export type ClaudeMdWebviewMessage =
  | { command: "openFile"; path: string }
  | { command: "openFileAtLine"; path: string; line: number }
  | { command: "selectFile"; index: number }
  | { command: "editSection"; filePath: string; sectionIndex: number; content: string }
  | { command: "addRule"; filePath: string; ruleId: string }
  | { command: "removeRule"; filePath: string; ruleId: string }
  | { command: "toggleRule"; ruleId: string };

// Skill editor messages
export type SkillEditorWebviewMessage =
  | { command: "saveSkill"; data: SkillFormData; originalName?: string }
  | { command: "deleteSkill"; name: string }
  | { command: "cancel" };

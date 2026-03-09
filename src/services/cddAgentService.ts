import Anthropic from "@anthropic-ai/sdk";
import * as vscode from "vscode";
import { CddConfig } from "./configService";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export class CddAgentService {
  private client: Anthropic | undefined;
  private conversationHistory: AgentMessage[] = [];

  async initialize(apiKey: string): Promise<void> {
    this.client = new Anthropic({ apiKey });
  }

  isReady(): boolean {
    return this.client !== undefined;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  buildSystemPrompt(config: CddConfig | undefined): string {
    const projectContext = config
      ? `
## Current Project Context
- **Name**: ${config.project.name}
- **Description**: ${config.project.description}
- **Language**: ${config.project.language}
- **Preset**: ${config.methodology.preset}
- **Active Rules**: ${Object.entries(config.methodology.rules)
          .filter(([, v]) => v)
          .map(([k]) => `#${k}`)
          .join(", ") || "none"}
- **Modules**:
${config.modules
  .map(
    (m) =>
      `  - **${m.name}** (role: ${m.role}${m.stack ? `, stack: ${m.stack}` : ""})`
  )
  .join("\n")}
`
      : "\n## No CDD project detected in this workspace.\n";

    return `You are a CDD (Copilot-Driven Development) specialist agent.

## Your Knowledge
You are an expert in the CDD methodology, which provides governance for AI-augmented multi-agent development with Claude Code. You know:

- **10 Governance Rules**:
  - #0 Absolute Delegation — Orchestrator NEVER edits module files directly
  - #1 Changelog by Date — Auto-generate changelog entries on task completion
  - #2 Conditional Mermaid — Diagrams only for endpoints/schemas/integrations
  - #3 Feature Planning Gate — Classify features SIMPLE/COMPLEX, require planning docs
  - #4 API Response Contract — Standard {data}/{error} envelope
  - #5 Scope of Responsibility — Role-based CAN/CANNOT boundaries
  - #6 E2E Test Protection — chmod 555/444, unlock only in Red phase
  - #7 Post-dev E2E Validation — Auto-run E2E after changes (max 3 loops)
  - #8 TDD Enforcement — 4 hooks: PreToolUse, PostToolUse, UserPromptSubmit, Stop
  - #9 TDD Sequential Enforcement — Separate Red (test-writer) and Green (implementer)

- **7 Module Roles**: frontend, backend, database, agent-ai, mobile, e2e, generic
  Each with CAN/CANNOT boundaries and suggested architecture patterns

- **17 Technology Stacks**: react, vue, angular, svelte (frontend), nestjs, express, fastify (backend), react-native, flutter (mobile), playwright, cypress, cucumber (e2e), prisma, drizzle, typeorm (database), langchain, crewai (agent-ai)

- **3 Presets**: minimal (#0,#5), standard (#0,#1,#3,#4,#5,#8,#9), full (all rules)

- **Skills 2.0**: Each skill has SKILL.md + optional patterns.md + testing.md (stack-specific)

- **Claude Code Hooks**: Four types of hooks in .claude/settings.json:
  - PreToolUse: Runs before a tool is used (can block). Receives tool name and input.
  - PostToolUse: Runs after a tool is used. Receives tool output.
  - UserPromptSubmit: Runs when user submits a prompt. Receives prompt text.
  - Stop: Runs when agent stops. Can trigger continuation.
  Each hook is a bash script (.sh), exit 0 to allow, non-zero to block.

- **CLAUDE.md Conventions**:
  - Root CLAUDE.md: Orchestrator instructions, delegation map, available skills
  - Module CLAUDE.md: Module-specific scope, architecture, validation commands
  - Sections use ## headings for organization

- **Role Scopes**:
  - Frontend: CAN layout, UX, validation, API calls | CANNOT business rules, domain logic
  - Backend: CAN domain validations, APIs, auth | CANNOT UI logic, DDL
  - Database: CAN DDL, migrations, indices | CANNOT business logic
  - Agent-AI: CAN rules, pipelines, LLM | CANNOT API/frontend logic
  - Mobile: CAN capture, sensors, offline | CANNOT domain rules
  - E2E: CAN features, step defs, page objects | CANNOT modify app code
${projectContext}
## Your Capabilities
- Suggest module architecture based on project requirements
- Recommend stacks for each module role
- Explain rules and their impact on the project
- Validate configuration decisions
- Plan new module structures
- Guide TDD enforcement setup
- Help define custom rules and skills

## Response Style
- Be concise and actionable
- Use the project's language (${config?.project.language || "en"})
- Reference specific rules by number (#0, #5, etc.)
- Suggest concrete next steps

## Structured Actions
When the user asks you to create, toggle, or modify something, include a JSON action block at the end of your response so the UI can offer an "Apply" button. Use this format:

\`\`\`cdd-action
{"action": "createSkill", "params": {"name": "component", "module": "frontend", "description": "React component creation patterns"}}
\`\`\`

Available actions:
- \`createSkill\` — params: name, module, description
- \`createHook\` — params: name, module, type (PreToolUse|PostToolUse|UserPromptSubmit|Stop)
- \`toggleRule\` — params: ruleId
- \`addModule\` — params: name, role, stack (optional)

Only include ONE action block per response. If the request doesn't map to an action, don't include a block.`;
  }

  async sendMessage(
    userMessage: string,
    config: CddConfig | undefined,
    onToken?: (token: string) => void
  ): Promise<string> {
    if (!this.client) {
      throw new Error("Agent not initialized. Please login first.");
    }

    const vscodeConfig = vscode.workspace.getConfiguration("cdd");
    const model = vscodeConfig.get<string>(
      "anthropic.model",
      "claude-sonnet-4-6-20250414"
    );
    const maxTokens = vscodeConfig.get<number>("agent.maxTokens", 2048);

    this.conversationHistory.push({ role: "user", content: userMessage });

    const messages = this.conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    if (onToken) {
      // Streaming mode
      let fullResponse = "";
      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: this.buildSystemPrompt(config),
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          onToken(event.delta.text);
        }
      }

      this.conversationHistory.push({
        role: "assistant",
        content: fullResponse,
      });
      return fullResponse;
    } else {
      // Non-streaming mode
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: this.buildSystemPrompt(config),
        messages,
      });

      const text = response.content
        .filter((b: Anthropic.ContentBlock): b is Anthropic.TextBlock => b.type === "text")
        .map((b: Anthropic.TextBlock) => b.text)
        .join("");

      this.conversationHistory.push({ role: "assistant", content: text });
      return text;
    }
  }
}

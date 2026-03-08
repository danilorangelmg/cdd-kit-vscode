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
- Suggest concrete next steps`;
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

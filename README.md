# CDD for Claude Code — Copilot Driven Dev

Visual explorer and AI agent for the [CDD (Copilot-Driven Development)](https://github.com/danilorangelmg/cdd-kit) methodology. Manage modules, skills, rules, and stacks for Claude Code projects — directly from VS Code.

> **This extension complements Claude Code** — it does not replace it. It provides a visual layer for managing CDD infrastructure that Claude Code uses.

## Features

### CDD Explorer (Sidebar)

Browse your project's CDD infrastructure in a tree view:

- **Modules** with their roles and stacks
- **Skills** per module (with supporting files)
- **Rules** and governance settings
- **Agents** (delegates, specialists)
- **Methodology** preset and active rules
- **Doctor** health check status

### Commands

| Command | Description |
|---------|-------------|
| `CDD: Init Project` | Initialize a new CDD project with preset selection |
| `CDD: Add Module` | Add a module with role and stack picker |
| `CDD: Add/Change Stack` | Change technology stack for a module |
| `CDD: Run Doctor` | Health check for CDD infrastructure |
| `CDD: Regenerate` | Regenerate all `.claude/` infrastructure |
| `CDD: Ask CDD Agent` | Chat with the AI-powered CDD specialist |
| `CDD: Login Anthropic` | Connect your Anthropic API key |

### CDD Agent (AI-Powered)

A specialized Claude agent that understands the entire CDD methodology:

- **10 governance rules** (#0-#9) with their interactions
- **7 module roles** (frontend, backend, database, agent-ai, mobile, e2e, generic)
- **17 technology stacks** (React, NestJS, Prisma, LangChain, etc.)
- **3 presets** (minimal, standard, full)

Ask the agent to:
- Suggest module architecture for your project
- Recommend stacks based on requirements
- Explain rules and their impact
- Validate configuration decisions
- Plan new module structures

### Status Bar

Shows project preset, module count, and agent connection status.

## Getting Started

1. Install the extension
2. Open a project folder
3. Run `CDD: Init Project` from the command palette (Cmd+Shift+P)
4. Add modules with `CDD: Add Module`
5. (Optional) Connect Anthropic API with `CDD: Login Anthropic` to enable the CDD Agent

## Requirements

- VS Code 1.74.0 or later
- [cdd-kit](https://www.npmjs.com/package/cdd-kit) (installed automatically as dependency)
- Anthropic API key (optional, for CDD Agent features)

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `cdd.anthropic.model` | `claude-sonnet-4-6-20250414` | Claude model for the CDD Agent |
| `cdd.agent.maxTokens` | `2048` | Maximum tokens for agent responses |

## Links

- [cdd-kit CLI](https://github.com/danilorangelmg/cdd-kit) — The CLI that generates CDD infrastructure
- [CDD Methodology](https://github.com/danilorangelmg/cdd-kit#readme) — Learn about Copilot-Driven Development

## License

MIT

import * as vscode from "vscode";
import { ConfigService } from "../services/configService";
import { CddTreeProvider } from "../providers/CddTreeProvider";

const STACKS: Record<string, Array<{ label: string; description: string }>> = {
  frontend: [
    { label: "react", description: "React with TypeScript" },
    { label: "vue", description: "Vue 3 with Composition API" },
    { label: "angular", description: "Angular with TypeScript" },
    { label: "svelte", description: "Svelte 5 with runes" },
  ],
  backend: [
    { label: "nestjs", description: "NestJS with decorators and DI" },
    { label: "express", description: "Express.js minimal" },
    { label: "fastify", description: "Fastify with JSON Schema" },
  ],
  mobile: [
    { label: "react-native", description: "React Native with TypeScript" },
    { label: "flutter", description: "Flutter with Dart" },
  ],
  e2e: [
    { label: "playwright", description: "Playwright with TypeScript" },
    { label: "cypress", description: "Cypress with TypeScript" },
    { label: "cucumber", description: "Cucumber BDD with Gherkin" },
  ],
  database: [
    { label: "prisma", description: "Prisma ORM" },
    { label: "drizzle", description: "Drizzle ORM" },
    { label: "typeorm", description: "TypeORM" },
  ],
  "agent-ai": [
    { label: "langchain", description: "LangChain / LangGraph" },
    { label: "crewai", description: "CrewAI multi-agent" },
  ],
};

export async function addStackCommand(
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const config = configService.getConfig();
  if (!config || config.modules.length === 0) {
    vscode.window.showErrorMessage("No modules found. Add a module first.");
    return;
  }

  // 1. Pick module
  const moduleChoice = await vscode.window.showQuickPick(
    config.modules.map((m) => ({
      label: m.name,
      description: `${m.role}${m.stack ? ` [${m.stack}]` : ""}`,
      module: m,
    })),
    { title: "Select Module", placeHolder: "Choose module to add/change stack" }
  );
  if (!moduleChoice) return;

  const mod = moduleChoice.module;

  // 2. Pick stack
  const stacksForRole = STACKS[mod.role];
  if (!stacksForRole || stacksForRole.length === 0) {
    vscode.window.showInformationMessage(
      `No stacks available for role "${mod.role}".`
    );
    return;
  }

  const stackChoice = await vscode.window.showQuickPick(
    [
      ...stacksForRole,
      { label: "Remove stack", description: "Remove current stack" },
    ],
    { title: `Stack for ${mod.name}`, placeHolder: "Select stack" }
  );
  if (!stackChoice) return;

  // 3. Update config
  const moduleIndex = config.modules.findIndex((m) => m.name === mod.name);
  if (stackChoice.label === "Remove stack") {
    delete config.modules[moduleIndex].stack;
  } else {
    config.modules[moduleIndex].stack = stackChoice.label;
  }

  await configService.saveConfig(config);

  // 4. Regenerate
  const workspaceRoot = configService.getWorkspaceRoot();
  if (workspaceRoot) {
    try {
      const cddKit = await import("cdd-kit/api");
      await cddKit.generateClaudeInfra(workspaceRoot, config as any);
      await cddKit.generateModule(
        workspaceRoot,
        config as any,
        config.modules[moduleIndex] as any
      );
    } catch (err) {
      vscode.window.showWarningMessage(`Stack updated but generation failed: ${err}`);
    }
  }

  treeProvider.refresh();
  const action =
    stackChoice.label === "Remove stack" ? "removed" : `set to ${stackChoice.label}`;
  vscode.window.showInformationMessage(
    `Stack for "${mod.name}" ${action}.`
  );
}

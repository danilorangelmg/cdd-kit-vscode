import * as vscode from "vscode";
import { ConfigService } from "../services/configService";
import { CddTreeProvider } from "../providers/CddTreeProvider";

const ROLES = [
  { label: "frontend", description: "Visual layer — components, hooks, pages" },
  { label: "backend", description: "Business logic, APIs, aggregation" },
  { label: "database", description: "DDL, migrations, schema registry" },
  { label: "agent-ai", description: "Rules engine, LLM pipelines, schedulers" },
  { label: "mobile", description: "Native/hybrid apps" },
  { label: "e2e", description: "End-to-end testing" },
  { label: "generic", description: "Custom role" },
];

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

export async function addModuleCommand(
  configService: ConfigService,
  treeProvider: CddTreeProvider
): Promise<void> {
  const config = configService.getConfig();
  if (!config) {
    vscode.window.showErrorMessage(
      "No cdd.json found. Run CDD: Init Project first."
    );
    return;
  }

  // 1. Module name
  const name = await vscode.window.showInputBox({
    title: "Module Name",
    prompt: "Enter the name for the new module",
    placeHolder: "e.g., dashboard, notifications, auth",
    validateInput: (value) => {
      if (!value) return "Name is required";
      if (config.modules.some((m) => m.name === value))
        return "Module already exists";
      return undefined;
    },
  });
  if (!name) return;

  // 2. Role
  const role = await vscode.window.showQuickPick(ROLES, {
    title: "Module Role",
    placeHolder: "Select the role for this module",
  });
  if (!role) return;

  // 3. Stack (optional, based on role)
  let stack: string | undefined;
  const stacksForRole = STACKS[role.label];
  if (stacksForRole && stacksForRole.length > 0) {
    const stackChoice = await vscode.window.showQuickPick(
      [
        ...stacksForRole,
        { label: "None", description: "No stack-specific patterns" },
      ],
      {
        title: `Stack for ${name}`,
        placeHolder: "Select the technology stack (optional)",
      }
    );
    if (stackChoice && stackChoice.label !== "None") {
      stack = stackChoice.label;
    }
  }

  // 4. Add module to config
  const newModule = {
    name,
    role: role.label,
    directory: name,
    ...(stack ? { stack } : {}),
  };

  config.modules.push(newModule);
  await configService.saveConfig(config);

  // 5. Generate infrastructure using cdd-kit
  const workspaceRoot = configService.getWorkspaceRoot();
  if (workspaceRoot) {
    try {
      const cddKit = await import("cdd-kit/api");
      await cddKit.generateModule(workspaceRoot, config as any, newModule as any);
      await cddKit.generateClaudeInfra(workspaceRoot, config as any);
      await cddKit.generateOrchestrator(workspaceRoot, config as any);
    } catch (err) {
      vscode.window.showWarningMessage(
        `Module added to cdd.json but generation failed: ${err}`
      );
    }
  }

  treeProvider.refresh();
  vscode.window.showInformationMessage(
    `Module "${name}" (${role.label}${stack ? ` / ${stack}` : ""}) added successfully.`
  );
}

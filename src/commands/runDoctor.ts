import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ConfigService } from "../services/configService";

interface DoctorResult {
  label: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

export async function runDoctorCommand(
  configService: ConfigService
): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("CDD Doctor");
  outputChannel.show();
  outputChannel.clear();
  outputChannel.appendLine("CDD Doctor — Checking project health...\n");

  const workspaceRoot = configService.getWorkspaceRoot();
  if (!workspaceRoot) {
    outputChannel.appendLine("FAIL: No workspace folder open.");
    return;
  }

  const results: DoctorResult[] = [];

  // 1. cdd.json exists and is valid
  const cddJsonPath = path.join(workspaceRoot, "cdd.json");
  if (fs.existsSync(cddJsonPath)) {
    const config = configService.getConfig();
    if (config) {
      results.push({
        label: "cdd.json",
        status: "pass",
        message: `Valid — ${config.modules.length} modules, ${config.methodology.preset} preset`,
      });
    } else {
      results.push({
        label: "cdd.json",
        status: "fail",
        message: "File exists but could not be parsed",
      });
    }
  } else {
    results.push({
      label: "cdd.json",
      status: "fail",
      message: "Not found. Run CDD: Init Project",
    });
  }

  const config = configService.getConfig();

  // 2. Root CLAUDE.md
  const claudeMd = path.join(workspaceRoot, "CLAUDE.md");
  results.push(checkFileExists("Root CLAUDE.md", claudeMd));

  // 3. .claude directory
  const claudeDir = path.join(workspaceRoot, ".claude");
  results.push(checkDirExists(".claude/ directory", claudeDir));

  if (config) {
    // 4. Module CLAUDE.md files
    for (const mod of config.modules) {
      const moduleClaudeMd = path.join(workspaceRoot, mod.directory, "CLAUDE.md");
      results.push(
        checkFileExists(`${mod.name}/CLAUDE.md`, moduleClaudeMd)
      );
    }

    // 5. Delegate agents
    for (const mod of config.modules) {
      const agentPath = path.join(
        claudeDir,
        "agents",
        `${mod.name}-delegate.md`
      );
      results.push(
        checkFileExists(`Agent: ${mod.name}-delegate`, agentPath)
      );
    }

    // 6. Settings.json
    const settingsPath = path.join(claudeDir, "settings.json");
    results.push(checkFileExists(".claude/settings.json", settingsPath));

    // 7. Rules directory
    const rulesDir = path.join(claudeDir, "rules");
    results.push(checkDirExists(".claude/rules/", rulesDir));

    // 8. Skills directory
    const skillsDir = path.join(claudeDir, "skills");
    results.push(checkDirExists(".claude/skills/", skillsDir));

    // 9. TDD hooks (if rule #8 enabled)
    if (config.methodology.rules["8"]) {
      const hooksDir = path.join(claudeDir, "hooks");
      results.push(checkDirExists(".claude/hooks/ (TDD)", hooksDir));
    }
  }

  // Output results
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const r of results) {
    const icon = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "WARN";
    outputChannel.appendLine(`  [${icon}] ${r.label} — ${r.message}`);
    if (r.status === "pass") passCount++;
    else if (r.status === "fail") failCount++;
    else warnCount++;
  }

  outputChannel.appendLine("");
  outputChannel.appendLine(
    `Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`
  );

  if (failCount === 0) {
    vscode.window.showInformationMessage(
      `CDD Doctor: All ${passCount} checks passed.`
    );
  } else {
    vscode.window.showWarningMessage(
      `CDD Doctor: ${failCount} issues found. Check output for details.`
    );
  }
}

function checkFileExists(label: string, filePath: string): DoctorResult {
  if (fs.existsSync(filePath)) {
    return { label, status: "pass", message: "Found" };
  }
  return { label, status: "fail", message: "Missing" };
}

function checkDirExists(label: string, dirPath: string): DoctorResult {
  if (fs.existsSync(dirPath)) {
    return { label, status: "pass", message: "Found" };
  }
  return { label, status: "fail", message: "Missing" };
}

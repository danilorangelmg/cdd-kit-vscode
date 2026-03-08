import * as vscode from "vscode";

export async function askAgentCommand(): Promise<void> {
  await vscode.commands.executeCommand("cddChat.focus");
}

import * as vscode from "vscode";
import { CommandManager } from "./commandManager";
import { CommandProvider, CommandTreeItem } from "./commandProvider";
import { PackageJsonDiscoveryService } from "./packageJsonDiscovery";
import { SmartDetectionService } from "./smartDetection";
import { PackageJsonSelector } from "./packageJsonSelector";
import * as path from "path";
import * as fs from "fs";
import { PackageJsonStatusBar } from "./packageJsonStatusBar";

let packageJsonStatusBar: PackageJsonStatusBar;

export function activate(context: vscode.ExtensionContext) {
  const discoveryService = new PackageJsonDiscoveryService();
  const smartDetectionService = new SmartDetectionService(discoveryService);
  packageJsonStatusBar = new PackageJsonStatusBar();
  const commandManager = new CommandManager(
    context,
    discoveryService,
    smartDetectionService,
    packageJsonStatusBar
  );
  const commandProvider = new CommandProvider(commandManager);

  context.subscriptions.push(
    vscode.commands.registerCommand("command-runner.addCommand", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter command name",
        placeHolder: "e.g., start-dev",
      });
      if (!name) {
        return;
      }

      const action = await vscode.window.showInputBox({
        prompt: "Enter npm action",
        placeHolder: "e.g., npm run dev",
      });
      if (!action) {
        return;
      }

      const summary = await vscode.window.showInputBox({
        prompt: "Enter a brief summary (optional)",
        placeHolder: "e.g., Starts the development server",
      });

      try {
        await commandManager.addCommand({
          name,
          action,
          summary: summary || "",
        });
        commandProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to add command: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),

    vscode.commands.registerCommand(
      "command-runner.editCommand",
      async (item: CommandTreeItem) => {
        if (!item) {
          vscode.window.showWarningMessage("Please select a command to edit.");
          return;
        }

        const commands = commandManager.getCommands();
        const commandToEdit = commands.find((cmd) => cmd.id === item.commandId);

        if (!commandToEdit) {
          vscode.window.showErrorMessage("Command not found.");
          return;
        }

        const newName = await vscode.window.showInputBox({
          prompt: "Edit command name",
          value: commandToEdit.name,
        });
        if (newName === undefined) {
          return;
        }

        const newAction = await vscode.window.showInputBox({
          prompt: "Edit npm command",
          value: commandToEdit.action,
        });
        if (newAction === undefined) {
          return;
        }

        const newSummary = await vscode.window.showInputBox({
          prompt: "Edit command summary",
          value: commandToEdit.summary,
        });
        if (newSummary === undefined) {
          return;
        }

        await commandManager.updateCommand({
          ...commandToEdit,
          name: newName,
          action: newAction,
          summary: newSummary,
        });
        commandProvider.refresh();
      }
    ),

    vscode.commands.registerCommand(
      "command-runner.deleteCommand",
      async (item: CommandTreeItem) => {
        if (!item) {
          vscode.window.showWarningMessage(
            "Please select a command to delete."
          );
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete command '${item.label}'?`,
          { modal: true },
          "Delete"
        );

        if (confirm === "Delete") {
          await commandManager.deleteCommand(item.commandId);
          commandProvider.refresh();
        }
      }
    ),

    vscode.commands.registerCommand(
      "command-runner.runCommand",
      async (item: CommandTreeItem) => {
        if (!item) {
          vscode.window.showWarningMessage("Please select a command to run.");
          return;
        }

        const currentPackageJson = commandManager.getCurrentPackageJson();
        const workingDirectory = currentPackageJson
          ? currentPackageJson.directory
          : undefined;

        const terminalName = `Command Runner (Temp): ${item.label}`;

        const task = new vscode.Task(
          { type: "shell", command: item.action },
          vscode.TaskScope.Workspace,
          terminalName,
          "Command Runner",
          new vscode.ShellExecution(item.action, { cwd: workingDirectory })
        );

        const execution = await vscode.tasks.executeTask(task);

        const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
          if (e.execution === execution) {
            if (e.exitCode === 0) {
              setTimeout(() => {
                vscode.window.terminals.forEach((t) => {
                  if (t.name === terminalName) {
                    t.dispose();
                  }
                });
              }, 2000);
            } else {
              vscode.window.showErrorMessage(
                `Command '${item.label}' failed with exit code ${e.exitCode}. Terminal kept open for review.`
              );
            }
            disposable.dispose();
          }
        });
      }
    ),

    vscode.commands.registerCommand(
      "command-runner.selectPackageJson",
      async () => {
        const availablePackageJsons =
          await commandManager.getAvailablePackageJsons();

        if (availablePackageJsons.length === 0) {
          vscode.window.showWarningMessage(
            "No package.json files found in the workspace."
          );
          return;
        }

        const context = await smartDetectionService.analyzeProjectContext(
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ""
        );

        const selected = await PackageJsonSelector.selectPackageJson(
          availablePackageJsons,
          context,
          {
            title: "Select Package.json for Commands",
            placeholder:
              "Choose which package.json to use for running commands",
          }
        );

        if (selected && !Array.isArray(selected)) {
          await commandManager.setCurrentPackageJson(selected);
          commandProvider.refresh();
        }
      }
    ),

    vscode.commands.registerCommand(
      "command-runner.showPackageJsonInfo",
      async () => {
        const currentPackageJson = commandManager.getCurrentPackageJson();

        if (!currentPackageJson) {
          vscode.window.showWarningMessage(
            'No package.json selected. Use "Select Package.json" first.'
          );
          return;
        }

        await PackageJsonSelector.showPackageJsonInfo(currentPackageJson);
      }
    ),

    vscode.commands.registerCommand(
      "command-runner.refreshPackageJsons",
      async () => {
        discoveryService.clearCache();
        discoveryService.refreshWorkspaceRoots();

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const startPath = workspaceFolders[0].uri.fsPath;
          const bestPackageJson =
            await smartDetectionService.shouldUseSpecificPackageJson(startPath);

          if (bestPackageJson) {
            await commandManager.setCurrentPackageJson(bestPackageJson);
            commandProvider.refresh();
          }
        }
      }
    ),

    vscode.commands.registerCommand(
      "command-runner.addSuggestedCommand",
      async (suggestedCommand: any) => {
        if (
          suggestedCommand &&
          suggestedCommand.name &&
          suggestedCommand.action
        ) {
          await commandManager.addCommand({
            name: suggestedCommand.name,
            action: suggestedCommand.action,
            summary: suggestedCommand.summary || "",
          });
          commandProvider.refresh();
        }
      }
    )
  );

  vscode.window.registerTreeDataProvider(
    "command-runner-sidebar",
    commandProvider
  );

  setupWorkspaceChangeDetection(
    discoveryService,
    smartDetectionService,
    commandManager,
    commandProvider
  );

  addDefaultCommands(commandManager, commandProvider);
}

async function addDefaultCommands(
  commandManager: CommandManager,
  commandProvider: CommandProvider
) {
  const defaultCommands = [
    {
      name: "npm install",
      action: "npm install",
      summary: "Install npm dependencies",
    },
    {
      name: "npm run dev",
      action: "npm run dev",
      summary: "Run development server",
    },
    {
      name: "npm run build",
      action: "npm run build",
      summary: "Build project for production",
    },
    { name: "npm test", action: "npm test", summary: "Run tests" },
  ];

  const existingCommands = commandManager.getCommands();
  let commandsAdded = false;

  for (const defaultCmd of defaultCommands) {
    const exists = existingCommands.some(
      (cmd) => cmd.name === defaultCmd.name && cmd.action === defaultCmd.action
    );
    if (!exists) {
      await commandManager.addCommand(defaultCmd);
      commandsAdded = true;
    }
  }

  if (commandsAdded) {
    commandProvider.refresh();
  }
}

/**
 * Set up workspace change detection and automatic re-discovery
 */
function setupWorkspaceChangeDetection(
  discoveryService: PackageJsonDiscoveryService,
  smartDetectionService: SmartDetectionService,
  commandManager: CommandManager,
  commandProvider: CommandProvider
): void {
  vscode.workspace.onDidChangeWorkspaceFolders(async () => {
    discoveryService.refreshWorkspaceRoots();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const startPath = workspaceFolders[0].uri.fsPath;
      const bestPackageJson =
        await smartDetectionService.shouldUseSpecificPackageJson(startPath);

      if (bestPackageJson) {
        await commandManager.setCurrentPackageJson(bestPackageJson);
        commandProvider.refresh();
      }
    }
  });

  vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (!editor || !editor.document.fileName.endsWith(".json")) {
      return;
    }

    if (path.basename(editor.document.fileName) === "package.json") {
      const currentPackageJson = commandManager.getCurrentPackageJson();
      const editorPackageJsonPath = editor.document.fileName;

      if (currentPackageJson?.path === editorPackageJsonPath) {
        return;
      }

      const packageInfo = await discoveryService.parsePackageJson(
        editorPackageJsonPath,
        0
      );
      if (packageInfo) {
        const result = await vscode.window.showInformationMessage(
          `Use this package.json for Command Runner?`,
          "Yes",
          "No"
        );

        if (result === "Yes") {
          await commandManager.setCurrentPackageJson(packageInfo);
          commandProvider.refresh();
        }
      }
    }
  });
}

export function deactivate() {
  packageJsonStatusBar.dispose();
}

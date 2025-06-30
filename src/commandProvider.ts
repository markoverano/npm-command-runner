
import * as vscode from 'vscode';
import * as path from 'path';
import { CommandManager } from './commandManager';

export class CommandTreeItem extends vscode.TreeItem {
    constructor(
        public readonly commandId: string,
        public readonly label: string,
        public readonly action: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${tooltip}\n\nCommand: ${action}`;
        this.description = '';
        this.contextValue = 'commandItem';
        this.id = commandId;
        this.iconPath = this.getCommandIcon(action);
        this.command = {
            command: 'command-runner.runCommand',
            title: 'Run Command',
            arguments: [this]
        };
    }

    private getCommandIcon(action: string): vscode.ThemeIcon {
        
        const lowerAction = action.toLowerCase();

        if (lowerAction.includes('start') || lowerAction.includes('serve') || lowerAction.includes('dev')) {
            return new vscode.ThemeIcon('play', new vscode.ThemeColor('charts.green'));
        } else if (lowerAction.includes('build') || lowerAction.includes('compile')) {
            return new vscode.ThemeIcon('tools', new vscode.ThemeColor('charts.blue'));
        } else if (lowerAction.includes('test')) {
            return new vscode.ThemeIcon('beaker', new vscode.ThemeColor('charts.purple'));
        } else if (lowerAction.includes('lint') || lowerAction.includes('format')) {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.orange'));
        } else if (lowerAction.includes('deploy') || lowerAction.includes('publish')) {
            return new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.red'));
        } else if (lowerAction.includes('install') || lowerAction.includes('add')) {
            return new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.yellow'));
        } else {
            return new vscode.ThemeIcon('terminal', new vscode.ThemeColor('foreground'));
        }
    }
}

export class PackageJsonInfoItem extends vscode.TreeItem {
    constructor(
        public readonly packageJsonPath: string,
        public readonly packageName: string,
        public readonly packageDirectory: string
    ) {
        super(packageName, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `Current package.json: ${packageDirectory}\n\nClick to view detailed information`;
        this.description = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', packageDirectory) || './';
        this.contextValue = 'packageJsonInfo';
        this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.blue'));
        this.command = {
            command: 'command-runner.showPackageJsonInfo',
            title: 'Show Package.json Info'
        };
    }
}

export class InfoTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        contextValue: string,
        command?: vscode.Command,
        description?: string,
        icon?: vscode.ThemeIcon
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = contextValue;
        this.description = description;
        this.iconPath = icon;

        if (command) {
            this.command = command;
        }

        
        if (contextValue === 'noPackageJson') {
            this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
            this.tooltip = 'No package.json found in the current workspace. Click to select one manually.';
        } else if (contextValue === 'separator') {
            this.iconPath = undefined;
            this.description = undefined;
        } else if (contextValue === 'suggestion') {
            this.iconPath = new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('editorLightBulb.foreground'));
        }
    }
}

type TreeItemType = CommandTreeItem | PackageJsonInfoItem | InfoTreeItem;

export class CommandProvider implements vscode.TreeDataProvider<TreeItemType> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItemType | undefined | void> = new vscode.EventEmitter<TreeItemType | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItemType | undefined | void> = this._onDidChangeTreeData.event;

    private commandManager: CommandManager;

    constructor(commandManager: CommandManager) {
        this.commandManager = commandManager;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItemType): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeItemType): Promise<TreeItemType[]> {
        if (element) {
            return []; 
        }

        const items: TreeItemType[] = [];

        
        const currentPackageJson = this.commandManager.getCurrentPackageJson();
        if (!currentPackageJson) {
            
            items.push(new InfoTreeItem(
                'No package.json found',
                'noPackageJson',
                {
                    command: 'command-runner.selectPackageJson',
                    title: 'Select Package.json'
                },
                'Click to select manually'
            ));
            
            items.push(new InfoTreeItem('', 'separator'));
        }

        
        const commands = this.commandManager.getCommands();
        const commandItems = commands.map(cmd => {
            const item = new CommandTreeItem(cmd.id, cmd.name, cmd.action, cmd.summary, vscode.TreeItemCollapsibleState.None);

            
            if (cmd.packageJsonPath && currentPackageJson?.path !== cmd.packageJsonPath) {
                const originalTooltip = item.tooltip || cmd.summary;
                const contextInfo = ` (Created for: ${path.basename(path.dirname(cmd.packageJsonPath))})`;
                
                const updatedItem = new CommandTreeItem(cmd.id, cmd.name, cmd.action, originalTooltip + contextInfo, vscode.TreeItemCollapsibleState.None);
                return updatedItem;
            }

            return item;
        });

        items.push(...commandItems);

        
        if (commands.length === 0 && currentPackageJson) {
            await this.addContextualSuggestions(items, currentPackageJson);
        }

        return items;
    }

    /**
     * Add contextual command suggestions based on the current package.json
     */
    private async addContextualSuggestions(items: TreeItemType[], currentPackageJson: any): Promise<void> {
        if (!currentPackageJson.scripts) {
            return;
        }

        const suggestedCommands = [];
        const scripts = currentPackageJson.scripts;

        
        const commonScripts = [
            { script: 'start', description: 'Start the application' },
            { script: 'dev', description: 'Start development server' },
            { script: 'build', description: 'Build for production' },
            { script: 'test', description: 'Run tests' },
            { script: 'lint', description: 'Run linter' }
        ];

        for (const { script, description } of commonScripts) {
            if (scripts[script]) {
                suggestedCommands.push({
                    name: `npm run ${script}`,
                    action: `npm run ${script}`,
                    summary: description
                });
            }
        }

        if (suggestedCommands.length > 0) {
            
            items.push(new InfoTreeItem('', 'separator'));

            
            items.push(new InfoTreeItem(
                'Suggested Commands',
                'suggestionHeader',
                undefined,
                `${suggestedCommands.length} available`,
                new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('editorLightBulb.foreground'))
            ));

            
            for (const cmd of suggestedCommands) {
                const suggestionItem = new InfoTreeItem(
                    cmd.name,
                    'suggestion',
                    {
                        command: 'command-runner.addSuggestedCommand',
                        title: 'Add Suggested Command',
                        arguments: [cmd]
                    },
                    'Click to add',
                    new vscode.ThemeIcon('add', new vscode.ThemeColor('charts.green'))
                );
                suggestionItem.tooltip = `${cmd.summary}\n\nClick to add this command to your list`;
                items.push(suggestionItem);
            }
        }
    }
}

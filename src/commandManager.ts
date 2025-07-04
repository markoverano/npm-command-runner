
import * as vscode from 'vscode';
import { PackageJsonDiscoveryService, PackageJsonInfo } from './packageJsonDiscovery';
import { SmartDetectionService } from './smartDetection';
import { PackageJsonStatusBar } from './packageJsonStatusBar'; 

interface Command {
    id: string;
    name: string;
    action: string;
    summary: string;
    packageJsonPath?: string; 
}

interface UserPreferences {
    autoSelectPackageJson: boolean;
    rememberLastSelection: boolean;
    showContextualSuggestions: boolean;
    maxSearchDepth: number;
    preferWorkspaceRoots: boolean;
}

export class CommandManager {
    private static readonly COMMANDS_KEY = 'commandRunner.commands';
    private static readonly SELECTED_PACKAGE_KEY = 'commandRunner.selectedPackageJson';
    private static readonly PREFERENCES_KEY = 'commandRunner.preferences';
    private static readonly PACKAGE_HISTORY_KEY = 'commandRunner.packageHistory';

    private static readonly DEFAULT_PREFERENCES: UserPreferences = {
        autoSelectPackageJson: true,
        rememberLastSelection: true,
        showContextualSuggestions: true,
        maxSearchDepth: 5,
        preferWorkspaceRoots: true
    };

    private context: vscode.ExtensionContext;
    private discoveryService: PackageJsonDiscoveryService;
    private smartDetectionService: SmartDetectionService;
    private packageJsonStatusBar: PackageJsonStatusBar; 
    private currentPackageJson: PackageJsonInfo | null = null;
    private preferences: UserPreferences;

    constructor(
        context: vscode.ExtensionContext,
        discoveryService: PackageJsonDiscoveryService,
        smartDetectionService: SmartDetectionService,
        packageJsonStatusBar: PackageJsonStatusBar
    ) {
        this.context = context;
        this.discoveryService = discoveryService;
        this.smartDetectionService = smartDetectionService;
        this.packageJsonStatusBar = packageJsonStatusBar;
        this.preferences = this.loadPreferences();
    }

    /**
     * Load user preferences from storage
     */
    private loadPreferences(): UserPreferences {
        const saved = this.context.globalState.get<Partial<UserPreferences>>(CommandManager.PREFERENCES_KEY, {});
        return { ...CommandManager.DEFAULT_PREFERENCES, ...saved };
    }

    /**
     * Save user preferences to storage
     */
    private async savePreferences(): Promise<void> {
        await this.context.globalState.update(CommandManager.PREFERENCES_KEY, this.preferences);
    }

    /**
     * Get current user preferences
     */
    public getPreferences(): UserPreferences {
        return { ...this.preferences };
    }

    /**
     * Update user preferences
     */
    public async updatePreferences(newPreferences: Partial<UserPreferences>): Promise<void> {
        this.preferences = { ...this.preferences, ...newPreferences };
        await this.savePreferences();
    }

    /**
     * Add package.json to usage history
     */
    private async addToHistory(packageInfo: PackageJsonInfo): Promise<void> {
        const history = this.context.globalState.get<string[]>(CommandManager.PACKAGE_HISTORY_KEY, []);

        
        const filtered = history.filter(path => path !== packageInfo.path);

        
        filtered.unshift(packageInfo.path);
        const limited = filtered.slice(0, 10);

        await this.context.globalState.update(CommandManager.PACKAGE_HISTORY_KEY, limited);
    }

    /**
     * Get package.json usage history
     */
    public async getPackageJsonHistory(): Promise<PackageJsonInfo[]> {
        const history = this.context.globalState.get<string[]>(CommandManager.PACKAGE_HISTORY_KEY, []);
        const packageInfos: PackageJsonInfo[] = [];

        for (const packagePath of history) {
            try {
                const info = await this.discoveryService.parsePackageJson(packagePath, 0);
                if (info) {
                    packageInfos.push(info);
                }
            } catch {
                
            }
        }

        return packageInfos;
    }

    /**
     * Initialize the current package.json from saved state or auto-detect
     */
    public async initialize(): Promise<void> {
        const savedPath = this.context.globalState.get<string>(
            CommandManager.SELECTED_PACKAGE_KEY
        );
        if (savedPath) {
            try {
                const packageInfo = await this.discoveryService.parsePackageJson(
                    savedPath,
                    0
                );
                if (packageInfo) {
                    this.currentPackageJson = packageInfo;
                    this.packageJsonStatusBar.updateStatus(this.currentPackageJson);
                    return;
                }
            } catch {
                //
            }
        }

        await this.autoDetectPackageJson();
    }

    /**
     * Auto-detect the best package.json file to use
     */
    private async autoDetectPackageJson(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const startPath = workspaceFolders[0].uri.fsPath;
        const bestPackageJson = await this.smartDetectionService.shouldUseSpecificPackageJson(startPath);

        if (bestPackageJson) {
            this.currentPackageJson = bestPackageJson;
            await this.saveCurrentPackageJson();
        }
        this.packageJsonStatusBar.updateStatus(this.currentPackageJson);
    }

    /**
     * Save the current package.json selection
     */
    private async saveCurrentPackageJson(): Promise<void> {
        if (this.currentPackageJson) {
            await this.context.globalState.update(CommandManager.SELECTED_PACKAGE_KEY, this.currentPackageJson.path);
        }
    }

    /**
     * Get the currently selected package.json
     */
    public getCurrentPackageJson(): PackageJsonInfo | null {
        return this.currentPackageJson;
    }

    /**
     * Set the current package.json
     */
    public async setCurrentPackageJson(packageInfo: PackageJsonInfo): Promise<void> {
        this.currentPackageJson = packageInfo;
        await this.saveCurrentPackageJson();
        this.packageJsonStatusBar.updateStatus(this.currentPackageJson);

        
        if (this.preferences.rememberLastSelection) {
            await this.addToHistory(packageInfo);
        }
    }

    /**
     * Get available package.json files for the current workspace
     */
    public async getAvailablePackageJsons(): Promise<PackageJsonInfo[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const startPath = workspaceFolders[0].uri.fsPath;
        return await this.discoveryService.discoverPackageJsonFiles(startPath);
    }

    /**
     * Get contextual recommendations for package.json selection
     */
    public async getContextualRecommendations(): Promise<PackageJsonInfo[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const startPath = workspaceFolders[0].uri.fsPath;
        return await this.smartDetectionService.getContextualRecommendations(startPath);
    }

    public getCommands(): Command[] {
        const commands = this.context.globalState.get<Command[]>(CommandManager.COMMANDS_KEY, []);
        return commands;
    }

    public async addCommand(command: Omit<Command, 'id'>): Promise<void> {
        const commands = this.getCommands();
        const newCommand: Command = {
            ...command,
            id: Date.now().toString(),
            packageJsonPath: this.currentPackageJson?.path
        };
        commands.push(newCommand);
        await this.saveCommands(commands);
    }

    public async updateCommand(updatedCommand: Command): Promise<void> {
        let commands = this.getCommands();
        const index = commands.findIndex(cmd => cmd.id === updatedCommand.id);
        if (index !== -1) {
            commands[index] = updatedCommand;
            await this.saveCommands(commands);
        }
    }

    public async deleteCommand(id: string): Promise<void> {
        let commands = this.getCommands();
        commands = commands.filter(cmd => cmd.id !== id);
        await this.saveCommands(commands);
    }

    private async saveCommands(commands: Command[]): Promise<void> {
        await this.context.globalState.update(CommandManager.COMMANDS_KEY, commands);
    }
}

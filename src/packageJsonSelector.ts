import * as vscode from 'vscode';
import * as path from 'path';
import { PackageJsonInfo } from './packageJsonDiscovery';
import { WebviewUtils } from './webviewUtils';
import { ProjectContext } from './smartDetection';

export interface PackageJsonQuickPickItem extends vscode.QuickPickItem {
    packageInfo: PackageJsonInfo;
    isRecommended?: boolean;
}

export interface SelectionOptions {
    showRecommended?: boolean;
    showProjectContext?: boolean;
    allowMultiSelect?: boolean;
    maxItems?: number;
    title?: string;
    placeholder?: string;
}

export class PackageJsonSelector {
    private static readonly DEFAULT_OPTIONS: Required<SelectionOptions> = {
        showRecommended: true,
        showProjectContext: true,
        allowMultiSelect: false,
        maxItems: 10,
        title: 'Select Package.json',
        placeholder: 'Choose a package.json file to use'
    };

    /**
     * Show a quick pick dialog to select a package.json file
     */
    public static async selectPackageJson(
        packageJsons: PackageJsonInfo[],
        context?: ProjectContext,
        options: SelectionOptions = {}
    ): Promise<PackageJsonInfo | PackageJsonInfo[] | undefined> {
        const opts = { ...PackageJsonSelector.DEFAULT_OPTIONS, ...options };

        if (packageJsons.length === 0) {
            vscode.window.showWarningMessage('No package.json files found.');
            return undefined;
        }

        
        if (packageJsons.length === 1 && packageJsons[0].score > 80) {
            return opts.allowMultiSelect ? [packageJsons[0]] : packageJsons[0];
        }

        const quickPickItems = this.createQuickPickItems(packageJsons, context, opts);

        const quickPick = vscode.window.createQuickPick<PackageJsonQuickPickItem>();
        quickPick.title = opts.title;
        quickPick.placeholder = opts.placeholder;
        quickPick.items = quickPickItems;
        quickPick.canSelectMany = opts.allowMultiSelect;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;

        
        if (context && opts.showProjectContext) {
            quickPick.title = `${opts.title} - ${this.getProjectTypeLabel(context.type)}`;
        }

        return new Promise((resolve) => {
            quickPick.onDidAccept(() => {
                const selected = quickPick.selectedItems;
                if (selected.length > 0) {
                    if (opts.allowMultiSelect) {
                        resolve(selected.map(item => item.packageInfo));
                    } else {
                        resolve(selected[0].packageInfo);
                    }
                } else {
                    resolve(undefined);
                }
                quickPick.dispose();
            });

            quickPick.onDidHide(() => {
                resolve(undefined);
                quickPick.dispose();
            });

            quickPick.show();
        });
    }

    /**
     * Create quick pick items from package.json information
     */
    private static createQuickPickItems(
        packageJsons: PackageJsonInfo[],
        context?: ProjectContext,
        options?: Required<SelectionOptions>
    ): PackageJsonQuickPickItem[] {
        const items: PackageJsonQuickPickItem[] = [];
        const maxItems = options?.maxItems || 10;

        
        const limitedPackageJsons = packageJsons.slice(0, maxItems);

        for (const packageInfo of limitedPackageJsons) {
            const item = this.createQuickPickItem(packageInfo, context);
            items.push(item);
        }

        
        items.sort((a, b) => {
            if (a.isRecommended && !b.isRecommended) return -1;
            if (!a.isRecommended && b.isRecommended) return 1;
            return b.packageInfo.score - a.packageInfo.score;
        });

        return items;
    }

    /**
     * Create a single quick pick item from package.json info
     */
    private static createQuickPickItem(
        packageInfo: PackageJsonInfo,
        context?: ProjectContext
    ): PackageJsonQuickPickItem {
        const relativePath = this.getRelativePath(packageInfo.directory);
        const label = this.createLabel(packageInfo);
        const description = this.createDescription(packageInfo);
        const detail = this.createDetail(packageInfo, context);
        
        const isRecommended = context?.rootPackageJson?.path === packageInfo.path ||
                             packageInfo.isWorkspaceRoot ||
                             packageInfo.score > 80;

        return {
            label: isRecommended ? `$(star-full) ${label}` : label,
            description,
            detail,
            packageInfo,
            isRecommended
        };
    }

    /**
     * Create the main label for a package.json item
     */
    private static createLabel(packageInfo: PackageJsonInfo): string {
        if (packageInfo.name) {
            return packageInfo.name;
        }
        
        const dirName = path.basename(packageInfo.directory);
        return dirName || 'Unnamed Package';
    }

    /**
     * Create the description for a package.json item
     */
    private static createDescription(packageInfo: PackageJsonInfo): string {
        const parts: string[] = [];

        if (packageInfo.version) {
            parts.push(`v${packageInfo.version}`);
        }

        if (packageInfo.isWorkspaceRoot) {
            parts.push('Workspace Root');
        }

        if (packageInfo.isMonorepoRoot) {
            parts.push('Monorepo Root');
        }

        const scriptCount = packageInfo.scripts ? Object.keys(packageInfo.scripts).length : 0;
        if (scriptCount > 0) {
            parts.push(`${scriptCount} scripts`);
        }

        return parts.join(' • ');
    }

    /**
     * Create the detail text for a package.json item
     */
    private static createDetail(packageInfo: PackageJsonInfo, context?: ProjectContext): string {
        const relativePath = this.getRelativePath(packageInfo.directory);
        const parts: string[] = [relativePath];

        
        if (packageInfo.distance > 0) {
            parts.push(`${packageInfo.distance} levels away`);
        }

        
        if (packageInfo.scripts) {
            const commonScripts = ['start', 'dev', 'build', 'test', 'lint'];
            const availableCommonScripts = commonScripts.filter(script => packageInfo.scripts![script]);
            
            if (availableCommonScripts.length > 0) {
                parts.push(`Scripts: ${availableCommonScripts.join(', ')}`);
            }
        }

        return parts.join(' • ');
    }

    /**
     * Get relative path for display
     */
    private static getRelativePath(fullPath: string): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return fullPath;
        }

        for (const folder of workspaceFolders) {
            if (fullPath.startsWith(folder.uri.fsPath)) {
                const relativePath = path.relative(folder.uri.fsPath, fullPath);
                return relativePath || './';
            }
        }

        return fullPath;
    }

    /**
     * Get a user-friendly label for project type
     */
    private static getProjectTypeLabel(projectType: string): string {
        switch (projectType) {
            case 'monorepo': return 'Monorepo Project';
            case 'workspace': return 'VS Code Workspace';
            case 'nested': return 'Nested Project';
            case 'single-package': return 'Single Package';
            default: return 'Project';
        }
    }

    /**
     * Show a simple selection dialog for package.json files
     */
    public static async showSimpleSelection(
        packageJsons: PackageJsonInfo[],
        title: string = 'Select Package.json'
    ): Promise<PackageJsonInfo | undefined> {
        if (packageJsons.length === 0) {
            return undefined;
        }

        if (packageJsons.length === 1) {
            return packageJsons[0];
        }

        const items = packageJsons.map(pkg => ({
            label: pkg.name || path.basename(pkg.directory),
            description: this.getRelativePath(pkg.directory),
            packageInfo: pkg
        }));

        const selected = await vscode.window.showQuickPick(items, {
            title,
            placeHolder: 'Choose a package.json file'
        });

        return selected?.packageInfo;
    }

    /**
     * Show a confirmation dialog when auto-selecting a package.json
     */
    public static async confirmAutoSelection(
        packageInfo: PackageJsonInfo,
        reason: string
    ): Promise<boolean> {
        const relativePath = this.getRelativePath(packageInfo.directory);
        const name = packageInfo.name || path.basename(packageInfo.directory);
        
        const message = `Auto-selected "${name}" at ${relativePath}. ${reason}`;
        const result = await vscode.window.showInformationMessage(
            message,
            { modal: false },
            'Use This',
            'Choose Different'
        );

        return result === 'Use This';
    }

    /**
     * Show package.json information in a webview
     */
    public static async showPackageJsonInfo(packageInfo: PackageJsonInfo): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'packageJsonInfo',
            `Package Info: ${packageInfo.name || 'Unnamed'}`,
            vscode.ViewColumn.Beside,
            { enableScripts: false }
        );

        panel.webview.html = this.generatePackageInfoHtml(packageInfo);
    }

    /**
     * Generate HTML content for package.json information
     */
    private static generatePackageInfoHtml(packageInfo: PackageJsonInfo): string {
        const relativePath = this.getRelativePath(packageInfo.directory);
        const scripts = packageInfo.scripts || {};
        const scriptEntries = Object.entries(scripts);

        
        const headerInfo = [
            { key: 'Location', value: relativePath }
        ];
        if (packageInfo.version) {
            headerInfo.push({ key: 'Version', value: packageInfo.version });
        }

        
        const badges = [
            ...(packageInfo.isWorkspaceRoot ? ['<span class="badge">Workspace Root</span>'] : []),
            ...(packageInfo.isMonorepoRoot ? ['<span class="badge">Monorepo Root</span>'] : [])
        ].join('');

        const propertiesGrid = WebviewUtils.createKeyValueGrid([
            { key: 'Distance', value: `${packageInfo.distance} levels` },
            { key: 'Relevance Score', value: packageInfo.score.toFixed(2) }
        ]);

        
        const scriptsContent = scriptEntries.length > 0
            ? `<div class="grid-2col-start">
                ${scriptEntries.map(([name, command]) => `
                    <div class="script-name">${name}</div>
                    <div class="script-command">${command}</div>
                `).join('')}
            </div>`
            : WebviewUtils.createEmptyState('📝', 'No scripts available in this package.json');

        const sections = [
            {
                title: 'Properties',
                icon: '⚙️',
                content: `
                    ${badges ? `<div class="mb-lg">${badges}</div>` : ''}
                    ${propertiesGrid}
                `
            },
            {
                title: `Scripts${scriptEntries.length > 0 ? ` (${scriptEntries.length})` : ''}`,
                icon: '🔧',
                content: scriptsContent
            }
        ];

        const additionalCSS = `
            .script-name {
                font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
                color: var(--vscode-textLink-foreground, var(--vscode-button-background));
                font-weight: 600;
                font-size: 13px;
                padding: 6px 8px;
                background: var(--vscode-textCodeBlock-background, var(--vscode-editor-selectionBackground, rgba(128, 128, 128, 0.1)));
                border-radius: 4px;
                border-left: 3px solid var(--vscode-textLink-foreground, var(--vscode-button-background));
            }

            .script-command {
                font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
                background: var(--vscode-textBlockQuote-background, var(--vscode-editor-background));
                color: var(--vscode-foreground);
                padding: 6px 8px;
                border-radius: 4px;
                border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, rgba(128, 128, 128, 0.35)));
                font-size: 12px;
                word-break: break-all;
            }

            .header-info {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 16px 24px;
                margin-top: 16px;
            }

            .header-info .text-label {
                font-weight: 600;
                color: var(--vscode-textPreformat-foreground, var(--vscode-foreground));
                font-size: 13px;
            }

            .header-info .code {
                color: var(--vscode-foreground);
                font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
                font-size: 12px;
                background: var(--vscode-textCodeBlock-background, var(--vscode-editor-selectionBackground, rgba(128, 128, 128, 0.1)));
                padding: 2px 6px;
                border-radius: 3px;
                word-break: break-all;
            }
        `;

        const content = `
            <div class="container">
                <div class="header">
                    <h2 class="header-title">
                        📦 ${packageInfo.name || 'Unnamed Package'}
                    </h2>
                    <div class="header-info">
                        ${headerInfo.map(item => `
                            <span class="text-label">${item.key}:</span>
                            <span class="code">${item.value}</span>
                        `).join('')}
                    </div>
                </div>
                ${sections.map(section => `
                    <div class="section">
                        <h3 class="section-title">
                            <span style="margin-right: 8px;">${section.icon}</span>
                            ${section.title}
                        </h3>
                        ${section.content}
                    </div>
                `).join('')}
            </div>
        `;

        return WebviewUtils.createWebviewHTML({
            title: 'Package Information',
            content,
            additionalCSS
        });
    }
}

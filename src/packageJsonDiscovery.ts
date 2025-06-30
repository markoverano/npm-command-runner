import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface PackageJsonInfo {
    path: string;
    directory: string;
    name?: string;
    version?: string;
    scripts?: { [key: string]: string };
    isWorkspaceRoot?: boolean;
    isMonorepoRoot?: boolean;
    workspaces?: string[] | { packages: string[] };
    distance: number; 
    score: number; 
}

export interface DiscoveryOptions {
    maxDepthUp?: number;
    maxDepthDown?: number;
    includeNodeModules?: boolean;
    workspaceRootsOnly?: boolean;
    cacheResults?: boolean;
}

export class PackageJsonDiscoveryService {
    private static readonly DEFAULT_OPTIONS: Required<DiscoveryOptions> = {
        maxDepthUp: 10,
        maxDepthDown: 5,
        includeNodeModules: false,
        workspaceRootsOnly: false,
        cacheResults: true
    };

    private cache = new Map<string, PackageJsonInfo[]>();
    private workspaceRoots: string[] = [];

    constructor() {
        this.initializeWorkspaceRoots();
        this.setupWorkspaceWatcher();
    }

    /**
     * Initialize workspace roots from VS Code workspace folders
     */
    private initializeWorkspaceRoots(): void {
        this.workspaceRoots = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) || [];
    }

    /**
     * Set up file system watcher to invalidate cache when package.json files change
     */
    private setupWorkspaceWatcher(): void {
        const watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
        
        watcher.onDidCreate(() => this.clearCache());
        watcher.onDidDelete(() => this.clearCache());
        watcher.onDidChange(() => this.clearCache());
    }

    /**
     * Clear the discovery cache
     */
    public clearCache(): void {
        this.cache.clear();
    }

    /**
     * Discover package.json files from a starting directory
     */
    public async discoverPackageJsonFiles(
        startPath: string, 
        options: DiscoveryOptions = {}
    ): Promise<PackageJsonInfo[]> {
        const opts = { ...PackageJsonDiscoveryService.DEFAULT_OPTIONS, ...options };
        const cacheKey = `${startPath}:${JSON.stringify(opts)}`;

        
        if (opts.cacheResults && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const results: PackageJsonInfo[] = [];
        const visited = new Set<string>();

        
        await this.searchUpward(startPath, opts.maxDepthUp, results, visited, opts);

        
        await this.searchDownward(startPath, opts.maxDepthDown, results, visited, opts, 0);

        
        this.calculateScores(results, startPath);
        results.sort((a, b) => b.score - a.score);

        
        if (opts.cacheResults) {
            this.cache.set(cacheKey, results);
        }

        return results;
    }

    /**
     * Search upward in the directory tree
     */
    private async searchUpward(
        currentPath: string,
        maxDepth: number,
        results: PackageJsonInfo[],
        visited: Set<string>,
        options: Required<DiscoveryOptions>,
        depth: number = 0
    ): Promise<void> {
        if (depth > maxDepth || visited.has(currentPath)) {
            return;
        }

        visited.add(currentPath);

        
        const packageJsonPath = path.join(currentPath, 'package.json');
        if (await this.fileExists(packageJsonPath)) {
            const info = await this.parsePackageJson(packageJsonPath, depth);
            if (info) {
                results.push(info);
            }
        }

        
        const parentPath = path.dirname(currentPath);
        if (parentPath !== currentPath) {
            await this.searchUpward(parentPath, maxDepth, results, visited, options, depth + 1);
        }
    }

    /**
     * Search downward in the directory tree
     */
    private async searchDownward(
        currentPath: string,
        maxDepth: number,
        results: PackageJsonInfo[],
        visited: Set<string>,
        options: Required<DiscoveryOptions>,
        depth: number
    ): Promise<void> {
        if (depth > maxDepth || visited.has(currentPath)) {
            return;
        }

        visited.add(currentPath);

        
        const packageJsonPath = path.join(currentPath, 'package.json');
        if (await this.fileExists(packageJsonPath)) {
            const info = await this.parsePackageJson(packageJsonPath, depth);
            if (info) {
                results.push(info);
            }
        }

        
        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                
                if (!options.includeNodeModules && entry.name === 'node_modules') {
                    continue;
                }

                
                if (this.shouldSkipDirectory(entry.name)) {
                    continue;
                }

                const subPath = path.join(currentPath, entry.name);
                await this.searchDownward(subPath, maxDepth, results, visited, options, depth + 1);
            }
        } catch (error) {
            
        }
    }

    /**
     * Check if a file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Determine if a directory should be skipped during search
     */
    private shouldSkipDirectory(dirName: string): boolean {
        const skipDirs = [
            '.git', '.svn', '.hg',
            '.vscode', '.idea',
            'dist', 'build', 'out',
            '.next', '.nuxt',
            'coverage', '.nyc_output',
            'tmp', 'temp',
            '__pycache__', '.pytest_cache'
        ];
        
        return dirName.startsWith('.') && !dirName.startsWith('..') || skipDirs.includes(dirName);
    }

    /**
     * Parse package.json file and extract relevant information
     */
    public async parsePackageJson(packageJsonPath: string, distance: number): Promise<PackageJsonInfo | null> {
        try {
            const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(content);
            
            const directory = path.dirname(packageJsonPath);
            const isWorkspaceRoot = this.workspaceRoots.includes(directory);
            const isMonorepoRoot = !!(packageJson.workspaces);

            return {
                path: packageJsonPath,
                directory,
                name: packageJson.name,
                version: packageJson.version,
                scripts: packageJson.scripts || {},
                isWorkspaceRoot,
                isMonorepoRoot,
                workspaces: packageJson.workspaces,
                distance,
                score: 0 
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Calculate relevance scores for discovered package.json files
     */
    private calculateScores(results: PackageJsonInfo[], startPath: string): void {
        
        const hasPackageJsonAtStartPath = results.some(info => info.directory === startPath && info.distance === 0);

        for (const info of results) {
            let score = 0;

            
            score += Math.max(0, 100 - (info.distance * 10));

            
            if (info.isWorkspaceRoot) {
                score += 50;
            }

            
            if (info.isMonorepoRoot) {
                score += 30;
            }

            
            if (info.scripts && Object.keys(info.scripts).length > 0) {
                score += 20;
            }

            
            if (info.scripts) {
                const commonScripts = ['start', 'dev', 'build', 'test', 'lint'];
                const hasCommonScripts = commonScripts.some(script => info.scripts![script]);
                if (hasCommonScripts) {
                    score += 15;
                }
            }

            
            if (info.directory === startPath) {
                score += 25;
            }

            
            if (!hasPackageJsonAtStartPath && info.distance === 1) {
                score += 40; 
            }

            info.score = score;
        }
    }

    /**
     * Get the most relevant package.json file for a given path
     */
    public async getBestPackageJson(startPath: string, options?: DiscoveryOptions): Promise<PackageJsonInfo | null> {
        const opts = { ...PackageJsonDiscoveryService.DEFAULT_OPTIONS, ...options };
        let results = await this.discoverPackageJsonFiles(startPath, opts);

        
        const hasPackageJsonAtStartPath = results.some(info => info.directory === startPath);

        
        
        if (!hasPackageJsonAtStartPath && opts.maxDepthDown > 0) {
            const childResults = await this.discoverPackageJsonFiles(startPath, {
                ...opts,
                maxDepthUp: 0, 
                maxDepthDown: Math.min(opts.maxDepthDown, 2), 
                cacheResults: false 
            });

            
            results.push(...childResults);
            this.calculateScores(results, startPath); 
            results.sort((a, b) => b.score - a.score);
        }

        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get all workspace package.json files
     */
    public async getWorkspacePackageJsonFiles(): Promise<PackageJsonInfo[]> {
        const allResults: PackageJsonInfo[] = [];

        for (const workspaceRoot of this.workspaceRoots) {
            const results = await this.discoverPackageJsonFiles(workspaceRoot, {
                maxDepthUp: 0, 
                maxDepthDown: 10
            });
            allResults.push(...results);
        }

        
        const uniqueResults = allResults.filter((item, index, arr) =>
            arr.findIndex(other => other.path === item.path) === index
        );

        return uniqueResults.sort((a, b) => b.score - a.score);
    }

    /**
     * Find package.json files in a specific directory and its immediate children
     */
    public async findPackageJsonInDirectory(dirPath: string): Promise<PackageJsonInfo[]> {
        return this.discoverPackageJsonFiles(dirPath, {
            maxDepthUp: 0,
            maxDepthDown: 1,
            cacheResults: false
        });
    }

    /**
     * Find the nearest parent package.json file
     */
    public async findNearestParentPackageJson(startPath: string): Promise<PackageJsonInfo | null> {
        const results = await this.discoverPackageJsonFiles(startPath, {
            maxDepthUp: 10,
            maxDepthDown: 0,
            cacheResults: false
        });

        
        return results.length > 0 ? results.reduce((closest, current) =>
            current.distance < closest.distance ? current : closest
        ) : null;
    }

    /**
     * Find all child package.json files (useful for monorepos)
     */
    public async findChildPackageJsonFiles(startPath: string, maxDepth: number = 5): Promise<PackageJsonInfo[]> {
        return this.discoverPackageJsonFiles(startPath, {
            maxDepthUp: 0,
            maxDepthDown: maxDepth,
            cacheResults: false
        });
    }

    /**
     * Get package.json files within a specific distance range
     */
    public async getPackageJsonByDistance(
        startPath: string,
        minDistance: number = 0,
        maxDistance: number = 5
    ): Promise<PackageJsonInfo[]> {
        const allResults = await this.discoverPackageJsonFiles(startPath);
        return allResults.filter(info =>
            info.distance >= minDistance && info.distance <= maxDistance
        );
    }

    /**
     * Check if a directory is within a workspace
     */
    public isWithinWorkspace(dirPath: string): boolean {
        return this.workspaceRoots.some(root =>
            dirPath.startsWith(root) || root.startsWith(dirPath)
        );
    }

    /**
     * Get workspace root for a given path
     */
    public getWorkspaceRoot(filePath: string): string | null {
        for (const root of this.workspaceRoots) {
            if (filePath.startsWith(root)) {
                return root;
            }
        }
        return null;
    }

    /**
     * Refresh workspace roots (useful when workspace changes)
     */
    public refreshWorkspaceRoots(): void {
        this.initializeWorkspaceRoots();
        this.clearCache();
    }
}

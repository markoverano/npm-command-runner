import * as vscode from 'vscode';
import * as path from 'path';
import { PackageJsonDiscoveryService, PackageJsonInfo } from './packageJsonDiscovery';

export interface ProjectContext {
    type: 'monorepo' | 'single-package' | 'workspace' | 'nested';
    rootPackageJson?: PackageJsonInfo;
    relevantPackageJsons: PackageJsonInfo[];
    workspaceRoot: string;
    currentPath: string;
    recommendations: string[];
}

export interface SmartDetectionOptions {
    includeParentProjects?: boolean;
    prioritizeWorkspaceRoots?: boolean;
    detectMonorepos?: boolean;
    analyzeProjectStructure?: boolean;
}

export class SmartDetectionService {
    private discoveryService: PackageJsonDiscoveryService;
    private projectStructurePatterns: Map<string, string[]> = new Map();

    constructor(discoveryService: PackageJsonDiscoveryService) {
        this.discoveryService = discoveryService;
        this.initializeProjectPatterns();
    }

    /**
     * Initialize common project structure patterns
     */
    private initializeProjectPatterns(): void {
        this.projectStructurePatterns = new Map([
            ['react', ['src', 'public', 'package.json', 'node_modules']],
            ['vue', ['src', 'public', 'package.json', 'vue.config.js']],
            ['angular', ['src', 'angular.json', 'package.json', 'node_modules']],
            ['next', ['pages', 'package.json', 'next.config.js']],
            ['nuxt', ['pages', 'package.json', 'nuxt.config.js']],
            ['express', ['package.json', 'server.js', 'app.js']],
            ['nest', ['src', 'package.json', 'nest-cli.json']],
            ['lerna', ['lerna.json', 'package.json', 'packages']],
            ['nx', ['nx.json', 'package.json', 'apps', 'libs']],
            ['rush', ['rush.json', 'package.json', 'apps']],
            ['yarn-workspace', ['package.json', 'yarn.lock', 'packages']],
            ['npm-workspace', ['package.json', 'package-lock.json', 'packages']]
        ]);
    }

    /**
     * Analyze project context for a given path
     */
    public async analyzeProjectContext(
        currentPath: string, 
        options: SmartDetectionOptions = {}
    ): Promise<ProjectContext> {
        const opts = {
            includeParentProjects: true,
            prioritizeWorkspaceRoots: true,
            detectMonorepos: true,
            analyzeProjectStructure: true,
            ...options
        };

        
        const allPackageJsons = await this.discoveryService.discoverPackageJsonFiles(currentPath, {
            maxDepthUp: opts.includeParentProjects ? 10 : 0,
            maxDepthDown: 5
        });

        
        const workspaceRoot = this.discoveryService.getWorkspaceRoot(currentPath) || currentPath;

        
        const relevantPackageJsons = this.filterRelevantPackageJsons(allPackageJsons, currentPath, opts);

        
        const projectType = this.detectProjectType(relevantPackageJsons, workspaceRoot);
        const rootPackageJson = this.findRootPackageJson(relevantPackageJsons, workspaceRoot, projectType);

        
        const recommendations = await this.generateRecommendations(
            relevantPackageJsons, 
            currentPath, 
            projectType
        );

        return {
            type: projectType,
            rootPackageJson,
            relevantPackageJsons,
            workspaceRoot,
            currentPath,
            recommendations
        };
    }

    /**
     * Filter package.json files based on relevance and options
     */
    private filterRelevantPackageJsons(
        allPackageJsons: PackageJsonInfo[], 
        currentPath: string, 
        options: SmartDetectionOptions
    ): PackageJsonInfo[] {
        let filtered = [...allPackageJsons];

        
        if (options.prioritizeWorkspaceRoots) {
            filtered.forEach(pkg => {
                if (pkg.isWorkspaceRoot) {
                    pkg.score += 100;
                }
            });
        }

        
        filtered = filtered.filter(pkg => {
            
            if (pkg.isWorkspaceRoot) return true;
            
            
            if (pkg.distance <= 3) return true;
            
            
            if (pkg.isMonorepoRoot) return true;
            
            
            if (pkg.scripts && Object.keys(pkg.scripts).length >= 5) return true;
            
            return false;
        });

        
        filtered.sort((a, b) => b.score - a.score);

        return filtered;
    }

    /**
     * Detect the type of project structure
     */
    private detectProjectType(
        packageJsons: PackageJsonInfo[], 
        workspaceRoot: string
    ): 'monorepo' | 'single-package' | 'workspace' | 'nested' {
        
        const hasMonorepoRoot = packageJsons.some(pkg => pkg.isMonorepoRoot);
        if (hasMonorepoRoot) {
            return 'monorepo';
        }

        
        if (packageJsons.length > 1) {
            
            const hasWorkspaceRoots = packageJsons.some(pkg => pkg.isWorkspaceRoot);
            if (hasWorkspaceRoots) {
                return 'workspace';
            }
            return 'nested';
        }

        return 'single-package';
    }

    /**
     * Find the most appropriate root package.json
     */
    private findRootPackageJson(
        packageJsons: PackageJsonInfo[], 
        workspaceRoot: string, 
        projectType: string
    ): PackageJsonInfo | undefined {
        if (packageJsons.length === 0) return undefined;

        
        if (projectType === 'monorepo') {
            const monorepoRoot = packageJsons.find(pkg => pkg.isMonorepoRoot);
            if (monorepoRoot) return monorepoRoot;
        }

        
        if (projectType === 'workspace') {
            const workspaceRootPkg = packageJsons.find(pkg => pkg.isWorkspaceRoot);
            if (workspaceRootPkg) return workspaceRootPkg;
        }

        
        return packageJsons[0];
    }

    /**
     * Generate intelligent recommendations based on project analysis
     */
    private async generateRecommendations(
        packageJsons: PackageJsonInfo[], 
        currentPath: string, 
        projectType: string
    ): Promise<string[]> {
        const recommendations: string[] = [];

        if (packageJsons.length === 0) {
            recommendations.push('No package.json files found. Consider initializing a new npm project.');
            return recommendations;
        }

        
        const projectStructure = await this.analyzeProjectStructure(currentPath);
        
        
        switch (projectType) {
            case 'monorepo':
                recommendations.push('Monorepo detected. Consider using workspace-specific commands.');
                if (packageJsons.length > 3) {
                    recommendations.push('Multiple packages found. Use package selection for targeted operations.');
                }
                break;
                
            case 'workspace':
                recommendations.push('VS Code workspace detected. Commands will be scoped to workspace boundaries.');
                break;
                
            case 'nested':
                recommendations.push('Nested package structure detected. Select the appropriate package.json for your task.');
                break;
                
            case 'single-package':
                recommendations.push('Single package project detected.');
                break;
        }

        
        const allScripts = new Set<string>();
        packageJsons.forEach(pkg => {
            if (pkg.scripts) {
                Object.keys(pkg.scripts).forEach(script => allScripts.add(script));
            }
        });

        if (allScripts.has('dev') || allScripts.has('start')) {
            recommendations.push('Development scripts available. Use "dev" or "start" to run the project.');
        }

        if (allScripts.has('build')) {
            recommendations.push('Build script available. Use "build" for production builds.');
        }

        if (allScripts.has('test')) {
            recommendations.push('Test script available. Use "test" to run tests.');
        }

        
        if (projectStructure.includes('react')) {
            recommendations.push('React project detected. Common commands: start, build, test.');
        }

        if (projectStructure.includes('next')) {
            recommendations.push('Next.js project detected. Common commands: dev, build, start.');
        }

        return recommendations;
    }

    /**
     * Analyze project structure to detect frameworks and tools
     */
    private async analyzeProjectStructure(currentPath: string): Promise<string[]> {
        const detectedPatterns: string[] = [];

        for (const [pattern, files] of this.projectStructurePatterns) {
            let matchCount = 0;
            
            for (const file of files) {
                const filePath = path.join(currentPath, file);
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    matchCount++;
                } catch {
                    
                }
            }

            
            if (matchCount >= Math.ceil(files.length * 0.6)) {
                detectedPatterns.push(pattern);
            }
        }

        return detectedPatterns;
    }

    /**
     * Get context-aware package.json recommendations
     */
    public async getContextualRecommendations(currentPath: string): Promise<PackageJsonInfo[]> {
        const context = await this.analyzeProjectContext(currentPath);
        
        
        switch (context.type) {
            case 'monorepo':
                
                return context.relevantPackageJsons.slice(0, 5);
                
            case 'workspace':
                
                return context.relevantPackageJsons.filter(pkg => 
                    pkg.isWorkspaceRoot || pkg.distance <= 2
                );
                
            default:
                
                return context.relevantPackageJsons.slice(0, 3);
        }
    }

    /**
     * Check if current context suggests using a specific package.json
     */
    public async shouldUseSpecificPackageJson(currentPath: string): Promise<PackageJsonInfo | null> {
        const context = await this.analyzeProjectContext(currentPath);
        
        
        if (context.relevantPackageJsons.length === 1) {
            return context.relevantPackageJsons[0];
        }

        
        if (context.relevantPackageJsons.length > 1) {
            const [first, second] = context.relevantPackageJsons;
            if (first.score > second.score * 1.5) {
                return first;
            }
        }

        return null;
    }
}

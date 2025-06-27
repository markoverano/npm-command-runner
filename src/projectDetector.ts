
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_FILES = [
    'package.json',
    'requirements.txt',
    'Cargo.toml',
    'pom.xml', 
    'build.gradle', 
    'CMakeLists.txt', 
    'go.mod', 
    'pyproject.toml', 
    '.git' 
];

interface ProjectInfo {
    path: string;
    name: string;
    score: number; 
}

export class ProjectDetector {

    /**
     * Checks if a given directory is a project directory by looking for common project files.
     * Returns a score based on how many project files are found.
     */
    private static async isProjectDirectory(dirPath: string): Promise<number> {
        let score = 0;
        for (const file of PROJECT_FILES) {
            try {
                const filePath = path.join(dirPath, file);
                await fs.promises.access(filePath, fs.constants.F_OK);
                score++;
            } catch (error) {
                
            }
        }
        return score;
    }

    /**
     * Finds the most appropriate project directory within a given root path.
     * It prioritizes the root itself if it's a project, then direct subdirectories.
     */
    public static async detectProjectDirectory(rootPath: string): Promise<string | undefined> {
        const projects: ProjectInfo[] = [];

        
        const rootScore = await ProjectDetector.isProjectDirectory(rootPath);
        if (rootScore > 0) {
            projects.push({ path: rootPath, name: path.basename(rootPath), score: rootScore });
        }

        
        try {
            const subdirs = await fs.promises.readdir(rootPath, { withFileTypes: true });
            for (const dirent of subdirs) {
                if (dirent.isDirectory()) {
                    const subDirPath = path.join(rootPath, dirent.name);
                    const subDirScore = await ProjectDetector.isProjectDirectory(subDirPath);
                    if (subDirScore > 0) {
                        projects.push({ path: subDirPath, name: dirent.name, score: subDirScore });
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${rootPath}:`, error);
        }

        if (projects.length === 0) {
            return undefined; 
        }

        
        
        projects.sort((a, b) => {
            if (a.score !== b.score) {
                return b.score - a.score; 
            }
            
            if (a.path === rootPath) return -1;
            if (b.path === rootPath) return 1;
            return 0; 
        });

        
        const topScore = projects[0].score;
        const topProjects = projects.filter(p => p.score === topScore);

        if (topProjects.length === 1) {
            return topProjects[0].path;
        } else if (topProjects.length > 1) {
            
            const quickPickItems = topProjects.map(p => ({
                label: p.name,
                description: p.path,
                projectPath: p.path
            }));

            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Multiple project directories found. Please select one:',
                canPickMany: false
            });

            return selected?.projectPath;
        }

        return undefined; 
    }
}

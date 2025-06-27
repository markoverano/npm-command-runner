import * as vscode from 'vscode';
import { PackageJsonInfo } from './packageJsonDiscovery';
import * as path from 'path';

export class PackageJsonStatusBar {
    private _statusBarItem: vscode.StatusBarItem;

    constructor() {
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.updateStatus(null); 
        this._statusBarItem.show();
    }

    public updateStatus(packageJsonInfo: PackageJsonInfo | null): void {
        if (packageJsonInfo) {
            
            this._statusBarItem.hide();
        } else {
            
            this._statusBarItem.text = "$(warning) No package.json found";
            this._statusBarItem.tooltip = "No package.json file could be automatically detected or selected.";
            this._statusBarItem.command = "command-runner.selectPackageJson"; 
            this._statusBarItem.show();
        }
    }

    public dispose(): void {
        this._statusBarItem.dispose();
    }
}

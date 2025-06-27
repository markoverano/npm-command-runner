import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Utility functions for creating consistent webview content
 */
export class WebviewUtils {
    /**
     * Get the shared CSS content for webviews
     */
    private static getSharedCSS(context?: vscode.ExtensionContext): string {
        try {
            if (context) {
                const cssPath = path.join(context.extensionPath, 'media', 'webview-styles.css');
                if (fs.existsSync(cssPath)) {
                    return fs.readFileSync(cssPath, 'utf8');
                }
            }
        } catch (error) {
            console.warn('Could not load shared CSS file:', error);
        }

        
        return `
            :root {
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 12px;
                --spacing-lg: 16px;
                --spacing-xl: 20px;
                --spacing-2xl: 24px;
                --spacing-3xl: 32px;
                --radius-sm: 3px;
                --radius-md: 4px;
                --radius-lg: 6px;
                --transition-fast: 0.15s ease-in-out;
            }
            
            .webview-body {
                font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
                font-size: var(--vscode-font-size, 13px);
                line-height: 1.5;
                padding: var(--spacing-2xl);
                margin: 0;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                min-height: 100vh;
                box-sizing: border-box;
            }
            
            .container { max-width: 800px; margin: 0 auto; }
            .container-narrow { max-width: 480px; margin: 0 auto; }
        `;
    }

    /**
     * Create a basic webview HTML template with shared styles
     */
    public static createWebviewHTML(options: {
        title: string;
        content: string;
        additionalCSS?: string;
        additionalJS?: string;
        context?: vscode.ExtensionContext;
    }): string {
        const { title, content, additionalCSS = '', additionalJS = '', context } = options;
        const sharedCSS = this.getSharedCSS(context);

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    ${sharedCSS}
                    ${additionalCSS}
                </style>
            </head>
            <body class="webview-body">
                ${content}
                ${additionalJS ? `<script>${additionalJS}</script>` : ''}
            </body>
            </html>
        `;
    }

    /**
     * Create a form webview with consistent styling
     */
    public static createFormWebview(options: {
        title: string;
        subtitle?: string;
        formId: string;
        fields: Array<{
            id: string;
            name: string;
            label: string;
            description?: string;
            placeholder?: string;
            required?: boolean;
            type?: string;
        }>;
        submitButtonText?: string;
        showCancelButton?: boolean;
        onSubmitJS?: string;
        context?: vscode.ExtensionContext;
    }): string {
        const {
            title,
            subtitle,
            formId,
            fields,
            submitButtonText = 'Submit',
            showCancelButton = true,
            onSubmitJS = '',
            context
        } = options;

        const fieldsHTML = fields.map(field => `
            <div class="form-group">
                <label for="${field.id}" class="form-label">
                    ${field.label}
                    ${field.description ? `<div class="form-label-description">${field.description}</div>` : ''}
                </label>
                <input 
                    type="${field.type || 'text'}" 
                    id="${field.id}" 
                    name="${field.name}" 
                    class="form-input"
                    ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                    ${field.required ? 'required' : ''}
                >
            </div>
        `).join('');

        const content = `
            <div class="container-narrow">
                <div class="header">
                    <h1 class="header-title">${title}</h1>
                    ${subtitle ? `<p class="header-subtitle">${subtitle}</p>` : ''}
                </div>
                
                <form id="${formId}">
                    ${fieldsHTML}
                    
                    <div class="button-container">
                        ${showCancelButton ? '<button type="button" class="button button-secondary" onclick="window.close()">Cancel</button>' : ''}
                        <button type="submit" class="button">${submitButtonText}</button>
                    </div>
                </form>
            </div>
        `;

        const defaultJS = `
            const vscode = acquireVsCodeApi();
            document.getElementById('${formId}').addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                vscode.postMessage({
                    command: 'formSubmit',
                    formId: '${formId}',
                    data: data
                });
                ${onSubmitJS}
            });
        `;

        return this.createWebviewHTML({
            title,
            content,
            additionalJS: defaultJS,
            context
        });
    }

    /**
     * Create an info display webview with consistent styling
     */
    public static createInfoWebview(options: {
        title: string;
        icon?: string;
        sections: Array<{
            title: string;
            icon?: string;
            content: string;
            className?: string;
        }>;
        context?: vscode.ExtensionContext;
    }): string {
        const { title, icon, sections, context } = options;

        const sectionsHTML = sections.map(section => `
            <div class="section ${section.className || ''}">
                <h3 class="section-title">
                    ${section.icon ? `<span style="margin-right: 8px;">${section.icon}</span>` : ''}
                    ${section.title}
                </h3>
                ${section.content}
            </div>
        `).join('');

        const content = `
            <div class="container">
                <div class="header">
                    <h2 class="header-title">
                        ${icon ? `<span style="margin-right: 8px;">${icon}</span>` : ''}
                        ${title}
                    </h2>
                </div>
                ${sectionsHTML}
            </div>
        `;

        return this.createWebviewHTML({
            title,
            content,
            context
        });
    }

    /**
     * Create a grid layout for key-value pairs
     */
    public static createKeyValueGrid(items: Array<{ key: string; value: string; valueClass?: string }>): string {
        return `
            <div class="grid-2col">
                ${items.map(item => `
                    <span class="text-label">${item.key}:</span>
                    <span class="${item.valueClass || 'code'}">${item.value}</span>
                `).join('')}
            </div>
        `;
    }

    /**
     * Create an empty state display
     */
    public static createEmptyState(icon: string, message: string): string {
        return `
            <div class="empty-state">
                <span class="empty-state-icon">${icon}</span>
                ${message}
            </div>
        `;
    }
}

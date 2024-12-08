import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const snapshotService = new SnapshotService();
    
    // Initialize snapshot directory on activation
    snapshotService.initializeSnapshotDirectory();

    // Register the create snapshot command
    let disposable = vscode.commands.registerCommand('snapshots-for-ai.createSnapshot', async () => {
        const snapshotDialog = new SnapshotDialog();
        const result = await snapshotDialog.show();
        
        if (result) {
            const { prompt, includeEntireProjectStructure, includeAllFiles, selectedFiles } = result;
            await snapshotService.createSnapshot(prompt, includeEntireProjectStructure, includeAllFiles, selectedFiles);
        }
    });

    context.subscriptions.push(disposable);
}

class SnapshotService {
    private getWorkspaceRoot(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }
        return workspaceFolders[0].uri.fsPath;
    }

    async initializeSnapshotDirectory(): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot();
        const snapshotsDir = path.join(workspaceRoot, '.snapshots');

        // Create snapshots directory if it doesn't exist
        if (!fs.existsSync(snapshotsDir)) {
            fs.mkdirSync(snapshotsDir);
        }

        // Copy default files from resources
        const defaultFiles = ['config.json', 'readme.md', 'sponsors.md'];
        for (const file of defaultFiles) {
            const targetPath = path.join(snapshotsDir, file);
            if (!fs.existsSync(targetPath)) {
                const defaultContent = this.getDefaultFileContent(file);
                fs.writeFileSync(targetPath, defaultContent);
            }
        }
    }

    private getDefaultFileContent(fileName: string): string {
        const resourcePath = path.join(__dirname, '..', 'resources', fileName);
        if (!fs.existsSync(resourcePath)) {
            throw new Error(`Resource file ${fileName} not found in resources directory. This is required for the extension to work properly.`);
        }
        return fs.readFileSync(resourcePath, 'utf8');
    }

    async createSnapshot(
        prompt: string,
        includeEntireProjectStructure: boolean,
        includeAllFiles: boolean,
        selectedFiles: vscode.Uri[]
    ): Promise<void> {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
            const fileName = `snapshot-${timestamp}.md`;
            const snapshotPath = path.join(workspaceRoot, '.snapshots', fileName);

            let content = `${prompt}\n\n`;

            if (includeEntireProjectStructure) {
                content += '# Project Structure\n\n';
                content += await this.generateProjectStructure();
                content += '\n\n';
            }

            content += '# Project Files\n\n';
            
            // Get all files or use selected files based on includeAllFiles flag
            const files = includeAllFiles ? 
                await this.getAllProjectFiles() : 
                selectedFiles.map(uri => uri.fsPath);

            // Add relative paths to the content
            for (const file of files) {
                const relativePath = path.relative(workspaceRoot, file);
                content += `- ${relativePath}\n`;
            }
            content += '\n';

            // Read and add file contents
            for (const file of files) {
                if (this.isTextFile(file)) {
                    try {
                        const relativePath = path.relative(workspaceRoot, file);
                        const absolutePath = path.resolve(workspaceRoot, relativePath);
                        
                        // Skip if file doesn't exist or can't be read
                        if (!fs.existsSync(absolutePath)) {
                            console.warn(`File not found: ${absolutePath}`);
                            continue;
                        }

                        content += `## ${relativePath}\n\`\`\`\n`;
                        content += fs.readFileSync(absolutePath, 'utf8');
                        content += '\n\`\`\`\n\n';
                    } catch (error) {
                        console.error(`Error reading file ${file}:`, error);
                        content += `## ${path.relative(workspaceRoot, file)}\nError reading file: ${(error as Error).message}\n\n`;
                    }
                }
            }

            // Ensure the .snapshots directory exists
            const snapshotsDir = path.dirname(snapshotPath);
            if (!fs.existsSync(snapshotsDir)) {
                fs.mkdirSync(snapshotsDir, { recursive: true });
            }

            fs.writeFileSync(snapshotPath, content);

            const uri = vscode.Uri.file(snapshotPath);
            await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(uri);

            vscode.window.showInformationMessage('Snapshot created successfully!');
        } catch (error) {
            console.error('Error creating snapshot:', error);
            vscode.window.showErrorMessage('Error creating snapshot: ' + (error as Error).message);
        }
    }

    private async getAllProjectFiles(): Promise<string[]> {
        const workspaceRoot = this.getWorkspaceRoot();
        const config = this.readConfig();
        
        // Use workspace.findFiles for better performance and to respect VS Code's search exclude settings
        const files = await vscode.workspace.findFiles('**/*', null);
        
        return files
            .map(file => file.fsPath)
            .filter(file => {
                const relativePath = path.relative(workspaceRoot, file);
                // Only check excluded patterns - we want all non-excluded files
                return !this.isExcluded(relativePath, config.excluded_patterns);
            });
    }

    private readConfig(): { excluded_patterns: string[]; included_patterns: string[] } {
        const workspaceRoot = this.getWorkspaceRoot();
        const configPath = path.join(workspaceRoot, '.snapshots', 'config.json');
        const configContent = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configContent) as {
            excluded_patterns: string[];
            included_patterns: string[];
        };
    }

    private isExcluded(filePath: string, patterns: string[]): boolean {
        return patterns.some(pattern => 
            new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(filePath)
        );
    }

    private isIncluded(filePath: string, patterns: string[]): boolean {
        if (patterns.length === 0) return true;
        return patterns.some(pattern => 
            new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(filePath)
        );
    }

    private isTextFile(filePath: string): boolean {
        const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];
        const ext = path.extname(filePath).toLowerCase();
        return !binaryExtensions.includes(ext) || ext === '.svg';
    }

    private async generateProjectStructure(): Promise<string> {
        const workspaceRoot = this.getWorkspaceRoot();
        
        // Get all files including directories
        const allFiles = await vscode.workspace.findFiles('**/*', null);
        const config = this.readConfig();
        
        // Create a tree structure
        const tree: Record<string, any> = {};
        
        // First, add all directories to ensure complete structure
        const processedDirs = new Set<string>();
        
        for (const file of allFiles) {
            const relativePath = path.relative(workspaceRoot, file.fsPath);
            
            // Skip excluded files and patterns
            if (this.isExcluded(relativePath, config.excluded_patterns)) {
                continue;
            }
            
            // Process all parent directories
            let currentPath = path.dirname(relativePath);
            while (currentPath && currentPath !== '.' && !processedDirs.has(currentPath)) {
                processedDirs.add(currentPath);
                let current = tree;
                const parts = currentPath.split(path.sep);
                
                for (const part of parts) {
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part];
                }
                currentPath = path.dirname(currentPath);
            }
            
            // Add the file itself
            let current = tree;
            const parts = relativePath.split(path.sep);
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    // It's a file
                    current[part] = null;
                } else {
                    // It's a directory
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part];
                }
            }
        }
        
        return this.formatProjectStructure(tree);
    }

    private formatProjectStructure(tree: Record<string, any>, level: number = 0): string {
        let result = '';
        const indent = '  '.repeat(level);
        
        // Sort entries: directories (objects) first, then files (null)
        const entries = Object.entries(tree).sort(([, a], [, b]) => {
            if (a === null && b === null) return 0;
            if (a === null) return 1;
            if (b === null) return -1;
            return 0;
        });

        for (const [name, subtree] of entries) {
            if (subtree === null) {
                // File
                result += `${indent}└─ ${name}\n`;
            } else {
                // Directory
                result += `${indent}├─ 📁 ${name}\n`;
                result += this.formatProjectStructure(subtree, level + 1);
            }
        }
        
        return result;
    }
}

class SnapshotDialog {
    private config: any;
    private panel: vscode.WebviewPanel | undefined;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private editorListener: vscode.Disposable | undefined;
    private activeEditors: Set<string> = new Set();

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }

        const configPath = path.join(workspaceFolders[0].uri.fsPath, '.snapshots', 'config.json');
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Initialize active editors
        this.updateActiveEditors();
        
        // Watch for both active and visible editor changes
        this.editorListener = vscode.Disposable.from(
            vscode.window.onDidChangeActiveTextEditor(() => {
                console.log('Debug: Active editor changed');
                this.updateActiveEditors();
                this.updateFileList();
            }),
            vscode.window.onDidChangeVisibleTextEditors(() => {
                console.log('Debug: Visible editors changed');
                this.updateActiveEditors();
                this.updateFileList();
            })
        );
    }

    private updateActiveEditors() {
        this.activeEditors.clear();
        
        // Add all visible editors
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor.document.uri.scheme === 'file') {
                this.activeEditors.add(editor.document.uri.toString());
                console.log('Debug: Added visible editor:', editor.document.uri.toString());
            }
        });

        // Add active editor if it exists and isn't already included
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.scheme === 'file') {
            this.activeEditors.add(activeEditor.document.uri.toString());
            console.log('Debug: Added active editor:', activeEditor.document.uri.toString());
        }

        console.log('Debug: Current active editors:', Array.from(this.activeEditors));
    }

    private getOpenFiles(): string[] {
        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
        return vscode.workspace.textDocuments
            .filter(doc => {
                // Filter out untitled and non-file documents
                if (doc.isUntitled || doc.uri.scheme !== 'file') {
                    return false;
                }
                
                // Filter out files from .snapshots directory
                const relativePath = path.relative(workspaceRoot, doc.uri.fsPath);
                return !relativePath.startsWith('.snapshots');
            })
            .map(doc => doc.uri.fsPath);
    }

    private async updateFileList() {
        if (this.panel) {
            const files = this.getOpenFiles();
            await this.panel.webview.postMessage({ 
                command: 'updateFiles', 
                files 
            });
        }
    }

    async show(): Promise<{ 
        prompt: string; 
        includeEntireProjectStructure: boolean; 
        includeAllFiles: boolean;
        selectedFiles: vscode.Uri[];
    } | undefined> {
        // Ensure we have the latest state of open editors
        this.updateActiveEditors();
        
        this.panel = vscode.window.createWebviewPanel(
            'snapshotDialog',
            'Create Snapshot',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const initialFiles = this.getOpenFiles();
        const relativeFiles = initialFiles.map(file => path.relative(workspaceRoot, file));
        
        const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                :root {
                    --vscode-button-background: var(--vscode-button-background);
                    --vscode-button-foreground: var(--vscode-button-foreground);
                    --vscode-button-hover-background: var(--vscode-button-hoverBackground);
                    --vscode-input-background: var(--vscode-input-background);
                    --vscode-input-foreground: var(--vscode-input-foreground);
                    --vscode-input-border: var(--vscode-input-border);
                    --secondary-button-background: var(--vscode-button-secondaryBackground);
                    --secondary-button-foreground: var(--vscode-button-secondaryForeground);
                    --secondary-button-hover: var(--vscode-button-secondaryHoverBackground);
                }
                body { 
                    padding: 20px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                    background: var(--vscode-editor-background);
                }
                .form-group { 
                    margin-bottom: 20px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                }
                textarea {
                    width: 100%;
                    min-height: 60px;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 2px;
                    resize: vertical;
                }
                .file-list { 
                    flex: 1;
                    min-height: 100px;
                    max-height: 400px;
                    overflow-y: auto; 
                    border: 1px solid var(--vscode-input-border);
                    padding: 15px;
                    background: var(--vscode-input-background);
                    margin-top: 10px;
                    border-radius: 2px;
                }
                .file-list.hidden { 
                    display: none; 
                }
                .button-row { 
                    display: flex; 
                    justify-content: space-between;
                    margin-top: 20px;
                    gap: 10px;
                }
                .left-buttons, .right-buttons {
                    display: flex;
                    gap: 10px;
                }
                button {
                    padding: 8px 12px;
                    border: none;
                    cursor: pointer;
                    border-radius: 2px;
                    min-width: 80px;
                }
                button.primary {
                    background: #28a745;
                    color: white;
                }
                button.primary:hover {
                    background: #218838;
                }
                button.secondary {
                    background: var(--secondary-button-background);
                    color: var(--secondary-button-foreground);
                }
                button.secondary:hover {
                    background: var(--secondary-button-hover);
                }
                button.cancel {
                    background: #e9ecef;
                    color: #212529;
                }
                button.cancel:hover {
                    background: #dde0e3;
                }
                button.select-all {
                    background: #e9ecef;
                    color: #212529;
                }
                button.select-all:hover {
                    background: #dde0e3;
                }
                input[type="checkbox"] {
                    margin-right: 8px;
                }
                .checkbox-label {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .checkbox-label input[type="checkbox"] {
                    margin-right: 8px;
                }
                .select-all-container {
                    display: flex;
                    justify-content: flex-end;
                    margin-bottom: 10px;
                }
                .file-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
            </style>
        </head>
        <body>
            <div class="form-group">
                <label>Prompt:</label>
                <textarea id="prompt">${this.config.default.default_prompt}</textarea>
            </div>
            
            <div class="form-group">
                <div class="checkbox-label">
                    <input type="checkbox" id="includeStructure" ${this.config.default.default_include_entire_project_structure ? 'checked' : ''}>
                    <label for="includeStructure">Include entire project structure</label>
                </div>
                
                <div class="checkbox-label">
                    <input type="checkbox" id="includeAll" ${this.config.default.default_include_all_files ? 'checked' : ''}>
                    <label for="includeAll">Include all project files</label>
                </div>

                <div id="fileListContainer" class="file-container" ${this.config.default.default_include_all_files ? 'style="display: none;"' : ''}>
                    <div class="select-all-container">
                        <button class="select-all" onclick="toggleSelectAll()">Select/Deselect All</button>
                    </div>
                    <div id="fileList" class="file-list">
                        ${relativeFiles.map(file => 
                            `<div class="checkbox-label"><input type="checkbox" value="${file}" checked>${file}</div>`
                        ).join('')}
                    </div>
                </div>
            </div>

            <div class="button-row">
                <div class="left-buttons">
                    <button class="secondary" onclick="editConfig()">Edit Config</button>
                    <button class="secondary" onclick="openSponsors()">View Sponsors</button>
                </div>
                <div class="right-buttons">
                    <button class="cancel" onclick="cancel()">Cancel</button>
                    <button class="primary" onclick="submit()">CREATE</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentFiles = ${JSON.stringify(relativeFiles)};

                // Add event listener for includeAll checkbox
                document.getElementById('includeAll').addEventListener('change', function() {
                    const fileListContainer = document.getElementById('fileListContainer');
                    fileListContainer.style.display = this.checked ? 'none' : 'block';
                });

                function toggleSelectAll() {
                    const fileList = document.getElementById('fileList');
                    const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
                    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                    checkboxes.forEach(cb => cb.checked = !allChecked);
                }

                function submit() {
                    const includeAll = document.getElementById('includeAll').checked;
                    let selectedFiles = [];
                    
                    // Only get selected files if not including all files
                    if (!includeAll) {
                        const fileList = document.getElementById('fileList');
                        const checkboxes = fileList.querySelectorAll('input[type="checkbox"]:checked');
                        selectedFiles = Array.from(checkboxes).map(cb => cb.value);
                    }
                    
                    vscode.postMessage({
                        command: 'submit',
                        prompt: document.getElementById('prompt').value,
                        includeStructure: document.getElementById('includeStructure').checked,
                        includeAllFiles: includeAll,
                        selectedFiles
                    });
                }

                function cancel() {
                    vscode.postMessage({ command: 'cancel' });
                }

                function editConfig() {
                    vscode.postMessage({ command: 'editConfig' });
                }

                function openSponsors() {
                    vscode.postMessage({ command: 'openSponsors' });
                }

                window.addEventListener('message', function(event) {
                    const message = event.data;
                    if (message.command === 'updateFiles') {
                        currentFiles = message.files;
                        const fileList = document.getElementById('fileList');
                        if (fileList && Array.isArray(message.files)) {
                            fileList.innerHTML = message.files
                                .map(file => '<div class="checkbox-label"><input type="checkbox" value="' + file + '" checked>' + file + '</div>')
                                .join('');
                        }
                    }
                });
            </script>
        </body>
        </html>`;

        this.panel.webview.html = htmlTemplate;

        // Initial update
        await this.updateFileList();

        return new Promise((resolve) => {
            if (!this.panel) {
                resolve(undefined);
                return;
            }

            this.panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'submit':
                            const selectedFiles = message.selectedFiles.map((file: string) => 
                                vscode.Uri.file(path.join(workspaceRoot, file))
                            );
                            resolve({
                                prompt: message.prompt,
                                includeEntireProjectStructure: message.includeStructure,
                                includeAllFiles: message.includeAllFiles,
                                selectedFiles
                            });
                            this.panel?.dispose();
                            break;
                        case 'cancel':
                            resolve(undefined);
                            this.panel?.dispose();
                            break;
                        case 'editConfig':
                            const configPath = path.join(workspaceRoot, '.snapshots', 'config.json');
                            const configUri = vscode.Uri.file(configPath);
                            await vscode.workspace.openTextDocument(configUri);
                            await vscode.window.showTextDocument(configUri);
                            this.panel?.dispose();
                            resolve(undefined);
                            break;
                        case 'openSponsors':
                            const sponsorsPath = path.join(workspaceRoot, '.snapshots', 'sponsors.md');
                            const sponsorsUri = vscode.Uri.file(sponsorsPath);
                            await vscode.workspace.openTextDocument(sponsorsUri);
                            await vscode.window.showTextDocument(sponsorsUri);
                            this.panel?.dispose();
                            resolve(undefined);
                            break;
                    }
                },
                undefined,
                []
            );

            this.panel.onDidDispose(() => {
                this.fileWatcher?.dispose();
                this.editorListener?.dispose();
                resolve(undefined);
            });
        });
    }
}

export function deactivate() {}

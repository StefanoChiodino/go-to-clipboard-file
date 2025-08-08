import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileLineReference, parseFileReferences } from './parser';

const outputChannel = vscode.window.createOutputChannel('Go to Clipboard File');

export function activate(context: vscode.ExtensionContext): void {
    outputChannel.appendLine('Extension activated');

    const disposable = vscode.commands.registerCommand('go-to-clipboard-file.goToFile', async () => {
        outputChannel.show();
        outputChannel.appendLine('Command triggered');
        await handleGoToFileCommand();
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(outputChannel);
}

export function deactivate(): void {}

async function handleGoToFileCommand(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    outputChannel.appendLine('Clipboard text: ' + clipboardText);

    if (!clipboardText) {
        outputChannel.appendLine('No clipboard text found');
        await vscode.commands.executeCommand('workbench.action.quickOpen');
        return;
    }

    const references = parseFileReferences(clipboardText);
    outputChannel.appendLine('Parsed references: ' + JSON.stringify(references));

    if (references.length === 0) {
        outputChannel.appendLine('No file references found in clipboard');
        vscode.window.showInformationMessage('No file references found in clipboard');
        await vscode.commands.executeCommand('workbench.action.quickOpen');
        return;
    }

    if (references.length === 1) {
        outputChannel.appendLine('Opening single file: ' + JSON.stringify(references[0]));
        await openFileAtLocation(references[0]);
    } else {
        outputChannel.appendLine('Showing file selection dialog for ' + references.length + ' files');
        await showFileSelectionDialog(references);
    }
}


async function openFileAtLocation(reference: FileLineReference): Promise<void> {
    try {
        outputChannel.appendLine('Attempting to resolve file path: ' + reference.file);
        const filePath = await resolveFilePath(reference.file);
        outputChannel.appendLine('Resolved file path: ' + filePath);

        if (!filePath) {
            outputChannel.appendLine('File not found: ' + reference.file);
            vscode.window.showErrorMessage(`File not found: ${reference.file}`);
            return;
        }

        await openResolvedFile(reference, filePath);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
}

async function openResolvedFile(reference: FileLineReference, filePath: string): Promise<void> {
    try {
        outputChannel.appendLine('Opening resolved file: ' + filePath);
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);

        const position = new vscode.Position(
            Math.max(0, reference.line - 1),
            reference.column ? Math.max(0, reference.column - 1) : 0
        );

        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
}

async function resolveFilePath(filePath: string): Promise<string | null> {
    outputChannel.appendLine('resolveFilePath called with: ' + filePath);

    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
        outputChannel.appendLine('Found as absolute path: ' + filePath);
        return filePath;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        outputChannel.appendLine('No workspace folders found');
        return null;
    }

    outputChannel.appendLine('Workspace folders: ' + JSON.stringify(workspaceFolders.map(f => f.uri.fsPath)));

    for (const folder of workspaceFolders) {
        const absolutePath = path.join(folder.uri.fsPath, filePath);
        outputChannel.appendLine('Checking full path: ' + absolutePath);
        if (fs.existsSync(absolutePath)) {
            outputChannel.appendLine('Found at: ' + absolutePath);
            return absolutePath;
        }
    }

    const pathParts = filePath.split(/[\\\/]/);
    outputChannel.appendLine('Path parts: ' + JSON.stringify(pathParts));

    for (let i = 0; i < pathParts.length; i++) {
        const partialPath = pathParts.slice(i).join(path.sep);
        outputChannel.appendLine('Trying partial path: ' + partialPath);

        for (const folder of workspaceFolders) {
            const absolutePath = path.join(folder.uri.fsPath, partialPath);
            outputChannel.appendLine('Checking stripped path: ' + absolutePath);
            if (fs.existsSync(absolutePath)) {
                outputChannel.appendLine('Found stripped path at: ' + absolutePath);
                return absolutePath;
            }
        }

        if (partialPath.includes(path.sep)) {
            const pattern = `**/${partialPath.replace(/[\\\/]/g, '/')}`;
            outputChannel.appendLine('Searching with pattern: ' + pattern);
            const files = await vscode.workspace.findFiles(pattern, null, 10);
            outputChannel.appendLine('Found files: ' + JSON.stringify(files.map(f => f.fsPath)));

            for (const file of files) {
                const normalizedFilePath = file.fsPath.replace(/[\\\/]/g, path.sep);
                const normalizedPartialPath = partialPath.replace(/[\\\/]/g, path.sep);

                if (normalizedFilePath.endsWith(path.sep + normalizedPartialPath) ||
                    normalizedFilePath.endsWith(normalizedPartialPath)) {
                    outputChannel.appendLine('Match found: ' + file.fsPath);
                    return file.fsPath;
                }
            }
        }
    }

    const fileName = path.basename(filePath);
    if (fileName && fileName !== filePath) {
        outputChannel.appendLine('Trying to find by filename: ' + fileName);
        const pattern = `**/${fileName}`;
        const files = await vscode.workspace.findFiles(pattern, null, 10);
        
        if (files.length === 1) {
            outputChannel.appendLine('Found single file by name: ' + files[0].fsPath);
            return files[0].fsPath;
        } else if (files.length > 1) {
            outputChannel.appendLine('Multiple files found with same name, checking best match');
            
            const pathSegments = filePath.split(/[\\\/]/).slice(-3, -1);
            outputChannel.appendLine('Looking for path segments: ' + JSON.stringify(pathSegments));
            
            for (const file of files) {
                const filePathLower = file.fsPath.toLowerCase();
                const matchesAllSegments = pathSegments.every(segment => 
                    filePathLower.includes(segment.toLowerCase())
                );
                
                if (matchesAllSegments) {
                    outputChannel.appendLine('Best match found: ' + file.fsPath);
                    return file.fsPath;
                }
            }
            
            outputChannel.appendLine('No best match, returning first: ' + files[0].fsPath);
            return files[0].fsPath;
        }
    }

    outputChannel.appendLine('No file found for: ' + filePath);
    return null;
}

async function showFileSelectionDialog(references: FileLineReference[]): Promise<void> {
    outputChannel.appendLine('Pre-resolving file paths...');
    
    const resolvedRefs: Array<{reference: FileLineReference, resolvedPath: string}> = [];
    
    for (const ref of references) {
        const resolvedPath = await resolveFilePath(ref.file);
        if (resolvedPath) {
            resolvedRefs.push({ reference: ref, resolvedPath });
        } else {
            outputChannel.appendLine(`Skipping non-existent file: ${ref.file}`);
        }
    }
    
    if (resolvedRefs.length === 0) {
        vscode.window.showErrorMessage('No valid file references found');
        return;
    }
    
    if (resolvedRefs.length === 1) {
        outputChannel.appendLine('Only one valid file found, opening directly');
        await openResolvedFile(resolvedRefs[0].reference, resolvedRefs[0].resolvedPath);
        return;
    }
    
    const items: vscode.QuickPickItem[] = resolvedRefs.slice().reverse().map(({reference: ref, resolvedPath}) => ({
        label: `${ref.file}:${ref.line}${ref.column ? ':' + ref.column : ''}`,
        description: ref.originalText,
        detail: `Line ${ref.line}${ref.column ? ', Column ' + ref.column : ''} → ${resolvedPath}`
    }));

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = items;
    quickPick.placeholder = 'Select a file to open';
    quickPick.title = `${resolvedRefs.length} valid file references found`;
    
    quickPick.onDidAccept(() => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
            const index = items.indexOf(selected);
            if (index >= 0) {
                const reversedIndex = resolvedRefs.length - 1 - index;
                const resolvedRef = resolvedRefs[reversedIndex];
                openResolvedFile(resolvedRef.reference, resolvedRef.resolvedPath);
            }
        }
        quickPick.dispose();
    });
    
    quickPick.onDidHide(() => {
        quickPick.dispose();
    });
    
    quickPick.show();
}
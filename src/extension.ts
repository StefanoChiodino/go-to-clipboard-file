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
    const displayReferences = references.map(ref => ({
        ...ref,
        file: stripDisplayPath(ref.file)
    }));
    outputChannel.appendLine('Parsed references: ' + JSON.stringify(displayReferences));

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

function stripDisplayPath(filePath: string): string {
    const stripPrefixes: string[] = vscode.workspace.getConfiguration('go-to-clipboard-file').get('stripPrefixes') || [];
    
    for (const prefix of stripPrefixes) {
        if (filePath.startsWith(prefix)) {
            return filePath.substring(prefix.length);
        }
    }
    
    return filePath;
}

async function resolveFilePath(filePath: string): Promise<string | null> {
    outputChannel.appendLine('resolveFilePath called with: ' + filePath);

    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
        outputChannel.appendLine('Found as absolute path: ' + filePath);
        return filePath;
    }

    const stripPrefixes: string[] = vscode.workspace.getConfiguration('go-to-clipboard-file').get('stripPrefixes') || [];
    let strippedPath = filePath;

    for (const prefix of stripPrefixes) {
        if (strippedPath.startsWith(prefix)) {
            strippedPath = strippedPath.substring(prefix.length);
            outputChannel.appendLine('Stripped prefix "' + prefix + '", new path: ' + strippedPath);
            break;
        }
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        outputChannel.appendLine('No workspace folders found');
        return null;
    }

    for (const folder of workspaceFolders) {
        const fullPath = path.join(folder.uri.fsPath, strippedPath);
        if (fs.existsSync(fullPath)) {
            outputChannel.appendLine('Found as exact workspace path: ' + fullPath);
            return fullPath;
        }
    }

    outputChannel.appendLine('File not found with exact matching: ' + strippedPath);
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
        label: `${stripDisplayPath(ref.file)}:${ref.line}${ref.column ? ':' + ref.column : ''}`,
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
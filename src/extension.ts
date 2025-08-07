import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileLineReference, parseFileReferences } from './parser';

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('go-to-clipboard-file.goToFile', async () => {
        await handleGoToFileCommand();
    });

    context.subscriptions.push(disposable);
}

export function deactivate(): void {}

async function handleGoToFileCommand(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    
    if (!clipboardText) {
        await vscode.commands.executeCommand('workbench.action.quickOpen');
        return;
    }

    const references = parseFileReferences(clipboardText);
    
    if (references.length === 0) {
        await vscode.commands.executeCommand('workbench.action.quickOpen');
        return;
    }

    if (references.length === 1) {
        await openFileAtLocation(references[0]);
    } else {
        await showFileSelectionDialog(references);
    }
}


async function openFileAtLocation(reference: FileLineReference): Promise<void> {
    try {
        const filePath = await resolveFilePath(reference.file);
        
        if (!filePath) {
            vscode.window.showErrorMessage(`File not found: ${reference.file}`);
            return;
        }

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
    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
        return filePath;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return null;
    }

    for (const folder of workspaceFolders) {
        const absolutePath = path.join(folder.uri.fsPath, filePath);
        if (fs.existsSync(absolutePath)) {
            return absolutePath;
        }
        
        const files = await vscode.workspace.findFiles(`**/${path.basename(filePath)}`, null, 10);
        for (const file of files) {
            if (file.fsPath.endsWith(filePath.replace(/[\\\/]/g, path.sep))) {
                return file.fsPath;
            }
        }
    }

    return null;
}

async function showFileSelectionDialog(references: FileLineReference[]): Promise<void> {
    const items: vscode.QuickPickItem[] = references.map(ref => ({
        label: `${ref.file}:${ref.line}${ref.column ? ':' + ref.column : ''}`,
        description: ref.originalText,
        detail: `Line ${ref.line}${ref.column ? ', Column ' + ref.column : ''}`
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a file to open',
        title: 'Multiple file references found'
    });

    if (selected) {
        const index = items.indexOf(selected);
        if (index >= 0) {
            await openFileAtLocation(references[index]);
        }
    }
}
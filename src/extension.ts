import * as vscode from 'vscode';
import * as path from 'path';
import { FileLineReference, parseFileReferences } from './parser';

const outputChannel = vscode.window.createOutputChannel('Go to Clipboard File');

interface LogContext {
    operation: string;
    filePath?: string;
    references?: number;
    error?: string;
}

function logInfo(message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    outputChannel.appendLine(`[INFO ${timestamp}] ${message}${contextStr}`);
}

function logError(message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    outputChannel.appendLine(`[ERROR ${timestamp}] ${message}${contextStr}`);
}

function validateStripPrefixes(stripPrefixes: any): string[] {
    if (!Array.isArray(stripPrefixes)) {
        logError('stripPrefixes configuration is not an array', { operation: 'validateConfig', error: 'Invalid type' });
        return [];
    }

    const validPrefixes: string[] = [];
    for (const prefix of stripPrefixes) {
        if (typeof prefix === 'string' && prefix.length > 0) {
            validPrefixes.push(prefix);
        } else {
            logError('Invalid strip prefix found', { operation: 'validateConfig', error: `Invalid prefix: ${prefix}` });
        }
    }

    return validPrefixes;
}

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('go-to-clipboard-file.goToFile', handleGoToFileCommand);
    context.subscriptions.push(disposable, outputChannel);
}

export function deactivate(): void {}

async function handleGoToFileCommand(): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();

    if (!clipboardText) {
        logInfo('Empty clipboard, opening Quick Open', { operation: 'handleCommand' });
        await vscode.commands.executeCommand('workbench.action.quickOpen');
        return;
    }

    const references = parseFileReferences(clipboardText);
    logInfo('Parsed clipboard content', { operation: 'parseReferences', references: references.length });

    if (references.length === 0) {
        logInfo('No file references found', { operation: 'parseReferences' });
        vscode.window.showInformationMessage('No file references found in clipboard');
        await vscode.commands.executeCommand('workbench.action.quickOpen');
        return;
    }

    if (references.length === 1) {
        logInfo('Opening single file reference', { operation: 'openFile', filePath: references[0].file });
        await openFileAtLocation(references[0]);
    } else {
        logInfo('Showing selection dialog for multiple references', { operation: 'showDialog', references: references.length });
        await showFileSelectionDialog(references);
    }
}

async function openFileAtLocation(reference: FileLineReference): Promise<void> {
    try {
        const filePath = await resolveFilePath(reference.file);

        if (!filePath) {
            const displayPath = stripDisplayPath(reference.file);
            logError('File not found during resolution', { operation: 'resolveFile', filePath: reference.file, error: 'File not found' });
            vscode.window.showErrorMessage(`File not found: ${displayPath}`);
            return;
        }

        logInfo('File resolved successfully', { operation: 'resolveFile', filePath });
        await openResolvedFile(reference, filePath);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError('Failed to open file', { operation: 'openFile', filePath: reference.file, error: message });
        vscode.window.showErrorMessage(`Failed to open file: ${message}`);
    }
}

async function openResolvedFile(reference: FileLineReference, filePath: string): Promise<void> {
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
}

export function stripDisplayPath(filePath: string): string {
    const config = vscode.workspace.getConfiguration('go-to-clipboard-file');
    const rawStripPrefixes = config.get('stripPrefixes') || [];
    const stripPrefixes = validateStripPrefixes(rawStripPrefixes);
    
    for (const prefix of stripPrefixes) {
        if (filePath.startsWith(prefix)) {
            return filePath.substring(prefix.length);
        }
    }
    
    return filePath;
}

export async function resolveFilePath(filePath: string): Promise<string | null> {
    const strippedPath = stripDisplayPath(filePath);
    logInfo('Starting file path resolution', { operation: 'resolveFilePath', filePath: strippedPath });

    if (path.isAbsolute(strippedPath)) {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(strippedPath));
            logInfo('Absolute path resolved', { operation: 'resolveFilePath', filePath: strippedPath });
            return strippedPath;
        } catch {
            logInfo('Absolute path not found, searching workspace', { operation: 'resolveFilePath', filePath: strippedPath });
        }
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        logError('No workspace folders available', { operation: 'resolveFilePath', error: 'No workspace' });
        return null;
    }

    const searchPattern = `**/${strippedPath.split('/').slice(-3).join('/')}`;
    logInfo('Searching workspace with pattern', { operation: 'resolveFilePath', filePath: searchPattern });
    const files = await vscode.workspace.findFiles(searchPattern, '**/node_modules/**', 20);

    if (files.length === 0) {
        logError('No files found in workspace search', { operation: 'resolveFilePath', filePath: strippedPath });
        return null;
    }

    if (files.length === 1) {
        logInfo('Single file match found', { operation: 'resolveFilePath', filePath: files[0].fsPath });
        return files[0].fsPath;
    }

    logInfo('Multiple files found, scoring matches', { operation: 'resolveFilePath', references: files.length });
    const scoredFiles = files.map(file => {
        const score = file.fsPath.split('/').reverse().findIndex((part, i) => {
            const originalPart = strippedPath.split('/').reverse()[i];
            return part !== originalPart;
        });
        return { path: file.fsPath, score: score === -1 ? Infinity : score };
    });

    scoredFiles.sort((a, b) => b.score - a.score);
    logInfo('Best match selected', { operation: 'resolveFilePath', filePath: scoredFiles[0].path });

    return scoredFiles[0].path;
}

async function showFileSelectionDialog(references: FileLineReference[]): Promise<void> {
    const resolvedRefs = await Promise.all(
        references.map(async ref => {
            const resolvedPath = await resolveFilePath(ref.file);
            return { reference: ref, resolvedPath };
        })
    );

    const validRefs = resolvedRefs.filter(r => r.resolvedPath);

    if (validRefs.length === 0) {
        vscode.window.showErrorMessage('No valid file references found');
        return;
    }

    if (validRefs.length === 1) {
        await openResolvedFile(validRefs[0].reference, validRefs[0].resolvedPath!);
        return;
    }

    const items: vscode.QuickPickItem[] = validRefs.map(({ reference, resolvedPath }) => ({
        label: `${stripDisplayPath(reference.file)}:${reference.line}${reference.column ? ':' + reference.column : ''}`,
        description: reference.originalText,
        detail: `→ ${resolvedPath}`
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a file to open',
        title: `${validRefs.length} valid file references found`,
    });

    if (selected) {
        const index = items.indexOf(selected);
        const resolvedRef = validRefs[index];
        await openResolvedFile(resolvedRef.reference, resolvedRef.resolvedPath!);
    }
}
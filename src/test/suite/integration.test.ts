import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('Integration Test Suite', () => {
    let clipboardStub: sinon.SinonStub;
    let showTextDocumentStub: sinon.SinonStub;
    let openTextDocumentStub: sinon.SinonStub;
    let showQuickPickStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;

    setup(() => {
        clipboardStub = sinon.stub(vscode.env.clipboard, 'readText');
        showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument');
        openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument');
        showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
        showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

        sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => [{
            uri: vscode.Uri.file('/workspace'),
            name: 'test-workspace',
            index: 0
        }]);

        sinon.stub(vscode.workspace, 'getConfiguration').returns({
            get: () => []
        } as any);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Should handle empty clipboard by opening Quick Open', async () => {
        clipboardStub.resolves('');
        executeCommandStub.resolves();

        await vscode.commands.executeCommand('go-to-clipboard-file.goToFile');

        assert.ok(executeCommandStub.calledWith('workbench.action.quickOpen'));
        assert.ok(showInformationMessageStub.notCalled);
    });

    test('Should handle clipboard with no file references', async () => {
        clipboardStub.resolves('This is just regular text with no file references');
        executeCommandStub.resolves();

        await vscode.commands.executeCommand('go-to-clipboard-file.goToFile');

        assert.ok(showInformationMessageStub.calledWith('No file references found in clipboard'));
        assert.ok(executeCommandStub.calledWith('workbench.action.quickOpen'));
    });

    test('Should open single file reference directly', async () => {
        const stacktrace = 'File "src/app.py", line 42, in main';
        clipboardStub.resolves(stacktrace);

        const mockDocument = { uri: vscode.Uri.file('/workspace/src/app.py') } as vscode.TextDocument;
        const mockEditor = {
            selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)),
            revealRange: sinon.stub()
        } as any;

        openTextDocumentStub.resolves(mockDocument);
        showTextDocumentStub.resolves(mockEditor);
        sinon.stub(vscode.workspace.fs, 'stat').resolves();

        await vscode.commands.executeCommand('go-to-clipboard-file.goToFile');

        assert.ok(openTextDocumentStub.calledWith('/workspace/src/app.py'));
        assert.ok(showTextDocumentStub.calledWith(mockDocument));
        assert.strictEqual(mockEditor.selection.start.line, 41);
        assert.strictEqual(mockEditor.selection.start.character, 0);
    });

    test('Should show selection dialog for multiple references', async () => {
        const stacktrace = `File "src/app.py", line 42
File "src/utils.py", line 15`;
        clipboardStub.resolves(stacktrace);

        const mockDocument = { uri: vscode.Uri.file('/workspace/src/app.py') } as vscode.TextDocument;
        const mockEditor = { selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)), revealRange: sinon.stub() } as any;

        openTextDocumentStub.resolves(mockDocument);
        showTextDocumentStub.resolves(mockEditor);
        sinon.stub(vscode.workspace.fs, 'stat').resolves();
        sinon.stub(vscode.workspace, 'findFiles').resolves([
            vscode.Uri.file('/workspace/src/app.py'),
            vscode.Uri.file('/workspace/src/utils.py')
        ]);

        showQuickPickStub.resolves({
            label: 'src/app.py:42',
            description: 'File "src/app.py", line 42',
            detail: '→ /workspace/src/app.py'
        });

        await vscode.commands.executeCommand('go-to-clipboard-file.goToFile');

        assert.ok(showQuickPickStub.calledOnce);
        const quickPickItems = showQuickPickStub.firstCall.args[0];
        assert.strictEqual(quickPickItems.length, 2);
        assert.strictEqual(quickPickItems[0].label, 'src/app.py:42');
        assert.strictEqual(quickPickItems[1].label, 'src/utils.py:15');
    });

    test('Should handle file not found error gracefully', async () => {
        const stacktrace = 'File "nonexistent.py", line 42';
        clipboardStub.resolves(stacktrace);

        sinon.stub(vscode.workspace.fs, 'stat').rejects();
        sinon.stub(vscode.workspace, 'findFiles').resolves([]);

        await vscode.commands.executeCommand('go-to-clipboard-file.goToFile');

        assert.ok(showErrorMessageStub.calledWith('File not found: nonexistent.py'));
    });

    test('Should handle JavaScript stacktrace with column numbers', async () => {
        const stacktrace = 'at Object.<anonymous> (/src/index.js:42:15)';
        clipboardStub.resolves(stacktrace);

        const mockDocument = { uri: vscode.Uri.file('/workspace/src/index.js') } as vscode.TextDocument;
        const mockEditor = {
            selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)),
            revealRange: sinon.stub()
        } as any;

        openTextDocumentStub.resolves(mockDocument);
        showTextDocumentStub.resolves(mockEditor);
        sinon.stub(vscode.workspace.fs, 'stat').resolves();

        await vscode.commands.executeCommand('go-to-clipboard-file.goToFile');

        assert.strictEqual(mockEditor.selection.start.line, 41);
        assert.strictEqual(mockEditor.selection.start.character, 14);
    });

    test('Should show error when multiple references are parsed but none resolve', async () => {
        const text = `src/missing_one.ts:10\nsrc/missing_two.ts:20`;
        clipboardStub.resolves(text);

        const findFilesStub = sinon.stub(vscode.workspace, 'findFiles').resolves([]);

        await vscode.commands.executeCommand('go-to-clipboard-file.goToFile');

        assert.ok(findFilesStub.called);
        assert.ok(showErrorMessageStub.calledWith('No valid file references found'));
    });

    test('Should show error when no workspace is open and multiple references exist', async () => {
        const text = `src/app.ts:10\nsrc/utils.ts:20`;
        clipboardStub.resolves(text);

        sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => undefined);

        await vscode.commands.executeCommand('go-to-clipboard-file.goToFile');

        assert.ok(showErrorMessageStub.calledWith('No valid file references found'));
    });
});

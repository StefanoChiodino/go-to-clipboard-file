import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { resolveFilePath } from '../../extension';

suite('File Resolution Test Suite', () => {
    let findFilesStub: sinon.SinonStub;
    let statStub: sinon.SinonStub;
    let getConfigurationStub: sinon.SinonStub;

    setup(() => {
        findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
        statStub = sinon.stub(vscode.workspace.fs, 'stat');
        getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
        sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => [{
            uri: vscode.Uri.file('/workspace'),
            name: 'test-workspace',
            index: 0
        }]);
        
        getConfigurationStub.withArgs('go-to-clipboard-file').returns({
            get: (key: string) => {
                if (key === 'stripPrefixes') {
                    return [];
                }
                return undefined;
            }
        });
    });

    teardown(() => {
        sinon.restore();
    });

    test('Should resolve an existing absolute path', async () => {
        const absolutePath = '/workspace/src/app.ts';
        statStub.withArgs(vscode.Uri.file(absolutePath)).resolves();
        
        const result = await resolveFilePath(absolutePath);
        assert.strictEqual(result, absolutePath);
        assert.ok(statStub.calledOnce);
        assert.ok(findFilesStub.notCalled);
    });

    test('Should resolve a file within the workspace', async () => {
        const relativePath = 'src/app.ts';
        const fullPath = '/workspace/src/app.ts';
        statStub.withArgs(vscode.Uri.file(relativePath)).rejects();
        findFilesStub.resolves([vscode.Uri.file(fullPath)]);

        const result = await resolveFilePath(relativePath);
        assert.strictEqual(result, fullPath);
        assert.ok(findFilesStub.calledOnce);
    });

    test('Should return null if no file is found', async () => {
        const nonExistentPath = 'src/nonexistent.ts';
        statStub.withArgs(vscode.Uri.file(nonExistentPath)).rejects();
        findFilesStub.resolves([]);

        const result = await resolveFilePath(nonExistentPath);
        assert.strictEqual(result, null);
    });

    test('Should strip prefix and resolve', async () => {
        getConfigurationStub.withArgs('go-to-clipboard-file').returns({
            get: (key: string) => {
                if (key === 'stripPrefixes') {
                    return ['/app/'];
                }
                return undefined;
            }
        });

        const pathWithPrefix = '/app/src/component.tsx';
        const strippedPath = 'src/component.tsx';
        const fullPath = `/workspace/${strippedPath}`;
        
        statStub.withArgs(vscode.Uri.file(pathWithPrefix)).rejects();
        findFilesStub.resolves([vscode.Uri.file(fullPath)]);

        const result = await resolveFilePath(pathWithPrefix);
        assert.strictEqual(result, fullPath);
    });

    test('Should pick the best match when multiple files are found', async () => {
        const ambiguousPath = 'ui/button.tsx';
        const files = [
            vscode.Uri.file('/workspace/src/old/ui/button.tsx'),
            vscode.Uri.file('/workspace/src/components/ui/button.tsx'),
            vscode.Uri.file('/workspace/lib/ui/button.tsx'),
        ];
        findFilesStub.resolves(files);

        const result = await resolveFilePath(ambiguousPath);
        assert.strictEqual(result, '/workspace/src/components/ui/button.tsx');
    });
    
    test('Should pick the best match with deeper path', async () => {
        const ambiguousPath = 'components/ui/button.tsx';
        const files = [
            vscode.Uri.file('/workspace/src/old/components/ui/button.tsx'),
            vscode.Uri.file('/workspace/src/components/ui/button.tsx'),
        ];
        findFilesStub.resolves(files);

        const result = await resolveFilePath(ambiguousPath);
        assert.strictEqual(result, '/workspace/src/components/ui/button.tsx');
    });

    test('Should return null if no workspace is open', async () => {
        sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => undefined);
        
        const relativePath = 'src/app.ts';
        statStub.withArgs(vscode.Uri.file(relativePath)).rejects();
        const result = await resolveFilePath(relativePath);
        assert.strictEqual(result, null);
    });
});

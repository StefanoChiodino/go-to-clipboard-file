import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('Configuration Test Suite', () => {
    let getConfigurationStub: sinon.SinonStub;

    setup(() => {
        getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
    });

    teardown(() => {
        sinon.restore();
    });

    test('Should handle valid stripPrefixes configuration', async () => {
        const validPrefixes = ['/app/', '/src/', '~/project/'];
        getConfigurationStub.withArgs('go-to-clipboard-file').returns({
            get: (key: string) => key === 'stripPrefixes' ? validPrefixes : undefined
        });

        const { stripDisplayPath } = await import('../../extension');
        
        const result1 = stripDisplayPath('/app/src/main.ts');
        assert.strictEqual(result1, 'src/main.ts');
        
        const result2 = stripDisplayPath('/src/utils.ts');
        assert.strictEqual(result2, 'utils.ts');
        
        const result3 = stripDisplayPath('~/project/lib/helper.js');
        assert.strictEqual(result3, 'lib/helper.js');
    });

    test('Should handle empty stripPrefixes array', async () => {
        getConfigurationStub.withArgs('go-to-clipboard-file').returns({
            get: (key: string) => key === 'stripPrefixes' ? [] : undefined
        });

        const { stripDisplayPath } = await import('../../extension');
        
        const result = stripDisplayPath('/app/src/main.ts');
        assert.strictEqual(result, '/app/src/main.ts');
    });

    test('Should handle invalid stripPrefixes configuration gracefully', async () => {
        const invalidConfig = 'not-an-array';
        getConfigurationStub.withArgs('go-to-clipboard-file').returns({
            get: (key: string) => key === 'stripPrefixes' ? invalidConfig : undefined
        });

        const { stripDisplayPath } = await import('../../extension');
        
        const result = stripDisplayPath('/app/src/main.ts');
        assert.strictEqual(result, '/app/src/main.ts');
    });

    test('Should filter out invalid prefix entries', async () => {
        const mixedPrefixes = ['/valid/', '', null, 123, '/another-valid/'];
        getConfigurationStub.withArgs('go-to-clipboard-file').returns({
            get: (key: string) => key === 'stripPrefixes' ? mixedPrefixes : undefined
        });

        const { stripDisplayPath } = await import('../../extension');
        
        const result1 = stripDisplayPath('/valid/file.ts');
        assert.strictEqual(result1, 'file.ts');
        
        const result2 = stripDisplayPath('/another-valid/file.ts');
        assert.strictEqual(result2, 'file.ts');
        
        const result3 = stripDisplayPath('/invalid/file.ts');
        assert.strictEqual(result3, '/invalid/file.ts');
    });

    test('Should handle undefined stripPrefixes configuration', async () => {
        getConfigurationStub.withArgs('go-to-clipboard-file').returns({
            get: (key: string) => undefined
        });

        const { stripDisplayPath } = await import('../../extension');
        
        const result = stripDisplayPath('/app/src/main.ts');
        assert.strictEqual(result, '/app/src/main.ts');
    });

    test('Should use longest matching prefix', async () => {
        const prefixes = ['/app/', '/app/src/'];
        getConfigurationStub.withArgs('go-to-clipboard-file').returns({
            get: (key: string) => key === 'stripPrefixes' ? prefixes : undefined
        });

        const { stripDisplayPath } = await import('../../extension');
        
        const result = stripDisplayPath('/app/src/components/Button.tsx');
        assert.strictEqual(result, 'components/Button.tsx');
    });
});

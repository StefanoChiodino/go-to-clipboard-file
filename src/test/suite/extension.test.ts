import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('StefanoChiodino.go-to-clipboard-file'));
    });

    test('Should register command', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('go-to-clipboard-file.goToFile'));
    });

    test('Should have correct keybinding configuration', () => {
        const extension = vscode.extensions.getExtension('StefanoChiodino.go-to-clipboard-file');
        assert.ok(extension);
        
        const packageJson = extension.packageJSON;
        const keybindings = packageJson.contributes?.keybindings;
        
        assert.ok(keybindings);
        assert.strictEqual(keybindings.length, 1);
        assert.strictEqual(keybindings[0].command, 'go-to-clipboard-file.goToFile');
        assert.strictEqual(keybindings[0].key, 'ctrl+shift+g');
        assert.strictEqual(keybindings[0].mac, 'cmd+shift+g');
    });

    test('Should have correct configuration schema', () => {
        const extension = vscode.extensions.getExtension('StefanoChiodino.go-to-clipboard-file');
        assert.ok(extension);
        
        const packageJson = extension.packageJSON;
        const config = packageJson.contributes?.configuration;
        
        assert.ok(config);
        assert.ok(config.properties);
        assert.ok(config.properties['go-to-clipboard-file.stripPrefixes']);
        assert.strictEqual(config.properties['go-to-clipboard-file.stripPrefixes'].type, 'array');
    });
});
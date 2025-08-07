# Go to Clipboard File

VS Code extension that parses file:line references from your clipboard and navigates to them. Perfect for jumping to files from stacktraces, error logs, and test outputs.

## Features

- Parse file:line references from clipboard
- Support for multiple formats:
  - Python stacktraces: `File "/path/to/file.py", line 42`
  - JavaScript/Node: `at function (/path/to/file.js:123:45)`
  - Generic patterns: `file.txt:123` or `file.txt:123:45`
- Show selection dialog when multiple references found
- Fall back to VS Code's Quick Open when no references found
- Smart file resolution (absolute paths, relative paths, workspace search)

## Keyboard Shortcut

- **Windows/Linux**: `Ctrl+Shift+G`
- **Mac**: `Cmd+Shift+G`

## Local Installation

### Prerequisites

- Node.js (v16 or higher)
- npm
- VS Code

### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/yourusername/go-to-clipboard-file.git
cd go-to-clipboard-file
```

2. Install dependencies:
```bash
npm install
```

3. Compile the extension:
```bash
npm run compile
```

4. Package the extension:
```bash
npx @vscode/vsce package
```

This creates a `.vsix` file in the project directory.

### Install the Extension

#### Option 1: Install via Command Line
```bash
code --install-extension go-to-clipboard-file-0.0.1.vsix
```

#### Option 2: Install via VS Code UI
1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X`)
3. Click the `...` menu at the top of the Extensions view
4. Select "Install from VSIX..."
5. Browse to and select the `.vsix` file

### Development

To run the extension in development mode:

1. Open the project in VS Code
2. Press `F5` to launch a new Extension Development Host window
3. The extension will be available in the new window

To watch for changes during development:
```bash
npm run watch
```

## Usage

1. Copy a stacktrace or error message containing file:line references to your clipboard
2. Press `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac)
3. If multiple references found, select from the quick pick menu
4. VS Code will open the file at the specified line

## Example Stacktraces

The extension can parse stacktraces like:

**Python:**
```
Traceback (most recent call last):
  File "/path/to/file.py", line 287, in run
    return self.execute()
  File "/another/file.py", line 61, in execute
    return action(**match)
```

**JavaScript/Node:**
```
Error: Something went wrong
    at Object.<anonymous> (/src/index.js:42:15)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)
```

**Generic:**
```
Error in src/components/Button.tsx:45
Failed at utils/helper.js:123:8
```

## Testing

Run the test suite:
```bash
npm test
```

## License

MIT
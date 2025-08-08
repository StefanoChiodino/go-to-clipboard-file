export interface FileLineReference {
    file: string;
    line: number;
    column?: number;
    originalText: string;
}

export function parseFileReferences(text: string): FileLineReference[] {
    const references: FileLineReference[] = [];
    const seenReferences = new Set<string>();
    
    const lines = text.split('\n');
    
    for (const line of lines) {
        let matched = false;
        
        const pythonMatch = /^\s*File "([^"]+)", line ([0-9]+)/.exec(line);
        if (pythonMatch && !matched) {
            matched = true;
            const file = pythonMatch[1].replace(/^\.\//, '').replace(/\/\.\//g, '/');
            const lineNum = parseInt(pythonMatch[2], 10);
            const key = `${file}:${lineNum}:0`;
            if (!seenReferences.has(key) && lineNum > 0) {
                seenReferences.add(key);
                references.push({
                    file,
                    line: lineNum,
                    column: undefined,
                    originalText: pythonMatch[0].trim()
                });
            }
        }
        
        const jsStackMatch = /at .*\(([^:)]+):([0-9]+):([0-9]+)\)/.exec(line);
        if (jsStackMatch && !matched) {
            matched = true;
            const file = jsStackMatch[1].replace(/^\.\//, '').replace(/\/\.\//g, '/');
            const lineNum = parseInt(jsStackMatch[2], 10);
            const column = parseInt(jsStackMatch[3], 10);
            const key = `${file}:${lineNum}:${column}`;
            if (!seenReferences.has(key) && lineNum > 0) {
                seenReferences.add(key);
                references.push({
                    file,
                    line: lineNum,
                    column,
                    originalText: jsStackMatch[0]
                });
            }
        }
        
        if (!matched) {
            const fileLinePattern = /([a-zA-Z]:[\\/][^\s:]+|\/[^\s:]+|\.?\.?\/[^\s:]+|~\/[^\s:]+|[a-zA-Z0-9_\-\.\/]+\.[a-zA-Z]+):([0-9]+)(?::([0-9]+))?/g;
            let match;
            while ((match = fileLinePattern.exec(line)) !== null) {
                const file = match[1].replace(/^\.\//, '').replace(/\/\.\//g, '/');
                const lineNum = parseInt(match[2], 10);
                const column = match[3] ? parseInt(match[3], 10) : undefined;
                const key = `${file}:${lineNum}:${column || 0}`;
                if (!seenReferences.has(key) && lineNum > 0) {
                    seenReferences.add(key);
                    references.push({
                        file,
                        line: lineNum,
                        column,
                        originalText: match[0]
                    });
                }
            }
        }
    }
    
    return references;
}
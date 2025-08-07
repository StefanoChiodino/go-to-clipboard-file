export interface FileLineReference {
    file: string;
    line: number;
    column?: number;
    originalText: string;
}

export function parseFileReferences(text: string): FileLineReference[] {
    const references: FileLineReference[] = [];
    const patterns = [
        /([a-zA-Z]:[\\/][^:]+|[\.\/~][^:]+):([0-9]+)(?::([0-9]+))?/g,
        /File "([^"]+)", line ([0-9]+)/g,
        /at .*\(([^:]+):([0-9]+):([0-9]+)\)/g,
        /([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z]+):([0-9]+)/g,
        /([a-zA-Z0-9_\-\.\/]+):([0-9]+):([0-9]+)/g
    ];

    const lines = text.split('\n');
    const seenReferences = new Set<string>();

    for (const line of lines) {
        for (const pattern of patterns) {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(line)) !== null) {
                let file: string;
                let lineNum: number;
                let column: number | undefined;

                if (pattern.source.includes('File \"')) {
                    file = match[1];
                    lineNum = parseInt(match[2], 10);
                } else if (pattern.source.includes('at .*\\(')) {
                    file = match[1];
                    lineNum = parseInt(match[2], 10);
                    column = parseInt(match[3], 10);
                } else {
                    file = match[1];
                    lineNum = parseInt(match[2], 10);
                    column = match[3] ? parseInt(match[3], 10) : undefined;
                }

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
export interface FileLineReference {
    file: string;
    line: number;
    column?: number;
    originalText: string;
}

type Parser = {
    regex: RegExp;
    multiMatch: boolean;
    transformer: (match: RegExpExecArray) => Omit<FileLineReference, 'originalText'>;
};

const parsers: Parser[] = [
    {
        regex: /^\s*File "([^"]+)", line ([0-9]+)/,
        multiMatch: false,
        transformer: match => ({
            file: match[1],
            line: parseInt(match[2], 10),
        }),
    },
    {
        regex: /at .*\(([^:)]+):([0-9]+):([0-9]+)\)/,
        multiMatch: false,
        transformer: match => ({
            file: match[1],
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
        }),
    },
    {
        regex: /([a-zA-Z]:[\\/][^\s:]+|\/[^\s:]+|\.?\.?\/[^\s:]+|~\/[^\s:]+|[a-zA-Z0-9_\-\.\/]+\.[a-zA-Z]+):([0-9]+)(?::([0-9]+))?/g,
        multiMatch: true,
        transformer: match => ({
            file: match[1],
            line: parseInt(match[2], 10),
            column: match[3] ? parseInt(match[3], 10) : undefined,
        }),
    },
];

function normalizePath(filePath: string): string {
    return filePath.replace(/^\.\//, '').replace(/\/\.\//g, '/');
}

export function parseFileReferences(text: string): FileLineReference[] {
    const references: FileLineReference[] = [];
    const seenReferences = new Set<string>();

    const addReference = (ref: Omit<FileLineReference, 'originalText'>, originalText: string) => {
        const file = normalizePath(ref.file);
        const key = `${file}:${ref.line}:${ref.column || 0}`;
        if (!seenReferences.has(key) && ref.line > 0) {
            seenReferences.add(key);
            references.push({ ...ref, file, originalText });
        }
    };

    for (const line of text.split('\n')) {
        let lineMatched = false;
        for (const parser of parsers) {
            if (lineMatched && !parser.multiMatch) continue;

            let match;
            while ((match = parser.regex.exec(line)) !== null) {
                const reference = parser.transformer(match);
                addReference(reference, match[0].trim());
                lineMatched = true;
                if (!parser.multiMatch) break;
            }
        }
    }

    return references;
}
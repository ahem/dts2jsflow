import ts from 'typescript';

export class NotImplementedError extends Error {
    fileName: string;
    line: number;
    character: number;
    nodeKind: string;

    constructor(node: ts.Node, msg?: string) {
        super(msg);
        this.name = 'NotImplementedError';
        this.nodeKind = ts.SyntaxKind[node.kind];

        const file = node.getSourceFile();
        this.fileName = file.fileName;
        const { line, character } = file.getLineAndCharacterOfPosition(node.pos);
        this.line = line;
        this.character = character;
    }
}

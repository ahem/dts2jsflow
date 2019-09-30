import ts from 'typescript';

export class NotImplementedError extends Error {
    fileName: string;
    line: number;
    character: number;

    constructor(node: ts.Node, msg?: string) {
        super(msg);
        this.name = 'NotImplementedError';

        const file = node.getSourceFile();
        this.fileName = file.fileName;
        const { line, character } = file.getLineAndCharacterOfPosition(node.pos);
        this.line = line;
        this.character = character;
    }
}

import ts from 'typescript';
import * as flow from '@babel/types';
import generate from '@babel/generator';
import { mapStatement } from './mapStatement';
import { collectAndMapImportTypeNodes } from './mapImportType';
import { writeFileSync } from 'fs';

import { execSync } from 'child_process';

function listFiles(dir: string, pattern: string) {
    return execSync(`find ${dir} -name "${pattern}"`, { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .map(s => s.trim());
}

function main(root: string) {
    const fileNames = listFiles(root, '*.d.ts');

    const program = ts.createProgram(fileNames, {});
    const checker = program.getTypeChecker();

    // Visit every sourceFile in the program
    for (const sourceFile of program.getSourceFiles()) {
        if (!fileNames.includes(sourceFile.fileName)) {
            continue;
        }
        console.log(`processing ${sourceFile.fileName}...`);
        const list: flow.Statement[] = [];
        ts.forEachChild(sourceFile, node => {
            if (node.kind === ts.SyntaxKind.EndOfFileToken) {
                return;
            }
            list.push(...collectAndMapImportTypeNodes(node));
            const result = mapStatement(node, checker);
            if (Array.isArray(result)) {
                list.push(...result);
            } else {
                list.push(result);
            }
        });
        const output = '// @flow\n' + generate(flow.program(list, undefined, 'module')).code;
        const outputFilename = sourceFile.fileName.replace(/.d.ts$/, '.js.flow');
        writeFileSync(outputFilename, output, { encoding: 'utf-8' });
    }
}

if (process.argv && process.argv[2]) {
    main(process.argv[2]);
} else {
    console.error(`usage: node ${__filename} <INPUT_DIRECTORY>`);
}

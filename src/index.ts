import ts from 'typescript';
import * as flow from '@babel/types';
import generate from '@babel/generator';
import { mapStatement } from './mapStatement';
import { collectAndMapImportTypeNodes } from './mapImportType';
import { writeFileSync, readdirSync, statSync } from 'fs';
import { join as joinPath, resolve } from 'path';

function listFiles(dir: string, pattern: RegExp): string[] {
    const files = readdirSync(dir);
    return files.reduce(
        (acc, filename) => {
            const path = resolve(joinPath(dir, filename));
            if (statSync(path).isDirectory()) {
                return acc.concat(listFiles(path, pattern));
            }
            return pattern.test(path) ? acc.concat(path) : acc;
        },
        [] as string[],
    );
}

function removeDuplicateImports(nodes: flow.Statement[]) {
    const list: flow.Statement[] = [];
    const seen: { [k: string]: string[] } = {};
    for (const node of nodes) {
        if (!flow.isImportDeclaration(node)) {
            list.push(node);
            continue;
        }
        const from = node.source.value;
        if (!seen[from]) {
            seen[from] = [];
        }
        const specifiers = node.specifiers.reduce(
            (acc, x) => {
                if (seen[from].includes(x.local.name)) {
                    return acc;
                }
                seen[from].push(x.local.name);
                return acc.concat(x);
            },
            [] as typeof node.specifiers,
        );
        if (specifiers.length) {
            node.specifiers = specifiers;
            list.push(node);
        }
    }
    return list;
}

function main(root: string) {
    const fileNames = listFiles(root, /\.d\.ts$/);

    const program = ts.createProgram(fileNames, {});
    const checker = program.getTypeChecker();

    for (const sourceFile of program.getSourceFiles()) {
        if (!fileNames.includes(sourceFile.fileName)) {
            continue;
        }
        console.log(`processing ${sourceFile.fileName}...`);
        let list: flow.Statement[] = [];
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
        list = removeDuplicateImports(list);
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

import ts from 'typescript';
import * as flow from '@babel/types';

import { mapType } from './mapType';

export function collectAndMapImportTypeNodes(node: ts.Node): flow.Statement[] {
    const list: flow.ImportDeclaration[] = [];

    const f = (node: ts.Node) => {
        if (ts.isImportTypeNode(node)) {
            if (
                !ts.isLiteralTypeNode(node.argument) ||
                !ts.isStringLiteral(node.argument.literal)
            ) {
                throw new Error('not implemented');
            }
            if (!node.qualifier || !ts.isIdentifier(node.qualifier)) {
                throw new Error(
                    `Not implemented, only identifers can be used as qualifiers in import types`,
                );
            }
            const source = flow.stringLiteral(node.argument.literal.text);
            const id = flow.identifier(node.qualifier.text);
            const declaration = flow.importDeclaration([flow.importSpecifier(id, id)], source);
            declaration.importKind = 'type';
            list.push(declaration);
        }
        ts.forEachChild(node, f);
    };
    ts.forEachChild(node, f);
    return list;
}

export function mapImportTypeNode(node: ts.ImportTypeNode, checker: ts.TypeChecker): flow.FlowType {
    if (!node.qualifier || !ts.isIdentifier(node.qualifier)) {
        throw new Error(
            `Not implemented, only identifers can be used as qualifiers in import types`,
        );
    }
    return flow.genericTypeAnnotation(
        flow.identifier(node.qualifier.text),
        node.typeArguments
            ? flow.typeParameterInstantiation(node.typeArguments.map(x => mapType(x, checker)))
            : null,
    );
}

import ts from 'typescript';
import * as flow from '@babel/types';

import { mapType } from './mapType';

export function mapParameter(node: ts.ParameterDeclaration, checker: ts.TypeChecker) {
    if (!node.type) {
        throw new Error('not implemented');
    }
    const mappedParam = flow.functionTypeParam(
        ts.isIdentifier(node.name) ? flow.identifier(node.name.text) : null,
        mapType(node.type, checker),
    );
    if (node.questionToken) {
        mappedParam.optional = true;
    }
    return mappedParam;
}

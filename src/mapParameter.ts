import ts from 'typescript';
import * as flow from '@babel/types';

import { mapType } from './mapType';
import { NotImplementedError } from './error';

export function mapParameter(node: ts.ParameterDeclaration, checker: ts.TypeChecker) {
    if (!node.type) {
        throw new NotImplementedError(node);
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

import ts from 'typescript';
import * as flow from '@babel/types';

import { mapType } from './mapType';

export function mapUnionType(node: ts.UnionTypeNode, checker: ts.TypeChecker) {
    return flow.unionTypeAnnotation(node.types.map(x => mapType(x, checker)));
}

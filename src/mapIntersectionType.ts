import ts from 'typescript';
import * as flow from '@babel/types';

import { mapType } from './mapType';

export function mapIntersectionType(node: ts.IntersectionTypeNode, checker: ts.TypeChecker) {
    const annotation = flow.objectTypeAnnotation(
        node.types.map(x => flow.objectTypeSpreadProperty(mapType(x, checker))),
    );
    annotation.exact = true;
    return annotation;
}

import ts from 'typescript';
import * as flow from '@babel/types';

export function mapTypeParameter(node: ts.TypeParameterDeclaration): flow.TypeParameter {
    // map defaults, constraints and so on..
    const o = flow.typeParameter(undefined, undefined, undefined);
    o.name = node.name.text;
    return o;
}

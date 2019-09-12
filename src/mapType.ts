import ts from 'typescript';
import * as flow from '@babel/types';

import { mapTypeParameter } from './mapTypeParameter';
import { mapParameter } from './mapParameter';
import { mapImportTypeNode } from './mapImportType';

export function mapPropertyName(name: ts.PropertyName): flow.StringLiteral | flow.Identifier {
    if (ts.isIdentifier(name)) {
        return flow.identifier(name.text);
    }
    if (ts.isStringLiteral(name)) {
        return flow.stringLiteral(name.text);
    }
    if (ts.isNumericLiteral(name)) {
        return flow.stringLiteral(name.text);
    }
    throw new Error('not implemented');
}

export function mapPropertySignatureOrDeclaration(
    node: ts.PropertySignature | ts.PropertyDeclaration,
    checker: ts.TypeChecker,
) {
    const key = mapPropertyName(node.name);
    if (!node.type) {
        throw new Error('not implemented');
    }
    const value = mapType(node.type, checker);
    const variance: flow.Variance | null = null; // Typescript doesn't have variance
    const o = flow.objectTypeProperty(key, value, variance);
    o.optional = !!node.questionToken;
    o.static = node.modifiers
        ? node.modifiers.some(x => x.kind === ts.SyntaxKind.StaticKeyword)
        : null;
    return o;
}

export function mapIndexSignature(node: ts.IndexSignatureDeclaration, checker: ts.TypeChecker) {
    if (node.parameters.length !== 1) {
        throw new Error('not implemented [mapIndexSignature. parameter length mismatch]');
    }
    const param = node.parameters[0];
    const id = param.name && ts.isIdentifier(param.name) ? flow.identifier(param.name.text) : null;
    if (!param.type) {
        throw new Error('not implemented [mapIndexSignature. no key type]');
    }
    const key = mapType(param.type, checker);
    if (!node.type) {
        throw new Error('not implemented [mapIndexSignature. no value type]');
    }
    const value = mapType(node.type, checker);
    return flow.objectTypeIndexer(id, key, value);
}

export function mapFunction(node: ts.SignatureDeclarationBase, checker: ts.TypeChecker) {
    if (!node.type) {
        throw new Error('not implemented');
    }
    const returnType = checker.getTypeAtLocation(node.type).isClass()
        ? flow.typeofTypeAnnotation(mapType(node.type, checker))
        : mapType(node.type, checker);
    const typeParameters = node.typeParameters
        ? flow.typeParameterDeclaration(node.typeParameters.map(mapTypeParameter))
        : null;
    const rest = node.parameters
        .filter(x => x.dotDotDotToken)
        .map(p => mapParameter(p, checker))[0];

    return flow.functionTypeAnnotation(
        typeParameters,
        node.parameters.filter(x => !x.dotDotDotToken).map(p => mapParameter(p, checker)),
        rest,
        returnType,
    );
}

export function mapType(node: ts.TypeNode, checker: ts.TypeChecker): flow.FlowType {
    if (ts.isFunctionTypeNode(node)) {
        return mapFunction(node, checker);
    } else if (ts.isTypeReferenceNode(node)) {
        if (!ts.isIdentifier(node.typeName)) {
            throw new Error('not implemented, only identifiers supported in typeReferenceNodes');
        }
        return flow.genericTypeAnnotation(
            flow.identifier(node.typeName.text),
            node.typeArguments
                ? flow.typeParameterInstantiation(node.typeArguments.map(x => mapType(x, checker)))
                : null,
        );
    } else if (ts.isTypeLiteralNode(node)) {
        const properties: (flow.ObjectTypeProperty | flow.ObjectTypeSpreadProperty)[] = [];
        const indexers: flow.ObjectTypeIndexer[] = [];
        for (const member of node.members) {
            if (ts.isPropertySignature(member)) {
                properties.push(mapPropertySignatureOrDeclaration(member, checker));
            } else if (ts.isIndexSignatureDeclaration(member)) {
                indexers.push(mapIndexSignature(member, checker));
            } else {
                throw new Error(
                    `not implemented [typeLiteralNode, member] [${ts.SyntaxKind[member.kind]}]`,
                );
            }
        }
        const callProperties: Array<flow.ObjectTypeCallProperty> | null = null;
        const internalSlots: Array<flow.ObjectTypeInternalSlot> | null = null;
        const exact = indexers.length === 0 && properties.length > 0;
        return flow.objectTypeAnnotation(
            properties,
            indexers,
            callProperties,
            internalSlots,
            exact,
        );
    } else if (ts.isIndexedAccessTypeNode(node)) {
        return flow.genericTypeAnnotation(
            flow.identifier('$PropertyType'),
            flow.typeParameterInstantiation([
                mapType(node.objectType, checker),
                mapType(node.indexType, checker),
            ]),
        );
    } else if (ts.isLiteralTypeNode(node)) {
        if (ts.isNumericLiteral(node.literal)) {
            return flow.numberLiteralTypeAnnotation(Number(node.literal.text));
        } else if (ts.isStringLiteral(node.literal)) {
            return flow.stringLiteralTypeAnnotation(node.literal.text);
        } else if (node.literal.kind === ts.SyntaxKind.TrueKeyword) {
            return flow.booleanLiteralTypeAnnotation(true);
        } else if (node.literal.kind === ts.SyntaxKind.FalseKeyword) {
            return flow.booleanLiteralTypeAnnotation(false);
        }
        throw new Error(`not implemented [literalTypeNode, ${ts.SyntaxKind[node.kind]}`);
    } else if (ts.isArrayTypeNode(node)) {
        return flow.arrayTypeAnnotation(mapType(node.elementType, checker));
    } else if (ts.isUnionTypeNode(node)) {
        return flow.unionTypeAnnotation(node.types.map(x => mapType(x, checker)));
    } else if (ts.isIntersectionTypeNode(node)) {
        return flow.intersectionTypeAnnotation(node.types.map(x => mapType(x, checker)));
    } else if (ts.isImportTypeNode(node)) {
        return mapImportTypeNode(node, checker);
    } else if (node.kind === ts.SyntaxKind.StringKeyword) {
        return flow.stringTypeAnnotation();
    } else if (node.kind === ts.SyntaxKind.BooleanKeyword) {
        return flow.booleanTypeAnnotation();
    } else if (node.kind === ts.SyntaxKind.NumberKeyword) {
        return flow.numberTypeAnnotation();
    } else if (node.kind === ts.SyntaxKind.UnknownKeyword) {
        return flow.mixedTypeAnnotation();
    } else if (node.kind === ts.SyntaxKind.AnyKeyword) {
        return flow.anyTypeAnnotation();
    } else if (node.kind === ts.SyntaxKind.VoidKeyword) {
        return flow.voidTypeAnnotation();
    } else if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
        return flow.voidTypeAnnotation();
    } else if (node.kind === ts.SyntaxKind.NullKeyword) {
        return flow.nullLiteralTypeAnnotation();
    } else {
        throw new Error(`mapType, not implemented: ${ts.SyntaxKind[node.kind]}`);
    }
}

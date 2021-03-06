import ts from 'typescript';
import * as flow from '@babel/types';
import { mapWellKnownImports } from './mapWellKnownImports';

import { mapTypeParameter } from './mapTypeParameter';
import {
    mapType,
    mapPropertyName,
    mapPropertySignatureOrDeclaration,
    mapFunction,
} from './mapType';
import { NotImplementedError } from './error';

function hasExportModifier(node: ts.Node) {
    return !!node.modifiers && node.modifiers.some(x => x.kind === ts.SyntaxKind.ExportKeyword);
}

function hasDefaultModifier(node: ts.Node) {
    return !!node.modifiers && node.modifiers.some(x => x.kind === ts.SyntaxKind.DefaultKeyword);
}

function mapTypeAliasDeclaration(
    node: ts.TypeAliasDeclaration,
    checker: ts.TypeChecker,
): flow.Statement {
    const o = flow.typeAlias(
        flow.identifier(node.name.text),
        node.typeParameters
            ? flow.typeParameterDeclaration(node.typeParameters.map(mapTypeParameter))
            : null,
        mapType(node.type, checker),
    );
    return hasExportModifier(node) ? flow.exportNamedDeclaration(o, []) : o;
}

function mapVariableStatement(
    node: ts.VariableStatement,
    checker: ts.TypeChecker,
): flow.Statement[] {
    return node.declarationList.declarations.map(decl => {
        if (!ts.isIdentifier(decl.name)) {
            throw new NotImplementedError(node);
        }
        let typ: flow.FlowType;
        if (decl.type) {
            typ = mapType(decl.type, checker);
        } else if (decl.initializer && ts.isStringLiteral(decl.initializer)) {
            typ = flow.stringLiteralTypeAnnotation(decl.initializer.text);
        } else if (decl.initializer && ts.isNumericLiteral(decl.initializer)) {
            typ = flow.numberLiteralTypeAnnotation(Number(decl.initializer.text));
        } else {
            throw new NotImplementedError(node);
        }
        const id = flow.identifier(decl.name.text);
        id.typeAnnotation = flow.typeAnnotation(typ);
        const o = flow.declareVariable(id);
        return hasExportModifier(node) ? flow.declareExportDeclaration(o) : o;
    });
}

function mapFunctionDeclaration(
    node: ts.FunctionDeclaration,
    checker: ts.TypeChecker,
): flow.Statement {
    if (!node.name) {
        throw new NotImplementedError(node);
    }
    const id = flow.identifier(node.name.text);
    id.typeAnnotation = flow.typeAnnotation(mapFunction(node, checker));

    const declaration = flow.declareFunction(id);
    if (hasExportModifier(node)) {
        const export_ = flow.declareExportDeclaration(declaration);
        export_.default = hasDefaultModifier(node);
        return export_;
    }
    return declaration;
}

function mapImportDeclaration(
    node: ts.ImportDeclaration,
    checker: ts.TypeChecker,
): flow.ImportDeclaration[] {
    if (!node.importClause) {
        // wo don't really care about module imports (eg. `import 'isomorphic-fetch';`), so skip those.
        return [];
    }
    const valueImports: (
        | flow.ImportSpecifier
        | flow.ImportDefaultSpecifier
        | flow.ImportNamespaceSpecifier)[] = [];
    const typeImports: (
        | flow.ImportSpecifier
        | flow.ImportDefaultSpecifier
        | flow.ImportNamespaceSpecifier)[] = [];
    if (node.importClause.name) {
        const id = flow.identifier(node.importClause.name.text);
        valueImports.push(flow.importDefaultSpecifier(id));
    }
    if (!ts.isStringLiteral(node.moduleSpecifier)) {
        throw new NotImplementedError(node);
    }
    const source = flow.stringLiteral(node.moduleSpecifier.text);

    if (node.importClause.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            const id = flow.identifier(node.importClause.namedBindings.name.text);
            valueImports.push(flow.importNamespaceSpecifier(id));
        } else if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const element of node.importClause.namedBindings.elements) {
                if (element.propertyName) {
                    // in this case `propertyName` is import, and `name` is local name
                    throw new NotImplementedError(node, 'local name of import');
                }
                const localName = flow.identifier(element.name.text);
                const importName = flow.identifier(
                    mapWellKnownImports(source.value, element.name.text),
                );
                const sym = checker.getSymbolAtLocation(element.name);
                const typ = sym && checker.typeToTypeNode(checker.getDeclaredTypeOfSymbol(sym));
                if (typ && typ.kind === ts.SyntaxKind.TypeReference) {
                    typeImports.push(flow.importSpecifier(localName, importName));
                } else {
                    valueImports.push(flow.importSpecifier(localName, importName));
                }
            }
        }
    }
    const result: flow.ImportDeclaration[] = [];
    if (valueImports.length > 0) {
        result.push(flow.importDeclaration(valueImports, source));
    }
    if (typeImports.length > 0) {
        const declaration = flow.importDeclaration(typeImports, source);
        declaration.importKind = 'type';
        result.push(declaration);
    }
    return result;
}

function mapInterfaceDeclaration(
    node: ts.InterfaceDeclaration,
    checker: ts.TypeChecker,
): flow.DeclareInterface {
    const id = flow.identifier(node.name.text);
    const properties = node.members.map(member => {
        if (ts.isPropertySignature(member)) {
            return mapPropertySignatureOrDeclaration(member, checker);
        }
        throw new NotImplementedError(node, 'interface member');
    });
    const indexers: Array<flow.ObjectTypeIndexer> | null = null; // TODO
    const callProperties: Array<flow.ObjectTypeCallProperty> | null = null; // ???
    const internalSlots: Array<flow.ObjectTypeInternalSlot> | null = null; // ???
    const exact = false; // Don't think interface can be exact

    const body = flow.objectTypeAnnotation(
        properties,
        indexers,
        callProperties,
        internalSlots,
        exact,
    );

    const typeParameters = node.typeParameters
        ? flow.typeParameterDeclaration(node.typeParameters.map(mapTypeParameter))
        : null;
    const extends_: Array<flow.InterfaceExtends> | null | undefined = []; // TODO
    return flow.declareInterface(id, typeParameters, extends_, body);
}

function isPrivate(node: ts.Node): boolean {
    return (
        !!node.modifiers &&
        node.modifiers.some(
            x =>
                x.kind === ts.SyntaxKind.PrivateKeyword ||
                x.kind === ts.SyntaxKind.ProtectedKeyword,
        )
    );
}

function mapClassDeclaration(node: ts.ClassDeclaration, checker: ts.TypeChecker): flow.Statement {
    if (!node.name) {
        throw new NotImplementedError(node, 'no name');
    }
    const name = node.name;
    const id = flow.identifier(name.text);
    const properties = node.members
        .filter(member => !isPrivate(member))
        .map(member => {
            if (ts.isConstructorDeclaration(member)) {
                if (node.typeParameters) {
                    throw new NotImplementedError(
                        node,
                        'constructor return type with type parameters',
                    );
                }
                member.type = ts.createTypeReferenceNode(name, undefined);
                const o = flow.objectTypeProperty(
                    flow.identifier('constructor'),
                    mapFunction(member, checker),
                );
                (o as any).method = true; // eslint-disable-line @typescript-eslint/no-explicit-any
                return o;
            }
            if (ts.isMethodDeclaration(member)) {
                return flow.objectTypeProperty(
                    mapPropertyName(member.name),
                    mapFunction(member, checker),
                );
            }
            if (ts.isPropertyDeclaration(member)) {
                return mapPropertySignatureOrDeclaration(member, checker);
            }
            throw new NotImplementedError(node, 'class member declaration');
        });
    if (node.members.some(ts.isIndexSignatureDeclaration)) {
        throw new NotImplementedError(node, 'indexers not supported in class');
    }
    const indexers: Array<flow.ObjectTypeIndexer> | null = null; // TODO
    const callProperties: Array<flow.ObjectTypeCallProperty> | null = null; // ???
    const internalSlots: Array<flow.ObjectTypeInternalSlot> | null = null; // ???
    const exact = false; // Don't think class can be exact

    const body = flow.objectTypeAnnotation(
        properties,
        indexers,
        callProperties,
        internalSlots,
        exact,
    );

    const typeParameters = node.typeParameters
        ? flow.typeParameterDeclaration(node.typeParameters.map(mapTypeParameter))
        : null;
    const extends_: Array<flow.InterfaceExtends> | null | undefined = []; // TODO

    const declaration = flow.declareClass(id, typeParameters, extends_, body);
    if (hasExportModifier(node)) {
        const export_ = flow.declareExportDeclaration(declaration);
        export_.default = hasDefaultModifier(node);
        return export_;
    }
    return declaration;
}

function mapExportDeclaration(node: ts.ExportDeclaration): flow.Statement | flow.Statement[] {
    if (!node.exportClause && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        return flow.exportAllDeclaration(flow.stringLiteral(node.moduleSpecifier.text));
    }
    if (!node.exportClause || node.exportClause.elements.length === 0) {
        return [];
    }
    const exportSpecifiers = node.exportClause.elements.map(element => {
        if (element.propertyName) {
            // in this case `propertyName` is import, and `name` is local name
            throw new NotImplementedError(node, 'local name of import');
        }
        const id = flow.identifier(element.name.text);
        return flow.exportSpecifier(id, id);
    });
    const declaration = flow.declareExportDeclaration(null, exportSpecifiers);
    if (node.moduleSpecifier) {
        if (!ts.isStringLiteral(node.moduleSpecifier)) {
            throw new NotImplementedError(node);
        }
        declaration.source = flow.stringLiteral(node.moduleSpecifier.text);
    }
    return declaration;
}

export function mapStatement(
    node: ts.Node,
    checker: ts.TypeChecker,
): flow.Statement | flow.Statement[] {
    if (ts.isTypeAliasDeclaration(node)) {
        return mapTypeAliasDeclaration(node, checker);
    } else if (ts.isVariableStatement(node)) {
        return mapVariableStatement(node, checker);
    } else if (ts.isFunctionDeclaration(node)) {
        return mapFunctionDeclaration(node, checker);
    } else if (ts.isImportDeclaration(node)) {
        return mapImportDeclaration(node, checker);
    } else if (ts.isExportDeclaration(node)) {
        return mapExportDeclaration(node);
    } else if (ts.isInterfaceDeclaration(node)) {
        return mapInterfaceDeclaration(node, checker);
    } else if (ts.isClassDeclaration(node)) {
        return mapClassDeclaration(node, checker);
    } else if (ts.isExportAssignment(node)) {
        if (!ts.isIdentifier(node.expression)) {
            throw new NotImplementedError(node, 'only identifiers supported');
        }
        return flow.exportDefaultDeclaration(flow.identifier(node.expression.text));
    } else {
        throw new NotImplementedError(node);
    }
}

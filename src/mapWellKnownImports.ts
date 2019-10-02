const modules: { [moduleName: string]: { [typeName: string]: string } } = {
    express: {
        Request: '$Request',
        Response: '$Response',
        Application: '$Application',
        NextFunction: 'NextFunction',
        RequestHandler: 'Middleware',
        ErrorRequestHandler: 'Middleware',
    },
};

export function mapWellKnownImports(source: string, importName: string) {
    if (modules.hasOwnProperty(source) && modules[source].hasOwnProperty(importName)) {
        return modules[source][importName];
    }
    return importName;
}

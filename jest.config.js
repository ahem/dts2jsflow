module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    coveragePathIgnorePatterns: ['<rootDir>/node_modules/'],
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.yarncache/'],
    globals: {
        'ts-jest': {
            diagnostics: {
                ignoreCodes: [],
                pathRegex: /\.(spec|test)\.ts$/,
            },
        },
    },
};

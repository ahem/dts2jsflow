module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    extends: ['plugin:@typescript-eslint/recommended', 'prettier', 'prettier/@typescript-eslint'],
    plugins: ['prettier'],
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2018,
    },
    env: {
        es6: true,
        node: true,
    },
    rules: {
        'prettier/prettier': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/prefer-interface': 'off',
        '@typescript-eslint/explicit-member-accessibility': 'off',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-use-before-define': ['error', { functions: false, typedefs: false }],
    },
};

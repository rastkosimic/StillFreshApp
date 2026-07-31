module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  env: {
    es2021: true,
    node: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // On the main branch, DEV_LOCATION_ENABLED must be false.
      // Run this check via CI: eslint --rule 'no-restricted-syntax: ...' src/config/devLocation.ts
      files: ['src/config/devLocation.ts'],
      rules: {
        'no-restricted-syntax': [
          process.env.BRANCH === 'main'
            ? 'error'
            : 'off',
          {
            selector:
              'VariableDeclarator[id.name="DEV_LOCATION_ENABLED"] > Literal[value=true]',
            message:
              'DEV_LOCATION_ENABLED must be false on the main branch. Set it to false before merging.',
          },
        ],
      },
    },
  ],
};

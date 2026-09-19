import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.js', '**/*.mjs'],
  },
  // Base rules — no type information required
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      'no-restricted-globals': ['error',
        { name: 'setTimeout',    message: 'Use tweens.after() on a TweenManager instance instead.' },
        { name: 'setInterval',   message: 'Use tweens.every() on a TweenManager instance instead.' },
        { name: 'localStorage',  message: 'Use SaveSystem instead of localStorage.' },
        { name: 'sessionStorage', message: 'Use SaveSystem instead of sessionStorage.' },
      ],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['pixi.js', 'pixi.js/*'], message: 'Import from @emptysock/engine only.' },
          { group: ['@dimforge/rapier2d*'], message: 'Import from @emptysock/engine only.' },
          { group: ['howler', 'howler/*'], message: 'Import from @emptysock/engine only.' },
          { group: ['three', 'three/*'], message: 'Import from @emptysock/engine only.' },
        ],
      }],
    },
  },
  // Typed rules — require parserOptions.project; scoped to src/ only to exclude config files
  {
    files: [
      'apps/ide/src/**/*.ts',
      'apps/ide/src/**/*.tsx',
      'packages/engine/src/**/*.ts',
      'packages/types/src/**/*.ts',
      'packages/toolchain/src/**/*.ts',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
    },
  },
];

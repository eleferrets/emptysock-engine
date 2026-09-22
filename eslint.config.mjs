import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/dist-types/**',
      '**/node_modules/**',
      '**/*.js',
      '**/*.mjs',
    ],
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
    },
  },
  // Game-code rules — apply only to packages (not the IDE, which legitimately
  // uses setTimeout for React DOM work and imports pixi.js for engine internals).
  // Engine implementation files that ARE the wrappers are excluded: they legitimately
  // use localStorage (SaveSystem), setInterval (IDEBridge heartbeat), and pixi/howler/rapier.
  {
    files: [
      'packages/engine/src/**/*.ts',
      'packages/types/src/**/*.ts',
      'packages/toolchain/src/**/*.ts',
    ],
    ignores: [
      'packages/engine/src/systems/SaveSystem.ts',
      'packages/engine/src/systems/VariableStore.ts',
      'packages/engine/src/systems/AudioSystem.ts',
      'packages/engine/src/systems/RenderSystem.ts',
      'packages/engine/src/systems/RenderPipeline.ts',
      'packages/engine/src/systems/AssetManifest.ts',
      'packages/engine/src/systems/LightingSystem.ts',
      'packages/engine/src/systems/CustomShaderFilter.ts',
      'packages/engine/src/systems/PhysicsSystem.ts',
      'packages/engine/src/systems/CameraSystem.ts',
      'packages/engine/src/core/IDEBridge.ts',
      'packages/engine/src/types/aliases.ts',
      'packages/engine/src/systems/VNTextbox.ts',
      'packages/engine/src/__tests__/RenderPipeline.test.ts',
      'packages/engine/src/__tests__/ViewportSystem.test.ts',
      'packages/engine/src/__tests__/AssetManifest.test.ts',
      'packages/engine/src/ecs/systems/RenderPipeline.ts',
      'packages/engine/src/__tests__/ecs/RenderPipeline.test.ts',
      'packages/engine/src/ecs/systems/PhysicsSystem.ts',
      'packages/engine/src/ecs/systems/PhysicsSystem3D.ts',
    ],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
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
      // Catches `async onUpdate()` — the engine discards the returned Promise,
      // so any work after an await runs outside the frame budget silently.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: true }],
      '@typescript-eslint/require-await': 'error',
    },
  },
];

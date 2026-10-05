import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/dist-types/**",
      "**/node_modules/**",
      "**/*.js",
      "**/*.mjs",
      // Checked-in fallback stub for a build-generated file (the real
      // engineBundle.generated.ts is produced by engine-runtime.build.mjs
      // and is itself gitignored) — not part of apps/ide's tsconfig
      // `include`, so typed linting has no project to resolve it against.
      "apps/ide/src/runtime/engineBundle.generated.d.ts",
    ],
  },
  // Base rules — no type information required
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  // Game-code rules — apply only to packages (not the IDE, which legitimately
  // uses setTimeout for React DOM work and imports pixi.js for engine internals).
  // Engine implementation files that ARE the wrappers are excluded: they legitimately
  // use localStorage (SaveSystem), setInterval (IDEBridge heartbeat), and pixi/howler/rapier.
  {
    files: [
      "packages/engine/src/**/*.ts",
      "packages/types/src/**/*.ts",
      "packages/toolchain/src/**/*.ts",
    ],
    ignores: [
      "packages/engine/src/systems/SaveSystem.ts",
      "packages/engine/src/systems/VariableStore.ts",
      "packages/engine/src/systems/AudioSystem.ts",
      "packages/engine/src/systems/RenderSystem.ts",
      "packages/engine/src/systems/RenderPipeline.ts",
      "packages/engine/src/systems/TextureStore.ts",
      "packages/engine/src/__tests__/BitmapFont.test.ts",
      "packages/engine/src/__tests__/TextureStore.test.ts",
      "packages/engine/src/systems/CustomShaderFilter.ts",
      "packages/engine/src/systems/RainGlassFilter.ts",
      "packages/engine/src/systems/PhysicsSystem.ts",
      "packages/engine/src/systems/PhysicsSystem3D.ts",
      "packages/engine/src/systems/CameraSystem.ts",
      "packages/engine/src/types/aliases.ts",
      // Rebind-capture timeout is real wall-clock UI time, not game time, so a
      // TweenManager (which ticks with the game loop) would never fire while paused.
      "packages/engine/src/Input.ts",
      "packages/engine/src/ui/UISystem.ts",
      "packages/engine/src/__tests__/RenderPipeline.test.ts",
      "packages/engine/src/__tests__/RenderSystem.test.ts",
      "packages/engine/src/__tests__/RenderSystemLighting.test.ts",
      "packages/engine/src/__tests__/RenderSystemMultiCamera.test.ts",
      "packages/engine/src/__tests__/RenderPipelineProjection3D.test.ts",
      "packages/engine/src/__tests__/RenderPipelineParticles.test.ts",
      "packages/engine/src/__tests__/RenderPipelineShaders.test.ts",
      "packages/engine/src/__tests__/RenderPipelineLighting.test.ts",
      "packages/engine/src/__tests__/SpriteFlash.test.ts",
      "packages/engine/src/__tests__/ViewportSystem.test.ts",
      "packages/engine/src/__tests__/UISystem.test.ts",
    ],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "setTimeout",
          message: "Use tweens.after() on a TweenManager instance instead.",
        },
        {
          name: "setInterval",
          message: "Use tweens.every() on a TweenManager instance instead.",
        },
        {
          name: "localStorage",
          message: "Use SaveSystem instead of localStorage.",
        },
        {
          name: "sessionStorage",
          message: "Use SaveSystem instead of sessionStorage.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["pixi.js", "pixi.js/*"],
              message: "Import from @emptysock/engine only.",
            },
            {
              group: ["@dimforge/rapier2d*"],
              message: "Import from @emptysock/engine only.",
            },
            {
              group: ["howler", "howler/*"],
              message: "Import from @emptysock/engine only.",
            },
            {
              group: ["three", "three/*"],
              message: "Import from @emptysock/engine only.",
            },
          ],
        },
      ],
    },
  },
  // Typed rules — require parserOptions.project; scoped to src/ only to exclude config files
  {
    files: [
      "apps/ide/src/**/*.ts",
      "apps/ide/src/**/*.tsx",
      "packages/engine/src/**/*.ts",
      "packages/types/src/**/*.ts",
      "packages/toolchain/src/**/*.ts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      // Catches `async onUpdate()` — the engine discards the returned Promise,
      // so any work after an await runs outside the frame budget silently.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: true },
      ],
      "@typescript-eslint/require-await": "error",
    },
  },
  // Tests index arrays/matches they just constructed; under noUncheckedIndexedAccess
  // `x[0]!` is the idiomatic assertion (a wrong index fails the test loudly anyway).
  {
    files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];

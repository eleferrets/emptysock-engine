import { defineConfig, mergeConfig, type UserConfig } from "vitest/config";

/**
 * Shared Vitest defaults for the optional `@emptysock/*` module packages
 * (`packages/vn`, `packages/battle`, `packages/tilemap`, `packages/network`, …).
 * Each package's own `vitest.config.ts` imports `moduleTestPackageDefaults()`
 * (or `withModulePackageDefaults()` when it needs its own deltas merged in)
 * instead of hand-copying this block —
 * see CLAUDE.md's "Non-obvious decisions" for why the three configs drifted
 * before this existed.
 */
export function moduleTestPackageDefaults(): UserConfig {
  return defineConfig({
    test: {
      environment: "node",
      include: ["src/**/__tests__/**/*.test.ts"],
    },
  });
}

export function withModulePackageDefaults(overrides: UserConfig): UserConfig {
  return mergeConfig(moduleTestPackageDefaults(), overrides);
}

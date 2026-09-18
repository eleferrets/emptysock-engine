# EmptySock Engine — TypeScript Upgrade Todo

## Pending toolchain upgrades

### TypeScript 7.1 (target: autumn 2026)

TypeScript 7.1 is expected in autumn 2026. When it ships:

1. Update `typescript` in the root `package.json` from `~6.0.3` to `~7.1.0`.
2. Update `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` to a compatible release (check [typescript-eslint releases](https://github.com/typescript-eslint/typescript-eslint/releases)).
3. Switch `tsconfig.base.json` from `isolatedModules: true` to `verbatimModuleSyntax: true` (the recommended TS 7 approach) and fix any resulting `import type` errors.
4. Review the `target` and `lib` fields — TS 7 may ship with updated `ES2024`+ libs.
5. Run `pnpm typecheck` across all packages and address any new strict errors.

### esbuild / esbuild-wasm

- Keep `esbuild-wasm` version in `apps/ide/package.json` in lock-step with the `esbuildWasmUrl` import in `GameBuildService.ts`. The `?url` import ensures the self-hosted WASM file always matches the installed package version — never hardcode a CDN URL.
- When esbuild releases a new major, regenerate the engine prebundle (`pnpm --filter @emptysock/ide run predev`) and verify the output size.

## Resolved architectural items

All items from `apps/ide/HANDOFF.md` are complete:

| Item                                             | Status                                                          |
| ------------------------------------------------ | --------------------------------------------------------------- |
| Self-host esbuild WASM in Netlify/Vercel deploy  | ✅ Fixed — Vite `?url` import                                   |
| COOP/COEP headers for SharedArrayBuffer          | ✅ Fixed — added to `vite.config.ts` dev/preview                |
| `Engine.logErrorToFile` Tauri boundary violation | ✅ Fixed — replaced with `Engine.onFileLog()` handler           |
| Scene Inspector real ECS binding                 | ✅ Done — live `ideBridge` channel                              |
| Entity Properties real ECS binding               | ✅ Done — live component patch dispatch                         |
| Asset Browser backend storage                    | ✅ Done — `AssetStore.ts` with `BrowserFileStore`               |
| Project save/load                                | ✅ Done — `.emptysock` files via File System Access API + Tauri |
| Multi-file project tree (real, not mock)         | ✅ Done — `ProjectService.openDirectory()` + `DiskTreeRow`      |
| Hot-reload on code change                        | ✅ Done — `CanvasPreview.tsx` debounces 500 ms on `openFiles`   |

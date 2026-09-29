# EmptySock Engine

Monorepo: `packages/engine` (ECS runtime, one export surface `src/index.ts`), `packages/types`, `packages/toolchain` (CLI + GMS2 importer), `packages/network`, `packages/vn`, `packages/battle`, `packages/tilemap`, `apps/ide` (Tauri v2 + React/Vite).

Read before working:

- `HANDOFF.md`: session handoff and orchestration method.
- `gpu_followup_real_browser.md`: open items, unverified-on-GPU items, and the full historical decision record.
- `docs/README.md`: documentation map.

Hard rules:

- The engine package imports no DOM, no Tauri, nothing from `apps/ide`; only the standard library and other `@emptysock/*` packages.
- `onUpdate` must not be async.
- Never name reference projects used during development in engine code, comments, tests or notes.
- New engine exports go through `packages/engine/src/index.ts` and `dist-types` must not drift from it.

Commits: Conventional Commits, lowercase subject, no `--no-verify` (Husky + commitlint + lint-staged).

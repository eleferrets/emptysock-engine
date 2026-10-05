# EmptySock Engine

Archived project: development has stopped. Keep changes minimal.

Monorepo: `packages/engine` (ECS runtime, one export surface `src/index.ts`), `packages/types`, `packages/toolchain` (CLI), `packages/network`, `packages/vn`, `packages/battle`, `packages/tilemap`, `packages/export-utils`, `apps/ide` (Tauri v2 + React/Vite).

Read before working: `README.md` (overview), `docs/README.md` (documentation map).

Hard rules:

- The engine package imports no DOM, no Tauri, nothing from `apps/ide`.
- `onUpdate` must not be async.
- New engine exports go through `packages/engine/src/index.ts`; `packages/engine/dist-types` must not drift from it (`build:types`, then prettier).

Commits: Conventional Commits, lowercase subject, no `--no-verify` (Husky + commitlint + lint-staged).

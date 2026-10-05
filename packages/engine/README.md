# @emptysock/engine

> Deprecated. Development has stopped; kept as a reference.

The EmptySock runtime. ECS storage via bitECS behind a friendly `Entity`/`Component` API, scene lifecycle and transitions, a PixiJS render pipeline (WebGL or WebGPU), Rapier 2D/3D physics, input and gamepad, audio, Yoga-based UI widgets, localisation, save system and the actor model.

- Single export surface: `src/index.ts`. Nothing in this package imports the DOM-only IDE, Tauri, or anything from `apps/ide`.
- `dist-types/` is the committed type surface, guarded by `scripts/distTypesUpToDate.test.mjs`.

```bash
pnpm --filter @emptysock/engine build
pnpm --filter @emptysock/engine test
pnpm --filter @emptysock/engine build:types   # then run prettier over dist-types
```

Docs: [`docs/guides`](../../docs/guides) and [`docs/reference`](../../docs/reference).

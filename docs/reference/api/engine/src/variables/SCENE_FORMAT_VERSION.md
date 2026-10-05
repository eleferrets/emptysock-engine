[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SCENE\_FORMAT\_VERSION

# Variable: SCENE\_FORMAT\_VERSION

> `const` **SCENE\_FORMAT\_VERSION**: `2`

Defined in: engine/src/SceneDocument.ts:15

Unified scene document (`SceneDocument`, `formatVersion: 2`) - the one
on-disk `.scene.json` shape shared by the IDE, the toolchain and
the runtime loader.

The engine is zod-free, so these are structural interfaces mirroring the
zod schemas in `@emptysock/types` (`packages/types/src/scene.ts`), which
are the validation source of truth for tools that can depend on zod. The
engine validates with `parseSceneDocument` (SceneMigrations.ts).

Rule: readers accept every older version (via `migrateScene`), writers emit
only `SCENE_FORMAT_VERSION`.

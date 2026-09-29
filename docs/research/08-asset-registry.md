# 08 Typed AssetRegistry (research, read-only; nothing verified by running, node_modules absent)

Paths relative to `packages/`. Line numbers from reading the current tree.

## 1. Problem: every honest-zero / stub getter (compat)

| Function | Location | Returns | Note |
|---|---|---|---|
| `sprite_get_width(ctx,_sprite)` | engine/src/compat/gmlActions.ts:1385 | `0` | doc block 1366-1383 names the missing "import-time asset manifest" |
| `sprite_get_height` | gmlActions.ts:1393 | `0` | |
| `sprite_exists` | gmlActions.ts:1401 | `false` | worse than 0: makes real `if (sprite_exists(x))` guards skip |
| `font_get_size(_fontId)` | engine/src/compat/gml.ts:1193 | `0` | doc 1182-1191; no ctx param at all (pure function) |
| `object_exists(_name)` | gml.ts:877 | `true` + console.warn | opposite honesty: always true |
| `asset_get_index(name)` | gml.ts:885 | returns name unchanged | identity stub, cannot answer "missing" (-1) |
| `room_exists(ctx,name)` | gmlActions.ts:528 | real (`ctx.rooms`) | already correct; model for the others |
| `layer_sprite_get_id` | gmlLayer.ts:145 | real (live LayerElement), not a registry gap | doc referenced as the "no registry" convention |
| `working_directory` | gml.ts:1309 | `""` | unrelated (fs boundary), not in scope |

Not present at all (would be silent transpile passthrough or undefined): `sprite_get_number`, `sprite_get_xoffset/yoffset`, `sprite_get_name`, `font_exists`, `font_get_name`, `audio_exists`/`sound_exists`, `script_exists`, `tileset` getters, `shader_is_compiled` (gmlShaders.ts:92, separate registry). grep of `sprite_get_width|font_get_size|sprite_exists` in engine/toolchain `__tests__` finds NO tests, so current zeros are untested.

Transpiler hooks: `sprite_get_width/_height/sprite_exists` are in the threaded-call list (toolchain/src/gms2-transpile.ts:3142-3149, receive `_ctx`); `font_get_size` is in THREADED_PURE_FUNCTIONS (gms2-transpile.ts:3406), so it gets NO ctx. Must move to the ctx-threaded list.

## 2. What the runtime already has and its identity conventions

- Bare sprite name in GML is rewritten to the string `"./assets/sprites/<name>/frame_0.png"`; every other kind (object, sound, font, room, shader) to `JSON.stringify(name)` (gms2-transpile.ts:5356-5383, `kindByName`; ambiguous names silently deleted at :5343).
- Generated sprite module (toolchain/src/gms2-codegen.ts:974-1017) already contains `name,width,height,frameCount,frameSpeed,texturePath,frames`; multi-frame `texturePath` is `frame_{n}.png` while the transpiled sprite id is always `frame_0.png`. So the registry lookup for sprites must accept: bare name, `.../<name>/frame_0.png`, and `.../<name>/frame_{n}.png` (normalise by regex `/assets\/sprites\/([^/]+)\//`).
- Font: `FontRegistry` (engine/src/systems/FontRegistry.ts) holds descriptor (family,size,bold,italic) and optional `BitmapFontDef` keyed by font name; the descriptor has `size`, so `font_get_size` is answerable today if the compat layer can reach `ctx.game.fonts`.
- `ctx.rooms` (`GmlActionContext.rooms`, gmlActions.ts:67) and `ctx.sounds` (:77) are ad hoc per-kind maps wired by the host.
- `project-manifest.json` (`projectManifestJSON`, gms2-codegen.ts:1413) lists only prefabs/behaviors/scenes.
- Name clash to avoid: @emptysock/types already exports `AssetManifestSchema`/`AssetEntrySchema`/`AssetType` (types/src/index.ts:93-122; loader-oriented `{id,name,type,path}`) and the engine has class `AssetManifest` (loader, docs/reference/systems/asset-manifest.md). The new thing MUST be named differently (`AssetRegistry`, `AssetIndex*`).

## 3. Design

### 3.1 Manifest schema (types/src/index.ts, zod like its neighbours)
```ts
export const AssetKindSchema = z.enum(["sprite","font","sound","object","room","script","shader","tileset","path","timeline","sequence","note"]);
export const AssetIndexEntrySchema = z.object({
  kind: AssetKindSchema,
  name: z.string(),            // GameMaker resource name, unique per kind
  id: z.string(),              // runtime reference string as transpiled (sprite: texture path; others: name)
  width: z.number().int().nonnegative().optional(),   // sprite, tileset tile, bitmap font atlas cell n/a
  height: z.number().int().nonnegative().optional(),
  frameCount: z.number().int().positive().optional(), // sprite
  originX: z.number().optional(), originY: z.number().optional(), // sprite (already in SpriteAsset)
  size: z.number().optional(),                         // font point size
  bold: z.boolean().optional(), italic: z.boolean().optional(),
  path: z.string().optional(),                         // primary file, relative to out dir
});
export const AssetIndexSchema = z.object({
  version: z.literal(1),
  entries: z.array(AssetIndexEntrySchema),
  collisions: z.array(z.object({ name: z.string(), kinds: z.array(AssetKindSchema) })).default([]),
});
```
Emitted as `asset-index.json` next to `project-manifest.json`. Deterministic order (sort by kind, name) so it diffs cleanly.

### 3.2 Importer emission (packages/toolchain)
- In `importGMS2Project` (gms2-import.ts) collect an `AssetIndexEntry[]`: sprites at the loop at :379 (data from `convertGms2Sprite`/`SpriteAsset` in gms2-sprite-import.ts:13-40; today `buildSpriteAsset` only returns a string, so change it to return `{content, entry}` or add a sibling pure `spriteIndexEntry(sprite)`); fonts at :668 (`FontAsset.size/bold/italic`); sounds :637; objects/rooms/scripts from existing name lists; shaders/tilesets likewise.
- Only converted assets get entries (skipped ones stay out; consistent with "missing asset" handling `setGmlMissingAssetNames` at :321).
- Write with `filesToWrite.push({rel:"asset-index.json", ...})` near :902. Add a pure builder `buildAssetIndex(entries)` in a new `gms2-asset-index.ts` (validate with `AssetIndexSchema.parse`, needs toolchain dep on @emptysock/types; check package.json before assuming).
- Also emit a generated `assets/index.ts` re-export? Not needed; JSON keeps the engine bundler-agnostic. Optionally a thin `asset-index.ts` (`export default {...} as const`) for hosts that cannot fetch JSON.
- Collisions: compute per-name kind set; write to `collisions`; add a `warnings.push(...)` and a migration-report entry. This is the same data the item-1 symbol-table plan wants (docs/research/01, "lookupAsset(name).collisions"); share the collision detector rather than duplicating `kindByName`.

### 3.3 Engine registry (packages/engine/src/systems/AssetRegistry.ts)
`Game`-scoped service, same pattern as FontRegistry/PluginSystem (Services.ts; Game constructor registers; exposed as `game.assets`, `ctx.assets` via SceneLifecycle). No module singleton (test isolation rule in font-registry.md).
```ts
class AssetRegistry {
  load(index: AssetIndex): void;                 // replaces, validates via schema, builds Map<kind, Map<name,entry>> + byId
  register(entry: AssetIndexEntry): void;        // manual/test use, overwrites within kind
  exists(kind: AssetKind, ref: unknown): boolean;
  get(kind: AssetKind, ref: unknown): AssetIndexEntry | undefined;   // ref = name | id | sprite path (normalised)
  resolve(ref: unknown): AssetIndexEntry[];      // all kinds; length>1 = collision
  spriteSize(ref): {width,height}|undefined;  frameCount(ref): number|undefined;
  names(kind): string[];  clear(): void;
}
```
Font size/existence: `font_get_size` should consult `game.assets` first, falling back to `game.fonts.get(id)?.size`, so hand-registered fonts (no importer) work. Keep `FontRegistry` as the owner of rendering data; the AssetRegistry holds only lookup facts. Do not duplicate BitmapFontDef.

### 3.4 Compat wiring
- Add `readonly assets?: AssetRegistry` to `GmlActionContext` (gmlActions.ts ~:55-92) and fill it in the same place `rooms`/`sounds` are wired by `GmlBehaviorSystem`/host bootstrap (search `GmlBehaviorSystem` construction).
- `sprite_get_width/height/exists`: `ctx.assets?.spriteSize(ref)`; no registry wired -> keep today's `0/0/false` (documented, still "honest"). `sprite_exists` given a registry answers true/false truthfully. Keep signature (`ctx, sprite: unknown`), so no transpiler change for them.
- `font_get_size`: change signature to `(ctx, fontId)`, move name from THREADED_PURE_FUNCTIONS (gms2-transpile.ts:3406) to the threaded list; update its doc at gml.ts:1182 and the working_directory comment (gml.ts:1309).
- `object_exists`: `ctx`-thread; true iff registry has object (or, without registry, keep old warn+true to avoid breaking existing behaviour). `asset_get_index`: return `-1`-equivalent? GML returns -1 for missing; today returns the name. Recommend: with registry, return the id if found else `-1`; without, unchanged. This is a behaviour change, gate on registry presence.
- Add missing: `sprite_get_number`, `sprite_get_xoffset/yoffset`, `sprite_get_name`, `font_exists`, `audio_exists` (registry-backed), each in the threaded list.
- Host: game shell templates (toolchain/src/gameShellTemplates.ts) load `asset-index.json` and call `game.assets.load()` beside the existing room/sound wiring.

### 3.5 Name / id collisions across kinds
GameMaker itself enforces unique resource names across ALL kinds (one namespace), so a real project should never collide; collisions come from (a) our own generated names, e.g. sprite `spr_x` vs script `spr_x` after manual edits, (b) imports with broken/stale .yyp entries, (c) case differences (macOS FS). Policy: index keyed `(kind,name)`, so storage never collides; `resolve(name)` returns all kinds; `exists(kind, ref)` is kind-scoped; API taking an untyped `ref` in a kind-typed function (sprite_exists) only looks at its kind. Importer records collisions and warns; the transpiler keeps its current "drop ambiguous" behaviour until the item-1 symbol table replaces it. Id spaces differ: sprite id is a path, others are names; a sprite named `X` and an object named `X` have different ids, so `byId` never collides across those; two non-sprite kinds with same name do (`resolve()` reports).
Case: compare case-sensitively (GML is), but flag case-insensitive duplicates in the importer as a warning.

## 4. Tests
Engine (`engine/src/__tests__/AssetRegistry.test.ts`, pixi-free, same style as FontRegistry.test.ts):
1. load then `exists/get` per kind; unknown returns false/undefined.
2. sprite lookup by name, by `frame_0.png` path, by multi-frame `frame_{n}` path; dims and frameCount.
3. collision: same name in sprite+object -> `resolve` length 2, kind-scoped `exists` right.
4. `load` twice replaces; `clear`; invalid JSON fails schema (bad kind) with clear error.
compat: extend `compatGml.test.ts` or new `gmlAssets.test.ts`: `sprite_get_width/height/exists` with and without `ctx.assets`; `font_get_size` with registry, with FontRegistry only, with neither (0); `object_exists`, `asset_get_index` (-1 when registry present and missing).
Toolchain: `gms2-asset-index.test.ts` for `buildAssetIndex` (sorted, schema-valid, collision list); extend `gms2-import.test.ts` to assert `asset-index.json` written with a sprite entry whose width/height/frameCount match the fixture (use the existing synthetic fixtures; do not name real projects); transpile test that `font_get_size(fnt_x)` is emitted with `_ctx` (and `sprite_exists`).
Types: schema round-trip in types tests.

## 5. Sweep steps and file ownership (one owner per file; order matters)
1. types: `types/src/index.ts` + types test (schema). Owner A.
2. engine: new `systems/AssetRegistry.ts`, export in `engine/src/index.ts`, register in `Game.ts`, `SceneLifecycle` field; new test. Owner B.
3. engine compat: `compat/gmlActions.ts` (sprite fns, ctx field), `compat/gml.ts` (font_get_size, object_exists, asset_get_index), new getters; tests. Owner C (depends on 2).
4. toolchain: `gms2-sprite-import.ts` (expose entry), `gms2-codegen.ts` (buildSpriteAsset return shape; 974), new `gms2-asset-index.ts`, `gms2-import.ts` (collect+write), `gms2-transpile.ts` (threaded lists :3142-3149, :3406), `gms2-report.ts` (collision entries); tests. Owner D (depends on 1; transpile edit shares file with the parse/symbol-table item 1, so coordinate/sequence after it).
5. host templates: `gameShellTemplates.ts` load asset-index. Owner D or E.
6. docs last (frozen per research item 12 until told): reference page for AssetRegistry.
Steps 2 and 4 can run in parallel after 1.

## 6. Risks
- `gms2-transpile.ts` is 258 KB and item 1 rewrites its asset pass; edits there conflict. Keep step-4 transpile edit to two list moves.
- Changing `font_get_size` arity breaks any already-generated behaviors that call it pure: generated code is regenerated on import, but hand-written games calling `font_get_size(id)` break. Mitigate: accept both `(fontId)` and `(ctx,fontId)` via overload for one release.
- `asset_get_index` returning -1 could regress games relying on identity; gate on registry presence.
- Name confusion with existing `AssetManifest`/types `AssetManifestSchema`; use `AssetIndex*` naming.
- Multi-frame sprite path mismatch (`frame_{n}` vs transpiled `frame_0`) is a latent bug in id normalisation; test it.
- `zod` in toolchain: verify dependency edge (cannot run install here).
- Stale index vs code (index generated, hosts forget to load): registry absent must degrade to the current documented zeros, never throw.
- Non-image sprites (GMS2 sprites with sequences / 0 frames) may have width 0 legitimately; do not treat 0 as missing, use `exists`.

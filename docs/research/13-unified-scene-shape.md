# 13 - Unified scene shape (research item 13)

Status: research only, nothing implemented. Paths are repo-relative. Decision from the user: design a NEW shape, neither `EntitySchema` nor `SceneFile` as-is, shared by IDE, toolchain, importer and runtime. Builds on 06 (EntityRef remap) and 07 (SceneTransfer, room persistence).

## 1. Inventory

### 1.1 Shape A - `EntitySchema` / `SceneSchema` (`packages/types/src/index.ts`)
Definition: `ComponentDataSchema` `:54`, `EntitySchema` `:60-67` (uuid `id`, `name`, `tags`, `active`, `components: [{type,data}]`, recursive `children`), `SceneSchema` `:71-87` (uuid `id`, `name`, `version`, `backgroundColor`, `entities`, `metadata`).
- Producers: none. No code builds an `EntityData`/`Scene` value.
- Consumers: only `packages/types/src/__tests__/schemas.test.ts:154-175` (SceneSchema parse tests). No app, engine or toolchain import of `EntitySchema`, `EntityData` or `SceneSchema` (grep clean). Effectively dead schema, so replacing it is free.
- Look-alikes (not this shape, same ideas): IDE `EntityItem {id,name,type,active,components:string[],children}` at `apps/ide/src/store/ideTypes.ts:40-47` (used by `ideStore.ts:100`, `SceneInspector.tsx:58,134,150-175`) and `EntitySnapshot` `ideTypes.ts:57`. These are in-memory hierarchy view models with no disk format; `SceneInspector` `children` walk is IDE-only.

### 1.2 Shape B - runtime `SceneFile` (`packages/engine/src/SceneFile.ts`)
Definition: `PrefabFileComponentEntry` `:24`, `PrefabFile` `:31`, `SceneFilePrefabInstance` `:42-49` (`prefab`, `props`, `gmlVars`, `pool`), `SceneFileEntity` `:52` (`components:[{component,overrides}]` only), `SceneFileView` `:66-82`, `SceneFile` `:85-98` (`sceneName`, `systems`, `prefabInstances`, `entities`, `viewsEnabled`, `roomWidth/Height`, `views`). No ids, no hierarchy, no version, no scene-level persistent (07 proposes adding `persistent?`).
- Loader: `loadSceneFile` `:244` (prefab instances first, then direct entities; `onSpawned` hook; `stampPrefabNameOntoMeta` `:227`), `parsePrefabFile` `:129`, `parsePrefabFiles`. Exported via `packages/engine/src/index.ts` (types `SceneFile*`, `loadSceneFile`).
- Runtime consumers: `GmsRuntime.ts:7-10,88,311` (rooms map, `loadSceneFile` call, `applyRoomViews`), `compat/gmlCamera.ts:54,671-700` (`SceneFileView`), `compat/gmlActions.ts:33,773` (`stampPrefabNameOntoMeta`), `components/LayerElement.ts:7` and `compat/gmlLayer.ts:116` (layer elements are `entities[]` entries), `__tests__/gmlCamera.test.ts:8,243`.
- Persistence writer/reader (separate blob, not the scene file): `systems/SaveSystem.ts:14` (`components: Record<string, SavedComponent>` - already a name-keyed map with per-component version), `:18` `SaveBlob`; carry-over `GmsRuntime.ts:339` `snapshotPersistent`, `:377` `restorePersistent`, `:396` old-eid remap (the only ref remap today).
- Producers: `packages/toolchain/src/gms2-codegen.ts:1026-1100` `buildRoomSceneJSON` (emits `{sceneName, prefabInstances}`; `:1085-1097`; `roomInstanceProps` `:1040`), `gms2-import.ts:454-521` (parses that JSON, appends background/layer entities `:454-475`, `views`/`viewsEnabled` `:484`, writes `rooms/<name>.scene.json` `:521`), `gms2-room-import.ts:513` (`RoomSceneFileView` mirror), `:539` `buildRoomSceneFileViews`, `:558-574` direct-entity mirror type, `:724` layer-element entities, `:455` reads `roomSettings`. Report text `gms2-report.ts:217-275`. Prefab side: `gms2-codegen.ts:171` `buildObjectPrefabJSON` (writes `Meta.persistent`), `prefabCodegen.ts:68,86` + `prefabCodegenCli.ts:21-55` (read `*.prefab.json` only; no scene reads).
- IDE consumers/producers: `apps/ide/src/components/panels/RoomEditor.tsx:2,92-94` (state), `:197` `parseSceneFile` (keeps unknown top-level keys in `extra`), `:216` `serializeSceneFile`, `:226-264` instance position/transform helpers, `:444-460` save; `roomEditorExtras.ts:7-80` (views/entities read as `Record<string,unknown>` extras); `asset-browser/AssetPreviewPopover.tsx:147-159` (sniffs `prefabInstances`); tests `apps/ide/src/__tests__/RoomEditor.test.tsx` (many), `roomEditorExtras.test.ts`, `AssetBrowserOpenIn.test.tsx:27`.
- On-disk files: no checked-in `*.scene.json` or `*.prefab.json` (find clean). `templates/{blank,platformer,visual-novel}` contain only `emptysock.project.json` and `src/scenes/GameScene.ts` (code scenes, no JSON scenes). Only real files are importer output in user projects (`rooms/<name>.scene.json`), so on-disk compat = "v1 = whatever `SceneFile` accepts today".

### 1.3 Divergence summary
| Concern | A `EntitySchema` | B `SceneFile` |
|---|---|---|
| Entity id | uuid string | none (array index) |
| Hierarchy | nested `children` | none (flat, Transform has no parent) |
| Components | array `{type,data}` full data | array `{component,overrides}` over defaults |
| Prefab | none | `prefabInstances[]` separate list + `props` flat overrides |
| Persistent | none | none (only `Meta.persistent` component, `GmsRuntime.ts:344`) |
| Views/layers | none | views + roomSize; layers as `LayerElement` entities |
| Version | `version` int (default 1) | none |

## 2. Unified schema (working name `SceneDocument`, `formatVersion: 2`)

Design rules: one flat `entities` array (prefab instances and plain entities are the same record); hierarchy by `parent` id, not nesting (stable refs, cheap diffs, no lazy zod recursion, order = array order); components as a name-keyed map like `SaveSystem` already uses; `$ref` ids are file-local strings; engine-only, plain JSON, no DOM.

```ts
// packages/types/src/scene.ts  (source of truth; engine imports zod-free structural copies, see 5.2)
export type EntityId = string;                       // unique within a scene, /^[A-Za-z0-9_-]{1,64}$/; uuid allowed, not required
export interface EntityRefJson { readonly $ref: EntityId }   // in-file ref; runtime EntityRef (06) is numeric, loader maps

export interface ComponentEntry {
  readonly v?: number;                               // ComponentDef.version this data was written at; omitted = current
  readonly data: Record<string, unknown>;            // OVERRIDES over the def's defaults only (not full data)
}
export interface PrefabRef {
  readonly name: string;                             // resolved via prefabsByName
  readonly props?: Record<string, unknown>;          // kept from v1: flat overrides passed to scene.spawn(prefab, props)
}
export interface SceneEntity {
  readonly id: EntityId;
  readonly name?: string;                            // -> Meta.name (else prefab name via stampPrefabNameOntoMeta)
  readonly tags?: readonly string[];                 // -> Meta.tags
  readonly active?: boolean;                         // default true; see open question 3
  readonly parent?: EntityId;                        // must precede or follow; loader orders topologically
  readonly persistent?: boolean;                     // -> Meta.persistent (object-style carry-over, 07)
  readonly prefab?: PrefabRef;
  readonly components?: Record<string, ComponentEntry>;  // applied after prefab, wins over it
  readonly layer?: string;                           // LayerDef.id; else scene default layer
  readonly pool?: boolean;
  readonly ext?: Record<string, Record<string, unknown>>; // namespaced tool/compat data, e.g. ext.gml.vars (was gmlVars)
}
export interface LayerDef { readonly id: string; readonly name: string; readonly depth: number; readonly visible?: boolean }
export interface ViewDef {                           // = SceneFileView + id; also serves as "camera"
  readonly id: string; readonly visible: boolean;
  readonly world: { x: number; y: number; w: number; h: number };
  readonly screen: { x: number; y: number; w: number; h: number };
  readonly border?: { x: number; y: number }; readonly speed?: { x: number; y: number };
  readonly follow?: { object?: string; entity?: EntityRefJson };   // object = GML type name (was followObject)
}
export interface SceneDocument {
  readonly formatVersion: 2;
  readonly id?: string;                              // optional stable scene id (IDE), never required by runtime
  readonly name: string;                             // was sceneName
  readonly persistent?: boolean;                     // room-level state cache (07 3.2); GMS roomSettings.persistent
  readonly backgroundColor?: string;                 // "#rrggbb"
  readonly systems?: readonly string[];
  readonly room?: { readonly width: number; readonly height: number; readonly viewsEnabled?: boolean;
                    readonly views?: readonly ViewDef[]; readonly layers?: readonly LayerDef[] };
  readonly entities: readonly SceneEntity[];
  readonly metadata?: { author?: string; createdAt?: number; updatedAt?: number };
}
```
```ts
// zod sketch (same file; replaces EntitySchema/SceneSchema/ComponentDataSchema)
export const EntityIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const EntityRefJsonSchema = z.object({ $ref: EntityIdSchema }).strict();
export const ComponentEntrySchema = z.object({ v: z.number().int().positive().optional(), data: z.record(z.string(), z.unknown()) });
export const SceneEntitySchema = z.object({
  id: EntityIdSchema, name: z.string().optional(), tags: z.array(z.string()).optional(),
  active: z.boolean().optional(), parent: EntityIdSchema.optional(), persistent: z.boolean().optional(),
  prefab: z.object({ name: z.string().min(1), props: z.record(z.string(), z.unknown()).optional() }).optional(),
  components: z.record(z.string(), ComponentEntrySchema).optional(), layer: z.string().optional(),
  pool: z.boolean().optional(), ext: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});
export const SceneDocumentSchema = z.object({ formatVersion: z.literal(2), name: z.string().min(1), /* ... */ entities: z.array(SceneEntitySchema) })
  .superRefine(uniqueIds).superRefine(parentsExistAndAcyclic).superRefine(refsResolve);
```
Field decisions:
- Stable ids: required on every entity, unique per scene. Migration synthesises `e<index>` (stable across re-runs because it is index-derived and the migrated file is then the source of truth). IDE generates short random ids on create. Ids survive re-import only if the importer derives them from the GMS instance name (`inst_XXXX` from the `.yy`), which it should (room instances already have GUID-ish names in `.yy`).
- EntityRef fields: any component field declared `{kind:"entityRef"}` (06 3.1) holds `{ "$ref": id }` in file; `ViewDef.follow.entity` and `parent` are structural refs. `ext.gml.vars` values may hold `{ "$ref": id }` too. Validation (`refsResolve`) checks structural refs always, component refs only when the def is known (loader).
- Hierarchy: `parent`. Runtime has no parent concept in Transform today; loader stores it in `Meta`/relation per 06 3.3 (`ChildOf` pair) or, until that lands, only validates and ignores (flag in step 5). IDE hierarchy tree is built from `parent` (`SceneInspector` `EntityItem.children` becomes derived).
- Components map: key = `ComponentDef.componentName`; `data` = overrides only, so defaults changes propagate; `v` enables `SaveSystem.registerMigration`-style upgrade (same registry, shared). Object key order is the add order (JSON parse preserves it); if order ever matters, add `order` (open question 5).
- Prefab refs and overrides: `prefab.name` + `prefab.props` (v1 semantics kept verbatim) + `components` (per-component overrides applied after spawn, new capability). `.prefab.json` stays `PrefabFile` for now (prefab shape unification is out of scope, listed as follow-up; it should adopt the same `components` map + `v`).
- Persistent: entity `persistent` (object-level, mirrors GML per-object) and scene `persistent` (room-level). Both authoritative in file; loader mirrors entity flag to `Meta.persistent` so 07's `SceneTransfer` policy is unchanged. Prefab-level persistent stays via the prefab's `Meta` override; entity-level wins when set.
- Views/cameras/layers: `room.views` (ViewDef, up to 8), `room.layers` (declared so the room editor can list/reorder; entity `layer` refers to it). Background/layer-element entities (`LayerElement`, `gmlLayer.ts:116`) remain ordinary entities.
- Format version and migration: `formatVersion` integer. Absent = v1 (the `SceneFile` shape). `Scene.version` in old `SceneSchema` (default 1) with `entities[].components[].type` = v0-editor (never written, still accepted, see 3). Loader signature: `parseSceneDocument(raw: unknown): SceneDocument` = `migrateScene(raw)` (chain `v0->v1->v2->...`, pure functions in `packages/engine/src/SceneMigrations.ts`) then structural validation. Rule: readers accept all older versions, writers emit only latest; a newer `formatVersion` than supported is a hard error naming both versions. No dual-write.

## 3. Migration plan

| From | Mapping to v2 |
|---|---|
| v1 `SceneFile` (no `formatVersion`) | `sceneName`->`name`; each `prefabInstances[i]` -> entity `{id:"p<i>", prefab:{name:prefab, props}, pool, ext:{gml:{vars:gmlVars}}}`; each `entities[j]` -> `{id:"e<j>", components: entries.reduce(name -> {data: overrides ?? {}})}`; `roomWidth/Height/viewsEnabled/views` -> `room` (`worldX..`->`world`, `followObject`->`follow.object`); `systems`, `persistent` copied. Order preserved: prefab instances first then entities, matching current `loadSceneFile` spawn order (tests depend on it). Duplicate component names in one entity (legal today as array) -> last wins with a `Diagnostics` warning. |
| v0 `SceneSchema` (uuid, `entities[].children`, `components[{type,data}]`) | Never produced, so only a best-effort test fixture: flatten `children` depth-first setting `parent`; keep uuid ids; `type`->key, `data`->`data` (treated as full data = overrides); `name/tags/active` copied; `backgroundColor`, `metadata` copied; scene `id`/`name`/`version` copied. |
| Runtime save blob (`SaveSystem` `SaveBlob`, 07 3.5) | Separate artifact; not migrated here. It adopts `SceneEntity` id + `$ref` conventions for `entityRef` remap (06 3.4) and shares the component-version registry. |

Compat guarantees: (a) existing on-disk `rooms/*.scene.json` load unchanged through `migrateScene`; (b) files are rewritten to v2 only when the IDE saves or the importer re-runs (RoomEditor `serializeSceneFile` `RoomEditor.tsx:216` emits v2; unknown top-level keys still preserved in `extra`); (c) no code path writes v1 after step 5. `loadSceneFile` keeps its name and signature (takes `SceneDocument | unknown`-typed raw via `parseSceneDocument`); `GmsRuntime.data.rooms` type widens to `Record<string, SceneDocument>` after parse at load.

## 4. How the shape serves the consumers

- EntityRef remap on load: loader phase 1 spawns every entity in topological (parent-first) order, filling `idMap: Map<EntityId, Entity>`; phase 2 walks each entity's components whose def declares `entityRef` fields (06 3.1, `ComponentFieldSchema` kind) and `ext.gml.vars`, rewriting `{ $ref: id }` into the runtime `EntityRef` (06 `remapRefs`, `EntityIdMap`). Unknown id -> `NO_REF` + `Diagnostics` warning (never throws, matching 06 3.4). The scene loader and save/load and prefab-with-children then share one `remapRefs`.
- SceneTransfer carry-over (07): `SceneTransfer.capture` emits `SceneEntity[]` (same type) with ephemeral ids `t<eid>`; restore is `loadEntities(scene, entities)` = same two-phase loader. This replaces the private `byOldEid` map at `GmsRuntime.ts:377-410` and gives room-cache snapshots (`persistent` scenes) the same wire shape, so cross-snapshot refs become `NO_REF` uniformly. `entity.persistent` is the selection predicate; `ComponentDef.transfer` (07 step 1) still nulls `bodyHandle`.
- Room editor: edits `SceneEntity` records directly (add/move/delete by `id`, not array index; today `RoomEditor.tsx:444-460` replaces arrays), reads `room.layers/views`, keeps hierarchy via `parent`, and previews via `layer`. Stable ids make undo/redo, selection persistence and git diffs meaningful. Entity picker for `entityRef` fields uses `id` + `name`. `SceneInspector` tree = `parent` grouping of the same list. Persistent room checkbox = `persistent`.
- Importer: emits ids from `.yy` instance names, `room.width/height`, `persistent` from `roomSettings.persistent` (`gms2-room-import.ts:455`), instance `creationCode`-free.

## 5. Sweep steps (ordered, each committable)

1. `feat(types): SceneDocument zod schema` - own `packages/types/src/scene.ts`, `packages/types/src/index.ts` (re-export; delete `EntitySchema`/`SceneSchema`/`ComponentDataSchema`, `EntityData`, `Scene` types), `packages/types/src/__tests__/schemas.test.ts` (replace SceneSchema block). No consumers break (1.1).
2. `feat(engine): scene document types + migration` - own new `packages/engine/src/SceneDocument.ts` (structural TS interfaces, engine stays zod-free/stdlib only), `SceneMigrations.ts` (`migrateScene`, `parseSceneDocument`), `packages/engine/src/index.ts` exports (also re-export old `SceneFile*` names as deprecated aliases to `SceneDocument` pieces for one release only if external code needs them; otherwise remove). Tests: migration.
3. `refactor(engine): loadSceneFile on SceneDocument` - own `SceneFile.ts` (rename to keep file; keep `PrefabFile*`), `GmsRuntime.ts:88,311`, `compat/gmlCamera.ts:54,671-700` (`ViewDef`), `compat/gmlActions.ts`, `LayerElement.ts`/`gmlLayer.ts` comments. Two-phase loader, ids, `parent` validated (ignored at runtime until 06 lands), `entity.persistent`->`Meta.persistent`. Behaviour-preserving for v1 via migration. Depends on 1-2 and on EntityRef step from 06 for phase 2 (stub `remap` no-op until then).
4. `refactor(toolchain): emit SceneDocument v2` - own `gms2-codegen.ts` (`buildRoomSceneJSON`), `gms2-import.ts:454-521`, `gms2-room-import.ts` (`RoomSceneFileView`, `:558-574`, `:724`, add `persistent`), `gms2-report.ts`; toolchain tests import engine from gitignored `dist`, rebuild first. Importer output changes -> tests compare to v2.
5. `refactor(ide): RoomEditor/roomEditorExtras on SceneDocument` - own `RoomEditor.tsx`, `roomEditorExtras.ts`, `AssetPreviewPopover.tsx:147-159`, `apps/ide/src/__tests__/{RoomEditor,roomEditorExtras}.test.*`. Parse via `parseSceneDocument`; write v2 only. IDE `EntityItem`/`SceneInspector` derive from `parent` (own `ideTypes.ts`, `ideStore.ts`, `SceneInspector.tsx`) - may split into 5b.
6. `feat: SceneTransfer/room cache emit SceneEntity` - follows 07 steps 1-3 and 06 steps; own `SceneTransfer.ts`, `GmsRuntime.ts` (remove `byOldEid`).
7. Docs: add persistent/format to `docs/decisions/persistence-and-transitions.md` and `engine-core.md` (rule: readers accept older, writers emit latest); update decisions only after user sign-off.

Headless tests (vitest, no DOM, `createHeadlessScene`):
- Round-trip: `parseSceneDocument(JSON.parse(JSON.stringify(doc)))` deep-equals `doc`; `loadSceneFile` then `captureEntities` then `loadEntities` reproduces component data, `Meta.persistent`, parent links; zod and engine structural validators agree on a shared fixture set (fixtures in `packages/types` consumed by engine test via relative JSON copy, no runtime dep).
- Migration: v1 fixture (prefabInstances + entities + views + roomSize, taken from a synthetic importer output, unnamed sample projects) -> expected v2 snapshot; spawn order identical to pre-change `loadSceneFile`; v0 nested `children` flattens with correct `parent`; newer `formatVersion` throws naming both; duplicate ids, missing parent, parent cycle, unknown `$ref` rejected/warned; `.scene.json` written by v1 importer still loads in `GmsRuntime.test.ts`.
- Ref remap: scene with `A.target={$ref:"b"}` and `views[0].follow.entity` loads to live entities; `{$ref:"missing"}` -> `NO_REF` + diagnostic; capture/restore across scenes remaps carried-to-carried refs and nulls carried-to-dropped.
- IDE: `RoomEditor.test.tsx` updated, plus "open v1 file, move instance, saved JSON is v2 with unchanged ids and untouched `extra` keys".

## 6. Risks and open questions

Risks
- Importer-output churn: every previously imported project has v1 room files; they load via migration but IDE saves rewrite to v2 (diff noise, and users on an older tool cannot open v2; "newer version" error is deliberate).
- Synthesised ids (`p<i>`, `e<j>`) are only stable if the file is not reordered by hand before first migration-save; refs authored against them would break. Mitigation: migration is deterministic, and ids are then persisted.
- `props` (flat, component-agnostic) coexisting with `components` overrides can conflict; define precedence `prefab < props < components` and warn on same-field double set.
- Runtime has no hierarchy yet; shipping `parent` before 06's relations means it is validated but inert, which could mislead users of the IDE tree.
- Two-phase load with `onSpawned` (`GmlBehaviorSystem.dispatchCreate`) must run after phase 2 or `onCreate` sees unresolved refs; ordering change vs today (dispatch happens per entity at spawn).
- Engine cannot import zod (stdlib only) so schema exists twice (types zod, engine structural); drift risk, mitigated by shared fixtures test in step 5.

Open questions for the user
1. In-file ref id type: string ids (proposed) with numeric runtime `EntityRef` from 06, or make 06's `EntityId` a string end to end? 06 proposed `$ref: number`; 06 3.7 proposed a string|number union.
2. Keep required uuid ids for editor-authored entities (old `EntitySchema`), or is a short readable id (proposed) acceptable? Should the importer reuse GMS instance names as ids (proposed)?
3. `active` has no runtime counterpart today (`Meta` has none). Add `Meta.active` (or a disabled tag) now, or drop the field from v2?
4. Should prefab files move to the same `components` map + `v` shape in the same sweep, or stay as `PrefabFile` for now (proposed)? Keep `prefab.props` long-term or migrate to per-component overrides in the IDE?
5. Do component add-order semantics matter anywhere? If yes, use an ordered array instead of an object map.
6. Is `SceneDocument.id` (scene uuid) needed by anything, e.g. project.json references, or drop it?
7. Where should the canonical schema live: `packages/types` (proposed, zod) with engine structural copy, or engine-owned with types re-exporting? The former keeps engine stdlib-only.

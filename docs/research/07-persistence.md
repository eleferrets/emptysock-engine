# 07 - Persistence and scene transitions (research item 7)

Status: research only, nothing implemented. Paths under `packages/engine/src/` unless noted. Read together with `06-cross-entity-relationships.md` (the remap mechanism there is a prerequisite for step 3 here).

## 1. Current state map

| Concern | Where | Today |
|---|---|---|
| Scene swap | `Game.ts:426-489` (`loadScene`), `unloadScene` | `unloadScene` runs `definition.onUnload(scene, lifecycle)` then destroys actors/physics; the new `Scene` (new bitECS world) is built and `onLoad` runs. Core has no notion of carrying anything across. |
| Game-lifetime state | `Game.ts:45-100,330-360` | `input`, `audio`, `variables` (`VariableStore`), `globals` (`GlobalStore`), `signals`, fonts etc. are services, survive every swap. |
| Transition timing | `systems/SceneTransition.ts` | Times a visual and calls a caller `load` callback; explicitly owns no lifecycle (`docs/decisions/persistence-and-transitions.md`). |
| Bespoke carry-over | `GmsRuntime.ts:45-59,191-192,327-329,339-411` | `PersistedEntity` (old eid/world, per-component field copies, GML vars, action state). `onUnload` -> `snapshotPersistent`; next `onLoad` -> `restorePersistent` BEFORE `loadSceneFile` (`GmsRuntime.ts:310-311`). Lives in a private `_carried` field of `GmsProjectRuntime`. |
| What is snapshotted | `GmsRuntime.ts:341-366` | Every def `componentRegistry.registeredComponents(world)` knows; `bodyHandle` nulled (`:355`); `exportGmlVars`, `exportGmlActionState`; then `clearGmlActionState`/`clearGmlInstanceVars`. Other side tables (coroutines, `VisualScriptState` scope, particles, sequences, timelines) are neither carried nor cleared here. |
| Carry rule | `components/Meta.ts:48-55`, `toolchain gms2-codegen.ts:362-366` | `Meta.persistent` per prefab; room instances have no per-instance flag. |
| Room-level persistent | `toolchain gms2-codegen.ts:362` comment, `docs/decisions/persistence-and-transitions.md` | `roomSettings.persistent` is read nowhere (`gms2-room-import.ts:455` reads only Width/Height). Explicitly "unimplemented". |
| Room restart / game restart | `compat/gmlActions.ts:604-637` | `room_restart` reloads the current room; `game_restart` only reloads the first room, does not reset globals, statics or persistent carry (documented gap). |
| Ordering trap | `GmsRuntime.ts:403-409` | The carry-over remap only covers top-level GML var values equal to an `Entity`; component fields cannot hold refs at all (see 06). |
| Globals store | `systems/GlobalStore.ts:39-70` | Plain `Map<string, unknown>`, no `snapshot`/`restore`. `GameGlobals` interface is augmentable (types only). |
| Global declarations | `apps/ide/src/store/gameGlobalsStore.ts`, `services/ProjectSerializer.ts:113,308-319`, `services/gameGlobalsTypes.ts` | Declarations only: `Record<name, tsTypeString>` stored in the project file and turned into a `.d.ts`. No initial value, no persistence flag, nothing in the engine reads the declaration list at runtime. |
| Other stores | `systems/VariableStore.ts:101-140` | Has `snapshot()`/`restore()` and its own storage write path (`:78-87`): the closest existing precedent for a versioned state blob. |
| Save/load | `systems/SaveSystem.ts:63-210` | `SaveBlob { formatVersion: 1, entities[] }`. Only registered component defs, one scene, entity-only. No globals, no `VariableStore`, no current-room name, no persisted-room cache, no side tables (GML vars are lost on save). `load` appends to the current scene without clearing. Per-component `version` + `registerMigration` already exists (`:30-33,159-170`). Blob-level `formatVersion` is stamped but never checked on load. |
| IDE save slot type | `packages/types/src/index.ts:44-53` | `SaveSlotSchema { slotId 0-9, timestamp, playtime, currentScene, data: record<unknown> }`: a third, unrelated save shape. |
| Tests | `__tests__/GmsRuntime.test.ts:672-800`, `SceneTransition.test.ts`, `GlobalStore.test.ts` | Persistent-instance behaviours (no de-dupe, no `onCreate` rerun, `ctx.rooms` path) already covered; no test for core transitions. |

## 2. Semantics to preserve (GameMaker, from the manual pages already cited in decisions)
- Object `persistent`: the instance survives a room change and does not rerun Create; a destination room that also places the object creates a second instance (no de-dupe). Already matched (`GmsRuntime.test.ts:762`).
- Room `persistent` (Room Properties): the whole room's instance state is kept when you leave and restored on revisit; Creation Code and instance Create do not rerun on the restored visit; instances that are themselves persistent objects move to the new room as usual. (Manual: Room Properties, "Persistent"; verify exact wording on the manual page before shipping, this session did not re-fetch it.)
- Globals are whole-process: `game_restart` resets them, room changes never touch them.

## 3. Design

### 3.1 Core `SceneTransfer` (generalise the carry-over out of `GmsRuntime`)
New `SceneTransfer.ts` in core, opted into by `Game`:

```ts
export interface TransferPolicy {
  /** Which live entities leave the outgoing scene with the game. Default: Meta.persistent === true. */
  select(entity: Entity, scene: Scene): boolean
  /** Hook per-entity for state kept outside components (GML vars, motion, timelines...). */
  readonly extras: readonly EntityExtra[]
}
export interface EntityExtra<T = unknown> {
  readonly name: string
  export(entity: Entity): T | undefined
  import(entity: Entity, data: T, remap: EntityIdMap): void
  clear(world: World, eid: number): void          // pooled-id hygiene after export
}
export interface SceneSnapshot { readonly entities: EntitySnapshot[]; readonly version: 1 }
export function captureEntities(scene, policy): SceneSnapshot   // removes selected entities' side tables
export function restoreEntities(scene, snap, policy): EntityIdMap
```
- The component-copy logic (`GmsRuntime.ts:344-357`) moves verbatim into `captureEntities`; `bodyHandle` nulling becomes a per-def `onTransfer` hook (`ComponentDef.transfer?: (data) => data`) so `PhysicsBody` owns its own reset instead of core matching a field name.
- GML vars/action state become the first two `EntityExtra`s registered by `GmsProjectRuntime` (`GmsRuntime.ts:362-363` -> `extras`), so core never imports `compat/`. Other side tables (coroutines are runtime-only and deliberately dropped; `VisualScriptState` scope, timelines, sequences) get an explicit decision in the extras list rather than being silently lost.
- `Game.loadScene(def, options)` gains `options.carry?: TransferPolicy | false`. Flow inside `loadScene`: after `unloadScene()`'s `onUnload` and before the new `onLoad`, `Game` holds `_transfer: SceneSnapshot | null`; the new scene calls `restoreEntities` first thing via `SceneLifecycle.restoreCarried()` (explicit, matches the current "restore before `loadSceneFile`" ordering at `GmsRuntime.ts:310`). Explicit call rather than magic keeps the ordering contract visible and keeps `onLoad` synchronous-friendly.
- Remap uses `EntityIdMap` from 06. Until 06 lands, ship the `byOldEid` map behind the same interface.
- `SceneTransitionManager` needs no change: its `load` callback keeps calling `game.loadScene`, which now carries. Add `game.transitionTo(def, opts, transition)` convenience only if a caller asks.

### 3.2 Room-level persistent flag
```ts
export interface SceneFile { ... readonly persistent?: boolean }         // SceneFile.ts:85
// Game-owned cache, keyed by scene name
class RoomStateCache { store(name, snap: SceneSnapshot): void; take(name): SceneSnapshot | undefined; clear(name?): void }
```
- Importer: `gms2-room-import.ts:455` reads `roomSettings.persistent` into `SceneFile.persistent` (toolchain owner).
- Runtime: `buildSceneDefinition(name)` (`GmsRuntime.ts:275`) - in `onUnload`, if `file.persistent`, `captureEntities` with policy `select: () => true` (every entity except those already selected by the object-persistent rule, which move on instead) and `RoomStateCache.store(name, ...)`. In `onLoad`, if `RoomStateCache.take(name)` exists: `restoreEntities`, apply room size/views as normal, and SKIP `loadSceneFile` (and therefore all Create events); otherwise the normal path runs. Ordering with object-persistent carry: restore incoming carried entities first, then the cached room, matching GameMaker where persistent objects arrive in the room that is being revisited.
- `room_restart()` must clear that room's cache entry (GameMaker's restart re-creates the room); `game_restart()` clears the whole cache plus `GlobalStore` and the carry snapshot (closes the gap documented at `gmlActions.ts:622-631`).
- Not a GML-only feature: core `SceneDefinition` gets an optional `persistentKey?: string`; `Game` performs capture/restore generically, `GmsProjectRuntime` just sets it from `file.persistent`. Scenes without the key behave as today.
- Cost: capture = O(entities x components) copies, once per leave; restore likewise. Memory held for visited persistent rooms; add `RoomStateCache.maxRooms` (default unlimited) only if a project needs eviction.

### 3.3 GML `persistent` vs room persistent - decision table
| Situation | Behaviour |
|---|---|
| Object persistent, room not | Carry to next room only (today's behaviour, now via `SceneTransfer`). |
| Room persistent, object not | Entity stays in the room's cached snapshot; absent while elsewhere. |
| Both | Entity leaves with the game (object rule wins), is not also cached in the room; on revisit the room restores without it. |
| Destination places a persistent object already carried | Second instance; no de-dupe (unchanged). |
| Ref between a carried and a cached entity | Cross-snapshot; becomes `NO_REF`/`undefined` with a `Diagnostics` warning (documented limitation, same as today's non-persistent case at `GmsRuntime.ts:396-399`). |

### 3.4 Declared globals persist values, not just declarations
Today declarations exist only in the IDE. Proposed shape, one source of truth in the project data:

```ts
// @emptysock/types (project file) and mirrored engine-side
interface GlobalDecl { type: string; initial?: Serializable; persist?: boolean }   // replaces Record<name,string>
// engine
class GlobalStore {
  declare(name: string, decl: { initial?: Serializable; persist?: boolean }): void
  snapshot(): Record<string, Serializable>      // persist:true names only, JSON-clean (drops functions/instances with a warning)
  restore(data: Record<string, unknown>): void  // undeclared names ignored + warn
  reset(): void                                 // re-apply declared initials (game_restart)
}
```
- Back-compat: the IDE loader (`ProjectSerializer.ts:308-319`) accepts the old `name -> typeString` and upgrades it to `{type}`; generated `.d.ts` (`gameGlobalsTypes.ts:16-22`) keeps reading `.type`.
- Runtime wiring: the built game's boot code (exporter, outside this sweep) calls `globals.declare(...)` for each entry; `GlobalStore.set` on an undeclared name keeps working (GML compat writes arbitrary names).
- Only `persist: true` names enter save files; runtime-only values (handles, entities, surfaces) never should - `snapshot()` uses the `Serializable` check, and an `Entity` value is converted via `EntityRef` once 06 exists (else warns and drops).

### 3.5 Save format and versioning
One envelope, replacing the ad hoc shapes (`SaveBlob`, `SaveSlotSchema.data`):

```ts
interface SaveFileV2 {
  formatVersion: 2
  meta: { slot?: string; savedAt: number; playtime?: number; engineVersion: string; gameVersion?: string }
  room?: { name: string }                       // current scene key
  entities: SavedEntity[]                       // with ids + relations (see 06)
  extras: Record<string, unknown>               // per-EntityExtra data inside entities[i].extras
  globals: Record<string, Serializable>
  variables?: VariableStoreData                 // VariableStore.snapshot()
  rooms?: Record<string, SceneSnapshot>         // RoomStateCache contents
  carried?: SceneSnapshot                       // in-flight transition, normally empty
}
```
Versioning rules:
1. Blob `formatVersion` is checked on load (today it is not, `SaveSystem.ts:138`). Unknown newer version: refuse with a clear result, never partial-load. Older: run ordered `SaveFormatMigration[]` (v1 -> v2 = wrap old `entities` with generated ids, empty extras/globals).
2. Component-level `version` + `registerMigration` (existing, `SaveSystem.ts:159-170`) stays; extend to `EntityExtra.version` and a `globals` migration hook (`registerGlobalsMigration`).
3. `load` becomes replace-by-default: `load(slot, { mode: "replace" | "append" })`; replace unloads/clears the current scene first (today's append is the surprising default).
4. `SaveSystem` stops being bound to one component list at construction only; accept `Game` so it can save services; keep the old constructor signature working (deprecated overload) for the sweep.
5. Storage stays behind `StorageAdapter`; no DOM.
6. The IDE `SaveSlotSchema` becomes a thin index record (`slotId`, `timestamp`, `currentScene`) pointing at a `SaveFileV2` key.

## 4. Headless tests (vitest, `createHeadlessGame`)
- `SceneTransfer.test.ts`: capture/restore parity with the current `GmsRuntime` block (components, side tables cleared, `bodyHandle` reset via `ComponentDef.transfer`); default policy carries only `Meta.persistent`.
- Keep `GmsRuntime.test.ts:672-800` unchanged and green as the regression net for step 2.
- `RoomPersistence.test.ts`: leave persistent room A, visit B, return: entity positions and GML vars restored, no Create rerun; non-persistent room recreated; `room_restart` clears cache; `game_restart` clears cache, globals reset to initials; object-persistent plus room-persistent precedence.
- `GlobalStore.test.ts` additions: declare/initial/reset/snapshot filters `persist:false`, restore ignores undeclared with warn, non-serialisable value dropped with warn.
- `SaveSystem.test.ts` (new file if absent): v1 blob loads via migration; newer `formatVersion` refused; replace vs append; full round trip of globals + `VariableStore` + rooms cache; component migration still fires.
- `SceneTransition.test.ts`: `load` callback that calls `game.loadScene(..., { carry })` carries across a timed transition.

## 5. Sweep steps (ordered, each committable)

| # | Commit | Owns | Depends |
|---|---|---|---|
| 1 | `refactor(engine): extract scene transfer from gms runtime` | new `SceneTransfer.ts`, `GmsRuntime.ts` (delete private snapshot/restore, register extras), `Component.ts` (`transfer?` hook), `components/PhysicsBody.ts` (hook), `index.ts`, new tests | none (behaviour-preserving) |
| 2 | `feat(engine): game.loadScene carry option` | `Game.ts` (`carry`, `restoreCarried`, `_transfer`), tests | 1 |
| 3 | `refactor(engine): transfer uses entity id map` | `SceneTransfer.ts`, `GmsRuntime.ts` | 06 step 1 (ids) and 4 (remap) |
| 4 | `feat(engine): room state cache and persistentKey` | new `RoomStateCache.ts`, `Game.ts`, `SceneFile.ts` (`persistent`), `GmsRuntime.ts` (`buildSceneDefinition`), tests | 1,2 |
| 5 | `feat(toolchain): import room persistent` | `gms2-room-import.ts`, `gms2-codegen.ts` (comment at `:362`), toolchain tests | 4 |
| 6 | `fix(engine): room_restart and game_restart clear persistence` | `compat/gmlActions.ts`, tests | 4, 7 |
| 7 | `feat(engine): global declarations with values` | `systems/GlobalStore.ts`, `index.ts`, tests | none |
| 8 | `feat(ide): declared globals carry initial and persist` | `apps/ide` store/serializer/types plugin (separate owner), `packages/types` | 7 |
| 9 | `feat(engine): save file v2` | `systems/SaveSystem.ts`, `systems/StorageAdapter.ts` untouched, `packages/types` `SaveSlotSchema`, tests | 1,4,7 (and 06 step 4 for ids) |

Steps 1,7 can run in parallel; 2 and 4 both edit `Game.ts` and `GmsRuntime.ts`, keep them serial; 5 and 8 belong to toolchain/IDE owners and must not block the engine steps.

## 6. Risks
- **Silent state loss in `extras`**: any per-`(World, eid)` side table not registered as an extra vanishes on carry. Add a test that enumerates the `clear*` calls in `Scene.destroy` (`Scene.ts:185-199`) against the registered extras so a new side table without a decision fails CI.
- **Restore before `loadSceneFile`** is load-bearing (persisted instances must exist before room instances); the explicit `restoreCarried()` call preserves it, an auto-restore in `Game` would risk running after user `onLoad` code.
- **Room cache and refs**: cached entities referencing carried ones (or vice versa) dangle; documented and warned, not solved. Keep the cache out of saves initially if the ref story (06) is not merged.
- **Memory growth** from many persistent rooms; add opt-in eviction if needed.
- **Save format churn**: v2 must ship with the v1 reader in the same commit; never remove it without a deprecation note.
- **Determinism**: `SaveSystem` iterates `scene.each` per def then regroups by eid (`:192-209`), so entity order in the file depends on def order; v2 should sort by `EntityId` for stable diffs.
- **`game_restart` scope**: real GameMaker resets everything including module-level game variables and `gmlStatics` (process-global, `GmsRuntime.ts` comment at `:389` of decisions); a full reset needs a registry of resettable state, out of scope here, keep the documented gap for statics.
- **Engine rules**: stdlib only, no DOM; all new exports through `index.ts` with `index-exports.test.ts` and `dist-types` in sync; nothing in `onUpdate` may be async (capture/restore are synchronous by design); do not name sample projects in fixtures; `packages/toolchain` tests import built `packages/engine/dist`, so rebuild after engine steps.

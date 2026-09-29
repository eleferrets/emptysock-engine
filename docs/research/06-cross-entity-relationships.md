# 06 - Cross-entity relationships (research item 6)

Status: research only, nothing implemented. Paths are under `packages/engine/src/` unless noted.

## 1. Current state map

| Concern | Where | What happens today |
|---|---|---|
| Entity handle | `Entity.ts:81-114` | `{world, eid}` class; `eid` is a bitECS versioned id. `isAlive` = `entityExists` (exact, version bits included). Stale handles fail loudly in `add`, return `undefined` in `get`. |
| Component fields | `Serializable.ts:13-23`, `Component.ts:37-59` | Fields must be JSON-plain. An `Entity` is a class, so it cannot be a typed component field. No `EntityRef` kind in `ComponentFieldSchema` (`Component.ts:11-15`: number/string/boolean/enum only). |
| Refs today | `compat/gmlInstanceVars.ts:37-63` | Entity refs only exist as values in the untyped per-`(World, eid)` GML var side table (`Map<string, unknown>`). |
| GML `obj.field` | `compat/gmlCrossInstance.ts:54-72,189-199` | First entity whose `Meta.name === objectName`, by full `scene.each(Meta)` scan (O(n) per access, no early exit: the callback just returns once found). |
| GML `ref.field` | `gmlCrossInstance.ts:230-265,277-288` | Reads the var; string means object-type name, otherwise duck-typed `asLiveEntity` (`.get` fn + `.isAlive`). Dead ref reads `undefined`, write warns and drops. |
| `with` / `other` | `compat/gmlActions.ts:866-895` (`with_each`); toolchain `gms2-transpile.ts:970-1018` | `with` target: Entity, `"noone"`, `"all"`, or object-type string; iterates `Transform` bearers. `other.id` is rewritten to `_other` because Entity has no numeric id (`gms2-transpile.ts:1004-1018`). |
| `instance_*` | `gmlCollisionQueries.ts:221-256` (`instance_exists/number`), `gmlActions.ts:785-1000` | `instance_create*` returns `Entity`; `instance_destroy(id)` accepts an Entity. `instance_find` / `instance_nearest` / numeric ids do not exist in engine or toolchain (grep clean). |
| Camera follow | `compat/gmlCamera.ts:117` | `targetObject: number` (instance id or -1), an ad hoc numeric convention separate from Entity refs. |
| Destroy | `Scene.ts:172-215` | Clears 5 side tables; does not scan for refs to the victim. `bitecsRemoveEntity` frees the id; the version bump makes old handles report dead. Pooled entities stay `isAlive` with zero components (`Scene.ts:158-171`), so a ref to a pooled entity looks alive but empty. |
| Scene load | `SceneFile.ts:42-54,244-282` | `.scene.json` has no entity ids and no cross-entity links; prefab `props` are `SerializableRecord`. Nothing to remap. |
| Prefab spawn | `Scene.ts:94-153`, `Prefab.ts` | Flat: components flattened, one entity per prefab. No child prefabs, so no intra-prefab ref remap needed today. |
| Save/load | `systems/SaveSystem.ts:132-210` | Writes `{components}` per entity with no id. Load spawns fresh entities appended to the current scene. Refs cannot be represented, so nothing can be remapped. |
| Only remap in repo | `GmsRuntime.ts:395-410` | `restorePersistent` remaps `Entity` values inside GML vars via `byOldEid` (old world check `v.world === p.oldWorld`); refs to non-carried entities become `undefined`. Top-level vars only: not nested arrays/structs, not component fields. |
| Hierarchy (only one) | `ui/WidgetTree.ts:36-140` | bitECS `createRelation(withAutoRemoveSubject)` named `WidgetParent`; parent removal detaches the pair from children but does NOT destroy children (comment at `WidgetTree.ts:117`). UI only, not general. |
| Scene JSON schema | `packages/types/src/index.ts:60-69` | Zod `EntitySchema` has `id: uuid` and recursive `children`: an editor-side tree that the runtime `SceneFile` does not use. Two divergent scene shapes. |
| Network | `packages/network/src/NetworkEntityMap.ts` | Bidirectional `networkId <-> Entity` map keyed on `rawId` (version stripped: a recycled slot can alias, see risks). |
| SignalBus | `systems/SignalBus.ts` | Name-keyed pub/sub, `Game`-scoped, payload `unknown`; no entity lifetime awareness, so listeners registered by a dead entity leak unless `SignalGroup.dispose()` is called by hand. |

## 2. How mature systems do it (sources)

- **bitECS 0.4** (already a dependency, `^0.4.0`): relations are first-class pairs. `createRelation()`, `Pair`, `withAutoRemoveSubject`, `makeExclusive`, `withStore`, `getRelationTargets`, `Wildcard` queries, `Hierarchy()` depth-ordered queries; versioned ids guard against recycle aliasing. Source: bitECS `docs/Intro.md` (Relations section), https://github.com/NateTheGreatt/bitECS. Fetched and confirmed this session. Takeaway: relations live in the ECS store, not in component fields; the engine already uses this for `WidgetParent`. Relation targets are raw eids inside one world, so no cross-world story.
- **Bevy** `MapEntities` / `EntityMapper`: an `Entity` in a component copied between worlds is invalid, so components that hold entities implement `map_entities(&mut self, mapper)` and call `mapper.get_mapped(e)`; scene load and entity clone build an `EntityHashMap<Entity>` (old to new) and run every component through it. Source: https://docs.rs/bevy/latest/bevy/ecs/entity/trait.MapEntities.html (fetched). Takeaway: remap is a per-field visitor over a full old-to-new table, applied after all entities exist (two-phase). Exactly the shape `restorePersistent` hand-rolls.
- **Flecs** relationships: `(Relation, Target)` pairs, `ChildOf` for hierarchy, cleanup traits `(OnDeleteTarget, Delete|Remove|Panic)` decide what happens to subjects when a target dies (cascade delete for `ChildOf`, remove for plain refs); `Exclusive` limits to one target. Source: https://www.flecs.dev/flecs/md_docs_Relationships.html (the fetch returned only a redirect stub, so this is from prior knowledge; verify before quoting). Takeaway: dangling policy is declared per relation, not left to callers.
- **Unity**: object references in serialized fields are asset/scene-local file ids resolved at load (`fileID` in scene YAML); runtime destroyed `UnityEngine.Object` compares `== null` via an overloaded operator (a "fake null"). Source: Unity manual "Script serialization" and the Unity blog post "Custom == operator, should we keep it?" (recalled, not fetched). Takeaway: serialise a stable id, resolve lazily, make "dead" checkable.
- **Godot**: `NodePath` is a serialisable path relative to the holding node, resolved with `get_node`; node refs exported via `@export var n: Node` serialise as NodePath. Source: Godot docs, class `NodePath` and "Nodes and scene instances" (recalled, not fetched). Takeaway: paths survive prefab instancing because they are relative to the instanced subtree; cost is a lookup and breakage on reparent.

Design consequence: we want (a) stable serialised ids independent of bitECS eids, (b) a Bevy-style two-phase remap for load, instancing and room carry-over, (c) Flecs-style per-relation delete policy, (d) bitECS relations as the storage for structural edges (parent/child).

## 3. Design

### 3.1 `EntityRef` as a plain serialisable value
Keep `Serializable` unchanged (plain data). Add a branded plain object so it passes the type constraint and JSON round-trips:

```ts
// packages/engine/src/EntityRef.ts (new; exported via index.ts)
export interface EntityRef { readonly $ref: number }   // $ref = stable EntityId, 0 = none
export type EntityId = number                          // per-Scene monotonic, never reused
export const NO_REF: EntityRef = { $ref: 0 }
export function isEntityRef(v: unknown): v is EntityRef
```
Why not store the bitECS eid: it is reused across worlds/scenes and `rawId` strips the version. A per-`Scene` `EntityId` counter (Map `eid<->EntityId`, populated lazily on first `scene.idOf(entity)`) stays stable across save, room carry-over and prefab instance, and costs nothing for entities never referenced.

`ComponentFieldSchema` gains `{ kind: "entityRef"; relation?: string }` (`Component.ts:11`) so the Inspector picks an entity picker and the remapper knows which fields to visit without scanning every value. Declared fields drive remap; undeclared nested refs are found by a bounded structural walk only for GML vars (see 3.4).

### 3.2 Scene API (all synchronous, no DOM)
```ts
class Scene {
  idOf(e: Entity): EntityId                   // assigns on demand
  resolve(ref: EntityRef): Entity | undefined // undefined if dead/never existed
  refTo(e: Entity): EntityRef
}
// Entity sugar, no new state on Entity:
entity.ref(): EntityRef
```
`resolve` is one Map lookup plus `isAlive`; a pooled-and-recycled entity is treated as dead because pooled destroy (`Scene.ts:201-211`) drops its id mapping.

### 3.3 Relations (public API) on bitECS pairs
```ts
export interface RelationDef { readonly name: string; readonly onTargetDestroyed: "remove" | "destroy" | "ignore"; readonly exclusive: boolean }
defineRelation(name, opts): RelationDef
scene.relate(subject, relation, target): void
scene.unrelate(subject, relation, target?): void
scene.targetsOf(subject, relation): Entity[]
scene.subjectsOf(target, relation): Entity[]      // reverse index
scene.parentOf(e): Entity | undefined
scene.childrenOf(e): Entity[]
scene.setParent(child, parent | undefined)         // built-in ChildOf: exclusive, onTargetDestroyed "destroy"
```
Implementation: `createRelation` per def (with `withAutoRemoveSubject` for `remove`, `exclusive` via `makeExclusive`); `destroy` policy `"destroy"` implemented in `Scene.destroy` by walking `subjectsOf(victim)` before `bitecsRemoveEntity` (bitECS only auto-removes the pair; `WidgetTree.ts:117` proves it will not cascade-destroy). Cost: reverse walk only if the world has any relation with policy `destroy`, tracked by a counter so the common path pays a single integer compare.

### 3.4 Save/load, prefab and carry-over remap (single mechanism)
```ts
export interface EntityIdMap { get(oldId: EntityId): Entity | undefined }
export function remapRefs(entities: Iterable<Entity>, map: EntityIdMap, defs: ComponentDef[], gmlVars?: ...): void
```
Two phases, mirroring Bevy: (1) spawn all entities, recording old-id to new-entity; (2) visit every declared `entityRef` field of each component (from `schema`) and rewrite `$ref` via the map; a ref whose old id is missing becomes `NO_REF` plus a `Diagnostics` warning. GML vars use the existing `Entity`-valued form: extend the loop at `GmsRuntime.ts:395-410` to a shared `remapValue(v)` that recurses arrays and plain objects to a fixed depth (say 8) with a visited set.

Consumers:
1. `SaveSystem`: `SaveBlob` v2 writes `id` per entity and a `relations` array `{subject, relation, target}`; load builds the map then calls `remapRefs` and re-creates relations. Single-scene ids are stable so an in-place reload could also skip remapping, but the same path is used for append-loads.
2. Room carry-over (item 7): `restorePersistent` swaps `byOldEid` for `EntityIdMap`.
3. Prefab instantiation with children (future `PrefabDef.children`): spawn subtree, build `local index -> Entity`, run `remapRefs` so prefab-internal refs point at the fresh copies; refs to entities outside the subtree are left as-is (Godot relative-path semantic).
4. Scene files: `SceneFileEntity` gains optional `id: string`; `prefabInstances` gain the same plus `parent?: string` and props may hold `{ "$ref": "<id>" }`; `loadSceneFile` resolves after all spawns (phase 2 after the two loops in `SceneFile.ts:253-279`).

### 3.5 GML compat mapping
- Introduce `gmlInstanceId(entity): number` = `scene.idOf(e)` offset by 100000 (GameMaker's own instance-id floor is 100000; verify against the manual before hard-coding). This fills `instance_find`, numeric `other.id`, `camera_set_view_target(id)` (`gmlCamera.ts:117`) and lets the transpiler drop the `_other.id` rewrite (`gms2-transpile.ts:1018`) later.
- Add `instance_find(obj, n)`, `instance_nearest(x,y,obj)`, `instance_furthest` in `gmlCollisionQueries.ts`, sharing one `eachOfType` helper. Replace the O(n) `findFirstInstanceOfType` (`gmlCrossInstance.ts:189`) with a per-scene `Meta.name -> Set<eid>` index (maintained through `Meta` writes is hard because `Meta` is a proxy; use a lazily rebuilt cache keyed by a scene `structureVersion` counter bumped in spawn/destroy/`instance_change`).
- `asLiveEntity` keeps its duck typing but gains an `EntityRef` branch: `isEntityRef(v) ? scene.resolve(v)`.

### 3.6 SignalBus integration
- Add `SignalBus.onEntity(entity, name, fn)`: registers into a per-entity `SignalGroup` stored in a `WeakMap<World, Map<eid, SignalGroup>>` side table; `Scene.destroy` disposes it (same pattern as the five existing `clear*` calls at `Scene.ts:185-199`, so it inherits pooled-id hygiene).
- Built-in events emitted by `Scene`: `entity:destroyed` `{ref}`, `entity:parented` `{child, parent}`. Emission needs a bus reference; `Scene` has none today. Keep core decoupled: `Scene.onDestroyed(cb)` hook set by `Game` (Game already creates both) that forwards to `signals.emit`.
- Payloads carry `EntityRef`, not `Entity`, so they are safe to queue or serialise.

### 3.7 Typing in `@emptysock/types`
`packages/types/src/index.ts` is Zod-based and the editor scene schema already has `id` + `children`. Add `EntityRefSchema = z.object({ $ref: z.union([z.string().uuid(), z.number().int()]) })` and align `EntitySchema.id` with `SceneFileEntity.id`. Decide once whether runtime ids are uuid strings (readable in files) or ints (cheap in memory): recommend strings in files, ints at runtime, converted at the load boundary.

## 4. Cost
- Entities never referenced: zero (lazy id assignment).
- Per referenced entity: one Map entry each direction (~2 small objects). Resolve: Map get + `entityExists`.
- Destroy: +1 counter check normally; +O(subjects) with `destroy` relations.
- Remap: O(entities x declared ref fields), one pass; GML var walk bounded by depth cap.
- Type index for `obj.field`: turns O(n) per read into O(1) amortised, a net win for GML-heavy rooms.

## 5. Headless tests (vitest, `createHeadlessScene`)
`__tests__/EntityRef.test.ts`: idOf stable and monotonic; resolve of destroyed entity is `undefined`; pooled destroy invalidates ref; JSON round trip of a component holding a ref.
`__tests__/Relations.test.ts`: setParent exclusive; childrenOf order; cascade destroy vs remove vs ignore; destroy during `scene.each` is safe (collect then destroy).
`__tests__/RefRemap.test.ts`: SaveSystem v2 round trip with ref A->B and parent edge; ref to missing id becomes NO_REF and warns; nested GML var array remap; prefab-with-children internal ref vs external ref.
`__tests__/SignalBusEntity.test.ts`: `onEntity` listener removed on destroy; pooled reuse does not inherit listeners.
Extend `gmlCrossInstance.test.ts` / `gmlCollisionQueries` tests: `instance_find`, numeric id round trip, dangling `ref.field` still `undefined`.

## 6. Sweep steps (ordered, each committable)

| # | Commit | Owns | Depends |
|---|---|---|---|
| 1 | `feat(engine): entity ref and scene id table` | new `EntityRef.ts`, `Scene.ts` (idOf/resolve), `index.ts`, `Entity.ts` (`ref()`), test | none |
| 2 | `feat(engine): entityRef schema kind` | `Component.ts`, `packages/types/src/index.ts` (+ IDE Inspector later, outside sweep) | 1 |
| 3 | `feat(engine): relations api and childof` | new `Relations.ts`, `Scene.ts` (destroy policy), migrate `ui/WidgetTree.ts` `WidgetParent` onto it (or leave and alias), test | 1 |
| 4 | `feat(engine): remapRefs and save format v2` | new `RefRemap.ts`, `systems/SaveSystem.ts` (blob v2 + v1 read path), test | 1,2,3 |
| 5 | `refactor(engine): gms runtime uses shared remap` | `GmsRuntime.ts` (only lines 395-410), test | 4 |
| 6 | `feat(engine): gml instance ids and instance_find` | `compat/gmlCrossInstance.ts`, `gmlCollisionQueries.ts`, `gmlCamera.ts`, `index.ts` | 1 |
| 7 | `feat(engine): entity signals` | `systems/SignalBus.ts`, `Scene.ts` hook, `Game.ts` wiring | 3 |
| 8 | `feat(engine): scene file ids and refs` | `SceneFile.ts`, tests | 4 |
| later | toolchain: drop `_other.id` rewrite, emit ids | `packages/toolchain` (separate owner) | 6 |

Steps 1-3 and 6 are independent enough to run in parallel worktrees after step 1. `Scene.ts` is the hot file (steps 1,3,7): serialise those.

## 7. Risks
- **Dual identity** (eid vs EntityId): every API taking `Entity` stays valid; `EntityRef` only appears at serialisation boundaries. Mitigate with lint-style test that no component default contains an `Entity` instance.
- **`rawId` aliasing in network** (`NetworkEntityMap.ts:35`): recycled slots can collide; migrate it to `idOf` in a follow-up.
- **Pooled entities look alive** (`Scene.ts:158`): `resolve` must check the id table, not only `isAlive`.
- **Cascade semantics vs GML**: GameMaker has no parent/child destroy; keep `setParent` opt-in and never auto-apply to imported rooms.
- **Two scene shapes** (`types` Zod vs `SceneFile`): pick one before adding ids to both, else the IDE and runtime drift.
- **Engine rules**: all new code stdlib-only, no DOM; every new export through `index.ts` (and `index-exports.test.ts` and `dist-types` must not drift); no async in `onUpdate`; do not name sample projects in tests, use synthetic fixtures.
- **Cross-scene refs** (overlay HUD pointing at main-scene entity): `EntityRef` is scene-local. Provide `Game`-level `resolveIn(scene, ref)` only if a real use appears; otherwise document as unsupported.

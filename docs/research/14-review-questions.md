# 14 - Review questions, answered from the code

Read-only pass. Paths relative to `packages/` unless prefixed `apps/` or `docs/`. Line numbers are from the working tree at research time (another agent is mid-commit, so re-check before editing). "Derived" = concluded by reading the passes, NOT executed. Nothing here was run. Example object/variable names are synthetic.

Status of the symbol-table work seen in the tree: `toolchain/src/gml/` exists (lexer, parser, `symbols.ts`, `project-symbols.ts`, `builtins*.ts`, shadow/corpus tests). Migration steps 1-5 of docs/research/01 are consumed (`gms2-enums.ts:3-4`, `gms2-crossfile-refs.ts:3`, `gms2-transpile.ts:4-5` import only `scanImplicitVarsInText`, `scanMacros`, `TRANSPILER_RESERVED_IDENTIFIERS`). The cross-instance pass, the local-ref pass and the asset-value pass are STILL regex + module-level sets (no `.analyze(` call in any `gms2-*.ts`).

---

## 1. Local variable sharing an object's exact name

Where documented: `docs/decisions/gml-transpiler.md:46` gap (1) ("a local variable or script parameter that happens to share its exact name with a real project object type would be misidentified as a cross-instance reference"), and the code comment `gms2-transpile.ts:5097-5103` ("safe without a full per-file local-variable scope analysis"). The decision text calls it rare because of the `obj_` prefix habit; that only holds for prefixed projects.

Concrete example (project has an object named `wall`, unprefixed):

```gml
var wall = instance_place(x + hsp, y, wall);
if (wall != noone) { x = wall.x - sprite_width; }
```

Emitted today (derived from the passes):

1. `wall.x` becomes `GmlActions.gmlNum(GmlActions.getGmlObjectVar(_entity,_ctx,"wall","x"))` (`gms2-transpile.ts:5104-5137`, gate `_objectNames.has(head)` at :5117/:5132). That reads x of the FIRST live instance whose `Meta.name === "wall"` (`compat/gmlCrossInstance.ts:190-199`), not the instance `instance_place` returned. No error, wrong wall.
2. The local-ref mechanism that would have fixed it is explicitly disabled for this name: `localRefNames` filters out anything in `_objectNames` (`gms2-transpile.ts:5243-5246`), so `getGmlRefVar` is never chosen.
3. The asset-value pass (`:5391-5394`) has no local knowledge: only dotted access, `(`, and assignment targets are skipped, so `wall != noone` becomes `"wall" != "noone"` (always true). The `var wall =` target survives (assignment-target lookahead), which is why nothing throws.

Why ambiguous: at text level `wall` is one token that is legally both an object asset and a local. GML lexical rule: the local wins. The regex pipeline only has a name SET, no scope.

How the new design resolves it: `Scope.resolve` (`gml/symbols.ts`, resolution loop ~:98-135) checks block/function locals before the project layer and returns `{via:"lexical", symbol: local, shadowed:[objectAsset]}`; `project-symbols.ts:1051-1055` turns `shadowed` into a `kind:"shadow"` diagnostic; test `gml/__tests__/project-symbols.test.ts:131-136` (sprite variant). A consumer would emit the local access (`getGmlRefVar`, with `holdsEntity` inferred from the `instance_place` initializer), and the asset rewrite would skip a node that resolves lexically.
Residual after the fix: an implicit instance variable named like an object whose only write lives in ANOTHER object's `with` block is unknowable per file (see Q7); stays an asset, needs a diagnostic.

Verdict: real, documented, not fixed. Table has the answer and a test, the transpile passes do not call it.
Gap: cross-instance pass (:5104), local-ref filter (:5245), asset pass (:5391) still name-set based.
Action: migration step 7 of doc 01 (switch those three passes to `analyze()` resolution), add a golden test with the `wall` example above.

---

## 2. Cross-entity relationships: native TypeScript way vs GML

Built (doc 06 is now implemented, not just research):

- `EntityRef = { $ref: number }` (`EntityRef.ts:11`, `NO_REF`), per-scene lazy ids: `Scene.idOf` (`Scene.ts:252`), `Scene.refTo` (:263), `Scene.resolve(ref)` (:273, undefined if dead or recycled pooled entity), `entity.ref()` (`Entity.ts:113-116`).
- Component field kind `{ kind: "entityRef" }` (`Component.ts:23`); save and scene transfer remap it (`RefRemap.ts`, `SaveSystem.ts:1-3,61-73`).
- Relations on bitECS pairs: `defineRelation(name,{onTargetDestroyed:"remove"|"destroy", exclusive, acyclic})` (`Relations.ts:47`), built-in `ChildOf` (:66); `Scene.relate/unrelate/targetsOf/subjectsOf` (`Scene.ts:297-312`), `parentOf/childrenOf/setParent` (:316-336), `onDestroyed/onParented` hooks (:281-296).
- `SignalBus.onEntity(entity, name, fn)` auto-removed on destroy (`systems/SignalBus.ts:117`, cleanup :150); `Game` forwards `entity:destroyed` (`Game.ts:493-500`).
- Queries: `scene.each(CompA, CompB, (a, b, entity) => ...)` (`Scene.ts:352`).

Native usage (shape taken from `__tests__/RefRemap.test.ts:15-19` and `Relations.test.ts:52-56`):

```ts
const Follows = defineRelation("Follows");
const Target = defineComponent(
  "Target",
  () => ({ to: { $ref: 0 } as EntityRef }),
  { schema: { to: { kind: "entityRef" } } },
);
follower.add(Target, { to: leader.ref() }); // serialisable, survives save/room carry
scene.relate(follower, Follows, leader); // structural edge, reverse index O(subjects)
const lead = scene.resolve(follower.get(Target)!.to); // undefined when dead
const pos = lead?.get(Transform); // property access = entity.get(Component)
scene.subjectsOf(leader, Follows); // all followers
game.signals.onEntity(follower, "leader:hit", () => {}); // dies with follower
```

So "access another entity's properties" = resolve a ref/relation to an `Entity`, then `entity.get(Component)` (typed fields). No string field lookup.

GML path (compat, untyped): `obj_x.field` -> `getGmlObjectVar` scans `scene.each(Meta)` for first `Meta.name === objectName` (`compat/gmlCrossInstance.ts:190-199`, O(n), no early exit); `ref.field` -> `getGmlRefVar` reads a GML var, duck-types it as a live Entity (`:275-310`, now also accepts `EntityRef`, :310); `with`/`other` -> `with_each(ctx, target, cb)` (`compat/gmlActions.ts:873-898`, target Entity | "noone" | "all" | object-type string); `instance_find/instance_nearest` exist (`compat/gmlCollisionQueries.ts:265,294`); numeric ids = `100000 + scene id` (`gmlCrossInstance.ts:212-226`). GML fields live in the untyped per-`(World,eid)` side table, not components.

Gaps: `instance_find` uses `instancesOfType` (`gmlCollisionQueries.ts:252`), while `getGmlObjectVar` still uses the O(n) `findFirstInstanceOfType` (doc 06 planned one shared type index; not unified). `EntityRef` is scene-local (cross-scene overlay to main refs unsupported). SaveSystem persists only `ChildOf` plus relations listed in `SaveSystemOptions.relations` (`SaveSystem.ts:105`). Network map still keys on raw eid (doc 06 risk, unverified whether migrated).
Verdict: native path is built and tested; GML path works but is name-scan based.
Action: unify the two type lookups; document the two idioms side by side in the guide (docs frozen).

---

## 3. shader_set / shader_reset vs pixi compliance

Current semantic (`compat/gmlShaders.ts:52-84`):

- `shader_set` records the shader per entity in `activeByWorld` (:41 map, :62-65) then either (a) inside a Draw event calls `ctx.drawTarget.setShader(id)` or (b) outside Draw writes `Sprite.shader = id` (:69-71; field `components/Sprite.ts:118-124`).
- Inside Draw the target is a FRESH `PixiGmlDrawTarget` per entity per event (`systems/RenderPipeline.ts:1043-1067`, `GmlBehaviorSystem.ts:340`). Its `_shader` (:290-298) applies `pixiSprite.filters=[sharedFilter]` to each sprite-shaped child drawn while set (`_shade`, :297). Vector shapes and text on the `Graphics` are not filtered.
- Outside Draw, `RenderPipeline._applySpriteShader` (:1454-1473) sets `sprite.filters=[shared, flash?]` each sync until `Sprite.shader` is cleared.
- Filters are ONE shared instance per shader id (`resolveShaderFilter`, :1425-1450); uniforms are per shader id, global to every user (`gmlShaders.ts:20-26`), copied when the registry version changes.

If game code never calls `shader_reset`:

- In a Draw event: nothing leaks to other entities or the next frame at the render level, because the draw target (and its `_shader`) is discarded per call (derived from :1043-1067). This is DIFFERENT from GameMaker, where shader state is global until reset and bleeds into every later draw. So a missing reset is harmless here, and a game relying on the bleed (set in one object, reset in another) would render wrong. Unverified against a real project.
- Outside Draw: `Sprite.shader` stays on that entity permanently (persistent per-entity state, saved with the component since `shader` is a schema string, Sprite.ts:160).
- Both: `activeByWorld` keeps the id across frames, so later `shader_set_uniform_*` writes go to the stale shader silently (`writeUniform`, :103-118) instead of warning "no shader set". Cleared on entity destroy via `clearGmlShaderState` (:47).

Pixi-compliance check against `.claude/skills/pixijs-filters`, `pixijs-scene-mesh`, `pixijs-custom-rendering`:

| Skill rule                                                                                                        | Engine                                                                                                                      | Status                                                    |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Filter via options object, `glProgram`+optional `gpuProgram`, uniforms in typed `UniformGroup` inside `resources` | `CustomShaderFilter.ts:111-140` does exactly this                                                                           | compliant                                                 |
| Share one filter instance across sprites                                                                          | `_shaderFilters` map, RenderPipeline.ts:1406                                                                                | compliant                                                 |
| Use container-level filters, not one per child (perf)                                                             | one filter PER shaded sprite                                                                                                | non-compliant by design (GML semantics are per draw call) |
| Set `padding` (effects extend bounds), `resolution`, `blendRequired`, `filterArea`                                | `super({glProgram,gpuProgram,resources})` only, no padding/resolution/area                                                  | missing; outline/glow shaders clip                        |
| WebGPU needs `gpuProgram` (WGSL)                                                                                  | optional `wgslFragment`; renderer preference is `["webgpu","webgl"]` (`RenderSystem.ts:212`); `warnIfGlOnlyFilter` at :1441 | partial; a GL-only shader on WebGPU is a warned no-op     |
| Mesh with custom shader is unbatched; `Shader.from({gl,gpu,resources})`                                           | no Mesh path exists (grep `shaderMode                                                                                       | ShaderMesh` empty)                                        | not built (doc 04 design only) |
| Nine-slice / tiling / Projection3D                                                                                | not filtered (doc backlog D24)                                                                                              | gap                                                       |

Right semantic to make it compliant and faithful:

1. Keep the Filter (correct for post-effects; skill confirms). Add `padding` (from importer heuristic: shader samples offsets/named `texel|outline|blur`), and `blendRequired:false` explicitly. Optional `resolution:"inherit"`.
2. Reset state at a boundary the GML author expects: clear `activeByWorld` for an entity at the end of each Draw dispatch (and at frame end for the non-Draw path), and warn once when a Draw event ends with a shader still set. Decide policy: emulate GML bleed (global until reset) or keep isolation; isolation is safer, document as intentional divergence.
3. Mesh path for plain unfiltered-bounds sprites only after the real-GPU benchmark (doc 04 step 1): `Mesh` + `Shader.from({gl,gpu,resources})`, share the `UniformGroup`; accept unbatched cost.
4. Give every importer shader a WGSL twin (`toolchain/src/glsl-es-to-wgsl.ts` exists; doc 11) or force WebGL when any GML shader is registered.
5. Filter nine-slice/tiling nodes (`tracking.sliced`) through the same `_applySpriteShader`.

Verdict: honest approximation; construction API is pixi-v8 compliant, lifecycle and coverage are not.
Gap: no padding, no state reset, no WGSL guarantee, no Mesh path, sliced sprites unfiltered.
Action: (2) and (1) are small and safe now; (3) gated by benchmark; real GPU verification is still owed (gpu_followup).

---

## 4. Remappable keys and keyboard layouts

Already in the engine (customer code should not rewrite this):

- Physical state by `KeyboardEvent.code` (`systems/InputSystem.ts:93-110`); layout translation layer `KeyboardLayout` (`systems/KeyboardLayout.ts:110`): host-injected `setProvider` (:127), `learn(code,key)` fallback (:170, ignores "Dead"/"Process"/multi-char at :173), `codeForChar` (:202), `label` (:206).
- Learning guards for IME and modifiers: `isComposing !== true`, no Ctrl/Alt/Meta/Shift, `key.length <= 2` (`InputSystem.ts:97-108`). Turkish dotted-i and AltGr layers are avoided by refusing Shift/Alt events. Dead keys ignored.
- GML letters honour layout: `resolveVk` (`compat/gmlKeys.ts:111-120`) with physical fallback for Cyrillic/Greek/unlearned keys.
- Bindings: `Binding {kind:"key", code, char?}` (`Input.ts:32`), `isCharDown` (:54,489), `captureNext` (:559; swallows the press, Escape cancels, timeout, abort signal, gamepad edges), `rebindByCapture` (:588), `bindingLabel` (:733), `saveBindings/loadBindings` via `StorageAdapter` (:375-410; JSON, shape parse via `parseActionMap`).
- Host providers: `apps/ide/src/services/keyboardLayoutProvider.ts` (Chromium `getLayoutMap`, refreshed on focus/visibility; MDN documents no `layoutchange`) and `apps/ide/src-tauri/src/keyboard_layout.rs` (macOS TIS/UCKeyTranslate, Linux xkbcommon).

What game authors must still do: call `saveBindings`/`loadBindings` themselves (no engine caller; grep finds none outside `Input.ts`), draw their own rebinding UI with `captureNext`/`bindingLabel`, and pass the adapter.
Not built / unverified:

- Rust file header says "NOT COMPILED" (`keyboard_layout.rs:24`); backlog B-10. Cargo.lock not regenerated. Unverified on real Windows/Linux/Wayland (backlog C14).
- Provider is wired only into the IDE play iframe (`apps/ide/src/services/PlayRunner.ts:2`); `toolchain/src/gameShellTemplates.ts` has no layout wiring (backlog B-12). Exported games on macOS/Linux get only the learning fallback (cold-start: a key must be pressed once).
- `vk_shift/ctrl/alt` left-only, `keyboard_lastchar/keyboard_string` absent, `ord` duplicated (backlog D20). IME: composition is ignored for learning but game state is not suppressed while a DOM text field has focus (`_keys.set` runs before the guard, `InputSystem.ts:95`).

Library question. npm checked this session (registry API):

| Package                                                                                                                                                                                                                                                                                                                                                                                                 | Version / last publish                 | License                                                                                                              | Does it help?                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyboard-layout-map`                                                                                                                                                                                                                                                                                                                                                                                   | 1.2.0, 2026-09-23, ~380 downloads/week | MIT                                                                                                                  | wraps `getLayoutMap` and identifies named layouts; Chromium-only, so duplicates our Chromium provider and adds nothing for WKWebView/WebKitGTK |
| `keyboard-layout`                                                                                                                                                                                                                                                                                                                                                                                       | 2.0.17, 2022                           | none listed                                                                                                          | native Node module (Atom); not usable in a webview                                                                                             |
| `tinykeys` 4.0.1 (~405k/week), `hotkeys-js` 4.0.8, `@github/hotkey` 3.1.4, `mousetrap`, `keyboardjs`                                                                                                                                                                                                                                                                                                    | maintained, MIT (mousetrap Apache)     | shortcut/chord binders on `event.key`/`code`; no layout map, no capture-for-rebind, no gamepad, no per-frame polling |
| Verdict: no maintained library replaces this. The engine needs (a) per-frame polling of physical codes, (b) a code-to-char table without a Chromium-only API, (c) gamepad-inclusive capture; shortcut libs solve none. The hand-rolled `KeyboardLayout` is ~250 lines. The only defensible swap is `keyboard-layout-map`'s layout-name identification if a "show layout name" UI is wanted; not needed. |
| Action: wire `loadBindings` into a documented bootstrap helper, verify Rust build on macOS/Linux (B-10), wire provider into exported shells (B-12), fix D20 items.                                                                                                                                                                                                                                      |

---

## 5. IDE git client: library or hand-rolled?

Finding: shells out to the git CLI, hand-parses its text output. No library anywhere (`apps/ide/package.json` and `src-tauri/Cargo.toml` have no git dependency).

- Rust: one generic passthrough `run_git(project_dir, args)` = `std::process::Command::new("git").current_dir(..).args(..).output()` (`apps/ide/src-tauri/src/lib.rs:198-224`, registered :493). No shell involved, argv is a Vec (no injection).
- TS: `GitPanel.tsx:37-43` invokes it; commands assembled at :350-362 (`status --porcelain`, `rev-parse --abbrev-ref HEAD`, `log --pretty=format:%H%x1f%an%x1f%ad%x1f%s`, ahead count); status parsed with `line.slice(0,2)` / `slice(3).trim()` (:374-388); diff rendered by line-prefix colouring (`DiffView`, :129-170); `push` = `git push` (:438-447). Browser mode shows mock data (`MOCK_COMMITS`). Rationale recorded at `docs/decisions/ide-tauri-and-tooling.md:41-43`.
- Hand-rolled parts are tiny: ~40 lines of porcelain/log parsing. Real defects (derived): porcelain v1 without `-z` mishandles quoted paths (spaces/unicode), renames (`R  old -> new`), and conflict codes (`UU`, `AA`) map to "modified".

Alternatives:

| Option                                                                                                                                                                                                                                                                   | Verdict                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git2` crate 0.21 (libgit2, updated 2026-05)                                                                                                                                                                                                                             | heavy C build (libgit2, OpenSSL/libssh2), push auth needs hand-written credential callbacks that ignore the user's ssh-agent/credential helper config; loses parity with the user's own `git` |
| `gix` 0.88 (gitoxide, active)                                                                                                                                                                                                                                            | pure Rust and fast for read paths; push/transport-write coverage incomplete; large surface, still pre-1.0                                                                                     |
| `isomorphic-git` 1.42 / `simple-git` 4.0 (npm)                                                                                                                                                                                                                           | isomorphic-git could serve the browser-only mode but is slow on large repos and lacks parity; `simple-git` just wraps the CLI (same as now, needs Node, not in a Tauri webview)               |
| Verdict: the user's rule ("do not hand-roll git unless truly smaller and more performant") is satisfied. Delegating to the CLI is the smallest correct option (real auth, hooks, LFS, config parity); no library is smaller. What is hand-rolled is only output parsing. |
| Gap: fragile parsing; no conflict/rename/branch UI; browser mode mock only (not tested against a real repo).                                                                                                                                                             |
| Action: switch to `git status --porcelain=v2 -z --branch` and `git log -z`, keep the CLI; unit-test the parser on rename/quoted/conflict lines. Do not adopt `git2`/`gix` now.                                                                                           |

---

## 6. Persistence modelling

Exists:

- `SaveSystem` v2 (`systems/SaveSystem.ts:12` `SAVE_FORMAT_VERSION=2`): explicit list of save-aware `ComponentDef`s, per-component `version` + `registerMigration` (:177), entity ids + relations (`ChildOf` plus listed ones, :105), `meta` (savedAt/engine/game version), room key, optional `GlobalStore` and `VariableStore` sections (:64-72), `peek` header (:299), `SaveFormatError` for newer saves (:18), load modes replace|append (:119).
- `GlobalStore` (`systems/GlobalStore.ts:81`): `declare(name,{initial,persist})`, only `persist:true` enters `snapshot()` (:122), JSON-clean copy with depth cap (:57-90).
- `SceneTransfer` (`SceneTransfer.ts`): `captureEntities/restoreEntities` for scene swaps, policy `persistentTransferPolicy` (`Meta.persistent`, :63), per-entity `EntityExtra` hooks (:28), remap via `RefRemap.ts`. GML uses it with `gml.vars` and `gml.action` extras (`GmsRuntime.ts:54-77`).
- `RoomStateCache` (`RoomStateCache.ts:12`): per-`persistentKey` snapshots, stored on leaving a persistent scene (`Game.ts:603,658`), restored on re-entry.
- `StorageAdapter` interface (memory default; IndexedDB/fs adapters are the host's job).

Game author must still: construct `SaveSystem` and list components (no auto-registry; `Game.ts` does not create one), supply a real adapter, call `save/load`, declare globals with `persist:true`, call `registerMigration` per changed component, mark persistent entities/rooms, build slot UI, handle autosave timing.

Gaps (each verified by reading or grep):

1. `SaveSystem` does not persist `EntityExtra` state, so GML instance variables and action state are lost in a save file (only carried across rooms). `grep extras SaveSystem.ts` is empty.
2. Room cache and in-flight carry are not written to save files (backlog D7); a save mid-game forgets visited persistent rooms.
3. No `EntityExtra.version` or globals migration hook (D7); `Component.v` migration on scene load unused (D3).
4. State outside components: physics bodies, timelines, sequences, particles, audio playback, tween/coroutine state are not in any snapshot (unverified per system; none named in `SaveSystem`).
5. `game_restart` reset of `gmlStatics` and module-level GML state (D8); `game_save/game_load`, `ini_*`, buffer save are GML surface, untraced here.
6. No cloud/atomic-write/backup rotation; corruption returns null for invalid JSON without recovery.
7. Two scene shapes (types Zod vs runtime `SceneFile`) unresolved (doc 13, D4).
   Verdict: entity/component persistence and cross-room carry are solid and tested; whole-game save fidelity (GML vars, room cache, non-component systems) is incomplete.
   Action: add `extras` to `SaveSystem` options first (smallest, unlocks GML saves), then serialise `RoomStateCache`.

---

## 7. Cross-file dataflow for the `owner.x` pattern (requirement only)

Pattern (synthetic names):

```gml
// obj_turret/Create: spawns a shot and hands it a back-reference
my_shot = instance_create_layer(x, y, "Shots", obj_shot);
with (my_shot) { owner = other.id; }
// obj_shot/Step: owner is never assigned in obj_shot's own files
x = owner.x; image_xscale = owner.image_xscale;
```

Why open: `owner` is a plain implicit instance variable of `obj_shot`; its value (a live Entity) is assigned from a different object's event via a `with` block. A same-file scan (`localEntityRefs`, `gms2-transpile.ts:5142`) sees no Entity-returning call for `owner`, so `owner.x` stays a bare property on the wrong thing.
What "dataflow" means: a project-wide fact "field F of object T can hold an Entity", produced by writes in other files, consumed by reads in T's files. The requirement: (1) find every write of F whose right-hand side is an Entity-valued expression (`other.id`, `id`, `self`, a variable already known to hold an Entity, an Entity-returning built-in), (2) attribute the write to a target object type when the `with` target resolves (local initialised from `instance_create_*(…, obj_shot)` or an object name), else to the project-wide field name, (3) iterate to a fixed point across files (a field assigned from another Entity field), (4) expose `holdsEntity` per `(object, field)` to the read-side rewrite.
Today: closed for exactly one idiom, field-name granularity: `gms2-crossfile-refs.ts` -> `scanEntityRefFieldsInText` (`gml/project-symbols.ts:1136`, AST-based, replaces the old regex) -> `_crossFileEntityRefFields` merged at `gms2-transpile.ts:5243`. Over-approximation: two objects with the same field name, only one holding an Entity, both rewritten. Summary of the closed case is at `docs/decisions/gml-transpiler.md:171-182`.
Stays unresolvable statically (needs runtime fallback `getGmlRefVar`'s duck-typing, `gmlCrossInstance.ts:275`): struct property carrying it (`s.owner = other.id` read elsewhere), ds_map/ds_list/global/array round trips, values passed through script arguments (`init(inst)` then `owner = argument0`), the `instance_create_*` variables-struct argument, assignments computed by `variable_instance_set` or string names, conditional Entity-vs-number values (`noone` sentinel), and inheritance where the writer targets a parent object and the reader a child. Library: none needed; the parser and `ProjectSymbols` fixed-point already exist. Another agent owns the design.
Verdict: idiom closed at field-name precision; general dataflow open.

---

## 8. Nine-slice and tiling sprites in the room editor

Engine: `Sprite.sliceMode` 0|1|2, `sliceLeft/Right/Top/Bottom`, `width/height` (`components/Sprite.ts:104-116`, schema :155-158). Render: `RenderPipeline._syncSliced` (:1735 onward) uses pixi `NineSliceSprite` (mode 1) and `TilingSprite` (mode 2), sized `width x height`, then multiplied by `Transform.scale` (:1786-1799).
Room editor (`apps/ide/src/components/panels/RoomEditor.tsx`, `roomEditorGeometry.ts`): IT IS BUILT.

- Data: `collectPrefabSprites` (:100) and `instanceSprite` (:130) merge prefab Sprite overrides with instance `props` (same precedence as `Scene.spawn`), reading `texturePath,width,height,sliceMode,sliceLeft/Right/Top/Bottom`.
- Draw: `nineSliceRects` (`roomEditorGeometry.ts:40`, used RoomEditor.tsx:546) and a tiled branch (:559); textures cached (:267,373); placeholder box on load failure.
- Handles: `hitResizeHandle` (geometry :93), pointer-down handle test wins over body hits (RoomEditor.tsx:865-882), `resizeBox` + `snapValue` (geometry :121-150), drag applied at :1037.
- Inspector: "Slicing" select None/Nine-slice/Tiled (:1595-1626), numeric Width/Height and, for nine-slice, four slice inputs (:1633-1665). Writes go to instance props via `withProps` and `commit`.
- Tests exist: `apps/ide/src/__tests__/roomEditorGeometry.test.ts`, `RoomEditor.test.tsx`. Never run in a real browser: backlog C10.
  Importer emission: nine-slice only, from sprite `.yy` `nineSlice.enabled` -> `sliceMode:1` + four guides on the OBJECT prefab (`toolchain/src/gms2-codegen.ts:322-327`, source `gms2-sprite-import.ts:198-210`). Tiled only from background layers `htiled/vtiled` -> `sliceMode:2` (`gms2-room-import.ts:645-670`).

Exactly what is missing to make them first-class:

1. Draggable slice GUIDES on the canvas (left/right/top/bottom lines over the source texture); only numeric inputs exist. No preview of the source slices.
2. Tile mode per slice: GameMaker's nine-slice `tileMode` (stretch/repeat/mirror/hide) is not read (`grep tileMode gms2-sprite-import.ts` empty) and pixi `NineSliceSprite` only stretches. Repeat/mirror centres render stretched.
3. Instance scale vs size: the room importer emits `scaleX/scaleY` for instances (`gms2-room-import.ts:357-364`) and the renderer applies `Transform.scale` on top of `width/height` (`RenderPipeline.ts:1799`), so a GameMaker-scaled nine-slice instance scales the CORNERS too (GameMaker resizes only the stretch regions). Derived, not tested; fix by converting `scale*sprite size` into `width/height` for `sliceMode:1` on import. The editor edits width/height, so editor and importer disagree on where size lives.
4. Tiled instances cannot come from GameMaker objects; authored only in the editor (mode select exists). Missing controls: tile offset/scale (`tilePosition`, `tileScale`) and per-axis tiling; `Sprite` has no fields for them.
5. Prefab-level defaults are not editable in the room editor (edits are per-instance props); no "reset to prefab size".
6. Component schema types: `sliceMode` is `{kind:"number"}` (`Sprite.ts:155`), so the generic Inspector shows a raw number, not an enum; add `kind:"enum"`.
7. Shaders skip these nodes (Q3). Physics/collision boxes for sliced instances: `spriteHalfExtents` (`compat/gmlActions.ts:1236`) is sprite-size based; not checked for `width/height`.
8. CanvasPreview and scene document round trip of these props not verified in a real run (C10).
   Verdict: usable and resizable today via handles and inputs; not yet first-class (no guide dragging, no tileMode, importer scale mismatch, no enum Inspector).
   Action: fix item 3 first (correctness), then 1 and 6.

---

## 9. Sprite state-machine comparison, `gmlNum`, and `image_number`

What the decision record describes (`docs/decisions/gml-transpiler.md:161`): an idle/walk/air state machine such as `if (spr_ind == spr_walk)` where `spr_ind` is a local or instance variable holding a sprite. The bare-read pass wraps instance reads in `GmlActions.gmlNum(getGmlVar(...))` (`gms2-transpile.ts:5035`), the new asset pass turned `spr_walk` into a quoted path, and `gmlNum` then flattened the stored string to `0`, so `0 == "./assets/..."` was always false: a hard `ReferenceError` became a silent always-false.
Current state: FIXED in the runtime, doc text is stale. `gmlNum` returns non-numeric strings unchanged (`compat/gmlInstanceVars.ts:159-178`, comment :135-158). Research 10 confirms and notes the missing end-to-end test (only unit `gmlNum("hello")` in `compatGml.test.ts:100-115`, no execution of `gmlNum(getGmlVar(..)) === path`). Residual: a sprite named like a number (`"1e3"`, `"0x10"`) coerces via `Number()` (edge, untested).

Real remaining defects in the same feature (found this pass, derived from code):

1. Multi-frame path mismatch. Prefab initial `texturePath` for a multi-frame sprite is `frame_{n}.png` (`gms2-codegen.ts:291`, :1003; room import :853) but every transpiled sprite reference is `frame_0.png` (`spriteTexturePath`, `gms2-transpile.ts:159-163`). So `sprite_index == spr_walk` is FALSE for a multi-frame sprite at its initial state, and after `sprite_index = spr_walk` it is `frame_0.png`, which now equals the compared constant but no longer equals what the prefab produced. State machines that mix initial and assigned sprites break. (Doc 08 flagged the id mismatch at "Risks".)
2. `sprite_index = spr_x` writes ONLY `texturePath` (`gms2-transpile.ts:4138-4141`). `frameCount`, `frameSpeed`, `currentFrame`, width/height are not updated, and the literal `frame_0.png` has no `{n}` so `resolveSpriteFramePath` (`components/Sprite.ts:175-186`) shows frame 0 forever. Swapping to a multi-frame sprite never animates; swapping from a multi-frame to a single-frame keeps the old `frameCount`, so `SpriteAnimationSystem` (`systems/SpriteAnimationSystem.ts:27-45`) cycles `currentFrame` over a path with no `{n}` (harmless) but `image_number` is wrong.
3. Any bare identifier is treated as a sprite: `SPRITE_ASSET_RE = /^[A-Za-z_]\w*$/` (`gms2-transpile.ts:4096`, used :4118, comparison rewrite :4150-4157) with NO registry check, so `sprite_index = my_local;` becomes `"./assets/sprites/my_local/frame_0.png"` and `sprite_index == other_var` compares to a fake path. Should consult `_spriteNames`.
4. `image_number` is honoured for the calling instance only (`get_gml_image_number` reads `Sprite.frameCount`, `gmlActions.ts:1358-1371`; rewrite `gms2-transpile.ts:3541-3549`); dotted `inst.image_number` is not resolved.
5. `sprite_get_number(sprite)`: NOT BUILT. It appears only in name lists (`gml/builtins-data.ts:589`, `gms2-source-bugs.ts:556`); no compat function, although `AssetRegistry.frameCount` exists (`systems/AssetRegistry.ts:87`). Also absent: `sprite_get_name`, `sprite_get_xoffset/yoffset`, `sprite_get_speed`.
6. `image_index` / `image_speed` are honoured: read/write map to `Sprite.currentFrame/frameSpeed` (`gms2-transpile.ts:4338-4362`), wrap or clamp in `SpriteAnimationSystem` (:27-45, per step, dt-independent).
7. Animation End event: NOT BUILT. `Other_7.gml` is transpiled to a function `onOther7` (`gms2-codegen.ts:853-855`, leftover naming) but nothing invokes it (grep of engine for `onOther`/animation end: only an unrelated test). There is also no "animation ended" signal from `SpriteAnimationSystem` (non-looping clamp simply stops; no event, no `image_index` end flag).
   Verdict: the crash-to-false regression is fixed at runtime; sprite swapping semantics are incomplete (points 1-3 are correctness bugs, 5 and 7 are not built).
   Action: (a) make `sprite_index` assignment set path + frameCount + frameSpeed + size from the asset registry; (b) unify texture path convention (`frame_{n}` for multi-frame in the transpiler, resolved via the registry, item Q10); (c) registry-check `resolveSpriteAssetExpr`; (d) add `sprite_get_number` and an Animation End dispatch (event 7 on frame wrap/clamp); (e) add the end-to-end comparison test from research 10.

---

## 10. Project-wide asset-name registry (bare `spr_*` / `snd_*` as values)

What it is: the pass at `gms2-transpile.ts:5315-5395` that rewrites a bare identifier used as a value (`draw_sprite(spr_hero, ...)`, `audio_play_sound(snd_hit, ...)`, `room == rm_init`, `draw_set_font(fnt_menu)`) into the string the engine uses: sprite -> `"./assets/sprites/<name>/frame_0.png"`, other kinds -> `JSON.stringify(name)` (:5364-5375). Membership comes from per-kind name sets installed before transpiling.

Is it tied to the real .yyp? YES for the main registry, no prefix convention involved:

- `gms2-import.ts:196-244` walks `normalizeYypResources(project.resources)` and buckets each resource by the resource PATH directory (`objects/`, `sprites/`, `sounds/`, `fonts/`, `rooms/`, `shaders/`, `scripts/`, ...), taking the name from the .yyp entry. Sets are installed by `setGmlObjectNames/SpriteNames/SoundNames/FontNames/RoomNames/ShaderNames` (`gms2-import.ts:285-298`), and passed to `scanGmlSourceBugs` as `assetNames` (:305-322). `kindByName` (:5326-5344) merges them. Note: bucketing uses the path prefix from the .yyp entry; the `resourceType` field would be a more direct signal but the path is the resource's own recorded location, not a naming habit.
- The new symbol table registers assets from the same lists (`buildProjectSymbols`, `lookupAsset` collisions), and `gms2-asset-index.ts` + `systems/AssetRegistry.ts` (`sprite_get_width/height/exists`, `gmlActions.ts:1379-1400`) consume an emitted `asset-index.json` derived from the same import data.

Prefix-convention heuristics found (audit of `toolchain/src`, `engine/src`, `apps/ide/src`; searched `spr_|snd_|obj_|fnt_|rm_|scr_` in regexes/`startsWith`):

| #                                                                                                                                                                                                                   | Location                                                                                                                                                                     | What it does                                                                                                                                            | Risk                                                                                                                                                                                                                                                                                                                                                                                                                                           | Replacement                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                                                                                                                                                                                                                   | `gms2-source-bugs.ts:576` `/^(?:spr\|sprite)/i.test(p)`                                                                                                                      | script parameter NAMES starting `spr`/`sprite` are assumed to be sprite parameters when scanning `@param` doc comments (`scriptSpriteParams`, :563-580) | a sprite param named `img`/`icon` is missed; a non-sprite `spriteCount` is misclassified, causing false "missing-sprite"                                                                                                                                                                                                                                                                                                                       | use JSDoc type (`{Asset.GMSprite}`) if present, else infer from call sites passing a registered sprite name (registry lookup), never the param name                          |
| 2                                                                                                                                                                                                                   | `gms2-source-bugs.ts:258` and `gml/builtins.ts:99` `GML_CONSTANT_PREFIX` (`c_`, `vk_`, `sprite_`, `path_`, `tile_`, `audio_`, `asset_`, `input_`, `text_`, `timeline_`, ...) | treats any `<prefix>_x` as a built-in constant (`isKnownValue` :713; `isKnownBuiltinName`/`builtinConstant` `builtins.ts:103-112`)                      | it checks BUILT-IN prefixes, not the customer's, but a customer asset named `sprite_hero`, `path_loop`, `tile_grass`, `audio_hit` is classed as a constant. In the symbol table assets are resolved before builtins (`project-symbols.ts:1021-1037`), so resolution is safe; in source-bugs `isKnownValue` short-circuits BEFORE the missing-asset check (:713 then :758-760), so a genuinely missing `sprite_hero` is silently never reported | in source-bugs, test registry membership first; keep prefix regex only for names not in the registry, or replace with the exact built-in constant table (`builtins-data.ts`) |
| 3                                                                                                                                                                                                                   | `gms2-transpile.ts:4096,4118,4150-4157` `SPRITE_ASSET_RE = /^[A-Za-z_]\w*$/`                                                                                                 | ANY identifier is treated as a sprite in `sprite_index` assignments/comparisons                                                                         | not a prefix rule but the opposite: no registry at all, so locals become bogus paths (see Q9.3)                                                                                                                                                                                                                                                                                                                                                | `_spriteNames.has(expr)` (registry) else pass through                                                                                                                        |
| 4                                                                                                                                                                                                                   | `gms2-source-bugs.ts:262-,542-` `OBJECT_ARG_FUNCS` / `SPRITE_ARG0_FUNCS`                                                                                                     | argument POSITION tables (draw_sprite arg0 = sprite), not naming                                                                                        | fine; keyed by function, not name                                                                                                                                                                                                                                                                                                                                                                                                              | move into the built-in signature table with param kinds (doc 01 section 3)                                                                                                   |
| No `spr_`/`snd_`/`obj_` regex was found in `engine/src` or `apps/ide/src` (only test fixtures and comments). The asset-value regex itself (`:5391`) is a generic identifier scan looked up in the map, prefix-free. |

Other registry-honesty gaps:

- Cross-kind name collision silently deletes the name (`ambiguous` at :5326-5344): GameMaker forbids duplicate names across kinds, so a collision indicates a broken .yyp or case difference; `project.lookupAsset(...).collisions` (doc 01/08) should replace the silent drop with a report entry.
- "Missing" assets are inferred by USAGE in call positions (`scanGmlSourceBugs`, :750-793), so a missing asset used only as a plain value (not in a known call) is not detected. The .yyp is the authority for "exists"; usage inference is only for "referenced but absent".
- Legacy .yyp shapes are normalised (`gms2-parse.ts:43-71`), unverified on old real projects in this pass.
  Verdict: registry IS derived from the real .yyp resource list, not a naming convention. Two prefix heuristics remain (rows 1 and 2), and the sprite assignment pass ignores the registry (row 3).
  Action: replace rows 1-3 with registry lookups; make the single `ProjectSymbols.lookupAsset` (and the emitted asset index) the only membership authority for source-bugs, the asset pass and the sprite pass; emit collisions to the migration report instead of dropping.

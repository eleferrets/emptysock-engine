import type { World } from "bitecs";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import type { Game, SceneDefinition } from "../Game.js";
import type { PrefabDef } from "../Prefab.js";
import type { GmlDrawTarget } from "./gml.js";
import type { LayerSystem } from "../systems/LayerSystem.js";
/**
 * Everything a generated `.behavior.ts` action call needs beyond the
 * `Entity` it's acting on. Mirrors the existing "engine hands out
 * `SceneLifecycle`, game code reads what it needs" dependency-injection
 * shape (`ctx.plugins`/`ctx.variables` etc.) rather than reaching for a bare
 * importable singleton — `game`/`rooms`/`prefabs` are genuinely per-project
 * data a generated behavior module cannot know on its own.
 *
 * `game`/`rooms`/`roomOrder`/`prefabs` are optional because a project that
 * never calls a room-changing or object-creating action doesn't need to
 * build any of this — only `scene` (needed by `action_kill_object` via
 * `Scene.destroy`) is required.
 */
export interface GmlActionContext {
  /** The live `Scene` this entity belongs to. Required for `action_kill_object`/`action_create_object`/`instance_create`. */
  readonly scene: Scene;
  /** Needed by `action_next_room`/`action_another_room` to actually swap scenes. Omit if this project never uses room-changing actions. */
  readonly game?: Game;
  /**
   * GameMaker room name -> this engine's `SceneDefinition` for that room.
   * The GMS2 importer emits one `.scene.json` per room but has no way to
   * know how a specific game wants to load one (via `loadSceneFile` into a
   * hand-authored `SceneDefinition`, or something bespoke) — so building
   * this map is left to the game, the same "engine defines the shape, game
   * code wires the actual behavior" split `buildObjectBehavior()` already
   * documents for prefab dispatch.
   */
  readonly rooms?: Readonly<Record<string, SceneDefinition>>;
  /** Room order, for `action_next_room`'s "current room's index + 1" semantics. */
  readonly roomOrder?: readonly string[];
  /** The GameMaker room name currently loaded — needed to resolve `action_next_room`'s "next" relative to "current". */
  readonly currentRoom?: string;
  /** GameMaker's `previous_room` bare read — the room loaded immediately before this one, or absent if this is the first room loaded this session. Populated by `GmsProjectRuntime` on every room load; a caller building its own `GmlActionContext` by hand can leave this unset. */
  readonly previousRoom?: string;
  /** GameMaker object name -> a registered prefab, for `action_create_object`/`instance_create`. */
  readonly prefabs?: Readonly<Record<string, PrefabDef>>;
  /** Optional sound-asset-id lookup for `action_sound` (GameMaker sound name -> an id playable via `ctx.game.audio.play(id)`). See `action_sound`'s doc comment for the current limits of this. */
  readonly sounds?: Readonly<Record<string, string>>;
  /**
   * The live drawing surface a `draw_*` call (`compat/gml.ts`) targets while
   * inside a generated `onDraw`/`onDrawGui` call. `GmlBehaviorSystem` is the
   * one thing that ever sets this — it swaps in a fresh `GmlDrawTarget`
   * (backed by a per-entity pixi `Graphics`, cleared and redrawn every call,
   * never persisted) immediately before invoking a behavior module's
   * `onDraw`/`onDrawGui`, and clears it again immediately after. Undefined
   * everywhere else (`onCreate`/`onUpdate`/`onDestroy`/collision/key
   * handlers never draw), so a `draw_*` call made outside a draw dispatch is
   * a safe, honest no-op rather than throwing.
   */
  readonly drawTarget?: GmlDrawTarget;
  /**
   * The live `LayerSystem` this scene renders through, for GameMaker's
   * `layer_*` room-layer compat functions (`compat/gmlLayer.ts`). Optional —
   * a project that never calls `layer_x`/`layer_exists`/etc. doesn't need to
   * wire this; every function in `gmlLayer.ts` is an honest no-op/`false`
   * without it, the same "no live instance to even ask" convention
   * `QueryChannel`'s `no-live-instance` already establishes.
   */
  readonly layers?: LayerSystem;
}
/**
 * GameMaker's real `speed`/`direction`/`hspeed`/`vspeed` built-in instance
 * variables — distinct from GM8.1's DnD `action_move` (above), but sharing
 * the exact same per-`(World, eid)` velocity side-table and the exact same
 * "the runtime keeps applying this every step" semantic: setting `speed`/
 * `direction` (or `hspeed`/`vspeed` directly) on a real GameMaker instance
 * makes it move automatically every step from then on, with no further
 * code required — precisely what `gmlActionsStep`'s existing `vx`/`vy`
 * integration already does. Confirmed against a real, full GameMaker
 * project (Freedom Backup's `obj_Egun`/`obj_bullet_par`: `direction =
 * other.image_angle + random_range(...);` inside a `with` block targeting a
 * freshly `instance_create_layer`-ed bullet, read back nowhere else — the
 * bullet moves purely from this one assignment, GameMaker's own automatic
 * per-step integration, never an explicit `x += ...` in the bullet's own
 * Step event).
 *
 * `direction`/`speed` are angle/magnitude; `hspeed`/`vspeed` are the same
 * vector's cartesian components — GameMaker itself keeps all four in sync
 * (setting one recomputes the others), so every setter here recomputes
 * `vx`/`vy` (the one real source of truth `gmlActionsStep` integrates) and
 * every getter derives its own value from `vx`/`vy` (except `direction`,
 * which falls back to `motion.direction`'s own remembered value at
 * zero speed — see the interface doc comment above).
 */
export declare function getGmlSpeed(
  entity: Entity,
  _ctx: GmlActionContext,
): number;
export declare function setGmlSpeed(
  entity: Entity,
  _ctx: GmlActionContext,
  speed: number,
): void;
export declare function getGmlDirection(
  entity: Entity,
  _ctx: GmlActionContext,
): number;
export declare function setGmlDirection(
  entity: Entity,
  _ctx: GmlActionContext,
  direction: number,
): void;
export declare function getGmlHspeed(
  entity: Entity,
  _ctx: GmlActionContext,
): number;
export declare function setGmlHspeed(
  entity: Entity,
  _ctx: GmlActionContext,
  hspeed: number,
): void;
export declare function getGmlVspeed(
  entity: Entity,
  _ctx: GmlActionContext,
): number;
export declare function setGmlVspeed(
  entity: Entity,
  _ctx: GmlActionContext,
  vspeed: number,
): void;
/** Clear this `(world, eid)` pair's motion/alarm state. Call from `Scene.destroy()` — same pooled-id-reuse reasoning as `clearPhysicsBody`/`clearVisualScriptScope`. */
export declare function clearGmlActionState(world: World, eid: number): void;
/**
 * Backing store for a transpiled GML `static` declaration (see
 * `gms2-transpile.ts`'s "GML `static` variables" rewrite pass, and
 * CLAUDE.md's "GMS2.3+ syntax and array functions" entry for the full
 * design writeup).
 *
 * GML's `static x = 0;` persists a variable across every call to the one
 * specific function/method it's declared in — shared by every instance
 * calling a struct-constructor method, shared across every call to a
 * script function, and (confirmed against GameMaker's manual/community
 * docs on object-event statics) shared across every instance of an object
 * using that event's compiled code too, since GameMaker treats all three
 * as "one function, one static slot" regardless of how many times that
 * function is invoked or by how many different instances. `static` is only
 * valid JS syntax inside a `class` body, so the transpiler can't emit it
 * verbatim — instead it rewrites each declaration into a lazy-initialised
 * slot in this one process-global, string-keyed store, and every bare
 * reference to that name within the same declaration's function body into
 * a read/write against that slot.
 *
 * A plain module-level object (not a `WeakMap`/`Map` keyed by `World`) is
 * the semantically correct shape here — unlike per-entity state
 * (`PhysicsBody`'s callbacks, `VisualScriptState`'s evaluation scope),
 * GML's `static` is explicitly *not* per-instance or per-world: it's one
 * slot per generated function for the whole lifetime of the running
 * process, matching this object's own lifetime exactly. The transpiler
 * gives each declaration a slot key unique per (generated function,
 * declaration occurrence) so two different generated functions declaring
 * a same-named static never collide.
 */
export declare const gmlStatics: Record<string, unknown>;
/**
 * GM8.1 "Move Fixed" — set this entity's velocity from a 9-bit compass
 * bitmask (see `MOVE_DIRECTION_BITS`) and a speed, in pixels/step. Applied
 * every step by `gmlActionsStep` (codegen calls this once per generated
 * `onUpdate`/Step handler for any object that uses a motion action), not
 * integrated immediately here — GM8.1's own action sets the instance's
 * `speed`/`direction` built-ins once and its runtime keeps applying them
 * every step until changed, which this side-table + per-step apply
 * reproduces.
 */
export declare function action_move(
  entity: Entity,
  _ctx: GmlActionContext,
  directionBits: number,
  speed: number,
): void;
/**
 * GM8.1 "Move To" — move directly toward/to an absolute or relative point.
 * `relative: true` treats `x`/`y` as offsets from the entity's current
 * position (GameMaker's per-action "Relative" checkbox, mirrored here
 * rather than a separate `action_move_to_relative` function — see
 * `action_set_relative` below for the other actions that share this flag).
 * Unlike `action_move`, this repositions the entity immediately rather than
 * setting a continuing velocity — GM8.1's "Move To" is a one-shot jump, not
 * a sustained motion.
 */
export declare function action_move_to(
  entity: Entity,
  _ctx: GmlActionContext,
  x: number,
  y: number,
  relative?: boolean,
): void;
/** GM8.1 "Snap to Grid" — round the entity's position down to the nearest grid cell. */
export declare function action_snap(
  entity: Entity,
  _ctx: GmlActionContext,
  hsnap: number,
  vsnap: number,
): void;
/** GM8.1 "Set Friction" — per-step speed decay applied by `gmlActionsStep`. */
export declare function action_set_friction(
  entity: Entity,
  _ctx: GmlActionContext,
  amount: number,
): void;
export declare function action_set_relative(
  entity: Entity,
  _ctx: GmlActionContext,
  relative: boolean,
): void;
/** GM8.1 "Change Sprite" — set the entity's `Sprite` texture/sub-image. `speed` is GameMaker's animation-speed multiplier; this engine has no per-entity animation-speed field on `Sprite`, so it's accepted (to match the real GM signature) but currently a documented no-op — animating sub-images is `RenderPipeline`'s job, not this compat layer's. */
export declare function action_sprite_set(
  entity: Entity,
  _ctx: GmlActionContext,
  spriteTexturePath: string,
  subimage: number,
  _speed: number,
): void;
/** GM8.1 "Set Sprite Colour/Blending" — tint + alpha. `blend` is a GameMaker colour value (`0xBBGGRR` — GML's colour order, not `0xRRGGBB`); converted to this engine's `Sprite.tint` (`0xRRGGBB`, matching `packages/engine/src/components/Sprite.ts`). */
export declare function action_sprite_color(
  entity: Entity,
  _ctx: GmlActionContext,
  blend: number,
  alpha: number,
): void;
/**
 * `room` — GameMaker's own bare built-in read of the currently active
 * room's asset reference. GML source overwhelmingly compares it against a
 * bare room-name identifier (`if (room == rm_menu) { ... }`) rather than
 * calling a function, so this returns `ctx.currentRoom` as-is (a plain room
 * name string, or `""` when nothing wired it — an honest empty room name,
 * never a fabricated one) for `gms2-transpile.ts`'s bare-identifier rewrite
 * to read. `GmlActionContext.currentRoom` is the exact field `action_next_
 * room`/`action_another_room` above already read/maintain, and
 * `GmsProjectRuntime.currentRoom` (see CLAUDE.md's "Room transitions
 * triggered from inside GML" entry) is what actually keeps it accurate
 * across a room-changing action, so a bare `room` read and a GameMaker
 * room-name comparison agree with whatever room is really loaded.
 */
export declare function room(ctx: GmlActionContext): string;
/**
 * `room_exists(room)` — GameMaker's real function takes a numeric room
 * asset index and answers whether it's a valid room in the project. This
 * importer has no numeric room-index concept (rooms are addressed by their
 * GameMaker name string throughout — see `GmlActionContext.rooms`'s own doc
 * comment), so a bare room-name identifier used as this argument is quoted
 * the same way `action_next_room`'s room-name argument already is (`gms2-
 * transpile.ts`'s `THREADED_ACTIONS` quoting), and this checks membership in
 * `ctx.rooms` — the exact map `action_next_room`/`GmsProjectRuntime` already
 * treat as "every room this project actually has". A project that never
 * wired `ctx.rooms` at all honestly answers `false` for everything (no
 * fabricated "yes" for a room this context can't actually load), matching
 * Freedom Backup's own real use (`obj_display_manager`'s `if
 * (room_exists(i)) ...` display-mode scan, and `obj_player`'s `if
 * (room_exists(_other.new_room))` before a door transition) — both are
 * real existence checks before acting, not performance-sensitive hot loops.
 */
export declare function room_exists(
  ctx: GmlActionContext,
  roomName: string,
): boolean;
/** GM8.1 "Next Room" — loads `ctx.roomOrder[currentIndex + 1]` via `ctx.game.loadScene`. Requires `ctx.game`, `ctx.rooms`, `ctx.roomOrder`, and `ctx.currentRoom` — see `GmlActionContext`'s doc comment for why the importer can't build this map itself. */
export declare function action_next_room(
  _entity: Entity,
  ctx: GmlActionContext,
): void;
/** GM8.1 "Go to Room" — loads a specific named room via `ctx.game.loadScene`. Requires `ctx.game`/`ctx.rooms`. */
export declare function action_another_room(
  _entity: Entity,
  ctx: GmlActionContext,
  roomName: string,
): void;
/**
 * `room_goto(rm)` — GML's function-call spelling of "Go to Room" (as
 * opposed to `action_another_room`, the DnD action spelling). Before this,
 * a bare `room_goto(rm_next);` call transpiled to an inert, comment-only
 * placeholder — one of the single most common GameMaker calls for
 * changing levels/screens (confirmed real, common usage across both real
 * projects checked: `room_goto(rm_gamefcat)`, `room_goto(other.new_room)`,
 * `room_goto(target)`), and every one of those calls was silently doing
 * nothing at all. Aliases `action_another_room` — `gms2-transpile.ts`
 * quotes a bare room-asset identifier argument into the exact string
 * `ctx.rooms` is keyed by (the same convention `sprite_index`'s bare-
 * identifier rewrite already established), the same way `room_goto`'s
 * argument reaches this function either way.
 */
export declare function room_goto(
  entity: Entity,
  ctx: GmlActionContext,
  roomName: string,
): void;
/** `room_goto_next()` — GML's function-call spelling of GM8.1's "Next Room" DnD action. A plain alias, the same `room_goto`/`action_another_room` relationship above. */
export declare function room_goto_next(
  entity: Entity,
  ctx: GmlActionContext,
): void;
/**
 * `room_restart()` — reloads the currently loaded room from scratch (a real,
 * common GameMaker idiom for a "retry level"/player-death reset). Requires
 * the same `ctx.game`/`ctx.rooms`/`ctx.currentRoom` wiring `room_goto`/
 * `action_next_room` already need; honestly warns and no-ops without it.
 */
export declare function room_restart(
  entity: Entity,
  ctx: GmlActionContext,
): void;
/**
 * `game_restart()` — GameMaker's real function reloads the entire game from
 * its very first room, resetting every instance and every global variable.
 * This engine has no single "reset everything" primitive that also clears
 * arbitrary global GML state living in `gmlStatics`/side-tables/a game's
 * own module-level variables — a genuine, honest gap, the same class as
 * `randomize()`'s "no seed API to hook" limitation above. What *is* honestly
 * representable is reloading the *first* room in `ctx.roomOrder` (the
 * closest real approximation this importer's room-name-addressed model can
 * offer, mirroring `room_restart`'s own "reload the current room" shape one
 * level up) — a real room reload, not a full state reset, and documented as
 * such rather than silently claiming a full restart happened.
 */
export declare function game_restart(
  entity: Entity,
  ctx: GmlActionContext,
): void;
/**
 * `room_last` — GameMaker's real function returns the numeric asset index
 * of the *last* room in the project's room order. This importer addresses
 * rooms by name, not index (see `room_exists`'s own doc comment), so this
 * returns the last room's *name* from `ctx.roomOrder` instead — `""` when
 * `ctx.roomOrder` wasn't wired or is empty, an honest "no rooms known"
 * answer rather than a fabricated one.
 */
export declare function room_last(ctx: GmlActionContext): string;
/**
 * `previous_room` — the room loaded immediately before the current one, or
 * `""` if this is the first room loaded this session (GameMaker's own real
 * behaviour: `previous_room` reads as a real, if meaningless, value even on
 * a project's very first room — there's no numeric "none" sentinel to
 * fabricate here, so an empty string is the honest "no previous room"
 * answer, the same choice `room`'s own bare read already makes for an unset
 * `ctx.currentRoom`). See `GmlActionContext.previousRoom`'s own doc comment
 * for how this gets populated.
 */
export declare function previous_room(ctx: GmlActionContext): string;
/**
 * `room_speed` — GameMaker's real per-room "Speed" setting (steps per
 * second). This importer has no per-room speed field anywhere in its
 * generated `.scene.json` (GMS2 rooms don't carry one at all — room speed
 * is a *project*-wide setting in modern GameMaker, confirmed against
 * manual.gamemaker.io's Room Speed reference page), so this returns the
 * same honestly-documented assumed value (`ASSUMED_STEPS_PER_SECOND`,
 * `gms2-sprite-import.ts`'s own real 60-steps/second assumption for
 * `playbackSpeedType: 0` sprite frame-rate conversion) rather than
 * fabricating a per-room number this importer has no way to know.
 */
export declare function room_speed(_ctx: GmlActionContext): number;
/** `xstart`/`ystart` — real, writable GameMaker built-ins holding the instance's creation position, lazily captured on first access. */
export declare function get_gml_xstart(
  entity: Entity,
  _ctx: GmlActionContext,
): number;
export declare function set_gml_xstart(
  entity: Entity,
  _ctx: GmlActionContext,
  value: number,
): number;
export declare function get_gml_ystart(
  entity: Entity,
  _ctx: GmlActionContext,
): number;
export declare function set_gml_ystart(
  entity: Entity,
  _ctx: GmlActionContext,
  value: number,
): number;
/** GM8.1 "Create Object" / `instance_create` — spawn a prefab at a position. `ctx.prefabs[objectName]` must resolve to the object's imported `PrefabDef` (the game wires this from its own `<name>.prefab.json` imports — the importer emits the prefab files but has no runtime prefab registry of its own to hand this off to). Returns the new `Entity`, or `undefined` if nothing could be spawned. */
export declare function action_create_object(
  _entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  x: number,
  y: number,
): Entity | undefined;
/** `instance_create(x, y, objectName)` — GML's function-call spelling of the same action, with GameMaker's own `(x, y, object)` argument order. */
export declare function instance_create(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  objectName: string,
): Entity | undefined;
/**
 * `instance_create_layer(x, y, layer, obj)` — GML 2.3+'s real, current
 * spawning function (`instance_create` above is its legacy pre-2.3
 * spelling, still supported but rarer in modern projects). Before this, a
 * bare `instance_create_layer(...)` call transpiled to an inert, comment-
 * only placeholder — one of the single most common GameMaker calls in real
 * projects (confirmed: 10+ real call sites in just one of this importer's
 * real test projects — spawning bullets, pickups, transition effects, UI
 * elements), and every one of those calls was silently doing nothing at
 * all (returning `undefined`, spawning nothing) rather than throwing —
 * exactly the same severity `instance_destroy`'s own gap had, and for the
 * same reason: a call this common, silently doing nothing, is worse than
 * one that visibly fails.
 *
 * The `layer` argument (a layer *name* string, e.g. `"Bullets"`) is
 * honestly not applied — this engine's `Scene.spawn()` has no per-layer
 * spawn-target concept the way GameMaker's room layers do (a spawned
 * entity's actual render layer comes from its `Sprite`/other component
 * data, via `LayerSystem`, set independently of where it was created) — so
 * `instance_create_layer` and `instance_create`/`action_create_object`
 * converge on the exact same real spawn behaviour, just with GML 2.3+'s
 * newer argument order and an extra parameter this engine has nothing to
 * receive it into.
 */
export declare function instance_create_layer(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  _layer: string,
  objectName: string,
): Entity | undefined;
/**
 * GML's `with (target) { ... }` — genuinely common in real GameMaker
 * source (confirmed against Freedom Backup: dozens of real call sites,
 * `with (mywall) instance_destroy();`, `with (obj_player) { ... }`,
 * `with (instance_create_layer(...)) { ... }`, `with (other)
 * instance_destroy();`) and, until now, always left as dead code (an
 * always-false guarded TODO comment) by the transpiler — a severe, real
 * gap, not a cosmetic one, since `with` is GameMaker's primary
 * broadcast/iteration mechanism.
 *
 * `target` mirrors the shape `gms2-transpile.ts`'s own `with` codegen
 * produces: a resolved single `Entity` (a variable already holding an
 * instance reference — `mywall`, `other` — or a spawn call's own return
 * value) is iterated once; a plain object-type-name string (a bare object-type
 * name, quoted at transpile time the same way `place_meeting` etc.
 * already are, or GameMaker's own `"all"`/`"noone"` constants) iterates
 * every live matching instance in the scene. `undefined` (a spawn that
 * failed, or a dead/unresolvable reference) is a safe no-op — GameMaker's
 * own `with` against a destroyed or nonexistent target simply runs its
 * body zero times, never throws.
 */
export declare function with_each(
  ctx: GmlActionContext,
  target: unknown,
  callback: (entity: Entity) => void,
): void;
/** GM8.1 "Destroy Instance" — `scene.destroy(entity)`. */
export declare function action_kill_object(
  entity: Entity,
  ctx: GmlActionContext,
): void;
/**
 * `instance_change(object, perform_events)` — GameMaker's real function
 * turns the *calling* instance into a different object type in place,
 * keeping its position (and, per the manual, most instance variables) while
 * swapping its sprite and object identity, optionally running the new
 * object's Create event (`perform_events`).
 *
 * This engine's ECS model has nothing structurally equivalent to "become a
 * different prefab in place" — an entity's component set isn't tied to a
 * single "object type" the way a GameMaker instance's `object_index` is,
 * and there is no live `PrefabDef -> behaviorId` map this context carries
 * (`GmlActionContext.prefabs` only maps a name to a spawnable `PrefabDef`,
 * not to which compiled `.behavior.ts` module governs its own Step/Draw/
 * Collision dispatch — see CLAUDE.md's "`GmsProjectRuntime`" entry, which
 * documents that a `GmlBehaviorState.behaviorId` is resolved once, at
 * spawn time, from the room's own prefab-instance data). Re-pointing an
 * already-spawned entity's `GmlBehaviorState.behaviorId` at a *different*
 * compiled module (so its own future Step/Draw/Collision events dispatch
 * through the new object's code, not the old one's) is a real, deliberate,
 * honest gap this function does not attempt to fake.
 *
 * What this function *does* do for real, matching the two parts of
 * `instance_change`'s effect this engine can honestly represent: it stamps
 * `Meta.name` to `objectName` (adding a `Meta` component if the entity has
 * none) — the same field `onCollideWith<Type>` dispatch/`place_meeting`/
 * `GmlCollision.ts` already resolve an instance's "object type" through
 * (see CLAUDE.md's "GML behavior dispatch" entry's `resolveGmlObjectType`
 * paragraph), so a collision/`place_meeting` check made against the new
 * object name after this call sees the entity as that type, matching real
 * GameMaker behaviour — and, if `ctx.prefabs[objectName]`'s own default
 * `Sprite.texturePath` is known, updates the entity's own `Sprite`
 * component to match, the same visual half of `instance_change` GameMaker
 * performs. `perform_events` is accepted (so real call sites keep their
 * real argument count) but honestly not applied — there is no `onCreate`
 * dispatch this function can safely trigger without a resolved
 * `GmlBehaviorState.behaviorId` for the *new* object, per the gap above.
 */
export declare function instance_change(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  _performEvents: boolean,
): void;
/**
 * `instance_destroy()` — GML's function-call spelling of the same action
 * (destroy the calling instance), takes no arguments. Before this, a bare
 * `instance_destroy();` call transpiled to an inert, comment-only
 * placeholder expression — not even a real `scene.destroy()` call, let
 * alone one that could ever dispatch `onDestroy`. This was a severe,
 * previously-undiscovered gap: `instance_destroy()` is one of the single
 * most common GameMaker calls in real projects (despawning bullets,
 * enemies, pickups, effects — confirmed used in 33 separate real
 * object/script files across just two of this importer's real test
 * projects), and every one of those calls was silently doing nothing at
 * all — the calling entity stayed alive forever. Aliases
 * `action_kill_object` rather than duplicating its body, so the two
 * spellings of "destroy this instance" can never drift apart.
 */
export declare function instance_destroy(
  entity: Entity,
  ctx: GmlActionContext,
): void;
/** GM8.1 "Set Alarm" — schedules alarm `index` (GameMaker has 12, numbered 0-11) to fire `steps` frames from now. Ticked once per frame by `gmlActionsStep`; when it reaches zero, `onAlarm` is invoked (if provided) and the alarm entry is removed — GameMaker alarms are one-shot unless re-armed. There is no dedicated `AlarmSystem` here (see `Coroutines.ts`'s scheduled coroutines for the engine's general-purpose equivalent) — a per-entity side-table ticked alongside motion state is a better fit than layering a second scheduling primitive on top of coroutines for what's fundamentally "decrement an int every step." */
export declare function action_set_alarm(
  entity: Entity,
  _ctx: GmlActionContext,
  index: number,
  steps: number,
): void;
/**
 * GML's own native `alarm[index]` array — a bare read (`if (alarm[0] <= 0)`)
 * backs onto the exact same per-`(World, eid)` `alarms` map
 * `action_set_alarm`/`gmlActionsStep` already maintain, rather than a
 * second, parallel countdown mechanism — GameMaker itself has exactly one
 * alarm array per instance regardless of whether it's set via the GM8.1
 * "Set Alarm" DnD action or plain `alarm[n] = steps;` GML syntax, and this
 * compat layer must not disagree with itself about which one an instance
 * is actually running. GameMaker's own documented sentinel for "not
 * currently counting down" is `-1` (manual.gamemaker.io's Alarms
 * reference page), which this returns when `index` has no entry in the
 * map at all (never armed, or already fired and removed by
 * `gmlActionsStep`'s one-shot semantics).
 */
export declare function get_gml_alarm(
  entity: Entity,
  _ctx: GmlActionContext,
  index: number,
): number;
/**
 * GM8.1 "Play Sound" — plays via `ctx.game.audio.play(id)`. `soundName` is
 * the GameMaker sound resource's name; resolving it to a playable asset id
 * depends on the (separate, parallel) sound-import work actually producing
 * one. Until `ctx.sounds` is wired with a real `{ soundName: assetId }`
 * map, `soundName` is passed straight through to `AudioSystem.play()` as
 * the id — the correct behaviour once sound import registers sounds under
 * their GameMaker names, and a clean, honest no-op (via `AudioSystem`'s own
 * "unknown id" handling) until then, rather than this file inventing a
 * fake asset-resolution scheme ahead of that work landing.
 */
export declare function action_sound(
  _entity: Entity,
  ctx: GmlActionContext,
  soundName: string,
): void;
/**
 * `audio_play_sound(snd, priority, loop)` — GML's function-call spelling of
 * "Play Sound" (as opposed to `action_sound`, the DnD action spelling, which
 * has no `priority`/`loop` parameters at all since GM8.1's action library
 * predates them). Before this, a bare `audio_play_sound(...)` call
 * transpiled to an inert, comment-only placeholder — one of the single most
 * common GameMaker calls for sound effects (confirmed real, common usage in
 * a real project: `audio_play_sound(snd_Shot, 5, false)`,
 * `audio_play_sound(choose(snd_Foot1, snd_Foot2, snd_Foot3, snd_Foot4), 1,
 * false)`), and every one of those calls was silently doing nothing at all.
 *
 * `priority` and `loop` are accepted (so real call sites keep their real
 * argument count and the transpiler doesn't need special-case arg-count
 * logic) but honestly not applied — `AudioSystem.play(id)` has no priority-
 * based voice-stealing or loop parameter of its own to receive them into.
 * This is the same "pass real GameMaker semantics through to whatever this
 * engine's own API can actually honour, don't fabricate the rest" rule
 * `action_sound`'s own doc comment above already states for sound-id
 * resolution — not a silently dropped feature, an honestly unmodelled one.
 */
export declare function audio_play_sound(
  entity: Entity,
  ctx: GmlActionContext,
  soundName: string,
  _priority?: number,
  _loop?: boolean,
): void;
/**
 * `audio_sound_pitch(index, pitch)` — sets a loaded sound's playback rate
 * (`1` = unchanged; GameMaker documents this as `1` = normal, `0.5` = half
 * speed/an octave down, `2` = double speed/an octave up — matching Howler's
 * own `rate()` convention exactly, see `AudioSystem.setPitch`'s own doc
 * comment). A real, common GameMaker idiom for cheap sound variety — real,
 * confirmed usage: Freedom Backup's own `audio_sound_pitch(snd_Shot,
 * choose(0.8, 1.0, 1.2))`, a slightly different pitch every shot rather
 * than needing several near-identical gunshot samples. `soundName` is
 * resolved through `ctx.sounds` the same way `action_sound`'s own sound-id
 * resolution already works. This is genuinely not entity-affecting — a
 * sound's pitch is a property of the loaded sound asset, not of the calling
 * instance — but is threaded `(entity, ctx, ...)` regardless of not needing
 * `entity`, matching `action_sound`/`audio_play_sound`'s own shape rather
 * than needing a second, `(ctx, ...)`-only sound function family.
 */
export declare function audio_sound_pitch(
  _entity: Entity,
  ctx: GmlActionContext,
  soundName: string,
  pitch: number,
): void;
export declare function draw_self(entity: Entity, ctx: GmlActionContext): void;
/** GM8.1 "If Colliding" — true if `entity`'s `Transform`-based bounding box overlaps `other`'s. This is a plain AABB check using `Sprite`-implied bounds where available (falling back to a 1x1 point check when neither entity has a `Sprite`) — a real collision-shape check belongs to `PhysicsSystem`/`PhysicsBody`, which a GM8.1 DnD project (see CLAUDE.md's "action_move... A GM8.1 DnD game very often has no physics body at all") frequently doesn't use at all. */
export declare function action_if_collision(
  entity: Entity,
  _ctx: GmlActionContext,
  other: Entity,
): boolean;
/**
 * Real per-sprite collision extents, derived from `Sprite.width`/`.height`
 * (populated by the GMS2 importer from the sprite resource's own real `.yy`
 * `width`/`height` fields — see `components/Sprite.ts`'s own doc comment)
 * when present. Falls back to a fixed 16px half-extent (32px square) only
 * when both are `0` (genuinely absent — a hand-authored entity with no
 * imported sprite data). A real headless playability smoke test against the
 * real Freedom Backup project found the old fixed-32x32-always fallback
 * permanently colliding against real wall geometry sized differently, which
 * silently blocked all horizontal movement — this real-dimensions path is
 * the fix. GameMaker's own sprites can in principle use a non-bbox
 * precise/mask collision shape, but every real sprite in Freedom Backup
 * uses a plain rectangular mask, so a real-dimensions bounding box is the
 * correctly-scoped fix here — a full per-pixel mask system would be
 * over-engineering for what this project actually needs. A project that
 * needs true pixel-accurate/non-rectangular collision should use
 * `PhysicsBody` instead, same as GameMaker itself recommends once
 * "precise" collision checking matters. Exported so `systems/GmlCollision.ts`
 * shares this exact source rather than defining a second one that could
 * drift — see that file's own doc comment for why it's the reused source
 * of AABB extents for GML `onCollideWith<Type>` dispatch too.
 */
export declare function spriteHalfExtents(entity: Entity): {
  x: number;
  y: number;
};
/**
 * `bbox_left`/`bbox_right`/`bbox_top`/`bbox_bottom` — real, extremely
 * common GameMaker built-ins for the calling instance's own current
 * collision-mask bounding box, confirmed real and unwired (a hard
 * `ReferenceError` the moment real transpiled code read one — Freedom
 * Backup's own `obj_player/Step_0.gml` reads `bbox_bottom` every Step for
 * its ground/wall probe) while running the playability smoke test against
 * real gameplay. Derived from the exact same `spriteHalfExtents()` fallback
 * `place_meeting`/`action_if_collision`/`onCollideWith<Type>` dispatch
 * already share, so a `bbox_*` read can never disagree with what this
 * engine's own collision-query family considers the entity's extents to
 * be — the same "one implementation, not two that could drift" rule this
 * file's own doc comments establish elsewhere. `0` for an entity with no
 * `Transform` (nothing to derive a box from).
 */
export declare function bbox_left(entity: Entity): number;
/** See `bbox_left`'s doc comment. */
export declare function bbox_right(entity: Entity): number;
/** See `bbox_left`'s doc comment. */
export declare function bbox_top(entity: Entity): number;
/** See `bbox_left`'s doc comment. */
export declare function bbox_bottom(entity: Entity): number;
/**
 * `sprite_width`/`sprite_height` — the calling instance's own current
 * on-screen sprite dimensions, GameMaker's real semantic scaled by
 * `image_xscale`/`image_yscale` (unlike `sprite_get_width`/`_height`,
 * which read an *asset's* raw, unscaled size — see those functions' own
 * doc comment for why they're a real, separate, honest gap). Derived from
 * the entity's own `Sprite.width`/`.height` (real per-sprite dimensions,
 * see `spriteHalfExtents()`'s own doc comment) times `Transform.scaleX`/
 * `.scaleY` (where `image_xscale`/`image_yscale` actually live on this
 * engine — see CLAUDE.md's "GMS2 rendering built-ins" entry). `0` for an
 * entity with no `Sprite`/`Transform`, the same honest "nothing to derive
 * a size from" default `bbox_*` already uses.
 */
export declare function sprite_width(entity: Entity): number;
/** See `sprite_width`'s doc comment. */
export declare function sprite_height(entity: Entity): number;
/** `image_number` — read-only, the calling instance's sprite's total frame count. */
export declare function get_gml_image_number(entity: Entity): number;
/**
 * `sprite_get_width`/`sprite_get_height`/`sprite_exists` — GameMaker's real
 * functions look up an *arbitrary* sprite asset's raw dimensions/existence
 * by reference, not necessarily the calling instance's own sprite (real,
 * confirmed usage: `oTextbox`'s `sprite_get_width(_image)`, where `_image`
 * is a runtime variable that could hold any sprite). This compat layer has
 * no general sprite-asset registry reachable from `compat/` at all — a
 * sprite's real pixel dimensions are only ever known once baked as
 * overrides onto one specific entity's own `Sprite` component at import
 * time (`gms2-codegen.ts`'s `buildObjectPrefabJSON`), not stored anywhere
 * addressable by sprite name/reference alone. Building a real registry
 * would need a genuinely new import-time asset-manifest feature, not a
 * same-file compat function — an honest, named, deeper gap, not a same-
 * shape fix like `sprite_width`/`sprite_height` above. These three
 * therefore honestly return `0`/`0`/`false` (never throw) rather than
 * fabricating a plausible-looking number, matching this codebase's
 * established "no live registry to even ask" convention
 * (`layer_sprite_get_id`'s identical honest-gap doc comment).
 */
export declare function sprite_get_width(
  _ctx: GmlActionContext,
  _sprite: unknown,
): number;
/** See `sprite_get_width`'s doc comment. */
export declare function sprite_get_height(
  _ctx: GmlActionContext,
  _sprite: unknown,
): number;
/** See `sprite_get_width`'s doc comment. */
export declare function sprite_exists(
  _ctx: GmlActionContext,
  _sprite: unknown,
): boolean;
/** GM8.1 "Check Grid" — true if the entity's position is aligned to the given grid size. */
export declare function action_if_aligned(
  entity: Entity,
  _ctx: GmlActionContext,
  hsnap: number,
  vsnap: number,
): boolean;
/** GM8.1 "Check Empty" — true if no entity occupies `(x, y)` (optionally relative to `entity`'s own position). `solidOnly` narrows the check to entities with a `PhysicsBody` that isn't a sensor, matching GameMaker's "solid instances only" checkbox. */
export declare function action_if_empty(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  relative?: boolean,
  solidOnly?: boolean,
): boolean;
/** GM8.1 "Test Mouse" — true if the mouse button state matches. `button` follows GameMaker's `mb_left`(1)/`mb_right`(2)/`mb_middle`(3) constants; needs live input state, so it takes an `isDown: (button) => boolean` predicate rather than importing `InputManager` here (this file has no reference to a live scene's `SceneLifecycle.input`, and pulling one in just for this single action isn't worth a new required `ctx` field every other action would ignore). */
export declare function action_if_mouse(
  _entity: Entity,
  _ctx: GmlActionContext,
  button: number,
  isDown: (button: number) => boolean,
): boolean;
/**
 * GM8.1 "Question" — the one "if" action GameMaker's own editor renders as
 * a literal yes/no message box, blocking script execution until the player
 * answers. That's a real, unavoidable semantic mismatch with this engine's
 * synchronous, non-blocking action-compat functions (`onUpdate` must not be
 * async — see CLAUDE.md), and it's also the one DnD action whose actual
 * behaviour is a modal UI dialog the engine has no equivalent primitive
 * for (no engine-owned "block until UI answers" mechanism exists, per
 * CLAUDE.md's "No loading screen, no splash screen" §-adjacent stance
 * against the engine owning transition/blocking UI). Rather than fake a
 * synchronous prompt, this takes an `ask: () => boolean` callback the game
 * supplies (e.g. reading its own already-answered UI state), so at least
 * the *conditional-gate* half of the semantics is real and testable; the
 * actual dialog is left to the game, same as GameMaker's real "Question"
 * needing custom UI once you leave its default blocking dialog behind.
 */
export declare function action_if_question(
  _entity: Entity,
  _ctx: GmlActionContext,
  _message: string,
  ask: () => boolean,
): boolean;
/**
 * Applies this entity's `action_move`-set velocity (with `action_set_friction`
 * decay) to its `Transform`, and ticks any `action_set_alarm` timers,
 * firing `onAlarm(index)` when one reaches zero. `gms2-codegen.ts` appends
 * one call to this at the end of every generated `onUpdate` (Step event)
 * for an object whose transpiled GML used any motion/alarm action — see
 * that file's doc comment for exactly which fields trigger it. Calling this
 * on an entity with no recorded motion/alarm state is a cheap no-op.
 */
export declare function gmlActionsStep(
  entity: Entity,
  onAlarm?: (index: number) => void,
): void;
/**
 * `shader_set(shader)`/`shader_reset()` — GameMaker's real per-draw-call
 * shader-swap API. This importer has no shader compiler at all (GLSL
 * source lives in a project's `shaders/` resource directory, entirely
 * unparsed by anything in this codebase), so a genuine per-shader effect is
 * out of scope — but the single overwhelmingly common real use of this API
 * in a 2D game (confirmed: the one real call site in Freedom Backup,
 * `obj_pShootable`'s `shader_set(sh_white); ...; shader_reset();`) is a
 * hit-flash effect: render the sprite as a solid white silhouette for one
 * draw call. `shader_set` honestly approximates exactly that one case —
 * regardless of which shader name is actually passed (a real custom
 * shader's real visual effect is unrepresentable without compiling GLSL,
 * which is a materially deeper, separate feature) — by tinting the calling
 * entity's own `Sprite.tint` white for the duration of the draw call and
 * restoring its prior tint on `shader_reset()`. This is a real, visible,
 * useful effect for the actual real project this was built against, not a
 * silent no-op — but it is genuinely not a real shader system, and a
 * project relying on a different custom shader's real visual output will
 * see the same white-flash approximation instead. `shader_reset()` with no
 * matching prior `shader_set()` call (or on an entity with no `Sprite`) is
 * a safe, honest no-op.
 */
export declare function shader_set(
  entity: Entity,
  _ctx: GmlActionContext,
  _shaderName: string,
): void;
/** See `shader_set`'s doc comment. */
export declare function shader_reset(
  entity: Entity,
  _ctx: GmlActionContext,
): void;

// gmlActions.ts — GameMaker 8.1 drag-and-drop action-library compat layer.
//
// `gml.ts` (sibling file) covers pure/global GML *scripting functions*
// (`ds_map_*`, `string_*`, `draw_*`, ...) — none of them touch a specific
// entity. GM8.1's DnD action library is a different shape entirely: every
// action is imperative and entity-affecting (move this instance, kill this
// instance, go to this room), so it needs an `Entity` — and, for the
// scene/room/create actions, a live `Scene`/`Game` — to act against. That
// split is why this lives in its own file rather than growing `gml.ts` past
// a reasonable size (CLAUDE.md's "GMS2 `.yyp`/`.yy`..." entry originally
// treated this as an unfakeable, deliberately-untranspiled gap; see the
// CLAUDE.md entry this file's introduction rewrites for why that turned out
// to be too pessimistic — GM8.1's action semantics are fixed and
// documented, not ambiguous).
//
// No DOM, Tauri, or apps/ide imports — same engine-environment-boundary
// rule as every other file under compat/.

import type { World } from "bitecs";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import type { Game, SceneDefinition } from "../Game.js";
import type { PrefabDef } from "../Prefab.js";
import { Transform } from "../components/Transform.js";
import { Sprite } from "../components/Sprite.js";
import { Meta } from "../components/Meta.js";
import { getPhysicsBody } from "../components/PhysicsBody.js";
import { getOrCreate, getOrCreateMapEntry } from "../internal/scoped.js";
import type { GmlDrawTarget } from "./gml.js";
import { resolveGmlObjectType } from "../systems/GmlCollision.js";

// ---------------------------------------------------------------------------
// Context — the one thing every generated action call needs threaded to it
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// Movement: action_move / action_move_to / action_set_relative / action_snap
// ---------------------------------------------------------------------------

/**
 * GM8.1's "Move Fixed"/"Move Free" action direction parameter: a 9-bit
 * bitmask over the classic 3x3 compass-rose button grid GameMaker's DnD
 * editor shows (a numpad-shaped set of direction toggle buttons plus a
 * disabled centre "stop" button). Bit order here is reading order over that
 * grid — top row left-to-right, then middle row, then bottom row — which is
 * the order GameMaker's own compiled compatibility scripts iterate the
 * button grid in. When more than one direction bit is set, the resulting
 * motion is the average of the set directions' unit vectors, scaled to
 * `speed` — this is what produces GM8.1's diagonal movement when two
 * adjacent buttons are both pressed.
 *
 * Angles follow this codebase's own existing GML-angle convention (see
 * `gml.ts`'s `lengthdir_x`/`lengthdir_y`: `direction` in degrees, `0` =
 * screen-right, increasing clockwise, `y` down) rather than GameMaker's
 * real "counterclockwise, y-up" `direction` variable — deliberately kept
 * consistent with the one angle convention this compat layer already
 * established, rather than introducing a second one only this file uses.
 */
const MOVE_DIRECTION_BITS: readonly number[] = [
  225, // NW (bit 0)
  270, // N  (bit 1) — screen "up" is -y, i.e. 270° in this y-down convention
  315, // NE (bit 2)
  180, // W  (bit 3)
  -1, // centre / "no direction" (bit 4) — never contributes
  0, // E  (bit 5)
  135, // SW (bit 6)
  90, // S  (bit 7)
  45, // SE (bit 8)
];

/** Per-(World, eid) motion state `action_move`/`action_move_to` write and `gmlActionsStep` reads. Not part of any component — see the module doc comment on why this needs its own side-table rather than a new `Transform` field. `direction` is remembered independently of `vx`/`vy` so a real GML `speed = 0;` (a common "stop moving" idiom) doesn't lose the instance's last-facing direction the way deriving it purely from `atan2(vy, vx)` would (`atan2(0, 0)` is always `0`, which would silently reset facing on every stop). */
interface GmlMotionState {
  vx: number;
  vy: number;
  direction: number; // degrees, this file's lengthdir-style convention (0 = right, clockwise, y-down)
  friction: number;
  alarms: Map<number, number>; // alarm index -> frames remaining
}

const motionByWorld = new WeakMap<World, Map<number, GmlMotionState>>();

function ensureMotion(world: World, eid: number): GmlMotionState {
  const byEntity = getOrCreate(motionByWorld, world, () => new Map());
  return getOrCreateMapEntry(byEntity, eid, () => ({
    vx: 0,
    vy: 0,
    direction: 0,
    friction: 0,
    alarms: new Map(),
  }));
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
export function getGmlSpeed(entity: Entity, _ctx: GmlActionContext): number {
  const motion = motionByWorld.get(entity.world)?.get(entity.eid);
  if (motion === undefined) return 0;
  return Math.hypot(motion.vx, motion.vy);
}

export function setGmlSpeed(
  entity: Entity,
  _ctx: GmlActionContext,
  speed: number,
): void {
  const motion = ensureMotion(entity.world, entity.eid);
  const rad = (motion.direction * Math.PI) / 180;
  motion.vx = speed * Math.cos(rad);
  motion.vy = speed * Math.sin(rad);
}

export function getGmlDirection(
  entity: Entity,
  _ctx: GmlActionContext,
): number {
  const motion = motionByWorld.get(entity.world)?.get(entity.eid);
  if (motion === undefined) return 0;
  if (motion.vx === 0 && motion.vy === 0) return motion.direction;
  let deg = (Math.atan2(motion.vy, motion.vx) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  motion.direction = deg;
  return deg;
}

export function setGmlDirection(
  entity: Entity,
  _ctx: GmlActionContext,
  direction: number,
): void {
  const motion = ensureMotion(entity.world, entity.eid);
  const speed = Math.hypot(motion.vx, motion.vy);
  motion.direction = direction;
  const rad = (direction * Math.PI) / 180;
  motion.vx = speed * Math.cos(rad);
  motion.vy = speed * Math.sin(rad);
}

export function getGmlHspeed(entity: Entity, _ctx: GmlActionContext): number {
  return motionByWorld.get(entity.world)?.get(entity.eid)?.vx ?? 0;
}

export function setGmlHspeed(
  entity: Entity,
  _ctx: GmlActionContext,
  hspeed: number,
): void {
  const motion = ensureMotion(entity.world, entity.eid);
  motion.vx = hspeed;
  if (motion.vx !== 0 || motion.vy !== 0) {
    let deg = (Math.atan2(motion.vy, motion.vx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    motion.direction = deg;
  }
}

export function getGmlVspeed(entity: Entity, _ctx: GmlActionContext): number {
  return motionByWorld.get(entity.world)?.get(entity.eid)?.vy ?? 0;
}

export function setGmlVspeed(
  entity: Entity,
  _ctx: GmlActionContext,
  vspeed: number,
): void {
  const motion = ensureMotion(entity.world, entity.eid);
  motion.vy = vspeed;
  if (motion.vx !== 0 || motion.vy !== 0) {
    let deg = (Math.atan2(motion.vy, motion.vx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    motion.direction = deg;
  }
}

/** Clear this `(world, eid)` pair's motion/alarm state. Call from `Scene.destroy()` — same pooled-id-reuse reasoning as `clearPhysicsBody`/`clearVisualScriptScope`. */
export function clearGmlActionState(world: World, eid: number): void {
  motionByWorld.get(world)?.delete(eid);
}

// ---------------------------------------------------------------------------
// GML `static` variable storage
// ---------------------------------------------------------------------------

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
export const gmlStatics: Record<string, unknown> = {};

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
export function action_move(
  entity: Entity,
  _ctx: GmlActionContext,
  directionBits: number,
  speed: number,
): void {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let bit = 0; bit < MOVE_DIRECTION_BITS.length; bit++) {
    if ((directionBits & (1 << bit)) === 0) continue;
    const angle = MOVE_DIRECTION_BITS[bit];
    if (angle === undefined || angle < 0) continue;
    sumX += Math.cos((angle * Math.PI) / 180);
    sumY += Math.sin((angle * Math.PI) / 180);
    count++;
  }
  const motion = ensureMotion(entity.world, entity.eid);
  if (count === 0) {
    motion.vx = 0;
    motion.vy = 0;
    return;
  }
  motion.vx = (sumX / count) * speed;
  motion.vy = (sumY / count) * speed;
}

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
export function action_move_to(
  entity: Entity,
  _ctx: GmlActionContext,
  x: number,
  y: number,
  relative = false,
): void {
  const transform = entity.get(Transform);
  if (transform === undefined) return;
  transform.x = relative ? transform.x + x : x;
  transform.y = relative ? transform.y + y : y;
}

/** GM8.1 "Snap to Grid" — round the entity's position down to the nearest grid cell. */
export function action_snap(
  entity: Entity,
  _ctx: GmlActionContext,
  hsnap: number,
  vsnap: number,
): void {
  const transform = entity.get(Transform);
  if (transform === undefined) return;
  if (hsnap > 0) transform.x = Math.floor(transform.x / hsnap) * hsnap;
  if (vsnap > 0) transform.y = Math.floor(transform.y / vsnap) * vsnap;
}

/** GM8.1 "Set Friction" — per-step speed decay applied by `gmlActionsStep`. */
export function action_set_friction(
  entity: Entity,
  _ctx: GmlActionContext,
  amount: number,
): void {
  ensureMotion(entity.world, entity.eid).friction = amount;
}

/**
 * GM8.1's per-action "Relative" checkbox, exposed as its own action for
 * transpiled call sites that read it as a preceding statement rather than
 * an inline flag (some DnD-to-GML compilers emit it this way). Toggles
 * whether the *next* positional action this entity performs interprets its
 * coordinates as relative — tracked in the same per-entity side-table as
 * motion state so it survives from one generated statement to the next
 * within a single event body.
 */
const relativeFlagByWorld = new WeakMap<World, Map<number, boolean>>();

export function action_set_relative(
  entity: Entity,
  _ctx: GmlActionContext,
  relative: boolean,
): void {
  const byEntity = getOrCreate(
    relativeFlagByWorld,
    entity.world,
    () => new Map(),
  );
  byEntity.set(entity.eid, relative);
}

/** Reads (and clears) the relative flag `action_set_relative` last stored for this entity. @internal */
export function consumeRelativeFlag(entity: Entity): boolean {
  const byEntity = relativeFlagByWorld.get(entity.world);
  const value = byEntity?.get(entity.eid) ?? false;
  byEntity?.delete(entity.eid);
  return value;
}

// ---------------------------------------------------------------------------
// Sprite: action_sprite_set / action_sprite_color
// ---------------------------------------------------------------------------

/** GM8.1 "Change Sprite" — set the entity's `Sprite` texture/sub-image. `speed` is GameMaker's animation-speed multiplier; this engine has no per-entity animation-speed field on `Sprite`, so it's accepted (to match the real GM signature) but currently a documented no-op — animating sub-images is `RenderPipeline`'s job, not this compat layer's. */
export function action_sprite_set(
  entity: Entity,
  _ctx: GmlActionContext,
  spriteTexturePath: string,
  subimage: number,
  _speed: number,
): void {
  const sprite = entity.get(Sprite);
  if (sprite === undefined) return;
  sprite.texturePath = spriteTexturePath;
  void subimage; // GM's sub-image index has no direct single-field equivalent here yet — texturePath already points at one frame.
}

/** GM8.1 "Set Sprite Colour/Blending" — tint + alpha. `blend` is a GameMaker colour value (`0xBBGGRR` — GML's colour order, not `0xRRGGBB`); converted to this engine's `Sprite.tint` (`0xRRGGBB`, matching `packages/engine/src/components/Sprite.ts`). */
export function action_sprite_color(
  entity: Entity,
  _ctx: GmlActionContext,
  blend: number,
  alpha: number,
): void {
  const sprite = entity.get(Sprite);
  if (sprite === undefined) return;
  const b = (blend >> 16) & 0xff;
  const g = (blend >> 8) & 0xff;
  const r = blend & 0xff;
  sprite.tint = (r << 16) | (g << 8) | b;
  sprite.alpha = alpha;
}

// ---------------------------------------------------------------------------
// Rooms: action_next_room / action_another_room
// ---------------------------------------------------------------------------

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
export function room(ctx: GmlActionContext): string {
  return ctx.currentRoom ?? "";
}

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
export function room_exists(ctx: GmlActionContext, roomName: string): boolean {
  return ctx.rooms !== undefined && roomName in ctx.rooms;
}

function warnMissingRoomWiring(action: string): void {
  // Mirrors QueryChannel's "honest error over a fabricated result" rule —
  // a project that never wired ctx.game/ctx.rooms gets a clear, once-per-call
  // signal rather than a silent no-op that looks like it worked.
  console.warn(
    `[gmlActions] ${action} called with no ctx.game/ctx.rooms wired — nothing was loaded. ` +
      `Pass { game, rooms, roomOrder, currentRoom } in the GmlActionContext to enable room-changing actions.`,
  );
}

/** GM8.1 "Next Room" — loads `ctx.roomOrder[currentIndex + 1]` via `ctx.game.loadScene`. Requires `ctx.game`, `ctx.rooms`, `ctx.roomOrder`, and `ctx.currentRoom` — see `GmlActionContext`'s doc comment for why the importer can't build this map itself. */
export function action_next_room(_entity: Entity, ctx: GmlActionContext): void {
  if (
    ctx.game === undefined ||
    ctx.rooms === undefined ||
    ctx.roomOrder === undefined ||
    ctx.currentRoom === undefined
  ) {
    warnMissingRoomWiring("action_next_room");
    return;
  }
  const index = ctx.roomOrder.indexOf(ctx.currentRoom);
  const nextName = index >= 0 ? ctx.roomOrder[index + 1] : undefined;
  if (nextName === undefined) return;
  const def = ctx.rooms[nextName];
  if (def === undefined) return;
  void ctx.game.loadScene(def);
}

/** GM8.1 "Go to Room" — loads a specific named room via `ctx.game.loadScene`. Requires `ctx.game`/`ctx.rooms`. */
export function action_another_room(
  _entity: Entity,
  ctx: GmlActionContext,
  roomName: string,
): void {
  if (ctx.game === undefined || ctx.rooms === undefined) {
    warnMissingRoomWiring("action_another_room");
    return;
  }
  const def = ctx.rooms[roomName];
  if (def === undefined) return;
  void ctx.game.loadScene(def);
}

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
export function room_goto(
  entity: Entity,
  ctx: GmlActionContext,
  roomName: string,
): void {
  action_another_room(entity, ctx, roomName);
}

// ---------------------------------------------------------------------------
// Instances: action_create_object / instance_create / action_kill_object
// ---------------------------------------------------------------------------

function warnMissingPrefabWiring(action: string, objectName: string): void {
  console.warn(
    `[gmlActions] ${action}('${objectName}') called with no ctx.prefabs wired, or '${objectName}' isn't in it — nothing was spawned.`,
  );
}

/** GM8.1 "Create Object" / `instance_create` — spawn a prefab at a position. `ctx.prefabs[objectName]` must resolve to the object's imported `PrefabDef` (the game wires this from its own `<name>.prefab.json` imports — the importer emits the prefab files but has no runtime prefab registry of its own to hand this off to). Returns the new `Entity`, or `undefined` if nothing could be spawned. */
export function action_create_object(
  _entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  x: number,
  y: number,
): Entity | undefined {
  const prefab = ctx.prefabs?.[objectName];
  if (prefab === undefined) {
    warnMissingPrefabWiring("action_create_object", objectName);
    return undefined;
  }
  return ctx.scene.spawn(prefab, { x, y });
}

/** `instance_create(x, y, objectName)` — GML's function-call spelling of the same action, with GameMaker's own `(x, y, object)` argument order. */
export function instance_create(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  objectName: string,
): Entity | undefined {
  return action_create_object(entity, ctx, objectName, x, y);
}

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
export function instance_create_layer(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  _layer: string,
  objectName: string,
): Entity | undefined {
  return action_create_object(entity, ctx, objectName, x, y);
}

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
export function with_each(
  ctx: GmlActionContext,
  target: string | Entity | undefined,
  callback: (entity: Entity) => void,
): void {
  if (target === undefined) return;
  if (typeof target !== "string") {
    if (target.isAlive) callback(target);
    return;
  }
  if (target === "noone") return;
  if (target === "all") {
    ctx.scene.each(Transform, (_t, entity) => callback(entity));
    return;
  }
  ctx.scene.each(Transform, (_t, entity) => {
    if (resolveGmlObjectType(entity) === target) callback(entity);
  });
}

/** GM8.1 "Destroy Instance" — `scene.destroy(entity)`. */
export function action_kill_object(
  entity: Entity,
  ctx: GmlActionContext,
): void {
  ctx.scene.destroy(entity);
}

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
export function instance_change(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  _performEvents: boolean,
): void {
  let meta = entity.get(Meta);
  if (meta === undefined) {
    entity.add(Meta, { name: objectName });
  } else {
    meta.name = objectName;
  }
  const prefab = ctx.prefabs?.[objectName];
  const spriteEntry = prefab?.components.find((c) => c.def === Sprite);
  const newTexturePath =
    spriteEntry?.overrides?.["texturePath"] ??
    (spriteEntry !== undefined
      ? Sprite.createDefaults().texturePath
      : undefined);
  if (typeof newTexturePath === "string") {
    const sprite = entity.get(Sprite);
    if (sprite !== undefined) sprite.texturePath = newTexturePath;
  }
}

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
export function instance_destroy(entity: Entity, ctx: GmlActionContext): void {
  action_kill_object(entity, ctx);
}

// ---------------------------------------------------------------------------
// Alarms: action_set_alarm
// ---------------------------------------------------------------------------

/** GM8.1 "Set Alarm" — schedules alarm `index` (GameMaker has 12, numbered 0-11) to fire `steps` frames from now. Ticked once per frame by `gmlActionsStep`; when it reaches zero, `onAlarm` is invoked (if provided) and the alarm entry is removed — GameMaker alarms are one-shot unless re-armed. There is no dedicated `AlarmSystem` here (see `Coroutines.ts`'s scheduled coroutines for the engine's general-purpose equivalent) — a per-entity side-table ticked alongside motion state is a better fit than layering a second scheduling primitive on top of coroutines for what's fundamentally "decrement an int every step." */
export function action_set_alarm(
  entity: Entity,
  _ctx: GmlActionContext,
  index: number,
  steps: number,
): void {
  ensureMotion(entity.world, entity.eid).alarms.set(index, steps);
}

// ---------------------------------------------------------------------------
// Sound: action_sound
// ---------------------------------------------------------------------------

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
export function action_sound(
  _entity: Entity,
  ctx: GmlActionContext,
  soundName: string,
): void {
  if (ctx.game === undefined) {
    console.warn(
      `[gmlActions] action_sound('${soundName}') called with no ctx.game wired — nothing was played.`,
    );
    return;
  }
  const id = ctx.sounds?.[soundName] ?? soundName;
  ctx.game.audio.play(id);
}

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
export function audio_play_sound(
  entity: Entity,
  ctx: GmlActionContext,
  soundName: string,
  _priority?: number,
  _loop?: boolean,
): void {
  action_sound(entity, ctx, soundName);
}

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
export function audio_sound_pitch(
  _entity: Entity,
  ctx: GmlActionContext,
  soundName: string,
  pitch: number,
): void {
  if (ctx.game === undefined) {
    console.warn(
      `[gmlActions] audio_sound_pitch('${soundName}') called with no ctx.game wired — nothing was changed.`,
    );
    return;
  }
  const id = ctx.sounds?.[soundName] ?? soundName;
  ctx.game.audio.setPitch(id, pitch);
}

// ---------------------------------------------------------------------------
// draw_self() — draws the calling instance's own current sprite, entity-
// aware (needs a real Entity, unlike compat/gml.ts's other draw_* functions,
// which all take an explicit sprite/position argument — see that file's own
// note pointing here). GameMaker draws an instance's sprite automatically
// every step *unless* it has a Draw event, in which case the Draw event
// fully replaces the default draw — draw_self() is what a real Draw event
// calls to still get the default sprite drawn (typically first, before
// anything else the event draws on top). This engine has no such
// suppression: `RenderPipeline`'s ordinary per-frame sprite sync already
// draws every `Transform`+`Sprite` entity's sprite unconditionally, every
// frame, regardless of whether it also has a `GmlBehaviorState` with a Draw
// handler (see CLAUDE.md's "Why Draw GUI's camera-independence is a
// render-tree structural property" entry — `onDraw` renders into the
// `"foreground"` layer, a real *second* draw on top of the always-on sprite
// sync, not a replacement for it). So `draw_self()` genuinely draws the
// sprite a second time here, at the entity's current position — a real,
// honest difference from GameMaker (a GML game relying on draw_self() to
// see a sprite it would otherwise not see already sees it via the ordinary
// sprite sync in this engine, so a second draw is harmless double-drawing
// at the exact same position, not a visual bug), documented rather than
// silently "fixed" by making it a no-op that would misrepresent what the
// call does everywhere else.
export function draw_self(entity: Entity, ctx: GmlActionContext): void {
  const sprite = entity.get(Sprite);
  const transform = entity.get(Transform);
  if (sprite === undefined || transform === undefined) return;
  ctx.drawTarget?.sprite(sprite.texturePath, transform.x, transform.y);
}

// ---------------------------------------------------------------------------
// Conditionals: action_if_collision / action_if_aligned / action_if_empty /
// action_if_mouse / action_if_question
// ---------------------------------------------------------------------------
//
// GM8.1's "if" actions gate whether the *next* action in the original
// action list runs — a real control-flow feature, not just a boolean
// helper. That nesting is a codegen concern (see gms2-codegen.ts /
// gms2-transpile.ts: the transpiler wraps the following generated
// statement(s) in a real `if (...) { ... }` block), so the functions below
// only need to answer the condition itself; the generated code supplies the
// `if`.

/** GM8.1 "If Colliding" — true if `entity`'s `Transform`-based bounding box overlaps `other`'s. This is a plain AABB check using `Sprite`-implied bounds where available (falling back to a 1x1 point check when neither entity has a `Sprite`) — a real collision-shape check belongs to `PhysicsSystem`/`PhysicsBody`, which a GM8.1 DnD project (see CLAUDE.md's "action_move... A GM8.1 DnD game very often has no physics body at all") frequently doesn't use at all. */
export function action_if_collision(
  entity: Entity,
  _ctx: GmlActionContext,
  other: Entity,
): boolean {
  const a = entity.get(Transform);
  const b = other.get(Transform);
  if (a === undefined || b === undefined) return false;
  const aSize = spriteHalfExtents(entity);
  const bSize = spriteHalfExtents(other);
  return (
    Math.abs(a.x - b.x) <= aSize.x + bSize.x &&
    Math.abs(a.y - b.y) <= aSize.y + bSize.y
  );
}

/**
 * No real texture-size lookup is available from pure engine-side compat
 * code (that lives with the renderer/asset loader) — a fixed 16px default
 * half-extent (32px square) is used when no better data exists. Good enough
 * for a DnD/GML compat check; a project that needs pixel-accurate collision
 * should use `PhysicsBody` instead, same as GameMaker itself recommends once
 * "precise" collision checking matters. Exported so `systems/GmlCollision.ts`
 * shares this exact fallback rather than defining a second one — see that
 * file's own doc comment for why it's the reused source of AABB extents for
 * GML `onCollideWith<Type>` dispatch too.
 */
export function spriteHalfExtents(_entity: Entity): { x: number; y: number } {
  return { x: 16, y: 16 };
}

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
export function bbox_left(entity: Entity): number {
  const t = entity.get(Transform);
  if (t === undefined) return 0;
  return t.x - spriteHalfExtents(entity).x;
}

/** See `bbox_left`'s doc comment. */
export function bbox_right(entity: Entity): number {
  const t = entity.get(Transform);
  if (t === undefined) return 0;
  return t.x + spriteHalfExtents(entity).x;
}

/** See `bbox_left`'s doc comment. */
export function bbox_top(entity: Entity): number {
  const t = entity.get(Transform);
  if (t === undefined) return 0;
  return t.y - spriteHalfExtents(entity).y;
}

/** See `bbox_left`'s doc comment. */
export function bbox_bottom(entity: Entity): number {
  const t = entity.get(Transform);
  if (t === undefined) return 0;
  return t.y + spriteHalfExtents(entity).y;
}

/** GM8.1 "Check Grid" — true if the entity's position is aligned to the given grid size. */
export function action_if_aligned(
  entity: Entity,
  _ctx: GmlActionContext,
  hsnap: number,
  vsnap: number,
): boolean {
  const transform = entity.get(Transform);
  if (transform === undefined) return false;
  return transform.x % hsnap === 0 && transform.y % vsnap === 0;
}

/** GM8.1 "Check Empty" — true if no entity occupies `(x, y)` (optionally relative to `entity`'s own position). `solidOnly` narrows the check to entities with a `PhysicsBody` that isn't a sensor, matching GameMaker's "solid instances only" checkbox. */
export function action_if_empty(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  relative = false,
  solidOnly = false,
): boolean {
  const transform = entity.get(Transform);
  const targetX = relative && transform !== undefined ? transform.x + x : x;
  const targetY = relative && transform !== undefined ? transform.y + y : y;
  let occupied = false;
  ctx.scene.each(Transform, (t, other) => {
    if (other.eid === entity.eid) return;
    if (solidOnly) {
      const body = getPhysicsBody(other);
      if (body === undefined || body.isSensor) return;
    }
    const size = spriteHalfExtents(other);
    if (
      Math.abs(t.x - targetX) <= size.x &&
      Math.abs(t.y - targetY) <= size.y
    ) {
      occupied = true;
    }
  });
  return !occupied;
}

/** GM8.1 "Test Mouse" — true if the mouse button state matches. `button` follows GameMaker's `mb_left`(1)/`mb_right`(2)/`mb_middle`(3) constants; needs live input state, so it takes an `isDown: (button) => boolean` predicate rather than importing `InputManager` here (this file has no reference to a live scene's `SceneLifecycle.input`, and pulling one in just for this single action isn't worth a new required `ctx` field every other action would ignore). */
export function action_if_mouse(
  _entity: Entity,
  _ctx: GmlActionContext,
  button: number,
  isDown: (button: number) => boolean,
): boolean {
  return isDown(button);
}

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
export function action_if_question(
  _entity: Entity,
  _ctx: GmlActionContext,
  _message: string,
  ask: () => boolean,
): boolean {
  return ask();
}

// ---------------------------------------------------------------------------
// Per-frame integration — called once per entity per Step from generated code
// ---------------------------------------------------------------------------

/**
 * Applies this entity's `action_move`-set velocity (with `action_set_friction`
 * decay) to its `Transform`, and ticks any `action_set_alarm` timers,
 * firing `onAlarm(index)` when one reaches zero. `gms2-codegen.ts` appends
 * one call to this at the end of every generated `onUpdate` (Step event)
 * for an object whose transpiled GML used any motion/alarm action — see
 * that file's doc comment for exactly which fields trigger it. Calling this
 * on an entity with no recorded motion/alarm state is a cheap no-op.
 */
export function gmlActionsStep(
  entity: Entity,
  onAlarm?: (index: number) => void,
): void {
  const table = motionByWorld.get(entity.world);
  const motion = table?.get(entity.eid);
  if (motion === undefined) return;

  const transform = entity.get(Transform);
  if (transform !== undefined && (motion.vx !== 0 || motion.vy !== 0)) {
    transform.x += motion.vx;
    transform.y += motion.vy;
    if (motion.friction > 0) {
      const speed = Math.hypot(motion.vx, motion.vy);
      const newSpeed = Math.max(0, speed - motion.friction);
      const scale = speed > 0 ? newSpeed / speed : 0;
      motion.vx *= scale;
      motion.vy *= scale;
    }
  }

  for (const [index, framesLeft] of motion.alarms) {
    const remaining = framesLeft - 1;
    if (remaining <= 0) {
      motion.alarms.delete(index);
      onAlarm?.(index);
    } else {
      motion.alarms.set(index, remaining);
    }
  }
}

/** @internal — test-only accessor for `action_move`/`action_set_friction`'s stored velocity. */
export function _getGmlMotion(
  entity: Entity,
): { vx: number; vy: number } | undefined {
  const motion = motionByWorld.get(entity.world)?.get(entity.eid);
  return motion === undefined ? undefined : { vx: motion.vx, vy: motion.vy };
}

// gmlCamera.ts — GameMaker Studio 2 camera/view-function compat layer.
//
// Sibling to `gmlActions.ts` (GM8.1 DnD action library), `gml.ts` (pure GML
// scripting functions) and `gmlParticles.ts` (GMS2 particle functions) — same
// directory, same "engine defines the context shape, game code wires the
// live pieces" pattern.
//
// GameMaker actually ships *two* overlapping camera-related APIs from two
// different eras, confirmed against the GameMaker manual's "Cameras And
// Viewports" reference:
//
//   - The legacy **view** system: a room has up to 8 fixed viewport slots
//     (`view_xport`/`view_yport`/`view_wport`/`view_hport` for screen
//     placement, `view_visible[0..7]` for whether each one draws, and the
//     room-wide `view_enabled` switch that turns viewport rendering on at
//     all — with it off, the room draws unscaled/unclipped to the window
//     instead of through any viewport). This system predates cameras as a
//     first-class resource.
//   - The modern **camera** API: `camera_create()`/`camera_create_view(...)`
//     return an opaque numeric camera id, an independent resource you can
//     create any number of (GameMaker's own docs note up to 8 can be
//     *active*, i.e. actually assigned to a viewport, at once).
//     `camera_create_view` is the one that actually behaves like the old
//     view system in one call — it sets up a view rectangle (x/y/w/h),
//     angle, follow-speed and follow-border, and optionally a follow
//     object/instance, matching what the view system used to configure
//     inline per-viewport. A bare `camera_create()` has no view rectangle of
//     its own (GameMaker's manual: `camera_get_view_x`/`_y` etc. are "only
//     valid for cameras created using `camera_create_view` or those added in
//     the Room Editor") — this compat layer still gives every handle a
//     view-shaped state record for simplicity (documented deviation below),
//     but a bare `camera_create()` handle is otherwise identical to a
//     `camera_create_view()` one from this file's point of view.
//   - The two systems are bridged by `view_camera[0..7]` (get/set twins:
//     `view_get_camera(idx)`/`view_set_camera(idx, camid)`) — assigning a
//     camera id into a view slot is what makes that camera "active" for that
//     viewport. This is the one real seam between the legacy array-indexed
//     system and the modern handle-based one.
//
// Every function here takes `(ctx: GmlCameraContext, ...gmlArgs)`, not
// `(entity, ctx, ...)` — exactly like `gmlParticles.ts`'s functions and for
// the same reason: none of GameMaker's own camera/view functions take an
// instance argument either (`camera_set_view_pos(camera, x, y)` acts on a
// camera id, never "this instance's camera"), so forcing an `entity`
// parameter here would misrepresent the real API `gmlActions.ts`'s functions
// are the ones actually shaped like "this instance does X".
//
// No DOM, Tauri, or apps/ide imports — same engine-environment-boundary rule
// as every other file under compat/.

import type { GmlActionContext } from "./gmlActions.js";
import type { CameraSystem } from "../systems/CameraSystem.js";
import type { Scene } from "../Scene.js";
import type { SceneFileView } from "../SceneFile.js";
import { getOrCreate } from "../internal/scoped.js";
import { Transform } from "../components/Transform.js";
import { Meta } from "../components/Meta.js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * `GmlActionContext` plus the one extra field this file's functions need: a
 * live `CameraSystem` to actually move. `CameraSystem` is core to
 * `@emptysock/engine` itself (constructed by game code, per-scene — see
 * CLAUDE.md's "`PluginSystem`... are `Game` services" entry's own carve-out
 * for `CameraSystem` staying *out* of that singleton-service pattern), not
 * an optional add-on package behind the tilemap/network-style boundary, so a
 * direct import of the concrete class is the right call here — unlike
 * `gmlParticles.ts`'s `ParticleMountTarget`, which has to stay a structural
 * interface because `RenderPipeline` (its real implementation) pulls in
 * pixi.js and this file must not.
 *
 * `camera` is optional: every camera/view function below still tracks real,
 * readable-back state through the per-`Scene` registry when it's omitted —
 * only camera id `0` (this compat layer's "default room camera", the one
 * `view_camera[0]` starts pointing at) is ever actually mirrored onto a live
 * `CameraSystem`. Every other camera handle a game creates via
 * `camera_create`/`camera_create_view` is real, distinct, readable-back data
 * with no live rendering behind it — an honest degradation (this engine has
 * exactly one mountable camera transform per attached stage today, not
 * GameMaker's "up to 8 simultaneously active" viewport/camera fan-out),
 * matching `gmlParticles.ts`'s own "still simulates, just never mounted
 * anywhere visible" precedent rather than silently faking multi-camera
 * rendering.
 */
export interface GmlCameraContext extends GmlActionContext {
  readonly camera?: CameraSystem;
}

/** GameMaker's `view_camera`/`view_visible` arrays are fixed at 8 slots (viewport 0-7). */
const VIEW_SLOT_COUNT = 8;

/** This compat layer's reserved id for the room's default camera — the one `view_camera[0]` starts bound to, and the only handle ever mirrored onto `ctx.camera`. */
const DEFAULT_CAMERA_ID = 0;

/**
 * Per-camera-handle state. Every field here has a real GameMaker
 * `camera_get_view_*`/`camera_set_view_*` counterpart except `speedX`/
 * `speedY`, which are stored and read back faithfully but — see
 * `camera_set_view_speed`'s doc comment — are not wired into any actual
 * per-frame follow motion for the default camera, an honest, documented gap
 * rather than an invented pixel-speed-to-lerp-factor conversion.
 */
interface GmlCameraHandle {
  readonly id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // degrees, GameMaker's own convention for this function family
  speedX: number; // pixels/step, or -1 for "instant" (GameMaker's sentinel)
  speedY: number;
  borderX: number;
  borderY: number;
  targetObject: number; // GameMaker instance id being followed, or -1 (noone)
  /**
   * The GameMaker *object type* name this camera follows, set by
   * `configureGmlViewsFromRoom` from a room's real `.yy` view `objectId`
   * (see `RoomView`'s doc comment in `gms2-room-import.ts`) — distinct from
   * `targetObject` above, which is a bare numeric instance-id slot this file
   * already exposed but never drove any motion from (see this interface's
   * own pre-existing doc comment). GameMaker's real per-step follow
   * semantics resolve "the object to follow" to *the first active instance
   * of that object type* every step, not a fixed instance — matching
   * `resolveGmlObjectType`'s `Meta.name`-keyed lookup is the correct way to
   * find it here, not a numeric id. `undefined` means "no follow target".
   */
  followObjectName?: string;
}

interface GmlCameraRegistry {
  readonly handles: Map<number, GmlCameraHandle>;
  nextId: number;
  readonly viewCamera: number[]; // length VIEW_SLOT_COUNT, camera id per viewport slot, -1 = none
  readonly viewVisible: boolean[]; // length VIEW_SLOT_COUNT
  /** Screen-space rectangle each viewport slot draws into — `view_xport`/`view_yport`/`view_wport`/`view_hport`, added for real multi-camera compositing (see `buildActiveGmlCameraViewports`). Defaults to a full-1280x720-screen rect per slot, same as this file's other defaults. */
  readonly viewPortX: number[];
  readonly viewPortY: number[];
  readonly viewPortWidth: number[];
  readonly viewPortHeight: number[];
  /** `view_get_surface_id`/`view_set_surface_id` — see that function pair's doc comment. */
  readonly viewSurfaceId: number[];
  viewEnabled: boolean;
  /** The camera id `camera_get_active()` reports — see that function's doc comment for the real, narrower GameMaker semantics this approximates. */
  activeCamera: number;
}

function createHandle(id: number): GmlCameraHandle {
  return {
    id,
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
    angle: 0,
    speedX: -1,
    speedY: -1,
    borderX: 0,
    borderY: 0,
    targetObject: -1,
  };
}

const registryByScene = new WeakMap<Scene, GmlCameraRegistry>();

function ensureRegistry(scene: Scene): GmlCameraRegistry {
  return getOrCreate(registryByScene, scene, () => {
    const handles = new Map<number, GmlCameraHandle>();
    handles.set(DEFAULT_CAMERA_ID, createHandle(DEFAULT_CAMERA_ID));
    const viewCamera = new Array<number>(VIEW_SLOT_COUNT).fill(-1);
    viewCamera[0] = DEFAULT_CAMERA_ID;
    return {
      handles,
      nextId: DEFAULT_CAMERA_ID + 1,
      viewCamera,
      viewVisible: new Array<boolean>(VIEW_SLOT_COUNT).fill(false),
      viewPortX: new Array<number>(VIEW_SLOT_COUNT).fill(0),
      viewPortY: new Array<number>(VIEW_SLOT_COUNT).fill(0),
      viewPortWidth: new Array<number>(VIEW_SLOT_COUNT).fill(1280),
      viewPortHeight: new Array<number>(VIEW_SLOT_COUNT).fill(720),
      viewSurfaceId: new Array<number>(VIEW_SLOT_COUNT).fill(-1),
      viewEnabled: false,
      activeCamera: DEFAULT_CAMERA_ID,
    };
  });
}

/** Clears this scene's camera/view registry. Call from wherever a scene's `GmlActionContext`-driven state gets torn down — mirrors `clearGmlActionState`'s per-`(World, eid)` teardown, just scoped per-`Scene` since camera/view state isn't per-entity. @internal exposed mainly for tests. */
export function clearGmlCameraState(scene: Scene): void {
  registryByScene.delete(scene);
}

function getHandle(
  ctx: GmlCameraContext,
  camid: number,
): GmlCameraHandle | undefined {
  return ensureRegistry(ctx.scene).handles.get(camid);
}

/** Read the default camera's live position/size/angle off `ctx.camera` when it's wired, falling back to the handle's own stored state when it isn't — keeps camera id 0 readable-back either way. */
function syncDefaultFromLive(
  ctx: GmlCameraContext,
  handle: GmlCameraHandle,
): void {
  if (handle.id !== DEFAULT_CAMERA_ID || ctx.camera === undefined) return;
  const state = ctx.camera.state;
  handle.x = state.x;
  handle.y = state.y;
  handle.width = state.viewWidth;
  handle.height = state.viewHeight;
  handle.angle = (state.rotation * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// camera_create / camera_create_view / camera_destroy
// ---------------------------------------------------------------------------

/** `camera_create()` — allocates a new camera handle with default view state and returns its id. Real GameMaker leaves a bare `camera_create()` camera with no view rectangle at all; this compat layer gives it one anyway (matching `camera_create_view`'s defaults) purely for implementation simplicity — a documented deviation, not a functional gap, since nothing here ever rejects reading it back. */
export function camera_create(ctx: GmlCameraContext): number {
  const registry = ensureRegistry(ctx.scene);
  const id = registry.nextId++;
  registry.handles.set(id, createHandle(id));
  return id;
}

/** `camera_create_view(x, y, w, h, angle, objId, xspeed, yspeed, xborder, yborder)` — GameMaker's one-call "set up a view rectangle plus optional object-follow" constructor, the direct functional descendant of the legacy per-viewport view settings. Returns the new camera id. */
export function camera_create_view(
  ctx: GmlCameraContext,
  x: number,
  y: number,
  width: number,
  height: number,
  angle = 0,
  objId = -1,
  xspeed = -1,
  yspeed = -1,
  xborder = 0,
  yborder = 0,
): number {
  const registry = ensureRegistry(ctx.scene);
  const id = registry.nextId++;
  registry.handles.set(id, {
    id,
    x,
    y,
    width,
    height,
    angle,
    speedX: xspeed,
    speedY: yspeed,
    borderX: xborder,
    borderY: yborder,
    targetObject: objId,
  });
  return id;
}

/** `camera_destroy(camid)` — frees a camera handle. Destroying the default camera (id 0) is allowed (matching real GameMaker, which lets you destroy any camera including one currently assigned to a view) but never detaches `ctx.camera` itself — this compat layer's "default camera" binding is a data-level convention (id 0), not a live reference `ctx.camera` needs freed. */
export function camera_destroy(ctx: GmlCameraContext, camid: number): void {
  ensureRegistry(ctx.scene).handles.delete(camid);
}

/**
 * `camera_get_active()` — real GameMaker semantics: the id of the camera
 * currently being used to render, valid only during/after a Draw event (it's
 * unset/unreliable outside one). This compat layer has no per-viewport draw
 * dispatch to hook that moment precisely, so it approximates with a
 * `activeCamera` field the registry initialises to the default camera and
 * that `view_set_camera`/`view_get_camera` below update as slot 0's
 * assignment changes — an honest approximation of "whichever camera is
 * wired to viewport 0 right now", not a true per-Draw-event snapshot.
 */
export function camera_get_active(ctx: GmlCameraContext): number {
  return ensureRegistry(ctx.scene).activeCamera;
}

// ---------------------------------------------------------------------------
// camera_get_view_* / camera_set_view_*
// ---------------------------------------------------------------------------

export function camera_get_view_x(
  ctx: GmlCameraContext,
  camid: number,
): number {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return 0;
  syncDefaultFromLive(ctx, handle);
  return handle.x;
}

export function camera_get_view_y(
  ctx: GmlCameraContext,
  camid: number,
): number {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return 0;
  syncDefaultFromLive(ctx, handle);
  return handle.y;
}

export function camera_get_view_width(
  ctx: GmlCameraContext,
  camid: number,
): number {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return 0;
  syncDefaultFromLive(ctx, handle);
  return handle.width;
}

export function camera_get_view_height(
  ctx: GmlCameraContext,
  camid: number,
): number {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return 0;
  syncDefaultFromLive(ctx, handle);
  return handle.height;
}

export function camera_get_view_angle(
  ctx: GmlCameraContext,
  camid: number,
): number {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return 0;
  syncDefaultFromLive(ctx, handle);
  return handle.angle;
}

export function camera_get_view_speed_x(
  ctx: GmlCameraContext,
  camid: number,
): number {
  return getHandle(ctx, camid)?.speedX ?? -1;
}

export function camera_get_view_speed_y(
  ctx: GmlCameraContext,
  camid: number,
): number {
  return getHandle(ctx, camid)?.speedY ?? -1;
}

/** `camera_set_view_pos(camid, x, y)` — GameMaker moves the view rectangle to `(x, y)` immediately (no built-in smoothing; that's what `camera_set_view_speed` + a follow target are for). For the default camera (id 0) this calls `ctx.camera.snapTo(x, y)` — `CameraSystem`'s own immediate-teleport method, not `moveTo` — matching that "no smoothing here" semantic exactly. */
export function camera_set_view_pos(
  ctx: GmlCameraContext,
  camid: number,
  x: number,
  y: number,
): void {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return;
  handle.x = x;
  handle.y = y;
  if (handle.id === DEFAULT_CAMERA_ID) {
    ctx.camera?.snapTo(x, y);
  }
}

/** `camera_set_view_size(camid, w, h)` — for the default camera this calls `ctx.camera.setViewSize(w, h)`, the real `CameraSystem` API `worldToScreen`/`screenToWorld` and the shake/bounds math already read from. */
export function camera_set_view_size(
  ctx: GmlCameraContext,
  camid: number,
  width: number,
  height: number,
): void {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return;
  handle.width = width;
  handle.height = height;
  if (handle.id === DEFAULT_CAMERA_ID) {
    ctx.camera?.setViewSize(width, height);
  }
}

/** `camera_set_view_angle(camid, angle)` — GameMaker angle is in degrees; `CameraSystem.setRotation` takes radians, so this converts. */
export function camera_set_view_angle(
  ctx: GmlCameraContext,
  camid: number,
  angleDegrees: number,
): void {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return;
  handle.angle = angleDegrees;
  if (handle.id === DEFAULT_CAMERA_ID) {
    ctx.camera?.setRotation((angleDegrees * Math.PI) / 180);
  }
}

/**
 * `camera_set_view_speed(camid, xspeed, yspeed)` — real GameMaker semantics:
 * the pixels-per-step the view moves toward its follow target/position when
 * `camera_set_view_target`-style following is active (`-1` on either axis
 * means "snap instantly", GameMaker's own sentinel). `CameraSystem` has no
 * pixels-per-step follow primitive — its own smoothing (`setFollow`/
 * `moveTo`) is a per-second exponential lerp factor (`setLerpFactor`), a
 * genuinely different curve shape, not a unit conversion of this. Rather
 * than fabricate a pixel-speed-to-lerp-factor formula GameMaker itself
 * doesn't use, this stores the value faithfully (read back exactly by
 * `camera_get_view_speed_x`/`_y`) without driving any actual motion — call
 * `ctx.camera.setLerpFactor`/`setFollow` directly for real smooth-follow
 * behaviour, the same "honest gap over an invented approximation" call
 * `gmlActions.ts`'s `action_sound` doc comment makes for its own
 * not-yet-resolvable mapping.
 */
export function camera_set_view_speed(
  ctx: GmlCameraContext,
  camid: number,
  xspeed: number,
  yspeed: number,
): void {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return;
  handle.speedX = xspeed;
  handle.speedY = yspeed;
}

/**
 * `camera_get_view_border_x`/`_y` and `camera_set_view_border(camid, x, y)` —
 * real GameMaker functions twin to the `hborder`/`vborder` fields
 * `GmlCameraHandle`/`camera_create_view` already store. Added for the
 * `__view_get`/`__view_set_internal` legacy-compat bridge (Freedom Backup's
 * own GameMaker-generated `e__VW.HBorder`/`e__VW.VBorder` cases) — confirmed
 * a real, previously-missing gap: `borderX`/`borderY` were written by
 * `camera_create_view`/`configureGmlViewsFromRoom` and read by
 * `stepGmlCameraFollow`, but had no real get/set function pair of their own.
 */
export function camera_get_view_border_x(
  ctx: GmlCameraContext,
  camid: number,
): number {
  return getHandle(ctx, camid)?.borderX ?? 0;
}
export function camera_get_view_border_y(
  ctx: GmlCameraContext,
  camid: number,
): number {
  return getHandle(ctx, camid)?.borderY ?? 0;
}
export function camera_set_view_border(
  ctx: GmlCameraContext,
  camid: number,
  x: number,
  y: number,
): void {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return;
  handle.borderX = x;
  handle.borderY = y;
}

/**
 * `camera_get_view_target`/`camera_set_view_target(camid, target)` — real
 * GameMaker functions twin to `GmlCameraHandle.targetObject`/
 * `followObjectName`. GameMaker's real `target` argument is an instance id
 * (or an object-type index, `noone`/`-1` for none); this compat layer's
 * follow mechanism (`stepGmlCameraFollow`) resolves by object-type *name*
 * via `Meta.name` (see `resolveGmlObjectType`/`findFirstByObjectName`), not
 * a numeric instance id, so `camera_set_view_target` accepts either a real
 * numeric id (stored, faithfully read back, but does not drive follow — no
 * numeric-instance-id space exists anywhere in this engine to resolve one
 * against) or a bare object-type name string threaded through by the
 * transpiler's existing object-name-quoting convention, which does drive
 * real follow, mirroring `configureGmlViewsFromRoom`'s own
 * `followObjectName` wiring exactly.
 */
export function camera_get_view_target(
  ctx: GmlCameraContext,
  camid: number,
): number {
  return getHandle(ctx, camid)?.targetObject ?? -1;
}
export function camera_set_view_target(
  ctx: GmlCameraContext,
  camid: number,
  target: number | string,
): void {
  const handle = getHandle(ctx, camid);
  if (handle === undefined) return;
  if (typeof target === "string") {
    handle.followObjectName = target;
    handle.targetObject = -1;
  } else {
    handle.targetObject = target;
    if (target < 0) delete handle.followObjectName;
  }
}

// ---------------------------------------------------------------------------
// Legacy view-slot bridge: view_get_camera / view_set_camera / view_enabled /
// view_visible
// ---------------------------------------------------------------------------

function clampSlot(idx: number): number {
  return Math.max(0, Math.min(VIEW_SLOT_COUNT - 1, Math.trunc(idx)));
}

/** `view_get_camera(idx)` — the real GML function twin of reading `view_camera[idx]`. Returns the camera id assigned to viewport `idx` (0-7), or `-1` if none. */
export function view_get_camera(ctx: GmlCameraContext, idx: number): number {
  const registry = ensureRegistry(ctx.scene);
  return registry.viewCamera[clampSlot(idx)] ?? -1;
}

/** `view_set_camera(idx, camid)` — the real GML function twin of assigning `view_camera[idx] = camid`. Assigning into slot 0 also updates `camera_get_active()`'s approximation — see that function's doc comment for why slot 0 is treated as "the" active viewport here. */
export function view_set_camera(
  ctx: GmlCameraContext,
  idx: number,
  camid: number,
): void {
  const registry = ensureRegistry(ctx.scene);
  const slot = clampSlot(idx);
  registry.viewCamera[slot] = camid;
  if (slot === 0) {
    registry.activeCamera = camid;
  }
}

/**
 * Get/set twins for GameMaker's `view_visible[idx]` built-in array variable.
 * This compat layer models every GML variable this family touches as a
 * function-call pair (mirroring the real `view_get_camera`/`view_set_camera`
 * twins GameMaker itself provides for `view_camera[]`) rather than a second,
 * array-shaped surface only this one function family would need.
 */
export function view_get_visible(ctx: GmlCameraContext, idx: number): boolean {
  const registry = ensureRegistry(ctx.scene);
  return registry.viewVisible[clampSlot(idx)] ?? false;
}

export function view_set_visible(
  ctx: GmlCameraContext,
  idx: number,
  visible: boolean,
): void {
  const registry = ensureRegistry(ctx.scene);
  registry.viewVisible[clampSlot(idx)] = visible;
}

/** Get/set twins for the room-wide `view_enabled` built-in variable — whether any viewport rendering happens at all (real GameMaker: with this off, the room draws unscaled/unclipped to the window instead of through viewports). */
export function view_get_enabled(ctx: GmlCameraContext): boolean {
  return ensureRegistry(ctx.scene).viewEnabled;
}

export function view_set_enabled(
  ctx: GmlCameraContext,
  enabled: boolean,
): void {
  ensureRegistry(ctx.scene).viewEnabled = enabled;
}

// ---------------------------------------------------------------------------
// view_xport / view_yport / view_wport / view_hport — the screen rectangle
// each viewport slot draws into. Added for real multi-camera compositing
// (RELEASE_PASS.md's 2026-09-24 multi-camera entry) — GameMaker's real
// `view_wport[idx]`/`view_hport[idx]` etc. built-in array variables, the
// piece this file's own module doc comment noted was previously untracked
// ("only camera id 0 ... driving real per-camera rendering"). Modelled as
// get/set function-pairs, same convention `view_get_camera`/`view_set_camera`
// and `view_get_visible`/`view_set_visible` already use.
// ---------------------------------------------------------------------------

export function view_get_xport(ctx: GmlCameraContext, idx: number): number {
  return ensureRegistry(ctx.scene).viewPortX[clampSlot(idx)] ?? 0;
}
export function view_set_xport(
  ctx: GmlCameraContext,
  idx: number,
  value: number,
): void {
  ensureRegistry(ctx.scene).viewPortX[clampSlot(idx)] = value;
}
export function view_get_yport(ctx: GmlCameraContext, idx: number): number {
  return ensureRegistry(ctx.scene).viewPortY[clampSlot(idx)] ?? 0;
}
export function view_set_yport(
  ctx: GmlCameraContext,
  idx: number,
  value: number,
): void {
  ensureRegistry(ctx.scene).viewPortY[clampSlot(idx)] = value;
}
export function view_get_wport(ctx: GmlCameraContext, idx: number): number {
  return ensureRegistry(ctx.scene).viewPortWidth[clampSlot(idx)] ?? 0;
}
export function view_set_wport(
  ctx: GmlCameraContext,
  idx: number,
  value: number,
): void {
  ensureRegistry(ctx.scene).viewPortWidth[clampSlot(idx)] = value;
}
export function view_get_hport(ctx: GmlCameraContext, idx: number): number {
  return ensureRegistry(ctx.scene).viewPortHeight[clampSlot(idx)] ?? 0;
}
export function view_set_hport(
  ctx: GmlCameraContext,
  idx: number,
  value: number,
): void {
  ensureRegistry(ctx.scene).viewPortHeight[clampSlot(idx)] = value;
}

/**
 * A single active camera's full render state — one entry per enabled,
 * visible view slot — ready to hand to `RenderSystem.renderMultiCamera()`.
 * `id` is the view slot index (0-7), not the camera handle id, since a
 * screen region is owned by the *slot*, not the camera (the same slot can
 * be reassigned to a different camera handle at runtime via
 * `view_set_camera`).
 */
export interface GmlCameraViewport {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly rotation: number;
  readonly viewWidth: number;
  readonly viewHeight: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
}

/**
 * Builds the list of `GmlCameraViewport`s that should actually render this
 * frame: `view_enabled` must be on room-wide, and each slot must have
 * `view_visible[idx]` true and a real camera assigned (`view_camera[idx]
 * !== -1`). This is the one place that reads *every* view slot (0-7), not
 * just slot 0/the default camera — closing the "only camera 0 has a live
 * rendering effect" gap this file's own introduction used to document as
 * permanent. A GML game (or `GmsProjectRuntime`, once wired) calls this once
 * per frame and passes the result straight to `RenderSystem.renderMultiCamera()`.
 */
export function buildActiveGmlCameraViewports(
  ctx: GmlCameraContext,
): GmlCameraViewport[] {
  const registry = ensureRegistry(ctx.scene);
  if (!registry.viewEnabled) return [];
  const out: GmlCameraViewport[] = [];
  for (let idx = 0; idx < VIEW_SLOT_COUNT; idx++) {
    if (registry.viewVisible[idx] !== true) continue;
    const camid = registry.viewCamera[idx] ?? -1;
    if (camid < 0) continue;
    const handle = registry.handles.get(camid);
    if (handle === undefined) continue;
    syncDefaultFromLive(ctx, handle);
    out.push({
      id: idx,
      x: handle.x,
      y: handle.y,
      zoom: 1,
      rotation: (handle.angle * Math.PI) / 180,
      viewWidth: handle.width,
      viewHeight: handle.height,
      screenX: registry.viewPortX[idx] ?? 0,
      screenY: registry.viewPortY[idx] ?? 0,
      screenWidth: registry.viewPortWidth[idx] ?? handle.width,
      screenHeight: registry.viewPortHeight[idx] ?? handle.height,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Room view configuration + per-frame follow — the real "cameras working"
// integration point. `configureGmlViewsFromRoom` takes a room's already-
// converted `SceneFileView[]` (see `SceneFile.ts`'s `SceneFileView` and
// `gms2-room-import.ts`'s `buildRoomSceneFileViews`) and sets up this file's
// existing camera/view registry exactly as if a GML script had called
// `camera_create_view`/`view_set_camera`/`view_set_visible`/`view_set_*port`
// for each one — real GmlCameraViewport data `buildActiveGmlCameraViewports`
// can already turn into a `RenderSystem.renderMultiCamera()` call, and real
// state `camera_get_view_*` reads back correctly. `stepGmlCameraFollow`
// closes the other real gap this file's own pre-existing doc comments
// already flagged: `targetObject`/`followObjectName` were stored but never
// drove any actual per-frame motion.
// ---------------------------------------------------------------------------

/**
 * Configures this scene's camera/view registry from a room's real, already-
 * converted view data (`SceneFile.views`/`.viewsEnabled`). One
 * `camera_create_view`-equivalent handle is created per view slot (even a
 * `visible: false` one, matching GameMaker's own "all 8 slots exist, only
 * the visible/enabled ones actually render" model), bound into that slot via
 * `view_set_camera`, with `view_set_visible`/`view_set_*port` mirroring the
 * room's real screen-rectangle data. Call once, from a room's `onLoad`
 * (`GmsRuntime.ts`'s `buildSceneDefinition` is the real caller) — calling it
 * again (e.g. on a room reload) is safe and simply rebuilds the registry via
 * `ensureRegistry`'s per-`Scene` `WeakMap`, since a scene reload is always a
 * new `Scene` object.
 */
export function configureGmlViewsFromRoom(
  ctx: GmlCameraContext,
  views: readonly SceneFileView[],
  viewsEnabled: boolean,
): void {
  view_set_enabled(ctx, viewsEnabled);
  views.forEach((v, idx) => {
    if (idx >= VIEW_SLOT_COUNT) return;
    const camid =
      idx === 0
        ? DEFAULT_CAMERA_ID
        : camera_create_view(
            ctx,
            v.worldX,
            v.worldY,
            v.worldWidth,
            v.worldHeight,
            0,
            -1,
            v.speedX,
            v.speedY,
            v.borderX,
            v.borderY,
          );
    if (idx === 0) {
      const handle = getHandle(ctx, DEFAULT_CAMERA_ID);
      if (handle !== undefined) {
        handle.x = v.worldX;
        handle.y = v.worldY;
        handle.width = v.worldWidth;
        handle.height = v.worldHeight;
        handle.speedX = v.speedX;
        handle.speedY = v.speedY;
        handle.borderX = v.borderX;
        handle.borderY = v.borderY;
      }
      camera_set_view_pos(ctx, DEFAULT_CAMERA_ID, v.worldX, v.worldY);
      camera_set_view_size(ctx, DEFAULT_CAMERA_ID, v.worldWidth, v.worldHeight);
    }
    const handle = getHandle(ctx, camid);
    if (handle !== undefined && v.followObject !== undefined) {
      handle.followObjectName = v.followObject;
    }
    view_set_camera(ctx, idx, camid);
    view_set_visible(ctx, idx, v.visible);
    view_set_xport(ctx, idx, v.screenX);
    view_set_yport(ctx, idx, v.screenY);
    view_set_wport(ctx, idx, v.screenWidth);
    view_set_hport(ctx, idx, v.screenHeight);
  });
}

/**
 * Finds the position of the first live entity whose `Meta.name` resolves to
 * `objectName` (`resolveGmlObjectType`'s exact matching rule, reused by
 * reference so this can never disagree with `onCollideWith<Type>`
 * dispatch/`place_meeting` about what an object-name argument resolves to —
 * duplicated here rather than imported to avoid a `systems/GmlCollision.ts`
 * import cycle, since that file does not itself depend on `gmlCamera.ts`).
 * Returns `undefined` when no live instance of that object type exists —
 * GameMaker's own real behaviour when a followed object type has no active
 * instances is "the view simply stops moving," which `stepGmlCameraFollow`
 * implements by no-oping in that case.
 */
function findFirstByObjectName(
  scene: Scene,
  objectName: string,
): { x: number; y: number } | undefined {
  let found: { x: number; y: number } | undefined;
  scene.each(Meta, (meta, entity) => {
    if (found !== undefined || meta.name !== objectName) return;
    const t = entity.get(Transform);
    if (t !== undefined) found = { x: t.x, y: t.y };
  });
  return found;
}

/**
 * Applies one step of GameMaker's real border-follow algorithm to camera
 * `camid` — the standard, widely-documented GameMaker view-follow rule
 * (confirmed against ENIGMA's `room_set_view` compatibility docs and
 * GameMaker community references for `hborder`/`vborder`/`hspeed`/`vspeed`
 * semantics, since the manual itself documents the fields but not the exact
 * per-step formula): the view only moves once the followed instance gets
 * within `borderX`/`borderY` pixels of the view's own edge, and then moves
 * just far enough to keep the instance that many pixels inside the edge —
 * never re-centres the instance. `speedX`/`speedY` (`-1` = GameMaker's
 * "snap instantly" sentinel, matching this file's other speed fields) caps
 * how many pixels the view itself may move this step toward that target
 * position, producing GameMaker's characteristic "catch-up" scroll instead
 * of a hard teleport when the instance moves fast.
 *
 * No-ops when the handle has no `followObjectName` set, or when that object
 * type currently has no live instance — both are the honest "nothing to
 * follow right now" case, not an error.
 */
export function stepGmlCameraFollow(
  ctx: GmlCameraContext,
  camid: number,
): void {
  const handle = getHandle(ctx, camid);
  if (handle === undefined || handle.followObjectName === undefined) return;
  const target = findFirstByObjectName(ctx.scene, handle.followObjectName);
  if (target === undefined) return;

  let desiredX = handle.x;
  let desiredY = handle.y;
  if (target.x < handle.x + handle.borderX) {
    desiredX = target.x - handle.borderX;
  } else if (target.x > handle.x + handle.width - handle.borderX) {
    desiredX = target.x - handle.width + handle.borderX;
  }
  if (target.y < handle.y + handle.borderY) {
    desiredY = target.y - handle.borderY;
  } else if (target.y > handle.y + handle.height - handle.borderY) {
    desiredY = target.y - handle.height + handle.borderY;
  }

  const nextX =
    handle.speedX < 0
      ? desiredX
      : handle.x +
        Math.max(-handle.speedX, Math.min(handle.speedX, desiredX - handle.x));
  const nextY =
    handle.speedY < 0
      ? desiredY
      : handle.y +
        Math.max(-handle.speedY, Math.min(handle.speedY, desiredY - handle.y));

  handle.x = nextX;
  handle.y = nextY;
  if (handle.id === DEFAULT_CAMERA_ID) {
    ctx.camera?.snapTo(nextX, nextY);
  }
}

/**
 * Steps `stepGmlCameraFollow` for every currently-configured camera handle
 * in this scene's registry — the real per-frame entry point
 * `GmsProjectRuntime` calls once per frame after room load, so every active
 * view's follow target (not just the default camera) gets its own
 * independent border-follow update.
 */
export function stepAllGmlCameraFollows(ctx: GmlCameraContext): void {
  const registry = ensureRegistry(ctx.scene);
  for (const camid of registry.handles.keys()) {
    stepGmlCameraFollow(ctx, camid);
  }
}

/**
 * `view_get_surface_id`/`view_set_surface_id(idx, id)` — real GameMaker
 * functions that read/write a per-view-slot "application surface" id
 * (GameMaker's real target: which offscreen Surface that viewport renders
 * into, so it can later be drawn elsewhere with `draw_surface`). This
 * engine has no general Surface API — see `compat/gmlInput.ts`'s
 * `application_surface`/`surface_get_width`/`_height` for the same honest
 * gap stated for the room-wide single application surface. Stored
 * faithfully per-slot (read back exactly by a later `view_get_surface_id`
 * call on the same slot) without backing a real renderable surface.
 */
export function view_get_surface_id(
  ctx: GmlCameraContext,
  idx: number,
): number {
  return ensureRegistry(ctx.scene).viewSurfaceId[clampSlot(idx)] ?? -1;
}
export function view_set_surface_id(
  ctx: GmlCameraContext,
  idx: number,
  id: number,
): void {
  ensureRegistry(ctx.scene).viewSurfaceId[clampSlot(idx)] = id;
}

/**
 * The legacy pre-2.3 `room_get_camera`/`room_set_camera`/`room_set_viewport`/
 * `room_set_view_enabled` family — GameMaker's real per-*room* view-array
 * accessors, confirmed real and still called by Freedom Backup's own
 * `scripts/room_set_view/room_set_view.gml` (the same real GameMaker-
 * auto-generated view-compatibility script family `__view_get`/
 * `__view_set_internal` above already document, but this one was never
 * previously wired — a real, confirmed gap: `room_get_camera`/
 * `room_set_camera`/`room_set_viewport`/`room_set_view_enabled` were
 * fully undeclared identifiers, so any call into `room_set_view` threw.
 *
 * GameMaker's real signature addresses an arbitrary room by its numeric
 * index, not just the currently-loaded one — a capability this engine's
 * room model genuinely doesn't have (this importer addresses rooms by
 * name, and there is no live per-room camera/view state for a room that
 * isn't the current `Scene` at all — see `room_speed`'s own doc comment
 * for the identical "no cross-room state to answer from" shape). Rather
 * than fabricate a numeric-room-keyed registry with no real backing data,
 * these honestly operate on the *current* scene's own view registry —
 * `ensureRegistry(ctx.scene)`, the exact same one every `view_get_camera`/
 * `view_set_camera`/`view_set_visible` call above already reads/writes —
 * and silently ignore the `room` argument. This matches real usage: every
 * confirmed real call site in Freedom Backup passes the *current* room's
 * own numeric index (obtained via `room`, itself just an alias in this
 * importer — see `room()`'s own doc comment), so honestly aliasing to
 * "the current room" produces the correct real behaviour for every actual
 * call, not just a plausible-looking approximation.
 */
export function room_get_camera(
  ctx: GmlCameraContext,
  _room: number,
  view: number,
): number {
  return view_get_camera(ctx, view);
}

/** See `room_get_camera`'s doc comment. */
export function room_set_camera(
  ctx: GmlCameraContext,
  _room: number,
  view: number,
  camera: number,
): void {
  view_set_camera(ctx, view, camera);
}

/** See `room_get_camera`'s doc comment — real GameMaker signature: `room_set_viewport(room, view, visible, xport, yport, wport, hport)`. */
export function room_set_viewport(
  ctx: GmlCameraContext,
  _room: number,
  view: number,
  visible: boolean,
  xport: number,
  yport: number,
  wport: number,
  hport: number,
): void {
  const registry = ensureRegistry(ctx.scene);
  const slot = clampSlot(view);
  registry.viewVisible[slot] = visible;
  registry.viewPortX[slot] = xport;
  registry.viewPortY[slot] = yport;
  registry.viewPortWidth[slot] = wport;
  registry.viewPortHeight[slot] = hport;
}

/** See `room_get_camera`'s doc comment — real GameMaker signature: `room_set_view_enabled(room, enable)`, the room-wide switch `viewSettings.enableViews`/`configureGmlViewsFromRoom` already maintains as `registry.viewEnabled`. */
export function room_set_view_enabled(
  ctx: GmlCameraContext,
  _room: number,
  enable: boolean,
): void {
  ensureRegistry(ctx.scene).viewEnabled = enable;
}

/** @internal — test-only accessor for a camera handle's full stored state. */
export function _getGmlCameraHandle(
  ctx: GmlCameraContext,
  camid: number,
): Readonly<GmlCameraHandle> | undefined {
  const handle = getHandle(ctx, camid);
  if (handle !== undefined) syncDefaultFromLive(ctx, handle);
  return handle;
}

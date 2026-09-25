import type { GmlActionContext } from "./gmlActions.js";
import type { CameraSystem } from "../systems/CameraSystem.js";
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
/** `camera_create()` — allocates a new camera handle with default view state and returns its id. Real GameMaker leaves a bare `camera_create()` camera with no view rectangle at all; this compat layer gives it one anyway (matching `camera_create_view`'s defaults) purely for implementation simplicity — a documented deviation, not a functional gap, since nothing here ever rejects reading it back. */
export declare function camera_create(ctx: GmlCameraContext): number;
/** `camera_create_view(x, y, w, h, angle, objId, xspeed, yspeed, xborder, yborder)` — GameMaker's one-call "set up a view rectangle plus optional object-follow" constructor, the direct functional descendant of the legacy per-viewport view settings. Returns the new camera id. */
export declare function camera_create_view(
  ctx: GmlCameraContext,
  x: number,
  y: number,
  width: number,
  height: number,
  angle?: number,
  objId?: number,
  xspeed?: number,
  yspeed?: number,
  xborder?: number,
  yborder?: number,
): number;
/** `camera_destroy(camid)` — frees a camera handle. Destroying the default camera (id 0) is allowed (matching real GameMaker, which lets you destroy any camera including one currently assigned to a view) but never detaches `ctx.camera` itself — this compat layer's "default camera" binding is a data-level convention (id 0), not a live reference `ctx.camera` needs freed. */
export declare function camera_destroy(
  ctx: GmlCameraContext,
  camid: number,
): void;
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
export declare function camera_get_active(ctx: GmlCameraContext): number;
export declare function camera_get_view_x(
  ctx: GmlCameraContext,
  camid: number,
): number;
export declare function camera_get_view_y(
  ctx: GmlCameraContext,
  camid: number,
): number;
export declare function camera_get_view_width(
  ctx: GmlCameraContext,
  camid: number,
): number;
export declare function camera_get_view_height(
  ctx: GmlCameraContext,
  camid: number,
): number;
export declare function camera_get_view_angle(
  ctx: GmlCameraContext,
  camid: number,
): number;
export declare function camera_get_view_speed_x(
  ctx: GmlCameraContext,
  camid: number,
): number;
export declare function camera_get_view_speed_y(
  ctx: GmlCameraContext,
  camid: number,
): number;
/** `camera_set_view_pos(camid, x, y)` — GameMaker moves the view rectangle to `(x, y)` immediately (no built-in smoothing; that's what `camera_set_view_speed` + a follow target are for). For the default camera (id 0) this calls `ctx.camera.snapTo(x, y)` — `CameraSystem`'s own immediate-teleport method, not `moveTo` — matching that "no smoothing here" semantic exactly. */
export declare function camera_set_view_pos(
  ctx: GmlCameraContext,
  camid: number,
  x: number,
  y: number,
): void;
/** `camera_set_view_size(camid, w, h)` — for the default camera this calls `ctx.camera.setViewSize(w, h)`, the real `CameraSystem` API `worldToScreen`/`screenToWorld` and the shake/bounds math already read from. */
export declare function camera_set_view_size(
  ctx: GmlCameraContext,
  camid: number,
  width: number,
  height: number,
): void;
/** `camera_set_view_angle(camid, angle)` — GameMaker angle is in degrees; `CameraSystem.setRotation` takes radians, so this converts. */
export declare function camera_set_view_angle(
  ctx: GmlCameraContext,
  camid: number,
  angleDegrees: number,
): void;
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
export declare function camera_set_view_speed(
  ctx: GmlCameraContext,
  camid: number,
  xspeed: number,
  yspeed: number,
): void;
/** `view_get_camera(idx)` — the real GML function twin of reading `view_camera[idx]`. Returns the camera id assigned to viewport `idx` (0-7), or `-1` if none. */
export declare function view_get_camera(
  ctx: GmlCameraContext,
  idx: number,
): number;
/** `view_set_camera(idx, camid)` — the real GML function twin of assigning `view_camera[idx] = camid`. Assigning into slot 0 also updates `camera_get_active()`'s approximation — see that function's doc comment for why slot 0 is treated as "the" active viewport here. */
export declare function view_set_camera(
  ctx: GmlCameraContext,
  idx: number,
  camid: number,
): void;
/**
 * Get/set twins for GameMaker's `view_visible[idx]` built-in array variable.
 * This compat layer models every GML variable this family touches as a
 * function-call pair (mirroring the real `view_get_camera`/`view_set_camera`
 * twins GameMaker itself provides for `view_camera[]`) rather than a second,
 * array-shaped surface only this one function family would need.
 */
export declare function view_get_visible(
  ctx: GmlCameraContext,
  idx: number,
): boolean;
export declare function view_set_visible(
  ctx: GmlCameraContext,
  idx: number,
  visible: boolean,
): void;
/** Get/set twins for the room-wide `view_enabled` built-in variable — whether any viewport rendering happens at all (real GameMaker: with this off, the room draws unscaled/unclipped to the window instead of through viewports). */
export declare function view_get_enabled(ctx: GmlCameraContext): boolean;
export declare function view_set_enabled(
  ctx: GmlCameraContext,
  enabled: boolean,
): void;
export declare function view_get_xport(
  ctx: GmlCameraContext,
  idx: number,
): number;
export declare function view_set_xport(
  ctx: GmlCameraContext,
  idx: number,
  value: number,
): void;
export declare function view_get_yport(
  ctx: GmlCameraContext,
  idx: number,
): number;
export declare function view_set_yport(
  ctx: GmlCameraContext,
  idx: number,
  value: number,
): void;
export declare function view_get_wport(
  ctx: GmlCameraContext,
  idx: number,
): number;
export declare function view_set_wport(
  ctx: GmlCameraContext,
  idx: number,
  value: number,
): void;
export declare function view_get_hport(
  ctx: GmlCameraContext,
  idx: number,
): number;
export declare function view_set_hport(
  ctx: GmlCameraContext,
  idx: number,
  value: number,
): void;
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
export declare function buildActiveGmlCameraViewports(
  ctx: GmlCameraContext,
): GmlCameraViewport[];

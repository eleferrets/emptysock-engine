import type { GmlActionContext } from "./gmlActions.js";
import type { GmlDrawTarget } from "./gml.js";

// ---------------------------------------------------------------------------
// gpu_set_blendmode / surface_* / draw_surface / draw_clear — GMS2 cutout lighting
// ---------------------------------------------------------------------------
//
// Real, confirmed usage (a real GameMaker project's lighting objects): a
// full-view "darkness" surface is filled light grey, each light is drawn onto
// it with `gpu_set_blendmode(bm_subtract)` (cutting a hole), then the surface
// itself is drawn over the view with `bm_subtract` again, so darkness remains
// only where no light cut it out. `bm_add` drives additive glows. This file is
// pixi-free: a `GmlSurfaceBackend` (implemented by `RenderPipeline`, wired via
// `GmlActionContext.surfaces`) owns the real render textures; this file only
// routes `ctx.drawTarget` in and out of them. Without a backend every call is
// an honest no-op (`surface_create` returns `-1`, GameMaker's "no surface").
//
// This complements — does not replace — `LightingSystem`/`LightSource`/
// `LightOccluder`: those are the engine-native lighting path (ambient level +
// point lights + shadow occluders); this is the GML-authored path.

/** GameMaker's `bm_*` blend-mode constants (only the four the legacy `gpu_set_blendmode` accepts). */
export const bm_normal = 0;
export const bm_add = 1;
export const bm_max = 2;
export const bm_subtract = 3;

/**
 * Backend for GMS2 surfaces. `beginTarget` returns the draw target GML draw
 * calls should go to until `endTarget` commits them into the surface's
 * texture (accumulating over earlier contents, unless the target was cleared).
 */
export interface GmlSurfaceBackend {
  create(width: number, height: number): number;
  exists(id: number): boolean;
  free(id: number): void;
  width(id: number): number;
  height(id: number): number;
  beginTarget(id: number): GmlDrawTarget | undefined;
  endTarget(id: number): void;
}

const stacks = new WeakMap<
  GmlActionContext,
  { id: number; previous: GmlDrawTarget | undefined }[]
>();
const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[gml surfaces] ${message}`);
}

function setTarget(
  ctx: GmlActionContext,
  target: GmlDrawTarget | undefined,
): void {
  const mutable = ctx as { drawTarget?: GmlDrawTarget };
  if (target === undefined) delete mutable.drawTarget;
  else mutable.drawTarget = target;
}

/** `gpu_set_blendmode(mode)` — `bm_normal`/`bm_add`/`bm_max`/`bm_subtract`. */
export function gpu_set_blendmode(ctx: GmlActionContext, mode: number): void {
  ctx.drawTarget?.setBlendMode?.(mode);
}

/** Legacy alias of `gpu_set_blendmode`. */
export function draw_set_blend_mode(ctx: GmlActionContext, mode: number): void {
  gpu_set_blendmode(ctx, mode);
}

/** `gpu_set_blendmode_ext(src, dest)` — arbitrary factor pairs are not modelled; warned no-op. */
export function gpu_set_blendmode_ext(
  _ctx: GmlActionContext,
  _src: number,
  _dest: number,
): void {
  warnOnce(
    "gpu_set_blendmode_ext: arbitrary blend factors are not modelled; use bm_normal/bm_add/bm_max/bm_subtract. Ignored.",
  );
}

export function surface_create(
  ctx: GmlActionContext,
  width: number,
  height: number,
): number {
  return ctx.surfaces?.create(width, height) ?? -1;
}

export function surface_exists(ctx: GmlActionContext, id: number): boolean {
  return ctx.surfaces?.exists(id) ?? false;
}

export function surface_free(ctx: GmlActionContext, id: number): void {
  ctx.surfaces?.free(id);
}

/** Redirects `draw_*` to the surface until `surface_reset_target()`; nests like GameMaker's own target stack. */
export function surface_set_target(ctx: GmlActionContext, id: number): void {
  const target = ctx.surfaces?.beginTarget(id);
  if (target === undefined) return;
  let stack = stacks.get(ctx);
  if (stack === undefined) {
    stack = [];
    stacks.set(ctx, stack);
  }
  stack.push({ id, previous: ctx.drawTarget });
  setTarget(ctx, target);
}

/** Commits the current surface target and restores the previous draw target. */
export function surface_reset_target(ctx: GmlActionContext): void {
  const entry = stacks.get(ctx)?.pop();
  if (entry === undefined) return;
  ctx.surfaces?.endTarget(entry.id);
  setTarget(ctx, entry.previous);
}

/** `draw_surface(id, x, y)` — draws the surface with the current blend mode. */
export function draw_surface(
  ctx: GmlActionContext,
  id: number,
  x: number,
  y: number,
): void {
  ctx.drawTarget?.drawSurface?.(id, x, y);
}

/** `draw_clear(colour)` — replaces the current target's contents with a solid colour. */
export function draw_clear(ctx: GmlActionContext, colour: number): void {
  ctx.drawTarget?.clear?.(colour, 1);
}

/** `draw_clear_alpha(colour, alpha)`. */
export function draw_clear_alpha(
  ctx: GmlActionContext,
  colour: number,
  alpha: number,
): void {
  ctx.drawTarget?.clear?.(colour, alpha);
}

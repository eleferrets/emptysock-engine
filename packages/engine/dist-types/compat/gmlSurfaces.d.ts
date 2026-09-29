import type { GmlActionContext } from "./gmlActions.js";
import type { GmlDrawTarget } from "./gml.js";
/** GameMaker's `bm_*` blend-mode constants (only the four the legacy `gpu_set_blendmode` accepts). */
export declare const bm_normal = 0;
export declare const bm_add = 1;
export declare const bm_max = 2;
export declare const bm_subtract = 3;
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
/** `gpu_set_blendmode(mode)` — `bm_normal`/`bm_add`/`bm_max`/`bm_subtract`. */
export declare function gpu_set_blendmode(
  ctx: GmlActionContext,
  mode: number,
): void;
/** Legacy alias of `gpu_set_blendmode`. */
export declare function draw_set_blend_mode(
  ctx: GmlActionContext,
  mode: number,
): void;
/** `gpu_set_blendmode_ext(src, dest)` — arbitrary factor pairs are not modelled; warned no-op. */
export declare function gpu_set_blendmode_ext(
  _ctx: GmlActionContext,
  _src: number,
  _dest: number,
): void;
export declare function surface_create(
  ctx: GmlActionContext,
  width: number,
  height: number,
): number;
export declare function surface_exists(
  ctx: GmlActionContext,
  id: number,
): boolean;
export declare function surface_free(ctx: GmlActionContext, id: number): void;
/** Redirects `draw_*` to the surface until `surface_reset_target()`; nests like GameMaker's own target stack. */
export declare function surface_set_target(
  ctx: GmlActionContext,
  id: number,
): void;
/** Commits the current surface target and restores the previous draw target. */
export declare function surface_reset_target(ctx: GmlActionContext): void;
/** `draw_surface(id, x, y)` — draws the surface with the current blend mode. */
export declare function draw_surface(
  ctx: GmlActionContext,
  id: number,
  x: number,
  y: number,
): void;
/** `draw_clear(colour)` — replaces the current target's contents with a solid colour. */
export declare function draw_clear(ctx: GmlActionContext, colour: number): void;
/** `draw_clear_alpha(colour, alpha)`. */
export declare function draw_clear_alpha(
  ctx: GmlActionContext,
  colour: number,
  alpha: number,
): void;

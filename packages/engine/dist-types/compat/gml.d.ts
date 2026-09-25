export declare function setRoomSize(w: number, h: number): void;
export declare function room_width(): number;
export declare function room_height(): number;
export declare const c_aqua = 65535;
export declare const c_black = 0;
export declare const c_blue = 255;
export declare const c_dkgray = 4210752;
export declare const c_fuchsia = 16711935;
export declare const c_gray = 8421504;
export declare const c_green = 32768;
export declare const c_lime = 65280;
export declare const c_ltgray = 12632256;
export declare const c_maroon = 8388608;
export declare const c_navy = 128;
export declare const c_olive = 8421376;
export declare const c_orange = 16753920;
export declare const c_purple = 8388736;
export declare const c_red = 16711680;
export declare const c_silver = 12632256;
export declare const c_teal = 32896;
export declare const c_white = 16777215;
export declare const c_yellow = 16776960;
export declare function lerp(a: number, b: number, t: number): number;
export declare function clamp(val: number, min: number, max: number): number;
export declare function sign(val: number): number;
/** Fractional part (GML frac) */
export declare function frac(val: number): number;
/** x component of a vector given length and direction (degrees) */
export declare function lengthdir_x(length: number, direction: number): number;
/** y component of a vector given length and direction (degrees, GML y-down) */
export declare function lengthdir_y(length: number, direction: number): number;
export declare function point_distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number;
/** Direction in degrees from (x1,y1) to (x2,y2), GML convention (right=0, CCW) */
export declare function point_direction(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number;
export declare function degtorad(deg: number): number;
export declare function radtodeg(rad: number): number;
/** Random integer 0..max-1 */
export declare function irandom(max: number): number;
/** Random integer in [lo, hi] */
export declare function irandom_range(lo: number, hi: number): number;
/** Random float [0, max) */
export declare function random(max: number): number;
/** Random float [lo, hi) */
export declare function random_range(lo: number, hi: number): number;
/** Pick a random argument */
export declare function choose<T>(...args: T[]): T;
/** GML string() — convert to string */
export declare function string(val: unknown): string;
export declare function string_length(str: string): number;
/** GML string_copy(str, index, count) — 1-based index */
export declare function string_copy(
  str: string,
  index: number,
  count: number,
): string;
/** GML string_pos(needle, haystack) — 1-based, 0 if not found */
export declare function string_pos(needle: string, haystack: string): number;
export declare function string_lower(str: string): string;
export declare function string_upper(str: string): string;
export declare function string_repeat(str: string, count: number): string;
/** GML string_delete(str, index, count) — 1-based index */
export declare function string_delete(
  str: string,
  index: number,
  count: number,
): string;
export declare function ds_map_create(): number;
export declare function ds_map_destroy(id: number): void;
export declare function ds_map_set(
  id: number,
  key: unknown,
  value: unknown,
): void;
export declare function ds_map_find_value(id: number, key: unknown): unknown;
export declare function ds_map_exists(id: number, key: unknown): boolean;
export declare function ds_map_delete(id: number, key: unknown): void;
export declare function ds_list_create(): number;
export declare function ds_list_destroy(id: number): void;
export declare function ds_list_add(id: number, value: unknown): void;
export declare function ds_list_find_value(id: number, pos: number): unknown;
export declare function ds_list_size(id: number): number;
/** GML ds_list_delete(id, pos) — removes the element at position */
export declare function ds_list_delete(id: number, pos: number): void;
/**
 * The minimal drawing surface a transpiled GML `draw_*` call needs. This is
 * a plain structural interface, not `CanvasRenderingContext2D` — `gml.ts`
 * stays inside the engine-environment boundary (no DOM import), and a real
 * caller wires in whatever actually implements it. `GmlBehaviorSystem`
 * (`systems/GmlBehaviorSystem.ts`) is the real implementation: a pixi
 * `Graphics` object wrapped to satisfy this shape, rebuilt from scratch on
 * every `onDraw`/`onDrawGui` call the same way `ParticleEmitter`'s pixi
 * container is rebuilt every frame (see CLAUDE.md's "ParticleEmitter renders
 * through a real pixi ParticleContainer" entry for the precedent this
 * mirrors) — draw state does not need to persist between calls.
 */
export interface GmlDrawTarget {
  setColor(hex: number): void;
  rect(x1: number, y1: number, x2: number, y2: number, outline: boolean): void;
  circle(x: number, y: number, r: number, outline: boolean): void;
  text(x: number, y: number, text: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  /**
   * `draw_sprite(sprite, subimg, x, y)` — draws a specific sprite at an
   * explicit position, independent of the drawing entity's own `Sprite`
   * component (real, confirmed real-world usage: `draw_sprite(spr_marker,
   * 0, x, y)` — a *different* sprite than the object's own default one,
   * from a real project's `obj_text`'s `Draw_0.gml`; `draw_sprite(_image,
   * 0, _drawX + _imageW / 2, _drawY + _imageH / 2)` — a dynamically chosen
   * image at a *custom* offset position, from a real project's `oTextbox`'s
   * `Draw_64.gml`). `subimg` (GameMaker's per-frame index) is honestly not
   * modelled — this importer only ever copies a sprite's first frame (see
   * CLAUDE.md's `image_index`/`image_speed` entry for the same,
   * already-documented multi-frame-animation gap), so `subimg` is accepted
   * for real call sites to keep their real argument count but always draws
   * frame 0.
   */
  sprite(texturePath: string, x: number, y: number): void;
}
export declare function draw_set_colour(
  target: GmlDrawTarget,
  hex: number,
): void;
export declare function draw_rectangle(
  target: GmlDrawTarget,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outline: boolean,
): void;
export declare function draw_circle(
  target: GmlDrawTarget,
  x: number,
  y: number,
  r: number,
  outline: boolean,
): void;
export declare function draw_text(
  target: GmlDrawTarget,
  x: number,
  y: number,
  text: string,
): void;
/**
 * `draw_sprite(sprite, subimg, x, y)` — GameMaker's own argument order has
 * `subimg` between the sprite reference and the position, but `subimg` is
 * honestly not modelled (see `GmlDrawTarget.sprite`'s own doc comment), so
 * it's accepted here purely to keep a real call site's argument count and
 * position intact — it's never read.
 */
export declare function draw_sprite(
  target: GmlDrawTarget,
  texturePath: string,
  _subimg: number,
  x: number,
  y: number,
): void;
export declare function draw_line(
  target: GmlDrawTarget,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void;
/** GML show_message — browser-safe: console.log instead of a blocking dialog */
export declare function show_message(msg: string): void;
/** GML game_end — no-op in EmptySock; close/stop your scene manually */
export declare function game_end(): void;
/** GML object_exists — checks whether an object asset name/index is valid. */
export declare function object_exists(_objectName: string): boolean;
/** GML asset_get_index — resolves an asset name to an index. No-op stub: EmptySock references assets by name/path directly. */
export declare function asset_get_index(name: string): string;
/** GML array_length_1d — length of a 1D array (JS arrays are always 1D). */
export declare function array_length_1d(arr: unknown[]): number;
/** GML string_char_at — 1-based index. */
export declare function string_char_at(str: string, index: number): string;
/** GML keyboard_wait — blocks until a key is pressed. No-op stub: use onKeyPress instead. */
export declare function keyboard_wait(): void;
/** GML mouse_button_down (legacy GM8-style action) — no-op stub; use InputSystem. */
export declare function mouse_button_down(_button: number): boolean;
/** GML mouse_button_released (legacy GM8-style action) — no-op stub; use InputSystem. */
export declare function mouse_button_released(_button: number): boolean;
/**
 * GML `place_empty(x, y)` — legacy collision-check action; kept as a no-op
 * stub. Note this is distinct from `place_free`, which is now real (see
 * `compat/gmlCollisionQueries.ts`'s `place_free` — GameMaker's own
 * `place_free`, checked against `solid`-flagged instances). `place_empty` is
 * an older, less-common GM8-era alias with slightly different semantics
 * (checks against every instance, not just solid ones) that hasn't been
 * ported yet — a real, separate, tracked gap.
 */
export declare function place_empty(_x: number, _y: number): boolean;

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
/**
 * `max`/`min`/`abs` — GameMaker's own variadic math built-ins, real,
 * confirmed common (Freedom Backup's `scr_get_input.gml` alone uses
 * `max(gamepad_axis_value(...), 0)`, `min(...)`, `abs(...)`), never wired
 * into this transpiler's `THREADED_PURE_FUNCTIONS` list before despite
 * being trivial thin wrappers over `Math.max`/`Math.min`/`Math.abs` — every
 * other GML math built-in already routed through this file (`lerp`/`sign`/
 * `frac`/...) had a real implementation here, these three simply never did.
 * GameMaker's `max`/`min` accept any number of arguments (not just two),
 * matching `Math.max`/`Math.min`'s own variadic signature exactly — no
 * argument-count translation needed.
 */
export declare function max(...vals: number[]): number;
export declare function min(...vals: number[]): number;
export declare function abs(val: number): number;
/** `ord(str)` — GameMaker's own idiom for turning a single character into its numeric code point (`ord("D")` == 68), the same legacy `KeyboardEvent.keyCode`-compatible numbering `vk_*`'s letter range already uses. Also exported (identically) from `compat/gmlInput.ts`, since real source uses it both standalone (`ord("R")` as a plain char code) and as a `keyboard_check`/`keyboard_check_pressed` argument — kept as two small, trivially-in-sync one-liners rather than an awkward cross-file import for a single-expression function, the same "duplicated because trivial and the alternative is worse" precedent `gmlKeys.ts`'s own doc comment already accepts for its `VK_NAMES` table. */
export declare function ord(str: string): number;
/** Fractional part (GML frac) */
export declare function frac(val: number): number;
/**
 * `sin`/`cos`/`tan`/`sqrt`/`power` — GameMaker's own bare trig/power
 * built-ins, real, confirmed usage (Freedom Backup's own `obj_gun_pickup`
 * float-bob effect: `ystart + sin(get_timer()/500000)*5`). Unlike
 * `lengthdir_x`/`lengthdir_y` above (which take a *degrees* argument, per
 * GameMaker's own documented convention for that function family), GML's
 * bare `sin`/`cos`/`tan` operate in *radians* — confirmed against
 * manual.gamemaker.io's Number reference page — so these are thin,
 * unit-preserving wrappers over `Math`'s own radian-based equivalents,
 * with no conversion factor (unlike `degtorad`/`radtodeg` above, which
 * exist specifically because most of the rest of this file's angle
 * fields are in degrees).
 */
export declare function sin(val: number): number;
export declare function cos(val: number): number;
export declare function tan(val: number): number;
export declare function sqrt(val: number): number;
/** GML `power(base, exponent)` — a plain wrapper over `Math.pow`/`**`. */
export declare function power(base: number, exponent: number): number;
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
export declare function string_width(str: string): number;
export declare function string_height(str: string): number;
/** GML string_delete(str, index, count) — 1-based index */
export declare function string_delete(
  str: string,
  index: number,
  count: number,
): string;
/**
 * GML `string_insert(substr, str, index)` — inserts `substr` into `str`
 * starting at the 1-based `index`, matching `string_delete`'s own 1-based
 * convention above (both are GameMaker's own real signature/indexing,
 * confirmed against manual.gamemaker.io's `string_insert` reference page).
 * Real, confirmed usage: Freedom Backup's own `obj_menu` menu-cursor
 * rendering (`string_insert("> ", txt, 0)` — GameMaker treats an
 * out-of-range low index as "insert at the very start", which this
 * implementation matches via `Math.max(0, index - 1)`).
 */
export declare function string_insert(
  substr: string,
  str: string,
  index: number,
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
  /**
   * `draw_set_font(font)` — sets the font subsequent `text()` calls render
   * with, until changed again. Optional (a `GmlDrawTarget` implementation
   * with no real font concept — e.g. a synthetic test double — can simply
   * omit it, and `draw_set_font` becomes a safe, honest no-op rather than a
   * hard error) for the same reason every other setter on this interface is
   * a plain method rather than a constructor argument: GameMaker's draw
   * state is mutable and call-order-dependent, and the real implementation
   * (`RenderPipeline`'s `PixiGmlDrawTarget`) is rebuilt fresh on every
   * `onDraw`/`onDrawGui` dispatch anyway (see this interface's own doc
   * comment), so there's no persistent state to leak between draw calls.
   */
  setFont?(fontId: string): void;
  /** `draw_set_halign(align)` — horizontal text alignment for subsequent `text()` calls (`fa_left`/`fa_center`/`fa_right`, see those constants' own doc comment below). Optional, same reasoning as `setFont`. */
  setHalign?(align: number): void;
  /** `draw_set_valign(align)` — vertical text alignment for subsequent `text()` calls (`fa_top`/`fa_middle`/`fa_bottom`). Optional, same reasoning as `setFont`. */
  setValign?(align: number): void;
  /** `draw_set_alpha(alpha)` — opacity (0-1) applied to every subsequent draw call until changed again — GameMaker's own persistent draw-state alpha, distinct from a per-call `alpha` argument (`spriteExt`/`spritePartExt` below still take their own explicit `alpha`, matching GameMaker's own real per-call override). Optional, same reasoning as `setFont`. */
  setAlpha?(alpha: number): void;
  /**
   * `draw_sprite_ext(sprite, subimg, x, y, xscale, yscale, rot, colour, alpha)`
   * — draws a sprite with a full per-call transform, unlike the plain
   * `sprite()` above (position only). `rot` is degrees (GameMaker's own
   * convention); `colour` is a plain `0xRRGGBB` tint (already converted from
   * GameMaker's `$BBGGRR` by the caller, the same convention `image_blend`'s
   * own rewrite already uses — see CLAUDE.md's "GMS2 rendering built-ins"
   * entry). Optional — a `GmlDrawTarget` that only implements the base
   * `sprite()` position-only draw still works; `draw_sprite_ext` degrades to
   * a safe no-op (never scale/rotate/tint through it) rather than throwing.
   */
  spriteExt?(
    texturePath: string,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    rotationDeg: number,
    colour: number,
    alpha: number,
  ): void;
  /**
   * `draw_sprite_part(sprite, subimg, left, top, width, height, x, y)` —
   * draws only a cropped sub-rectangle (in the sprite's own source-pixel
   * space) of a sprite at a position, no scale/rotate/tint. Optional, same
   * degrade-to-no-op reasoning as `spriteExt`.
   */
  spritePart?(
    texturePath: string,
    left: number,
    top: number,
    width: number,
    height: number,
    x: number,
    y: number,
  ): void;
  /**
   * `draw_sprite_part_ext(sprite, subimg, left, top, width, height, x, y,
   * xscale, yscale, colour, alpha)` — `spritePart` plus a full per-call
   * scale/tint/alpha transform, the same fields `spriteExt` applies (minus
   * rotation — GameMaker's real function has no rotation parameter for the
   * partial-sprite variant). Optional, same degrade-to-no-op reasoning.
   */
  spritePartExt?(
    texturePath: string,
    left: number,
    top: number,
    width: number,
    height: number,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    colour: number,
    alpha: number,
  ): void;
}
/**
 * `fa_left`/`fa_center`/`fa_right`/`fa_top`/`fa_middle`/`fa_bottom` —
 * GameMaker's real, fixed text-alignment enum constants (manual.gamemaker.io's
 * `draw_set_halign`/`draw_set_valign` reference pages), confirmed real
 * values: horizontal alignment is `fa_left = 0`, `fa_center = 1`,
 * `fa_right = 2`; vertical alignment is a numerically separate enum that
 * happens to share the same three ordinal values, `fa_top = 0`,
 * `fa_middle = 1`, `fa_bottom = 2`. Declared as plain numbers, the same
 * "value constant, not a call" shape `c_white`/`vk_left`/`gp_face1` above
 * already use — `gms2-transpile.ts`'s rewrite for these is the same
 * `\bname\b` → `GmlActions.name` substitution `GML_COLOUR_CONSTANTS`/
 * `GML_INPUT_CONSTANTS` already establish.
 */
export declare const fa_left = 0;
export declare const fa_center = 1;
export declare const fa_right = 2;
export declare const fa_top = 0;
export declare const fa_middle = 1;
export declare const fa_bottom = 2;
export declare function draw_set_colour(
  target: GmlDrawTarget,
  hex: number,
): void;
/** `draw_set_color` — GameMaker accepts both the British `draw_set_colour` and this American-spelling alias for the exact same function (confirmed against GameMaker's own manual, which lists both names on the same reference page); real GML source uses either spelling interchangeably (Freedom Backup's own source uses `draw_set_color`). A plain re-export, not a second implementation, so the two spellings can never drift apart. */
export declare const draw_set_color: typeof draw_set_colour;
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
  text: string | number,
): void;
/**
 * `draw_text_ext(x, y, string, sep, w)` — GameMaker's real multi-line text
 * built-in (manual.gamemaker.io's `draw_text_ext` reference page). GameMaker
 * splits `string` on both a literal newline and its own `#` line-break
 * convention, drawing each line `sep` pixels below the last (`sep = -1`
 * uses the current font's own natural line height — approximated here as a
 * fixed 16px, since `GmlDrawTarget` exposes no font-metrics query to read a
 * real line height from, the same "no font registry reachable from
 * `compat/`" gap `font_get_size` below documents). `w` (max line width, for
 * automatic word-wrap; `-1` disables it) is honestly *not* applied — this
 * function has no text-measurement primitive to decide where a line would
 * overflow `w`, the same "no measurement API" gap `string_width` already
 * has for a single line; every line is drawn exactly as split, unwrapped.
 * This is a real, useful implementation for the overwhelmingly common
 * real-world use (explicit `#`/`\n`-separated dialogue lines), not a
 * fabricated word-wrap.
 */
export declare function draw_text_ext(
  target: GmlDrawTarget | undefined,
  x: number,
  y: number,
  text: string | number,
  sep: number,
  _w: number,
): void;
/**
 * `draw_text_color(x, y, string, c1, c2, c3, c4, alpha)` — GameMaker's real
 * per-corner colour-gradient text variant (top-left/top-right/bottom-left/
 * bottom-right, manual.gamemaker.io's `draw_text_color` reference page).
 * `GmlDrawTarget` has no per-glyph/per-corner colour primitive (`text()`
 * draws in whatever colour `setColor()` last set), so this is an honest
 * approximation: set the draw colour to `c1` (the top-left corner colour —
 * GameMaker's own first argument, and the one real call sites overwhelmingly
 * set identically to the other three for a solid-colour string, which is
 * the common real case a 4-way gradient degrades to) and `alpha`, then draw
 * a single flat-coloured line — a real, visible, useful text draw, not a
 * fabricated gradient.
 */
export declare function draw_text_color(
  target: GmlDrawTarget | undefined,
  x: number,
  y: number,
  text: string | number,
  c1: number,
  _c2: number,
  _c3: number,
  _c4: number,
  alpha: number,
): void;
/**
 * `draw_roundrect_ext(x1, y1, x2, y2, rx, ry, outline)` — GameMaker's real
 * rounded-rectangle built-in. `GmlDrawTarget.rect()` draws a plain sharp-
 * cornered rectangle with no radius parameter, and adding a real rounded-
 * corner primitive to the shared draw-target interface is a genuinely
 * separate, larger change (every implementation, including any future
 * host, would need it) than this pass's scope. Honestly approximated as a
 * plain rectangle via the existing `rect()` — a real, visible shape at the
 * right position/size, just without rounded corners, rather than throwing
 * or silently no-opping.
 */
export declare function draw_roundrect_ext(
  target: GmlDrawTarget | undefined,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  _rx: number,
  _ry: number,
  outline: boolean,
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
export declare function draw_set_font(
  target: GmlDrawTarget,
  fontId: string,
): void;
export declare function draw_set_halign(
  target: GmlDrawTarget,
  align: number,
): void;
export declare function draw_set_valign(
  target: GmlDrawTarget,
  align: number,
): void;
export declare function draw_set_alpha(
  target: GmlDrawTarget,
  alpha: number,
): void;
/** See `GmlDrawTarget.spriteExt`'s own doc comment. `subimg` is honestly dropped for the same reason `draw_sprite`'s own `_subimg` parameter already is. */
export declare function draw_sprite_ext(
  target: GmlDrawTarget,
  texturePath: string,
  _subimg: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  rot: number,
  colour: number,
  alpha: number,
): void;
/** See `GmlDrawTarget.spritePart`'s own doc comment. `subimg` is honestly dropped, same as `draw_sprite`. */
export declare function draw_sprite_part(
  target: GmlDrawTarget,
  texturePath: string,
  _subimg: number,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
): void;
/** See `GmlDrawTarget.spritePartExt`'s own doc comment. `subimg` is honestly dropped, same as `draw_sprite`. */
export declare function draw_sprite_part_ext(
  target: GmlDrawTarget,
  texturePath: string,
  _subimg: number,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
  xscale: number,
  yscale: number,
  colour: number,
  alpha: number,
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
/** GML array_length — real GMS2.3+ name for array_length_1d. */
export declare function array_length(arr: unknown[]): number;
/** GML array_create(size, [value]) — a new array of `size` elements, each initialised to `value` (default 0). */
export declare function array_create(size: number, value?: unknown): unknown[];
/** GML array_resize(array, newSize) — grows (filling with 0) or truncates `array` in place. */
export declare function array_resize(arr: unknown[], newSize: number): void;
/** GML array_push(array, value, ...) — appends one or more values in place. */
export declare function array_push(arr: unknown[], ...values: unknown[]): void;
/** GML array_pop(array) — removes and returns the last element. */
export declare function array_pop(arr: unknown[]): unknown;
/** GML array_insert(array, index, value, ...) — inserts one or more values at `index`, shifting later elements up. */
export declare function array_insert(
  arr: unknown[],
  index: number,
  ...values: unknown[]
): void;
/** GML array_delete(array, index, [count]) — removes `count` (default 1) elements starting at `index`, in place. */
export declare function array_delete(
  arr: unknown[],
  index: number,
  count?: number,
): void;
/**
 * GML array_sort(array, order) — sorts `array` in place. `order` is either
 * a plain boolean (`true` ascending, `false` descending — GameMaker's own
 * default numeric/string comparison) or a comparator function, matching
 * `Array.prototype.sort`'s own `(a, b) => number` shape exactly.
 */
export declare function array_sort(
  arr: unknown[],
  order: boolean | ((a: unknown, b: unknown) => number),
): unknown[];
/** GML array_contains(array, value) — true if `value` is present (strict equality, matching GameMaker's own value comparison for primitives). */
export declare function array_contains(arr: unknown[], value: unknown): boolean;
/**
 * GML array_map(array, fn) — returns a new array with `fn(value, index)`
 * applied to every element. Never mutates `array`, matching GameMaker's own
 * "returns a modified copy" semantics.
 */
export declare function array_map(
  arr: unknown[],
  fn: (value: unknown, index: number) => unknown,
): unknown[];
/**
 * GML array_filter(array, fn) — returns a new array containing only the
 * elements for which `fn(value, index)` is truthy.
 */
export declare function array_filter(
  arr: unknown[],
  fn: (value: unknown, index: number) => boolean,
): unknown[];
/**
 * GML array_reduce(array, fn, [init]) — folds `array` down to a single
 * value via `fn(accumulator, value)`, seeded with `init` when given (GML's
 * own default seed, when omitted, is the array's first element).
 */
export declare function array_reduce(
  arr: unknown[],
  fn: (accumulator: unknown, value: unknown) => unknown,
  init?: unknown,
): unknown;
/** GML json_encode(value) — serialises a GML struct/array (a plain JS value here) to a JSON string. */
export declare function json_encode(value: unknown): string;
/** GML json_decode(str) — parses a JSON string back into a plain GML struct/array. */
export declare function json_decode(str: string): unknown;
/**
 * GML base64_encode(str) — encodes a plain string to base64. A dependency-
 * free implementation (no `Buffer`, no `btoa`) so it works identically in
 * Node, a browser, and a Tauri WebView.
 */
export declare function base64_encode(str: string): string;
/** GML base64_decode(str) — decodes a base64 string back to plain text. See `base64_encode`'s own doc comment for why this is a dependency-free implementation. */
export declare function base64_decode(str: string): string;
/**
 * GML font_get_size(fontId) — GameMaker's real per-font pixel size lookup.
 * Honestly unmodelled, the same class of gap `sprite_get_width`/
 * `sprite_get_height` already document above: this compat layer has no
 * general font-asset registry reachable from `compat/` at all (a GMS2
 * font's metadata is only ever baked onto this importer's own generated
 * `.font.ts` descriptor at import time, never stored anywhere addressable
 * by name/reference from here) — building one is a genuinely new import-
 * time feature, not a same-file fix. Returns `0` rather than a fabricated
 * plausible-looking size.
 */
export declare function font_get_size(_fontId: string): number;
/**
 * GML get_timer() — real GameMaker returns microseconds since the game
 * started. `Date.now()` (plain JS, available in Node/browser/Tauri alike —
 * no DOM/performance-API dependency) gives millisecond resolution; this
 * engine has no finer-grained clock reachable from inside the engine-
 * environment boundary, so microseconds are derived by multiplying by
 * 1000 — real elapsed time, honestly coarser resolution than GameMaker's
 * own, not a fabricated finer one.
 */
export declare function get_timer(): number;
/**
 * GML randomize() — reseeds GameMaker's RNG from a real random seed.
 * `Math.random()` has no seed API at all in standard JS, so this is an
 * honest no-op (every call site already gets fresh randomness from
 * `Math.random()`-backed `random()`/`irandom()` regardless) rather than a
 * fabricated seeding mechanism.
 */
export declare function randomize(): void;
/** GML point_in_circle(px, py, cx, cy, r) — real, pure point/circle containment test. */
export declare function point_in_circle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  r: number,
): boolean;
/** GML is_string(value) — real runtime type check. */
export declare function is_string(value: unknown): boolean;
/** GML is_undefined(value) — real runtime type check (GameMaker's own `undefined` maps onto JS's). */
export declare function is_undefined(value: unknown): boolean;
/**
 * GML gamespeed_fps — one of GameMaker's two real `game_set_speed`
 * unit-mode constants (manual.gamemaker.io's `game_set_speed` reference
 * page): `gamespeed_fps = 0` (frames per second — the default and by far
 * the common real usage), `gamespeed_microseconds = 1`.
 */
export declare const gamespeed_fps = 0;
export declare const gamespeed_microseconds = 1;
/**
 * GML game_set_speed(speed, type) — real GameMaker retargets the whole
 * game loop's frame rate. This engine's game loop is driven by the host's
 * `requestAnimationFrame` (or the headless test harness's own fixed-step
 * driver), with no per-`Game` "target FPS" knob exposed to compat code —
 * changing it would mean reaching into host-owned loop-timing code from
 * inside `compat/`, which this file has no reference to. An honest no-op,
 * not a fabricated retarget, the same shape `randomize()` above uses for a
 * different unimplementable-from-here GameMaker built-in.
 */
export declare function game_set_speed(_speed: number, _type: number): void;
/**
 * GML cr_none/cr_default — two of GameMaker's real named cursor constants
 * (manual.gamemaker.io's `window_set_cursor` reference page; the full
 * enum's legacy numeric encoding traces back to GameMaker 8's documented
 * negative-integer cursor IDs). `window_set_cursor`/`window_get_cursor`
 * below store whichever value is passed with no real OS cursor change
 * behind it (this engine has no OS-cursor API reachable from inside the
 * engine-environment boundary — the same class of gap `application_surface`
 * already documents for a different platform capability), so these two
 * constants exist so an equality check like
 * `if (window_get_cursor() == cr_none)` in real GML source still resolves
 * to *some* real, stored value rather than an undeclared identifier — the
 * exact numeric value matters far less than that a round trip through
 * `window_set_cursor`/`window_get_cursor` is internally consistent, which
 * it is regardless of which two integers these are.
 */
export declare const cr_default = -1;
export declare const cr_none = 0;
/** GML window_set_cursor(cursor) — stores the requested cursor; see `cr_none`'s own doc comment for why no real OS cursor changes. */
export declare function window_set_cursor(cursor: number): void;
/** GML window_get_cursor() — reads back whatever `window_set_cursor` last stored. */
export declare function window_get_cursor(): number;
/**
 * GML working_directory — GameMaker's real read-only build-time filesystem
 * path (the executable's own directory). `@emptysock/engine` must not
 * import `fs`/Node/Tauri filesystem APIs at all (see "Engine environment
 * boundary" above — the same compiled bundle runs in Node, a browser
 * preview iframe, and a Tauri WebView, and only the last of those has any
 * real filesystem to report), so there is no real path this file could
 * honestly return. `""` — an empty, honestly-empty path, rather than a
 * fabricated one — matching this file's other "no reachable resource"
 * defaults (`font_get_size`'s `0`, `sprite_get_width`'s `0`).
 */
export declare const working_directory = "";

// gml.ts — GML compatibility shim
// Maps ~50 of the most-used GameMaker Language built-in functions to JS/EmptySock
// equivalents so GMS2-migrated code can compile with minimal changes.
// No DOM, Tauri, or apps/ide imports.

// ---------------------------------------------------------------------------
// Room size (configurable)
// ---------------------------------------------------------------------------

let _roomWidth = 1280;
let _roomHeight = 720;

export function setRoomSize(w: number, h: number): void {
  _roomWidth = w;
  _roomHeight = h;
}

export function room_width(): number {
  return _roomWidth;
}

export function room_height(): number {
  return _roomHeight;
}

// ---------------------------------------------------------------------------
// Colour constants — GameMaker's real, fixed 19-constant named-colour
// palette (manual.gamemaker.io's "Colour And Alpha" reference page; values
// confirmed against the standard web-safe 16-colour palette GameMaker's own
// constants reuse, plus c_orange). GameMaker's own internal representation
// is $BBGGRR (confirmed: c_red is documented as $0000FF, blue-green-red
// order), but every consumer in this engine — Sprite.tint, canvas
// fillStyle, draw_set_colour's GmlDrawTarget — wants a plain 0xRRGGBB
// value, so these are declared directly as their real RGB integer rather
// than round-tripping through GameMaker's own BGR storage order. Confirmed
// a real, common gap: Freedom Backup alone uses c_white/c_black/c_gray
// roughly 48 times across 20 files, previously left as bare, undeclared
// identifiers (a hard ReferenceError at runtime) since nothing in this
// engine or its transpiler recognised GML's colour-constant family at all.
// ---------------------------------------------------------------------------

export const c_aqua = 0x00ffff;
export const c_black = 0x000000;
export const c_blue = 0x0000ff;
export const c_dkgray = 0x404040;
export const c_fuchsia = 0xff00ff;
export const c_gray = 0x808080;
export const c_green = 0x008000;
export const c_lime = 0x00ff00;
export const c_ltgray = 0xc0c0c0;
export const c_maroon = 0x800000;
export const c_navy = 0x000080;
export const c_olive = 0x808000;
export const c_orange = 0xffa500;
export const c_purple = 0x800080;
export const c_red = 0xff0000;
export const c_silver = 0xc0c0c0;
export const c_teal = 0x008080;
export const c_white = 0xffffff;
export const c_yellow = 0xffff00;

// ---------------------------------------------------------------------------
// Math functions
// ---------------------------------------------------------------------------

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function sign(val: number): number {
  return Math.sign(val);
}

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
export function max(...vals: number[]): number {
  return Math.max(...vals);
}

export function min(...vals: number[]): number {
  return Math.min(...vals);
}

export function abs(val: number): number {
  return Math.abs(val);
}

/** `ord(str)` — GameMaker's own idiom for turning a single character into its numeric code point (`ord("D")` == 68), the same legacy `KeyboardEvent.keyCode`-compatible numbering `vk_*`'s letter range already uses. Also exported (identically) from `compat/gmlInput.ts`, since real source uses it both standalone (`ord("R")` as a plain char code) and as a `keyboard_check`/`keyboard_check_pressed` argument — kept as two small, trivially-in-sync one-liners rather than an awkward cross-file import for a single-expression function, the same "duplicated because trivial and the alternative is worse" precedent `gmlKeys.ts`'s own doc comment already accepts for its `VK_NAMES` table. */
export function ord(str: string): number {
  return str.length > 0 ? (str.codePointAt(0) ?? 0) : 0;
}

/** Fractional part (GML frac) */
export function frac(val: number): number {
  return val - Math.trunc(val);
}

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
export function sin(val: number): number {
  return Math.sin(val);
}

export function cos(val: number): number {
  return Math.cos(val);
}

export function tan(val: number): number {
  return Math.tan(val);
}

export function sqrt(val: number): number {
  return Math.sqrt(val);
}

/** GML `power(base, exponent)` — a plain wrapper over `Math.pow`/`**`. */
export function power(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

/** x component of a vector given length and direction (degrees) */
export function lengthdir_x(length: number, direction: number): number {
  return length * Math.cos((direction * Math.PI) / 180);
}

/** y component of a vector given length and direction (degrees, GML y-down) */
export function lengthdir_y(length: number, direction: number): number {
  return length * Math.sin((direction * Math.PI) / 180);
}

export function point_distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Direction in degrees from (x1,y1) to (x2,y2), GML convention (right=0, CCW) */
export function point_direction(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return (Math.atan2(-(y2 - y1), x2 - x1) * 180) / Math.PI;
}

export function degtorad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radtodeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Random integer 0..max-1 */
export function irandom(max: number): number {
  return Math.floor(Math.random() * max);
}

/** Random integer in [lo, hi] */
export function irandom_range(lo: number, hi: number): number {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Random float [0, max) */
export function random(max: number): number {
  return Math.random() * max;
}

/** Random float [lo, hi) */
export function random_range(lo: number, hi: number): number {
  return Math.random() * (hi - lo) + lo;
}

/** Pick a random argument */
export function choose<T>(...args: T[]): T {
  return args[Math.floor(Math.random() * args.length)] as T;
}

// ---------------------------------------------------------------------------
// String functions
// ---------------------------------------------------------------------------

/** GML string() — convert to string */
export function string(val: unknown): string {
  return String(val);
}

export function string_length(str: string): number {
  return str.length;
}

/** GML string_copy(str, index, count) — 1-based index */
export function string_copy(str: string, index: number, count: number): string {
  return str.substring(index - 1, index - 1 + count);
}

/** GML string_pos(needle, haystack) — 1-based, 0 if not found */
export function string_pos(needle: string, haystack: string): number {
  const idx = haystack.indexOf(needle);
  return idx === -1 ? 0 : idx + 1;
}

export function string_lower(str: string): string {
  return str.toLowerCase();
}

export function string_upper(str: string): string {
  return str.toUpperCase();
}

export function string_repeat(str: string, count: number): string {
  return str.repeat(count);
}

/**
 * `string_width`/`string_height` — GameMaker's real functions measure the
 * pixel dimensions `str` would render at using the *currently-set* draw
 * font, via GameMaker's own font-rendering engine. This engine has no font-
 * metrics API reachable from `compat/` at all — real glyph measurement
 * lives inside PixiJS's `Text`/`CanvasTextMetrics`, which only `RenderPipeline`
 * (a pixi-wrapping file, outside the engine-environment boundary these
 * `compat/` files must stay inside) can touch, and even that is only live
 * during an actual `onDraw`/`onDrawGui` dispatch (`ctx.drawTarget`) — real,
 * confirmed usage (`obj_text/Step_0.gml`'s `h = string_height(text);`) calls
 * this from *outside* a draw dispatch entirely, where no live drawing
 * surface exists to measure against at all.
 *
 * Both functions honestly approximate instead of returning `0`/throwing: a
 * fixed average-glyph-width/line-height ratio against `GML_APPROX_FONT_SIZE`
 * (GameMaker's own default font size when nothing else is known) — close
 * enough for the actual real use this project makes of them (padding/layout
 * math around a text box, never pixel-perfect glyph placement), but a real,
 * honest approximation, not a measurement — a project relying on precise
 * text metrics for a specific custom font will see a different real number
 * than GameMaker's own renderer would report.
 */
const GML_APPROX_FONT_SIZE = 16;
const GML_APPROX_CHAR_WIDTH_RATIO = 0.55;
const GML_APPROX_LINE_HEIGHT_RATIO = 1.2;

export function string_width(str: string): number {
  const longestLine = str
    .split("\n")
    .reduce((max, line) => Math.max(max, line.length), 0);
  return Math.round(
    longestLine * GML_APPROX_FONT_SIZE * GML_APPROX_CHAR_WIDTH_RATIO,
  );
}

export function string_height(str: string): number {
  const lineCount = Math.max(1, str.split("\n").length);
  return Math.round(
    lineCount * GML_APPROX_FONT_SIZE * GML_APPROX_LINE_HEIGHT_RATIO,
  );
}

/** GML string_delete(str, index, count) — 1-based index */
export function string_delete(
  str: string,
  index: number,
  count: number,
): string {
  return str.substring(0, index - 1) + str.substring(index - 1 + count);
}

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
export function string_insert(
  substr: string,
  str: string,
  index: number,
): string {
  const at = Math.max(0, index - 1);
  return str.substring(0, at) + substr + str.substring(at);
}

// ---------------------------------------------------------------------------
// ds_map stubs (backed by JS Map)
// ---------------------------------------------------------------------------

const _maps = new Map<number, Map<unknown, unknown>>();
let _mapNextId = 0;

export function ds_map_create(): number {
  const id = _mapNextId++;
  _maps.set(id, new Map());
  return id;
}

export function ds_map_destroy(id: number): void {
  _maps.delete(id);
}

export function ds_map_set(id: number, key: unknown, value: unknown): void {
  _maps.get(id)?.set(key, value);
}

export function ds_map_find_value(id: number, key: unknown): unknown {
  return _maps.get(id)?.get(key) ?? undefined;
}

export function ds_map_exists(id: number, key: unknown): boolean {
  return _maps.get(id)?.has(key) ?? false;
}

export function ds_map_delete(id: number, key: unknown): void {
  _maps.get(id)?.delete(key);
}

// ---------------------------------------------------------------------------
// ds_list stubs (backed by JS Array)
// ---------------------------------------------------------------------------

const _lists = new Map<number, unknown[]>();
let _listNextId = 0;

export function ds_list_create(): number {
  const id = _listNextId++;
  _lists.set(id, []);
  return id;
}

export function ds_list_destroy(id: number): void {
  _lists.delete(id);
}

export function ds_list_add(id: number, value: unknown): void {
  _lists.get(id)?.push(value);
}

export function ds_list_find_value(id: number, pos: number): unknown {
  return _lists.get(id)?.[pos] ?? undefined;
}

export function ds_list_size(id: number): number {
  return _lists.get(id)?.length ?? 0;
}

/** GML ds_list_delete(id, pos) — removes the element at position */
export function ds_list_delete(id: number, pos: number): void {
  _lists.get(id)?.splice(pos, 1);
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// draw_* wrappers — map GML draw calls to a structural drawing surface
// ---------------------------------------------------------------------------

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
export const fa_left = 0;
export const fa_center = 1;
export const fa_right = 2;
export const fa_top = 0;
export const fa_middle = 1;
export const fa_bottom = 2;

export function draw_set_colour(target: GmlDrawTarget, hex: number): void {
  target.setColor(hex);
}

/** `draw_set_color` — GameMaker accepts both the British `draw_set_colour` and this American-spelling alias for the exact same function (confirmed against GameMaker's own manual, which lists both names on the same reference page); real GML source uses either spelling interchangeably (Freedom Backup's own source uses `draw_set_color`). A plain re-export, not a second implementation, so the two spellings can never drift apart. */
export const draw_set_color = draw_set_colour;

export function draw_rectangle(
  target: GmlDrawTarget,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outline: boolean,
): void {
  target.rect(x1, y1, x2, y2, outline);
}

export function draw_circle(
  target: GmlDrawTarget,
  x: number,
  y: number,
  r: number,
  outline: boolean,
): void {
  target.circle(x, y, r, outline);
}

// `text` is typed `string | number`, not just `string` — GameMaker's real
// `draw_text` accepts a bare number and implicitly stringifies it (a real,
// extremely common idiom: `draw_text(x, y, score);`/`draw_text(x, y,
// hp);`, confirmed real, common usage across Freedom Backup's own
// `obj_menu`/`obj_pause_menu`/`obj_ending`/`obj_display_manager`/
// `obj_camera`). `String(text)` matches that same implicit conversion.
export function draw_text(
  target: GmlDrawTarget,
  x: number,
  y: number,
  text: string | number,
): void {
  target.text(x, y, String(text));
}

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
export function draw_text_ext(
  target: GmlDrawTarget | undefined,
  x: number,
  y: number,
  text: string | number,
  sep: number,
  _w: number,
): void {
  if (target === undefined) return;
  const lineHeight = sep === -1 ? 16 : sep;
  const lines = String(text).split(/\r?\n|#/);
  for (let i = 0; i < lines.length; i++) {
    target.text(x, y + i * lineHeight, lines[i] ?? "");
  }
}

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
export function draw_text_color(
  target: GmlDrawTarget | undefined,
  x: number,
  y: number,
  text: string | number,
  c1: number,
  _c2: number,
  _c3: number,
  _c4: number,
  alpha: number,
): void {
  if (target === undefined) return;
  target.setColor(c1);
  target.setAlpha?.(alpha);
  target.text(x, y, String(text));
}

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
export function draw_roundrect_ext(
  target: GmlDrawTarget | undefined,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  _rx: number,
  _ry: number,
  outline: boolean,
): void {
  if (target === undefined) return;
  target.rect(x1, y1, x2, y2, outline);
}

/**
 * `draw_sprite(sprite, subimg, x, y)` — GameMaker's own argument order has
 * `subimg` between the sprite reference and the position, but `subimg` is
 * honestly not modelled (see `GmlDrawTarget.sprite`'s own doc comment), so
 * it's accepted here purely to keep a real call site's argument count and
 * position intact — it's never read.
 */
export function draw_sprite(
  target: GmlDrawTarget,
  texturePath: string,
  _subimg: number,
  x: number,
  y: number,
): void {
  target.sprite(texturePath, x, y);
}

export function draw_line(
  target: GmlDrawTarget,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  target.line(x1, y1, x2, y2);
}

export function draw_set_font(target: GmlDrawTarget, fontId: string): void {
  target.setFont?.(fontId);
}

export function draw_set_halign(target: GmlDrawTarget, align: number): void {
  target.setHalign?.(align);
}

export function draw_set_valign(target: GmlDrawTarget, align: number): void {
  target.setValign?.(align);
}

export function draw_set_alpha(target: GmlDrawTarget, alpha: number): void {
  target.setAlpha?.(alpha);
}

/** See `GmlDrawTarget.spriteExt`'s own doc comment. `subimg` is honestly dropped for the same reason `draw_sprite`'s own `_subimg` parameter already is. */
export function draw_sprite_ext(
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
): void {
  target.spriteExt?.(texturePath, x, y, xscale, yscale, rot, colour, alpha);
}

/** See `GmlDrawTarget.spritePart`'s own doc comment. `subimg` is honestly dropped, same as `draw_sprite`. */
export function draw_sprite_part(
  target: GmlDrawTarget,
  texturePath: string,
  _subimg: number,
  left: number,
  top: number,
  width: number,
  height: number,
  x: number,
  y: number,
): void {
  target.spritePart?.(texturePath, left, top, width, height, x, y);
}

/** See `GmlDrawTarget.spritePartExt`'s own doc comment. `subimg` is honestly dropped, same as `draw_sprite`. */
export function draw_sprite_part_ext(
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
): void {
  target.spritePartExt?.(
    texturePath,
    left,
    top,
    width,
    height,
    x,
    y,
    xscale,
    yscale,
    colour,
    alpha,
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** GML show_message — browser-safe: console.log instead of a blocking dialog */
export function show_message(msg: string): void {
  console.log(msg);
}

/** GML game_end — no-op in EmptySock; close/stop your scene manually */
export function game_end(): void {
  console.warn(
    "game_end() called — this is a no-op in EmptySock. Stop or destroy your scene instead.",
  );
}

// ---------------------------------------------------------------------------
// Builtins found when importing a real GMS2 project (J3 Adventure fixture)
// that were missing from the original ~50-function map.
// ---------------------------------------------------------------------------

/** GML object_exists — checks whether an object asset name/index is valid. */
export function object_exists(_objectName: string): boolean {
  console.warn(
    "object_exists() is a no-op stub — resolve object existence via your own registry.",
  );
  return true;
}

/** GML asset_get_index — resolves an asset name to an index. No-op stub: EmptySock references assets by name/path directly. */
export function asset_get_index(name: string): string {
  return name;
}

/** GML array_length_1d — length of a 1D array (JS arrays are always 1D). */
export function array_length_1d(arr: unknown[]): number {
  return arr.length;
}

/** GML string_char_at — 1-based index. */
export function string_char_at(str: string, index: number): string {
  return str.charAt(index - 1);
}

/** GML keyboard_wait — blocks until a key is pressed. No-op stub: use onKeyPress instead. */
export function keyboard_wait(): void {
  console.warn(
    "keyboard_wait() is a no-op stub — GameMaker's blocking wait has no EmptySock equivalent. Use onKeyPress instead.",
  );
}

/** GML mouse_button_down (legacy GM8-style action) — no-op stub; use InputSystem. */
export function mouse_button_down(_button: number): boolean {
  console.warn(
    "mouse_button_down() is a no-op stub — use the engine's InputSystem instead.",
  );
  return false;
}

/** GML mouse_button_released (legacy GM8-style action) — no-op stub; use InputSystem. */
export function mouse_button_released(_button: number): boolean {
  console.warn(
    "mouse_button_released() is a no-op stub — use the engine's InputSystem instead.",
  );
  return false;
}

/**
 * GML `place_empty(x, y)` — legacy collision-check action; kept as a no-op
 * stub. Note this is distinct from `place_free`, which is now real (see
 * `compat/gmlCollisionQueries.ts`'s `place_free` — GameMaker's own
 * `place_free`, checked against `solid`-flagged instances). `place_empty` is
 * an older, less-common GM8-era alias with slightly different semantics
 * (checks against every instance, not just solid ones) that hasn't been
 * ported yet — a real, separate, tracked gap.
 */
export function place_empty(_x: number, _y: number): boolean {
  console.warn(
    "place_empty() is a no-op stub — implement collision checks via PhysicsSystem or manual bounds checks.",
  );
  return true;
}

// ---------------------------------------------------------------------------
// GMS2.3+ array function family (`array_push`/`array_pop`/`array_insert`/
// `array_delete`/`array_sort`/`array_map`/`array_filter`/`array_reduce`/
// `array_contains`/`array_length`/`array_create`/`array_resize`) — a real,
// confirmed, high-value gap (see CLAUDE.md's "Broader GML 2.3+ function
// coverage" entry): GMS2.3 array literals/struct literals/`static`
// declarations are mostly already-valid JS syntax that passes through this
// transpiler unchanged, but GameMaker's *array function calls* are real
// GML identifiers with no JS equivalent to fall back on, and array
// manipulation via these functions is extremely common in modern GML.
//
// GameMaker's own arrays are always plain, dense, dynamically-growable
// lists — exactly what a native JS `Array` already is — so every one of
// these is a thin, honest wrapper over the matching native `Array` method,
// not a reimplementation. `array_push`/`array_pop` mutate and return
// GameMaker's own "no return value"/"the popped value" shapes; the
// mutating ones that GameMaker documents as void (`array_push`,
// `array_insert`, `array_delete`, `array_resize`) are kept `void` here too,
// since transpiled GML never uses their return value.
//
// `array_map`/`array_filter`/`array_reduce`'s callback argument order is
// confirmed against GameMaker's own manual: the callback receives
// `(value, index)` for map/filter — the same order `Array.prototype.map`/
// `.filter` already pass to a callback, so no argument reordering is
// needed — and `(accumulator, value)` for reduce, matching
// `Array.prototype.reduce`'s own `(accumulator, value)` order too.

/** GML array_length — real GMS2.3+ name for array_length_1d. */
export function array_length(arr: unknown[]): number {
  return arr.length;
}

/** GML array_create(size, [value]) — a new array of `size` elements, each initialised to `value` (default 0). */
export function array_create(size: number, value: unknown = 0): unknown[] {
  return new Array(size).fill(value);
}

/** GML array_resize(array, newSize) — grows (filling with 0) or truncates `array` in place. */
export function array_resize(arr: unknown[], newSize: number): void {
  if (newSize < arr.length) {
    arr.length = newSize;
  } else {
    while (arr.length < newSize) arr.push(0);
  }
}

/** GML array_push(array, value, ...) — appends one or more values in place. */
export function array_push(arr: unknown[], ...values: unknown[]): void {
  arr.push(...values);
}

/** GML array_pop(array) — removes and returns the last element. */
export function array_pop(arr: unknown[]): unknown {
  return arr.pop();
}

/** GML array_insert(array, index, value, ...) — inserts one or more values at `index`, shifting later elements up. */
export function array_insert(
  arr: unknown[],
  index: number,
  ...values: unknown[]
): void {
  arr.splice(index, 0, ...values);
}

/** GML array_delete(array, index, [count]) — removes `count` (default 1) elements starting at `index`, in place. */
export function array_delete(arr: unknown[], index: number, count = 1): void {
  arr.splice(index, count);
}

/**
 * GML array_sort(array, order) — sorts `array` in place. `order` is either
 * a plain boolean (`true` ascending, `false` descending — GameMaker's own
 * default numeric/string comparison) or a comparator function, matching
 * `Array.prototype.sort`'s own `(a, b) => number` shape exactly.
 */
export function array_sort(
  arr: unknown[],
  order: boolean | ((a: unknown, b: unknown) => number),
): unknown[] {
  if (typeof order === "function") {
    arr.sort(order);
    return arr;
  }
  arr.sort((a, b) => {
    if (a === b) return 0;
    const ascending = order !== false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lt = (a as any) < (b as any);
    return lt === ascending ? -1 : 1;
  });
  return arr;
}

/** GML array_contains(array, value) — true if `value` is present (strict equality, matching GameMaker's own value comparison for primitives). */
export function array_contains(arr: unknown[], value: unknown): boolean {
  return arr.includes(value);
}

/**
 * GML array_map(array, fn) — returns a new array with `fn(value, index)`
 * applied to every element. Never mutates `array`, matching GameMaker's own
 * "returns a modified copy" semantics.
 */
export function array_map(
  arr: unknown[],
  fn: (value: unknown, index: number) => unknown,
): unknown[] {
  return arr.map((value, index) => fn(value, index));
}

/**
 * GML array_filter(array, fn) — returns a new array containing only the
 * elements for which `fn(value, index)` is truthy.
 */
export function array_filter(
  arr: unknown[],
  fn: (value: unknown, index: number) => boolean,
): unknown[] {
  return arr.filter((value, index) => fn(value, index));
}

/**
 * GML array_reduce(array, fn, [init]) — folds `array` down to a single
 * value via `fn(accumulator, value)`, seeded with `init` when given (GML's
 * own default seed, when omitted, is the array's first element).
 */
export function array_reduce(
  arr: unknown[],
  fn: (accumulator: unknown, value: unknown) => unknown,
  init?: unknown,
): unknown {
  if (arguments.length >= 3) {
    return arr.reduce((accumulator, value) => fn(accumulator, value), init);
  }
  return arr.reduce((accumulator, value) => fn(accumulator, value));
}

// ---------------------------------------------------------------------------
// JSON / base64 — GameMaker's real, common save-data encoding pair
// (manual.gamemaker.io's `json_encode`/`json_decode`/`base64_encode`/
// `base64_decode` reference pages), confirmed real, common usage: Freedom
// Backup's own `scr_save_game.gml`/`scr_load_game.gml` chain exactly
// `json_encode(...)` into `base64_encode(...)` to write a save file, and
// the reverse to read one back. Real GameMaker's `json_encode`/`_decode`
// round-trip a GML struct/array through JSON — `JSON.stringify`/`JSON.parse`
// are the exact same operation for a plain data struct, no translation
// needed (a GML struct literal is already valid JS-object-literal shape,
// per the "GMS2.3+ struct/function literal syntax" entry above). GameMaker's
// `base64_encode`/`_decode` round-trip a plain string through base64 — this
// engine's `packages/engine` may run in Node, a browser, or a Tauri WebView
// (see "Engine environment boundary" above), so this cannot use Node's
// `Buffer` (Node-only) or the DOM's `btoa`/`atob` (browser-only,
// unavailable in headless Node/Vitest) — a plain, dependency-free base64
// codec is implemented here instead, so it behaves identically in all three
// contexts.
// ---------------------------------------------------------------------------

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** GML json_encode(value) — serialises a GML struct/array (a plain JS value here) to a JSON string. */
export function json_encode(value: unknown): string {
  return JSON.stringify(value);
}

/** GML json_decode(str) — parses a JSON string back into a plain GML struct/array. */
export function json_decode(str: string): unknown {
  return JSON.parse(str);
}

/**
 * GML base64_encode(str) — encodes a plain string to base64. A dependency-
 * free implementation (no `Buffer`, no `btoa`) so it works identically in
 * Node, a browser, and a Tauri WebView.
 */
export function base64_encode(str: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : undefined;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : undefined;
    out += BASE64_CHARS[b0 >> 2];
    out += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 !== undefined ? b1 >> 4 : 0)];
    out +=
      b1 !== undefined
        ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 !== undefined ? b2 >> 6 : 0)]
        : "=";
    out += b2 !== undefined ? BASE64_CHARS[b2 & 0x3f] : "=";
  }
  return out;
}

/** GML base64_decode(str) — decodes a base64 string back to plain text. See `base64_encode`'s own doc comment for why this is a dependency-free implementation. */
export function base64_decode(str: string): string {
  const clean = str.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i] ?? "A");
    const c1 = BASE64_CHARS.indexOf(clean[i + 1] ?? "A");
    const c2 =
      clean[i + 2] !== undefined
        ? BASE64_CHARS.indexOf(clean[i + 2] ?? "A")
        : -1;
    const c3 =
      clean[i + 3] !== undefined
        ? BASE64_CHARS.indexOf(clean[i + 3] ?? "A")
        : -1;
    bytes.push(((c0 << 2) | (c1 >> 4)) & 0xff);
    if (c2 >= 0) bytes.push((((c1 & 0x0f) << 4) | (c2 >> 2)) & 0xff);
    if (c3 >= 0) bytes.push((((c2 & 0x03) << 6) | c3) & 0xff);
  }
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

// ---------------------------------------------------------------------------
// Misc built-ins — a second real triage pass, each individually low-
// frequency in Freedom Backup but real, confirmed usage.
// ---------------------------------------------------------------------------

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
export function font_get_size(_fontId: string): number {
  return 0;
}

const _gmlStart = Date.now();

/**
 * GML get_timer() — real GameMaker returns microseconds since the game
 * started. `Date.now()` (plain JS, available in Node/browser/Tauri alike —
 * no DOM/performance-API dependency) gives millisecond resolution; this
 * engine has no finer-grained clock reachable from inside the engine-
 * environment boundary, so microseconds are derived by multiplying by
 * 1000 — real elapsed time, honestly coarser resolution than GameMaker's
 * own, not a fabricated finer one.
 */
export function get_timer(): number {
  return (Date.now() - _gmlStart) * 1000;
}

/**
 * GML randomize() — reseeds GameMaker's RNG from a real random seed.
 * `Math.random()` has no seed API at all in standard JS, so this is an
 * honest no-op (every call site already gets fresh randomness from
 * `Math.random()`-backed `random()`/`irandom()` regardless) rather than a
 * fabricated seeding mechanism.
 */
export function randomize(): void {
  // Intentional no-op — see doc comment.
}

/** GML point_in_circle(px, py, cx, cy, r) — real, pure point/circle containment test. */
export function point_in_circle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/** GML is_string(value) — real runtime type check. */
export function is_string(value: unknown): boolean {
  return typeof value === "string";
}

/** GML is_undefined(value) — real runtime type check (GameMaker's own `undefined` maps onto JS's). */
export function is_undefined(value: unknown): boolean {
  return value === undefined;
}

/**
 * GML gamespeed_fps — one of GameMaker's two real `game_set_speed`
 * unit-mode constants (manual.gamemaker.io's `game_set_speed` reference
 * page): `gamespeed_fps = 0` (frames per second — the default and by far
 * the common real usage), `gamespeed_microseconds = 1`.
 */
export const gamespeed_fps = 0;
export const gamespeed_microseconds = 1;

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
export function game_set_speed(_speed: number, _type: number): void {
  // Intentional no-op — see doc comment.
}

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
export const cr_default = -1;
export const cr_none = 0;

let _gmlCursor: number = cr_default;

/** GML window_set_cursor(cursor) — stores the requested cursor; see `cr_none`'s own doc comment for why no real OS cursor changes. */
export function window_set_cursor(cursor: number): void {
  _gmlCursor = cursor;
}

/** GML window_get_cursor() — reads back whatever `window_set_cursor` last stored. */
export function window_get_cursor(): number {
  return _gmlCursor;
}

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
export const working_directory = "";

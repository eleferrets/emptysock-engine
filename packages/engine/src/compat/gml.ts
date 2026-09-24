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

/** Fractional part (GML frac) */
export function frac(val: number): number {
  return val - Math.trunc(val);
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

/** GML string_delete(str, index, count) — 1-based index */
export function string_delete(
  str: string,
  index: number,
  count: number,
): string {
  return str.substring(0, index - 1) + str.substring(index - 1 + count);
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
}

export function draw_set_colour(target: GmlDrawTarget, hex: number): void {
  target.setColor(hex);
}

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

export function draw_text(
  target: GmlDrawTarget,
  x: number,
  y: number,
  text: string,
): void {
  target.text(x, y, text);
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

/** GML place_free(x, y) — legacy collision-check action. No-op stub: always reports free. */
export function place_free(_x: number, _y: number): boolean {
  console.warn(
    "place_free() is a no-op stub — implement collision checks via PhysicsSystem or manual bounds checks.",
  );
  return true;
}

/** GML place_empty(x, y) — legacy collision-check action. No-op stub: always reports empty. */
export function place_empty(_x: number, _y: number): boolean {
  console.warn(
    "place_empty() is a no-op stub — implement collision checks via PhysicsSystem or manual bounds checks.",
  );
  return true;
}

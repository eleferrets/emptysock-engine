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
// draw_* wrappers — map GML draw calls to Canvas 2D operations
// ---------------------------------------------------------------------------

export function draw_set_colour(
  ctx: CanvasRenderingContext2D,
  hex: number,
): void {
  ctx.fillStyle = `#${hex.toString(16).padStart(6, "0")}`;
  ctx.strokeStyle = ctx.fillStyle;
}

export function draw_rectangle(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outline: boolean,
): void {
  if (outline) ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  else ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
}

export function draw_circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  outline: boolean,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (outline) ctx.stroke();
  else ctx.fill();
}

export function draw_text(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
): void {
  ctx.fillText(text, x, y);
}

export function draw_line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
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

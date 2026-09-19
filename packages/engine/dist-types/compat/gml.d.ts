export declare function setRoomSize(w: number, h: number): void;
export declare function room_width(): number;
export declare function room_height(): number;
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
export declare function draw_set_colour(
  ctx: CanvasRenderingContext2D,
  hex: number,
): void;
export declare function draw_rectangle(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outline: boolean,
): void;
export declare function draw_circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  outline: boolean,
): void;
export declare function draw_text(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
): void;
export declare function draw_line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void;
/** GML show_message — browser-safe: console.log instead of a blocking dialog */
export declare function show_message(msg: string): void;
/** GML game_end — no-op in EmptySock; close/stop your scene manually */
export declare function game_end(): void;

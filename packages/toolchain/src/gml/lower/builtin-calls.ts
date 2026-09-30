/**
 * Built-in calls whose lowering is not a plain threaded compat call: inline
 * JavaScript equivalents (math, strings, `ds_*` containers, struct access)
 * and draw calls that go straight to `_ctx.drawTarget`. Calls with a compat
 * implementation and a uniform signature are lowered generically from the
 * built-in table (`builtins.ts` threading and asset parameters) instead.
 *
 * Every lowering receives already-emitted arguments and returns a `Piece`
 * with the precedence of its outermost operator, so the caller can
 * parenthesise it; arguments are embedded with the precedence they need.
 */

import type { AssetKind } from "../symbols.js";
import { PREC, type Piece, type ValueMode } from "../emit/types.js";

/** One call site as the lowering table sees it. */
export interface CallSite {
  readonly argc: number;
  /** Argument `i` emitted at precedence `prec` or tighter (`""` when absent). */
  arg(i: number, prec?: number, mode?: ValueMode): string;
  /** Arguments from `from` on, each emitted at assignment level. */
  rest(from: number, mode?: ValueMode): string[];
  /** Argument `i` as an asset literal when it names an asset of `kind`, else emitted as a value. */
  asset(i: number, kind: AssetKind): string;
  /** Argument `i` as an array (`GmlActions.gmlArr` unless it is already a local array). */
  array(i: number): string;
  /** Argument `i` as a `Map` (`GmlActions.gmlMap` unless it is a local). */
  map(i: number): string;
}

export type CallLowering = (c: CallSite) => Piece;

const call = (code: string): Piece => ({ code, prec: PREC.call });
const atom = (code: string): Piece => ({ code, prec: PREC.atom });

function drawTarget(method: string, argc: number): CallLowering {
  return (c) =>
    call(
      `_ctx.drawTarget?.${method}(${Array.from({ length: argc }, (_, i) => c.arg(i)).join(", ")})`,
    );
}

function drawTargetOptional(method: string): CallLowering {
  return (c) => call(`_ctx.drawTarget?.${method}?.(${c.arg(0)})`);
}

/** `draw_ellipse`-style compat draws that need a live draw target. */
function guardedDraw(fn: string): CallLowering {
  return (c) =>
    atom(
      `(_ctx.drawTarget && GmlActions.${fn}(_ctx.drawTarget, ${c.rest(0).join(", ")}))`,
    );
}

function targetDraw(fn: string): CallLowering {
  return (c) =>
    call(`GmlActions.${fn}(_ctx.drawTarget, ${c.rest(0).join(", ")})`);
}

/** A sprite draw: the sprite argument becomes a texture path, `subimg` (arg 1) is dropped. */
function spriteDraw(
  method: string,
  argIndices: readonly number[],
): CallLowering {
  return (c) =>
    call(
      `_ctx.drawTarget?.${method}(${[c.asset(0, "sprite"), ...argIndices.map((i) => c.arg(i))].join(", ")})`,
    );
}

const mathCall =
  (fn: string): CallLowering =>
  (c) =>
    call(`Math.${fn}(${c.rest(0).join(", ")})`);

const gc = "undefined /* GML data structures are garbage collected */";

const TABLE: ReadonlyMap<string, CallLowering> = new Map<string, CallLowering>([
  // -- math and strings ---------------------------------------------------
  ["abs", mathCall("abs")],
  ["floor", mathCall("floor")],
  ["ceil", mathCall("ceil")],
  ["round", mathCall("round")],
  ["sqrt", mathCall("sqrt")],
  ["power", (c) => call(`Math.pow(${c.arg(0)}, ${c.arg(1)})`)],
  [
    "clamp",
    (c) => call(`Math.min(Math.max(${c.arg(0)}, ${c.arg(1)}), ${c.arg(2)})`),
  ],
  [
    "random",
    (c) => ({
      code: `Math.random() * ${c.arg(0, PREC.multiplicative + 1)}`,
      prec: PREC.multiplicative,
    }),
  ],
  [
    "irandom",
    (c) =>
      call(`Math.floor(Math.random() * (${c.arg(0, PREC.additive + 1)} + 1))`),
  ],
  [
    "lengthdir_x",
    (c) => ({
      code: `${c.arg(0, PREC.multiplicative)} * Math.cos(${c.arg(1, PREC.multiplicative)} * Math.PI / 180)`,
      prec: PREC.multiplicative,
    }),
  ],
  [
    "lengthdir_y",
    (c) => ({
      code: `${c.arg(0, PREC.multiplicative)} * Math.sin(${c.arg(1, PREC.multiplicative)} * Math.PI / 180)`,
      prec: PREC.multiplicative,
    }),
  ],
  [
    "point_distance",
    (c) =>
      call(
        `Math.hypot(${c.arg(2, PREC.additive)} - ${c.arg(0, PREC.additive + 1)}, ${c.arg(3, PREC.additive)} - ${c.arg(1, PREC.additive + 1)})`,
      ),
  ],
  ["string", (c) => call(`String(${c.arg(0, PREC.assign, "raw")})`)],
  [
    "string_length",
    (c) => call(`String(${c.arg(0, PREC.assign, "raw")}).length`),
  ],
  ["show_message", (c) => call(`console.log(${c.arg(0, PREC.assign, "raw")})`)],
  ["is_array", (c) => call(`Array.isArray(${c.arg(0, PREC.assign, "raw")})`)],
  // -- ds_list: a plain Array --------------------------------------------
  ["ds_list_create", () => atom("[]")],
  ["ds_list_add", (c) => call(`${c.array(0)}.push(${c.rest(1).join(", ")})`)],
  [
    "ds_list_insert",
    (c) => call(`${c.array(0)}.splice(${c.arg(1)}, 0, ${c.arg(2)})`),
  ],
  ["ds_list_delete", (c) => call(`${c.array(0)}.splice(${c.arg(1)}, 1)`)],
  ["ds_list_find_value", (c) => call(`${c.array(0)}[${c.arg(1)}]`)],
  [
    "ds_list_find_index",
    (c) => call(`${c.array(0)}.indexOf(${c.arg(1, PREC.assign, "raw")})`),
  ],
  ["ds_list_set", (c) => atom(`(${c.array(0)}[${c.arg(1)}] = ${c.arg(2)})`)],
  ["ds_list_size", (c) => call(`${c.array(0)}.length`)],
  ["ds_list_empty", (c) => atom(`(${c.array(0)}.length === 0)`)],
  ["ds_list_clear", (c) => atom(`(${c.array(0)}.length = 0)`)],
  ["ds_list_destroy", () => atom(`(${gc})`)],
  // -- ds_map: a Map -------------------------------------------------------
  ["ds_map_create", () => call("new Map()")],
  ["ds_map_add", (c) => call(`${c.map(0)}.set(${c.arg(1)}, ${c.arg(2)})`)],
  ["ds_map_set", (c) => call(`${c.map(0)}.set(${c.arg(1)}, ${c.arg(2)})`)],
  ["ds_map_replace", (c) => call(`${c.map(0)}.set(${c.arg(1)}, ${c.arg(2)})`)],
  ["ds_map_find_value", (c) => call(`${c.map(0)}.get(${c.arg(1)})`)],
  ["ds_map_exists", (c) => call(`${c.map(0)}.has(${c.arg(1)})`)],
  ["ds_map_delete", (c) => call(`${c.map(0)}.delete(${c.arg(1)})`)],
  ["ds_map_size", (c) => call(`${c.map(0)}.size`)],
  ["ds_map_clear", (c) => call(`${c.map(0)}.clear()`)],
  ["ds_map_destroy", () => atom(`(${gc})`)],
  // -- ds_grid: nested Arrays, grid[column][row] --------------------------
  [
    "ds_grid_create",
    (c) =>
      call(
        `Array.from({ length: ${c.arg(0)} }, () => new Array(${c.arg(1)}).fill(0))`,
      ),
  ],
  ["ds_grid_get", (c) => call(`${c.array(0)}[${c.arg(1)}][${c.arg(2)}]`)],
  [
    "ds_grid_set",
    (c) => atom(`(${c.array(0)}[${c.arg(1)}][${c.arg(2)}] = ${c.arg(3)})`),
  ],
  [
    "ds_grid_clear",
    (c) => call(`${c.array(0)}.forEach((_col) => _col.fill(${c.arg(1)}))`),
  ],
  ["ds_grid_width", (c) => call(`${c.array(0)}.length`)],
  ["ds_grid_height", (c) => atom(`(${c.array(0)}[0]?.length ?? 0)`)],
  ["ds_grid_destroy", () => atom(`(${gc})`)],
  // -- structs and other instances by variable name ------------------------
  [
    "variable_struct_get",
    (c) =>
      call(
        `GmlActions.getGmlEntityField(_ctx, ${c.arg(0, PREC.assign, "raw")}, ${c.arg(1)})`,
      ),
  ],
  [
    "variable_struct_set",
    (c) =>
      call(
        `GmlActions.setGmlEntityField(_ctx, ${c.arg(0, PREC.assign, "raw")}, ${c.arg(1)}, ${c.arg(2, PREC.assign, "raw")})`,
      ),
  ],
  [
    "variable_instance_get",
    (c) =>
      call(
        `GmlActions.getGmlEntityField(_ctx, ${c.arg(0, PREC.assign, "raw")}, ${c.arg(1)})`,
      ),
  ],
  [
    "variable_instance_set",
    (c) =>
      call(
        `GmlActions.setGmlEntityField(_ctx, ${c.arg(0, PREC.assign, "raw")}, ${c.arg(1)}, ${c.arg(2, PREC.assign, "raw")})`,
      ),
  ],
  // -- audio: emitters are not modelled, so a sound played on one just plays
  [
    "audio_play_sound_on",
    (c) =>
      call(
        `GmlActions.audio_play_sound(_entity, _ctx, ${c.asset(1, "sound")}, ${c.arg(3)}, ${c.arg(2)})`,
      ),
  ],
  // -- drawing into the current draw target ---------------------------------
  ["draw_set_colour", drawTarget("setColor", 1)],
  ["draw_set_color", drawTarget("setColor", 1)],
  ["draw_rectangle", drawTarget("rect", 5)],
  ["draw_circle", drawTarget("circle", 4)],
  ["draw_text", drawTarget("text", 3)],
  ["draw_line", drawTarget("line", 4)],
  ["draw_set_halign", drawTargetOptional("setHalign")],
  ["draw_set_valign", drawTargetOptional("setValign")],
  ["draw_set_alpha", drawTargetOptional("setAlpha")],
  [
    "draw_set_font",
    (c) => call(`_ctx.drawTarget?.setFont?.(${c.asset(0, "font")})`),
  ],
  ["draw_sprite", spriteDraw("sprite", [2, 3])],
  ["draw_sprite_ext", spriteDraw("spriteExt?.", [2, 3, 4, 5, 6, 7, 8])],
  ["draw_sprite_part", spriteDraw("spritePart?.", [2, 3, 4, 5, 6, 7])],
  [
    "draw_sprite_part_ext",
    spriteDraw("spritePartExt?.", [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  ],
  ["draw_ellipse", guardedDraw("draw_ellipse")],
  ["draw_ellipse_color", guardedDraw("draw_ellipse_color")],
  ["draw_triangle", guardedDraw("draw_triangle")],
  ["draw_triangle_color", guardedDraw("draw_triangle_color")],
  ["draw_text_ext", targetDraw("draw_text_ext")],
  ["draw_text_color", targetDraw("draw_text_color")],
  ["draw_text_colour", targetDraw("draw_text_color")],
  ["draw_roundrect_ext", targetDraw("draw_roundrect_ext")],
]);

export function builtinCallLowering(name: string): CallLowering | undefined {
  return TABLE.get(name);
}

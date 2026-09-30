/**
 * Built-in instance and room variables that do not live in the generic GML
 * instance-variable side table: each maps a bare read and a store onto the
 * engine component or compat function that holds it. Emitted code always
 * refers to the calling instance as `_entity` and the action context as
 * `_ctx` (a `with` body rebinds `_entity`).
 *
 * `write(value)` receives the already-emitted right-hand side of a plain
 * `=`; `compound(op, value)` the operator without `=` (`+`, `-`, ...). A
 * variable with no `write` is read-only: a store to it falls back to an
 * ordinary instance variable of the same name (GML lets an instance shadow
 * a read-only built-in, e.g. `previous_room = room;`).
 */

export interface BuiltinVar {
  read: string;
  write?: (value: string) => string;
  /**
   * Compound store in place (`op` without `=`, e.g. `+`); `value` is emitted
   * at assignment level, so an `op=` needs no parentheses. Defaults to
   * `write(read op value)`.
   */
  compound?: (op: string, value: Piece) => string;
}

const TRANSFORM = "_entity.get(GmlActions.Transform)";
const SPRITE = "_entity.get(GmlActions.Sprite)";
const TIMELINE = "_entity.get(GmlActions.TimelineState)";

import { rightOperand, type Piece } from "../emit/types.js";

/** Statement-shaped component write wrapped so it is valid in any position. */
function iife(body: string): string {
  return `(() => { ${body} })()`;
}

function transformField(field: string, fallback: string): BuiltinVar {
  return {
    read: `(${TRANSFORM}?.${field} ?? ${fallback})`,
    write: (v) => iife(`const _t = ${TRANSFORM}; if (_t) _t.${field} = ${v};`),
    compound: (op, v) =>
      iife(`const _t = ${TRANSFORM}; if (_t) _t.${field} ${op}= ${v.code};`),
  };
}

function spriteField(field: string, fallback: string): BuiltinVar {
  return {
    read: `(${SPRITE}?.${field} ?? ${fallback})`,
    write: (v) => iife(`const _sp = ${SPRITE}; if (_sp) _sp.${field} = ${v};`),
    compound: (op, v) =>
      iife(`const _sp = ${SPRITE}; if (_sp) _sp.${field} ${op}= ${v.code};`),
  };
}

function timelineField(field: string, fallback: string): BuiltinVar {
  return {
    read: `(${TIMELINE}?.${field} ?? ${fallback})`,
    write: (v) =>
      iife(`const _tl = ${TIMELINE}; if (_tl) _tl.${field} = ${v};`),
    compound: (op, v) =>
      iife(`const _tl = ${TIMELINE}; if (_tl) _tl.${field} ${op}= ${v.code};`),
  };
}

/** A getter/setter pair of compat functions taking `(_entity, _ctx[, value])`. */
function accessorPair(getter: string, setter: string): BuiltinVar {
  const read = `GmlActions.${getter}(_entity, _ctx)`;
  return {
    read,
    write: (v) => `GmlActions.${setter}(_entity, _ctx, ${v})`,
    compound: (op, v) =>
      `GmlActions.${setter}(_entity, _ctx, ${read} ${op} ${rightOperand(op, v)})`,
  };
}

function readOnly(read: string): BuiltinVar {
  return { read };
}

/** Legacy pre-2.3 view variables: view 0's camera getter, and a setter that keeps the other axis. */
function legacyView(axis: "x" | "y" | "width" | "height"): BuiltinVar {
  const cam = "GmlActions.view_get_camera(_ctx, 0)";
  const get = (a: string): string =>
    `GmlActions.camera_get_view_${a}(_ctx, ${cam})`;
  const pos = axis === "x" || axis === "y";
  const other =
    axis === "x"
      ? "y"
      : axis === "y"
        ? "x"
        : axis === "width"
          ? "height"
          : "width";
  const setter = pos ? "camera_set_view_pos" : "camera_set_view_size";
  const first = axis === "x" || axis === "width";
  return {
    read: get(axis),
    write: (v) =>
      `GmlActions.${setter}(_ctx, ${cam}, ${first ? v : get(other)}, ${first ? get(other) : v})`,
  };
}

const IMAGE_ANGLE: BuiltinVar = {
  // GameMaker degrees counter-clockwise; Transform.rotation radians clockwise.
  read: `(-(${TRANSFORM}?.rotation ?? 0) * 180 / Math.PI)`,
  write: (v) =>
    iife(
      `const _t = ${TRANSFORM}; if (_t) _t.rotation = -(${v}) * Math.PI / 180;`,
    ),
  compound: (op, v) =>
    op === "+" || op === "-"
      ? iife(
          `const _t = ${TRANSFORM}; if (_t) _t.rotation ${op === "+" ? "-=" : "+="} ${rightOperand("*", v)} * Math.PI / 180;`,
        )
      : iife(
          `const _t = ${TRANSFORM}; if (_t) _t.rotation = -((-(_t.rotation) * 180 / Math.PI) ${op} ${rightOperand(op, v)}) * Math.PI / 180;`,
        ),
};

const IMAGE_BLEND: BuiltinVar = {
  // GameMaker 0xBBGGRR <-> Sprite.tint 0xRRGGBB.
  read: iife(
    `const _t = ${SPRITE}?.tint ?? 0xffffff; return ((_t & 0xff) << 16) | (_t & 0xff00) | ((_t >> 16) & 0xff);`,
  ),
  write: (v) =>
    iife(
      `const _sp = ${SPRITE}; if (_sp) { const _bl = (${v}); const _bb = (_bl >> 16) & 0xff; const _gg = (_bl >> 8) & 0xff; const _rr = _bl & 0xff; _sp.tint = (_rr << 16) | (_gg << 8) | _bb; }`,
    ),
};

const DEPTH: BuiltinVar = {
  // GameMaker draws lower depth in front; Sprite.depth draws higher in front.
  read: `(-(${SPRITE}?.depth ?? 0))`,
  write: (v) => iife(`const _sp = ${SPRITE}; if (_sp) _sp.depth = -(${v});`),
  compound: (op, v) =>
    iife(
      `const _sp = ${SPRITE}; if (_sp) { let _gmlDepth = -(_sp.depth ?? 0); _sp.depth = -(_gmlDepth ${op} ${rightOperand(op, v)}); }`,
    ),
};

const SPRITE_INDEX: BuiltinVar = {
  read: `(${SPRITE}?.texturePath ?? "")`,
  // Sets the texture and the frame count/speed/size from the asset registry.
  write: (v) => `GmlActions.set_gml_sprite_index(_entity, _ctx, ${v})`,
};

const TIMELINE_INDEX: BuiltinVar = {
  // `timeline_index` reads back a numeric asset index in GameMaker; the engine
  // stores the timeline's name, so there is no faithful read.
  read: "undefined",
  write: (v) =>
    v === "-1" || v === "(-1)"
      ? iife(`_entity.remove(GmlActions.TimelineState);`)
      : iife(
          `const _tl = ${TIMELINE}; if (_tl) { _tl.timelineId = ${v}; _tl.position = 0; _tl.running = true; } else { _entity.add(GmlActions.TimelineState, { timelineId: ${v}, position: 0, running: true }); }`,
        ),
};

const TABLE: ReadonlyMap<string, BuiltinVar> = new Map<string, BuiltinVar>([
  ["x", transformField("x", "0")],
  ["y", transformField("y", "0")],
  ["image_xscale", transformField("scaleX", "1")],
  ["image_yscale", transformField("scaleY", "1")],
  ["image_angle", IMAGE_ANGLE],
  ["image_alpha", spriteField("alpha", "1")],
  ["image_index", spriteField("currentFrame", "0")],
  ["image_speed", spriteField("frameSpeed", "1")],
  ["image_blend", IMAGE_BLEND],
  ["depth", DEPTH],
  ["sprite_index", SPRITE_INDEX],
  ["timeline_index", TIMELINE_INDEX],
  ["timeline_running", timelineField("running", "false")],
  ["timeline_speed", timelineField("speed", "1")],
  ["timeline_loop", timelineField("loop", "false")],
  ["timeline_position", timelineField("position", "0")],
  ["xstart", accessorPair("get_gml_xstart", "set_gml_xstart")],
  ["ystart", accessorPair("get_gml_ystart", "set_gml_ystart")],
  ["speed", accessorPair("getGmlSpeed", "setGmlSpeed")],
  ["direction", accessorPair("getGmlDirection", "setGmlDirection")],
  ["hspeed", accessorPair("getGmlHspeed", "setGmlHspeed")],
  ["vspeed", accessorPair("getGmlVspeed", "setGmlVspeed")],
  ["view_xview", legacyView("x")],
  ["view_yview", legacyView("y")],
  ["view_wview", legacyView("width")],
  ["view_hview", legacyView("height")],
  ["image_number", readOnly("GmlActions.get_gml_image_number(_entity)")],
  ["sprite_width", readOnly("GmlActions.sprite_width(_entity)")],
  ["sprite_height", readOnly("GmlActions.sprite_height(_entity)")],
  ["bbox_left", readOnly("GmlActions.bbox_left(_entity)")],
  ["bbox_right", readOnly("GmlActions.bbox_right(_entity)")],
  ["bbox_top", readOnly("GmlActions.bbox_top(_entity)")],
  ["bbox_bottom", readOnly("GmlActions.bbox_bottom(_entity)")],
  ["room", readOnly("GmlActions.room(_ctx)")],
  ["room_width", readOnly("GmlActions.room_width()")],
  ["room_height", readOnly("GmlActions.room_height()")],
  ["room_last", readOnly("GmlActions.room_last(_ctx)")],
  ["previous_room", readOnly("GmlActions.previous_room(_ctx)")],
  ["room_speed", readOnly("GmlActions.room_speed(_ctx)")],
  ["layer", readOnly("GmlActions.gml_current_layer(_entity, _ctx)")],
  ["mouse_x", readOnly("GmlActions.mouse_x(_ctx)")],
  ["mouse_y", readOnly("GmlActions.mouse_y(_ctx)")],
  ["current_time", readOnly("GmlActions.get_current_time()")],
]);

export function builtinVar(name: string): BuiltinVar | undefined {
  return TABLE.get(name);
}

/** Built-in arrays indexed like `alarm[0]` / `view_camera[0]`: read and write by emitted index. */
export interface BuiltinArray {
  read: (index: string) => string;
  write: (index: string, value: string) => string;
}

const VIEW_ARRAYS: Readonly<Record<string, string>> = {
  view_camera: "camera",
  view_visible: "visible",
  view_xport: "xport",
  view_yport: "yport",
  view_wport: "wport",
  view_hport: "hport",
};

export function builtinArray(name: string): BuiltinArray | undefined {
  if (name === "alarm") {
    return {
      read: (i) =>
        `GmlActions.gmlNum(GmlActions.get_gml_alarm(_entity, _ctx, ${i}))`,
      write: (i, v) =>
        `GmlActions.action_set_alarm(_entity, _ctx, ${i}, GmlActions.gmlNum(${v}))`,
    };
  }
  const suffix = VIEW_ARRAYS[name];
  if (suffix === undefined) return undefined;
  return {
    read: (i) => `GmlActions.view_get_${suffix}(_ctx, ${i})`,
    write: (i, v) => `GmlActions.view_set_${suffix}(_ctx, ${i}, ${v})`,
  };
}

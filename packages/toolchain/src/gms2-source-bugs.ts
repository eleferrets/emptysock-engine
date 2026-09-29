/**
 * Detects real defects in the *original* GameMaker source — reads of names
 * that nothing in the project ever defines — so the importer can name them in
 * `migration-report.md` and emit a defined-safe default instead of code that
 * throws the first time it runs.
 *
 * Three kinds, each proven from the project's own files rather than guessed:
 *
 * - `unset-variable`: an object's own event code reads a bare instance
 *   variable (`hp--`, `random_range(-bullet_tolerance, ...)`, `zm = zoom`)
 *   that nothing in that object's inheritance chain assigns (no event-file
 *   assignment, no Variable Definition) and that is not a known GML built-in,
 *   macro, enum, global or asset. Real GameMaker throws "variable not set
 *   before reading it" when such a line runs; the importer emits reads through
 *   `getGmlVar`/`gmlNum`, so the value is a defined `0`.
 * - `missing-font`: `draw_set_font(name)` naming a font that is not in the
 *   project. Emitted as the bare font id string; the engine falls back to its
 *   default font for an unregistered id.
 * - `missing-sprite`: a sprite-typed argument (`draw_sprite*`, `sprite_index =`,
 *   or a script parameter documented as a sprite) naming a sprite that is not
 *   in the project. Emitted as a generated placeholder sprite.
 *
 * This is deliberately conservative text analysis (comments and strings
 * stripped, `with` bodies skipped because their names belong to another
 * object). A GML built-in missing from `GML_BUILTIN_VALUES` would be reported
 * as an unset variable and read as `0`, which is what it would have been
 * (a `ReferenceError`) without this pass; the report says "not defined
 * anywhere in the project", never that the built-in is wrong.
 */
import fs from "fs/promises";
import zlib from "zlib";
import path from "path";
import {
  extractGmlWithBodies,
  scanGmlImplicitArrayVars,
  scanGmlImplicitVars,
} from "./gms2-transpile.js";
import type { SourceBugFinding } from "./gms2-report.js";

/** Path of the generated placeholder sprite (relative to the import output root, forward slashes). */
export const MISSING_SPRITE_REL =
  "assets/sprites/__missing_sprite__/frame_0.png";
/** The texture path generated code uses for it (matches the importer's `./assets/sprites/<name>/frame_0.png` convention). */
export const MISSING_SPRITE_TEXTURE = `./${MISSING_SPRITE_REL}`;

const KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "function",
  "return",
  "var",
  "let",
  "const",
  "new",
  "typeof",
  "in",
  "break",
  "continue",
  "switch",
  "case",
  "default",
  "try",
  "catch",
  "finally",
  "throw",
  "delete",
  "void",
  "with",
  "repeat",
  "until",
  "then",
  "begin",
  "end",
  "exit",
  "globalvar",
  "enum",
  "static",
  "constructor",
  "mod",
  "div",
  "and",
  "or",
  "not",
  "xor",
  "true",
  "false",
  "undefined",
  "null",
  "self",
  "other",
  "all",
  "noone",
  "global",
  "pi",
  "infinity",
  "NaN",
  "argument",
  "argument_count",
  "async_load",
  "event_data",
]);

/** GML built-in instance/global variables and read-only values that are legal bare reads. */
const GML_BUILTIN_VALUES = new Set([
  "x",
  "y",
  "xprevious",
  "yprevious",
  "xstart",
  "ystart",
  "speed",
  "hspeed",
  "vspeed",
  "direction",
  "friction",
  "gravity",
  "gravity_direction",
  "image_index",
  "image_speed",
  "image_angle",
  "image_alpha",
  "image_blend",
  "image_xscale",
  "image_yscale",
  "image_number",
  "sprite_index",
  "sprite_width",
  "sprite_height",
  "sprite_xoffset",
  "sprite_yoffset",
  "mask_index",
  "bbox_left",
  "bbox_right",
  "bbox_top",
  "bbox_bottom",
  "depth",
  "visible",
  "solid",
  "persistent",
  "id",
  "object_index",
  "layer",
  "alarm",
  "path_index",
  "path_position",
  "path_speed",
  "path_orientation",
  "path_scale",
  "path_endaction",
  "timeline_index",
  "timeline_position",
  "timeline_speed",
  "timeline_running",
  "timeline_loop",
  "room",
  "room_width",
  "room_height",
  "room_speed",
  "room_persistent",
  "room_first",
  "room_last",
  "previous_room",
  "view_current",
  "view_camera",
  "view_visible",
  "view_enabled",
  "view_xport",
  "view_yport",
  "view_wport",
  "view_hport",
  "view_surface_id",
  "mouse_x",
  "mouse_y",
  "mouse_button",
  "mouse_lastbutton",
  "keyboard_key",
  "keyboard_lastkey",
  "keyboard_lastchar",
  "keyboard_string",
  "current_time",
  "current_year",
  "current_month",
  "current_day",
  "current_weekday",
  "current_hour",
  "current_minute",
  "current_second",
  "fps",
  "fps_real",
  "delta_time",
  "score",
  "lives",
  "health",
  "show_score",
  "show_lives",
  "show_health",
  "caption_score",
  "caption_lives",
  "caption_health",
  "application_surface",
  "working_directory",
  "program_directory",
  "temp_directory",
  "game_display_name",
  "game_id",
  "game_project_name",
  "game_save_id",
  "os_type",
  "os_browser",
  "os_device",
  "os_version",
  "browser_width",
  "browser_height",
  "display_aa",
  "cursor_sprite",
  "instance_count",
  "instance_id",
  "async_load",
  "gamespeed_fps",
  "gamespeed_microseconds",
  "phy_position_x",
  "phy_position_y",
  "phy_rotation",
  "phy_speed_x",
  "phy_speed_y",
  "phy_speed",
  "phy_angular_velocity",
  "phy_active",
  "phy_fixed_rotation",
  "phy_mass",
  "phy_inertia",
  "phy_bullet",
  "phy_sleeping",
  "phy_com_x",
  "phy_com_y",
  "phy_col_normal_x",
  "phy_col_normal_y",
  "phy_collision_x",
  "phy_collision_y",
  "phy_linear_damping",
  "phy_angular_damping",
  "self",
  "wallpaper_config",
  "debug_mode",
  "event_type",
  "event_number",
  "event_object",
  "event_action",
  "sequence_instance",
  "in_sequence",
  "browser_not_a_browser",
]);

/** Constant families GML defines with a prefix (`c_white`, `vk_left`, `fa_center`, `bm_add`, ...). */
const GML_CONSTANT_PREFIX =
  /^(?:c|vk|mb|fa|bm|bm_dest|bm_src|gp|gp_face|cr|ev|os|display|gamespeed|browser|device|asset|audio|layerelementtype|seq|event|matrix|buffer|ds|phy|ty|lb|tf|ps|pt|pr|se|of|ef|text|ani|kbv|input|timeline|path|tile|tm|surface|spritespeed|sprite|gpu|shadowtype|ugc|steam|network|socket|async|cmpfunc|mip|tex|vertex|vertex_type|vertex_usage|nineslice|part|particle|dll|external|lighttype|opt)_[A-Za-z0-9_]+$/;

/** Object-name argument positions of calls that take an object type. */
const OBJECT_ARG_FUNCS: Record<string, number> = {
  action_create_object: 0,
  instance_create: 2,
  instance_create_layer: 3,
  instance_create_depth: 3,
  instance_change: 0,
  instance_exists: 0,
  instance_number: 0,
  place_meeting: 2,
  position_meeting: 2,
  instance_place: 2,
  instance_position: 2,
};

export interface SourceBugContext {
  objectNames?: ReadonlySet<string>;
  projectRoot: string;
  objects: readonly string[];
  scripts: readonly string[];
  /** Every real asset/resource name in the project (any kind). */
  assetNames: ReadonlySet<string>;
  fontNames: ReadonlySet<string>;
  spriteNames: ReadonlySet<string>;
  macroNames: ReadonlySet<string>;
  enumNames: ReadonlySet<string>;
  /** Parent chain, `[name, parent, ...]`. */
  resolveChain: (name: string) => Promise<string[]>;
  /** Variable Definition names for an object (own + inherited). */
  resolveProperties: (name: string) => Promise<Iterable<string>>;
}

export interface SourceBugScan {
  findings: SourceBugFinding[];
  /** Object name -> instance variables that must read through `getGmlVar` (defined-safe) even though nothing assigns them. */
  unsetVarsByObject: Map<string, Set<string>>;
  missingFonts: Set<string>;
  missingSprites: Set<string>;
  missingObjects: Set<string>;
}

// Module-level result, installed once per import run (same shape as the other project-wide prescans).
let _unsetVarsByObject: ReadonlyMap<string, ReadonlySet<string>> = new Map();

export function setGmlUnsetVarsByObject(
  map: ReadonlyMap<string, ReadonlySet<string>>,
): void {
  _unsetVarsByObject = map;
}

// Instance variables a script assigns (`playerInputDevice[0] = -1;` in an init
// script). A script runs in its caller's instance scope, so any object may read them.
let _scriptInstanceVars: {
  scalars: ReadonlySet<string>;
  arrays: ReadonlySet<string>;
} = {
  scalars: new Set(),
  arrays: new Set(),
};

export function setGmlScriptInstanceVars(v: {
  scalars: ReadonlySet<string>;
  arrays: ReadonlySet<string>;
}): void {
  _scriptInstanceVars = v;
}

// Every instance variable any object or script assigns: what a script may read.
let _projectInstanceVars: {
  scalars: ReadonlySet<string>;
  arrays: ReadonlySet<string>;
} = {
  scalars: new Set(),
  arrays: new Set(),
};

export function setGmlProjectInstanceVars(v: {
  scalars: ReadonlySet<string>;
  arrays: ReadonlySet<string>;
}): void {
  _projectInstanceVars = v;
}

export function getGmlProjectInstanceVars(): {
  scalars: ReadonlySet<string>;
  arrays: ReadonlySet<string>;
} {
  return _projectInstanceVars;
}

export function getGmlScriptInstanceVars(): {
  scalars: ReadonlySet<string>;
  arrays: ReadonlySet<string>;
} {
  return _scriptInstanceVars;
}

/** Names `objectName`'s events read without any definition (see the file header). Empty when none. */
export function getGmlUnsetVars(objectName: string): ReadonlySet<string> {
  return _unsetVarsByObject.get(objectName) ?? new Set();
}

/** Replaces comments and string/char literals with spaces (newlines kept so line numbers survive). */
export function stripGmlCommentsAndStrings(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  const blank = (s: string): string => s.replace(/[^\n]/g, " ");
  while (i < n) {
    const c = src[i] as string;
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      let j = i;
      while (j < n && src[j] !== "\n") j++;
      out += blank(src.slice(i, j));
      i = j;
    } else if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      const j = end === -1 ? n : end + 2;
      out += blank(src.slice(i, j));
      i = j;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") {
        if (src[j] === "\\") j++;
        j++;
      }
      j = Math.min(n, j + 1);
      out += blank(src.slice(i, j));
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index just past the matching close of the bracket at `open`, or `-1`. */
function matchClose(code: string, open: number): number {
  const o = code[open];
  const close = o === "(" ? ")" : o === "{" ? "}" : "]";
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === o) depth++;
    else if (code[i] === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Blanks every `with (...) <body>` region: names inside belong to another object's scope. */
function blankWithBodies(code: string): string {
  let out = code;
  const re = /\bwith\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(out)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const afterParen = matchClose(out, openParen);
    if (afterParen === -1) continue;
    let k = afterParen;
    while (k < out.length && /\s/.test(out[k] as string)) k++;
    let end: number;
    if (out[k] === "{") {
      end = matchClose(out, k);
      if (end === -1) continue;
    } else {
      const semi = out.indexOf(";", k);
      end = semi === -1 ? out.length : semi + 1;
    }
    out =
      out.slice(0, openParen) +
      out.slice(openParen, end).replace(/[^\n]/g, " ") +
      out.slice(end);
  }
  return out;
}

function blankDeclarationRegions(code: string): string {
  // #macro lines and enum bodies are declarations, not reads.
  let out = code.replace(/^[ \t]*#\w+.*$/gm, (s) => s.replace(/[^\n]/g, " "));
  const re = /\benum\s+\w+\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(out)) !== null) {
    const open = m.index + m[0].length - 1;
    const end = matchClose(out, open);
    if (end === -1) continue;
    out =
      out.slice(0, m.index) +
      out.slice(m.index, end).replace(/[^\n]/g, " ") +
      out.slice(end);
  }
  return out;
}

function declaredLocals(code: string): Set<string> {
  const locals = new Set<string>();
  for (const m of code.matchAll(/\b(?:var|static|globalvar)\s+([^;\n]+)/g)) {
    // split on top-level commas
    let depth = 0;
    let cur = "";
    const parts: string[] = [];
    for (const ch of m[1] as string) {
      if ("([{".includes(ch)) depth++;
      if (")]}".includes(ch)) depth--;
      if (ch === "," && depth === 0) {
        parts.push(cur);
        cur = "";
      } else cur += ch;
    }
    parts.push(cur);
    for (const p of parts) {
      const id = /^\s*([A-Za-z_]\w*)/.exec(p);
      if (id) locals.add(id[1] as string);
    }
  }
  for (const m of code.matchAll(/\bfunction\s*\w*\s*\(([^)]*)\)/g)) {
    for (const p of (m[1] as string).split(",")) {
      const id = /^\s*([A-Za-z_]\w*)/.exec(p);
      if (id) locals.add(id[1] as string);
    }
  }
  for (const m of code.matchAll(/\bcatch\s*\(\s*([A-Za-z_]\w*)/g))
    locals.add(m[1] as string);
  for (const m of code.matchAll(/\bfor\s*\(\s*(?:var\s+)?([A-Za-z_]\w*)\s*=/g))
    locals.add(m[1] as string);
  return locals;
}

interface BareRead {
  name: string;
  offset: number;
}

/** Bare-identifier value reads in already-stripped code (not calls, dotted members, struct keys or pure assignment targets). */
function bareReads(code: string): BareRead[] {
  const out: BareRead[] = [];
  const re = /(?<![\w$.@#])([A-Za-z_]\w*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const name = m[1] as string;
    const end = m.index + name.length;
    const rest = code.slice(end, end + 8);
    const next = /^\s*(.)/.exec(rest)?.[1];
    if (next === "(") continue; // call
    // Preceded by a dot with intervening spaces (`a . b`) is a member access.
    const before = code.slice(Math.max(0, m.index - 12), m.index).trimEnd();
    if (before.endsWith(".")) continue;
    const prevChar = before.slice(-1);
    if (next === ":" && (prevChar === "{" || prevChar === ",")) continue; // struct key
    if (/^\s*=(?!=)/.test(code.slice(end, end + 4))) continue; // plain assignment target
    out.push({ name, offset: m.index });
  }
  return out;
}

function lineOf(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++)
    if (src[i] === "\n") line++;
  return line;
}

function splitArgs(argText: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of argText) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      args.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim() !== "") args.push(cur.trim());
  return args;
}

const SPRITE_ARG0_FUNCS = new Set([
  "draw_sprite",
  "draw_sprite_ext",
  "draw_sprite_part",
  "draw_sprite_part_ext",
  "draw_sprite_general",
  "draw_sprite_pos",
  "draw_sprite_stretched",
  "draw_sprite_stretched_ext",
  "draw_sprite_tiled",
  "draw_sprite_tiled_ext",
  "sprite_get_width",
  "sprite_get_height",
  "sprite_exists",
  "sprite_get_number",
]);

/** Script name -> zero-based indexes of parameters its doc comment calls a sprite. */
async function scriptSpriteParams(
  projectRoot: string,
  scripts: readonly string[],
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  for (const s of scripts) {
    const src = await fs
      .readFile(path.join(projectRoot, "scripts", s, `${s}.gml`), "utf-8")
      .catch(() => "");
    const params = [
      ...src.matchAll(
        /^\s*\/\/\/\s*@(?:param|arg)\s+(?:\{[^}]*\}\s*)?(\[?\w+\]?)/gm,
      ),
    ].map((m) => (m[1] as string).replace(/[[\]]/g, ""));
    const idx: number[] = [];
    params.forEach((p, i) => {
      if (/^(?:spr|sprite)/i.test(p)) idx.push(i);
    });
    if (idx.length > 0) map.set(s, idx);
  }
  return map;
}

async function listGml(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((f) => f.endsWith(".gml")).sort();
  } catch {
    return [];
  }
}

export async function scanGmlSourceBugs(
  ctx: SourceBugContext,
): Promise<SourceBugScan> {
  const findings: SourceBugFinding[] = [];
  const unsetVarsByObject = new Map<string, Set<string>>();
  const missingFonts = new Set<string>();
  const missingSprites = new Set<string>();
  const missingObjects = new Set<string>();
  const seen = new Set<string>();
  const spriteParams = await scriptSpriteParams(ctx.projectRoot, ctx.scripts);

  // Project-wide `globalvar` names are legal bare reads everywhere.
  const globalVars = new Set<string>();
  const allFiles: {
    rel: string;
    owner: string;
    isScript: boolean;
    src: string;
  }[] = [];
  for (const o of ctx.objects) {
    for (const f of await listGml(path.join(ctx.projectRoot, "objects", o))) {
      const src = await fs
        .readFile(path.join(ctx.projectRoot, "objects", o, f), "utf-8")
        .catch(() => "");
      allFiles.push({
        rel: `objects/${o}/${f}`,
        owner: o,
        isScript: false,
        src,
      });
    }
  }
  for (const s of ctx.scripts) {
    for (const f of await listGml(path.join(ctx.projectRoot, "scripts", s))) {
      const src = await fs
        .readFile(path.join(ctx.projectRoot, "scripts", s, f), "utf-8")
        .catch(() => "");
      allFiles.push({
        rel: `scripts/${s}/${f}`,
        owner: s,
        isScript: true,
        src,
      });
    }
  }
  for (const f of allFiles) {
    for (const m of stripGmlCommentsAndStrings(f.src).matchAll(
      /\bglobalvar\s+([^;\n]+)/g,
    )) {
      for (const p of (m[1] as string).split(",")) {
        const id = /^\s*([A-Za-z_]\w*)/.exec(p);
        if (id) globalVars.add(id[1] as string);
      }
    }
  }

  // A field assigned inside some `with (target) { field = ...; }` body is set
  // on another object from outside (`with (my_gun) { owner = other.id; }`), so
  // reading it elsewhere is not a defect.
  const withAssigned = new Set<string>();
  for (const f of allFiles) {
    for (const body of extractGmlWithBodies(
      stripGmlCommentsAndStrings(f.src),
    )) {
      for (const v of scanGmlImplicitVars(body)) withAssigned.add(v);
      for (const v of scanGmlImplicitArrayVars(body)) withAssigned.add(v);
    }
  }

  // Per-object "assigned" sets (own event files), unioned over the chain below.
  const ownAssigned = new Map<string, Set<string>>();
  for (const f of allFiles) {
    if (f.isScript) continue;
    let set = ownAssigned.get(f.owner);
    if (set === undefined) {
      set = new Set();
      ownAssigned.set(f.owner, set);
    }
    for (const v of scanGmlImplicitVars(f.src)) set.add(v);
    for (const v of scanGmlImplicitArrayVars(f.src)) set.add(v);
  }

  const scriptScalars = new Set<string>();
  const scriptArrays = new Set<string>();
  for (const f of allFiles) {
    if (!f.isScript) continue;
    const params = new Set<string>();
    for (const m of f.src.matchAll(/\bfunction\s*\w*\s*\(([^)]*)\)/g)) {
      for (const p of (m[1] as string).split(","))
        params.add(p.trim().split("=")[0]?.trim() ?? "");
    }
    for (const v of scanGmlImplicitVars(f.src))
      if (!params.has(v) && !/^argument\d*$/.test(v)) scriptScalars.add(v);
    for (const v of scanGmlImplicitArrayVars(f.src))
      if (!params.has(v)) scriptArrays.add(v);
  }
  setGmlScriptInstanceVars({ scalars: scriptScalars, arrays: scriptArrays });
  {
    const pScalars = new Set(scriptScalars);
    const pArrays = new Set(scriptArrays);
    for (const f of allFiles) {
      if (f.isScript) continue;
      for (const v of scanGmlImplicitVars(f.src)) pScalars.add(v);
      for (const v of scanGmlImplicitArrayVars(f.src)) pArrays.add(v);
    }
    setGmlProjectInstanceVars({ scalars: pScalars, arrays: pArrays });
  }

  const chainAssigned = new Map<string, Set<string>>();
  for (const o of ctx.objects) {
    const chain = await ctx.resolveChain(o);
    const set = new Set<string>();
    for (const c of chain) for (const v of ownAssigned.get(c) ?? []) set.add(v);
    for (const v of scriptScalars) set.add(v);
    for (const v of scriptArrays) set.add(v);
    for (const p of await ctx.resolveProperties(o)) set.add(p);
    chainAssigned.set(o, set);
  }

  const isKnownValue = (name: string, locals: ReadonlySet<string>): boolean =>
    KEYWORDS.has(name) ||
    GML_BUILTIN_VALUES.has(name) ||
    GML_CONSTANT_PREFIX.test(name) ||
    /^argument\d*$/.test(name) ||
    locals.has(name) ||
    ctx.assetNames.has(name) ||
    ctx.macroNames.has(name) ||
    ctx.enumNames.has(name) ||
    globalVars.has(name) ||
    withAssigned.has(name);

  const push = (f: SourceBugFinding): void => {
    const key = `${f.kind}|${f.name}|${f.location}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(f);
  };

  for (const file of allFiles) {
    let code = stripGmlCommentsAndStrings(file.src);
    code = blankDeclarationRegions(blankWithBodies(code));
    const locals = declaredLocals(code);
    const assigned = file.isScript
      ? new Set<string>()
      : (chainAssigned.get(file.owner) ?? new Set<string>());
    const claimedByAsset = new Set<number>(); // offsets already explained as a missing asset

    // --- asset contexts -------------------------------------------------
    const callRe = /\b([A-Za-z_]\w*)\s*\(/g;
    let cm: RegExpExecArray | null;
    while ((cm = callRe.exec(code)) !== null) {
      const fn = cm[1] as string;
      const open = cm.index + cm[0].length - 1;
      const close = matchClose(code, open);
      if (close === -1) continue;
      const argText = code.slice(open + 1, close - 1);
      const args = splitArgs(argText);
      const check = (
        argIdx: number,
        kind: "font" | "sprite" | "object",
      ): void => {
        const a = args[argIdx];
        if (a === undefined || !/^[A-Za-z_]\w*$/.test(a)) return;
        if (isKnownValue(a, locals) || assigned.has(a)) return;
        const rel =
          kind === "font"
            ? ctx.fontNames
            : kind === "sprite"
              ? ctx.spriteNames
              : (ctx.objectNames ?? new Set(ctx.objects));
        if (rel.has(a)) return;
        const offset = open + 1 + argText.indexOf(a);
        claimedByAsset.add(offset);
        (kind === "font"
          ? missingFonts
          : kind === "sprite"
            ? missingSprites
            : missingObjects
        ).add(a);
        push({
          kind:
            kind === "font"
              ? "missing-font"
              : kind === "sprite"
                ? "missing-sprite"
                : "missing-object",
          name: a,
          location: `${file.rel}:${lineOf(file.src, offset)}`,
          detail:
            kind === "font"
              ? `\`${fn}(${a})\` names a font that is not in the project.`
              : kind === "sprite"
                ? `\`${fn}(...)\` is passed a sprite named \`${a}\` that is not in the project.`
                : `\`${fn}(...)\` is passed an object named \`${a}\` that is not in the project.`,
          emitted:
            kind === "font"
              ? `the bare id "${a}", which the engine draws with its default font`
              : kind === "sprite"
                ? `a generated placeholder sprite (${MISSING_SPRITE_REL})`
                : `the quoted name "${a}", which spawns and collision checks treat as an unknown object (a warning and no instance, never a throw)`,
        });
      };
      if (fn === "draw_set_font") check(0, "font");
      if (SPRITE_ARG0_FUNCS.has(fn) || fn === "action_sprite_set")
        check(0, "sprite");
      for (const idx of spriteParams.get(fn) ?? []) check(idx, "sprite");
      const objIdx = OBJECT_ARG_FUNCS[fn];
      if (objIdx !== undefined) check(objIdx, "object");
    }
    for (const m of code.matchAll(
      /\b(?:sprite_index|mask_index)\s*=(?!=)\s*([A-Za-z_]\w*)\s*;/g,
    )) {
      const a = m[1] as string;
      if (isKnownValue(a, locals) || assigned.has(a) || ctx.spriteNames.has(a))
        continue;
      const offset = m.index + m[0].lastIndexOf(a);
      claimedByAsset.add(offset);
      missingSprites.add(a);
      push({
        kind: "missing-sprite",
        name: a,
        location: `${file.rel}:${lineOf(file.src, offset)}`,
        detail: `assigned as a sprite but \`${a}\` is not a sprite in the project.`,
        emitted: `a generated placeholder sprite (${MISSING_SPRITE_REL})`,
      });
    }

    // --- unset instance variables (objects only) -------------------------
    if (file.isScript) continue;
    for (const r of bareReads(code)) {
      if (claimedByAsset.has(r.offset)) continue;
      const name = r.name;
      if (isKnownValue(name, locals) || assigned.has(name)) continue;
      if (
        missingFonts.has(name) ||
        missingSprites.has(name) ||
        missingObjects.has(name)
      )
        continue;
      let set = unsetVarsByObject.get(file.owner);
      if (set === undefined) {
        set = new Set();
        unsetVarsByObject.set(file.owner, set);
      }
      set.add(name);
      push({
        kind: "unset-variable",
        name,
        location: `${file.rel}:${lineOf(file.src, r.offset)}`,
        detail: `\`${file.owner}\` reads \`${name}\` but neither it nor any parent object ever assigns it (and it is not a Variable Definition, macro, enum, global or known built-in). GameMaker would stop with "variable not set before reading it" if this line ran.`,
        emitted: "a read through getGmlVar/gmlNum, so it is a defined 0",
      });
    }
  }

  return {
    findings,
    unsetVarsByObject,
    missingFonts,
    missingSprites,
    missingObjects,
  };
}

// ---------------------------------------------------------------------------
// Placeholder sprite
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A 16x16 magenta/black checkerboard PNG: the classic "missing texture" look, so a missing sprite is visible rather than silently blank. */
export function buildMissingSpritePng(): Buffer {
  const size = 16;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const on = ((x >> 2) + (y >> 2)) % 2 === 0;
      const o = row + 1 + x * 4;
      raw[o] = on ? 255 : 0;
      raw[o + 1] = 0;
      raw[o + 2] = on ? 255 : 0;
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

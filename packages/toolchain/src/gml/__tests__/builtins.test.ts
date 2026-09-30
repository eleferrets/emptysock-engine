import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as engine from "@emptysock/engine";
import { describe, expect, it } from "vitest";
import {
  BUILTINS,
  RUNTIME_HELPERS,
  builtinConstant,
  isKnownBuiltinName,
  isSpriteArg0,
  lookupBuiltin,
  objectArgIndex,
} from "../builtins.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, "..", "..");
const bugsSrc = readFileSync(path.join(srcDir, "gms2-source-bugs.ts"), "utf8");

const stringsIn = (src: string, re: RegExp): string[] => {
  const m = re.exec(src);
  if (!m) throw new Error(`pattern not found: ${re}`);
  const body = m[1]!
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
};

describe("gml builtins table", () => {
  it("classifies representative names", () => {
    expect(lookupBuiltin("x")?.kind).toBe("variable");
    expect(lookupBuiltin("instance_create_layer")?.returns).toBe("instance");
    expect(lookupBuiltin("self")?.kind).toBe("special");
    expect(lookupBuiltin("then")?.kind).toBe("keyword");
    expect(lookupBuiltin("c_white")?.kind).toBe("constant");
    expect(lookupBuiltin("not_a_builtin")).toBeUndefined();
  });

  it("param kinds: object and sprite argument positions", () => {
    expect(objectArgIndex("instance_create_layer")).toBe(3);
    expect(objectArgIndex("place_meeting")).toBe(2);
    expect(objectArgIndex("draw_sprite")).toBeUndefined();
    expect(isSpriteArg0("draw_sprite_ext")).toBe(true);
    expect(isSpriteArg0("action_sprite_set")).toBe(true);
    expect(isSpriteArg0("instance_exists")).toBe(false);
  });

  it("constant prefix fallback keeps unknown vk_*/c_* out of 'unresolved'", () => {
    expect(builtinConstant("vk_f13_unlisted")).toBe(true);
    expect(builtinConstant("c_hotpink")).toBe(true);
    expect(builtinConstant("obj_player")).toBe(false);
    expect(isKnownBuiltinName("argument_count")).toBe(true);
  });

  // ---- drift guards: the lists still kept in source files must all be in the table ----
  it("source-bug builtin values, sprite-arg and object-arg lists are covered", () => {
    for (const n of stringsIn(
      bugsSrc,
      /const GML_BUILTIN_VALUES = new Set\(\[([\s\S]*?)\]\);/,
    )) {
      expect(isKnownBuiltinName(n), n).toBe(true);
    }
    for (const n of stringsIn(
      bugsSrc,
      /const KEYWORDS = new Set\(\[([\s\S]*?)\]\);/,
    )) {
      expect(isKnownBuiltinName(n), n).toBe(true);
    }
    for (const n of stringsIn(
      bugsSrc,
      /const SPRITE_ARG0_FUNCS = new Set\(\[([\s\S]*?)\]\);/,
    )) {
      expect(isSpriteArg0(n), n).toBe(true);
    }
    const objBlock =
      /const OBJECT_ARG_FUNCS: Record<string, number> = \{([\s\S]*?)\};/.exec(
        bugsSrc,
      )![1]!;
    for (const m of objBlock.matchAll(/(\w+):\s*(\d+)/g)) {
      expect(objectArgIndex(m[1]!), m[1]).toBe(Number(m[2]));
    }
  });

  it("every 'GmlActions.<name>' the emitter and codegen emit is a table entry or runtime helper", () => {
    const emitted = new Set<string>();
    const files = ["gms2-codegen.ts", "gms2-behavior-codegen.ts"];
    for (const dir of ["gml/emit", "gml/lower"])
      for (const f of readdirSync(path.join(srcDir, dir)))
        if (f.endsWith(".ts")) files.push(`${dir}/${f}`);
    for (const f of files) {
      const src = readFileSync(path.join(srcDir, f), "utf8");
      for (const m of src.matchAll(/GmlActions\.([A-Za-z_][A-Za-z0-9_]*)/g))
        emitted.add(m[1]!);
    }
    // Interpolated/partial names captured by the regex (e.g. `GmlActions.${fn}` yields nothing; `get_gml_` prefixes remain).
    const ignore = (n: string) => n.endsWith("_") || /^[A-Z]/.test(n);
    const unknown = [...emitted].filter(
      (n) =>
        !ignore(n) &&
        !BUILTINS.has(n) &&
        !RUNTIME_HELPERS.includes(n) &&
        !KNOWN_EMITTED_BUILTINS.has(n),
    );
    expect(unknown.sort(), "emitted but not in builtins table").toEqual([]);
  });

  it("every runtime export named by the table exists on the engine", () => {
    const exp = engine as unknown as Record<string, unknown>;
    const missing: string[] = [];
    for (const n of RUNTIME_HELPERS) if (!(n in exp)) missing.push(n);
    for (const b of BUILTINS.values())
      if (b.runtimeExport && !(b.name in exp)) missing.push(b.name);
    // Anything absent here is a name the transpiler rewrites to a compat call the engine does not export.
    expect(missing.sort()).toEqual(EXPECTED_MISSING_RUNTIME);
  });
});

/** Emitted `GmlActions.` names that are GML built-ins routed by dedicated passes rather than the threaded lists. */
const KNOWN_EMITTED_BUILTINS = new Set<string>([
  "action_if_mouse",
  "action_move",
  "action_set_alarm",
  "audio_play_sound",
  "audio_sound_pitch",
  "draw_roundrect_ext",
  "draw_text_color",
  "draw_text_ext",
  "gmlActionsStep",
  "getGml",
  "get_gml_instance_alarm",
  "gmlUnknown",
  "gml_animation_ended",
  "registerGmlScript",
  "script_execute",
  "set_gml_instance_alarm",
  "set_gml_sprite_index",
  "gml_current_layer",
  "instance_change",
  "instance_create_layer",
  "mouse_x",
  "mouse_y",
  "place_free",
  "place_meeting",
  "previous_room",
  "room",
  "room_goto",
  "room_height",
  "room_last",
  "room_speed",
  "room_width",
  "shader_set",
  "sprite_height",
  "sprite_width",
  "name",
  "get_current_time",
  "get_gml_alarm",
  "get_gml_image_number",
]);

const EXPECTED_MISSING_RUNTIME: string[] = [];

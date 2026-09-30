import { describe, expect, it } from "vitest";
import { parseSync } from "rolldown/utils";
import { emitEvent, emitScript } from "../emit/index.js";
import type { EmitOptions, EmitResult } from "../emit/index.js";
import { buildProjectSymbols, type ProjectInput } from "../project-symbols.js";
import { BUILTINS } from "../builtins.js";

interface Ctx {
  assets?: ProjectInput["assets"];
  /** Other files of the project (e.g. an object's Create event), path -> text. */
  files?: Record<string, string>;
  kind?: EmitOptions["kind"];
  callables?: Record<string, string>;
  spriteFrames?: Record<string, number>;
}

const OBJECT_FILE = "objects/obj_self/Step_0.gml";

function emit(text: string, ctx: Ctx = {}): EmitResult {
  const file = {
    path: OBJECT_FILE,
    text,
    object: "obj_self",
    kind: "object" as const,
  };
  const others = Object.entries(ctx.files ?? {}).map(([path, t]) => ({
    path,
    text: t,
    object: path.split("/")[1] ?? "",
    kind: "object" as const,
  }));
  const project = buildProjectSymbols({
    assets: { object: ["obj_self"], ...ctx.assets },
    files: [file, ...others],
  });
  return emitEvent(file, {
    project,
    kind: ctx.kind ?? "event",
    object: "obj_self",
    functionId: "fn",
    callables: new Map(Object.entries(ctx.callables ?? {})),
    ...(ctx.spriteFrames
      ? { spriteFrames: new Map(Object.entries(ctx.spriteFrames)) }
      : {}),
  });
}

const code = (text: string, ctx?: Ctx): string => emit(text, ctx).code;

/** Syntax errors from the oxc parser the module loader uses (rejects invalid assignment targets). */
function syntaxErrors(ts: string): string[] {
  return parseSync(
    "out.ts",
    `function f(_entity, _ctx, _other) {\n${ts}\n}`,
  ).errors.map((e) => e.message);
}

describe("emitter: statements and operators", () => {
  it("keeps locals lexical and declares every name of a multi-line var list", () => {
    const out = code('var a = 1,\n    b = "x";\na += 2;\nb = a;');
    expect(out).toBe('var a = 1, b = "x";\na += 2;\nb = a;');
  });

  it("maps GML operators onto JavaScript with precedence preserved", () => {
    expect(code("var r = a div b;")).toContain("Math.trunc(");
    expect(code("var r = 7 mod 3;")).toBe("var r = 7 % 3;");
    expect(code("var r = 1 and 0 or not 1;")).toBe("var r = 1 && 0 || !1;");
    expect(code("var r = 1 xor 0;")).toBe(
      "var r = (Boolean(1) !== Boolean(0));",
    );
    // GML binds `&` tighter than `==`; JavaScript does not.
    expect(code("var r = 3 & 1 == 1;")).toBe("var r = (3 & 1) == 1;");
    expect(code("var r = $FF;")).toBe("var r = 0xFF;");
  });

  it("treats = inside a condition as a comparison", () => {
    expect(code("var a = 1;\nif (a = 1) a = 2;")).toBe(
      "var a = 1;\nif (a == 1) {\n  a = 2;\n}",
    );
  });

  it("emits repeat with a count evaluated once, do-until, switch and for", () => {
    expect(code("repeat (3) { var n = 1; }")).toBe(
      "for (let _i = 0, _n = 3; _i < _n; _i++) {\n  var n = 1;\n}",
    );
    expect(code("var k = 3;\ndo { k--; } until (k <= 0);")).toBe(
      "var k = 3;\ndo {\n  k--;\n} while (!(k <= 0));",
    );
    expect(
      code("var s = 1;\nswitch s { case 1: s = 2; break; default: s = 0; }"),
    ).toBe(
      "var s = 1;\nswitch (s) {\n  case 1:\n    s = 2;\n    break;\n  default:\n    s = 0;\n}",
    );
    expect(code("for (var i = 0; i < 3; i++) { }")).toBe(
      "for (var i = 0; i < 3; i++) {\n}",
    );
  });

  it("keeps comments and turns #region into a line comment", () => {
    const out = code(
      "// top\n#region move\nvar a = 1; // trailing\n/* block */\n#endregion",
    );
    expect(out).toContain("// top");
    expect(out).toContain("// #region move");
    expect(out).toContain("// trailing");
    expect(out).toContain("/* block */");
  });

  it("closes a block comment GameMaker lets run to the end of the file", () => {
    const out = code("var a = 1;\n/* disabled\nvar b = 2;");
    expect(out).toBe("var a = 1;\n/* disabled\nvar b = 2; */");
    expect(syntaxErrors(out)).toEqual([]);
  });

  it("renames a local that collides with an emitted name or a JavaScript keyword", () => {
    expect(code("var _t = 1, arguments = 2;\nx = _t;")).toContain(
      "var _gml__t = 1, _gml_arguments = 2;",
    );
  });

  it("emits a parse error as a comment with a report entry and keeps the rest", () => {
    const r = emit("var a = ;\nvar b = 2;");
    expect(r.code).toContain("// [GML parse error:");
    expect(r.code).toContain("var b = 2;");
    expect(r.diagnostics.map((d) => d.kind)).toContain("parse");
    expect(syntaxErrors(r.code)).toEqual([]);
  });
});

describe("emitter: instance variables, globals and statics", () => {
  it("any name that is nothing else is an instance variable", () => {
    const out = code("hp = 5;\nhp -= dmg;\ncount++;");
    expect(out).toBe(
      'GmlActions.setGmlVar(_entity, _ctx, "hp", 5);\n' +
        'GmlActions.setGmlVar(_entity, _ctx, "hp", GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "hp")) - GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "dmg")));\n' +
        'GmlActions.setGmlVar(_entity, _ctx, "count", GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "count")) + 1);',
    );
  });

  it("coerces reads in arithmetic but not in stores, comparisons or indexing", () => {
    const out = code("a = b;\nif (t != noone) c = t + 1;");
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "a", GmlActions.getGmlVar(_entity, _ctx, "b"));',
    );
    expect(out).toContain(
      'if (GmlActions.getGmlVar(_entity, _ctx, "t") != undefined)',
    );
    expect(out).toContain(
      'GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "t")) + 1',
    );
  });

  it("routes global.x and globalvar names through the GlobalStore", () => {
    const out = code("globalvar lives;\nlives = 3;\nglobal.score += lives;");
    expect(out).toContain('_ctx.game?.globals.set("lives", 3);');
    expect(out).toContain(
      '_ctx.game?.globals.set("score", GmlActions.gmlNum(_ctx.game?.globals.get("score")) + GmlActions.gmlNum(_ctx.game?.globals.get("lives")));',
    );
  });

  it("keeps a static in one slot per declaration", () => {
    const out = code("static n = 0;\nn++;\nx = n;");
    expect(out).toContain(
      'if (!("fn::n::0" in GmlActions.gmlStatics)) { GmlActions.gmlStatics["fn::n::0"] = 0; }',
    );
    expect(out).toContain(
      'GmlActions.gmlStatics["fn::n::0"] = GmlActions.gmlNum(GmlActions.gmlStatics["fn::n::0"]) + 1;',
    );
    expect(out).toContain('(GmlActions.gmlStatics["fn::n::0"])');
  });

  it("indexes instance arrays through getGmlArrayVar and nested levels through gmlArr", () => {
    const out = code("grid = [[1]];\nv = grid[0][0];\nlist[3] = 1;");
    expect(out).toContain(
      'GmlActions.gmlArr(GmlActions.getGmlArrayVar(_entity, _ctx, "grid")[0])[0]',
    );
    expect(out).toContain(
      'GmlActions.getGmlArrayVar(_entity, _ctx, "list")[3] = 1;',
    );
    expect(out).not.toContain(
      'gmlNum(GmlActions.getGmlVar(_entity, _ctx, "grid"))[',
    );
  });
});

describe("emitter: built-in variables and assets", () => {
  it("lowers x/y/image_*/depth onto components with one store for every operator", () => {
    const out = code("x += 4;\nimage_angle = 90;\ndepth -= 1;\ny++;");
    expect(out).toContain("if (_t) _t.x += 4;");
    expect(out).toContain("_t.rotation = -(90) * Math.PI / 180;");
    expect(out).toContain("_sp.depth = -(_gmlDepth - 1);");
    expect(out).toContain("if (_t) _t.y += 1;");
  });

  it("resolves assets from the project registry, never from a name prefix", () => {
    const ctx: Ctx = {
      assets: { sprite: ["hero"], sound: ["boom"], room: ["level2"] },
    };
    expect(code("sprite_index = hero;", ctx)).toBe(
      'GmlActions.set_gml_sprite_index(_entity, _ctx, "./assets/sprites/hero/frame_0.png");',
    );
    expect(code("audio_play_sound(boom, 1, false);", ctx)).toBe(
      'GmlActions.audio_play_sound(_entity, _ctx, "boom", 1, false);',
    );
    // spr_ prefix alone means nothing: not in the registry, so an instance variable.
    expect(code("sprite_index = spr_unlisted;", ctx)).toBe(
      'GmlActions.set_gml_sprite_index(_entity, _ctx, GmlActions.getGmlVar(_entity, _ctx, "spr_unlisted"));',
    );
    expect(code("room_goto(level2);", ctx)).toBe(
      'GmlActions.room_goto(_entity, _ctx, "level2");',
    );
  });

  it("uses the frame_{n} texture path for a multi-frame sprite so comparisons match the prefab", () => {
    const out = code("if (sprite_index == walk) image_index = 0;", {
      assets: { sprite: ["walk"] },
      spriteFrames: { walk: 4 },
    });
    expect(out).toContain('== "./assets/sprites/walk/frame_{n}.png"');
  });

  it("a local named like an asset stays the local", () => {
    const r = emit("var tempsprite = 1;\ndraw_sprite(tempsprite, 0, 0, 0);", {
      assets: { sprite: ["tempsprite"] },
    });
    expect(r.code).toContain(
      "_ctx.drawTarget?.sprite((tempsprite as unknown as string), 0, 0);",
    );
    expect(r.diagnostics.map((d) => d.kind)).toContain("shadow");
  });
});

describe("emitter: calls", () => {
  it("threads built-ins from the table and quotes object arguments", () => {
    const out = code("if place_meeting(x, y + 1, obj_wall) hp = 0;", {
      assets: { object: ["obj_wall"] },
    });
    expect(out).toContain(
      'GmlActions.place_meeting(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0) + 1, "obj_wall")',
    );
  });

  it("calls a project function with the caller's context and records the import", () => {
    const r = emit("scr_hit(5);\ncb = scr_hit;", {
      callables: { scr_hit: "scr_hit" },
    });
    expect(r.code).toBe(
      'scr_hit(_entity, _ctx, 5);\nGmlActions.setGmlVar(_entity, _ctx, "cb", scr_hit);',
    );
    expect([...r.imports]).toEqual([["scr_hit", "scr_hit"]]);
  });

  it("calls through a variable and script_execute dynamically", () => {
    const out = code("cb = 1;\ncb(2);\nscript_execute(cb, 3);");
    expect(out).toContain(
      'GmlActions.script_execute(_entity, _ctx, GmlActions.getGmlVar(_entity, _ctx, "cb"), 2);',
    );
    expect(out).toContain(
      'GmlActions.script_execute(_entity, _ctx, GmlActions.getGmlVar(_entity, _ctx, "cb"), 3);',
    );
  });

  it("an unknown function becomes a warning stub with a report entry", () => {
    const r = emit("audio_emitter_nonsense(1);");
    expect(r.code).toBe('GmlActions.gmlUnknown("audio_emitter_nonsense")(1);');
    expect(r.diagnostics.map((d) => d.kind)).toEqual(["unknown-call"]);
  });

  it("gml_pragma is a compile-time directive", () => {
    expect(code('gml_pragma("forceinline");')).toBe(
      '// gml_pragma("forceinline") — compile-time directive, nothing to run',
    );
  });

  it("event_inherited calls what the codegen supplies", () => {
    const file = {
      path: OBJECT_FILE,
      text: "event_inherited();",
      object: "obj_self",
      kind: "object" as const,
    };
    const project = buildProjectSymbols({ files: [file] });
    const r = emitEvent(file, {
      project,
      kind: "event",
      functionId: "fn",
      callables: new Map(),
      inherited: () => "__Inherit_parent.onCreate?.(_entity, _ctx)",
    });
    expect(r.code).toBe("__Inherit_parent.onCreate?.(_entity, _ctx);");
  });

  it("repairs a condition that lost its if", () => {
    const r = emit("place_free(x - 4, y) {x -= 4}");
    expect(r.code.startsWith("if (GmlActions.place_free(")).toBe(true);
    expect(r.diagnostics.map((d) => d.kind)).toContain("source-repair");
    expect(syntaxErrors(r.code)).toEqual([]);
  });

  it("gates the statement after a DnD if-action", () => {
    const out = code('action_if_empty(0, 0, 0);\naction_move("000010000", 4);');
    expect(out).toBe(
      'if (GmlActions.action_if_empty(_entity, _ctx, 0, 0, false)) {\n  GmlActions.action_move(_entity, _ctx, "000010000", 4);\n}',
    );
    expect(emit('action_move("000010000", 4);').usesMotion).toBe(true);
  });
});

describe("emitter: other instances", () => {
  it("with rebinds _entity and binds other to the caller", () => {
    const out = code("with (obj_b) { hp = other.hp; }", {
      assets: { object: ["obj_b"] },
    });
    expect(out).toBe(
      '{ const _withCaller = _entity; GmlActions.with_each(_ctx, "obj_b", (_entity) => { const _other = _withCaller;\n' +
        '  GmlActions.setGmlVar(_entity, _ctx, "hp", GmlActions.getGmlEntityField(_ctx, _other, "hp"));\n}); }',
    );
  });

  it("stores through obj.field with every operator, and obj.alarm[n] on that instance", () => {
    const out = code("obj_b.hp -= 1;\nobj_b.alarm[0] = 5;", {
      assets: { object: ["obj_b"] },
    });
    expect(out).toContain(
      'GmlActions.setGmlObjectVar(_entity, _ctx, "obj_b", "hp", GmlActions.gmlNum(GmlActions.getGmlObjectVar(_entity, _ctx, "obj_b", "hp")) - 1);',
    );
    expect(out).toContain(
      'GmlActions.set_gml_instance_alarm(_ctx, "obj_b", 0, GmlActions.gmlNum(5));',
    );
  });

  it("a local named like an object is the local once declared", () => {
    // The initializer runs before the local exists, so its `wall` is still the object.
    const out = code(
      "var wall = instance_place(x, y, wall);\nif (wall != noone) { x = wall.x; }",
      {
        assets: { object: ["wall"] },
      },
    );
    expect(out).toContain(
      '(_entity.get(GmlActions.Transform)?.y ?? 0), "wall");',
    );
    expect(out).toContain("if (wall != undefined)");
    expect(out).toContain('GmlActions.getGmlEntityField(_ctx, wall, "x")');
    expect(out).not.toContain("getGmlObjectVar");
  });

  it("collision events read other as _other", () => {
    expect(code("hp -= other.damage;", { kind: "collision" })).toContain(
      'GmlActions.getGmlEntityField(_ctx, _other, "damage")',
    );
  });
});

describe("emitter: scripts", () => {
  function script(text: string): ReturnType<typeof emitScript> {
    const file = {
      path: "scripts/scr_a/scr_a.gml",
      text,
      kind: "script" as const,
    };
    const project = buildProjectSymbols({ files: [file] });
    return emitScript("scr_a", file, {
      project,
      kind: "script",
      functionId: "scr_a",
      callables: new Map([["scr_a", "scr_a"]]),
    });
  }

  it("exports every top-level function with typed parameters", () => {
    const r = script(
      "function scr_a(a, font) {\n  draw_set_font(font);\n  return a * 2;\n}\nfunction helper() { return 1; }",
    );
    expect(r.functions.map((f) => f.name)).toEqual(["scr_a", "helper"]);
    expect(r.functions[0]?.params).toEqual([
      { name: "a", type: "number" },
      { name: "font", type: "string" },
    ]);
    expect(r.functions[0]?.returnsValue).toBe(true);
    expect(r.functions[0]?.body).toContain("return a * 2;");
  });

  it("a legacy script is one function with rest arguments", () => {
    const r = script("return argument0 + argument[1] + argument_count;");
    expect(r.functions).toHaveLength(1);
    expect(r.functions[0]?.restArgs).toBe(true);
    expect(r.functions[0]?.body).toBe(
      "return GmlActions.gmlNum(args[0]) + GmlActions.gmlNum(args[1]) + args.length;",
    );
  });
});

describe("emitter: lowering coverage", () => {
  // Every built-in the regex transpiler rewrote by a dedicated pass or a
  // threading list must lower to something other than the unknown-call stub.
  const SPECIAL = [
    "instance_create_layer",
    "instance_change",
    "shader_set",
    "audio_play_sound",
    "audio_sound_pitch",
    "room_goto",
    "draw_set_colour",
    "draw_set_color",
    "draw_rectangle",
    "draw_circle",
    "draw_text",
    "draw_line",
    "draw_ellipse",
    "draw_ellipse_color",
    "draw_triangle",
    "draw_triangle_color",
    "draw_text_ext",
    "draw_text_color",
    "draw_roundrect_ext",
    "show_message",
    "irandom_range",
    "irandom",
    "random",
    "lerp",
    "clamp",
    "abs",
    "floor",
    "ceil",
    "round",
    "sqrt",
    "power",
    "lengthdir_x",
    "lengthdir_y",
    "point_distance",
    "string_length",
    "string",
    "ds_list_create",
    "ds_list_add",
    "ds_list_insert",
    "ds_list_delete",
    "ds_list_find_value",
    "ds_list_set",
    "ds_list_size",
    "ds_list_clear",
    "ds_list_destroy",
    "ds_map_create",
    "ds_map_add",
    "ds_map_replace",
    "ds_map_find_value",
    "ds_map_exists",
    "ds_map_delete",
    "ds_map_size",
    "ds_map_clear",
    "ds_map_destroy",
    "ds_grid_create",
    "ds_grid_get",
    "ds_grid_set",
    "ds_grid_clear",
    "ds_grid_width",
    "ds_grid_height",
    "ds_grid_destroy",
    "variable_struct_get",
    "variable_struct_set",
    "draw_sprite",
    "draw_set_halign",
    "draw_set_valign",
    "draw_set_font",
    "draw_set_alpha",
    "draw_sprite_part_ext",
    "draw_sprite_part",
    "draw_sprite_ext",
    "place_meeting",
    "position_meeting",
    "instance_place",
    "instance_position",
    "collision_rectangle",
    "collision_circle",
    "collision_line",
    "collision_point",
    "instance_exists",
    "instance_number",
    "action_if_collision",
    "action_if_aligned",
    "action_if_empty",
  ];

  it("no previously supported built-in falls through to the unknown-call stub", () => {
    const threaded = [...BUILTINS.values()]
      .filter((b) => b.threading !== undefined)
      .map((b) => b.name);
    for (const name of [...SPECIAL, ...threaded]) {
      const r = emit(`${name}(1, 2);`);
      expect(r.code, name).not.toContain("gmlUnknown");
    }
  });
});

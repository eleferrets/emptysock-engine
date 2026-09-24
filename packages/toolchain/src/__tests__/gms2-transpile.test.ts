import { describe, expect, it } from "vitest";
import { transpileGML } from "../gms2-transpile.js";

describe("transpileGML — place_meeting/collision query family", () => {
  it("transpiles a bare-condition place_meeting call, entity-threaded", () => {
    const out = transpileGML(
      "if place_meeting(x + 4, y, obj_wall)\n{\n  x -= 4;\n}",
    );
    expect(out).toContain(
      "if (GmlActions.place_meeting(_entity, _ctx, x + 4, y, obj_wall))",
    );
  });

  it("threads instance_place/collision_rectangle the same way as other query functions", () => {
    const out = transpileGML(
      "other_wall = instance_place(x, y, obj_wall);\n" +
        "hit = collision_rectangle(x, y, x + 32, y + 32, obj_enemy, false, true);",
    );
    expect(out).toContain(
      "GmlActions.instance_place(_entity, _ctx, x, y, obj_wall)",
    );
    expect(out).toContain(
      "GmlActions.collision_rectangle(_entity, _ctx, x, y, x + 32, y + 32, obj_enemy, false, true)",
    );
  });
});

describe("transpileGML — GMS2 timelines (timeline_index/timeline_running/...)", () => {
  it("rewrites timeline_index = <asset name>; into a real TimelineState attach", () => {
    const out = transpileGML("timeline_index = tmJiggle;");
    expect(out).toContain(
      'const _tl = _entity.get(GmlActions.TimelineState); if (_tl) { _tl.timelineId = "tmJiggle"; _tl.position = 0; _tl.running = true; } else { _entity.add(GmlActions.TimelineState, { timelineId: "tmJiggle", position: 0, running: true }); }',
    );
  });

  it("rewrites timeline_index = -1; into removing TimelineState (GameMaker's real 'no timeline' sentinel)", () => {
    const out = transpileGML("timeline_index = -1;");
    expect(out).toContain("_entity.remove(GmlActions.TimelineState);");
    expect(out).not.toContain("_entity.add(GmlActions.TimelineState");
  });

  it("rewrites timeline_running/timeline_speed/timeline_loop/timeline_position writes", () => {
    const out = transpileGML(
      "timeline_running = true;\ntimeline_speed = 2;\ntimeline_loop = true;\ntimeline_position = 0;",
    );
    expect(out).toContain(
      "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.running = true;",
    );
    expect(out).toContain(
      "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.speed = 2;",
    );
    expect(out).toContain(
      "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.loop = true;",
    );
    expect(out).toContain(
      "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.position = 0;",
    );
  });

  it("rewrites a bare read of timeline_running/timeline_position to a safe optional-chained default", () => {
    const out = transpileGML(
      "if (timeline_running && timeline_position > 30) { x += 1; }",
    );
    expect(out).toContain(
      "(_entity.get(GmlActions.TimelineState)?.running ?? false)",
    );
    expect(out).toContain(
      "(_entity.get(GmlActions.TimelineState)?.position ?? 0) > 30",
    );
  });

  it("leaves a bare read of timeline_index untouched as an honestly-unresolved identifier", () => {
    const out = transpileGML("if (timeline_index != -1) { x += 1; }");
    expect(out).toContain("timeline_index != -1");
  });

  it("resolves a re-targeting write before a read, both against the same live GmlActions.TimelineState", () => {
    const out = transpileGML("timeline_index = tmA;\ntimeline_index = tmB;");
    expect(out).toContain('timelineId: "tmA"');
    expect(out).toContain('timelineId: "tmB"');
  });
});

describe("transpileGML — GMS2 rendering built-ins (sprite_index/image_*)", () => {
  it("rewrites sprite_index = <bare asset name>; into a real Sprite.texturePath write using the shared texture-path convention", () => {
    const out = transpileGML("sprite_index = spr_dad_hug;");
    expect(out).toContain(
      'const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.texturePath = "./assets/sprites/spr_dad_hug/frame_0.png";',
    );
  });

  it("rewrites sprite_index = -1; to the empty-string 'no sprite' sentinel (GameMaker's own documented sentinel for removing an instance's sprite)", () => {
    const out = transpileGML("sprite_index = -1;");
    expect(out).toContain(
      'const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.texturePath = "";',
    );
  });

  it("does not leave the sprite-asset identifier as an unresolved bare read (the real reported bug)", () => {
    const out = transpileGML(
      "if (hug) {\n  sprite_index = spr_dad_hug;\n}\nelse {\n  sprite_index = spr_dad_idle;\n}",
    );
    expect(out).not.toMatch(/=\s*spr_dad_hug\s*;/);
    expect(out).not.toMatch(/=\s*spr_dad_idle\s*;/);
  });

  it("resolves a bare sprite-asset identifier compared against sprite_index on either side of ==/!=", () => {
    const out = transpileGML(
      "if (sprite_index == spr_dad_hug) { x += 1; }\nif (spr_dad_idle != sprite_index) { x += 1; }",
    );
    expect(out).toContain('== "./assets/sprites/spr_dad_hug/frame_0.png"');
    expect(out).toContain('"./assets/sprites/spr_dad_idle/frame_0.png" !=');
  });

  it("rewrites a bare read of sprite_index to a safe optional-chained Sprite.texturePath read", () => {
    const out = transpileGML(
      "if (sprite_index == other.sprite_index) { x += 1; }",
    );
    expect(out).toContain(
      '(_entity.get(GmlActions.Sprite)?.texturePath ?? "")',
    );
  });

  it("rewrites image_angle writes/reads onto Transform.rotation with a degrees<->radians conversion", () => {
    const out = transpileGML("image_angle = 45;\ny = image_angle;");
    expect(out).toContain(
      "const _t = _entity.get(GmlActions.Transform); if (_t) _t.rotation = (45) * Math.PI / 180;",
    );
    expect(out).toContain(
      "((_entity.get(GmlActions.Transform)?.rotation ?? 0) * 180 / Math.PI)",
    );
  });

  it("rewrites image_xscale/image_yscale writes/reads onto Transform.scaleX/scaleY with no unit conversion", () => {
    const out = transpileGML(
      "image_xscale = sign(hsp);\nimage_yscale = -1;\ny = image_xscale + image_yscale;",
    );
    expect(out).toContain(
      "const _t = _entity.get(GmlActions.Transform); if (_t) _t.scaleX = sign(hsp);",
    );
    expect(out).toContain(
      "const _t = _entity.get(GmlActions.Transform); if (_t) _t.scaleY = -1;",
    );
    expect(out).toContain("(_entity.get(GmlActions.Transform)?.scaleX ?? 1)");
    expect(out).toContain("(_entity.get(GmlActions.Transform)?.scaleY ?? 1)");
  });

  it("rewrites image_alpha writes/reads onto Sprite.alpha", () => {
    const out = transpileGML("image_alpha = 0.5;\ny = image_alpha;");
    expect(out).toContain(
      "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.alpha = 0.5;",
    );
    expect(out).toContain("(_entity.get(GmlActions.Sprite)?.alpha ?? 1)");
  });

  it("rewrites image_blend writes/reads onto Sprite.tint with the same BGR<->RGB conversion action_sprite_color uses", () => {
    const out = transpileGML("image_blend = c_red;\ny = image_blend;");
    expect(out).toContain("const _bl = (c_red);");
    expect(out).toContain(
      "const _bb = (_bl >> 16) & 0xff; const _gg = (_bl >> 8) & 0xff; const _rr = _bl & 0xff; _sp.tint = (_rr << 16) | (_gg << 8) | _bb;",
    );
    expect(out).toContain(
      "((_t & 0xff) << 16) | (_t & 0xff00) | ((_t >> 16) & 0xff)",
    );
  });

  it("leaves image_index/image_speed as honest, safe local-variable no-ops (no per-frame animation is modelled by this importer)", () => {
    const out = transpileGML("image_index = 0;\nimage_speed = 1;");
    expect(out).toContain("var image_index = 0;");
    expect(out).toContain("var image_speed = 1;");
  });

  describe("depth — GameMaker draw-order variable, sign-flipped onto Sprite.depth", () => {
    // manual.gamemaker.io's Depth reference page is explicit: a *lower*
    // `depth` value draws that instance *in front of* one with a higher
    // `depth` (its own canonical example: depth -100 draws in front of
    // depth 0). This engine's `Sprite.depth` sorts the opposite way —
    // `RenderPipeline` writes `pixiSprite.zIndex = sprite.depth` straight
    // through, and PixiJS's `zIndex` convention is "higher draws on top" —
    // so the transpiled write/read must apply a `-` sign flip to preserve
    // GameMaker's real visual semantic rather than just copying the value.
    it("rewrites depth = -100; into a real Sprite.depth write with the sign flipped (draws in front -> higher Sprite.depth)", () => {
      const out = transpileGML("depth = -100;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.depth = -(-100);",
      );
    });

    it("rewrites a positive depth write with the same flip (draws behind -> lower Sprite.depth)", () => {
      const out = transpileGML("depth = 50;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.depth = -(50);",
      );
    });

    it("round-trips a bare read of depth back through the same flip", () => {
      const out = transpileGML("depth = -100;\ny = depth;");
      expect(out).toContain("(-(_entity.get(GmlActions.Sprite)?.depth ?? 0))");
    });

    it("does not rewrite a dotted reference to another instance's depth", () => {
      const out = transpileGML("inst.depth = -100;\nx = other.depth;");
      expect(out).toContain("inst.depth = -100;");
      expect(out).toContain("other.depth");
      expect(out).not.toMatch(/\w\.\(\(\)\s*=>/);
      expect(() => new Function(out)).not.toThrow();
    });

    it("is valid syntax as the body of a bare (brace-less) if statement", () => {
      const gml = "if (a) depth = -100;\nif (b)\n{\n  foo();\n}\n";
      const out = transpileGML(gml);
      expect(() => new Function(out)).not.toThrow();
    });
  });
});

describe("transpileGML", () => {
  it("does not emit `export` inside a function body for a global assignment", () => {
    const out = transpileGML("global.kills = 1;");
    expect(out).not.toContain("export let");
    expect(out).toContain('TODO: migrate GML global variable "kills"');
  });

  it("handles a global assignment reached via a non-`;`-terminated expr", () => {
    const out = transpileGML("global.kills = file_text_read_real(file);");
    expect(out).not.toContain("export");
  });

  it("keeps instance_create_layer valid when used as a sub-expression", () => {
    // A real GML shape: passed straight into `with(...)`, not as its own
    // standalone statement.
    const out = transpileGML(
      'with (instance_create_layer(x, y, "Instances", obj_x))\n{\n  foo = 1;\n}',
    );
    // Must not produce a bare `//` line comment sitting inside an argument
    // list — that would comment out everything after it on the line.
    expect(out).not.toMatch(/\(\s*\/\//);
  });

  it("rewrites a GML with(...) block instead of emitting the reserved `with` keyword", () => {
    const out = transpileGML("with (other_instance) { x = 1; }");
    // Strip the explanatory comment before asserting: the message itself
    // legitimately mentions "with (" as plain text.
    const code = out.replace(/\/\*.*?\*\//gs, "");
    expect(code).not.toMatch(/\bwith\s*\(/);
    // `if (false)`, not `if (true)`: the untranslated body can reference
    // GML-only rescoping (e.g. `other.foo`) that only makes sense inside a
    // real `with` block — actually executing it would throw at runtime. A
    // real, confirmed regression (see gms2-transpile.ts's own comment on
    // this pass): `if (true)` here used to run the untranslated body.
    expect(out).toContain("if (false)");
  });

  it("wraps an if condition chained with bare && / || GML allows without an outer paren", () => {
    const out = transpileGML("if (a < b) && (c > d)\n{\n  foo();\n}");
    expect(out).toContain("if ((a < b) && (c > d))");
  });

  it("converts the GML `div` integer-division operator", () => {
    const out = transpileGML("x = (a - b) div (c * 1.5);");
    expect(out).toContain("Math.floor((a - b) / (c * 1.5))");
  });

  it("rewrites #region/#endregion so they don't break TS parsing", () => {
    const out = transpileGML("#region Foo\nx = 1;\n#endregion");
    expect(out).not.toMatch(/^#region/m);
    expect(out).not.toMatch(/^#endregion/m);
    expect(out).toContain("// #region Foo");
    expect(out).toContain("// #endregion");
  });

  it("does not conflate a global comparison (==) with an assignment", () => {
    const out = transpileGML("if (global.hasgun == false) instance_destroy();");
    // Must not garble into "= = false" — the second `=` of `==` used to
    // get swallowed into the captured right-hand-side expression text.
    expect(out).not.toContain("= = ");
  });

  it("wraps an if chain whose clause has a nested function call operand", () => {
    const out = transpileGML(
      "if (point_distance(a, 0) > 0.2) || (point_distance(b, 0) > 0.2)\n{\n  foo();\n}",
    );
    expect(out).toContain(
      "if ((point_distance(a, 0) > 0.2) || (point_distance(b, 0) > 0.2))",
    );
  });

  it("wraps a bare (unparenthesised) if condition anchored by a following brace", () => {
    const out = transpileGML(
      "if my_condition_fn(x, y, obj_wall)\n{\n  foo();\n}",
    );
    expect(out).toContain("if (my_condition_fn(x, y, obj_wall))");
  });

  it("wraps a bare if !expr condition (not just the already-parenthesised if !(expr) case)", () => {
    const out = transpileGML(
      "if !my_condition_fn(x, y, obj) && cond2\n{\n  foo();\n}",
    );
    expect(out).toContain("if (!my_condition_fn(x, y, obj) && cond2)");
  });

  it("does not treat the word 'if' inside a // comment as a condition to wrap", () => {
    const gml =
      "// checking if we are within range\nif (a) && (b)\n{\n  foo();\n}";
    const out = transpileGML(gml);
    // The comment text itself must survive unmangled, and the real `if`
    // below it must still get its own, separate, correct wrap.
    expect(out).toContain("// checking if we are within range");
    expect(out).toContain("if ((a) && (b))");
  });

  it("converts the GML `mod` operator", () => {
    const out = transpileGML("x = a mod b;");
    expect(out).toContain("(a % b)");
  });

  it("neutralises a real, closed block comment before any other pass runs", () => {
    // A real GML block comment can itself contain code this transpiler
    // would otherwise rewrite (e.g. room_goto) — rewriting text that's
    // actually still inside a not-yet-neutralised source comment risks a
    // nested /* */ comment, which is invalid JS/TS.
    const out = transpileGML("/* room_goto(target); */\nx = 1;");
    expect(out).not.toContain("room_goto");
    expect(out).toContain("[GML comment/dead code omitted]");
    expect(out).toContain("x = 1;");
  });

  it("reports a whole-file unterminated block comment as inert instead of transpiling it", () => {
    const out = transpileGML("/* this whole event was disabled\nx = 1;");
    expect(out).not.toContain("x = 1");
    expect(out).toMatch(/entirely inert/);
  });

  it("keeps room_goto/audio_play_sound/draw_sprite valid as an unbraced if-body", () => {
    const out = transpileGML("if (cond) room_goto(rm_next);");
    // Must not leave the `if` with no statement body at all.
    expect(out).toMatch(/if \(cond\)\s*\(undefined/);
  });

  it("handles audio_play_sound with a nested-call first argument", () => {
    const out = transpileGML(
      "audio_play_sound(choose(snd_a, snd_b), 1, false);",
    );
    expect(out).not.toMatch(/\(\s*\/\//);
  });

  it("draw_text with a nested-call, multi-concatenation string argument", () => {
    const out = transpileGML(
      'draw_text(15, 15, "a: " + string(hp) + "\\n" + "b: " + string(mp));',
    );
    expect(out).toContain(
      '_ctx.drawTarget?.text(15, 15, "a: " + String(hp) + "\\n" + "b: " + String(mp));',
    );
  });

  it("strips a stray trailing semicolon in a for-loop header", () => {
    const out = transpileGML(
      "for (var i = array_length_1d(arr) - 1; i >= 0; --i;)\n{\n  foo();\n}",
    );
    expect(out).toContain(
      "for (let i = array_length_1d(arr) - 1; i >= 0; --i)",
    );
  });

  it("keeps a trailing // comment outside a wrapped bare-if condition's parens", () => {
    const out = transpileGML("if a == 1 // a comment\n{\n  foo();\n}");
    expect(out).toContain("if (a == 1) // a comment");
  });

  it("wraps a bare if condition that directly touches its brace with no space", () => {
    const out = transpileGML("if a <= 0{\n  foo();\n}");
    expect(out).toContain("if (a <= 0)");
  });

  it("transpiles and/or/not/xor word operators", () => {
    const out = transpileGML(
      "if (a == 1 and b == 2) { x = 1; }\nif (a or b) { y = 1; }\nif (not a) { z = 1; }",
    );
    expect(out).toContain("a == 1 && b == 2");
    expect(out).toContain("if (a || b)");
    expect(out).toContain("if (!a)");
  });

  it("transpiles legacy globalvar declarations without leaving a hard parse error", () => {
    const out = transpileGML("globalvar a, b, c;\na = 1;");
    expect(out).not.toMatch(/^\s*globalvar\b/m);
    expect(out).toContain('TODO: migrate legacy "globalvar');
  });

  it("transpiles #macro directives to a comment", () => {
    const out = transpileGML("#macro VIEW view_camera[0]\nx = VIEW;");
    expect(out).not.toMatch(/^\s*#macro/m);
    expect(out).toContain('TODO: migrate GML macro "VIEW"');
  });

  it("does not double-wrap Math.floor produced by a div rewrite", () => {
    const out = transpileGML("x = width div 2;");
    expect(out).not.toContain("Math.Math.floor");
    expect(out).toContain("Math.floor(width / 2)");
  });

  it("keeps room_goto valid with a nested-call room argument", () => {
    const out = transpileGML("room_goto(room_next(room));");
    expect(out).not.toMatch(/\(\s*\/\//);
    expect(out).toContain("room_next(room)");
  });

  it("keeps instance_create_layer valid with a nested-call argument", () => {
    const out = transpileGML(
      "instance_create_layer(random(room_width), 0, layer, obj_x);",
    );
    expect(out).not.toMatch(/,\s*0,\s*layer,\s*obj_x\);\s*$/m);
  });

  describe("ds_list", () => {
    it("transpiles create/add/find_value/size/delete/destroy to real Array ops", () => {
      const out = transpileGML(
        [
          "var list = ds_list_create();",
          "ds_list_add(list, 1);",
          "var v = ds_list_find_value(list, 0);",
          "var n = ds_list_size(list);",
          "ds_list_delete(list, 0);",
          "ds_list_destroy(list);",
        ].join("\n"),
      );
      expect(out).toContain("var list = [];");
      expect(out).toContain("list.push(1);");
      expect(out).toContain("var v = list[0];");
      expect(out).toContain("var n = list.length;");
      expect(out).toContain("list.splice(0, 1);");
      expect(out).not.toMatch(/\bds_list_destroy\(/);
    });

    it("transpiles the [| i] accessor to plain indexing in both read and write position", () => {
      const readOut = transpileGML("var v = list[| 0];");
      expect(readOut).toContain("var v = list[0];");
      const writeOut = transpileGML("list[| 0] = 5;");
      expect(writeOut).toContain("list[0] = 5;");
    });
  });

  describe("ds_map", () => {
    it("transpiles create/add/find_value/exists/delete/size/destroy to real Map ops", () => {
      const out = transpileGML(
        [
          "var map = ds_map_create();",
          'ds_map_add(map, "hp", 10);',
          'var v = ds_map_find_value(map, "hp");',
          'var e = ds_map_exists(map, "hp");',
          'ds_map_delete(map, "hp");',
          "var n = ds_map_size(map);",
          "ds_map_destroy(map);",
        ].join("\n"),
      );
      expect(out).toContain("var map = new Map();");
      expect(out).toContain('map.set("hp", 10);');
      expect(out).toContain('var v = map.get("hp");');
      expect(out).toContain('var e = map.has("hp");');
      expect(out).toContain('map.delete("hp");');
      expect(out).toContain("var n = map.size;");
      expect(out).not.toMatch(/\bds_map_destroy\(/);
    });

    it("transpiles the [? key] accessor to .get in read position and .set in write position", () => {
      const readOut = transpileGML('var v = map[? "hp"];');
      expect(readOut).toContain('var v = map.get("hp");');
      const writeOut = transpileGML('map[? "hp"] = 5;');
      expect(writeOut).toContain('map.set("hp", 5);');
      expect(writeOut).not.toContain(".get(");
    });

    it("does not confuse a comparison (==) inside an accessor write scan for an assignment", () => {
      const out = transpileGML('if (map[? "hp"] == 5) { x = 1; }');
      expect(out).toContain('map.get("hp") == 5');
    });
  });

  describe("ds_grid", () => {
    it("transpiles create/get/set/width/height/destroy to a nested-Array grid", () => {
      const out = transpileGML(
        [
          "var grid = ds_grid_create(4, 4);",
          "ds_grid_set(grid, 0, 0, 1);",
          "var v = ds_grid_get(grid, 0, 0);",
          "var w = ds_grid_width(grid);",
          "var h = ds_grid_height(grid);",
          "ds_grid_destroy(grid);",
        ].join("\n"),
      );
      expect(out).toContain(
        "var grid = Array.from({ length: (4) }, () => new Array(4).fill(0));",
      );
      expect(out).toContain("(grid[0][0] = 1);");
      expect(out).toContain("var v = grid[0][0];");
      expect(out).toContain("var w = grid.length;");
      expect(out).not.toMatch(/\bds_grid_destroy\(/);
    });

    it("transpiles the [# c, r] accessor to nested indexing in both read and write position", () => {
      const readOut = transpileGML("var v = grid[# 1, 2];");
      expect(readOut).toContain("var v = grid[1][2];");
      const writeOut = transpileGML("grid[# 1, 2] = 5;");
      expect(writeOut).toContain("grid[1][2] = 5;");
    });
  });

  describe("GML structs", () => {
    it("leaves a struct literal untouched (already valid JS object-literal syntax)", () => {
      const out = transpileGML("var s = {a: 1, b: 2};");
      expect(out).toContain("var s = {a: 1, b: 2};");
    });

    it("transpiles variable_struct_get/set/exists/remove to plain bracket access", () => {
      const out = transpileGML(
        [
          'var v = variable_struct_get(s, "a");',
          'variable_struct_set(s, "a", 5);',
          'var e = variable_struct_exists(s, "a");',
          'variable_struct_remove(s, "a");',
        ].join("\n"),
      );
      expect(out).toContain('var v = s["a"];');
      expect(out).toContain('(s["a"] = 5);');
      expect(out).toContain('var e = ("a" in s);');
      expect(out).toContain('delete s["a"];');
    });
  });

  describe("GML built-in instance variables", () => {
    it("declares a bare assignment to a known built-in (e.g. image_speed) as `var` instead of leaving an undeclared identifier", () => {
      const out = transpileGML("image_speed = 0;\nimage_index = 0;");
      expect(out).toContain("var image_speed = 0;");
      expect(out).toContain("var image_index = 0;");
      // A real, confirmed regression: without this, a generated event
      // handler assigning a bare built-in throws `ReferenceError` at
      // runtime in a strict-mode ES module.
      expect(() => new Function(out)).not.toThrow();
    });

    it("also auto-declares a first bare assignment to a project-defined (non-built-in) instance variable", () => {
      // Real, confirmed regression: `obj_crate`'s Create event does
      // `mywall = instance_create_layer(...);` — GML implicitly declares
      // `mywall` on this first assignment; the generated JS must too.
      const out = transpileGML("mywall = 5;\nmywall = mywall + 1;");
      expect(out).toContain("var mywall = 5;");
      // The second assignment must NOT redeclare (that would shadow, and
      // with `let`/`const` would throw — `var` is used precisely because
      // GML tolerates redeclaring the same local, per the `var` pass
      // above).
      expect(out).not.toMatch(/var mywall = mywall/);
      expect(out).toContain("mywall = mywall + 1;");
    });

    it("does not redeclare a name that was already declared by an earlier pass (e.g. ds_list/ds_map/ds_grid create)", () => {
      const out = transpileGML("var list = ds_list_create();\nlist = list;");
      expect(out).toContain("var list = [];");
      // Second assignment must stay a plain assignment, not `var list = list;`.
      expect(out.match(/var list/g)?.length).toBe(1);
    });
  });

  describe("real-project regressions found exercising GmsProjectRuntime end to end", () => {
    it("keeps GML `var` as `var`, not `let`, so a redeclared local in the same event does not throw", () => {
      // Real, confirmed regression: a compiled/unrolled Step event with
      // several near-identical blocks, each starting `var _pNumber = 0;` /
      // `var _pNumber = 1;` / ... (one per player index). GML's `var` is
      // function-scoped and explicitly tolerates redeclaring the same
      // local more than once in the same function body; JS `let` does not
      // — rewriting to `let` produced a hard `SyntaxError: Identifier
      // '_pNumber' has already been declared` at module load.
      const out = transpileGML(
        "var _pNumber = 0;\n_pNumber += 1;\nvar _pNumber = 1;\n_pNumber += 1;\n",
      );
      expect(out).not.toMatch(/\blet\b/);
      expect(out.match(/var _pNumber/g)?.length).toBe(2);
      expect(() => new Function(out)).not.toThrow();
    });

    it("wraps an if condition that starts with one balanced clause but keeps going past its closing paren", () => {
      // Real, confirmed regression: `if (_xAxis*_xAxis + _yAxis*+_yAxis) >=
      // gamepadDeadzoneSquared { ... }` — valid GML (the `if`'s condition
      // needs no single enclosing paren group), but left as-is this parses
      // in JS as `if (a)` followed by a dangling `>= gamepadDeadzoneSquared`
      // expression statement — a hard `SyntaxError`, not just a silent
      // misbehaviour.
      const out = transpileGML(
        "if (_xAxis*_xAxis + _yAxis*_yAxis) >= gamepadDeadzoneSquared\n{\n  foo();\n}\n",
      );
      expect(out).toContain(
        "if ((_xAxis*_xAxis + _yAxis*_yAxis) >= gamepadDeadzoneSquared)",
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("wraps a bare if condition whose comment sits before the condition, not after it", () => {
      // Real, confirmed regression: `if // LEFT TOGGLE HIGHLIGHTED\n(cond)\n{
      // ... }` — a comment on the `if`'s own line, with the real condition
      // only starting on the next line. The naive "find the first `//` in
      // the captured span" approach misfiled the *entire* condition as a
      // trailing comment (nothing precedes the `//`), emitting a hard
      // `if ()` followed by the real condition as a dangling, never
      // -evaluated expression statement — a `SyntaxError: Unexpected token
      // ')'` at module load.
      const out = transpileGML(
        "if // LEFT TOGGLE HIGHLIGHTED\n(mouseX > left)\n{\n  foo();\n}\n",
      );
      expect(out).toMatch(/if \(\(?mouseX > left\)?\)/);
      expect(out).not.toContain("if ()");
      expect(() => new Function(out)).not.toThrow();
    });

    it("converts a GML $RRGGBB hex-colour literal to a real JS 0x hex literal", () => {
      // Real, confirmed regression: `ltng_color = $fff0ee;` — GML's hex
      // colour literal syntax. Left untouched, `$fff0ee` parses as a bare
      // JS identifier (`$` is a legal identifier character), throwing
      // `ReferenceError: $fff0ee is not defined` at runtime.
      const out = transpileGML("ltng_color = $fff0ee;\n");
      expect(out).toContain("0xfff0ee");
      expect(out).not.toContain("$fff0ee");
      expect(() => new Function(out)).not.toThrow();
    });

    it("converts an 8-digit GML $AABBGGRR hex-colour literal too", () => {
      const out = transpileGML("c = $80fff0ee;\n");
      expect(out).toContain("0x80fff0ee");
    });

    it("does not mangle a dotted alarm assignment on another instance (creator.alarm[n] = ...)", () => {
      // Real, confirmed regression: `creator.alarm[1] = 1;` — GML's alarm-
      // migration-comment rewrite matched starting mid-expression at
      // "alarm" (ignoring the `creator.` prefix), leaving `creator.`
      // dangling with nothing after its `.` once the rest of the line
      // became a `//` comment — a hard `SyntaxError: Unexpected token ';'`.
      const out = transpileGML("creator.alarm[1] = 1;\n");
      expect(out).not.toMatch(/creator\.\s*(\r?\n|$)/);
      expect(() => new Function(out)).not.toThrow();
    });

    it("still migrates a bare (this-instance) alarm assignment to the coroutine TODO comment", () => {
      const out = transpileGML("alarm[1] = 1;\n");
      expect(out).toContain("entity.startCoroutine(waitFrames(1))");
    });

    describe("bare single-line if whose body is a rewritten GML built-in", () => {
      // Real, confirmed regression against a real GameMaker object's
      // Step_1.gml: `if (sign(hsp) != 0) image_xscale = sign(hsp) *
      // other.size;` — a bare (brace-less) single-line `if` whose already-
      // parenthesised condition is followed directly by an assignment that
      // this session's own `image_xscale`/`image_yscale`/etc. rewrite turns
      // into a multi-statement IIFE. The pre-existing "if (a) <trailing
      // condition continuation>" pass has no `{` on the same line to anchor
      // against, so its lazy match kept expanding *past* the body's own
      // `;`, across unrelated following statements, until it found some
      // later, wholly unrelated `{` — fusing the if's condition, its own
      // body, and an unrelated following statement into one broken,
      // unclosed `if (...)`. Confirmed via a real `tsc --noEmit` run
      // (`TS1005`/`TS1128`) before this fix; every case here is checked via
      // `new Function()` as a real syntax-validity proof, matching this
      // file's own existing pattern for the same class of bug.
      it("does not corrupt a bare if whose body rewrites to an image_xscale/image_yscale IIFE, with a later unrelated braced if in the same file", () => {
        const gml =
          "if (sign(hsp) != 0) image_xscale = sign(hsp) * other.size;\n" +
          "image_yscale = other.size;\n" +
          "if (place_meeting(x, y, obj_wall))\n{\n  hsp = 0;\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
        // The condition keeps its own, single set of parens — no extra
        // unbalanced paren merged in from the (unrelated) following
        // statements.
        expect(out).toMatch(/^if \(sign\(hsp\) != 0\) /);
      });

      it("does not corrupt a bare if whose body rewrites to a sprite_index IIFE", () => {
        const gml =
          "if (a) sprite_index = spr_walk;\n" + "if (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("does not corrupt a bare if whose body rewrites to an image_blend IIFE", () => {
        const gml = "if (a) image_blend = $ff00ff;\nif (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("does not corrupt a bare if whose body rewrites to a timeline_index IIFE", () => {
        const gml = "if (a) timeline_index = tmFoo;\nif (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("does not corrupt a bare if whose body is a threaded place_meeting call", () => {
        const gml =
          "if (a) place_meeting(x, y, obj_wall);\nif (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("does not corrupt a bare if whose body is a threaded DnD action call", () => {
        const gml = "if (a) action_move(2, 4);\nif (b)\n{\n  foo();\n}\n";
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
      });

      it("still wraps a genuine trailing-condition continuation (no semicolon in the trailing span)", () => {
        // Make sure the semicolon guard doesn't regress the original case
        // this pass exists for.
        const out = transpileGML(
          "if (_xAxis*_xAxis + _yAxis*_yAxis) >= gamepadDeadzoneSquared\n{\n  foo();\n}\n",
        );
        expect(out).toContain(
          "if ((_xAxis*_xAxis + _yAxis*_yAxis) >= gamepadDeadzoneSquared)",
        );
        expect(() => new Function(out)).not.toThrow();
      });
    });

    describe("a dotted reference to another instance's rewritten GML built-in is left untouched", () => {
      // Real, confirmed regression against a real GameMaker project's own
      // script (`scr_kill_player.gml`): `inst.image_xscale = imgx;` — GML
      // allows writing/reading *another* instance's field through a dot
      // reference, a real, common shape (`with`-created instances, a stored
      // instance-id variable). This transpiler has no way to resolve which
      // other entity a dotted reference targets, so — mirroring the
      // pre-existing `creator.alarm[n] = ...` guard above — it must leave a
      // dotted `sprite_index`/`image_*`/`timeline_*` reference alone rather
      // than rewriting it against `_entity` (the *current* instance). Left
      // unguarded, `inst.image_xscale = imgx;` became
      // `inst.(() => { ... })();` — a dangling `.` with no property name, a
      // hard `SyntaxError` confirmed via a real `tsc --noEmit` run against
      // the real project's generated output.
      it.each([
        ["inst.sprite_index = spr_walk;\n", "inst."],
        ["inst.image_angle = 90;\n", "inst."],
        ["inst.image_xscale = imgx;\n", "inst."],
        ["inst.image_yscale = imgx;\n", "inst."],
        ["inst.image_alpha = 0.5;\n", "inst."],
        ["inst.image_blend = $ff00ff;\n", "inst."],
        ["inst.timeline_index = tmFoo;\n", "inst."],
        ["inst.timeline_running = true;\n", "inst."],
        ["inst.depth = -100;\n", "inst."],
        ["x = other.sprite_index;\n", "other."],
        ["x = other.image_xscale;\n", "other."],
        ["x = other.depth;\n", "other."],
      ])("does not corrupt %s", (gml, dottedPrefix) => {
        const out = transpileGML(gml);
        expect(() => new Function(out)).not.toThrow();
        expect(out).toContain(dottedPrefix);
        expect(out).not.toMatch(/\w\.\(\(\)\s*=>/);
      });

      it("still rewrites a bare (current-instance) sprite_index/image_*/timeline_index reference", () => {
        const out = transpileGML(
          "sprite_index = spr_walk;\nimage_xscale = 2;\ntimeline_index = tmFoo;\n",
        );
        expect(out).toContain("GmlActions.Sprite");
        expect(out).toContain("GmlActions.Transform");
        expect(out).toContain("GmlActions.TimelineState");
        expect(() => new Function(out)).not.toThrow();
      });
    });

    it("does not double-declare the second declarator of a comma-continued multi-line var statement", () => {
      // Real, confirmed regression against a real GameMaker project's own
      // `scr_kill_player.gml`: `var x_ = x,\n        y_ = y;` — GML's real
      // multi-declarator `var` syntax, byte-for-byte the same as standard
      // JS/TS's own comma-separated declarator list and already valid
      // output on its own. The generic "auto-declare on first bare
      // assignment" pass, scanning purely line-by-line with no memory of
      // the previous line, mistook the continuation line `y_ = y;` for its
      // own fresh statement and re-prefixed it with a second `var`,
      // producing `var x_ = x,\n  var y_ = y;` — a `var` keyword sitting
      // right after a trailing comma, a hard `SyntaxError: Trailing comma
      // not allowed`.
      const out = transpileGML("var x_ = 1,\n    y_ = 2;\nfoo(x_, y_);\n");
      expect(out.match(/\bvar\s+y_/g)).toBeNull();
      expect(out).not.toMatch(/,\s*\n\s*var\b/);
      expect(() => new Function(out)).not.toThrow();
    });

    it("does not treat the plain English word 'with' inside a // comment as a with-statement to rewrite", () => {
      // Real, confirmed regression: `// Draw the shadow with all the
      // calculations` is ordinary GML commentary, not a `with` statement.
      // The first version of the bare-`with` rewrite matched "with" inside
      // this comment and then swallowed everything up to the *next*
      // unrelated `{` — a real, later `if (...) {` several statements away
      // — as its supposed target, corrupting the whole span in between.
      const out = transpileGML(
        "// Draw the shadow with all the calculations\nshadow_size = 1;\nif (i < 64) {\n  foo();\n}\n",
      );
      expect(out).not.toContain("with ...");
      expect(out).toContain("shadow_size = 1;");
      expect(out).toContain("if (i < 64) {");
      expect(() => new Function(out)).not.toThrow();
    });

    it("rewrites a bare (paren-less) GML `with` target, not just `with (...)`", () => {
      // Real, confirmed regression: `with obj_solid { ... }` — GML allows
      // `with`'s target with no enclosing parens, same as `if`/`while`.
      // The parenthesised-only rewrite pass never matched this shape at
      // all, leaving the real `with` keyword in the output — a hard
      // `SyntaxError: Strict mode code may not include a with statement`
      // at module load (every generated event handler lives inside an ES
      // module, always strict mode).
      const out = transpileGML("with obj_solid {\n  foo();\n}\n");
      expect(out).not.toMatch(/\bwith\s+obj_solid\b/);
      expect(out).toContain("if (false)");
      expect(() => new Function(out)).not.toThrow();
    });
  });
});

import { describe, expect, it } from "vitest";
import { transpileGML, setGmlMacros } from "../gms2-transpile.js";

describe("transpileGML — place_meeting/collision query family", () => {
  it("transpiles a bare-condition place_meeting call, entity-threaded, with the object-name argument quoted", () => {
    const out = transpileGML(
      "if place_meeting(x + 4, y, obj_wall)\n{\n  x -= 4;\n}",
    );
    // Real, severe, previously-undiscovered bug: the object-name argument
    // used to pass through as an undeclared bare JS identifier — a hard
    // ReferenceError at runtime for every real place_meeting call, since
    // generic threading has no bare-identifier-to-string quoting logic.
    expect(out).toContain(
      'if (GmlActions.place_meeting(_entity, _ctx, x + 4, y, "obj_wall"))',
    );
  });

  it("threads instance_place/collision_rectangle the same way as other query functions, quoting each one's object-name argument", () => {
    const out = transpileGML(
      "other_wall = instance_place(x, y, obj_wall);\n" +
        "hit = collision_rectangle(x, y, x + 32, y + 32, obj_enemy, false, true);",
    );
    expect(out).toContain(
      'GmlActions.instance_place(_entity, _ctx, x, y, "obj_wall")',
    );
    expect(out).toContain(
      'GmlActions.collision_rectangle(_entity, _ctx, x, y, x + 32, y + 32, "obj_enemy", false, true)',
    );
  });

  it("place_meeting still tolerates a nested call in a non-object argument", () => {
    const out = transpileGML(
      "place_meeting(x + my_helper(4, dir), y, obj_wall);",
    );
    expect(out).toContain(
      'GmlActions.place_meeting(_entity, _ctx, x + my_helper(4, dir), y, "obj_wall");',
    );
  });

  it("place_meeting passes a non-identifier object argument (a dotted/member reference) through unchanged", () => {
    const out = transpileGML("place_meeting(x, y, other.wall_type);");
    expect(out).toContain(
      "GmlActions.place_meeting(_entity, _ctx, x, y, other.wall_type);",
    );
  });

  it("instance_exists/instance_number thread with a quoted object-name argument", () => {
    const out = transpileGML(
      "if (!instance_exists(obj_guardboss)) { n = instance_number(obj_enemy); }",
    );
    expect(out).toContain(
      'GmlActions.instance_exists(_entity, _ctx, "obj_guardboss")',
    );
    expect(out).toContain(
      'GmlActions.instance_number(_entity, _ctx, "obj_enemy")',
    );
  });

  it("place_meeting's all/noone special object references are not quoted as asset paths", () => {
    // 'all'/'noone' ARE bare identifiers syntactically, and bareOrQuoted
    // has no way to special-case them at the regex layer — they get quoted
    // into "all"/"noone" strings, which is exactly what
    // GmlCollisionQueries.ts's object-type resolution already expects (it
    // checks for the literal strings "all"/"noone" before falling back to
    // Meta.name resolution), so this is correct, not a gap.
    const out = transpileGML("place_meeting(x, y, all);");
    expect(out).toContain(
      'GmlActions.place_meeting(_entity, _ctx, x, y, "all");',
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

  it("leaves image_index/image_speed as honest per-instance state (no per-frame animation is modelled by this importer, but the value itself now really persists)", () => {
    const out = transpileGML("image_index = 0;\nimage_speed = 1;");
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "image_index", 0);',
    );
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "image_speed", 1);',
    );
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

  describe("compound assignment (+=/-=/etc.) — real gap found in obj_playerw/obj_bullet/obj_footstep", () => {
    it("image_yscale += is a real Transform.scaleY += write, not a broken read-side assignment target — real bug found in obj_playerw's Step_0.gml", () => {
      const out = transpileGML("image_yscale += (a - b)/100;");
      expect(out).toContain(
        "const _t = _entity.get(GmlActions.Transform); if (_t) _t.scaleY += (a - b)/100;",
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("image_xscale -= works the same way", () => {
      const out = transpileGML("image_xscale -= 0.1;");
      expect(out).toContain(
        "const _t = _entity.get(GmlActions.Transform); if (_t) _t.scaleX -= 0.1;",
      );
    });

    it("image_alpha -= is a real Sprite.alpha -= write — real gap found in obj_footstep's Step_0.gml", () => {
      const out = transpileGML("image_alpha -= 0.01;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.alpha -= 0.01;",
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("depth += correctly flips to a Sprite.depth -= in engine space — real gap found in obj_bullet's Step_0.gml", () => {
      const out = transpileGML("depth += 1;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) { const _gmlDepth = -(_sp.depth ?? 0); _sp.depth = -(_gmlDepth += (1)); }",
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("image_angle += converts the degree delta to radians with the same operator", () => {
      const out = transpileGML("image_angle += 5;");
      expect(out).toContain(
        "const _t = _entity.get(GmlActions.Transform); if (_t) _t.rotation += (5) * Math.PI / 180;",
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("timeline_speed += is a real TimelineState.speed += write", () => {
      const out = transpileGML("timeline_speed += 0.5;");
      expect(out).toContain(
        "const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.speed += 0.5;",
      );
    });
  });
});

describe("transpileGML", () => {
  it("global.x = expr routes through a real GlobalStore.set call, not a TODO comment", () => {
    const out = transpileGML("global.kills = 1;");
    expect(out).not.toContain("export let");
    expect(out).toContain('_ctx.game?.globals.set("kills", 1);');
  });

  it("global.x++ / global.x-- route through real GlobalStore read-modify-write calls", () => {
    const out = transpileGML("global.kills++;\nglobal.lives--;");
    expect(out).toContain(
      '_ctx.game?.globals.set("kills", (_ctx.game?.globals.get("kills") ?? 0) + 1)',
    );
    expect(out).toContain(
      '_ctx.game?.globals.set("lives", (_ctx.game?.globals.get("lives") ?? 0) - 1)',
    );
  });

  it("global.x += expr routes through a real GlobalStore read-modify-write call", () => {
    const out = transpileGML("global.score += 10;");
    expect(out).toContain(
      '_ctx.game?.globals.set("score", (_ctx.game?.globals.get("score") ?? 0) + (10));',
    );
  });

  it("a bare global.x read routes through a real GlobalStore.get call", () => {
    const out = transpileGML("if (global.hasgun == false) { x = 1; }");
    expect(out).toContain('(_ctx.game?.globals.get("hasgun"))');
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

  it("instance_destroy() threads into a real GmlActions.instance_destroy call, not an inert comment placeholder — severe real gap, confirmed used in 33 real files across two real projects", () => {
    const out = transpileGML("instance_destroy();");
    expect(out).toContain("GmlActions.instance_destroy(_entity, _ctx);");
    expect(out).not.toContain("undefined /* entity.destroy(); */");
  });

  it("instance_destroy() still threads correctly as a bare-if's single-statement body, alongside a real global.x read", () => {
    const out = transpileGML("if (global.hasgun == false) instance_destroy();");
    expect(out).toContain(
      'if ((_ctx.game?.globals.get("hasgun")) == false) GmlActions.instance_destroy(_entity, _ctx);',
    );
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

  it("wraps a bare (unparenthesised) while condition anchored by a following brace — real gap found in ini_read_inventory.gml", () => {
    const out = transpileGML(
      "while ini_key_exists(_section, _name+String(_i))\n{\n  foo();\n}",
    );
    expect(out).toContain("while (ini_key_exists(_section, _name+String(_i)))");
    expect(out).not.toMatch(/while\s+ini_key_exists/);
  });

  it("keeps a trailing // comment outside a wrapped bare-while condition's parens", () => {
    const out = transpileGML(
      "while has_more_items() // still going\n{\n  foo();\n}",
    );
    expect(out).toContain("while (has_more_items()) // still going");
  });

  it("does not touch an already-parenthesised while condition", () => {
    const out = transpileGML("while (i < 10)\n{\n  foo();\n}");
    expect(out).toContain("while (i < 10)");
    expect(out).not.toContain("while ((i < 10))");
  });

  it("wraps a bare (unparenthesised) switch subject anchored by a following brace — real gap found in scr_inputControlUpdateInputs.gml and scr_drawCurrentMenu.gml", () => {
    const out = transpileGML(
      "switch _inputDevice\n{\n  case -1:\n    break;\n}",
    );
    expect(out).toContain("switch (_inputDevice)");
  });

  it("wraps a bare switch subject that is itself a call, real gap found in scr_setOptionVariableStrings.gml", () => {
    const out = transpileGML(
      "switch window_get_fullscreen()\n{\n  case 0:\n    break;\n}",
    );
    expect(out).toContain("switch (window_get_fullscreen())");
  });

  it("does not touch an already-parenthesised switch subject", () => {
    const out = transpileGML("switch (x)\n{\n  case 1:\n    break;\n}");
    expect(out).toContain("switch (x)");
    expect(out).not.toContain("switch ((x))");
  });

  it("does not fuse consecutive semicolon-less if(cond) return statements into one broken condition — real gap found in draw_lightning.gml", () => {
    // GML allows omitting the trailing `;` entirely — a real, confirmed
    // shape (four consecutive semicolon-less `if (cond) return 0` lines in
    // a real project's draw_lightning.gml) that the "if (a) <trailing
    // operator>" pass's semicolon-only bail guard couldn't catch.
    const out = transpileGML(
      "if (max(a, b) < c - 10) return 0\nif (max(d, e) < f - 10) return 0\nif (g == 0)\n{\n  foo();\n}",
    );
    expect(out).toContain("if (max(a, b) < c - 10) return 0");
    expect(out).toContain("if (max(d, e) < f - 10) return 0");
    expect(out).not.toContain("return 0)");
  });

  it("still wraps a genuine trailing-operator condition continuation on one line", () => {
    const out = transpileGML(
      "if (_xAxis*_xAxis + _yAxis*+_yAxis) >= gamepadDeadzoneSquared\n{\n  foo();\n}",
    );
    expect(out).toContain(
      "if ((_xAxis*_xAxis + _yAxis*+_yAxis) >= gamepadDeadzoneSquared)",
    );
  });

  it("wraps a real brace-less single-statement if without swallowing its body — real gap found in obj_sway's Step_0.gml", () => {
    const out = transpileGML(
      "movement += value;\n\nif movement >= pi*2\nmovement = 0;\n\nx += 1;",
    );
    expect(out).toContain(
      'if ((GmlActions.getGmlVar(_entity, _ctx, "movement")) >= pi*2)',
    );
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "movement", 0);',
    );
    expect(out).toContain("x += 1;");
  });

  it("does not fuse a brace-less if's condition with a distant, unrelated later brace — real regression found in obj_rainController's Draw_0.gml", () => {
    const out = transpileGML(
      "if !surface_exists(surf) surf = surface_create(room_width, room_height);\nsurface_set_target(surf);\n\nif (other_thing)\n{\n  foo();\n}",
    );
    expect(out).toContain("if (!surface_exists(surf))");
    expect(out).toContain("surf = surface_create(room_width, room_height);");
    expect(out).not.toContain(
      "surf = surface_create(room_width, room_height);)",
    );
  });

  it("inserts a missing semicolon before a brace-less if/else's else branch — real gap found in oPlayer's Step_0.gml", () => {
    const out = transpileGML(
      "if (place_meeting(x, y+5, oIce)) friction = 0.2 else hspeed = 0;",
    );
    expect(out).toContain("friction = 0.2; else hspeed = 0;");
  });

  it("does not double up a semicolon already present before else", () => {
    const out = transpileGML("if (cond) foo(); else bar();");
    expect(out).toContain("if (cond) foo(); else bar();");
    expect(out).not.toContain(";; else");
  });

  it("leaves a brace-less if's body statement-valid when its body is a lone global assignment — real gap found in obj_ear's Step_0.gml", () => {
    const out = transpileGML("if (global.gain > 1)\n\tglobal.gain = 1;");
    // global.x = expr is now a real GlobalStore.set() call, a real
    // statement on its own — no longer needs a leading `;` placeholder to
    // stay valid as the if's single-statement body.
    expect(out).toContain('_ctx.game?.globals.set("gain", 1);');
    expect(() => new Function(out)).not.toThrow();
  });

  it("show_message tolerates a nested call in its message argument — real gap found in action_create_object.gml", () => {
    const out = transpileGML(
      'show_message( "creating instance for non-existent object" + string(id) );',
    );
    expect(out).toContain(
      'console.log("creating instance for non-existent object" + String(id));',
    );
  });

  it("ds_map write accessor tolerates a string-literal key that itself contains a ] — real gap found in keyboard_init.gml", () => {
    const out = transpileGML('l_s2c[?"]"] = 221;');
    expect(out).toContain('l_s2c.set("]", 221)');
  });

  it("ds_map read accessor tolerates a string-literal key that itself contains a ]", () => {
    const out = transpileGML('x = l_s2c[?"]"];');
    expect(out).toContain('l_s2c.get("]")');
  });

  it("repeat(n) tolerates a nested call in its count argument — real gap found in scr_capword.gml", () => {
    const out = transpileGML("repeat (string_length(str)) {\n  foo();\n}");
    // string_length(str) is itself separately rewritten to str.length by
    // another pass — this test only cares that repeat's own count-argument
    // capture is balanced-paren-aware, not that string_length stays as-is.
    expect(out).toContain("for (let _i = 0; _i < str.length; _i++)");
  });

  it("does not rewrite image_angle/sprite_index-like text inside a // comment — real gap found in scr_wave.gml", () => {
    const out = transpileGML(
      "// image_angle = Wave(-45,45,1,0,0)  -> rock back and forth 90 degrees in a second\nx = 1;",
    );
    // Only asserting the real, confirmed bug is fixed (a Transform-field
    // IIFE spliced into the comment text) — other, unrelated word-level
    // rewrites (and/or/not -> &&/||/!) are a separate, pre-existing,
    // broader gap in comment-handling not in scope here.
    expect(out).not.toContain("_entity.get(GmlActions.Transform)");
    expect(out).toContain("// image_angle = Wave(-45,45,1,0,0)");
  });

  it("does not treat a bare = equality inside a brace-less if's own condition as the body boundary — real gap found in scr_wave.gml", () => {
    const out = transpileGML("if argument4 = 0\nargument4 = current_time;");
    // The condition's own `=` (real GML equality, not assignment) is left
    // completely untouched — it's never a statement-start assignment, so
    // the implicit-instance-variable pass never treats it as one.
    expect(out).toContain("if (argument4 = 0)");
    // The real statement-start assignment on the next line *is* a genuine
    // implicit instance variable and now persists via GmlInstanceVars
    // rather than a function-scoped `var` — see "GML built-in instance
    // variables" below for the full rationale.
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "argument4", current_time);',
    );
    expect(out).not.toContain("if ()");
  });

  it("do-while: rewrites do { ... } until (cond); to do { ... } while (!(cond)) — real gap found in whole_bunch.gml", () => {
    const out = transpileGML(
      "do {\n  xx = random(room_width);\n} until (position_empty(xx, yy));",
    );
    expect(out).toContain(
      '} while (!(position_empty((GmlActions.getGmlVar(_entity, _ctx, "xx")), yy)));',
    );
    expect(out).not.toContain("until");
  });

  it("a global assignment sharing a physical line with real following code doesn't swallow it into a // comment — real gap found in obj_shop's Step_0.gml", () => {
    // A `//` line comment runs to end of line no matter what — it consumed
    // `canDraw = false; canEdit = false; }` (the block's own closing brace
    // included) into dead commentary, leaving the enclosing block
    // permanently unclosed.
    const out = transpileGML(
      "if (curPos == pos1[3]) { global.pause = false; canDraw = false; canEdit = false; }",
    );
    expect(out).toContain("canDraw = false;");
    expect(out).toContain("canEdit = false;");
    expect(out.trim().endsWith("}")).toBe(true);
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
    expect(out).toContain("GML comment/dead code omitted");
    expect(out).toContain('GmlActions.setGmlVar(_entity, _ctx, "x", 1);');
  });

  it("the comment-neutralisation placeholder contains no ] or ) — real bug found in keyboard_init.gml", () => {
    // Real source: `l_s2c[?chr(92)/* "\" */] = 220;` — a ds_map write
    // accessor whose key expression has an inline block comment. The old
    // placeholder text ("[GML comment/dead code omitted]") itself contained
    // a `]`, which terminated the ds_map accessor's `[^\]]+` key capture
    // early and corrupted the output into invalid syntax.
    const out = transpileGML('l_s2c[?chr(92)/* "\\" */] = 220;');
    expect(out).toContain(
      "l_s2c.set(chr(92)/* GML comment/dead code omitted */, 220)",
    );
  });

  it("reports a whole-file unterminated block comment as inert instead of transpiling it", () => {
    const out = transpileGML("/* this whole event was disabled\nx = 1;");
    expect(out).not.toContain("x = 1");
    expect(out).toMatch(/entirely inert/);
  });

  it("keeps room_goto valid as an unbraced if-body, now as a real threaded call", () => {
    const out = transpileGML("if (cond) room_goto(rm_next);");
    // room_goto used to be an inert placeholder comment — now it's a real
    // GmlActions.room_goto call, still valid as the if's single-statement
    // body either way.
    expect(out).toMatch(
      /if \(cond\) GmlActions\.room_goto\(_entity, _ctx, "rm_next"\);/,
    );
  });

  it("draw_sprite threads into a real _ctx.drawTarget.sprite() call — real gap found in obj_text/oTextbox, where a different sprite than the object's own is drawn", () => {
    const out = transpileGML("draw_sprite(spr_marker, 0, x, y);");
    expect(out).toContain(
      '_ctx.drawTarget?.sprite("./assets/sprites/spr_marker/frame_0.png", x, y);',
    );
  });

  it("draw_sprite passes a non-identifier sprite argument (a member expression) through unchanged", () => {
    const out = transpileGML("draw_sprite(obj_x.spr, 0, _drawX, _drawY);");
    expect(out).toContain(
      "_ctx.drawTarget?.sprite(obj_x.spr, _drawX, _drawY);",
    );
  });

  it("draw_sprite treats a bare identifier as an asset name, the same convention sprite_index already uses (including for a local-variable-shaped case, a real, pre-existing, accepted limitation — real project shape found in oTextbox's Draw_64.gml)", () => {
    const out = transpileGML("draw_sprite(_image, 0, _drawX, _drawY);");
    expect(out).toContain(
      '_ctx.drawTarget?.sprite("./assets/sprites/_image/frame_0.png", _drawX, _drawY);',
    );
  });

  it("draw_sprite keeps an unbraced if-body valid, now as a real threaded call", () => {
    const out = transpileGML("if (cond) draw_sprite(spr_foo, 0, x, y);");
    expect(out).toContain(
      'if (cond) _ctx.drawTarget?.sprite("./assets/sprites/spr_foo/frame_0.png", x, y);',
    );
  });

  it("draw_sprite(sprite_index, ...) correctly reads the entity's own current sprite instead of quoting 'sprite_index' as a literal asset name — real regression found in obj_transition's Draw_64.gml", () => {
    const out = transpileGML("draw_sprite(sprite_index, image_index, xx, yy);");
    expect(out).toContain(
      '_ctx.drawTarget?.sprite((_entity.get(GmlActions.Sprite)?.texturePath ?? ""), xx, yy);',
    );
    expect(out).not.toContain("sprites/sprite_index");
    expect(() => new Function(out)).not.toThrow();
  });

  it("audio_play_sound threads a bare sound-asset identifier into a real GmlActions.audio_play_sound call — real gap found in obj_player_dead/obj_Egun/obj_menu", () => {
    const out = transpileGML("audio_play_sound(snd_Shot, 5, false);");
    expect(out).toContain(
      'GmlActions.audio_play_sound(_entity, _ctx, "snd_Shot", 5, false);',
    );
  });

  it("audio_play_sound tolerates a choose(...) sub-call as its sound argument without misparsing the comma", () => {
    const out = transpileGML(
      "audio_play_sound(choose(snd_Foot1, snd_Foot2), 1, false);",
    );
    expect(out).toContain(
      "GmlActions.audio_play_sound(_entity, _ctx, choose(snd_Foot1, snd_Foot2), 1, false);",
    );
  });

  it("room_goto threads a bare room-asset identifier into a real GmlActions.room_goto call — real gap found in obj_game_start/obj_pause_menu", () => {
    const out = transpileGML("room_goto(rm_gamefcat);");
    expect(out).toContain(
      'GmlActions.room_goto(_entity, _ctx, "rm_gamefcat");',
    );
  });

  it("room_goto passes a non-identifier argument (a variable/dotted reference) through unchanged", () => {
    const out = transpileGML("room_goto(other.new_room);");
    expect(out).toContain(
      "GmlActions.room_goto(_entity, _ctx, other.new_room);",
    );
  });

  it("instance_create_layer threads into a real GmlActions.instance_create_layer call with a quoted bare object-name argument — severe real gap, confirmed 10+ real call sites in one real project", () => {
    const out = transpileGML(
      'var bomb = instance_create_layer(x, y, "Instances", obj_grenade);',
    );
    expect(out).toContain(
      'GmlActions.instance_create_layer(_entity, _ctx, x, y, "Instances", "obj_grenade");',
    );
    // Must not leave the object-name as an undeclared bare JS identifier
    // (a real ReferenceError at runtime).
    expect(out).not.toMatch(/,\s*obj_grenade\)/);
  });

  it("instance_create_layer works as a bare statement (the other confirmed common real shape)", () => {
    const out = transpileGML(
      'instance_create_layer(x, y, "Front", obj_saves_text);',
    );
    expect(out).toContain(
      'GmlActions.instance_create_layer(_entity, _ctx, x, y, "Front", "obj_saves_text");',
    );
  });

  it("with (instance_create_layer(...)) { ... } preserves the real spawn call instead of discarding it — real gap found in obj_enemy_mreg's Step_0.gml", () => {
    const out = transpileGML(
      'with (instance_create_layer( x, y, "Bullets", obj_bullet_enemy))\n{\n  foo();\n}',
    );
    expect(out).toContain(
      'GmlActions.instance_create_layer(_entity, _ctx, x, y, "Bullets", "obj_bullet_enemy");',
    );
    expect(out).toContain("if (false)");
    expect(() => new Function(out)).not.toThrow();
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

  it("turns the #macro directive line itself into a comment (fixing its own syntax error)", () => {
    const out = transpileGML("#macro VIEW view_camera[0]\nx = VIEW;");
    expect(out).not.toMatch(/^\s*#macro/m);
    expect(out).toContain("// #macro VIEW");
  });

  it("substitutes a real project-wide macro value at every use site — real gap: this used to leave every use site an undeclared bare identifier (ReferenceError)", () => {
    setGmlMacros(new Map([["SAVEFILE", '"freedom.sav"']]));
    try {
      const out = transpileGML(
        "var file = file_text_open_write(working_directory + SAVEFILE);",
      );
      expect(out).toContain('working_directory + ("freedom.sav")');
    } finally {
      setGmlMacros(new Map());
    }
  });

  it("does not substitute a macro name inside a dotted reference or a // comment", () => {
    setGmlMacros(new Map([["SAVEFILE", '"freedom.sav"']]));
    try {
      const out = transpileGML(
        "x = other.SAVEFILE;\n// SAVEFILE is the save file name",
      );
      expect(out).toContain("other.SAVEFILE");
      expect(out).toContain("// SAVEFILE is the save file name");
    } finally {
      setGmlMacros(new Map());
    }
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
    it("routes a bare assignment to a known built-in (e.g. image_speed) through real per-instance persistence, not a function-scoped var", () => {
      const out = transpileGML("image_speed = 0;\nimage_index = 0;");
      // A real, severe, previously-undiscovered regression this replaces:
      // a plain `var image_speed = 0;` is scoped to *this one generated
      // event function* — a later event reading `image_speed` would see a
      // fresh, undeclared identifier, never the value Create actually set.
      // GmlInstanceVars (compat/gmlInstanceVars.ts) is the real fix: a
      // per-(World, eid) side-table that genuinely persists for the whole
      // entity lifetime, the same way a real GameMaker instance field does.
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "image_speed", 0);',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "image_index", 0);',
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("also routes a first bare assignment to a project-defined (non-built-in) instance variable through real persistence", () => {
      // Real, confirmed regression: `obj_crate`'s Create event does
      // `mywall = instance_create_layer(...);` — GML implicitly declares
      // `mywall` on this first assignment, and Freedom Backup's own
      // obj_camera reads several such implicit fields (cam, follow,
      // shake_remain, ...) every frame in Step after Create sets them —
      // real cross-event persistence, not just within-one-event validity.
      const out = transpileGML("mywall = 5;\nmywall = mywall + 1;");
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "mywall", 5);',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "mywall", (GmlActions.getGmlVar(_entity, _ctx, "mywall")) + 1);',
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("does not redeclare a name that was already declared by an earlier pass (e.g. ds_list/ds_map/ds_grid create)", () => {
      const out = transpileGML("var list = ds_list_create();\nlist = list;");
      expect(out).toContain("var list = [];");
      // Second assignment must stay a plain assignment, not `var list = list;`.
      expect(out.match(/var list/g)?.length).toBe(1);
    });

    it("does not rewrite an implicit variable's name when it appears inside an unrelated string literal — real gap found in obj_trans.gml", () => {
      // Real, confirmed regression: `trans_intro0 = load_string("trans_intro0");`
      // — a save-key string literal that happens to equal the variable's own
      // name, an ordinary naming convention, not a contrived edge case. A
      // bare-word regex has no notion of string boundaries, so without
      // masking, the bare-read pass matched *inside* the string literal too,
      // splicing a GmlActions.getGmlVar(...) call into the middle of a
      // quoted string — a hard SyntaxError.
      const out = transpileGML('trans_intro0 = load_string("trans_intro0");');
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "trans_intro0", load_string("trans_intro0"));',
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("captures a multi-line assignment RHS in full — real gap found in obj_trans.gml", () => {
      // Real, confirmed regression: obj_trans's Create event does
      // `fin_msg = choose(trans_intro8, trans_intro9, trans_intro10,\n
      // trans_intro11, ..., trans_intro19);` — a single real GML statement
      // whose call arguments wrap across several physical lines. The
      // plain-assignment rewrite used to capture only up to the first
      // newline ([^;\n]+), truncating the expression mid-call and leaving
      // its continuation lines as orphaned, syntactically invalid
      // fragments — a hard SyntaxError.
      const out = transpileGML(
        "fin_msg = choose(a, b, c,\n  d, e,\n  f);\nx = 1;",
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "fin_msg", choose(a, b, c,\n  d, e,\n  f));',
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("does not merge a bare (semicolon-omitted) statement into the next line's own statement — real gap found in obj_enemy.gml", () => {
      // Real, confirmed regression: obj_enemy's Step event has
      // `grounded = true\nimage_speed = 1;` — GML's `;` is optional, so the
      // bare newline alone ends the first statement. The multi-line-RHS fix
      // above (which must keep scanning past a newline for a genuinely
      // open call like `choose(a,\n b)`) initially over-corrected: it kept
      // scanning past *any* newline regardless of paren depth, merging
      // `image_speed = 1;` straight into `grounded`'s own expression.
      const out = transpileGML("grounded = true\nimage_speed = 1;");
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "grounded", true);',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "image_speed", 1);',
      );
      expect(() => new Function(out)).not.toThrow();
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
        // statements. `hsp` is a real implicit instance variable (assigned
        // later via `hsp = 0;`), so its read here routes through
        // GmlInstanceVars like any other genuine read.
        expect(out).toMatch(
          /^if \(sign\(\(GmlActions\.getGmlVar\(_entity, _ctx, "hsp"\)\)\) != 0\) /,
        );
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
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "shadow_size", 1);',
      );
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

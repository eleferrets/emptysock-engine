import { describe, expect, it } from "vitest";
import {
  transpileGML,
  setGmlMacros,
  setGmlEnumNames,
  setGmlObjectNames,
} from "../gms2-transpile.js";

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
      'if (GmlActions.place_meeting(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0) + 4, (_entity.get(GmlActions.Transform)?.y ?? 0), "obj_wall"))',
    );
  });

  it("threads instance_place/collision_rectangle the same way as other query functions, quoting each one's object-name argument", () => {
    const out = transpileGML(
      "other_wall = instance_place(x, y, obj_wall);\n" +
        "hit = collision_rectangle(x, y, x + 32, y + 32, obj_enemy, false, true);",
    );
    expect(out).toContain(
      'GmlActions.instance_place(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), "obj_wall")',
    );
    expect(out).toContain(
      'GmlActions.collision_rectangle(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), (_entity.get(GmlActions.Transform)?.x ?? 0) + 32, (_entity.get(GmlActions.Transform)?.y ?? 0) + 32, "obj_enemy", false, true)',
    );
  });

  it("place_meeting still tolerates a nested call in a non-object argument", () => {
    const out = transpileGML(
      "place_meeting(x + my_helper(4, dir), y, obj_wall);",
    );
    expect(out).toContain(
      'GmlActions.place_meeting(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0) + my_helper(4, dir), (_entity.get(GmlActions.Transform)?.y ?? 0), "obj_wall");',
    );
  });

  it("place_meeting passes a non-identifier object argument (a dotted/member reference) through unchanged", () => {
    const out = transpileGML("place_meeting(x, y, other.wall_type);");
    expect(out).toContain(
      "GmlActions.place_meeting(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), other.wall_type);",
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
      'GmlActions.place_meeting(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), "all");',
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
      "const _t = _entity.get(GmlActions.Transform); if (_t) _t.scaleX = GmlActions.sign(hsp);",
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
    expect(out).toContain("const _bl = (GmlActions.c_red);");
    expect(out).toContain(
      "const _bb = (_bl >> 16) & 0xff; const _gg = (_bl >> 8) & 0xff; const _rr = _bl & 0xff; _sp.tint = (_rr << 16) | (_gg << 8) | _bb;",
    );
    expect(out).toContain(
      "((_t & 0xff) << 16) | (_t & 0xff00) | ((_t >> 16) & 0xff)",
    );
  });

  it("rewrites image_index/image_speed onto real Sprite.currentFrame/frameSpeed fields (superseding the old setGmlVar honest-gap behaviour — see CLAUDE.md's GMS2 rendering built-ins entry)", () => {
    const out = transpileGML("image_index = 0;\nimage_speed = 1;");
    expect(out).toContain(
      "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.currentFrame = 0;",
    );
    expect(out).toContain(
      "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.frameSpeed = 1;",
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

  describe("image_index / image_speed — multi-frame sprite animation", () => {
    it("rewrites a plain image_index assignment onto Sprite.currentFrame", () => {
      const out = transpileGML("image_index = 0;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.currentFrame = 0;",
      );
    });

    it("rewrites a bare read of image_index", () => {
      const out = transpileGML("var frame = image_index;");
      expect(out).toContain(
        "(_entity.get(GmlActions.Sprite)?.currentFrame ?? 0)",
      );
    });

    it("rewrites image_index += with no unit conversion", () => {
      const out = transpileGML("image_index += 1;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.currentFrame += 1;",
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("rewrites a plain image_speed assignment onto Sprite.frameSpeed", () => {
      const out = transpileGML("image_speed = 0.5;");
      expect(out).toContain(
        "const _sp = _entity.get(GmlActions.Sprite); if (_sp) _sp.frameSpeed = 0.5;",
      );
    });

    it("rewrites a bare read of image_speed", () => {
      const out = transpileGML("var s = image_speed;");
      expect(out).toContain(
        "(_entity.get(GmlActions.Sprite)?.frameSpeed ?? 1)",
      );
    });

    it("leaves a dotted reference to another instance's image_index/image_speed unresolved", () => {
      const out = transpileGML("other.image_index = 0;\ninst.image_speed = 1;");
      expect(out).toContain("other.image_index = 0;");
      expect(out).toContain("inst.image_speed = 1;");
    });

    it("does not misfire on a stray apostrophe in a nearby comment", () => {
      const out = transpileGML(
        "// The player's animation frame\nimage_index = 0;\nimage_speed = 1;",
      );
      expect(out).toContain("_sp.currentFrame = 0;");
      expect(out).toContain("_sp.frameSpeed = 1;");
    });

    it("produces valid, runnable JS for a real image_index=0; image_speed=1; Create-event shape", () => {
      const out = transpileGML("image_index = 0;\nimage_speed = 1;");
      expect(() => new Function("_entity", "GmlActions", out)).not.toThrow();
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

  it("rewrites a GML with(...) block into real GmlActions.with_each iteration", () => {
    const out = transpileGML("with (other_instance) { x = 1; }");
    // Strip the explanatory comment before asserting: the message itself
    // legitimately mentions "with (" as plain text.
    const code = out.replace(/\/\*.*?\*\//gs, "");
    expect(code).not.toMatch(/\bwith\s*\(/);
    // "other_instance" isn't a known implicit variable in this isolated
    // snippet, so it's treated as a bare object-type name and quoted —
    // exactly the same "known var vs. literal type name" ambiguity
    // `bareOrQuotedUnlessVar` already resolves for place_meeting etc.
    expect(out).toContain(
      'GmlActions.with_each(_ctx, "other_instance", (_entity) => {',
    );
    // The body is spliced in and later passes (the implicit-var rewrite)
    // process it normally, since `_entity` inside the callback shadows the
    // caller's own `_entity` — GmlInstanceVars now persists against the
    // *iterated* instance, not the instance that entered the with block.
    expect(out).toContain("_t.x = 1;");
    expect(() => new Function(out)).not.toThrow();
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
      "if ((GmlActions.point_distance(a, 0) > 0.2) || (GmlActions.point_distance(b, 0) > 0.2))",
    );
  });

  it("wraps a bare (unparenthesised) if condition anchored by a following brace", () => {
    const out = transpileGML(
      "if my_condition_fn(x, y, obj_wall)\n{\n  foo();\n}",
    );
    expect(out).toContain(
      "if (my_condition_fn((_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), obj_wall))",
    );
  });

  it("wraps a bare if !expr condition (not just the already-parenthesised if !(expr) case)", () => {
    const out = transpileGML(
      "if !my_condition_fn(x, y, obj) && cond2\n{\n  foo();\n}",
    );
    expect(out).toContain(
      "if (!my_condition_fn((_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), obj) && cond2)",
    );
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
    expect(out).toContain(
      "switch ((_entity.get(GmlActions.Transform)?.x ?? 0))",
    );
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
    expect(out).toContain("if (GmlActions.max(a, b) < c - 10) return 0");
    expect(out).toContain("if (GmlActions.max(d, e) < f - 10) return 0");
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
      'if (GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "movement")) >= pi*2)',
    );
    expect(out).toContain(
      'GmlActions.setGmlVar(_entity, _ctx, "movement", 0);',
    );
    expect(out).toContain("_t.x += (1)");
  });

  it("does not fuse a brace-less if's condition with a distant, unrelated later brace — real regression found in obj_rainController's Draw_0.gml", () => {
    const out = transpileGML(
      "if !surface_exists(surf) surf = surface_create(room_width, room_height);\nsurface_set_target(surf);\n\nif (other_thing)\n{\n  foo();\n}",
    );
    expect(out).toContain("if (!surface_exists(surf))");
    // `room_width`/`room_height` are now real, wired bare-built-in-variable
    // rewrites (see the dedicated describe block below) — this assertion
    // was updated to match rather than to keep asserting the pre-fix,
    // unresolved-identifier output.
    expect(out).toContain(
      "surf = surface_create(GmlActions.room_width(), GmlActions.room_height());",
    );
    expect(out).not.toContain(
      "surf = surface_create(GmlActions.room_width(), GmlActions.room_height());)",
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
    // `id` (GameMaker's own instance-id built-in) is now a real rewrite onto
    // `_entity` — see the "GameMaker's `id` built-in" transpile pass; this
    // test's own point (a nested `string(id)` call inside show_message's
    // argument doesn't break the outer paren-balance scan) still holds.
    expect(out).toContain(
      'console.log("creating instance for non-existent object" + String(_entity));',
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
    expect(out).not.toMatch(/\/\/[^\n]*_entity\.get\(GmlActions\.Transform\)/);
    expect(out).toContain("// image_angle = Wave(-45,45,1,0,0)");
    // The real code line *after* the comment is correctly rewritten — the
    // comment itself is inert, real code that follows it is not.
    expect(out).toContain("_t.x = 1;");
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
      '} while (!(position_empty(GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "xx")), yy)));',
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
    expect(out).toContain("_t.x = 1;");
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
      '_ctx.drawTarget?.sprite("./assets/sprites/spr_marker/frame_0.png", (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0));',
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
      'if (cond) _ctx.drawTarget?.sprite("./assets/sprites/spr_foo/frame_0.png", (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0));',
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
      "GmlActions.audio_play_sound(_entity, _ctx, GmlActions.choose(snd_Foot1, snd_Foot2), 1, false);",
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
      'GmlActions.instance_create_layer(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), "Instances", "obj_grenade");',
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
      'GmlActions.instance_create_layer(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), "Front", "obj_saves_text");',
    );
  });

  it("with (instance_create_layer(...)) { ... } runs the real spawn call and iterates the real spawned entity — real gap found in obj_enemy_mreg's Step_0.gml", () => {
    const out = transpileGML(
      'with (instance_create_layer( x, y, "Bullets", obj_bullet_enemy))\n{\n  foo();\n}',
    );
    // The spawn call itself is the with_each target expression (a real
    // Entity | undefined value) — no stray trailing `;` from
    // instance_create_layer's own standalone-statement rewrite, which
    // would otherwise land inside with_each's own argument list.
    expect(out).toContain(
      'GmlActions.with_each(_ctx, GmlActions.instance_create_layer(_entity, _ctx, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), "Bullets", "obj_bullet_enemy"), (_entity) => {',
    );
    expect(out).toContain("foo();");
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
      "for (let i = GmlActions.array_length_1d(arr) - 1; i >= 0; --i)",
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
    expect(out).toContain("room_next(GmlActions.room(_ctx))");
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
      // `list` here is genuinely undeclared (no prior `var list = ...`),
      // so once the `[| ]` accessor syntax is stripped to plain `[0]` it
      // is correctly picked up by the separate implicit-array-variable
      // pass and routed through `GmlActions.getGmlArrayVar` — the same
      // real behaviour a bare `endtext[0] = "...";` gets elsewhere in this
      // file's own implicit-array-var tests. This is not a regression:
      // declaring `list` first (`var list = [];`) keeps it a plain local
      // array with plain indexing, covered by the sibling test above.
      const readOut = transpileGML("var list = []; var v = list[| 0];");
      expect(readOut).toContain("var v = list[0];");
      const writeOut = transpileGML("list[| 0] = 5;");
      expect(writeOut).toContain(
        'GmlActions.getGmlArrayVar(_entity, _ctx, "list")[0] = 5;',
      );
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
    it("routes a bare assignment to a known built-in (e.g. shake_remain) through real per-instance persistence, not a function-scoped var", () => {
      // `image_speed`/`image_index` used to be this test's example, but
      // both are now rewritten onto real `Sprite.currentFrame`/`frameSpeed`
      // fields by a dedicated earlier pass (see the "image_index /
      // image_speed" describe block above) — by the time this generic
      // implicit-var pass runs, neither bare identifier exists in the text
      // any more to route through `setGmlVar`. `shake_remain` (a real,
      // project-defined camera-shake field from Freedom Backup's own
      // obj_camera) is a genuinely un-special-cased instance variable,
      // exercising the same real regression this test documents.
      const out = transpileGML("shake_remain = 0;\nvisible = true;");
      // A real, severe, previously-undiscovered regression this replaces:
      // a plain `var shake_remain = 0;` is scoped to *this one generated
      // event function* — a later event reading `shake_remain` would see a
      // fresh, undeclared identifier, never the value Create actually set.
      // GmlInstanceVars (compat/gmlInstanceVars.ts) is the real fix: a
      // per-(World, eid) side-table that genuinely persists for the whole
      // entity lifetime, the same way a real GameMaker instance field does.
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "shake_remain", 0);',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "visible", true);',
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
        'GmlActions.setGmlVar(_entity, _ctx, "mywall", GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "mywall")) + 1);',
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
        'GmlActions.setGmlVar(_entity, _ctx, "fin_msg", GmlActions.choose(a, b, c,\n  d, e,\n  f));',
      );
      expect(() => new Function(out)).not.toThrow();
    });

    it("does not merge a bare (semicolon-omitted) statement into the next line's own statement — real gap found in obj_enemy.gml", () => {
      // Real, confirmed regression: obj_enemy's Step event has
      // `grounded = true\nshake_remain = 1;` — GML's `;` is optional, so the
      // bare newline alone ends the first statement. The multi-line-RHS fix
      // above (which must keep scanning past a newline for a genuinely
      // open call like `choose(a,\n b)`) initially over-corrected: it kept
      // scanning past *any* newline regardless of paren depth, merging
      // `shake_remain = 1;` straight into `grounded`'s own expression.
      // (`image_speed` was this test's original filler identifier; it now
      // has its own dedicated rewrite — see the "image_index / image_speed"
      // describe block above — so a genuinely un-special-cased built-in is
      // used here instead, to keep exercising this pass, not that one.)
      const out = transpileGML("grounded = true\nshake_remain = 1;");
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "grounded", true);',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "shake_remain", 1);',
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
          /^if\ \(GmlActions\.sign\(GmlActions\.gmlNum\(GmlActions\.getGmlVar\(_entity,\ _ctx,\ "hsp"\)\)\)\ !=\ 0\)/,
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
      expect(out).toContain(
        'GmlActions.with_each(_ctx, "obj_solid", (_entity) => {',
      );
      expect(out).toContain("foo();");
      expect(() => new Function(out)).not.toThrow();
    });

    it("rewrites with (var) singleStatement; (no braces) — real, extremely common shape confirmed against Freedom Backup", () => {
      // Real, confirmed shape: `with (mywall) instance_destroy();` —
      // obj_crate's real Destroy_0.gml. `mywall` is a known implicit
      // instance variable (assigned earlier in the same object), so it's
      // passed through as a real Entity-valued expression rather than
      // quoted as an object-type-name string.
      const out = transpileGML(
        "mywall = 5;\nwith (mywall) instance_destroy();",
      );
      expect(out).toContain(
        'GmlActions.with_each(_ctx, GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "mywall")), (_entity) => {',
      );
      expect(out).toContain("GmlActions.instance_destroy(_entity, _ctx);");
      expect(() => new Function(out)).not.toThrow();
    });

    it("rewrites with (other) { ... } and re-scopes a nested `other` inside the body to the with-caller", () => {
      // Real, confirmed shape: obj_player/obj_pna's real
      // Collision_obj_Ebullet.gml: `with (other) instance_destroy();`.
      // Freedom Backup's own obj_player_dead/Create_0.gml goes further:
      // `with (obj_camera) follow = other.id;` — a with-body that itself
      // reads `other`, meaning the instance that *entered* the with block
      // (the collision's own _other), not the newly-iterated obj_camera
      // instance.
      const out = transpileGML(
        "with (obj_camera) { follow = other.id; }",
        [],
        new Set(),
        true,
      );
      expect(out).toContain(
        'GmlActions.with_each(_ctx, "obj_camera", (_entity) => { const _other = _withCaller;',
      );
      expect(out).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "follow", _other.id);',
      );
      expect(() => new Function(out)).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// GameMaker's colour constants and pure (non-entity) built-in functions —
// compat/gml.ts fully implements and exports ~20 of these (sign, lerp,
// random_range, choose, point_distance, c_white, c_black, ...) but nothing
// in this transpiler ever rewrote a bare call/reference to route through
// them — a real, confirmed, severe gap: Freedom Backup's own obj_camera
// calls sign(hsp)/random_range(...) every frame, and uses c_white/c_black/
// c_gray roughly 48 times across 20 files, every one left as a bare,
// undeclared identifier (a hard ReferenceError at runtime).
// ---------------------------------------------------------------------------

describe("transpileGML — GML colour constants and pure built-in functions", () => {
  it("rewrites a bare colour constant to the real GmlActions export", () => {
    const out = transpileGML("draw_set_colour(c_red);\nx = c_white;");
    expect(out).toContain("GmlActions.c_red");
    expect(out).toContain("GmlActions.c_white");
  });

  it("does not rewrite a colour-constant-named property access (dotted reference)", () => {
    const out = transpileGML("x = other.c_red;");
    expect(out).toContain("other.c_red");
    expect(out).not.toContain("other.GmlActions.c_red");
  });

  it("rewrites pure built-in function calls (sign/random_range/choose/degtorad/array_length_1d/...) to real GmlActions calls", () => {
    // lerp/point_distance/string already have their own dedicated,
    // native-JS inline-translation passes elsewhere in this file (running
    // *before* this generic pass, which correctly leaves their
    // already-rewritten output alone rather than double-wrapping it) —
    // covered separately below, not asserted here.
    const out = transpileGML(
      "a = sign(x);\n" +
        "c = random_range(-5, 5);\n" +
        "d = choose(1, 2, 3);\n" +
        "f = degtorad(90);\n" +
        "g = array_length_1d(arr);\n",
    );
    expect(out).toContain(
      "GmlActions.sign((_entity.get(GmlActions.Transform)?.x ?? 0))",
    );
    expect(out).toContain("GmlActions.random_range(-5, 5)");
    expect(out).toContain("GmlActions.choose(1, 2, 3)");
    expect(out).toContain("GmlActions.degtorad(90)");
    expect(out).toContain("GmlActions.array_length_1d(arr)");
    expect(() => new Function(out)).not.toThrow();
  });

  it("leaves lerp/point_distance/string alone, already handled by their own dedicated native-JS translation passes", () => {
    const out = transpileGML(
      "b = lerp(0, 10, 0.5);\ne = point_distance(0, 0, x, y);\nh = string(5);\n",
    );
    expect(out).not.toContain("GmlActions.lerp");
    expect(out).not.toContain("GmlActions.point_distance");
    expect(out).not.toContain("GmlActions.string(");
    expect(out).toContain("0 + (10 - 0) * 0.5");
    expect(out).toContain(
      "Math.hypot((_entity.get(GmlActions.Transform)?.x ?? 0) - 0, (_entity.get(GmlActions.Transform)?.y ?? 0) - 0)",
    );
    expect(out).toContain("String(5)");
    expect(() => new Function(out)).not.toThrow();
  });

  it("does not rewrite a pure function call sitting behind a dotted reference", () => {
    const out = transpileGML("x = other.sign(5);");
    expect(out).toContain("other.sign(5)");
    expect(out).not.toContain("other.GmlActions.sign");
  });

  it("does not mis-rewrite string_length, already handled by its own dedicated pass, as a bare `string` reference", () => {
    const out = transpileGML("x = string_length(s);");
    expect(out).not.toContain("GmlActions.string(");
  });
});

describe("transpileGML — room_width/room_height bare built-in variables", () => {
  it("rewrites a bare room_width/room_height read to a GmlActions call", () => {
    // `surface_resize` is itself a real, threaded GmlActions.surface_resize
    // call now (see the "GMS2 transpiler..." CLAUDE.md follow-up pass), so
    // this asserts the room_width/room_height rewrite fired *inside* it
    // rather than the call site staying untouched.
    const out = transpileGML("surface_resize(surf, room_width, room_height);");
    expect(out).toContain(
      "GmlActions.surface_resize(_ctx, surf, GmlActions.room_width(), GmlActions.room_height());",
    );
    expect(() => new Function(out)).not.toThrow();
  });

  it("does not double-rewrite an already-function-call-shaped occurrence", () => {
    const out = transpileGML("surface_resize(surf, room_width, room_height);");
    expect(out).not.toContain("room_width()()");
  });

  it("does not rewrite a dotted reference to another instance's room_width", () => {
    const out = transpileGML("x = other.room_width;");
    expect(out).toContain("other.room_width");
    expect(out).not.toContain("other.GmlActions.room_width");
  });
});

describe("transpileGML — GameMaker legacy d3d_* pseudo-3D projection compat", () => {
  it("threads the calling entity through d3d_set_projection_ortho/perspective", () => {
    const out = transpileGML(
      "d3d_set_projection_ortho(x, y, 64, 64, 0);\n" +
        "d3d_set_projection_perspective(x, y, 64, 64, 0);\n",
    );
    expect(out).toContain(
      "GmlActions.d3d_set_projection_ortho(_entity, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), 64, 64, 0)",
    );
    expect(out).toContain(
      "GmlActions.d3d_set_projection_perspective(_entity, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), 64, 64, 0)",
    );
  });

  it("threads the calling entity through every d3d_transform_set_* call, including zero-argument ones", () => {
    const out = transpileGML(
      "d3d_transform_set_identity();\n" +
        "d3d_transform_set_translation(x, y, 0);\n" +
        "d3d_transform_set_rotation_z(45);\n" +
        "d3d_transform_set_rotation_x(30);\n" +
        "d3d_transform_set_rotation_y(30);\n" +
        "d3d_transform_set_scaling(2, 2, 1);\n" +
        "d3d_transform_clear();\n",
    );
    expect(out).toContain("GmlActions.d3d_transform_set_identity(_entity)");
    expect(out).toContain(
      "GmlActions.d3d_transform_set_translation(_entity, (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), 0)",
    );
    expect(out).toContain(
      "GmlActions.d3d_transform_set_rotation_z(_entity, 45)",
    );
    expect(out).toContain(
      "GmlActions.d3d_transform_set_rotation_x(_entity, 30)",
    );
    expect(out).toContain(
      "GmlActions.d3d_transform_set_rotation_y(_entity, 30)",
    );
    expect(out).toContain(
      "GmlActions.d3d_transform_set_scaling(_entity, 2, 2, 1)",
    );
    expect(out).toContain("GmlActions.d3d_transform_clear(_entity)");
  });
});

describe("transpileGML — GameMaker particle-function family (part_type_*/part_system_*/part_particles_*)", () => {
  it("rewrites pure, non-context particle functions with no _entity/_ctx threading", () => {
    const out = transpileGML(
      "part_type_create();\n" +
        "part_type_shape(1, 0);\n" +
        "part_type_size(1, 0.1, 0.3, 0, 0);\n" +
        "part_type_colour1(1, c_red);\n" +
        "part_type_blend(1, true);\n" +
        "part_system_create();\n" +
        "part_system_position(1, 4, 5);\n" +
        "part_particles_clear(1);\n",
    );
    expect(out).toContain("GmlActions.part_type_create()");
    expect(out).toContain("GmlActions.part_type_shape(1, 0)");
    expect(out).toContain("GmlActions.part_type_size(1, 0.1, 0.3, 0, 0)");
    expect(out).toContain("GmlActions.part_type_colour1(1, GmlActions.c_red)");
    expect(out).toContain("GmlActions.part_type_blend(1, true)");
    expect(out).toContain("GmlActions.part_system_create()");
    expect(out).toContain("GmlActions.part_system_position(1, 4, 5)");
    expect(out).toContain("GmlActions.part_particles_clear(1)");
    expect(() => new Function(out)).not.toThrow();
  });

  it("threads _ctx (not _entity) through part_system_destroy/part_particles_create/part_particles_create_colour", () => {
    const out = transpileGML(
      "part_particles_create(1, 4, 5, 2, 5);\n" +
        "part_particles_create_colour(1, 4, 5, 2, c_red, 5);\n" +
        "part_system_destroy(1);\n",
    );
    expect(out).toContain(
      "GmlActions.part_particles_create(_ctx, 1, 4, 5, 2, 5)",
    );
    expect(out).toContain(
      "GmlActions.part_particles_create_colour(_ctx, 1, 4, 5, 2, GmlActions.c_red, 5)",
    );
    expect(out).toContain("GmlActions.part_system_destroy(_ctx, 1)");
  });

  it("does not rewrite a dotted reference to another instance's particle-function-named field", () => {
    const out = transpileGML("x = other.part_type_create();");
    expect(out).toContain("other.part_type_create()");
    expect(out).not.toContain("other.GmlActions.part_type_create");
  });
});

describe("transpileGML — layer_sequence_create()", () => {
  it("threads layer_sequence_create context-only, quoting nothing (all real arguments, no object-type name)", () => {
    const out = transpileGML(
      'inst = layer_sequence_create("Effects", x, y, sqExplosion);',
    );
    expect(out).toContain(
      'GmlActions.layer_sequence_create(_ctx, "Effects", (_entity.get(GmlActions.Transform)?.x ?? 0), (_entity.get(GmlActions.Transform)?.y ?? 0), sqExplosion)',
    );
  });

  it("threads with no arguments beyond _ctx when the call itself takes none", () => {
    const out = transpileGML("layer_sequence_create();");
    expect(out).toContain("GmlActions.layer_sequence_create(_ctx)");
  });
});

describe("transpileGML — GMS2.3+ array function family", () => {
  it("rewrites array_push/array_pop/array_length to GmlActions calls", () => {
    const out = transpileGML(
      "array_push(inv, item);\n" +
        "var last = array_pop(inv);\n" +
        "var n = array_length(inv);",
    );
    expect(out).toContain("GmlActions.array_push(inv, item);");
    expect(out).toContain("GmlActions.array_pop(inv)");
    expect(out).toContain("GmlActions.array_length(inv)");
  });

  it("rewrites array_insert/array_delete/array_sort/array_contains", () => {
    const out = transpileGML(
      "array_insert(inv, 0, item);\n" +
        "array_delete(inv, 0, 1);\n" +
        "array_sort(inv, true);\n" +
        "var has = array_contains(inv, item);",
    );
    expect(out).toContain("GmlActions.array_insert(inv, 0, item);");
    expect(out).toContain("GmlActions.array_delete(inv, 0, 1);");
    expect(out).toContain("GmlActions.array_sort(inv, true);");
    expect(out).toContain("GmlActions.array_contains(inv, item)");
  });

  it("rewrites array_map/array_filter/array_reduce, callback expression passed through untouched", () => {
    const out = transpileGML(
      "var doubled = array_map(nums, function(v, i) { return v * 2; });",
    );
    expect(out).toContain("GmlActions.array_map(nums, function(v, i)");
  });

  it("rewrites array_create/array_resize", () => {
    const out = transpileGML(
      "var arr = array_create(4, 0);\narray_resize(arr, 8);",
    );
    expect(out).toContain("GmlActions.array_create(4, 0)");
    expect(out).toContain("GmlActions.array_resize(arr, 8);");
  });
});

describe("transpileGML — GMS2.3+ struct/static/function literal syntax", () => {
  it("struct literals pass through unchanged (already valid JS)", () => {
    const out = transpileGML("var s = {a: 1, b: 2};");
    expect(out).toContain("var s = {a: 1, b: 2};");
  });

  it("function literals with self/other references pass through unchanged", () => {
    const out = transpileGML(
      "var f = function() { return self.hp + other.dmg; };",
    );
    expect(out).toContain(
      "var f = function() { return self.hp + other.dmg; };",
    );
  });
});

describe("transpileGML — GML `static` variable semantics", () => {
  it("rewrites `static x = 0;` into a valid-JS lazy-init against GmlActions.gmlStatics, not a SyntaxError-prone class-body static", () => {
    const out = transpileGML(
      "static counter = 0;\nreturn counter;",
      [],
      new Set(),
      false,
      "onUpdate",
    );
    expect(out).not.toMatch(/^\s*static\s/m);
    expect(out).toContain("GmlActions.gmlStatics");
    expect(out).toContain(
      'if (!("onUpdate::counter::0" in GmlActions.gmlStatics))',
    );
    // Must be real, executable JS — a direct `new Function` probe is the
    // same technique CLAUDE.md's own gap-writeup used to confirm the
    // *old* `SyntaxError`, so it's the right technique to prove the fix.
    expect(() => new Function(out)).not.toThrow();
  });

  it("a static var persists its value across two separate calls to the same generated function", () => {
    // Plain assignment (not `+=`) deliberately — the compound-assignment
    // rewrite emits a TypeScript `as` cast (matching this file's existing
    // GmlInstanceVars compound-assignment output), which real `new
    // Function` can't parse as plain JS; every other execution-based test
    // in this file sticks to plain assignment for the same reason.
    const body = transpileGML(
      "static counter = 0;\ncounter = counter + 1;\nreturn counter;",
      [],
      new Set(),
      false,
      "onUpdate",
    );
    const GmlActions = { gmlStatics: {} as Record<string, unknown> };
    const fn = new Function("GmlActions", body);
    expect(fn(GmlActions)).toBe(1);
    expect(fn(GmlActions)).toBe(2);
    expect(fn(GmlActions)).toBe(3);
  });

  it("a static var's initializer runs exactly once, not on every call", () => {
    const body = transpileGML(
      "static seen = 0;\nseen = seen + 1;\nreturn seen;",
      [],
      new Set(),
      false,
      "onCreate",
    );
    // `static seen = 0;` only ever assigns the literal `0` once, at
    // first-call time — a naive re-run-every-call rewrite would reset
    // `seen` back to 0 before the increment on every call, so this would
    // never climb past 1. Asserted the same way the "persists" test above
    // proves persistence, from the other direction.
    const GmlActions = { gmlStatics: {} as Record<string, unknown> };
    const fn = new Function("GmlActions", body);
    fn(GmlActions);
    fn(GmlActions);
    const result = fn(GmlActions);
    expect(result).toBe(3);
  });

  it("two different generated functions with a same-named static var don't collide", () => {
    const bodyA = transpileGML(
      "static x = 10;\nx = x + 1;\nreturn x;",
      [],
      new Set(),
      false,
      "onUpdate",
    );
    const bodyB = transpileGML(
      "static x = 100;\nx = x + 1;\nreturn x;",
      [],
      new Set(),
      false,
      "onCreate",
    );
    const GmlActions = { gmlStatics: {} as Record<string, unknown> };
    const fnA = new Function("GmlActions", bodyA);
    const fnB = new Function("GmlActions", bodyB);
    expect(fnA(GmlActions)).toBe(11);
    expect(fnB(GmlActions)).toBe(101);
    // Calling A again must not have been perturbed by B's own same-named
    // static — proves the two slots are genuinely independent, keyed by
    // `functionId`, not just by the bare variable name.
    expect(fnA(GmlActions)).toBe(12);
    expect(fnB(GmlActions)).toBe(102);
  });

  it("`static x;` (no initializer) defaults to undefined, matching GameMaker's own real default", () => {
    const body = transpileGML(
      "static x;\nreturn x;",
      [],
      new Set(),
      false,
      "onCreate",
    );
    const GmlActions = { gmlStatics: {} as Record<string, unknown> };
    const fn = new Function("GmlActions", body);
    expect(fn(GmlActions)).toBeUndefined();
  });

  it("a static declared inside a nested function() literal is left untouched — the documented, honest remaining gap", () => {
    const out = transpileGML(
      "var f = function() { static count = 0; count += 1; return count; };",
      [],
      new Set(),
      false,
      "onCreate",
    );
    // Still contains the raw, untranspiled `static` keyword — proves this
    // narrower nested case was deliberately left alone rather than
    // silently (and incorrectly) rewritten against the outer function's
    // own scope.
    expect(out).toContain("static count = 0;");
  });
});

describe("transpileGML — x/y built-in position variables", () => {
  it("rewrites a bare read inside a call argument (place_meeting(x, y + 1, obj_wall))", () => {
    const out = transpileGML(
      "onground = place_meeting(x, y + 1, obj_wall);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("(_entity.get(GmlActions.Transform)?.x ?? 0)");
    expect(out).toContain("(_entity.get(GmlActions.Transform)?.y ?? 0) + 1");
  });

  it("rewrites compound assignment (x += hsp;)", () => {
    const out = transpileGML("x += hsp;", [], new Set(), false, "fn");
    expect(out).toContain("_t.x += (hsp)");
  });

  it("rewrites plain assignment (y = 100;)", () => {
    const out = transpileGML("y = 100;", [], new Set(), false, "fn");
    expect(out).toContain("_t.y = 100;");
  });

  it("rewrites increment/decrement (x++; y--;)", () => {
    const out = transpileGML("x++;\ny--;", [], new Set(), false, "fn");
    expect(out).toContain("_t.x += 1");
    expect(out).toContain("_t.y -= 1");
  });

  it("leaves a dotted reference to another instance's field untouched (inst.x = 5;)", () => {
    const out = transpileGML("inst.x = 5;", [], new Set(), false, "fn");
    expect(out).toContain("inst.x = 5;");
    expect(out).not.toContain("_entity.get(GmlActions.Transform)");
  });

  it("does not corrupt code following a comment with a stray apostrophe (the real string-masking bug this fix closes)", () => {
    const src = [
      "// Taking away the player's control",
      "onground = place_meeting(x, y + 1, obj_wall);",
      "// Add the gun's direction to the bullet's direction",
      "onwall = place_meeting(x + 1, y, obj_wall);",
    ].join("\n");
    const out = transpileGML(src, [], new Set(), false, "fn");
    // Both calls — one before the odd-apostrophe-count comments, one
    // after two more of them — must be fully rewritten. Before the fix,
    // the pair of stray apostrophes across the two comments made the
    // masking regex swallow everything between them as one fake "string
    // literal", leaving `x`/`y` bare and unrewritten in the swallowed
    // region.
    const xHits = out.match(/_entity\.get\(GmlActions\.Transform\)\?\.x/g);
    expect(xHits?.length).toBe(2);
  });
});

describe("transpileGML — keyboard/gamepad/mouse input functions", () => {
  it("threads keyboard_check(vk) to GmlActions.keyboard_check(_ctx, ...)", () => {
    const out = transpileGML(
      "key_right = keyboard_check(vk_right);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain(
      "GmlActions.keyboard_check(_ctx, GmlActions.vk_right)",
    );
  });

  it("threads keyboard_check_pressed and gamepad_axis_value", () => {
    const out = transpileGML(
      "key_jump = keyboard_check_pressed(vk_up);\nv = gamepad_axis_value(0, gp_axislh);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain(
      "GmlActions.keyboard_check_pressed(_ctx, GmlActions.vk_up)",
    );
    expect(out).toContain(
      "GmlActions.gamepad_axis_value(_ctx, 0, GmlActions.gp_axislh)",
    );
  });

  it("threads display_get_gui_width/height and application_surface", () => {
    const out = transpileGML(
      "w = display_get_gui_width();\nh = display_get_gui_height();\nsurface_get_width(application_surface);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("GmlActions.display_get_gui_width(_ctx)");
    expect(out).toContain("GmlActions.display_get_gui_height(_ctx)");
    expect(out).toContain(
      "GmlActions.surface_get_width(_ctx, GmlActions.application_surface)",
    );
  });
});

describe("transpileGML — draw_set_color (American spelling alias)", () => {
  it("rewrites draw_set_color the same way draw_set_colour is rewritten", () => {
    const out = transpileGML(
      "draw_set_color(c_white);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("_ctx.drawTarget?.setColor(GmlActions.c_white);");
  });
});

describe("transpileGML — max/min/abs/ord and room", () => {
  it("threads max/min/abs as pure functions", () => {
    const out = transpileGML(
      "v = max(a, 0);\nw = min(b, 1);\nu = abs(-5);",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("GmlActions.max(");
    expect(out).toContain("GmlActions.min(");
    // `abs` is rewritten by a separate, pre-existing pass straight to
    // `Math.abs` rather than `GmlActions.abs` — see the doc comment on
    // this file's `THREADED_PURE_FUNCTIONS` list for why `abs` isn't in
    // it.
    expect(out).toContain("Math.abs(");
  });

  it("threads ord()", () => {
    const out = transpileGML(
      'key_restart = keyboard_check_pressed(ord("R"));',
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain('GmlActions.ord("R")');
  });

  it("rewrites a bare room read to GmlActions.room(_ctx)", () => {
    const out = transpileGML(
      "if (room == rm_menu) { x = 0; }",
      [],
      new Set(),
      false,
      "fn",
    );
    expect(out).toContain("GmlActions.room(_ctx)");
  });
});

describe("transpileGML — draw_set_halign/draw_set_valign/draw_set_font/draw_set_alpha and fa_* constants", () => {
  it("rewrites draw_set_halign(fa_center) to a drawTarget call with the fa_center constant threaded", () => {
    const out = transpileGML("draw_set_halign(fa_center);");
    expect(out).toContain(
      "_ctx.drawTarget?.setHalign?.(GmlActions.fa_center);",
    );
  });

  it("rewrites draw_set_valign(fa_bottom)", () => {
    const out = transpileGML("draw_set_valign(fa_bottom);");
    expect(out).toContain(
      "_ctx.drawTarget?.setValign?.(GmlActions.fa_bottom);",
    );
  });

  it("rewrites draw_set_font(fnt_sign)", () => {
    const out = transpileGML("draw_set_font(fnt_sign);");
    expect(out).toContain("_ctx.drawTarget?.setFont?.(fnt_sign);");
  });

  it("rewrites draw_set_alpha(0.5)", () => {
    const out = transpileGML("draw_set_alpha(0.5);");
    expect(out).toContain("_ctx.drawTarget?.setAlpha?.(0.5);");
  });

  it("rewrites every fa_* constant to a GmlActions reference", () => {
    const out = transpileGML(
      "a = fa_left; b = fa_center; c = fa_right; d = fa_top; e = fa_middle; f = fa_bottom;",
    );
    for (const name of [
      "fa_left",
      "fa_center",
      "fa_right",
      "fa_top",
      "fa_middle",
      "fa_bottom",
    ]) {
      expect(out).toContain(`GmlActions.${name}`);
    }
  });
});

describe("transpileGML — draw_sprite_ext/draw_sprite_part/draw_sprite_part_ext", () => {
  it("rewrites draw_sprite_ext with a bare sprite identifier quoted to a texture path", () => {
    const out = transpileGML(
      "draw_sprite_ext(spr_marker, 0, x, y, 2, 2, 45, c_white, 1);",
    );
    expect(out).toContain(
      '_ctx.drawTarget?.spriteExt?.("./assets/sprites/spr_marker/frame_0.png", ',
    );
  });

  it("rewrites draw_sprite_part with a real 9-slice-shaped call", () => {
    const out = transpileGML(
      "draw_sprite_part(_sprite, _subimg, 0, 0, cellSize, cellSize, _x, _y);",
    );
    // `_sprite` is itself a bare identifier (GML's own real convention
    // matches this too — Freedom Backup's own `draw_9slice.gml` script
    // takes a `_sprite` argument and this rewrite quotes it the same way a
    // named sprite constant would be), so it's quoted into a texture path
    // just like `draw_sprite`'s own rewrite already does.
    expect(out).toContain(
      '_ctx.drawTarget?.spritePart?.("./assets/sprites/_sprite/frame_0.png", 0, 0, cellSize, cellSize, _x, _y);',
    );
  });

  it("rewrites draw_sprite_part_ext with a real 9-slice-shaped call", () => {
    const out = transpileGML(
      "draw_sprite_part_ext(_sprite, _subimg, cellSize, cellSize, cellSize, cellSize, _x, _y, w, h, -1, 1);",
    );
    expect(out).toContain(
      '_ctx.drawTarget?.spritePartExt?.("./assets/sprites/_sprite/frame_0.png", cellSize, cellSize, cellSize, cellSize, _x, _y, w, h, -1, 1);',
    );
  });

  it("produces syntactically valid output", () => {
    const out = transpileGML(
      "draw_sprite_ext(spr_a, 0, x, y, 1, 1, 0, c_white, 1); draw_sprite_part(spr_a, 0, 0, 0, 8, 8, x, y); draw_sprite_part_ext(spr_a, 0, 0, 0, 8, 8, x, y, 1, 1, c_white, 1);",
    );
    expect(
      () => new Function("GmlActions", "_entity", "_ctx", out),
    ).not.toThrow();
  });
});

describe("transpileGML — draw_self, instance_change, room_exists, audio_sound_pitch, display_get_width/height, window_set_size, surface_resize", () => {
  it("threads draw_self() to GmlActions.draw_self(_entity, _ctx)", () => {
    const out = transpileGML("draw_self();");
    expect(out).toContain("GmlActions.draw_self(_entity, _ctx)");
  });

  it("quotes a bare object-name argument for instance_change", () => {
    const out = transpileGML("instance_change(obj_hitSpark, true);");
    expect(out).toContain(
      'GmlActions.instance_change(_entity, _ctx, "obj_hitSpark", true);',
    );
  });

  it("does not quote a non-identifier instance_change argument", () => {
    const out = transpileGML("instance_change(other.new_object, false);");
    expect(out).toContain(
      "GmlActions.instance_change(_entity, _ctx, other.new_object, false);",
    );
  });

  it("threads room_exists(i) with no quoting", () => {
    const out = transpileGML("if (room_exists(i)) { x = 0; }");
    expect(out).toContain("GmlActions.room_exists(_ctx, i)");
  });

  it("threads audio_sound_pitch", () => {
    const out = transpileGML("audio_sound_pitch(snd_Shot, 1.2);");
    expect(out).toContain(
      'GmlActions.audio_sound_pitch(_entity, _ctx, "snd_Shot", 1.2);',
    );
  });

  it("threads display_get_width/display_get_height", () => {
    const out = transpileGML(
      'str = "Display: " + String(display_get_width()) + " x " + String(display_get_height());',
    );
    expect(out).toContain("GmlActions.display_get_width(_ctx)");
    expect(out).toContain("GmlActions.display_get_height(_ctx)");
  });

  it("threads window_set_size and surface_resize", () => {
    const out = transpileGML(
      "window_set_size(w, h); surface_resize(application_surface, w, h);",
    );
    expect(out).toContain("GmlActions.window_set_size(_ctx, w, h)");
    expect(out).toContain(
      "GmlActions.surface_resize(_ctx, GmlActions.application_surface, w, h)",
    );
  });
});

describe("transpileGML — legacy e__VW view-script camera accessors", () => {
  it("threads camera_get_view_border_x/_y, camera_set_view_border, camera_get/set_view_target", () => {
    const out = transpileGML(
      "camera_set_view_border(cam, camera_get_view_border_x(cam), v); t = camera_get_view_target(cam); camera_set_view_target(cam, v);",
    );
    expect(out).toContain(
      "GmlActions.camera_set_view_border(_ctx, cam, GmlActions.camera_get_view_border_x(_ctx, cam), v)",
    );
    expect(out).toContain("GmlActions.camera_get_view_target(_ctx, cam)");
    expect(out).toContain("GmlActions.camera_set_view_target(_ctx, cam, v)");
  });

  it("threads view_get_surface_id/view_set_surface_id and the full view_*port family", () => {
    const out = transpileGML(
      "sid = view_get_surface_id(0); view_set_surface_id(0, 5); x1 = view_get_xport(0); y1 = view_get_yport(0); w1 = view_get_wport(0); h1 = view_get_hport(0);",
    );
    expect(out).toContain("GmlActions.view_get_surface_id(_ctx, 0)");
    expect(out).toContain("GmlActions.view_set_surface_id(_ctx, 0, 5)");
    expect(out).toContain("GmlActions.view_get_xport(_ctx, 0)");
    expect(out).toContain("GmlActions.view_get_yport(_ctx, 0)");
    expect(out).toContain("GmlActions.view_get_wport(_ctx, 0)");
    expect(out).toContain("GmlActions.view_get_hport(_ctx, 0)");
  });
});

describe("transpileGML — real project-defined GML enum declarations", () => {
  it("strips a known enum declaration and rewrites its dot-access references onto GmlEnums", () => {
    setGmlEnumNames(new Set(["TRANS_MODE"]));
    const out = transpileGML(
      "enum TRANS_MODE\n{\n\tOFF,\n\tNEXT,\n\tGOTO\n}\nmode = TRANS_MODE.NEXT;",
    );
    expect(out).not.toContain("enum TRANS_MODE {");
    expect(out).toContain("GmlEnums.TRANS_MODE.NEXT");
    setGmlEnumNames(new Set());
  });

  it("leaves an unknown enum-shaped name untouched", () => {
    setGmlEnumNames(new Set(["TRANS_MODE"]));
    const out = transpileGML("mode = OTHER_ENUM.NEXT;");
    expect(out).not.toContain("GmlEnums.OTHER_ENUM");
    setGmlEnumNames(new Set());
  });
});

describe("transpileGML — cross-instance dotted references (obj_x.field)", () => {
  it("rewrites a bare cross-instance read onto getGmlObjectVar", () => {
    setGmlObjectNames(new Set(["obj_input"]));
    const out = transpileGML("d = obj_input.key_down;");
    expect(out).toContain(
      'GmlActions.getGmlObjectVar(_entity, _ctx, "obj_input", "key_down")',
    );
    setGmlObjectNames(new Set());
  });

  it("rewrites a cross-instance assignment onto setGmlObjectVar", () => {
    setGmlObjectNames(new Set(["obj_player"]));
    const out = transpileGML("obj_player.hsp = 4;");
    expect(out).toContain(
      'GmlActions.setGmlObjectVar(_entity, _ctx, "obj_player", "hsp", 4);',
    );
    setGmlObjectNames(new Set());
  });

  it("does not rewrite a dotted access whose LHS is not a known object name", () => {
    setGmlObjectNames(new Set(["obj_player"]));
    const out = transpileGML("v = inst.image_xscale;");
    expect(out).not.toContain("GmlActions.getGmlObjectVar");
    setGmlObjectNames(new Set());
  });
});

describe("transpileGML — getGmlVar/getGmlObjectVar bare-read numeric cast", () => {
  it("casts a bare instance-variable read as number", () => {
    const out = transpileGML(
      "hsp = grav + 1;\ngrav = 0.3;",
      [],
      new Set(["grav"]),
    );
    expect(out).toContain(
      'GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "grav"))',
    );
  });

  it("casts a cross-instance bare read as number", () => {
    setGmlObjectNames(new Set(["obj_input"]));
    const out = transpileGML("d = obj_input.key_left + 1;");
    expect(out).toContain(
      'GmlActions.gmlNum(GmlActions.getGmlObjectVar(_entity, _ctx, "obj_input", "key_left"))',
    );
    setGmlObjectNames(new Set());
  });
});

describe("transpileGML — GML local-variable-held instance references", () => {
  it("rewrites a dotted read on a local var assigned from instance_create_layer", () => {
    const out = transpileGML(
      'my_gun = instance_create_layer(x, y, "Guns", obj_gun);\nv = my_gun.hp;',
    );
    expect(out).toContain(
      'GmlActions.gmlNum(GmlActions.getGmlRefVar(_entity, _ctx, "my_gun", "hp"))',
    );
  });

  it("rewrites a dotted assignment on a local var assigned from instance_place", () => {
    const out = transpileGML("t = instance_place(x, y, obj_wall);\nt.hp = 3;");
    expect(out).toContain(
      'GmlActions.setGmlRefVar(_entity, _ctx, "t", "hp", 3);',
    );
  });

  it("does not rewrite a dotted access on a name never assigned from an Entity-returning call", () => {
    const out = transpileGML("v = owner.x;");
    expect(out).not.toContain("getGmlRefVar");
  });

  it("prefers the object-type-name rewrite over the local-ref rewrite for the same name", () => {
    setGmlObjectNames(new Set(["obj_gun"]));
    const out = transpileGML(
      'obj_gun = instance_create_layer(x, y, "Guns", obj_gun);\nv = obj_gun.hp;',
    );
    expect(out).toContain("GmlActions.getGmlObjectVar");
    expect(out).not.toContain("getGmlRefVar");
    setGmlObjectNames(new Set());
  });
});

import { describe, expect, it } from "vitest";
import type { Identifier } from "../ast.js";
import {
  analyzeFile,
  buildProjectSymbols,
  evaluateEnumDecl,
} from "../project-symbols.js";
import { scanEnums } from "../scan.js";

const assets = {
  sprite: ["spr_hero", "spr_shared"],
  object: ["obj_player", "obj_enemy", "spr_shared"],
  sound: ["snd_hit"],
  room: ["rm_init"],
  font: ["fnt_menu"],
};

function idNamed(
  a: ReturnType<typeof analyzeFile>,
  name: string,
  nth = 0,
): Identifier {
  const hits = a.references.filter((r) => r.node.name === name);
  const h = hits[nth];
  if (!h) throw new Error(`identifier ${name}#${nth} not found`);
  return h.node;
}

describe("project symbols: assets", () => {
  it("indexes assets by kind and reports cross-kind collisions instead of dropping them", () => {
    const p = buildProjectSymbols({ assets });
    expect(p.assets("sprite").has("spr_hero")).toBe(true);
    expect(p.lookupAsset("spr_shared").collisions.sort()).toEqual([
      "object",
      "sprite",
    ]);
    expect(p.lookupAsset("spr_hero").collisions).toEqual([]);
    expect(p.lookupAsset("nope").symbol).toBeUndefined();
    expect(
      p.diagnostics.some(
        (d) => d.kind === "asset-collision" && d.message.includes("spr_shared"),
      ),
    ).toBe(true);
  });

  it("flags missing assets", () => {
    const p = buildProjectSymbols({
      assets,
      missing: { sprite: ["spr_gone"], object: ["obj_player"] },
    });
    expect(p.lookupAsset("spr_gone").symbol?.missing).toBe(true);
    expect(p.assets("object").get("obj_player")?.missing).toBe(true);
    expect(p.assets("sprite").get("spr_hero")?.missing).toBeUndefined();
  });
});

describe("project symbols: enums and macros", () => {
  it("evaluates enums with expressions, comments, trailing commas and hex", () => {
    const p = buildProjectSymbols({
      files: [
        {
          path: "a.gml",
          text: "enum E { A, B = 5, C, /* } */ D = C + 4, F = 1 << 3, G = $10, H = -1, } // }\nenum F2 { X = E.D, Y }",
        },
      ],
    });
    expect([...p.enums().get("E")!.members]).toEqual([
      ["A", 0],
      ["B", 5],
      ["C", 6],
      ["D", 10],
      ["F", 8],
      ["G", 16],
      ["H", -1],
    ]);
    expect([...p.enums().get("F2")!.members]).toEqual([
      ["X", 10],
      ["Y", 11],
    ]);
  });

  it("skips unresolvable members and first enum declaration wins", () => {
    const en = scanEnums("enum Q { A, B = unknown_fn(), C }")[0]!;
    expect([...evaluateEnumDecl(en)]).toEqual([
      ["A", 0],
      ["C", 1],
    ]);
    const p = buildProjectSymbols({
      files: [
        { path: "1.gml", text: "enum Dup { A = 1 }" },
        { path: "2.gml", text: "enum Dup { A = 2 }" },
      ],
    });
    expect(p.enums().get("Dup")!.members.get("A")).toBe(1);
  });

  it("macros: last wins, config macros keyed with prefix, continuation and comment handled", () => {
    const p = buildProjectSymbols({
      files: [
        {
          path: "a.gml",
          text: "#macro SPEED 4 // fast\n#macro SPEED 5\n#macro Debug:LOG 1\n#macro SUM (1 + \\\n 2)",
        },
      ],
    });
    expect(p.macros().get("SPEED")?.valueText).toBe("5");
    expect(p.macros().get("Debug:LOG")?.valueText).toBe("1");
    expect(p.macros().has("LOG")).toBe(false);
    expect(p.macros().get("SUM")?.valueText).toContain("(1 +");
  });
});

describe("scope resolution", () => {
  const p = buildProjectSymbols({
    assets,
    files: [
      {
        path: "obj_player/Create_0.gml",
        text: "hp = 10; inv = []; target = noone;",
        object: "obj_player",
        kind: "object",
      },
    ],
  });

  const an = (
    text: string,
    extra: { object?: string; params?: string[] } = {},
  ) => analyzeFile(p, { path: "t.gml", text, kind: "object", ...extra });

  it("local shadows a sprite asset; unshadowed sprite resolves through project", () => {
    const a = an("var spr_hero = 1; x = spr_hero; y = spr_shared;");
    const local = a.resolve(idNamed(a, "spr_hero", 0))!;
    expect(local.via).toBe("lexical");
    expect(local.shadowed?.[0]?.assetKind).toBe("sprite");
    expect(a.diagnostics.some((d) => d.kind === "shadow")).toBe(true);
    const sprite = a.resolve(idNamed(a, "spr_shared"))!;
    expect(sprite.via).toBe("project");
  });

  it("resolution order: local, parameter, instance, function, asset, enum, macro, builtin, none", () => {
    const q = buildProjectSymbols({
      assets,
      files: [
        {
          path: "s.gml",
          text: "function helper() {}\nenum Mode { A }\n#macro LIMIT 3",
          kind: "script",
        },
        {
          path: "obj_player/Create_0.gml",
          text: "hp = 1;",
          object: "obj_player",
          kind: "object",
        },
      ],
    });
    const a = analyzeFile(q, {
      path: "obj_player/Step_0.gml",
      object: "obj_player",
      params: ["arg"],
      text: "var loc = 1; loc; arg; hp; helper; obj_enemy; Mode; LIMIT; x; c_red; mystery;",
    });
    const via = (n: string) => a.resolve(idNamed(a, n))!.via;
    expect(via("loc")).toBe("lexical");
    expect(via("arg")).toBe("lexical");
    expect(via("hp")).toBe("instance");
    expect(via("helper")).toBe("project");
    expect(via("obj_enemy")).toBe("project");
    expect(via("Mode")).toBe("project");
    expect(via("LIMIT")).toBe("project");
    expect(via("x")).toBe("builtin");
    expect(via("c_red")).toBe("builtin");
    expect(via("mystery")).toBe("none");
  });

  it("member names are never identifier references (dotted-guard class)", () => {
    const a = an(
      "var v = other.spr_hero; s = { id: 1, spr_hero: 2 }; q = obj_player.hp;",
    );
    const names = a.references.map((r) => r.node.name);
    expect(names).not.toContain("id");
    // spr_hero appears only as a property/struct key, never as a reference
    expect(names.filter((n) => n === "spr_hero")).toEqual([]);
    expect(names).toContain("obj_player");
  });

  it("block scoping: var is function scoped, catch param is block scoped", () => {
    const a = an(
      "if (1) { var inner = 1; } inner; try { } catch (e) { e; } e;",
    );
    expect(a.resolve(idNamed(a, "inner"))!.via).toBe("lexical");
    expect(a.resolve(idNamed(a, "e", 0))!.via).toBe("lexical");
    expect(a.resolve(idNamed(a, "e", 1))!.via).toBe("none");
  });

  it("function parameters and defaults; constructor bodies do not leak fields to the object", () => {
    const q = buildProjectSymbols({
      files: [
        {
          path: "o.gml",
          object: "obj_a",
          kind: "object",
          text: "function C(n = base) constructor { name = n; }\nc = new C(1);\ninstvar = 2;",
        },
      ],
    });
    const info = q.object("obj_a")!;
    expect([...info.instanceFields.keys()].sort()).toEqual(["c", "instvar"]);
  });

  it("with-target scoping: body resolves against the target object", () => {
    const a = an("with (obj_player) { hp -= 1; other_thing = 1; }");
    expect(a.resolve(idNamed(a, "hp"))!.via).toBe("with");
    expect(a.facts.externalWrites.map((w) => [w.target, w.field])).toEqual([
      ["obj_player", "other_thing"],
    ]);
    expect(a.facts.selfWrites.size).toBe(0);
  });

  it("self.x and global.x writes", () => {
    const a = an("self.foo = 1; global.bar = 2;");
    expect([...a.facts.selfWrites.keys()]).toEqual(["foo"]);
    expect([...a.facts.globalWrites]).toEqual(["bar"]);
  });
});

describe("instance fields", () => {
  it("collects implicit fields per object across event files, array-ness included, not locals/params/builtins/assets", () => {
    const p = buildProjectSymbols({
      assets,
      files: [
        {
          path: "obj_enemy/Create_0.gml",
          object: "obj_enemy",
          kind: "object",
          text: 'var tmp = 1;\nhp = 10;\nitems = [];\nx = 5;\ngrid[0] = 1;\nname_ = "n";\nspr_hero = 3;',
        },
        {
          path: "obj_enemy/Step_0.gml",
          object: "obj_enemy",
          kind: "object",
          text: "hp -= 1;\ncooldown = 3;\nif (hp < 0) { tmp = 2; }\nitems[0] = 1;",
        },
      ],
    });
    const info = p.object("obj_enemy")!;
    expect([...info.instanceFields.keys()].sort()).toEqual(
      ["cooldown", "grid", "hp", "items", "name_", "tmp"].sort(),
    );
    expect(info.instanceFields.get("items")!.isArray).toBe(true);
    expect(info.instanceFields.get("grid")!.isArray).toBe(true);
    expect(info.instanceFields.get("hp")!.isArray).toBe(false);
    expect(info.instanceFields.get("hp")!.writers).toEqual([
      "obj_enemy/Create_0.gml",
    ]);
  });

  it("script bodies record instance vars separately", () => {
    const p = buildProjectSymbols({
      files: [
        {
          path: "scr.gml",
          kind: "script",
          text: "function f(a) { shared_state = a; }",
        },
      ],
    });
    // inside a plain script function a bare assignment writes the caller's instance
    expect(p.scriptInstanceVars().has("shared_state")).toBe(true);
  });
});

describe("entity dataflow", () => {
  it("holdsEntity from entity-returning calls, propagated through locals", () => {
    const p = buildProjectSymbols({
      assets,
      files: [
        {
          path: "obj_player/Create_0.gml",
          object: "obj_player",
          kind: "object",
          text: 'var e = instance_create_layer(0, 0, "L", obj_enemy);\nmy_gun = e;\ncount = 3;',
        },
      ],
    });
    const f = p.object("obj_player")!.instanceFields;
    expect(f.get("my_gun")!.holdsEntity).toBe(true);
    expect(f.get("count")!.holdsEntity).toBe(false);
  });

  it("cross-file entity ref fields: assignments of other.id in any with body, nested or not", () => {
    const p = buildProjectSymbols({
      assets,
      files: [
        {
          path: "a.gml",
          object: "obj_player",
          kind: "object",
          text: `
            var g = instance_create_layer(0, 0, "L", obj_enemy);
            with (g) { owner = other.id; }
            with (obj_enemy) { if (alive) { boss = other.id; } }
            with (obj_enemy) mate = other.id;
            not_a_ref = other.id;
            with (obj_enemy) { hp = other.hp; }
          `,
        },
      ],
    });
    expect([...p.crossFileEntityRefFields()].sort()).toEqual([
      "boss",
      "mate",
      "owner",
    ]);
  });

  it("comments and strings do not create entity refs (unlike regex scanning)", () => {
    const p = buildProjectSymbols({
      files: [
        {
          path: "a.gml",
          text: '// with (x) { f = other.id; }\ns = "with (x) { g = other.id; }";',
        },
      ],
    });
    expect(p.crossFileEntityRefFields().size).toBe(0);
  });
});

describe("purity", () => {
  it("two projects built in the same process do not share state", () => {
    const a = buildProjectSymbols({
      assets: { sprite: ["s1"] },
      files: [{ path: "x", text: "enum Z { A }" }],
    });
    const b = buildProjectSymbols({ assets: { sprite: ["s2"] } });
    expect(a.assets("sprite").has("s1")).toBe(true);
    expect(b.assets("sprite").has("s1")).toBe(false);
    expect(b.enums().size).toBe(0);
  });

  it("references() indexes usages of project symbols", () => {
    const p = buildProjectSymbols({
      assets,
      files: [
        {
          path: "a.gml",
          text: "draw_sprite(spr_hero, 0, 0, 0); y = spr_hero;",
        },
      ],
    });
    expect(p.references("spr_hero")).toHaveLength(2);
  });
});

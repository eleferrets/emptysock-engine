import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  scanGmlSourceBugs,
  stripGmlCommentsAndStrings,
  buildMissingSpritePng,
  getGmlUnsetVars,
  setGmlUnsetVarsByObject,
  type SourceBugContext,
} from "../gms2-source-bugs.js";
import {
  transpileGML,
  setGmlMissingAssetNames,
  setGmlObjectFieldNames,
  setGmlFontNames,
  setGmlSpriteNames,
} from "../gms2-transpile.js";
import { migrationReport } from "../gms2-report.js";

async function project(
  objects: Record<string, Record<string, string>>,
  scripts: Record<string, string> = {},
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-bugs-"));
  for (const [o, files] of Object.entries(objects)) {
    await fs.mkdir(path.join(root, "objects", o), { recursive: true });
    for (const [f, src] of Object.entries(files)) {
      await fs.writeFile(path.join(root, "objects", o, f), src);
    }
  }
  for (const [s, src] of Object.entries(scripts)) {
    await fs.mkdir(path.join(root, "scripts", s), { recursive: true });
    await fs.writeFile(path.join(root, "scripts", s, `${s}.gml`), src);
  }
  return root;
}

function ctxFor(
  root: string,
  objects: string[],
  scripts: string[] = [],
  parents: Record<string, string> = {},
): SourceBugContext {
  return {
    projectRoot: root,
    objects,
    scripts,
    assetNames: new Set([...objects, ...scripts, "spr_ok", "fnt_ok"]),
    fontNames: new Set(["fnt_ok"]),
    spriteNames: new Set(["spr_ok"]),
    macroNames: new Set(["MACRO_X"]),
    enumNames: new Set(["MODE"]),
    resolveChain: (n) => {
      const chain = [n];
      let cur: string | undefined = parents[n];
      while (cur !== undefined) {
        chain.push(cur);
        cur = parents[cur];
      }
      return Promise.resolve(chain);
    },
    resolveProperties: () => Promise.resolve([]),
  };
}

describe("gms2 source bug scan", () => {
  it("reports a read of a variable nothing in the chain assigns, and not one a parent assigns", async () => {
    const root = await project({
      obj_parent: { "Create_0.gml": "speed_x = 2;\n" },
      obj_child: {
        "Step_0.gml":
          "x += speed_x;\nzoom_level += 1;\nvar tmp = 3;\ny = tmp + MACRO_X;\n",
      },
    });
    const scan = await scanGmlSourceBugs(
      ctxFor(root, ["obj_parent", "obj_child"], [], {
        obj_child: "obj_parent",
      }),
    );
    const names = scan.findings.map((f) => `${f.kind}:${f.name}`);
    expect(names).toEqual(["unset-variable:zoom_level"]);
    expect(scan.findings[0]?.location).toBe("objects/obj_child/Step_0.gml:2");
    expect(scan.unsetVarsByObject.get("obj_child")).toEqual(
      new Set(["zoom_level"]),
    );
  });

  it("does not treat built-ins, calls, struct keys, enums, comments or strings as unset variables", async () => {
    const root = await project({
      obj_a: {
        "Step_0.gml": [
          "// hp is mentioned only in a comment",
          'var s = "hp";',
          "var st = { hp: 1, other: 2 };",
          "speed = 4;",
          "if (image_index > 1 && MODE) { direction = 90; }",
          "instance_destroy();",
          "c = c_red;",
        ].join("\n"),
      },
    });
    const scan = await scanGmlSourceBugs(ctxFor(root, ["obj_a"]));
    expect(scan.findings).toEqual([]);
  });

  it("ignores names inside with bodies (another object's scope) and fields assigned from a with body elsewhere", async () => {
    const root = await project({
      obj_a: {
        "Step_0.gml": [
          "with (instance_place(x, y, obj_b)) { hp--; }",
          "owner_ref = owner;",
        ].join("\n"),
      },
      obj_b: {
        "Create_0.gml": "with (obj_a) { owner = other.id; }\n",
      },
    });
    const scan = await scanGmlSourceBugs(ctxFor(root, ["obj_a", "obj_b"]));
    expect(scan.findings).toEqual([]);
  });

  it("finds a missing font and a missing sprite by call context, including a script sprite parameter", async () => {
    const root = await project(
      {
        obj_a: {
          "Draw_0.gml": [
            "draw_set_font(fnt_ok);",
            "draw_set_font(fnt_gone);",
            "draw_sprite(spr_ok, 0, x, y);",
            "draw_sprite(spr_gone, 0, x, y);",
            "sprite_index = spr_swap;",
            "panel(x, y, 8, 8, spr_panel, 0);",
          ].join("\n"),
        },
      },
      {
        panel:
          "/// @param x\n/// @param y\n/// @param w\n/// @param h\n/// @param sprite\n/// @param subimg\nfunction panel() {}\n",
      },
    );
    const scan = await scanGmlSourceBugs(ctxFor(root, ["obj_a"], ["panel"]));
    expect([...scan.missingFonts]).toEqual(["fnt_gone"]);
    expect([...scan.missingSprites].sort()).toEqual([
      "spr_gone",
      "spr_panel",
      "spr_swap",
    ]);
    expect(scan.findings.every((f) => f.kind !== "unset-variable")).toBe(true);
    expect(scan.findings.find((f) => f.name === "fnt_gone")?.location).toBe(
      "objects/obj_a/Draw_0.gml:2",
    );
  });

  it("finds a missing object type passed to a spawn call", async () => {
    const root = await project({
      obj_a: {
        "Create_0.gml":
          "instance_create(0, 0, obj_gone);\naction_create_object(obj_a, 1, 2);\n",
      },
    });
    const scan = await scanGmlSourceBugs(ctxFor(root, ["obj_a"]));
    expect([...scan.missingObjects]).toEqual(["obj_gone"]);
    expect(scan.findings.map((f) => f.kind)).toEqual(["missing-object"]);
  });

  it("strips comments and strings but keeps line numbers", () => {
    const out = stripGmlCommentsAndStrings(
      'a = "x\\"y"; // c\n/* m\nn */ b = 1;',
    );
    expect(out.split("\n")).toHaveLength(3);
    expect(out).not.toMatch(/x|c$|m/);
    expect(out).toContain("b = 1;");
  });

  it("builds a valid 16x16 PNG placeholder", () => {
    const png = buildMissingSpritePng();
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.readUInt32BE(16)).toBe(16);
    expect(png.readUInt32BE(20)).toBe(16);
    expect(png.subarray(png.length - 8, png.length - 4).toString("ascii")).toBe(
      "IEND",
    );
  });
});

describe("source bug emission", () => {
  it("a missing font id resolves to a string and a missing sprite to the placeholder path", () => {
    setGmlFontNames(new Set());
    setGmlSpriteNames(new Set());
    setGmlMissingAssetNames({
      fonts: new Set(["fnt_gone"]),
      sprites: new Set(["spr_gone"]),
    });
    try {
      const out = transpileGML(
        "draw_set_font(fnt_gone);\ndraw_sprite(spr_gone, 0, x, y);\n",
      );
      expect(out).toContain('"fnt_gone"');
      expect(out).toContain("./assets/sprites/__missing_sprite__/frame_0.png");
      expect(out).not.toMatch(/\bspr_gone\b(?!")/);
    } finally {
      setGmlMissingAssetNames({ fonts: new Set(), sprites: new Set() });
    }
  });

  it("an unset variable registered for an object reads through getGmlVar/gmlNum", () => {
    const out = transpileGML("zm = zoom;\n", [], new Set(["zoom"]));
    expect(out).toContain(
      'GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "zoom"))',
    );
    setGmlUnsetVarsByObject(new Map([["obj_x", new Set(["zoom"])]]));
    expect([...getGmlUnsetVars("obj_x")]).toEqual(["zoom"]);
    expect(getGmlUnsetVars("obj_none").size).toBe(0);
    setGmlUnsetVarsByObject(new Map());
  });

  it("a with body that reads and writes another object's variable resolves through the side-table", () => {
    setGmlObjectFieldNames(new Map([["obj_pShootable", new Set(["hp"])]]));
    try {
      const out = transpileGML(
        "with (instance_place(x, y, obj_pShootable)) {\n  hp--;\n}\n",
      );
      expect(out).toContain('"hp"');
      expect(out).not.toMatch(/^\s*hp--;/m);
    } finally {
      setGmlObjectFieldNames(new Map());
    }
  });

  it("the migration report names each source bug with its location and what was emitted", () => {
    const md = migrationReport({
      projectName: "P",
      entries: [],
      warnings: [],
      sourceBugs: [
        {
          kind: "unset-variable",
          name: "zoom",
          location: "objects/obj_a/Create_0.gml:11",
          detail: "reads zoom, never set.",
          emitted: "a defined 0",
        },
        {
          kind: "missing-font",
          name: "font0",
          location: "objects/oTextbox/Draw_64.gml:9",
          detail: "no such font.",
          emitted: "the bare id",
        },
      ],
    });
    expect(md).toContain("## Source bugs (defects in the original project)");
    expect(md).toContain(
      "**Variable read but never set**: `zoom` at `objects/obj_a/Create_0.gml:11`",
    );
    expect(md).toContain("**Font not in the project**: `font0`");
    expect(
      migrationReport({ projectName: "P", entries: [], warnings: [] }),
    ).not.toContain("Source bugs");
  });
});

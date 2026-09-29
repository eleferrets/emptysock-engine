import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { scanGmlEnums, buildEnumsModule } from "../gms2-enums.js";

async function makeProject(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-enums-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
  }
  return root;
}

describe("scanGmlEnums", () => {
  it("scans a real sequential enum (a real project's TRANS_MODE shape) with default values 0..n", async () => {
    const root = await makeProject({
      "objects/obj_sidebars/Create_0.gml": `
enum TRANS_MODE
{
	OFF,
	NEXT,
	GOTO,
	RESTART,
	INTRO
}
mode = TRANS_MODE.INTRO;
`,
    });
    const enums = await scanGmlEnums(root);
    expect([...(enums.get("TRANS_MODE") ?? [])]).toEqual([
      ["OFF", 0],
      ["NEXT", 1],
      ["GOTO", 2],
      ["RESTART", 3],
      ["INTRO", 4],
    ]);
  });

  it("resolves an explicit member override and resumes counting from it", async () => {
    const root = await makeProject({
      "scripts/init/init.gml": `enum E { A, B = 5, C, D = B + 2, E }`,
    });
    const enums = await scanGmlEnums(root);
    expect([...(enums.get("E") ?? [])]).toEqual([
      ["A", 0],
      ["B", 5],
      ["C", 6],
      ["D", 7],
      ["E", 8],
    ]);
  });

  it("finds an enum in any .gml file project-wide, not just Create events", async () => {
    const root = await makeProject({
      "objects/oTextbox/Create_0.gml": `enum MSG {\n\tTEXT,\n\tNAME,\n\tIMAGE\n}`,
    });
    const enums = await scanGmlEnums(root);
    expect(enums.has("MSG")).toBe(true);
    expect(enums.get("MSG")?.get("IMAGE")).toBe(2);
  });
});

describe("scanGmlEnums (lexer/parser-backed)", () => {
  it("handles nested braces, comments containing braces, trailing commas and hex/shift/multiply expressions", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `enum E {
  A, // } tricky
  /* { */ B = 1 << 3,
  C, D = $10,
  F = C * 2,
  G = -1,
}`,
    });
    const enums = await scanGmlEnums(root);
    expect([...(enums.get("E") ?? [])]).toEqual([
      ["A", 0],
      ["B", 8],
      ["C", 9],
      ["D", 16],
      ["F", 18],
      ["G", -1],
    ]);
  });

  it("ignores enums in comments and strings, and unterminated declarations", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `// enum Fake { X }\ns = "enum Str { Y }";\nenum Open { Z`,
    });
    const enums = await scanGmlEnums(root);
    expect(enums.size).toBe(0);
  });

  it("still skips an unresolvable member and malformed members without losing the rest", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `enum M { A, B = some_call(), 5, C, D E, F }`,
    });
    const enums = await scanGmlEnums(root);
    expect([...(enums.get("M") ?? [])]).toEqual([
      ["A", 0],
      ["C", 1],
      ["F", 2],
    ]);
  });

  it("resolves a member expression referencing an enum declared earlier", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `enum P { X = 5 }\nenum Q { Y = P.X + 1 }`,
    });
    const enums = await scanGmlEnums(root);
    expect(enums.get("Q")?.get("Y")).toBe(6);
  });

  it("finds an enum after a syntax error earlier in the same file", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `x = = ;\nwhile ((\nenum After { A, B }`,
    });
    const enums = await scanGmlEnums(root);
    expect(enums.get("After")?.get("B")).toBe(1);
  });
});

describe("buildEnumsModule", () => {
  it("emits one real, valid `const ... as const` object per enum", () => {
    const enums = new Map([
      [
        "TRANS_MODE",
        new Map([
          ["OFF", 0],
          ["NEXT", 1],
        ]),
      ],
    ]);
    const out = buildEnumsModule(enums);
    expect(out).toContain("export const TRANS_MODE = {");
    expect(out).toContain("OFF: 0,");
    expect(out).toContain("NEXT: 1,");
    expect(out).toContain("} as const;");
  });

  it("emits a valid, empty module when there are no enums", () => {
    const out = buildEnumsModule(new Map());
    expect(out).toContain("export {};");
  });
});

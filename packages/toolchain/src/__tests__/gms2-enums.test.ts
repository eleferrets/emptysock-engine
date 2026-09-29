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

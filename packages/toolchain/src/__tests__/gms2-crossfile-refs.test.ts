import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { scanGmlCrossFileEntityRefFields } from "../gms2-crossfile-refs.js";

async function makeProject(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-crossfile-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
  }
  return root;
}

describe("scanGmlCrossFileEntityRefFields", () => {
  it("finds a real with(...) { field = other.id; } back-reference (a real project's obj_enemy/obj_Egun shape)", async () => {
    const root = await makeProject({
      "objects/obj_enemy/Create_0.gml": `
if (has_weapon)
{
	my_gun = instance_create_layer(x, y, "Gun", obj_Egun)
	with (my_gun)
	{
		// The owner is the enemy's id
		owner = other.id;
	}
}
else my_gun = noone;
`,
    });
    const fields = await scanGmlCrossFileEntityRefFields(root);
    expect(fields.has("owner")).toBe(true);
  });

  it("finds the single-statement (brace-less) with-body form", async () => {
    const root = await makeProject({
      "objects/obj_x/Create_0.gml": `with (target) creator = other.id;`,
    });
    const fields = await scanGmlCrossFileEntityRefFields(root);
    expect(fields.has("creator")).toBe(true);
  });

  it("does not report a field assigned some other way inside a with-block", async () => {
    const root = await makeProject({
      "objects/obj_y/Create_0.gml": `
with (target)
{
	hp = 10;
	name = "foo";
}
`,
    });
    const fields = await scanGmlCrossFileEntityRefFields(root);
    expect(fields.size).toBe(0);
  });

  it("returns an empty set for a project with no matching pattern anywhere", async () => {
    const root = await makeProject({
      "objects/obj_z/Create_0.gml": `x = 1; y = 2;`,
    });
    const fields = await scanGmlCrossFileEntityRefFields(root);
    expect(fields.size).toBe(0);
  });
});

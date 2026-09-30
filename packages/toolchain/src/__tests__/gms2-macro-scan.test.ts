import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { scanGmlMacros } from "../gms2-macros.js";

async function makeProject(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-macros-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
  }
  return root;
}

describe("scanGmlMacros (lexer-backed)", () => {
  it("collects plain macros project-wide; last declaration wins; trailing comments dropped", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `#macro SAVEFILE "game.sav" // where\n#macro SPEED 4\n`,
      "objects/o/Create_0.gml": `#macro SPEED 5 /* now */\n#macro STR "a//b"\n`,
    });
    const macros = await scanGmlMacros(root);
    expect(macros.get("SAVEFILE")).toBe('"game.sav"');
    expect(macros.get("STR")).toBe('"a//b"');
    expect(["4", "5"]).toContain(macros.get("SPEED"));
  });

  it("keys config macros as Config:NAME so a bare NAME is never substituted", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `#macro Debug:LOG 1\n`,
    });
    const macros = await scanGmlMacros(root);
    expect(macros.get("Debug:LOG")).toBe("1");
    expect(macros.has("LOG")).toBe(false);
  });

  it("joins backslash continuation lines", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `#macro SUM (1 + \\\n 2)\n`,
    });
    const macros = await scanGmlMacros(root);
    expect(macros.get("SUM")).toMatch(/^\(1 \+\s+2\)$/);
  });

  it("ignores #macro text inside block comments and skips value-less macros", async () => {
    const root = await makeProject({
      "scripts/a/a.gml": `/*\n#macro HIDDEN 1\n*/\n#macro EMPTY\n#macro REAL 2\n`,
    });
    const macros = await scanGmlMacros(root);
    expect(macros.has("HIDDEN")).toBe(false);
    expect(macros.has("EMPTY")).toBe(false);
    expect(macros.get("REAL")).toBe("2");
  });
});

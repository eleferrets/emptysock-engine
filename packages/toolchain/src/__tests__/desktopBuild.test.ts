import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { bundleGameEntry } from "../desktopBuild.js";

// Covers the Rolldown migration (§16.3/§17): the toolchain CLI's real
// Node-side bundling step, standalone from `buildDesktopApp`'s cargo/Tauri
// requirements so it runs in ordinary CI without a Rust toolchain.
describe("bundleGameEntry (Rolldown)", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emptysock-bundle-test-"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeEntry(name: string, contents: Record<string, string>): string {
    const dir = path.join(tmpDir, name);
    fs.mkdirSync(dir, { recursive: true });
    for (const [file, code] of Object.entries(contents)) {
      fs.writeFileSync(path.join(dir, file), code, "utf-8");
    }
    return path.join(dir, "entry.ts");
  }

  it("bundles a single entry into an IIFE exposing the global name", async () => {
    const entry = writeEntry("single", {
      "entry.ts": `export function greet(name: string): string {
  return "hello " + name;
}
(globalThis as { __greeting?: string }).__greeting = greet("world");
`,
    });

    const result = await bundleGameEntry({ entry, minify: false });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.code).toContain("EmptySockGame");
    expect(result.code).toContain("hello ");
  });

  it("bundles across a relative import (real multi-module bundling, not just passthrough)", async () => {
    const entry = writeEntry("multi", {
      "helper.ts": `export const HELPER_VALUE = "from-helper";\n`,
      "entry.ts": `import { HELPER_VALUE } from "./helper.js";
(globalThis as { __value?: string }).__value = HELPER_VALUE;
`,
    });

    const result = await bundleGameEntry({ entry, minify: false });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.code).toContain("from-helper");
  });

  it("drops console calls when dropConsole is set", async () => {
    const entry = writeEntry("drop-console", {
      "entry.ts": `console.log("should be dropped");
(globalThis as { __ran?: boolean }).__ran = true;
`,
    });

    const result = await bundleGameEntry({
      entry,
      minify: true,
      dropConsole: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.code).not.toContain("should be dropped");
  });

  it("keeps console calls when dropConsole is not set", async () => {
    const entry = writeEntry("keep-console", {
      "entry.ts": `console.log("should stay");
(globalThis as { __ran?: boolean }).__ran = true;
`,
    });

    const result = await bundleGameEntry({ entry, minify: false });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.code).toContain("should stay");
  });

  it("reports failure for a missing entry file instead of throwing", async () => {
    const result = await bundleGameEntry({
      entry: path.join(tmpDir, "does-not-exist.ts"),
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Failed to bundle");
  });
});

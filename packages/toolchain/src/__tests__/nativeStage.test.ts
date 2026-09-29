import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stageNativePlatform, includedFilesDestFor } from "../nativeStage.js";
import { includedFilesManifestPath } from "../includedFiles.js";

describe("stageNativePlatform (android/ios/raspi)", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function project(): { root: string; entry: string; out: string } {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "native-stage-"));
    const entry = path.join(dir, "main.js");
    fs.writeFileSync(entry, "globalThis.__ran = 1;\n");
    fs.writeFileSync(path.join(dir, "all.txt"), "all");
    fs.writeFileSync(path.join(dir, "droid.txt"), "droid");
    fs.writeFileSync(path.join(dir, "pi.txt"), "pi");
    fs.writeFileSync(path.join(dir, "ios.txt"), "ios");
    fs.writeFileSync(
      includedFilesManifestPath(dir),
      JSON.stringify({
        files: [
          "all.txt",
          { path: "droid.txt", platforms: ["android"] },
          { path: "pi.txt", platforms: ["raspi"] },
          { path: "ios.txt", platforms: ["ios"] },
        ],
      }),
    );
    return { root: dir, entry, out: path.join(dir, "out") };
  }

  it.each([
    ["android", "assets/included", "droid.txt", ["pi.txt", "ios.txt"]],
    ["ios", "Resources/included", "ios.txt", ["pi.txt", "droid.txt"]],
    ["raspi", "included", "pi.txt", ["droid.txt", "ios.txt"]],
  ] as const)(
    "%s stages its own files at %s and none of the others'",
    async (platform, rel, own, others) => {
      const p = project();
      const result = await stageNativePlatform({
        platform,
        entry: p.entry,
        out: p.out,
      });
      expect(result.success).toBe(true);
      const dest = path.join(p.out, rel);
      expect(dest).toBe(includedFilesDestFor(platform, p.out));
      expect(fs.existsSync(path.join(dest, "all.txt"))).toBe(true);
      expect(fs.existsSync(path.join(dest, own))).toBe(true);
      for (const o of others)
        expect(fs.existsSync(path.join(dest, o))).toBe(false);
      expect(fs.existsSync(path.join(p.out, "game.js"))).toBe(true);
      const desc = JSON.parse(
        fs.readFileSync(path.join(p.out, `${platform}-export.json`), "utf-8"),
      ) as { platform: string; includedFiles: string[] };
      expect(desc.platform).toBe(platform);
      expect(desc.includedFiles.length).toBe(2);
    },
  );

  it("works with no manifest and reports a bundle failure honestly", async () => {
    const p = project();
    fs.rmSync(includedFilesManifestPath(p.root));
    const ok = await stageNativePlatform({
      platform: "raspi",
      entry: p.entry,
      out: p.out,
    });
    expect(ok.success && ok.includedFiles).toEqual([]);
    const bad = await stageNativePlatform({
      platform: "raspi",
      entry: path.join(p.root, "missing.js"),
      out: p.out,
    });
    expect(bad.success).toBe(false);
  });
});

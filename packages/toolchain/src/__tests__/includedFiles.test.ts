import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadIncludedFilesManifest,
  resolveIncludedFilesForPlatform,
  copyIncludedFiles,
  includedFilesManifestPath,
} from "../includedFiles.js";

describe("includedFiles", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function mkTmp(prefix: string): string {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    return dir;
  }

  describe("loadIncludedFilesManifest", () => {
    it("returns null when no manifest file exists (not an error)", () => {
      const d = mkTmp("included-none-");
      expect(loadIncludedFilesManifest(d)).toBeNull();
    });

    it("parses a manifest with plain string entries, defaulting platforms to ['all']", () => {
      const d = mkTmp("included-strings-");
      fs.writeFileSync(
        includedFilesManifestPath(d),
        JSON.stringify({ files: ["readme.txt", "license.txt"] }),
      );
      const manifest = loadIncludedFilesManifest(d);
      expect(manifest).not.toBeNull();
      expect(manifest?.files).toEqual([
        { path: "readme.txt", platforms: ["all"] },
        { path: "license.txt", platforms: ["all"] },
      ]);
    });

    it("parses a manifest with explicit per-platform object entries", () => {
      const d = mkTmp("included-objects-");
      fs.writeFileSync(
        includedFilesManifestPath(d),
        JSON.stringify({
          files: [
            { path: "assets/common.dat" },
            { path: "win-only.dll", platforms: ["windows"] },
            { path: "mobile.txt", platforms: ["android", "ios"] },
          ],
        }),
      );
      const manifest = loadIncludedFilesManifest(d);
      expect(manifest?.files).toEqual([
        { path: "assets/common.dat", platforms: ["all"] },
        { path: "win-only.dll", platforms: ["windows"] },
        { path: "mobile.txt", platforms: ["android", "ios"] },
      ]);
    });

    it("throws a descriptive error for malformed JSON", () => {
      const d = mkTmp("included-badjson-");
      fs.writeFileSync(includedFilesManifestPath(d), "{ not json");
      expect(() => loadIncludedFilesManifest(d)).toThrow(/Invalid JSON/);
    });

    it("throws a descriptive error when 'files' is missing or not an array", () => {
      const d = mkTmp("included-badshape-");
      fs.writeFileSync(
        includedFilesManifestPath(d),
        JSON.stringify({ nope: true }),
      );
      expect(() => loadIncludedFilesManifest(d)).toThrow(/"files" array/);
    });

    it("throws a descriptive error for a malformed entry", () => {
      const d = mkTmp("included-badentry-");
      fs.writeFileSync(
        includedFilesManifestPath(d),
        JSON.stringify({ files: [{ platforms: ["all"] }] }),
      );
      expect(() => loadIncludedFilesManifest(d)).toThrow(/entry 0/);
    });

    it("honours an explicit manifest path override", () => {
      const d = mkTmp("included-override-");
      const customPath = path.join(d, "custom-manifest.json");
      fs.writeFileSync(customPath, JSON.stringify({ files: ["x.txt"] }));
      const manifest = loadIncludedFilesManifest(d, customPath);
      expect(manifest?.files[0]?.path).toBe("x.txt");
    });
  });

  describe("resolveIncludedFilesForPlatform", () => {
    const manifest = {
      files: [
        { path: "common.txt", platforms: ["all"] as const },
        { path: "win.dll", platforms: ["windows"] as const },
        { path: "mac.dylib", platforms: ["mac"] as const },
        { path: "mobile.dat", platforms: ["android", "ios"] as const },
        { path: "no-platforms-given.txt" },
      ],
    };

    it("includes 'all' entries and entries missing 'platforms' for every platform", () => {
      const forWindows = resolveIncludedFilesForPlatform(
        manifest as never,
        "windows",
      );
      expect(forWindows.map((e) => e.path)).toEqual(
        expect.arrayContaining([
          "common.txt",
          "win.dll",
          "no-platforms-given.txt",
        ]),
      );
      expect(forWindows.map((e) => e.path)).not.toContain("mac.dylib");
      expect(forWindows.map((e) => e.path)).not.toContain("mobile.dat");
    });

    it("filters correctly for a platform with multiple tagged entries (android)", () => {
      const forAndroid = resolveIncludedFilesForPlatform(
        manifest as never,
        "android",
      );
      expect(forAndroid.map((e) => e.path)).toEqual(
        expect.arrayContaining([
          "common.txt",
          "mobile.dat",
          "no-platforms-given.txt",
        ]),
      );
      expect(forAndroid.map((e) => e.path)).not.toContain("win.dll");
    });
  });

  describe("copyIncludedFiles", () => {
    it("copies a plain file, preserving its relative path", () => {
      const d = mkTmp("included-copy-file-");
      fs.writeFileSync(path.join(d, "readme.txt"), "hello");
      const dest = path.join(d, "dest");
      const result = copyIncludedFiles(d, [{ path: "readme.txt" }], dest);
      expect(result.warnings).toEqual([]);
      expect(fs.readFileSync(path.join(dest, "readme.txt"), "utf-8")).toBe(
        "hello",
      );
      expect(result.copied).toEqual([path.join(dest, "readme.txt")]);
    });

    it("copies a directory recursively", () => {
      const d = mkTmp("included-copy-dir-");
      fs.mkdirSync(path.join(d, "config", "sub"), { recursive: true });
      fs.writeFileSync(path.join(d, "config", "a.json"), "{}");
      fs.writeFileSync(path.join(d, "config", "sub", "b.json"), "{}");
      const dest = path.join(d, "dest");
      const result = copyIncludedFiles(d, [{ path: "config" }], dest);
      expect(result.warnings).toEqual([]);
      expect(fs.existsSync(path.join(dest, "config", "a.json"))).toBe(true);
      expect(fs.existsSync(path.join(dest, "config", "sub", "b.json"))).toBe(
        true,
      );
      expect(result.copied.length).toBe(2);
    });

    it("records a warning (not a throw) for a missing source path, and still copies the rest", () => {
      const d = mkTmp("included-copy-missing-");
      fs.writeFileSync(path.join(d, "present.txt"), "ok");
      const dest = path.join(d, "dest");
      const result = copyIncludedFiles(
        d,
        [{ path: "missing.txt" }, { path: "present.txt" }],
        dest,
      );
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toMatch(/missing.txt/);
      expect(fs.existsSync(path.join(dest, "present.txt"))).toBe(true);
    });
  });
});

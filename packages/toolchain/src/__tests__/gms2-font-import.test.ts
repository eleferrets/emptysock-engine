import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { convertGms2Font, buildFontAsset } from "../gms2-font-import.js";

const tmpDirs: string[] = [];

async function makeFontDir(yyContents: string, dirName = "fnt_menu") {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-font-"));
  tmpDirs.push(dir);
  const fontDir = path.join(dir, dirName);
  await fs.mkdir(fontDir, { recursive: true });
  await fs.writeFile(path.join(fontDir, `${dirName}.yy`), yyContents, "utf-8");
  return fontDir;
}

afterEach(async () => {
  await Promise.all(
    tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })),
  );
});

describe("convertGms2Font", () => {
  it("reads fontName (not name) as the real typeface family, plus size/bold/italic", async () => {
    const dir = await makeFontDir(
      JSON.stringify({
        resourceType: "GMFont",
        name: "fnt_menu",
        fontName: "Impact",
        size: 24,
        bold: true,
        italic: false,
      }),
    );
    const asset = await convertGms2Font(dir);
    expect(asset).toEqual({
      name: "fnt_menu",
      family: "Impact",
      size: 24,
      bold: true,
      italic: false,
    });
  });

  it("falls back to the resource's own name when fontName is missing", async () => {
    const dir = await makeFontDir(
      JSON.stringify({ resourceType: "GMFont", name: "fnt_body", size: 12 }),
    );
    const asset = await convertGms2Font(dir);
    expect(asset.family).toBe("fnt_body");
    expect(asset.size).toBe(12);
    expect(asset.bold).toBe(false);
    expect(asset.italic).toBe(false);
  });

  it("tolerates GameMaker's real trailing-comma-before-close JSON quirk", async () => {
    const dir = await makeFontDir(
      '{\n  "resourceType": "GMFont",\n  "name": "fnt_trail",\n  "fontName": "Consolas",\n  "size": 16,\n}\n',
    );
    const asset = await convertGms2Font(dir);
    expect(asset.family).toBe("Consolas");
    expect(asset.size).toBe(16);
  });

  it("throws a descriptive error when no .yy file exists in the directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-font-empty-"));
    tmpDirs.push(dir);
    await expect(convertGms2Font(dir)).rejects.toThrow(/no \.yy file/);
  });

  it("throws a descriptive error for a nonexistent directory", async () => {
    await expect(
      convertGms2Font("/nonexistent/path/should/not/exist"),
    ).rejects.toThrow(/cannot read directory/);
  });
});

describe("buildFontAsset", () => {
  it("emits a PascalCase-named const with a precomposed cssFont string in the right order", () => {
    const source = buildFontAsset({
      name: "fnt_menu",
      family: "Impact",
      size: 24,
      bold: true,
      italic: false,
    });
    expect(source).toContain("export const FntMenuFont = {");
    expect(source).toContain('cssFont: "bold 24px Impact"');
    expect(source).toContain('family: "Impact"');
    expect(source).toContain("size: 24");
  });

  it("folds both italic and bold into cssFont, italic first (matching FontRegistry.cssFontFor's own order)", () => {
    const source = buildFontAsset({
      name: "fnt_both",
      family: "Georgia",
      size: 10,
      bold: true,
      italic: true,
    });
    expect(source).toContain('cssFont: "italic bold 10px Georgia"');
  });

  it("documents the real FontRegistry usage pattern in its own comment", () => {
    const source = buildFontAsset({
      name: "fnt_menu",
      family: "Impact",
      size: 24,
      bold: false,
      italic: false,
    });
    expect(source).toContain("game.fonts.register(");
    expect(source).toContain("fontId:");
  });
});

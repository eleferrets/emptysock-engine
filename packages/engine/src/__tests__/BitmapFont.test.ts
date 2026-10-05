import { describe, it, expect } from "vitest";

const { FontRegistry } = await import("../systems/FontRegistry.js");
const { bitmapKerning, layoutBitmapText, toPixiBitmapFontData } =
  await import("../systems/BitmapFontDef.js");
import type { BitmapFontDef } from "../systems/BitmapFontDef.js";

const DEF: BitmapFontDef = {
  name: "fnt_menu",
  atlasPath: "./assets/fonts/fnt_menu.png",
  size: 24,
  lineHeight: 40,
  glyphs: {
    65: { x: 2, y: 2, w: 10, h: 37, shift: 11, offset: 1 },
    66: { x: 14, y: 2, w: 9, h: 40, shift: 10, offset: 0 },
  },
  kerning: [[65, 66, -2]],
};

describe("BitmapFontDef (pixi-free)", () => {
  it("looks up kerning, 0 for an unlisted pair", () => {
    expect(bitmapKerning(DEF, 65, 66)).toBe(-2);
    expect(bitmapKerning(DEF, 66, 65)).toBe(0);
  });

  it("lays out glyphs with offset, shift, kerning and newlines; skips unknown code points", () => {
    const l = layoutBitmapText(DEF, "AB\nA?");
    expect(l.placements.map((p) => [p.codePoint, p.x, p.y])).toEqual([
      [65, 1, 0], // pen 0 + offset 1
      [66, 9, 0], // pen 11 - 2 kerning = 9, offset 0
      [65, 1, 40], // second line
    ]);
    expect(l.width).toBe(19); // 11-2 + 10
    expect(l.height).toBe(80);
  });

  it("converts to pixi font data, keying kerning by the previous letter", () => {
    const d = toPixiBitmapFontData(DEF, "fam");
    expect(d.lineHeight).toBe(40);
    expect(d.fontSize).toBe(24);
    expect(d.chars["A"]).toMatchObject({
      x: 2,
      width: 10,
      xOffset: 1,
      xAdvance: 11,
    });
    expect(d.chars["B"]?.kerning).toEqual({ A: -2 });
    expect(d.pages[0]?.file).toBe(DEF.atlasPath);
  });
});

describe("FontRegistry bitmap fonts", () => {
  it("registers, reads and clears bitmap defs independently of CSS descriptors", () => {
    const fonts = new FontRegistry();
    expect(fonts.hasBitmap("fnt_menu")).toBe(false);
    fonts.registerBitmap("fnt_menu", DEF);
    expect(fonts.getBitmap("fnt_menu")).toBe(DEF);
    expect(fonts.has("fnt_menu")).toBe(false);
    fonts.clear();
    expect(fonts.getBitmap("fnt_menu")).toBeUndefined();
  });
});

/**
 * A pixi-free description of a pre-rendered bitmap font: an atlas image plus
 * per-glyph rectangles, advances and kerning. This is the shape
 * `@emptysock/toolchain`'s GMS2 font importer emits for a real GameMaker
 * font resource (`.yy` `glyphs` map + `kerningPairs`), registered in
 * `FontRegistry.registerBitmap(id, def)`. Keeping it free of any pixi import
 * keeps the registry, the layout maths and their tests inside the engine
 * environment boundary; `RenderPipeline`'s `PixiGmlDrawTarget` is the one
 * place a def becomes a real pixi `BitmapFont`/`BitmapText`.
 */
export interface BitmapGlyph {
  /** Top-left of the glyph's rectangle inside the atlas image, in pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Horizontal advance to the next glyph (GameMaker's `shift`). */
  shift: number;
  /** Horizontal offset applied when drawing the glyph rect (GameMaker's `offset`, the left bearing). */
  offset: number;
}

export interface BitmapFontDef {
  name: string;
  /** Path of the atlas image, loaded through the same texture path `Sprite.texturePath` uses. */
  atlasPath: string;
  /** The font's nominal point size (GameMaker's `size`). */
  size: number;
  /** Distance between baselines: the tallest glyph's `h`, since every GameMaker glyph rect spans its own full line box. */
  lineHeight: number;
  /** Glyph rectangles keyed by Unicode code point. */
  glyphs: Record<number, BitmapGlyph>;
  /** `[first, second, amount]`: `amount` pixels are added to the advance between glyph `first` and glyph `second`. */
  kerning: ReadonlyArray<readonly [number, number, number]>;
}

/** The kerning amount between two code points (0 when the pair has no entry). */
export function bitmapKerning(
  def: BitmapFontDef,
  first: number,
  second: number,
): number {
  for (const [a, b, amount] of def.kerning) {
    if (a === first && b === second) return amount;
  }
  return 0;
}

export interface BitmapGlyphPlacement {
  codePoint: number;
  glyph: BitmapGlyph;
  /** Where the glyph rect's top-left lands, relative to the text origin (offset already applied). */
  x: number;
  y: number;
}

export interface BitmapTextLayout {
  placements: BitmapGlyphPlacement[];
  width: number;
  height: number;
}

/**
 * Lays out `text` (`\n` starts a new line) the way GameMaker draws a bitmap
 * font: each glyph rect is drawn at `penX + offset`, then the pen advances by
 * `shift` plus any kerning against the next glyph. Code points with no glyph
 * are skipped. Pure maths, used to verify the pixi wiring against a known
 * layout and available to hosts that render bitmap text some other way.
 */
export function layoutBitmapText(
  def: BitmapFontDef,
  text: string,
): BitmapTextLayout {
  const placements: BitmapGlyphPlacement[] = [];
  let width = 0;
  let line = 0;
  let pen = 0;
  const points = Array.from(text, (c) => c.codePointAt(0) as number);
  for (let i = 0; i < points.length; i++) {
    const cp = points[i] as number;
    if (cp === 10) {
      width = Math.max(width, pen);
      line++;
      pen = 0;
      continue;
    }
    const glyph = def.glyphs[cp];
    if (glyph === undefined) continue;
    placements.push({
      codePoint: cp,
      glyph,
      x: pen + glyph.offset,
      y: line * def.lineHeight,
    });
    const next = points[i + 1];
    pen +=
      glyph.shift + (next !== undefined ? bitmapKerning(def, cp, next) : 0);
  }
  width = Math.max(width, pen);
  return { placements, width, height: (line + 1) * def.lineHeight };
}

/** Structural mirror of pixi's `BitmapFontData` (declared here so this file stays pixi-free). */
export interface PixiBitmapFontDataLike {
  baseLineOffset: number;
  chars: Record<
    string,
    {
      id: number;
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      xOffset: number;
      yOffset: number;
      xAdvance: number;
      letter: string;
      kerning: Record<string, number>;
    }
  >;
  pages: { id: number; file: string }[];
  lineHeight: number;
  fontSize: number;
  fontFamily: string;
}

/**
 * Converts a def to pixi's `BitmapFontData`. pixi keys a glyph by its letter
 * string and kerns by the *previous* letter (`kerning[previousChar]`), so a
 * `[first, second, amount]` pair becomes `chars[second].kerning[first]`.
 */
export function toPixiBitmapFontData(
  def: BitmapFontDef,
  fontFamily: string,
): PixiBitmapFontDataLike {
  const chars: PixiBitmapFontDataLike["chars"] = {};
  for (const [key, g] of Object.entries(def.glyphs)) {
    const cp = Number(key);
    const letter = String.fromCodePoint(cp);
    chars[letter] = {
      id: cp,
      page: 0,
      x: g.x,
      y: g.y,
      width: g.w,
      height: g.h,
      xOffset: g.offset,
      yOffset: 0,
      xAdvance: g.shift,
      letter,
      kerning: {},
    };
  }
  for (const [first, second, amount] of def.kerning) {
    const target = chars[String.fromCodePoint(second)];
    if (target !== undefined) {
      target.kerning[String.fromCodePoint(first)] = amount;
    }
  }
  return {
    baseLineOffset: 0,
    chars,
    pages: [{ id: 0, file: def.atlasPath }],
    lineHeight: def.lineHeight,
    fontSize: def.size,
    fontFamily,
  };
}

/**
 * A pixi-free description of a pre-rendered bitmap font: an atlas image plus
 * per-glyph rectangles, advances and kerning. This is the shape
 * `@emptysock/toolchain`'s font pipeline emits for a
 * font resource (`glyphs` map + `kerningPairs`), registered in
 * `FontRegistry.registerBitmap(id, def)`. Keeping it free of any pixi import
 * keeps the registry, the layout maths and their tests inside the engine
 * environment boundary; `RenderPipeline`'s `PixiDrawTarget` is the one
 * place a def becomes a real pixi `BitmapFont`/`BitmapText`.
 */
export interface BitmapGlyph {
  /** Top-left of the glyph's rectangle inside the atlas image, in pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Horizontal advance to the next glyph (`shift`). */
  shift: number;
  /** Horizontal offset applied when drawing the glyph rect (`offset`, the left bearing). */
  offset: number;
}
export interface BitmapFontDef {
  name: string;
  /** Path of the atlas image, loaded through the same texture path `Sprite.texturePath` uses. */
  atlasPath: string;
  /** The font's nominal point size (`size`). */
  size: number;
  /** Distance between baselines: the tallest glyph's `h`, since every glyph rect spans its own full line box. */
  lineHeight: number;
  /** Glyph rectangles keyed by Unicode code point. */
  glyphs: Record<number, BitmapGlyph>;
  /** `[first, second, amount]`: `amount` pixels are added to the advance between glyph `first` and glyph `second`. */
  kerning: ReadonlyArray<readonly [number, number, number]>;
}
/** The kerning amount between two code points (0 when the pair has no entry). */
export declare function bitmapKerning(
  def: BitmapFontDef,
  first: number,
  second: number,
): number;
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
 * Lays out `text` (`\n` starts a new line) the way a bitmap
 * font: each glyph rect is drawn at `penX + offset`, then the pen advances by
 * `shift` plus any kerning against the next glyph. Code points with no glyph
 * are skipped. Pure maths, used to verify the pixi wiring against a known
 * layout and available to hosts that render bitmap text some other way.
 */
export declare function layoutBitmapText(
  def: BitmapFontDef,
  text: string,
): BitmapTextLayout;
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
  pages: {
    id: number;
    file: string;
  }[];
  lineHeight: number;
  fontSize: number;
  fontFamily: string;
}
/**
 * Converts a def to pixi's `BitmapFontData`. pixi keys a glyph by its letter
 * string and kerns by the *previous* letter (`kerning[previousChar]`), so a
 * `[first, second, amount]` pair becomes `chars[second].kerning[first]`.
 */
export declare function toPixiBitmapFontData(
  def: BitmapFontDef,
  fontFamily: string,
): PixiBitmapFontDataLike;

import { promises as fs } from "node:fs";
import path from "node:path";
import { parseGmsJson } from "./gms2-parse.js";

export interface FontAsset {
  name: string;
  /** The font family name — GMS2's real `.yy` field is `fontName`, not `name`. */
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  /** Present when the font has a real glyph atlas PNG and at least one glyph rect. */
  bitmap?: BitmapFontAsset;
}

export interface BitmapGlyphAsset {
  character: number;
  x: number;
  y: number;
  w: number;
  h: number;
  shift: number;
  offset: number;
}

export interface BitmapFontAsset {
  /** Absolute path of the atlas PNG on disk (copied by `copyFontAtlas`). */
  atlasSrc: string;
  /** Tallest glyph `h` — every GameMaker glyph rect spans its own line box, so this is the baseline-to-baseline distance. */
  lineHeight: number;
  glyphs: BitmapGlyphAsset[];
  /** `[first, second, amount]` triples from the `.yy` `kerningPairs`. */
  kerning: Array<[number, number, number]>;
}

interface YyFont {
  name?: string;
  fontName?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  glyphs?: unknown;
  kerningPairs?: unknown;
  [key: string]: unknown;
}

function isYyFont(val: unknown): val is YyFont {
  return typeof val === "object" && val !== null;
}

/**
 * Convert a GMS2 font resource directory (containing a `.yy` file) into a
 * `FontAsset`.
 *
 * Family/size/bold/italic always convert (the CSS-string path `Label`/
 * `ButtonState`/`Checkbox` use). A font whose real `.yy` carries a `glyphs`
 * map and whose atlas PNG (`<font dir>/<name>.png`, or the directory's only
 * PNG) exists also converts to a `BitmapFontAsset`: the atlas path, every
 * glyph rect (`{x,y,w,h,character,shift,offset}`), `kerningPairs`, and a
 * derived line height (tallest glyph `h`, since a `.yy` has no explicit line
 * height field). `@emptysock/engine` registers that as a `BitmapFontDef` in
 * `FontRegistry` and draws GML `draw_text` with it through pixi `BitmapText`.
 * A font with no usable glyph data or atlas is metadata-only, and the import
 * warns rather than silently dropping the fact that it existed.
 *
 * Throws a descriptive Error if the directory or `.yy` file cannot be
 * read, or the JSON is invalid.
 */
export async function convertGms2Font(fontYyDir: string): Promise<FontAsset> {
  let entries: string[];
  try {
    entries = await fs.readdir(fontYyDir);
  } catch (err) {
    throw new Error(
      `convertGms2Font: cannot read directory "${fontYyDir}": ${String(err)}`,
    );
  }

  const yyFile = entries.find((e) => e.endsWith(".yy"));
  if (yyFile === undefined) {
    throw new Error(`convertGms2Font: no .yy file found in "${fontYyDir}"`);
  }

  const yyPath = path.join(fontYyDir, yyFile);
  let raw: string;
  try {
    raw = await fs.readFile(yyPath, "utf-8");
  } catch (err) {
    throw new Error(`convertGms2Font: cannot read "${yyPath}": ${String(err)}`);
  }

  let parsed: unknown;
  try {
    parsed = parseGmsJson(raw);
  } catch (err) {
    throw new Error(
      `convertGms2Font: invalid JSON in "${yyPath}": ${String(err)}`,
    );
  }

  if (!isYyFont(parsed)) {
    throw new Error(`convertGms2Font: unexpected .yy structure in "${yyPath}"`);
  }

  const name =
    typeof parsed.name === "string" ? parsed.name : path.basename(fontYyDir);
  // Real GMS2 font .yy files carry the family name under "fontName" — "name"
  // is just the resource's own name (e.g. "font0"), not the typeface.
  const family =
    typeof parsed.fontName === "string" && parsed.fontName.length > 0
      ? parsed.fontName
      : name;
  const size = typeof parsed.size === "number" ? parsed.size : 12;
  const bold = typeof parsed.bold === "boolean" ? parsed.bold : false;
  const italic = typeof parsed.italic === "boolean" ? parsed.italic : false;

  const asset: FontAsset = { name, family, size, bold, italic };
  const bitmap = await readBitmapFont(fontYyDir, entries, name, parsed);
  if (bitmap !== undefined) asset.bitmap = bitmap;
  return asset;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

async function readBitmapFont(
  dir: string,
  entries: string[],
  name: string,
  yy: YyFont,
): Promise<BitmapFontAsset | undefined> {
  if (typeof yy.glyphs !== "object" || yy.glyphs === null) return undefined;
  const glyphs: BitmapGlyphAsset[] = [];
  for (const [key, raw] of Object.entries(yy.glyphs)) {
    if (typeof raw !== "object" || raw === null) continue;
    const g = raw as Record<string, unknown>;
    const character = num(g["character"], Number(key));
    if (!Number.isFinite(character)) continue;
    glyphs.push({
      character,
      x: num(g["x"]),
      y: num(g["y"]),
      w: num(g["w"]),
      h: num(g["h"]),
      shift: num(g["shift"]),
      offset: num(g["offset"]),
    });
  }
  if (glyphs.length === 0) return undefined;
  const pngs = entries.filter((e) => e.toLowerCase().endsWith(".png"));
  const atlasFile =
    pngs.find((e) => e === `${name}.png`) ??
    (pngs.length === 1 ? pngs[0] : undefined);
  if (atlasFile === undefined) return undefined;
  const atlasSrc = path.join(dir, atlasFile);
  try {
    await fs.access(atlasSrc);
  } catch {
    return undefined;
  }
  const kerning: Array<[number, number, number]> = [];
  if (Array.isArray(yy.kerningPairs)) {
    for (const raw of yy.kerningPairs as unknown[]) {
      if (typeof raw !== "object" || raw === null) continue;
      const k = raw as Record<string, unknown>;
      if (
        typeof k["first"] === "number" &&
        typeof k["second"] === "number" &&
        typeof k["amount"] === "number"
      ) {
        kerning.push([k["first"], k["second"], k["amount"]]);
      }
    }
  }
  const lineHeight = glyphs.reduce((m, g) => Math.max(m, g.h), 0);
  return { atlasSrc, lineHeight, glyphs, kerning };
}

/** Where a converted bitmap font's atlas lives, relative to the import output root and to the game (`./`-prefixed, same convention as sprite textures). */
export function fontAtlasRelPath(name: string): string {
  return `assets/fonts/${name}.png`;
}

/** Copies a bitmap font's atlas PNG into `<outDir>/assets/fonts/<name>.png`. No-op for a metadata-only font. */
export async function copyFontAtlas(
  font: FontAsset,
  outDir: string,
): Promise<void> {
  if (font.bitmap === undefined) return;
  const dest = path.join(outDir, fontAtlasRelPath(font.name));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(font.bitmap.atlasSrc, dest);
}

function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Build a TypeScript font module from a converted GMS2 font: the CSS-style
 * descriptor always, plus — when the font has a glyph atlas — a
 * `BitmapFontDef` (`XFontBitmap`) for `FontRegistry.registerBitmap`. The
 * atlas image itself is copied separately by `copyFontAtlas`. Colocated with
 * the conversion logic here (rather than `gms2-codegen.ts`) for the same
 * reason `buildSoundAsset` is colocated in `gms2-sound-import.ts`.
 */
export function buildFontAsset(font: FontAsset): string {
  const cssStyle = `${font.italic ? "italic " : ""}${font.bold ? "bold " : ""}${font.size}px ${font.family}`;
  const pascal = toPascalCase(font.name);
  const b = font.bitmap;
  const bitmapNote =
    b === undefined
      ? `// No usable glyph atlas was found for this font, so only family/size/style
// metadata carries over (Canvas/CSS text). If "${font.family}" isn't installed
// on the machine/browser rendering this game, install it or substitute a
// comparable family.`
      : `// This font has a pre-rendered glyph atlas, exported below as a
// BitmapFontDef so GML draw_text renders with the real GameMaker glyphs.
// If "${font.family}" is also installed, the CSS descriptor works for Label
// widgets too.`;
  const glyphLines =
    b === undefined
      ? ""
      : [...b.glyphs]
          .sort((p, q) => p.character - q.character)
          .map(
            (g) =>
              `    ${g.character}: { x: ${g.x}, y: ${g.y}, w: ${g.w}, h: ${g.h}, shift: ${g.shift}, offset: ${g.offset} },`,
          )
          .join("\n");
  const kerningLines =
    b === undefined
      ? ""
      : b.kerning.map((k) => `    [${k[0]}, ${k[1]}, ${k[2]}],`).join("\n");
  const bitmapDef =
    b === undefined
      ? ""
      : `
/** Pixi-free bitmap font definition (see @emptysock/engine's BitmapFontDef). The atlas image is copied to ${fontAtlasRelPath(font.name)}. */
export const ${pascal}FontBitmap: BitmapFontDef = {
  name: ${JSON.stringify(font.name)},
  atlasPath: ${JSON.stringify(`./${fontAtlasRelPath(font.name)}`)},
  size: ${font.size},
  /** Tallest glyph rect (a .yy has no explicit line height). */
  lineHeight: ${b.lineHeight},
  glyphs: {
${glyphLines}
  },
  kerning: [
${kerningLines}
  ],
};
`;
  const importLine =
    b === undefined
      ? ""
      : `import type { BitmapFontDef } from "@emptysock/engine";\n\n`;
  const registerHint =
    b === undefined
      ? ""
      : `//   game.fonts.registerBitmap(${JSON.stringify(font.name)}, ${pascal}FontBitmap);\n`;
  return `// Auto-generated from GMS2 font: ${font.name}
${bitmapNote}
//
// Use with @emptysock/engine's FontRegistry (register once, reference by id):
//   game.fonts.register(${JSON.stringify(font.name)}, ${pascal}Font);
${registerHint}//   entity.add(Label, { fontId: ${JSON.stringify(font.name)} });
// ...or set font/fontSize directly with no registry involved:
//   entity.add(Label, { font: ${JSON.stringify(font.family)}, fontSize: ${font.size} });
${importLine}export const ${pascal}Font = {
  name: ${JSON.stringify(font.name)},
  family: ${JSON.stringify(font.family)},
  size: ${font.size},
  bold: ${font.bold},
  italic: ${font.italic},
  /** Precomposed CSS font string, folding bold/italic in (Label has no separate bold/italic fields). */
  cssFont: ${JSON.stringify(cssStyle)},
} as const;
${bitmapDef}`;
}

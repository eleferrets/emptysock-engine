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
}

interface YyFont {
  name?: string;
  fontName?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  [key: string]: unknown;
}

function isYyFont(val: unknown): val is YyFont {
  return typeof val === "object" && val !== null;
}

/**
 * Convert a GMS2 font resource directory (containing a `.yy` file) into a
 * `FontAsset`.
 *
 * `@emptysock/engine`'s text rendering (`ui/UISystem.ts`'s `Label`/
 * `ButtonState`/`Checkbox` drawing) is plain Canvas/CSS font strings
 * (`` `${fontSize}px ${font}` ``, `components/Widgets.ts`'s `Label.font`) —
 * there is no bitmap-font/glyph-atlas rendering path anywhere in this
 * engine. A GMS2 font resource's pre-rendered glyph atlas PNG and per-glyph
 * rect map therefore have no real target to convert *into*: the honest,
 * correct conversion is metadata-only (family/size/bold/italic), matching
 * what `Label`/`ButtonState`/`Checkbox` actually consume. The atlas PNG
 * itself is never copied — callers should note in the migration report that
 * it wasn't used, not silently drop the fact that it existed.
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

  return { name, family, size, bold, italic };
}

function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Build a TypeScript font-style descriptor from a converted GMS2 font. No
 * binary asset is copied — see `convertGms2Font`'s doc comment for why the
 * glyph atlas PNG has no real target in this engine. Colocated with the
 * conversion logic here (rather than `gms2-codegen.ts`) for the same reason
 * `buildSoundAsset` is colocated in `gms2-sound-import.ts`.
 */
export function buildFontAsset(font: FontAsset): string {
  const cssStyle = `${font.italic ? "italic " : ""}${font.bold ? "bold " : ""}${font.size}px ${font.family}`;
  return `// Auto-generated from GMS2 font: ${font.name}
// This engine renders text via plain Canvas/CSS font strings (see
// @emptysock/engine's Label/ButtonState/Checkbox components) — there is no
// bitmap-font/glyph-atlas rendering path, so the source font's pre-rendered
// glyph atlas image was intentionally NOT copied. Only family/size/style
// metadata carries over. If "${font.family}" isn't installed as a real font
// on the machine/browser rendering this game, install it separately or
// substitute a comparable font family.
//
// Use with @emptysock/engine's Label (or ButtonState/Checkbox) component:
//   entity.add(Label, { font: ${JSON.stringify(font.family)}, fontSize: ${font.size} });
export const ${toPascalCase(font.name)}Font = {
  name: ${JSON.stringify(font.name)},
  family: ${JSON.stringify(font.family)},
  size: ${font.size},
  bold: ${font.bold},
  italic: ${font.italic},
  /** Precomposed CSS font string, folding bold/italic in (Label has no separate bold/italic fields). */
  cssFont: ${JSON.stringify(cssStyle)},
} as const;
`;
}

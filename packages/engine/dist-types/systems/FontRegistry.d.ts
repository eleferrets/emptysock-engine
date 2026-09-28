import type { BitmapFontDef } from "./BitmapFontDef.js";
/**
 * A real component for working with fonts — a `Game`-scoped registry of
 * named font descriptors (family/size/bold/italic, plus a precomposed CSS
 * font string), the exact shape `@emptysock/toolchain`'s GMS2 font importer
 * already emits (`buildFontAsset` — family/size/style metadata, no
 * bitmap-glyph-atlas rendering path since this engine's text is plain
 * Canvas/CSS, see that function's own doc comment). Before this, a
 * generated `*.font.ts` descriptor had nowhere real to register into —
 * `Label`/`ButtonState`/`Checkbox` each duplicated a raw `font`/`fontSize`
 * pair with no shared font-asset concept at all.
 *
 * Registered as a `Game` service the same way `GlobalStore`/`PluginSystem`
 * are (see `Services.ts`'s own doc comment and `Game.ts`'s constructor) —
 * one instance per `Game`, alive for its whole lifetime, handed to scene
 * code via `SceneLifecycle.fonts` for convenience. `UISystem` optionally
 * takes a `FontRegistry` (`UISystemOptions.fonts`) and resolves a widget's
 * `fontId` through it when set, falling back to the widget's own raw
 * `font`/`fontSize` fields otherwise — additive, so existing widgets with
 * no `fontId` set keep working unchanged.
 */
export interface FontDescriptor {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
}
export declare class FontRegistry {
  private readonly _fonts;
  private readonly _bitmaps;
  /**
   * Registers a pre-rendered bitmap font (atlas + glyph rects, see
   * `BitmapFontDef`) under `id`. Independent of `register()`: an id may have
   * a CSS descriptor, a bitmap def, or both — `PixiGmlDrawTarget` prefers the
   * bitmap def for `draw_text` when one exists, and `UISystem`'s Canvas text
   * keeps using the descriptor.
   */
  registerBitmap(id: string, def: BitmapFontDef): void;
  getBitmap(id: string): BitmapFontDef | undefined;
  hasBitmap(id: string): boolean;
  register(id: string, font: FontDescriptor): void;
  get(id: string): FontDescriptor | undefined;
  has(id: string): boolean;
  /** Precomposed `"[italic ][bold ]<size>px <family>"` CSS font string, or `undefined` for an unregistered id. */
  cssFontFor(id: string): string | undefined;
  /** Every registered font id, for debugging/inspection tooling. */
  keys(): IterableIterator<string>;
  /** Clears every registered font — mainly for test isolation between `Game` instances. */
  clear(): void;
}

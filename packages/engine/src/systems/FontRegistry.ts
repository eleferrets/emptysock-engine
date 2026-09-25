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

export class FontRegistry {
  private readonly _fonts = new Map<string, FontDescriptor>();

  register(id: string, font: FontDescriptor): void {
    this._fonts.set(id, font);
  }

  get(id: string): FontDescriptor | undefined {
    return this._fonts.get(id);
  }

  has(id: string): boolean {
    return this._fonts.has(id);
  }

  /** Precomposed `"[italic ][bold ]<size>px <family>"` CSS font string, or `undefined` for an unregistered id. */
  cssFontFor(id: string): string | undefined {
    const font = this._fonts.get(id);
    if (font === undefined) return undefined;
    return `${font.italic ? "italic " : ""}${font.bold ? "bold " : ""}${font.size}px ${font.family}`;
  }

  /** Every registered font id, for debugging/inspection tooling. */
  keys(): IterableIterator<string> {
    return this._fonts.keys();
  }

  /** Clears every registered font — mainly for test isolation between `Game` instances. */
  clear(): void {
    this._fonts.clear();
  }
}

# FontRegistry

`FontRegistry` is a `Game`-scoped registry mapping a font id string to a `FontDescriptor` (family/size/bold/italic). It's the real component for working with named fonts — a GMS2-imported font (`gms2-font-import.ts`'s `buildFontAsset`) registers into it once, and any `Label`/`ButtonState`/`Checkbox` widget references it by id instead of spelling out `font`/`fontSize` by hand every time.

Import: `import { FontRegistry, type FontDescriptor } from '@emptysock/engine';`

---

## Why a `Game` service, not a module-level singleton

Same reasoning as `PluginSystem`/`VariableStore`/`LocalisationSystem` (see `CLAUDE.md`'s "`PluginSystem`, `VariableStore`, ... are `Game` services" entry): a bare importable singleton would make two unrelated test files' `new Game()` instances silently share registered fonts via Node's module cache. `Game`'s constructor registers one real `FontRegistry` instance via `this.services.register(FontRegistry)`; scene code reads it as `ctx.fonts` (via `SceneLifecycle`) or `game.services.get(FontRegistry)` directly.

---

## `fonts.register(id: string, font: FontDescriptor): void`

Registers (or overwrites) a font under `id`.

```typescript
game.fonts.register("fnt_menu", {
  family: "Impact",
  size: 24,
  bold: true,
  italic: false,
});
```

## `fonts.get(id: string): FontDescriptor | undefined`

Reads back a registered descriptor, or `undefined` if `id` isn't registered.

## `fonts.has(id: string): boolean`

## `fonts.cssFontFor(id: string): string | undefined`

Precomposed `"[italic ][bold ]<size>px <family>"` CSS font string — the exact shape `Label`/`ButtonState`/`Checkbox` rendering already expects for `CanvasRenderingContext2D.font`. `undefined` for an unregistered id.

## `fonts.registerBitmap(id: string, def: BitmapFontDef): void`

Registers a pre-rendered bitmap font (atlas image plus glyph rects, advances and kerning) — what `@emptysock/toolchain`'s GMS2 importer emits as `<Name>FontBitmap` for a font resource that has a glyph atlas. Independent of `register()`; an id may have a CSS descriptor, a bitmap def, or both. GML `draw_set_font`/`draw_text` (via `RenderPipeline`, given `fonts: game.fonts`) draws with pixi `BitmapText` when a def exists and its atlas has loaded, falling back to Canvas text until then. `getBitmap(id)` and `hasBitmap(id)` read it back. `BitmapFontDef` is `{ name, atlasPath, size, lineHeight, glyphs: Record<codePoint, { x, y, w, h, shift, offset }>, kerning: [first, second, amount][] }`; `layoutBitmapText(def, text)` and `bitmapKerning(def, a, b)` are pixi-free helpers for the glyph maths.

## `fonts.keys(): IterableIterator<string>`

Every registered font id, for debugging/inspection tooling.

## `fonts.clear(): void`

Clears every registered font. Mainly for test isolation between `Game` instances.

---

## Using `fontId` on a widget

`Label`, `ButtonState`, and `Checkbox` (`components/Widgets.ts`) each carry a `fontId: string` field alongside their existing raw `font`/`fontSize` fields. `UISystem` resolves the font to actually draw with as: `fontId` (via the injected `FontRegistry`, if the id resolves) — else the widget's own raw `font`/`fontSize`. This is additive: an existing widget that never sets `fontId` (the default is `""`) renders exactly as before this component existed.

```typescript
import { UISystem, FontRegistry, Label } from "@emptysock/engine";

const fonts = new FontRegistry();
fonts.register("fnt_menu", {
  family: "Impact",
  size: 24,
  bold: true,
  italic: false,
});

const ui = new UISystem(widgetTree, { fonts });

entity.add(Label, { text: "Play", fontId: "fnt_menu" });
```

`UISystemOptions.fonts` is optional — omit it entirely and every widget always renders from its own raw `font`/`fontSize`, unchanged.

---

## GMS2 font import

`@emptysock/toolchain`'s GMS2 importer converts a font resource's metadata (family/size/bold/italic — never its glyph atlas PNG, since this engine's text rendering is plain Canvas/CSS, not a bitmap-font renderer) into a generated `assets/<name>.font.ts` module exporting a plain `{ name, family, size, bold, italic, cssFont }` object, ready to hand to `FontRegistry.register()`:

```typescript
import { FntMenuFont } from "./assets/fnt_menu.font.js";
game.fonts.register(FntMenuFont.name, FntMenuFont);
entity.add(Label, { fontId: FntMenuFont.name });
```

See `docs/manual/05-systems-reference.md` and the `GMS2 .yyp/.yy` quirks entry in the engine's `CLAUDE.md` for the full importer behaviour.

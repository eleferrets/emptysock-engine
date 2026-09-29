# 09 Fonts: Label uses BitmapFontDef; dynamic bitmap fonts for TTF (research, read-only)

Paths relative to `packages/`. Nothing was run (no node_modules).

## 1. Current state
- Registry: `engine/src/systems/FontRegistry.ts`; `register(id, FontDescriptor{family,size,bold,italic})`, `registerBitmap(id, BitmapFontDef)`, `getBitmap/hasBitmap`, `cssFontFor`. Docs: docs/reference/systems/font-registry.md. `Game` registers it as a service (`game.fonts`).
- `BitmapFontDef` + pixi-free `layoutBitmapText/bitmapKerning/toPixiBitmapFontData`: `engine/src/systems/BitmapFontDef.ts` (toPixi at :133-169; kerning inverted to pixi's `chars[second].kerning[first]`; `yOffset` always 0). Tests: `engine/src/__tests__/BitmapFont.test.ts`, `FontRegistry.test.ts`.
- GML `draw_text` path DOES use bitmap fonts: `RenderPipeline.ts` `PixiGmlDrawTarget.text` (~:253-275) picks `BitmapText` when `_resolveBitmapFont(id)` returns; `_resolveBitmapFont` (:707-740) waits for the atlas via `_textures`, then `new BitmapFont({data: toPixiBitmapFontData(def,family), textures:[atlas]})` and `Cache.set(\`${family}-bitmap\`, font)`, falling back to Canvas `Text` until loaded.
- Importer: `toolchain/src/gms2-font-import.ts` `FontAsset.bitmap?` (glyphs+kerning+atlas, :12-27, `readBitmapFont` :127-177), `copyFontAtlas` (:185), `buildFontAsset` (:211) emits `XFont` descriptor and, with an atlas, `XFontBitmap`. gms2-import.ts:668 warns when no atlas.

## 2. Gaps (confirmed by reading)
1. `Label` (engine/src/components/Widgets.ts:~45-66, fields text,color,font,fontSize,fontId,align) is drawn only via `UISystem._renderLabel` (engine/src/ui/UISystem.ts:353-372): `ctx.font = _resolveFont(...)` then `ctx.fillText`. `_resolveFont` (:69-74) uses `FontRegistry.cssFontFor` only; `getBitmap(fontId)` is never consulted anywhere in `ui/`. So a bitmap-only imported font (family often non-installed) draws in a fallback CSS face in widgets while `draw_text` uses the atlas: inconsistent.
2. `IUIRenderer` (types/src/index.ts:170) is a Canvas2D-shaped interface (fillText, font string, no glyph/image-region draw primitive beyond `drawImage(resource, x,y,w,h)` used for ImageWidget at UISystem.ts:~415). `UISystem.render` has no in-repo caller: the host owns the context. So bitmap Label must not assume pixi.
3. Buttons and Checkbox labels have the same gap (UISystem.ts:276, :305).
4. Layout does not measure text: `WidgetTree`/yoga sizes come from LayoutStyle, so alignment uses box edges only; no width for bitmap text is needed except right/center alignment (use `layoutBitmapText(def,text).width`, already pixi-free).
5. No TTF path: fonts without atlas (plain TTF/OTF, or GMS2 fonts whose atlas is missing, or web fonts) have no bitmap representation; no `FontFace` loading either (AssetManifest type "font" loads a FontFace but nothing binds it to FontRegistry).
6. Multi-page/`yOffset`: GMS2 glyph rect spans the line box (per BitmapFontDef doc), OK; `baseLineOffset:0`. Fine, but unverified against pixi metrics for `textBaseline: "middle"` alignment in Label (Canvas uses middle; bitmap needs explicit y math).
7. Localisation/wide chars: glyph lookup skips code points with no glyph silently (layoutBitmapText doc); a Label with missing glyphs shows gaps, no fallback to Canvas.

## 3. Design
### 3.1 Label uses BitmapFontDef (no pixi in UISystem)
Add an optional, pixi-free primitive to `IUIRenderer`:
```ts
drawImageRegion?(image: object, sx,sy,sw,sh, dx,dy,dw,dh): void; // Canvas2D drawImage 9-arg form
```
CanvasRenderingContext2D already satisfies it (overload), keeping "existing callers need no changes". `UISystem._renderLabel`:
- `def = fonts?.getBitmap(label.fontId)`; if def defined AND atlas texture resolvable (reuse `_textures`/`_imageState` machinery used by `_renderImage` at :~385-420, keyed by `def.atlasPath`) AND `ctx.drawImageRegion` exists: `layoutBitmapText(def,text)`; origin x by align using `layout.width`, y = box centre minus `layout.height/2`; for each placement `drawImageRegion(atlas, g.x,g.y,g.w,g.h, ox+p.x, oy+p.y, g.w, g.h)`. Tint (label.color) is not free with region blits; v1 draws the atlas unmodified (GMS2 atlases are white-on-transparent so tint would matter). Options: (a) document limitation and require host to tint, (b) prerender tinted copy per (font,color) into an offscreen cache keyed in UISystem, needs a canvas factory injected (`createCanvas` option), (c) let host implement a pixi-backed IUIRenderer. Recommend (a)+(b later), and treat (c) as the pixi-host path where BitmapText handles tint natively.
- Else fall back to current CSS path (unchanged), so nothing regresses.
- Same for ButtonState/Checkbox label text via a shared `_drawText(ctx, box, text, fontId, font, fontSize, color, align)` helper (single owner of the resolution rule).
Precedence rule (document): `fontId` with bitmap def and loaded atlas > `fontId` CSS descriptor > raw font/fontSize. Add `Label.fontMode?: "auto"|"css"|"bitmap"`? Not needed initially; avoid schema growth.

### 3.2 Dynamic bitmap fonts for TTF (pixi host path)
Goal: any registered CSS `FontDescriptor` (TTF loaded via FontFace) drawable as `BitmapText` for cheap, crisp, tintable text, plus GML `draw_text` parity when no atlas exists.
pixi v8 API (verified on the web docs, Context7 pixijs v8.16.0, pixijs scene-text-overview): `BitmapFont.install({ name, style: { fontFamily, fontSize, fill } })` generates a font atlas at runtime from a system/web font; text is then `new BitmapText({ text, style: { fontFamily: name, fontSize } })`; `Assets.load('x.fnt')` returns a BitmapFont for prebuilt. From my knowledge of v8 source and NOT re-confirmed by the fetched docs: install options also accept `chars` (default printable ASCII; pass extra ranges e.g. `[['a','z'],['A','Z'],'0-9', custom string]`), `resolution`, `padding`, `skipKerning`, `textureStyle`; `BitmapFont.uninstall(name)` frees; and BitmapText with an uninstalled family auto-creates a DynamicBitmapFont whose atlas grows per glyph on demand (per-style, so a new fontSize/fill spawns another dynamic font). Verify against installed pixi (^8.21.0 per pnpm-workspace.yaml) types before coding: `node_modules/pixi.js/lib/scene/text-bitmap/BitmapFont*.d.ts`.
Plan: `PixiGmlDrawTarget._resolveBitmapFont` (RenderPipeline.ts:707) gains a second branch: no `getBitmap(id)` but `fonts.get(id)` exists AND `FontFace` for `family` is loaded (`document.fonts.check(cssFont)`) -> `BitmapFont.install({name: "emptysock-dyn:"+id, style:{fontFamily: desc.family, fontSize: desc.size, fontWeight: desc.bold?"bold":"normal", fontStyle: desc.italic?"italic":"normal", fill:"#ffffff"}, chars: extendedRange, resolution: dpr})`, cache in `_bitmapFonts`, `uninstall` on re-register/clear. Keep white fill and tint via BitmapText `fill` like the atlas path. Gate behind `RenderPipelineOptions.dynamicBitmapFonts` (default false) so headless/Node hosts (no canvas/FontFace) are unaffected; failure falls back to Canvas `Text`.
A font-loading step: `FontRegistry.loadFace(id, url)` (engine, DOM-guarded) or use AssetManifest "font" then `registerFace`. Must await before install, or the atlas bakes the fallback face (classic bug). Order: FontFace.load -> document.fonts.add -> install.
CJK/large charsets: do NOT pre-bake; rely on dynamic atlas growth or fall back to Canvas Text.

### 3.3 Where the Label gets it from
Because UISystem is renderer-agnostic, dynamic TTF bitmap applies only when the host's IUIRenderer is pixi-backed; with Canvas hosts Label keeps native `fillText`, which already renders TTF correctly (the TTF case is not broken for Labels, only bitmap-only imported fonts are). So item priority: 3.1 first (fixes real inconsistency), 3.2 second (perf/tint/parity, mostly draw_text).

## 4. Tests
- `UISystem.test.ts`: (a) bitmap def registered + fake atlas texture + spy renderer with `drawImageRegion`: assert call count = glyphs, x positions equal `layoutBitmapText` placements, center/right align shifts by width; (b) no `drawImageRegion` -> falls back to `fillText` with CSS font; (c) atlas not loaded -> fallback, then bitmap after load resolves; (d) fontId absent -> unchanged (existing tests stay green); (e) Button/Checkbox share resolution.
- `BitmapFont.test.ts`: extend for any new pure helper (text width by align).
- RenderPipeline dynamic branch: only testable with mocked `BitmapFont.install` (vi.mock pixi.js as existing RenderPipeline tests do; check their pattern); assert install name/style and uninstall on clear; assert default-off does nothing. Real rendering check belongs to gpu-verify (`engine/scripts/gpu-verify.harness.ts` already mentions BitmapFontDef) in a real browser.
- Toolchain: none for 3.1; for 3.2 none.

## 5. Sweep steps / ownership
1. types: `IUIRenderer.drawImageRegion?` (types/src/index.ts). Owner A.
2. engine ui: `UISystem.ts` `_drawText` helper + bitmap branch + atlas cache reuse; `FontRegistry` untouched. Owner B (depends 1).
3. engine tests: UISystem.test.ts. Owner B.
4. engine render: `RenderPipeline.ts` dynamic branch + option; `FontRegistry.loadFace` (new small DOM-guarded method) ; tests. Owner C (independent of 2; RenderPipeline is a shared hot file with the shader/Mesh item 4 and rain item 5, sequence with those).
5. docs last (docs frozen for now).

## 6. Risks
- Tinting with Canvas region blits (see 3.1); shipping without tint makes coloured Labels wrong. Decide before merge; a safe alternative is to only take the bitmap path when `label.color` is the default white.
- FontFace not yet loaded at install time bakes wrong glyphs; needs explicit ordering and a re-bake on `document.fonts.onloadingdone`.
- Dynamic atlas memory: per (font,size,fill) fonts multiply; cap and reuse a single white-fill font, scale with BitmapText fontSize (blurs when scaled up, so bake at max size x dpr).
- Blurry text: resolution/DPR mismatch; Canvas text is currently crisp.
- pixi API drift: `BitmapFont` constructor `{data,textures}` used today (RenderPipeline:~727) and `install` are v8; the `chars` and auto-dynamic behaviour claims above are from memory, verify on 8.21.
- Right-to-left/complex scripts: bitmap layout is glyph-by-codepoint, no shaping. Keep Canvas path for those (fontId without bitmap def).
- Two sources of truth for one id (descriptor and bitmap def) can disagree on size; the def wins for bitmap draws, document.

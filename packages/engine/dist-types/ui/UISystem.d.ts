import type { Texture } from "pixi.js";
import type { IUIRenderer } from "@emptysock/types";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import type { WidgetTree } from "./WidgetTree.js";
import type { FontRegistry } from "../systems/FontRegistry.js";
/** Resolves an `ImageWidget.src` path to a real pixi `Texture` — same shape as `RenderPipeline.ts`'s `TextureLoader`, defaulting to the same `Assets.load` pixi wraps. Overridable for tests/hosts that want a fake loader. */
export type ImageLoader = (path: string) => Promise<Texture>;
export interface UISystemOptions {
  /** Overrides how `ImageWidget.src` paths resolve to pixi textures — defaults to `Assets.load`. */
  imageLoader?: ImageLoader;
  /** Optional `FontRegistry` (see `systems/FontRegistry.ts`) — when given, a widget's `fontId` (if set and resolvable) overrides its own raw `font`/`fontSize` fields. Omitted entirely means every widget always renders from its own `font`/`fontSize`, unchanged from before `fontId` existed. */
  fonts?: FontRegistry;
}
/**
 * `UISystem` (RELEASE_PASS.md Track 3), built on `WidgetTree`'s
 * entity-per-widget layout foundation (ground rule 4a) and the widget-kind
 * components in `components/Widgets.ts`. Covers hit-testing,
 * press/drag/click/hover dispatch, and rendering against a `Scene`'s live
 * widget tree. Deliberately does not implement per-widget animation, anchor
 * resolution, or image bitmap loading/caching (see `Widgets.ts`'s class doc
 * comment) — those are real, separately tracked follow-ups, not silently
 * dropped.
 */
export declare class UISystem {
  private readonly _tree;
  private readonly _presses;
  private readonly _textures;
  private readonly _fonts;
  /** Loaded/loading/failed textures keyed by `ImageWidget.src`, shared across every widget instance that references the same path — the same "cache by source path, load once" shape `RenderPipeline`'s `_textureCache` uses. */
  /** Paths whose load is in flight or failed, so a frame never re-requests them. Loaded textures live only in `_textures`/pixi `Assets`. */
  private readonly _imageState;
  constructor(_tree: WidgetTree, options?: UISystemOptions);
  /** Resolves a widget's font: `fontId` (via the injected `FontRegistry`) when set and resolvable, else the widget's own raw `font`/`fontSize` fields. */
  private _resolveFont;
  /**
   * The drawable behind an already-loaded texture at `src`, kicking off a
   * (deduplicated) load when it is not loaded yet. `undefined` while loading,
   * after a failed load, or when the texture has no drawable resource.
   */
  private _resourceFor;
  /**
   * Draws `text` for a widget. Precedence: `fontId` with a registered
   * `BitmapFontDef` and a loaded atlas > `fontId` CSS descriptor > raw
   * `font`/`fontSize`. The bitmap path needs the renderer's optional
   * `drawImageRegion`, and only runs for the default white text colour:
   * region blits cannot tint, and GMS2 atlases are white-on-transparent, so
   * a coloured widget keeps the (correctly coloured) CSS path instead of
   * drawing the wrong colour. Whenever the bitmap path is unavailable
   * (no def, no `drawImageRegion`, atlas still loading/failed, tinted) it
   * falls back to `fillText` exactly as before. On the bitmap path the def's
   * own metrics win over any CSS descriptor registered for the same id.
   *
   * `align`: 0 left / 1 center / 2 right relative to `anchorX`; text is
   * vertically centred on `centerY`. Multi-line text aligns as one block.
   */
  private _drawText;
  private _drawBitmapText;
  private _isVisible;
  private _contains;
  /**
   * Topmost widget under `(x, y)`, or `undefined`. `WidgetTree.orderedWidgets()`
   * returns root-first order; walking it in reverse visits the most
   * recently added leaf-most widgets first, giving "children win over their
   * own parent, later siblings win over earlier ones" without needing a
   * second recursive per-level pass.
   */
  hitTest(scene: Scene, x: number, y: number): Entity | undefined;
  /** Begin a press on the topmost widget under `(x, y)`. Does not fire a click — see `dispatchPointerUp`. `pointerId` distinguishes simultaneous multi-touch presses (default 0 for a single mouse pointer). */
  dispatchPointerDown(
    scene: Scene,
    x: number,
    y: number,
    pointerId?: number,
  ): Entity | undefined;
  /** Update an in-flight press's position. Past `CLICK_DRAG_THRESHOLD` from its start point, the press is a drag and will not fire a click on release. A slider being dragged updates its value live. */
  dispatchPointerDrag(
    scene: Scene,
    x: number,
    y: number,
    pointerId?: number,
  ): void;
  /** Complete a press started with `dispatchPointerDown`. Fires the widget's click behaviour (toggling a `Checkbox`, applying a `Slider`'s final value) only if the press was not a drag and release still lands on the same widget's box. Returns whether a click fired. */
  dispatchPointerUp(
    scene: Scene,
    x: number,
    y: number,
    pointerId?: number,
  ): boolean;
  /** Abort an in-flight press without triggering a click (e.g. `pointercancel`). */
  cancelPointer(pointerId?: number): void;
  /** Update hover state (`ButtonState.state`) for every non-disabled button widget given the current pointer position. Call once per frame from a pointer-move handler. */
  updateHover(scene: Scene, x: number, y: number): void;
  private _applySliderPointer;
  private _triggerClick;
  /** Draws every visible widget in `scene` to `ctx`, root-first (so a parent's background paints before its children). */
  render(scene: Scene, ctx: IUIRenderer): void;
  private _renderPanel;
  private _renderButton;
  private _renderCheckbox;
  private _renderSlider;
  private _renderProgress;
  private _renderLabel;
  /**
   * Draws `src` (an `ImageWidget.src` path) via this system's `ImageLoader`
   * (`Assets.load` by default, the same pixi loader `RenderPipeline` uses),
   * cached by path in `_imageCache` so the same image is loaded once and
   * reused by every widget instance that references it, never reloaded per
   * frame or per instance. The grey placeholder box remains the fallback
   * for both real "nothing to draw yet" states — no source set, or a load
   * still in flight — and the error state, a failed load; it is not drawn
   * once a source has actually resolved to a loaded texture.
   */
  private _renderImage;
  /** Fallback for an `ImageWidget` with no source set yet, a source still loading, or a source that failed to load — a grey placeholder box. */
  private _renderImagePlaceholder;
}

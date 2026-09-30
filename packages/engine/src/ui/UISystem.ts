import { TextureStore } from "../systems/TextureStore.js";
import type { Texture } from "pixi.js";
import type { IUIRenderer } from "@emptysock/types";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import { Layout, LayoutStyle } from "../components/Layout.js";
import {
  ButtonState,
  Checkbox,
  ImageWidget,
  Label,
  PanelStyle,
  Progress,
  Slider,
  WidgetAppearance,
} from "../components/Widgets.js";
import type { WidgetTree } from "./WidgetTree.js";
import { widgetRoundRect } from "./canvasHelpers.js";
import type { FontRegistry } from "../systems/FontRegistry.js";
import { layoutBitmapText } from "../systems/BitmapFontDef.js";

/** True for the untinted default text colours (`#fff`/`#ffffff`/`white`, any case). */
function isUntintedWhite(color: string): boolean {
  const c = color.trim().toLowerCase();
  return c === "#fff" || c === "#ffffff" || c === "white";
}

/** A press that moves further than this before release is a drag, not a click. */
const CLICK_DRAG_THRESHOLD = 6;

interface PressState {
  entity: Entity;
  startX: number;
  startY: number;
  dragging: boolean;
}

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
export class UISystem {
  private readonly _presses = new Map<number, PressState>();
  private readonly _textures: TextureStore;
  private readonly _fonts: FontRegistry | undefined;

  /** Loaded/loading/failed textures keyed by `ImageWidget.src`, shared across every widget instance that references the same path — the same "cache by source path, load once" shape `RenderPipeline`'s `_textureCache` uses. */
  /** Paths whose load is in flight or failed, so a frame never re-requests them. Loaded textures live only in `_textures`/pixi `Assets`. */
  private readonly _imageState = new Map<string, "loading" | "error">();

  constructor(
    private readonly _tree: WidgetTree,
    options: UISystemOptions = {},
  ) {
    this._textures = new TextureStore(options.imageLoader);
    this._fonts = options.fonts;
  }

  /** Resolves a widget's font: `fontId` (via the injected `FontRegistry`) when set and resolvable, else the widget's own raw `font`/`fontSize` fields. */
  private _resolveFont(fontId: string, font: string, fontSize: number): string {
    if (fontId.length > 0 && this._fonts !== undefined) {
      const css = this._fonts.cssFontFor(fontId);
      if (css !== undefined) return css;
    }
    return `${fontSize}px ${font}`;
  }

  /**
   * The drawable behind an already-loaded texture at `src`, kicking off a
   * (deduplicated) load when it is not loaded yet. `undefined` while loading,
   * after a failed load, or when the texture has no drawable resource.
   */
  private _resourceFor(src: string): object | undefined {
    const texture = this._textures.get(src);
    if (texture === undefined) {
      if (!this._imageState.has(src)) {
        this._imageState.set(src, "loading");
        this._textures
          .load(src)
          .then(() => {
            this._imageState.delete(src);
          })
          .catch((err: unknown) => {
            this._imageState.set(src, "error");
            console.error(`[UISystem] failed to load image "${src}":`, err);
          });
      }
      return undefined;
    }
    // `texture.source.resource` is the underlying drawable (an
    // `ImageBitmap`/`HTMLImageElement`/canvas, depending on host and asset
    // type) pixi's loader resolved — exactly the `object` shape
    // `IUIRenderer.drawImage()` accepts, without this file importing any
    // DOM image type itself.
    const resource: unknown = texture.source.resource;
    if (resource === null || resource === undefined) return undefined;
    return resource as object;
  }

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
  private _drawText(
    ctx: IUIRenderer,
    text: string,
    fontId: string,
    font: string,
    fontSize: number,
    color: string,
    align: number,
    anchorX: number,
    centerY: number,
  ): void {
    ctx.fillStyle = color;
    if (this._drawBitmapText(ctx, text, fontId, color, align, anchorX, centerY))
      return;
    ctx.font = this._resolveFont(fontId, font, fontSize);
    ctx.textBaseline = "middle";
    ctx.textAlign = align === 1 ? "center" : align === 2 ? "right" : "left";
    ctx.fillText(text, anchorX, centerY);
  }

  private _drawBitmapText(
    ctx: IUIRenderer,
    text: string,
    fontId: string,
    color: string,
    align: number,
    anchorX: number,
    centerY: number,
  ): boolean {
    if (ctx.drawImageRegion === undefined) return false;
    if (fontId.length === 0 || this._fonts === undefined) return false;
    const def = this._fonts.getBitmap(fontId);
    if (def === undefined || !isUntintedWhite(color)) return false;
    const atlas = this._resourceFor(def.atlasPath);
    if (atlas === undefined) return false;
    const layout = layoutBitmapText(def, text);
    const ox =
      align === 1
        ? anchorX - layout.width / 2
        : align === 2
          ? anchorX - layout.width
          : anchorX;
    const oy = centerY - layout.height / 2;
    for (const p of layout.placements) {
      const g = p.glyph;
      ctx.drawImageRegion(
        atlas,
        g.x,
        g.y,
        g.w,
        g.h,
        ox + p.x,
        oy + p.y,
        g.w,
        g.h,
      );
    }
    return true;
  }

  private _isVisible(entity: Entity): boolean {
    const appearance = entity.get(WidgetAppearance);
    return appearance === undefined || appearance.visible;
  }

  /**
   * Intersection of the boxes of every ancestor with `overflow` hidden or
   * scroll, or `undefined` when no ancestor clips.
   */
  private _clipRect(
    scene: Scene,
    entity: Entity,
  ): { x: number; y: number; width: number; height: number } | undefined {
    let rect:
      { x: number; y: number; width: number; height: number } | undefined;
    let cur = this._tree.parentOf(scene, entity);
    while (cur !== undefined) {
      const style = cur.get(LayoutStyle);
      const box = cur.get(Layout);
      if (style !== undefined && style.overflow > 0 && box !== undefined) {
        if (rect === undefined) {
          rect = { x: box.x, y: box.y, width: box.width, height: box.height };
        } else {
          const x = Math.max(rect.x, box.x);
          const y = Math.max(rect.y, box.y);
          const r = Math.min(rect.x + rect.width, box.x + box.width);
          const b = Math.min(rect.y + rect.height, box.y + box.height);
          rect = {
            x,
            y,
            width: Math.max(0, r - x),
            height: Math.max(0, b - y),
          };
        }
      }
      cur = this._tree.parentOf(scene, cur);
    }
    return rect;
  }

  private _contains(entity: Entity, x: number, y: number): boolean {
    const box = entity.get(Layout);
    if (box === undefined) return false;
    return (
      x >= box.x &&
      x <= box.x + box.width &&
      y >= box.y &&
      y <= box.y + box.height
    );
  }

  /**
   * Topmost widget under `(x, y)`, or `undefined`. `WidgetTree.orderedWidgets()`
   * returns root-first order; walking it in reverse visits the most
   * recently added leaf-most widgets first, giving "children win over their
   * own parent, later siblings win over earlier ones" without needing a
   * second recursive per-level pass.
   */
  hitTest(scene: Scene, x: number, y: number): Entity | undefined {
    const order = this._tree.orderedWidgets(scene);
    for (let i = order.length - 1; i >= 0; i--) {
      const entity = order[i];
      if (entity === undefined) continue;
      if (!this._isVisible(entity)) continue;
      if (!this._contains(entity, x, y)) continue;
      const clip = this._clipRect(scene, entity);
      if (
        clip !== undefined &&
        (x < clip.x ||
          x > clip.x + clip.width ||
          y < clip.y ||
          y > clip.y + clip.height)
      )
        continue;
      return entity;
    }
    return undefined;
  }

  /** Begin a press on the topmost widget under `(x, y)`. Does not fire a click — see `dispatchPointerUp`. `pointerId` distinguishes simultaneous multi-touch presses (default 0 for a single mouse pointer). */
  dispatchPointerDown(
    scene: Scene,
    x: number,
    y: number,
    pointerId = 0,
  ): Entity | undefined {
    const hit = this.hitTest(scene, x, y);
    if (hit === undefined) return undefined;
    this._presses.set(pointerId, {
      entity: hit,
      startX: x,
      startY: y,
      dragging: false,
    });
    const button = hit.get(ButtonState);
    if (button !== undefined && !button.disabled) button.state = 2;
    this._applySliderPointer(hit, x);
    return hit;
  }

  /** Update an in-flight press's position. Past `CLICK_DRAG_THRESHOLD` from its start point, the press is a drag and will not fire a click on release. A slider being dragged updates its value live. */
  dispatchPointerDrag(scene: Scene, x: number, y: number, pointerId = 0): void {
    const press = this._presses.get(pointerId);
    if (press === undefined) return;
    const dist = Math.hypot(x - press.startX, y - press.startY);
    if (dist > CLICK_DRAG_THRESHOLD) press.dragging = true;
    this._applySliderPointer(press.entity, x);
  }

  /** Complete a press started with `dispatchPointerDown`. Fires the widget's click behaviour (toggling a `Checkbox`, applying a `Slider`'s final value) only if the press was not a drag and release still lands on the same widget's box. Returns whether a click fired. */
  dispatchPointerUp(
    scene: Scene,
    x: number,
    y: number,
    pointerId = 0,
  ): boolean {
    const press = this._presses.get(pointerId);
    this._presses.delete(pointerId);
    if (press === undefined) return false;
    const button = press.entity.get(ButtonState);
    if (button !== undefined) button.state = 0;
    if (press.dragging) return false;
    if (!this._contains(press.entity, x, y)) return false;
    this._triggerClick(press.entity);
    return true;
  }

  /** Abort an in-flight press without triggering a click (e.g. `pointercancel`). */
  cancelPointer(pointerId = 0): void {
    const press = this._presses.get(pointerId);
    if (press !== undefined) {
      const button = press.entity.get(ButtonState);
      if (button !== undefined) button.state = 0;
    }
    this._presses.delete(pointerId);
  }

  /** Update hover state (`ButtonState.state`) for every non-disabled button widget given the current pointer position. Call once per frame from a pointer-move handler. */
  updateHover(scene: Scene, x: number, y: number): void {
    for (const entity of this._tree.orderedWidgets(scene)) {
      const button = entity.get(ButtonState);
      if (button === undefined || button.disabled) continue;
      if (this._presses.size > 0) continue; // a button mid-press keeps its pressed state, not hover
      const hovered = this._isVisible(entity) && this._contains(entity, x, y);
      button.state = hovered ? 1 : 0;
    }
  }

  private _applySliderPointer(entity: Entity, x: number): void {
    const slider = entity.get(Slider);
    const box = entity.get(Layout);
    if (slider === undefined || box === undefined || box.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (x - box.x) / box.width));
    let value = slider.min + ratio * (slider.max - slider.min);
    if (slider.step > 0) value = Math.round(value / slider.step) * slider.step;
    slider.value = Math.min(slider.max, Math.max(slider.min, value));
  }

  private _triggerClick(entity: Entity): void {
    const checkbox = entity.get(Checkbox);
    if (checkbox !== undefined) checkbox.checked = !checkbox.checked;
  }

  /** Draws every visible widget in `scene` to `ctx`, root-first (so a parent's background paints before its children). */
  render(scene: Scene, ctx: IUIRenderer): void {
    for (const entity of this._tree.orderedWidgets(scene)) {
      if (!this._isVisible(entity)) continue;
      const box = entity.get(Layout);
      if (box === undefined) continue;
      const appearance = entity.get(WidgetAppearance);
      ctx.save();
      const clip = this._clipRect(scene, entity);
      if (clip !== undefined) {
        ctx.beginPath();
        ctx.rect(clip.x, clip.y, clip.width, clip.height);
        ctx.clip();
      }
      ctx.globalAlpha = appearance?.alpha ?? 1;

      const panel = entity.get(PanelStyle);
      if (panel !== undefined) this._renderPanel(ctx, box, panel);

      const button = entity.get(ButtonState);
      if (button !== undefined) this._renderButton(ctx, box, button);

      const checkbox = entity.get(Checkbox);
      if (checkbox !== undefined) this._renderCheckbox(ctx, box, checkbox);

      const slider = entity.get(Slider);
      if (slider !== undefined) this._renderSlider(ctx, box, slider);

      const progress = entity.get(Progress);
      if (progress !== undefined) this._renderProgress(ctx, box, progress);

      const label = entity.get(Label);
      if (label !== undefined) this._renderLabel(ctx, box, label);

      const image = entity.get(ImageWidget);
      if (image !== undefined) this._renderImage(ctx, box, image.src);

      ctx.restore();
    }
  }

  private _renderPanel(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
    panel: ReturnType<typeof PanelStyle.createDefaults>,
  ): void {
    ctx.fillStyle = panel.background;
    ctx.beginPath();
    widgetRoundRect(
      ctx,
      box.x,
      box.y,
      box.width,
      box.height,
      panel.borderRadius,
    );
    ctx.fill();
    if (panel.borderWidth > 0) {
      ctx.strokeStyle = panel.borderColor;
      ctx.lineWidth = panel.borderWidth;
      ctx.stroke();
    }
  }

  private _renderButton(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
    button: ReturnType<typeof ButtonState.createDefaults>,
  ): void {
    const bg =
      button.state === 1
        ? button.hoverBackground
        : button.state === 2
          ? button.pressedBackground
          : button.background;
    ctx.fillStyle = bg;
    ctx.beginPath();
    widgetRoundRect(
      ctx,
      box.x,
      box.y,
      box.width,
      box.height,
      button.borderRadius,
    );
    ctx.fill();
    this._drawText(
      ctx,
      button.label,
      button.fontId,
      button.font,
      button.fontSize,
      button.color,
      1,
      box.x + box.width / 2,
      box.y + box.height / 2,
    );
  }

  private _renderCheckbox(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
    checkbox: ReturnType<typeof Checkbox.createDefaults>,
  ): void {
    const boxSize = box.height;
    ctx.fillStyle = checkbox.background;
    ctx.fillRect(box.x, box.y, boxSize, boxSize);
    ctx.strokeStyle = checkbox.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x + 1, box.y + 1, boxSize - 2, boxSize - 2);
    if (checkbox.checked) {
      const p = boxSize * 0.2;
      ctx.strokeStyle = checkbox.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(box.x + p, box.y + boxSize / 2);
      ctx.lineTo(box.x + boxSize * 0.45, box.y + boxSize - p);
      ctx.lineTo(box.x + boxSize - p, box.y + p);
      ctx.stroke();
    }
    if (checkbox.label.length > 0) {
      this._drawText(
        ctx,
        checkbox.label,
        checkbox.fontId,
        checkbox.font,
        checkbox.fontSize,
        checkbox.color,
        0,
        box.x + boxSize + 8,
        box.y + box.height / 2,
      );
    }
  }

  private _renderSlider(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
    slider: ReturnType<typeof Slider.createDefaults>,
  ): void {
    ctx.fillStyle = slider.trackColor;
    ctx.fillRect(box.x, box.y + box.height / 2 - 2, box.width, 4);
    const ratio =
      slider.max > slider.min
        ? (slider.value - slider.min) / (slider.max - slider.min)
        : 0;
    const thumbX = box.x + ratio * box.width;
    ctx.fillStyle = slider.thumbColor;
    ctx.beginPath();
    ctx.arc(thumbX, box.y + box.height / 2, box.height / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private _renderProgress(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
    progress: ReturnType<typeof Progress.createDefaults>,
  ): void {
    ctx.fillStyle = progress.trackColor;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    const ratio =
      progress.max > progress.min
        ? Math.min(
            1,
            Math.max(
              0,
              (progress.value - progress.min) / (progress.max - progress.min),
            ),
          )
        : 0;
    ctx.fillStyle = progress.fillColor;
    ctx.fillRect(box.x, box.y, box.width * ratio, box.height);
  }

  private _renderLabel(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
    label: ReturnType<typeof Label.createDefaults>,
  ): void {
    const tx =
      label.align === 1
        ? box.x + box.width / 2
        : label.align === 2
          ? box.x + box.width
          : box.x;
    this._drawText(
      ctx,
      label.text,
      label.fontId,
      label.font,
      label.fontSize,
      label.color,
      label.align,
      tx,
      box.y + box.height / 2,
    );
  }

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
  private _renderImage(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
    src: string,
  ): void {
    if (src === "") {
      this._renderImagePlaceholder(ctx, box);
      return;
    }
    const resource = this._resourceFor(src);
    if (resource === undefined) {
      this._renderImagePlaceholder(ctx, box);
      return;
    }
    ctx.drawImage(resource, box.x, box.y, box.width, box.height);
  }

  /** Fallback for an `ImageWidget` with no source set yet, a source still loading, or a source that failed to load — a grey placeholder box. */
  private _renderImagePlaceholder(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
  ): void {
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
}

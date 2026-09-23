import type { IUIRenderer } from "@emptysock/types";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import { Layout } from "../components/Layout.js";
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
import { widgetRoundRect } from "../../ui/widgets/base.js";

/** Same threshold as the classic `systems/UISystem.ts` — a press that moves further than this before release is a drag, not a click. */
const CLICK_DRAG_THRESHOLD = 6;

interface PressState {
  entity: Entity;
  startX: number;
  startY: number;
  dragging: boolean;
}

/**
 * ECS-native `UISystem` (RELEASE_PASS.md Track 3), built on `WidgetTree`'s
 * entity-per-widget layout foundation (ground rule 4a) and the widget-kind
 * components in `components/Widgets.ts`. Covers the classic
 * `systems/UISystem.ts`'s real, load-bearing contract — hit-testing,
 * press/drag/click/hover dispatch, and rendering — against a `Scene`'s live
 * widget tree instead of a `Widget[]` array. Deliberately does not port
 * per-widget animation, anchor resolution, or image bitmap loading/caching
 * (see `Widgets.ts`'s class doc comment) — those are real, separately
 * tracked follow-ups, not silently dropped.
 */
export class UISystem {
  private readonly _presses = new Map<number, PressState>();

  constructor(private readonly _tree: WidgetTree) {}

  private _isVisible(entity: Entity): boolean {
    const appearance = entity.get(WidgetAppearance);
    return appearance === undefined || appearance.visible;
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
   * recently added leaf-most widgets first, mirroring the classic
   * `_findHit()`'s "children win over their own parent, later siblings win
   * over earlier ones" behaviour without needing a second recursive
   * per-level pass.
   */
  hitTest(scene: Scene, x: number, y: number): Entity | undefined {
    const order = this._tree.orderedWidgets(scene);
    for (let i = order.length - 1; i >= 0; i--) {
      const entity = order[i];
      if (entity === undefined) continue;
      if (!this._isVisible(entity)) continue;
      if (this._contains(entity, x, y)) return entity;
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
      if (image !== undefined) this._renderImagePlaceholder(ctx, box);

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
    ctx.fillStyle = button.color;
    ctx.font = `${button.fontSize}px ${button.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(button.label, box.x + box.width / 2, box.y + box.height / 2);
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
      ctx.fillStyle = checkbox.color;
      ctx.font = `${checkbox.fontSize}px ${checkbox.font}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(checkbox.label, box.x + boxSize + 8, box.y + box.height / 2);
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
    ctx.fillStyle = label.color;
    ctx.font = `${label.fontSize}px ${label.font}`;
    ctx.textBaseline = "middle";
    const tx =
      label.align === 1
        ? box.x + box.width / 2
        : label.align === 2
          ? box.x + box.width
          : box.x;
    ctx.textAlign =
      label.align === 1 ? "center" : label.align === 2 ? "right" : "left";
    ctx.fillText(label.text, tx, box.y + box.height / 2);
  }

  /** Image loading/caching (`ImageLoader`) isn't ported yet — draws a grey placeholder box, the same visual fallback the classic `ImageWidget` uses before its source resolves. */
  private _renderImagePlaceholder(
    ctx: IUIRenderer,
    box: { x: number; y: number; width: number; height: number },
  ): void {
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
}

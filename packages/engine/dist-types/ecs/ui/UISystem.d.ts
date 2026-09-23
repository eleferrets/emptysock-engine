import type { IUIRenderer } from "@emptysock/types";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import type { WidgetTree } from "./WidgetTree.js";
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
export declare class UISystem {
  private readonly _tree;
  private readonly _presses;
  constructor(_tree: WidgetTree);
  private _isVisible;
  private _contains;
  /**
   * Topmost widget under `(x, y)`, or `undefined`. `WidgetTree.orderedWidgets()`
   * returns root-first order; walking it in reverse visits the most
   * recently added leaf-most widgets first, mirroring the classic
   * `_findHit()`'s "children win over their own parent, later siblings win
   * over earlier ones" behaviour without needing a second recursive
   * per-level pass.
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
  /** Image loading/caching (`ImageLoader`) isn't ported yet — draws a grey placeholder box, the same visual fallback the classic `ImageWidget` uses before its source resolves. */
  private _renderImagePlaceholder;
}

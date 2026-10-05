/**
 * Nine-point anchor resolution for a widget's designer-authored `x`/`y`
 * offset against a known viewport/canvas size — the one piece of the UI
 * Placement Editor's original design surface `ecs/components/Widgets.ts`'s
 * doc comment names as a real, tracked gap ("no anchor resolution"). This
 * closes it: a pure function, not a component or a system, since anchor
 * math needs nothing beyond the four numbers below — a widget entity's
 * `LayoutStyle.left`/`.top` (the release notes `positionType: 1` "opts a
 * widget out of the parent's flex flow, positioned by left/top alone")
 * should be set to this function's resolved output at spawn time, not to
 * the raw designer `x`/`y`.
 */
export type WidgetAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";
export interface AnchoredPosition {
  left: number;
  top: number;
}
/**
 * Resolves a designer-authored `(x, y)` offset from `anchor` against a
 * `containerWidth`x`containerHeight` box into an absolute top-left
 * `(left, top)` pair — e.g. `anchor: "bottom-right"` places the widget's
 * bottom-right corner `x` pixels left of and `y` pixels above the
 * container's own bottom-right corner.
 */
export declare function resolveAnchoredPosition(
  anchor: WidgetAnchor,
  x: number,
  y: number,
  width: number,
  height: number,
  containerWidth: number,
  containerHeight: number,
): AnchoredPosition;

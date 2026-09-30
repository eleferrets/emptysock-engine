import { defineComponent } from "../Component.js";

/**
 * Layout style *inputs* for one widget entity (RELEASE_PASS.md Track 3 /
 * ground rule 4a). Mirrors the subset of `yoga-layout`'s `Node` setters
 * `WidgetTree`'s layout pass actually drives — a small, deliberately
 * incomplete slice (enough for a scrollable list: a column or row of
 * fixed/auto-sized children with gap/padding/grow), not a full flexbox
 * surface. Extend as real widgets need more of Yoga's API, not
 * speculatively.
 *
 * `width`/`height` of `-1` means "auto" (Yoga's `setWidthAuto()`/
 * `setHeightAuto()`) rather than a fixed pixel size — a sentinel instead of
 * a second boolean pair per axis, since every other field here is already a
 * plain number and `Serializable` allows it.
 */
export const LayoutStyle = defineComponent(
  "LayoutStyle",
  () => ({
    /**
     * 0 = column, 1 = row — this component's own ordinals, deliberately
     * *not* yoga-layout's `FlexDirection` enum values (`Column = 0`,
     * `Row = 2`, with `ColumnReverse`/`RowReverse` between them) so this
     * field stays a stable, engine-owned schema value independent of
     * whichever layout library sits underneath; `WidgetTree`'s adapter
     * translates it to yoga's real enum when building each yoga node.
     */
    flexDirection: 0,
    width: -1,
    height: -1,
    flexGrow: 0,
    flexShrink: 1,
    /** Applied to all four edges uniformly — a real per-edge style is a future extension, not needed by the scrollable-list prototype. */
    padding: 0,
    gap: 0,
    /**
     * 0 = relative (the default — takes part in the parent's flex flow), 1 =
     * absolute (removed from flow, positioned via `left`/`top` relative to
     * the parent's own box — yoga's `PositionType.Absolute`). A fixed-position
     * overlay (a debug HUD, a modal) is the real, motivating use case: it
     * needs an exact on-screen position independent of sibling layout.
     */
    positionType: 0,
    left: 0,
    top: 0,
    /**
     * 0 = visible (default), 1 = hidden (children clipped to this widget's
     * box), 2 = scroll (clipped, and children are shifted by
     * `scrollX`/`scrollY`, clamped to the content extent).
     */
    overflow: 0,
    scrollX: 0,
    scrollY: 0,
  }),
  {
    schema: {
      flexDirection: { kind: "enum", options: ["column", "row"] },
      width: { kind: "number" },
      height: { kind: "number" },
      flexGrow: { kind: "number" },
      flexShrink: { kind: "number" },
      padding: { kind: "number" },
      gap: { kind: "number" },
      positionType: { kind: "enum", options: ["relative", "absolute"] },
      left: { kind: "number" },
      top: { kind: "number" },
      overflow: { kind: "enum", options: ["visible", "hidden", "scroll"] },
      scrollX: { kind: "number" },
      scrollY: { kind: "number" },
    },
  },
);

export type LayoutStyleShape = ReturnType<typeof LayoutStyle.createDefaults>;

/**
 * Layout *outputs* — written by `WidgetTree.layout()` every layout pass,
 * read by anything that needs a widget's final on-screen box (hit-testing,
 * rendering). `x`/`y` are absolute (relative to the layout root), not
 * relative to the parent the way Yoga's own `getComputedLeft()`/
 * `getComputedTop()` are — `WidgetTree` accumulates each ancestor's offset
 * while walking the hierarchy-ordered query so callers never have to walk
 * back up the tree themselves to find a widget's real screen position.
 */
export const Layout = defineComponent(
  "Layout",
  () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }),
  {
    schema: {
      x: { kind: "number" },
      y: { kind: "number" },
      width: { kind: "number" },
      height: { kind: "number" },
    },
  },
);

export type LayoutShape = ReturnType<typeof Layout.createDefaults>;

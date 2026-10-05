import { describe, it, expect, beforeEach } from "vitest";
import type { Entity } from "../Entity.js";
import { Scene } from "../Scene.js";
import {
  Layout,
  LayoutStyle,
  type LayoutShape,
  type LayoutStyleShape,
} from "../components/Layout.js";
import { WidgetTree } from "../ui/WidgetTree.js";

/** `entity.get(LayoutStyle)` is only ever undefined for a non-widget entity — every widget this file creates has one, so this narrows the type for test call sites instead of scattering `?.` everywhere. */
function styleOf(entity: Entity): LayoutStyleShape {
  const style = entity.get(LayoutStyle);
  if (style === undefined) throw new Error("expected LayoutStyle on widget");
  return style;
}

/** Same idea for `Layout` (the computed output component). */
function layoutOf(entity: Entity): LayoutShape {
  const layout = entity.get(Layout);
  if (layout === undefined) throw new Error("expected Layout on widget");
  return layout;
}

/**
 * the release notes Track 3's called-for prototype: "prototype against one
 * non-trivial subtree (a scrollable list) first and confirm query
 * performance at realistic widget counts before committing the whole
 * system to this shape." A scrollable list here means one container widget
 * (the "viewport", fixed size) with many fixed-height item widgets as
 * children, stacked in a column — the shape that would back a real
 * scrollable list widget (the actual scroll-offset/clipping behaviour is a
 * follow-up on top of this layout foundation, not part of what's being
 * validated here).
 */

let scene: Scene;
let tree: WidgetTree;

beforeEach(async () => {
  scene = new Scene();
  tree = new WidgetTree();
  await tree.init();
});

describe("WidgetTree — hierarchy relation and query ordering", () => {
  it("orderedWidgets() orders root before children", () => {
    const root = tree.createWidget(scene);
    const childA = tree.createWidget(scene, root);
    const childB = tree.createWidget(scene, root);
    const grandchild = tree.createWidget(scene, childA);

    const order = tree.orderedWidgets(scene);
    const indexOf = (e: typeof root): number =>
      order.findIndex((w) => w.eid === e.eid);

    expect(indexOf(root)).toBeLessThan(indexOf(childA));
    expect(indexOf(root)).toBeLessThan(indexOf(childB));
    expect(indexOf(childA)).toBeLessThan(indexOf(grandchild));
  });

  it("parentOf() reflects the WidgetParent relation, undefined for a root", () => {
    const root = tree.createWidget(scene);
    const child = tree.createWidget(scene, root);

    expect(tree.parentOf(scene, root)).toBeUndefined();
    expect(tree.parentOf(scene, child)?.eid).toBe(root.eid);
  });
});

describe("WidgetTree — scrollable-list layout prototype", () => {
  it("lays out a fixed-size viewport with stacked fixed-height items", () => {
    const list = tree.createWidget(scene);
    styleOf(list).width = 300;

    const items = Array.from({ length: 50 }, () => {
      const item = tree.createWidget(scene, list);
      styleOf(item).height = 40;
      // A real scrollable list's items must opt out of flexbox's default
      // shrink-to-fit (flexShrink: 1) — otherwise yoga proportionally
      // squashes all 50 items down to fit the 400px viewport (400/50 = 8px
      // each) instead of letting the content overflow it, which is the
      // whole point of a *scrollable* list. Found by this prototype, not
      // assumed going in.
      styleOf(item).flexShrink = 0;
      return item;
    });

    tree.layout(scene, 300, 400);

    const listLayout = layoutOf(list);
    expect(listLayout.x).toBe(0);
    expect(listLayout.y).toBe(0);
    expect(listLayout.width).toBe(300);
    expect(listLayout.height).toBe(400);

    // Default flex-direction is column and yoga's default align-items is
    // stretch, so each item should stretch to the list's own width without
    // an explicit width style.
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === undefined) throw new Error("missing item");
      const layout = layoutOf(item);
      expect(layout.x).toBe(0);
      expect(layout.y).toBe(i * 40);
      expect(layout.width).toBe(300);
      expect(layout.height).toBe(40);
    }
    // Total content height (2000) legitimately exceeds the 400px viewport —
    // that's the "scrollable" part; this layout pass does not clip, a
    // scroll-offset/clip step is a follow-up built on top of this.
    const lastItem = items[items.length - 1];
    if (lastItem === undefined) throw new Error("missing last item");
    expect(layoutOf(lastItem).y).toBe(49 * 40);
  });

  it("re-running layout() after a style change updates positions (no stale nodes)", () => {
    const list = tree.createWidget(scene);
    styleOf(list).width = 300;
    const itemA = tree.createWidget(scene, list);
    styleOf(itemA).height = 40;
    styleOf(itemA).flexShrink = 0;
    const itemB = tree.createWidget(scene, list);
    styleOf(itemB).height = 40;
    styleOf(itemB).flexShrink = 0;

    tree.layout(scene, 300, 400);
    expect(layoutOf(itemB).y).toBe(40);

    styleOf(itemA).height = 100;
    tree.layout(scene, 300, 400);
    expect(layoutOf(itemB).y).toBe(100);
  });

  it("handles a realistic widget count within a generous time budget", () => {
    const list = tree.createWidget(scene);
    styleOf(list).width = 300;
    for (let i = 0; i < 1000; i++) {
      const item = tree.createWidget(scene, list);
      styleOf(item).height = 20;
    }

    const start = performance.now();
    tree.layout(scene, 300, 20000);
    const elapsedMs = performance.now() - start;

    // Generous bound (sandboxed CI hardware, cold WASM) — this is a
    // regression guard against something pathological (e.g. accidental
    // O(n^2) re-querying per node), not a real perf benchmark. Log the
    // actual number so a future session tuning this has a real baseline.
    console.log(
      `WidgetTree.layout() for 1001 widgets: ${elapsedMs.toFixed(2)}ms`,
    );
    expect(elapsedMs).toBeLessThan(2000);

    expect(layoutOf(list).height).toBe(20000);
  });
});

describe("WidgetTree — teardown", () => {
  it("destroyWidget removes the entity and its yoga node bookkeeping", () => {
    const root = tree.createWidget(scene);
    const child = tree.createWidget(scene, root);
    tree.layout(scene, 100, 100);

    tree.destroyWidget(scene, child);
    expect(child.isAlive).toBe(false);

    // A second layout pass after destroying a widget should not throw.
    expect(() => tree.layout(scene, 100, 100)).not.toThrow();
  });

  it("destroy() frees every yoga node and clears bookkeeping", () => {
    const root = tree.createWidget(scene);
    tree.createWidget(scene, root);
    tree.layout(scene, 100, 100);

    tree.destroy();
    expect(tree.ready).toBe(false);
  });
});

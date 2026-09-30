import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IUIRenderer } from "@emptysock/types";
import type { Entity } from "../Entity.js";
import { Scene } from "../Scene.js";
import { Layout, LayoutStyle } from "../components/Layout.js";
import { PanelStyle } from "../components/Widgets.js";
import { WidgetTree } from "../ui/WidgetTree.js";
import { UISystem } from "../ui/UISystem.js";

function makeCtx(): IUIRenderer {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clip: vi.fn(),
  };
}

function style(e: Entity) {
  const s = e.get(LayoutStyle);
  if (s === undefined) throw new Error("no style");
  return s;
}
function box(e: Entity) {
  const l = e.get(Layout);
  if (l === undefined) throw new Error("no layout");
  return l;
}

let scene: Scene;
let tree: WidgetTree;
let list: Entity;
let items: Entity[];

beforeEach(async () => {
  scene = new Scene();
  tree = new WidgetTree();
  await tree.init();
  list = tree.createWidget(scene);
  Object.assign(style(list), { width: 100, height: 50, overflow: 2 });
  items = [];
  for (let i = 0; i < 5; i++) {
    const it = tree.createWidget(scene, list);
    Object.assign(style(it), { width: 100, height: 20, flexShrink: 0 });
    it.add(PanelStyle);
    items.push(it);
  }
});

describe("WidgetTree node reuse", () => {
  it("keeps one yoga node per widget across layouts", () => {
    tree.layout(scene, 200, 200);
    expect(tree.yogaNodeCount).toBe(6);
    tree.layout(scene, 200, 200);
    tree.layout(scene, 200, 200);
    expect(tree.yogaNodeCount).toBe(6);
  });

  it("frees the node of a destroyed widget on next layout", () => {
    tree.layout(scene, 200, 200);
    const last = items[4] as Entity;
    tree.destroyWidget(scene, last);
    expect(tree.yogaNodeCount).toBe(5);
    tree.layout(scene, 200, 200);
    expect(tree.yogaNodeCount).toBe(5);
  });

  it("resets absolute positioning when a widget goes back to relative", () => {
    const first = items[0] as Entity;
    Object.assign(style(first), { positionType: 1, left: 40, top: 30 });
    tree.layout(scene, 200, 200);
    expect(box(first).x).toBe(40);
    Object.assign(style(first), { positionType: 0 });
    tree.layout(scene, 200, 200);
    expect(box(first).x).toBe(0);
    expect(box(first).y).toBe(0);
  });
});

describe("scroll offsets", () => {
  it("shifts children by scrollY", () => {
    style(list).scrollY = 30;
    tree.layout(scene, 200, 200);
    expect(box(items[0] as Entity).y).toBe(-30);
    expect(box(items[2] as Entity).y).toBe(10);
    expect(box(list).y).toBe(0);
  });

  it("clamps scroll to content extent (100 content, 50 viewport)", () => {
    style(list).scrollY = 9999;
    tree.layout(scene, 200, 200);
    expect(box(items[0] as Entity).y).toBe(-50);
    style(list).scrollY = -10;
    tree.layout(scene, 200, 200);
    expect(box(items[0] as Entity).y).toBe(0);
  });

  it("does not scroll when overflow is not scroll", () => {
    style(list).overflow = 1;
    style(list).scrollY = 30;
    tree.layout(scene, 200, 200);
    expect(box(items[0] as Entity).y).toBe(0);
  });
});

describe("overflow clipping", () => {
  it("clips children to the container box with save/beginPath/rect/clip", () => {
    tree.layout(scene, 200, 200);
    const ctx = makeCtx();
    new UISystem(tree).render(scene, ctx);
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 100, 50);
    expect(ctx.clip).toHaveBeenCalledTimes(5);
  });

  it("does not clip when nothing overflows", () => {
    style(list).overflow = 0;
    tree.layout(scene, 200, 200);
    const ctx = makeCtx();
    new UISystem(tree).render(scene, ctx);
    expect(ctx.clip).not.toHaveBeenCalled();
  });

  it("hit-test ignores children clipped out of view", () => {
    tree.layout(scene, 200, 200);
    const ui = new UISystem(tree);
    expect(ui.hitTest(scene, 10, 10)).toBe(items[0]);
    // item 4 sits at y 80..100, outside the 0..50 viewport
    expect(ui.hitTest(scene, 10, 90)).toBeUndefined();
  });
});

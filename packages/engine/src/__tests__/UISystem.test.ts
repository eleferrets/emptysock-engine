import { describe, it, expect, vi, beforeEach } from "vitest";
import { UISystem } from "../systems/UISystem.js";
import { ButtonWidget } from "../ui/widgets/button.js";
import { PanelWidget } from "../ui/widgets/panel.js";

let ui: UISystem;

beforeEach(() => {
  ui = new UISystem();
});

describe("UISystem", () => {
  it("add puts a widget into roots", () => {
    const btn = new ButtonWidget({
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      label: "OK",
    });
    ui.add(btn);
    expect(ui.roots).toContain(btn);
  });

  it("remove deletes from roots", () => {
    const btn = new ButtonWidget({ width: 100, height: 40 });
    ui.add(btn);
    ui.remove(btn);
    expect(ui.roots).not.toContain(btn);
  });

  it("clear empties roots", () => {
    ui.add(new ButtonWidget({}));
    ui.add(new ButtonWidget({}));
    ui.clear();
    expect(ui.roots.length).toBe(0);
  });

  it("click handler fires on triggerClick", () => {
    const fn = vi.fn();
    const btn = new ButtonWidget({ width: 100, height: 40 });
    btn.on("click", fn);
    btn.triggerClick();
    expect(fn).toHaveBeenCalledOnce();
  });

  it("handleClick dispatches to topmost widget", () => {
    const fn = vi.fn();
    const btn = new ButtonWidget({ x: 0, y: 0, width: 200, height: 50 });
    btn.on("click", fn);
    ui.add(btn);
    ui.handleClick(100, 25, 1280, 720);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("handleClick returns false when no widget hit", () => {
    const btn = new ButtonWidget({ x: 0, y: 0, width: 50, height: 50 });
    ui.add(btn);
    expect(ui.handleClick(500, 500, 1280, 720)).toBe(false);
  });

  it("child widgets can be added to a panel", () => {
    const panel = new PanelWidget({ width: 300, height: 200 });
    const child = new ButtonWidget({ width: 80, height: 30 });
    panel.children.push(child);
    expect(panel.children).toContain(child);
  });

  it("each instance has isolated roots", () => {
    const ui2 = new UISystem();
    ui.add(new ButtonWidget({}));
    expect(ui2.roots.length).toBe(0);
  });
});

describe("UISystem press/drag/release dispatch", () => {
  it("dispatchPointerDown does not fire click immediately", () => {
    const fn = vi.fn();
    const btn = new ButtonWidget({ x: 0, y: 0, width: 200, height: 50 });
    btn.on("click", fn);
    ui.add(btn);
    ui.dispatchPointerDown(100, 25, 1280, 720);
    expect(fn).not.toHaveBeenCalled();
  });

  it("dispatchPointerUp on the same widget without drag fires click", () => {
    const fn = vi.fn();
    const btn = new ButtonWidget({ x: 0, y: 0, width: 200, height: 50 });
    btn.on("click", fn);
    ui.add(btn);
    ui.dispatchPointerDown(100, 25, 1280, 720);
    const fired = ui.dispatchPointerUp(105, 27, 1280, 720);
    expect(fired).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("moving past the drag threshold suppresses the click on release", () => {
    const fn = vi.fn();
    const btn = new ButtonWidget({ x: 0, y: 0, width: 200, height: 50 });
    btn.on("click", fn);
    ui.add(btn);
    ui.dispatchPointerDown(100, 25, 1280, 720);
    ui.dispatchPointerDrag(150, 25);
    const fired = ui.dispatchPointerUp(150, 25, 1280, 720);
    expect(fired).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("dispatchPointerUp with no matching press returns false", () => {
    const btn = new ButtonWidget({ x: 0, y: 0, width: 200, height: 50 });
    ui.add(btn);
    expect(ui.dispatchPointerUp(100, 25, 1280, 720)).toBe(false);
  });

  it("cancelPointer aborts a press without firing click", () => {
    const fn = vi.fn();
    const btn = new ButtonWidget({ x: 0, y: 0, width: 200, height: 50 });
    btn.on("click", fn);
    ui.add(btn);
    ui.dispatchPointerDown(100, 25, 1280, 720);
    ui.cancelPointer();
    ui.dispatchPointerUp(100, 25, 1280, 720);
    expect(fn).not.toHaveBeenCalled();
  });

  it("tracks multiple simultaneous pointer presses independently by pointerId", () => {
    const fnA = vi.fn();
    const fnB = vi.fn();
    const a = new ButtonWidget({ x: 0, y: 0, width: 100, height: 50 });
    const b = new ButtonWidget({ x: 200, y: 0, width: 100, height: 50 });
    a.on("click", fnA);
    b.on("click", fnB);
    ui.add(a);
    ui.add(b);
    ui.dispatchPointerDown(50, 25, 1280, 720, 1);
    ui.dispatchPointerDown(250, 25, 1280, 720, 2);
    ui.dispatchPointerUp(50, 25, 1280, 720, 1);
    expect(fnA).toHaveBeenCalledOnce();
    expect(fnB).not.toHaveBeenCalled();
    ui.dispatchPointerUp(250, 25, 1280, 720, 2);
    expect(fnB).toHaveBeenCalledOnce();
  });

  it("release outside the pressed widget's bounds does not fire click", () => {
    const fn = vi.fn();
    const btn = new ButtonWidget({ x: 0, y: 0, width: 50, height: 50 });
    btn.on("click", fn);
    ui.add(btn);
    ui.dispatchPointerDown(25, 25, 1280, 720);
    const fired = ui.dispatchPointerUp(500, 500, 1280, 720);
    expect(fired).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("UISystem scale factor", () => {
  it("defaults to a scale of 1", () => {
    expect(ui.scale).toBe(1);
  });

  it("setScale applies uiScale to existing roots and their children", () => {
    const panel = new PanelWidget({ width: 100, height: 100 });
    const child = new ButtonWidget({ width: 50, height: 20 });
    panel.children.push(child);
    ui.add(panel);
    ui.setScale(2);
    expect(panel.uiScale).toBe(2);
    expect(child.uiScale).toBe(2);
  });

  it("setScale affects hit-testing bounds", () => {
    const fn = vi.fn();
    const btn = new ButtonWidget({ x: 0, y: 0, width: 100, height: 50 });
    btn.on("click", fn);
    ui.add(btn);
    ui.setScale(2);
    // At 2x scale the button now spans to x=200; a point at x=150 should hit.
    expect(ui.handleClick(150, 50, 1280, 720)).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("newly added widgets pick up a non-default scale", () => {
    ui.setScale(1.5);
    const btn = new ButtonWidget({ width: 10, height: 10 });
    ui.add(btn);
    expect(btn.uiScale).toBe(1.5);
  });
});

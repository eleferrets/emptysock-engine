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

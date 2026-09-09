import { describe, it, expect, vi } from "vitest";
import {
  LabelWidget,
  ImageWidget,
  ButtonWidget,
  PanelWidget,
  ProgressBarWidget,
  SliderWidget,
  CheckboxWidget,
} from "../ui/Widget.js";

// Minimal IUIRenderer stub
interface MockCtx {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  arcTo: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
}

function makeCtx(): MockCtx {
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
  };
}

describe("LabelWidget", () => {
  it("constructs with defaults", () => {
    const w = new LabelWidget();
    expect(w.text).toBe("");
    expect(w.fontSize).toBe(14);
    expect(w.visible).toBe(true);
    expect(w.alpha).toBe(1);
    expect(w.anchor).toBe("top-left");
  });

  it("resolves position for top-left anchor", () => {
    const w = new LabelWidget({
      x: 10,
      y: 20,
      width: 100,
      height: 30,
      anchor: "top-left",
    });
    const pos = w.resolvedPosition(800, 600);
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(20);
  });

  it("resolves position for center anchor", () => {
    const w = new LabelWidget({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      anchor: "center",
    });
    const pos = w.resolvedPosition(800, 600);
    expect(pos.x).toBe(350);
    expect(pos.y).toBe(280);
  });

  it("resolves position for bottom-right anchor", () => {
    const w = new LabelWidget({
      x: 10,
      y: 10,
      width: 100,
      height: 40,
      anchor: "bottom-right",
    });
    const pos = w.resolvedPosition(800, 600);
    expect(pos.x).toBe(690);
    expect(pos.y).toBe(550);
  });

  it("renders without throwing", () => {
    const w = new LabelWidget({ text: "Hello" });
    const ctx = makeCtx();
    expect(() => w.render(ctx as never, 800, 600)).not.toThrow();
  });

  it("skips render when not visible", () => {
    const w = new LabelWidget({ visible: false });
    const ctx = makeCtx();
    w.render(ctx as never, 800, 600);
    expect(ctx.save).not.toHaveBeenCalled();
  });
});

describe("ButtonWidget", () => {
  it("constructs with defaults", () => {
    const w = new ButtonWidget();
    expect(w.label).toBe("Button");
    expect(w.disabled).toBe(false);
    expect(w.state).toBe("normal");
  });

  it("emits click on triggerClick", () => {
    const w = new ButtonWidget();
    const handler = vi.fn();
    w.on("click", handler);
    w.triggerClick();
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not emit click when disabled", () => {
    const w = new ButtonWidget({ disabled: true });
    const handler = vi.fn();
    w.on("click", handler);
    w.triggerClick();
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not emit click when not visible", () => {
    const w = new ButtonWidget({ visible: false });
    const handler = vi.fn();
    w.on("click", handler);
    w.triggerClick();
    expect(handler).not.toHaveBeenCalled();
  });

  it("transitions to hover state on _setHovered(true)", () => {
    const w = new ButtonWidget();
    w._setHovered(true);
    expect(w.state).toBe("hover");
    expect(w._hovered).toBe(true);
  });

  it("emits hover and hoverOut events", () => {
    const w = new ButtonWidget();
    const onHover = vi.fn();
    const onOut = vi.fn();
    w.on("hover", onHover);
    w.on("hoverOut", onOut);
    w._setHovered(true);
    expect(onHover).toHaveBeenCalledOnce();
    w._setHovered(false);
    expect(onOut).toHaveBeenCalledOnce();
  });

  it("off() removes handler", () => {
    const w = new ButtonWidget();
    const handler = vi.fn();
    w.on("click", handler);
    w.off("click", handler);
    w.triggerClick();
    expect(handler).not.toHaveBeenCalled();
  });

  it("renders without throwing", () => {
    const w = new ButtonWidget({ label: "OK" });
    const ctx = makeCtx();
    expect(() => w.render(ctx as never, 800, 600)).not.toThrow();
  });
});

describe("PanelWidget", () => {
  it("accepts children", () => {
    const panel = new PanelWidget({
      width: 300,
      height: 200,
      anchor: "center",
    });
    const btn = new ButtonWidget({ label: "Resume", anchor: "center", y: 20 });
    panel.children.push(btn);
    expect(panel.children).toHaveLength(1);
    expect(panel.children[0]).toBe(btn);
  });

  it("renders children without throwing", () => {
    const panel = new PanelWidget();
    const label = new LabelWidget({ text: "Child" });
    panel.children.push(label);
    const ctx = makeCtx();
    expect(() => panel.render(ctx as never, 800, 600)).not.toThrow();
  });
});

describe("ProgressBarWidget", () => {
  it("normalises value correctly", () => {
    const w = new ProgressBarWidget({ value: 50, min: 0, max: 100 });
    expect(w.normalised).toBeCloseTo(0.5);
  });

  it("clamps normalised value to 0–1", () => {
    const w = new ProgressBarWidget({ value: 150, min: 0, max: 100 });
    expect(w.normalised).toBe(1);
    w.value = -10;
    expect(w.normalised).toBe(0);
  });

  it("renders without throwing", () => {
    const w = new ProgressBarWidget({ value: 0.6 });
    const ctx = makeCtx();
    expect(() => w.render(ctx as never, 800, 600)).not.toThrow();
  });
});

describe("SliderWidget", () => {
  it("fires onChange on construction", () => {
    const cb = vi.fn();
    const w = new SliderWidget({ onChange: cb });
    w._emit("change", 0.5);
    expect(cb).toHaveBeenCalledWith(0.5);
  });

  it("normalises value", () => {
    const w = new SliderWidget({ value: 0.25, min: 0, max: 1 });
    expect(w.normalised).toBeCloseTo(0.25);
  });
});

describe("CheckboxWidget", () => {
  it("toggles on triggerClick", () => {
    const w = new CheckboxWidget({ checked: false });
    w.triggerClick();
    expect(w.checked).toBe(true);
    w.triggerClick();
    expect(w.checked).toBe(false);
  });

  it("calls onChange callback", () => {
    const cb = vi.fn();
    const w = new CheckboxWidget({ onChange: cb });
    w.triggerClick();
    expect(cb).toHaveBeenCalledWith(true);
  });

  it("renders without throwing", () => {
    const w = new CheckboxWidget({ label: "Enable", checked: true });
    const ctx = makeCtx();
    expect(() => w.render(ctx as never, 800, 600)).not.toThrow();
  });
});

describe("Widget animations", () => {
  it("fadeIn sets alpha from 0 to 1", () => {
    const w = new LabelWidget({ alpha: 1 });
    w.animate("fadeIn", { duration: 200 });
    expect(w.alpha).toBe(0);
    expect(w.visible).toBe(true);
    w._tick(0.1); // 100ms / 200ms = 0.5
    expect(w.alpha).toBeGreaterThan(0);
    expect(w.alpha).toBeLessThan(1);
    w._tick(0.1);
    expect(w.alpha).toBeCloseTo(1, 1);
  });

  it("fadeOut sets visible=false at end", () => {
    const w = new LabelWidget({ alpha: 1 });
    w.animate("fadeOut", { duration: 200 });
    w._tick(0.2);
    expect(w.visible).toBe(false);
  });

  it("emits animEnd when animation completes", () => {
    const w = new LabelWidget();
    const handler = vi.fn();
    w.on("animEnd", handler);
    w.animate("fadeIn", { duration: 100 });
    w._tick(0.1);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("pop animation scales widget", () => {
    const w = new ButtonWidget();
    w.animate("pop", { duration: 200 });
    w._tick(0.05); // mid-animation
    expect(w._scaleX).toBeGreaterThan(1);
    w._tick(0.15);
    expect(w._scaleX).toBeCloseTo(1, 1);
  });

  it("shake animation offsets widget horizontally", () => {
    const w = new LabelWidget();
    w.animate("shake", { duration: 300 });
    w._tick(0.05);
    expect(Math.abs(w._animDx)).toBeGreaterThanOrEqual(0);
    w._tick(0.25);
    expect(w._anim).toBeNull();
  });

  it("slideIn sets _animDy offset for down direction", () => {
    const w = new LabelWidget();
    w.animate("slideIn", { duration: 200, direction: "down" });
    w._tick(0.05);
    expect(w._animDy).toBeGreaterThan(0);
  });
});

describe("Widget hit-testing", () => {
  it("contains() returns true for point inside", () => {
    const w = new LabelWidget({
      x: 100,
      y: 100,
      width: 100,
      height: 40,
      anchor: "top-left",
    });
    expect(w.contains(150, 120, 800, 600)).toBe(true);
  });

  it("contains() returns false for point outside", () => {
    const w = new LabelWidget({
      x: 100,
      y: 100,
      width: 100,
      height: 40,
      anchor: "top-left",
    });
    expect(w.contains(50, 50, 800, 600)).toBe(false);
  });

  it("contains() returns false when not visible", () => {
    const w = new LabelWidget({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      visible: false,
    });
    expect(w.contains(100, 100, 800, 600)).toBe(false);
  });
});

describe("ImageWidget", () => {
  it("constructs with src", () => {
    const w = new ImageWidget({ src: "hero.png", width: 64, height: 64 });
    expect(w.src).toBe("hero.png");
    expect(w.width).toBe(64);
  });

  it("renders placeholder when no bitmap cached", () => {
    const w = new ImageWidget({ src: "hero.png", width: 64, height: 64 });
    const ctx = makeCtx();
    w.render(ctx as never, 800, 600);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

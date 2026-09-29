import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IUIRenderer } from "@emptysock/types";
import type { Entity } from "../Entity.js";
import { Scene } from "../Scene.js";
import { WidgetTree } from "../ui/WidgetTree.js";
import { UISystem } from "../ui/UISystem.js";
import { LayoutStyle, type LayoutStyleShape } from "../components/Layout.js";
import type { Texture } from "pixi.js";
import {
  layoutBitmapText,
  type BitmapFontDef,
} from "../systems/BitmapFontDef.js";
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

/** Minimal IUIRenderer stub, same shape as `Widget.test.ts`'s `makeCtx()`. */
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

/** Every widget this file creates has a `LayoutStyle` — narrows `entity.get()`'s `T | undefined` for test call sites. */
function styleOf(entity: Entity): LayoutStyleShape {
  const style = entity.get(LayoutStyle);
  if (style === undefined) throw new Error("expected LayoutStyle on widget");
  return style;
}

/**
 * RELEASE_PASS.md Track 3's `UISystem`, built on top of the `WidgetTree`
 * prototype — hit-testing, press/drag/click/hover dispatch: click-vs-drag
 * threshold, disabled buttons don't hover/press, topmost-widget-wins
 * hit-testing.
 */

let scene: Scene;
let tree: WidgetTree;
let ui: UISystem;

beforeEach(async () => {
  scene = new Scene();
  tree = new WidgetTree();
  await tree.init();
  ui = new UISystem(tree);
});

describe("UISystem — hit-testing", () => {
  it("hitTest returns the topmost (last-created) widget at a point", () => {
    const back = tree.createWidget(scene);
    styleOf(back).width = 100;
    styleOf(back).height = 100;

    tree.layout(scene, 100, 100);
    expect(ui.hitTest(scene, 50, 50)?.eid).toBe(back.eid);

    const front = tree.createWidget(scene);
    styleOf(front).width = 100;
    styleOf(front).height = 100;
    tree.layout(scene, 100, 100);

    expect(ui.hitTest(scene, 50, 50)?.eid).toBe(front.eid);
  });

  it("returns undefined outside every widget's box", () => {
    const w = tree.createWidget(scene);
    styleOf(w).width = 50;
    styleOf(w).height = 50;
    tree.layout(scene, 100, 100);

    expect(ui.hitTest(scene, 90, 90)).toBeUndefined();
  });

  it("skips a widget whose WidgetAppearance.visible is false", () => {
    const w = tree.createWidget(scene);
    styleOf(w).width = 50;
    styleOf(w).height = 50;
    w.add(WidgetAppearance, { visible: false });
    tree.layout(scene, 100, 100);

    expect(ui.hitTest(scene, 10, 10)).toBeUndefined();
  });
});

describe("UISystem — button press/click/drag", () => {
  it("a plain press-and-release within the drag threshold fires a click", () => {
    const button = tree.createWidget(scene);
    button.add(ButtonState);
    styleOf(button).width = 100;
    styleOf(button).height = 40;
    tree.layout(scene, 100, 40);

    ui.dispatchPointerDown(scene, 50, 20);
    expect(button.get(ButtonState)?.state).toBe(2); // pressed
    const fired = ui.dispatchPointerUp(scene, 52, 20);

    expect(fired).toBe(true);
    expect(button.get(ButtonState)?.state).toBe(0); // back to normal
  });

  it("moving past the drag threshold before release does not fire a click", () => {
    const button = tree.createWidget(scene);
    button.add(ButtonState);
    styleOf(button).width = 200;
    styleOf(button).height = 40;
    tree.layout(scene, 200, 40);

    ui.dispatchPointerDown(scene, 20, 20);
    ui.dispatchPointerDrag(scene, 40, 20); // 20px > 6px threshold
    const fired = ui.dispatchPointerUp(scene, 40, 20);

    expect(fired).toBe(false);
  });

  it("a disabled button does not enter the pressed state", () => {
    const button = tree.createWidget(scene);
    button.add(ButtonState, { disabled: true });
    styleOf(button).width = 100;
    styleOf(button).height = 40;
    tree.layout(scene, 100, 40);

    ui.dispatchPointerDown(scene, 50, 20);
    expect(button.get(ButtonState)?.state).toBe(0);
  });

  it("cancelPointer aborts a press without firing a click and resets state", () => {
    const button = tree.createWidget(scene);
    button.add(ButtonState);
    styleOf(button).width = 100;
    styleOf(button).height = 40;
    tree.layout(scene, 100, 40);

    ui.dispatchPointerDown(scene, 50, 20);
    ui.cancelPointer();
    expect(button.get(ButtonState)?.state).toBe(0);

    const fired = ui.dispatchPointerUp(scene, 50, 20);
    expect(fired).toBe(false);
  });

  it("updateHover sets hover state only while nothing is pressed", () => {
    const button = tree.createWidget(scene);
    button.add(ButtonState);
    styleOf(button).width = 100;
    styleOf(button).height = 40;
    tree.layout(scene, 100, 40);

    ui.updateHover(scene, 50, 20);
    expect(button.get(ButtonState)?.state).toBe(1); // hover

    ui.updateHover(scene, 500, 500);
    expect(button.get(ButtonState)?.state).toBe(0);
  });
});

describe("UISystem — checkbox", () => {
  it("toggles Checkbox.checked on a real click, not on a drag", () => {
    const box = tree.createWidget(scene);
    box.add(Checkbox);
    styleOf(box).width = 20;
    styleOf(box).height = 20;
    tree.layout(scene, 20, 20);

    ui.dispatchPointerDown(scene, 10, 10);
    ui.dispatchPointerUp(scene, 10, 10);
    expect(box.get(Checkbox)?.checked).toBe(true);

    ui.dispatchPointerDown(scene, 10, 10);
    ui.dispatchPointerDrag(scene, 19, 19);
    ui.dispatchPointerUp(scene, 19, 19);
    expect(box.get(Checkbox)?.checked).toBe(true); // unchanged — that release was a drag
  });
});

describe("UISystem — slider", () => {
  it("dragging across the slider's box updates its value proportionally", () => {
    const slider = tree.createWidget(scene);
    slider.add(Slider, { min: 0, max: 100 });
    styleOf(slider).width = 200;
    styleOf(slider).height = 20;
    tree.layout(scene, 200, 20);

    ui.dispatchPointerDown(scene, 0, 10);
    expect(slider.get(Slider)?.value).toBe(0);

    ui.dispatchPointerDrag(scene, 100, 10);
    expect(slider.get(Slider)?.value).toBe(50);

    ui.dispatchPointerDrag(scene, 200, 10);
    expect(slider.get(Slider)?.value).toBe(100);
  });

  it("clamps the value to [min, max] even past the widget's box", () => {
    const slider = tree.createWidget(scene);
    slider.add(Slider, { min: 0, max: 10 });
    styleOf(slider).width = 100;
    styleOf(slider).height = 20;
    tree.layout(scene, 100, 20);

    ui.dispatchPointerDown(scene, 0, 10);
    ui.dispatchPointerDrag(scene, 500, 10);
    expect(slider.get(Slider)?.value).toBe(10);
  });
});

describe("UISystem — render", () => {
  it("draws every visible widget kind without throwing, skips invisible ones", () => {
    const panel = tree.createWidget(scene);
    panel.add(PanelStyle);
    styleOf(panel).width = 200;
    styleOf(panel).height = 100;

    const label = tree.createWidget(scene, panel);
    label.add(Label, { text: "hello" });
    styleOf(label).height = 20;

    const button = tree.createWidget(scene, panel);
    button.add(ButtonState);
    styleOf(button).height = 30;

    const hidden = tree.createWidget(scene, panel);
    hidden.add(Label, { text: "should not draw" });
    hidden.add(WidgetAppearance, { visible: false });

    const progress = tree.createWidget(scene, panel);
    progress.add(Progress, { value: 5, max: 10 });
    styleOf(progress).height = 10;

    tree.layout(scene, 200, 100);

    const ctx = makeCtx();
    expect(() => ui.render(scene, ctx)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      "hello",
      expect.any(Number),
      expect.any(Number),
    );
    expect(ctx.fillText).not.toHaveBeenCalledWith(
      "should not draw",
      expect.any(Number),
      expect.any(Number),
    );
  });
});

describe("UISystem — FontRegistry (fontId resolution)", () => {
  it("uses the registered font's precomposed css when fontId resolves", async () => {
    const { FontRegistry } = await import("../systems/FontRegistry.js");
    const fonts = new FontRegistry();
    fonts.register("fnt_menu", {
      family: "Impact",
      size: 24,
      bold: true,
      italic: false,
    });

    const localUi = new UISystem(tree, { fonts });
    const label = tree.createWidget(scene);
    label.add(Label, { text: "hi", fontId: "fnt_menu" });
    styleOf(label).width = 100;
    styleOf(label).height = 20;
    tree.layout(scene, 100, 20);

    const ctx = makeCtx();
    localUi.render(scene, ctx);
    expect(ctx.font).toBe("bold 24px Impact");
  });

  it("falls back to font/fontSize when fontId is unset", () => {
    const label = tree.createWidget(scene);
    label.add(Label, { text: "hi", font: "monospace", fontSize: 12 });
    styleOf(label).width = 100;
    styleOf(label).height = 20;
    tree.layout(scene, 100, 20);

    const ctx = makeCtx();
    ui.render(scene, ctx);
    expect(ctx.font).toBe("12px monospace");
  });

  it("falls back to font/fontSize when fontId is set but unregistered", () => {
    const localUi = new UISystem(tree, {});
    const label = tree.createWidget(scene);
    label.add(Label, {
      text: "hi",
      fontId: "does_not_exist",
      font: "monospace",
      fontSize: 12,
    });
    styleOf(label).width = 100;
    styleOf(label).height = 20;
    tree.layout(scene, 100, 20);

    const ctx = makeCtx();
    localUi.render(scene, ctx);
    expect(ctx.font).toBe("12px monospace");
  });
});

describe("UISystem — ImageWidget loading/caching", () => {
  it("draws the placeholder while a source is loading, then the real image once it resolves — loading only once per shared path", async () => {
    let resolveLoad: (texture: Texture) => void = () => undefined;
    const loader = vi.fn(
      () =>
        new Promise<Texture>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const imageUi = new UISystem(tree, { imageLoader: loader });

    const a = tree.createWidget(scene);
    a.add(ImageWidget, { src: "sprites/hero.png" });
    styleOf(a).width = 32;
    styleOf(a).height = 32;

    const b = tree.createWidget(scene);
    b.add(ImageWidget, { src: "sprites/hero.png" });
    styleOf(b).width = 32;
    styleOf(b).height = 32;

    tree.layout(scene, 64, 64);

    const ctx = makeCtx();
    imageUi.render(scene, ctx);
    // Both widgets share one path — only one real load kicks off.
    expect(loader).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();

    const fakeResource = { width: 32, height: 32 };
    const texture = {
      source: { resource: fakeResource },
    } as unknown as Texture;
    resolveLoad(texture);
    await Promise.resolve();
    await Promise.resolve();

    const ctx2 = makeCtx();
    imageUi.render(scene, ctx2);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(ctx2.drawImage).toHaveBeenCalledTimes(2);
  });

  it("draws the placeholder for an empty src and keeps drawing the placeholder if the load fails", async () => {
    const loader = vi.fn(() => Promise.reject(new Error("404")));
    const imageUi = new UISystem(tree, { imageLoader: loader });
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const empty = tree.createWidget(scene);
    empty.add(ImageWidget, { src: "" });
    styleOf(empty).width = 16;
    styleOf(empty).height = 16;

    const failing = tree.createWidget(scene);
    failing.add(ImageWidget, { src: "sprites/missing.png" });
    styleOf(failing).width = 16;
    styleOf(failing).height = 16;

    tree.layout(scene, 32, 32);

    const ctx = makeCtx();
    imageUi.render(scene, ctx);
    expect(loader).toHaveBeenCalledTimes(1); // never called for the empty src
    await Promise.resolve();
    await Promise.resolve();

    const ctx2 = makeCtx();
    imageUi.render(scene, ctx2);
    expect(ctx2.drawImage).not.toHaveBeenCalled();
    expect(ctx2.fillRect).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("UISystem — bitmap font text (drawImageRegion)", () => {
  const def: BitmapFontDef = {
    name: "fnt_bmp",
    atlasPath: "fonts/fnt_bmp.png",
    size: 8,
    lineHeight: 10,
    glyphs: {
      65: { x: 0, y: 0, w: 6, h: 10, shift: 7, offset: 1 },
      66: { x: 6, y: 0, w: 5, h: 10, shift: 6, offset: 0 },
    },
    kerning: [],
  };
  const atlas = { atlas: true };
  const fakeTexture = { source: { resource: atlas } } as unknown as Texture;

  function makeRegionCtx(): IUIRenderer & {
    drawImageRegion: ReturnType<typeof vi.fn>;
  } {
    return Object.assign(makeCtx(), { drawImageRegion: vi.fn() });
  }

  async function setup(opts: {
    align?: number;
    color?: string;
    loaded?: boolean;
    kind?: "label" | "button" | "checkbox";
  }) {
    const { FontRegistry } = await import("../systems/FontRegistry.js");
    const fonts = new FontRegistry();
    fonts.registerBitmap("fnt_bmp", def);
    fonts.register("fnt_bmp", {
      family: "Arial",
      size: 9,
      bold: false,
      italic: false,
    });
    const loader = vi.fn(async () => fakeTexture);
    const bmpUi = new UISystem(tree, { fonts, imageLoader: loader });
    const w = tree.createWidget(scene);
    const kind = opts.kind ?? "label";
    if (kind === "label") {
      w.add(Label, {
        text: "AB",
        fontId: "fnt_bmp",
        align: opts.align ?? 0,
        ...(opts.color !== undefined ? { color: opts.color } : {}),
      });
    } else if (kind === "button") {
      w.add(ButtonState, { label: "AB", fontId: "fnt_bmp" });
    } else {
      w.add(Checkbox, { label: "AB", fontId: "fnt_bmp" });
    }
    styleOf(w).width = 100;
    styleOf(w).height = 20;
    tree.layout(scene, 100, 20);
    if (opts.loaded !== false) {
      bmpUi.render(scene, makeRegionCtx()); // kicks off the atlas load
      await Promise.resolve();
      await Promise.resolve();
    }
    return { bmpUi, loader };
  }

  it("blits one region per glyph at layoutBitmapText positions (left aligned)", async () => {
    const { bmpUi } = await setup({ align: 0 });
    const ctx = makeRegionCtx();
    bmpUi.render(scene, ctx);
    const layout = layoutBitmapText(def, "AB");
    expect(ctx.drawImageRegion).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).not.toHaveBeenCalled();
    const oy = 10 - layout.height / 2;
    layout.placements.forEach((p, i) => {
      expect(ctx.drawImageRegion.mock.calls[i]).toEqual([
        atlas,
        p.glyph.x,
        p.glyph.y,
        p.glyph.w,
        p.glyph.h,
        p.x,
        oy + p.y,
        p.glyph.w,
        p.glyph.h,
      ]);
    });
  });

  it("center and right alignment shift the origin by the layout width", async () => {
    const width = layoutBitmapText(def, "AB").width;
    const centre = await setup({ align: 1 });
    const c1 = makeRegionCtx();
    centre.bmpUi.render(scene, c1);
    // first glyph offset 1, origin 50 - width/2
    expect(c1.drawImageRegion.mock.calls[0]?.[5]).toBe(50 - width / 2 + 1);
  });

  it("right alignment ends at the box's right edge", async () => {
    const width = layoutBitmapText(def, "AB").width;
    const { bmpUi } = await setup({ align: 2 });
    const ctx = makeRegionCtx();
    bmpUi.render(scene, ctx);
    expect(ctx.drawImageRegion.mock.calls[0]?.[5]).toBe(100 - width + 1);
  });

  it("falls back to fillText with the CSS font when the renderer has no drawImageRegion", async () => {
    const { bmpUi } = await setup({});
    const ctx = makeCtx();
    bmpUi.render(scene, ctx);
    expect(ctx.fillText).toHaveBeenCalledWith("AB", 0, 10);
    expect(ctx.font).toBe("9px Arial");
  });

  it("falls back while the atlas is loading, then uses the bitmap once loaded", async () => {
    const { bmpUi, loader } = await setup({ loaded: false });
    const before = makeRegionCtx();
    bmpUi.render(scene, before);
    expect(before.drawImageRegion).not.toHaveBeenCalled();
    expect(before.fillText).toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    const after = makeRegionCtx();
    bmpUi.render(scene, after);
    expect(after.drawImageRegion).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("keeps the CSS path for a tinted (non-white) label since region blits cannot tint", async () => {
    const { bmpUi } = await setup({ color: "#ff0000" });
    const ctx = makeRegionCtx();
    bmpUi.render(scene, ctx);
    expect(ctx.drawImageRegion).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe("#ff0000");
  });

  it("buttons and checkbox labels share the same resolution", async () => {
    const b = await setup({ kind: "button" });
    const cb = makeRegionCtx();
    b.bmpUi.render(scene, cb);
    expect(cb.drawImageRegion).toHaveBeenCalledTimes(2);
  });

  it("checkbox label uses the bitmap path too", async () => {
    scene = new Scene();
    const c = await setup({ kind: "checkbox" });
    const cc = makeRegionCtx();
    c.bmpUi.render(scene, cc);
    expect(cc.drawImageRegion).toHaveBeenCalledTimes(2);
  });

  it("a fontId without a bitmap def is unchanged", async () => {
    const { FontRegistry } = await import("../systems/FontRegistry.js");
    const fonts = new FontRegistry();
    fonts.register("fnt_css", {
      family: "Impact",
      size: 20,
      bold: false,
      italic: false,
    });
    const localUi = new UISystem(tree, { fonts });
    const l = tree.createWidget(scene);
    l.add(Label, { text: "x", fontId: "fnt_css" });
    styleOf(l).width = 50;
    styleOf(l).height = 20;
    tree.layout(scene, 50, 20);
    const ctx = makeRegionCtx();
    localUi.render(scene, ctx);
    expect(ctx.drawImageRegion).not.toHaveBeenCalled();
    expect(ctx.font).toBe("20px Impact");
  });
});

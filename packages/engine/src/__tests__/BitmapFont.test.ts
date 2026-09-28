import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";
import { Texture } from "pixi.js";

vi.mock("pixi.js", async () => {
  const actual = await vi.importActual<typeof PixiJS>("pixi.js");
  return {
    ...actual,
    autoDetectRenderer: vi.fn(() =>
      Promise.resolve({
        canvas: {},
        render: vi.fn(),
        resize: vi.fn(),
        destroy: vi.fn(),
      }),
    ),
  };
});

const { RenderPipeline } = await import("../systems/RenderPipeline.js");
const { Scene } = await import("../Scene.js");
const { GmlBehaviorSystem } = await import("../systems/GmlBehaviorSystem.js");
const { GmlBehaviorState, registerGmlBehavior, unregisterGmlBehavior } =
  await import("../components/GmlBehavior.js");
const { FontRegistry } = await import("../systems/FontRegistry.js");
const { bitmapKerning, layoutBitmapText, toPixiBitmapFontData } =
  await import("../systems/BitmapFontDef.js");
import type { BitmapFontDef } from "../systems/BitmapFontDef.js";
import type { GmlBehaviorModule } from "../components/GmlBehavior.js";

const DEF: BitmapFontDef = {
  name: "fnt_menu",
  atlasPath: "./assets/fonts/fnt_menu.png",
  size: 24,
  lineHeight: 40,
  glyphs: {
    65: { x: 2, y: 2, w: 10, h: 37, shift: 11, offset: 1 },
    66: { x: 14, y: 2, w: 9, h: 40, shift: 10, offset: 0 },
  },
  kerning: [[65, 66, -2]],
};

describe("BitmapFontDef (pixi-free)", () => {
  it("looks up kerning, 0 for an unlisted pair", () => {
    expect(bitmapKerning(DEF, 65, 66)).toBe(-2);
    expect(bitmapKerning(DEF, 66, 65)).toBe(0);
  });

  it("lays out glyphs with offset, shift, kerning and newlines; skips unknown code points", () => {
    const l = layoutBitmapText(DEF, "AB\nA?");
    expect(l.placements.map((p) => [p.codePoint, p.x, p.y])).toEqual([
      [65, 1, 0], // pen 0 + offset 1
      [66, 9, 0], // pen 11 - 2 kerning = 9, offset 0
      [65, 1, 40], // second line
    ]);
    expect(l.width).toBe(19); // 11-2 + 10
    expect(l.height).toBe(80);
  });

  it("converts to pixi font data, keying kerning by the previous letter", () => {
    const d = toPixiBitmapFontData(DEF, "fam");
    expect(d.lineHeight).toBe(40);
    expect(d.fontSize).toBe(24);
    expect(d.chars["A"]).toMatchObject({
      x: 2,
      width: 10,
      xOffset: 1,
      xAdvance: 11,
    });
    expect(d.chars["B"]?.kerning).toEqual({ A: -2 });
    expect(d.pages[0]?.file).toBe(DEF.atlasPath);
  });
});

describe("FontRegistry bitmap fonts", () => {
  it("registers, reads and clears bitmap defs independently of CSS descriptors", () => {
    const fonts = new FontRegistry();
    expect(fonts.hasBitmap("fnt_menu")).toBe(false);
    fonts.registerBitmap("fnt_menu", DEF);
    expect(fonts.getBitmap("fnt_menu")).toBe(DEF);
    expect(fonts.has("fnt_menu")).toBe(false);
    fonts.clear();
    expect(fonts.getBitmap("fnt_menu")).toBeUndefined();
  });
});

describe("PixiGmlDrawTarget draws GML text with a registered bitmap font", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;
  let loader: ReturnType<typeof vi.fn<(p: string) => Promise<Texture>>>;
  const kinds = (c: { children: readonly unknown[] }): string[] =>
    c.children.flatMap((ch) => [
      (ch as { constructor: { name: string } }).constructor.name,
      ...kinds(ch as { children: readonly unknown[] }),
    ]);

  beforeEach(async () => {
    loader = vi.fn<(p: string) => Promise<Texture>>(() =>
      Promise.resolve(Texture.WHITE),
    );
    const fonts = new FontRegistry();
    fonts.registerBitmap("fnt_menu", DEF);
    pipeline = new RenderPipeline({ textureLoader: loader, fonts });
    await pipeline.init();
    scene = new Scene();
    registerGmlBehavior("label", {
      onDrawGui: (_e, ctx) => {
        ctx.drawTarget?.setFont?.("fnt_menu");
        ctx.drawTarget?.setColor(0xff0000);
        ctx.drawTarget?.text(5, 6, "AB");
      },
    } satisfies GmlBehaviorModule);
    scene.spawn().add(GmlBehaviorState, { behaviorId: "label" });
    pipeline.attachGmlBehaviors(new GmlBehaviorSystem(), { scene } as never);
  });

  it("falls back to Canvas Text while the atlas loads, then uses BitmapText once it is loaded", async () => {
    pipeline.renderFrame(scene);
    expect(loader).toHaveBeenCalledWith(DEF.atlasPath);
    expect(kinds(pipeline.guiLayer)).toContain("Text");
    expect(kinds(pipeline.guiLayer)).not.toContain("BitmapText");

    await Promise.resolve();
    await Promise.resolve();
    pipeline.renderFrame(scene);
    expect(kinds(pipeline.guiLayer)).toContain("BitmapText");
    expect(loader).toHaveBeenCalledTimes(1);
    unregisterGmlBehavior("label");
  });

  it("an id with no bitmap def keeps using Canvas Text", async () => {
    unregisterGmlBehavior("label");
    registerGmlBehavior("label", {
      onDrawGui: (_e, ctx) => {
        ctx.drawTarget?.setFont?.("fnt_other");
        ctx.drawTarget?.text(0, 0, "AB");
      },
    } satisfies GmlBehaviorModule);
    pipeline.renderFrame(scene);
    await Promise.resolve();
    pipeline.renderFrame(scene);
    expect(kinds(pipeline.guiLayer)).not.toContain("BitmapText");
    unregisterGmlBehavior("label");
  });
});

import { describe, it, expect, vi } from "vitest";
import type * as PixiJS from "pixi.js";
import { Texture } from "pixi.js";

vi.mock("pixi.js", async () => {
  const actual = await vi.importActual<typeof PixiJS>("pixi.js");
  return {
    ...actual,
    autoDetectRenderer: vi.fn(() =>
      Promise.resolve({
        canvas: {},
        width: 800,
        height: 600,
        render: vi.fn(),
        resize: vi.fn(),
        destroy: vi.fn(),
      }),
    ),
  };
});

const { RenderPipeline } = await import("../systems/RenderPipeline.js");
const { RenderSystem } = await import("../systems/RenderSystem.js");
const { LightingSystem } = await import("../systems/LightingSystem.js");
const { Scene } = await import("../Scene.js");

describe("RenderPipeline.attachLighting", () => {
  async function setup() {
    const pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(Texture.WHITE)),
    });
    await pipeline.init();
    return { pipeline, scene: new Scene() };
  }

  it("syncs lighting each frame once attached, over the camera rect", async () => {
    const { pipeline, scene } = await setup();
    const spy = vi
      .spyOn(RenderSystem.prototype, "syncLighting")
      .mockImplementation(() => {});
    const lighting = new LightingSystem();
    pipeline.renderFrame(scene);
    expect(spy).not.toHaveBeenCalled();

    pipeline.attachLighting(lighting, "default");
    pipeline.renderFrame(scene);
    pipeline.renderFrame(scene);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(lighting, scene, "default", {
      x: -0,
      y: -0,
      width: 800,
      height: 600,
    });
    spy.mockRestore();
  });

  it("stops syncing and clears the lightmap on detach", async () => {
    const { pipeline, scene } = await setup();
    const sync = vi
      .spyOn(RenderSystem.prototype, "syncLighting")
      .mockImplementation(() => {});
    const clear = vi
      .spyOn(RenderSystem.prototype, "clearLighting")
      .mockImplementation(() => {});
    pipeline.attachLighting(new LightingSystem());
    pipeline.attachLighting(null);
    pipeline.renderFrame(scene);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(sync).not.toHaveBeenCalled();
    sync.mockRestore();
    clear.mockRestore();
  });
});

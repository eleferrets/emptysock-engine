import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type * as PixiJS from "pixi.js";

// jsdom has no WebGL/WebGPU context, so pixi.js's autoDetectRenderer cannot
// pick a real renderer — mock it the same way RenderPipeline.test.ts does.
vi.mock("pixi.js", async () => {
  const actual = await vi.importActual<typeof PixiJS>("pixi.js");
  return {
    ...actual,
    autoDetectRenderer: vi.fn(() =>
      Promise.resolve({
        canvas: document.createElement("canvas"),
        render: vi.fn(),
        resize: vi.fn(),
        destroy: vi.fn(),
      }),
    ),
  };
});

const { ViewportSystem, computeViewportSize, gpuTierRenderDefaults } =
  await import("../systems/ViewportSystem.js");
const { RenderSystem } = await import("../systems/RenderSystem.js");
const { CameraSystem } = await import("../systems/CameraSystem.js");

// jsdom does not implement ResizeObserver — mock it so container-based
// resize listening can be exercised without a real browser.
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: () => void;
  observed: Element[] = [];

  constructor(callback: () => void) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  disconnect(): void {
    this.observed = [];
  }

  /** Test helper: simulate the browser firing a resize callback. */
  fire(): void {
    this.callback();
  }
}

describe("computeViewportSize", () => {
  it("fit mode letterboxes a wider container (pillarbox top/bottom removed, side bars added)", () => {
    // Design 1280x720 (16:9) into a 1000x1000 square container.
    const size = computeViewportSize(1280, 720, 1000, 1000, "fit");
    // scale = min(1000/1280, 1000/720) = min(0.78125, 1.3889) = 0.78125
    expect(size.scale).toBeCloseTo(0.78125, 5);
    expect(size.width).toBeCloseTo(1000, 5);
    expect(size.height).toBeCloseTo(562.5, 5);
    expect(size.offsetX).toBeCloseTo(0, 5);
    expect(size.offsetY).toBeCloseTo((1000 - 562.5) / 2, 5);
  });

  it("fit mode letterboxes a taller container (top/bottom bars)", () => {
    // Design 1280x720 into a narrow 400x1000 container.
    const size = computeViewportSize(1280, 720, 400, 1000, "fit");
    // scale = min(400/1280, 1000/720) = min(0.3125, 1.3889) = 0.3125
    expect(size.scale).toBeCloseTo(0.3125, 5);
    expect(size.width).toBeCloseTo(400, 5);
    expect(size.height).toBeCloseTo(225, 5);
    expect(size.offsetX).toBeCloseTo(0, 5);
    expect(size.offsetY).toBeCloseTo((1000 - 225) / 2, 5);
  });

  it("fill mode cover-crops instead of letterboxing", () => {
    const size = computeViewportSize(1280, 720, 1000, 1000, "fill");
    // scale = max(1000/1280, 1000/720) = max(0.78125, 1.3889) = 1.3889
    expect(size.scale).toBeCloseTo(1000 / 720, 5);
    expect(size.width).toBeCloseTo(1280 * (1000 / 720), 5);
    expect(size.height).toBeCloseTo(1000, 5);
  });

  it("stretch mode fills the container exactly with no letterboxing", () => {
    const size = computeViewportSize(1280, 720, 400, 1000, "stretch");
    expect(size.width).toBe(400);
    expect(size.height).toBe(1000);
    expect(size.offsetX).toBe(0);
    expect(size.offsetY).toBe(0);
    expect(size.scale).toBe(1);
  });

  it("matching aspect ratio produces no letterbox offset", () => {
    const size = computeViewportSize(1280, 720, 1920, 1080, "fit");
    expect(size.offsetX).toBeCloseTo(0, 5);
    expect(size.offsetY).toBeCloseTo(0, 5);
    expect(size.scale).toBeCloseTo(1.5, 5);
  });

  it("returns a zeroed size for degenerate (zero/negative) inputs", () => {
    expect(computeViewportSize(0, 720, 1000, 1000, "fit")).toEqual({
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 0,
    });
    expect(computeViewportSize(1280, 720, -1, 1000, "fit").width).toBe(0);
  });
});

describe("gpuTierRenderDefaults", () => {
  it("disables antialiasing and caps resolution at 1 for potato tier", () => {
    expect(gpuTierRenderDefaults("potato", 3)).toEqual({
      antialias: false,
      resolution: 1,
    });
  });

  it("disables antialiasing and caps resolution at 1 for low tier", () => {
    expect(gpuTierRenderDefaults("low", 3)).toEqual({
      antialias: false,
      resolution: 1,
    });
  });

  it("keeps antialiasing on and caps resolution at 1.5 for mid tier", () => {
    expect(gpuTierRenderDefaults("mid", 3)).toEqual({
      antialias: true,
      resolution: 1.5,
    });
    // Below the cap, the actual DPR passes through unchanged.
    expect(gpuTierRenderDefaults("mid", 1)).toEqual({
      antialias: true,
      resolution: 1,
    });
  });

  it("keeps antialiasing on and caps resolution at 2 for high tier", () => {
    expect(gpuTierRenderDefaults("high", 3)).toEqual({
      antialias: true,
      resolution: 2,
    });
  });

  it("keeps antialiasing on and caps resolution at 2 for ultra tier", () => {
    expect(gpuTierRenderDefaults("ultra", 3)).toEqual({
      antialias: true,
      resolution: 2,
    });
    expect(gpuTierRenderDefaults("ultra", 1)).toEqual({
      antialias: true,
      resolution: 1,
    });
  });
});

describe("ViewportSystem", () => {
  let originalResizeObserver: unknown;

  beforeEach(() => {
    originalResizeObserver = (window as unknown as { ResizeObserver?: unknown })
      .ResizeObserver;
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver =
      MockResizeObserver;
    MockResizeObserver.instances = [];
  });

  afterEach(() => {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver =
      originalResizeObserver;
    vi.restoreAllMocks();
  });

  it("does not throw without any DOM/container available (Node/Vitest safety)", () => {
    const vp = new ViewportSystem();
    expect(() =>
      vp.init({ designWidth: 1280, designHeight: 720, scaleMode: "fit" }),
    ).not.toThrow();
    vp.destroy();
  });

  it("recompute() feeds RenderSystem.resize() and CameraSystem.setViewSize()", async () => {
    const render = new RenderSystem();
    await render.init({ width: 1280, height: 720 });
    const resizeSpy = vi.spyOn(render, "resize");

    const camera = new CameraSystem();
    const setViewSizeSpy = vi.spyOn(camera, "setViewSize");

    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(container, "clientHeight", {
      value: 1000,
      configurable: true,
    });

    const vp = new ViewportSystem();
    vp.init(
      { designWidth: 1280, designHeight: 720, scaleMode: "fit", container },
      { renderTarget: render, cameraSystem: camera },
    );

    expect(resizeSpy).toHaveBeenCalled();
    expect(setViewSizeSpy).toHaveBeenCalledWith(1280, 720);

    const [w, h] = resizeSpy.mock.calls[resizeSpy.mock.calls.length - 1] as [
      number,
      number,
    ];
    expect(w).toBeCloseTo(1000, 5);
    expect(h).toBeCloseTo(562.5, 5);

    render.destroy();
    vp.destroy();
  });

  it("a container resize event triggers a recompute via ResizeObserver", async () => {
    const render = new RenderSystem();
    await render.init({ width: 1280, height: 720 });
    const resizeSpy = vi.spyOn(render, "resize");

    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(container, "clientHeight", {
      value: 600,
      configurable: true,
    });

    const vp = new ViewportSystem();
    vp.init(
      { designWidth: 1280, designHeight: 720, scaleMode: "fit", container },
      { renderTarget: render },
    );
    resizeSpy.mockClear();

    // Simulate the container growing, then fire the observer callback.
    Object.defineProperty(container, "clientWidth", {
      value: 1600,
      configurable: true,
    });
    Object.defineProperty(container, "clientHeight", {
      value: 900,
      configurable: true,
    });
    expect(MockResizeObserver.instances.length).toBe(1);
    const observerInstance = MockResizeObserver.instances[0];
    if (observerInstance === undefined)
      throw new Error("expected observer instance");
    observerInstance.fire();

    expect(resizeSpy).toHaveBeenCalled();
    const [w, h] = resizeSpy.mock.calls[0] as [number, number];
    expect(w).toBeCloseTo(1600, 5);
    expect(h).toBeCloseTo(900, 5);

    render.destroy();
    vp.destroy();
  });

  it("window resize fires a recompute when no container is configured", () => {
    const vp = new ViewportSystem();
    vp.init({ designWidth: 1280, designHeight: 720, scaleMode: "fit" });
    const recomputeSpy = vi.spyOn(vp, "recompute");

    window.dispatchEvent(new Event("resize"));
    expect(recomputeSpy).toHaveBeenCalled();

    vp.destroy();
  });

  it("orientationchange fires a recompute", () => {
    const vp = new ViewportSystem();
    vp.init({ designWidth: 1280, designHeight: 720, scaleMode: "fit" });
    const recomputeSpy = vi.spyOn(vp, "recompute");

    window.dispatchEvent(new Event("orientationchange"));
    expect(recomputeSpy).toHaveBeenCalled();

    vp.destroy();
  });

  it("setScaleMode and setDesignResolution recompute immediately", () => {
    const vp = new ViewportSystem();
    vp.init({ designWidth: 1280, designHeight: 720, scaleMode: "fit" });
    const recomputeSpy = vi.spyOn(vp, "recompute");

    vp.setScaleMode("fill");
    expect(vp.config.scaleMode).toBe("fill");
    expect(recomputeSpy).toHaveBeenCalledTimes(1);

    vp.setDesignResolution(1920, 1080);
    expect(vp.config.designWidth).toBe(1920);
    expect(vp.config.designHeight).toBe(1080);
    expect(recomputeSpy).toHaveBeenCalledTimes(2);

    vp.destroy();
  });

  it("getSafeAreaInsets returns zeroed insets when env() is unsupported (jsdom)", () => {
    const vp = new ViewportSystem();
    const insets = vp.getSafeAreaInsets();
    expect(insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("destroy() removes listeners so later events do not trigger recompute", () => {
    const vp = new ViewportSystem();
    vp.init({ designWidth: 1280, designHeight: 720, scaleMode: "fit" });
    const recomputeSpy = vi.spyOn(vp, "recompute");

    vp.destroy();
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("orientationchange"));

    expect(recomputeSpy).not.toHaveBeenCalled();
  });
});

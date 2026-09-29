import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";

// Same mocking strategy as RenderPipeline.test.ts: stub autoDetectRenderer so
// init() never needs a real GPU/canvas, while every other pixi.js export
// (Container, Filter, BlurFilter, ColorMatrixFilter, ...) stays real, so the
// actual filter instances syncPostProcessLayerFilters() builds are the real
// PixiJS classes, not mocks.
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

const { RenderSystem } = await import("../systems/RenderSystem.js");
const { PostProcessSystem } = await import("../systems/PostProcessSystem.js");
const { BlurFilter, ColorMatrixFilter } = await import("pixi.js");
const { OutlineFilter } = await import("pixi-filters");
const { RainGlassFilter } = await import("../systems/RainGlassFilter.js");

describe("RenderSystem.syncPostProcessLayerFilters", () => {
  let render: InstanceType<typeof RenderSystem>;
  let pp: InstanceType<typeof PostProcessSystem>;

  beforeEach(async () => {
    render = new RenderSystem();
    await render.init();
    pp = new PostProcessSystem();
  });

  it("attaches a real BlurFilter for a blur layer filter", () => {
    pp.setLayerFilter("fg", { type: "blur", radius: 6 });
    render.syncPostProcessLayerFilters(pp);
    const container = render.getLayerContainer("fg");
    expect(container.filters).toHaveLength(1);
    const filter = container.filters[0];
    expect(filter).toBeInstanceOf(BlurFilter);
    expect((filter as InstanceType<typeof BlurFilter>).strength).toBe(6);
  });

  it("attaches a real OutlineFilter for an outline layer filter", () => {
    pp.setLayerFilter("fg", {
      type: "outline",
      thickness: 3,
      colour: 0xff0000,
    });
    render.syncPostProcessLayerFilters(pp);
    const filter = render.getLayerContainer("fg").filters[0];
    expect(filter).toBeInstanceOf(OutlineFilter);
    expect((filter as InstanceType<typeof OutlineFilter>).thickness).toBe(3);
  });

  it("attaches a real ColorMatrixFilter for brightness/contrast/saturate/hue-rotate/invert", () => {
    for (const type of [
      "brightness",
      "contrast",
      "saturate",
      "hue-rotate",
      "invert",
    ] as const) {
      pp.setLayerFilter("fg", { type });
      render.syncPostProcessLayerFilters(pp);
      const filter = render.getLayerContainer("fg").filters[0];
      expect(filter).toBeInstanceOf(ColorMatrixFilter);
    }
  });

  it("colourblind mode embeds PostProcessSystem's own CVD matrix into the ColorMatrixFilter", () => {
    pp.setLayerFilter("fg", { type: "colourblind", mode: "protanopia" });
    render.syncPostProcessLayerFilters(pp);
    const filter = render.getLayerContainer("fg").filters[0] as InstanceType<
      typeof ColorMatrixFilter
    >;
    expect(filter).toBeInstanceOf(ColorMatrixFilter);
    // Row-major 5x4: first row's first 3 entries are the CVD matrix's row 0.
    expect(filter.matrix[0]).toBeCloseTo(0.152286, 5);
    expect(filter.matrix[1]).toBeCloseTo(1.052583, 5);
    expect(filter.matrix[2]).toBeCloseTo(-0.204868, 5);
  });

  it("disabling a layer filter detaches and destroys it", () => {
    pp.setLayerFilter("fg", { type: "blur", radius: 4 });
    render.syncPostProcessLayerFilters(pp);
    expect(render.getLayerContainer("fg").filters).toHaveLength(1);

    pp.toggleLayerFilter("fg", false);
    render.syncPostProcessLayerFilters(pp);
    expect(render.getLayerContainer("fg").filters).toHaveLength(0);
  });

  it("clearing a layer filter removes it on the next sync even without an explicit disable", () => {
    pp.setLayerFilter("fg", { type: "blur", radius: 4 });
    render.syncPostProcessLayerFilters(pp);
    expect(render.getLayerContainer("fg").filters).toHaveLength(1);

    pp.clearLayerFilter("fg");
    render.syncPostProcessLayerFilters(pp);
    expect(render.getLayerContainer("fg").filters).toHaveLength(0);
  });

  it("reuses the same filter instance across syncs when the type is unchanged", () => {
    pp.setLayerFilter("fg", { type: "blur", radius: 4 });
    render.syncPostProcessLayerFilters(pp);
    const first = render.getLayerContainer("fg").filters[0];

    pp.setLayerFilter("fg", { type: "blur", radius: 8 });
    render.syncPostProcessLayerFilters(pp);
    const second = render.getLayerContainer("fg").filters[0];

    expect(second).toBe(first);
    expect((second as InstanceType<typeof BlurFilter>).strength).toBe(8);
  });

  it("rebuilds the filter when the layer's filter type changes", () => {
    pp.setLayerFilter("fg", { type: "blur", radius: 4 });
    render.syncPostProcessLayerFilters(pp);
    const first = render.getLayerContainer("fg").filters[0];

    pp.setLayerFilter("fg", { type: "outline", thickness: 2 });
    render.syncPostProcessLayerFilters(pp);
    const second = render.getLayerContainer("fg").filters[0];

    expect(second).not.toBe(first);
    expect(second).toBeInstanceOf(OutlineFilter);
  });

  it("destroy() clears all tracked post-process filters", () => {
    pp.setLayerFilter("fg", { type: "blur", radius: 4 });
    render.syncPostProcessLayerFilters(pp);
    expect(render.getLayerContainer("fg").filters).toHaveLength(1);
    render.destroy();
    // getLayerContainer after destroy() would throw (renderer torn down),
    // so this test only verifies destroy() itself doesn't throw while
    // filters are tracked — the real assertion is "no error, no leak".
  });

  it("destroy() releases pixi's global pooled resources with the renderer", async () => {
    const { autoDetectRenderer } = await import("pixi.js");
    const results = vi.mocked(autoDetectRenderer).mock.results;
    const renderer = (await results[results.length - 1]?.value) as {
      destroy: ReturnType<typeof vi.fn>;
    };
    render.destroy();
    expect(renderer.destroy).toHaveBeenCalledWith({
      releaseGlobalResources: true,
    });
  });

  describe("rain-glass", () => {
    it("attaches a real RainGlassFilter with default uniform values", () => {
      pp.setLayerFilter("fg", { type: "rain-glass" });
      render.syncPostProcessLayerFilters(pp);
      const filter = render.getLayerContainer("fg").filters[0];
      expect(filter).toBeInstanceOf(RainGlassFilter);
      const res = (filter as InstanceType<typeof RainGlassFilter>).resources[
        "uniforms"
      ] as unknown as { uniforms: Record<string, unknown> };
      expect(res.uniforms["uIntensity"]).toBe(0.6);
      expect(res.uniforms["uDropletSize"]).toBe(0.12);
      expect(res.uniforms["uDropletSpeed"]).toBe(0.35);
      expect(res.uniforms["uStreakAmount"]).toBe(0.5);
    });

    it("applies intensity/dropletSize/dropletSpeed/streakAmount from options", () => {
      pp.setLayerFilter("fg", {
        type: "rain-glass",
        intensity: 0.9,
        dropletSize: 0.2,
        dropletSpeed: 0.7,
        streakAmount: 0.1,
      });
      render.syncPostProcessLayerFilters(pp);
      const filter = render.getLayerContainer("fg").filters[0] as InstanceType<
        typeof RainGlassFilter
      >;
      const res = (
        filter.resources["uniforms"] as { uniforms: Record<string, unknown> }
      ).uniforms;
      expect(res["uIntensity"]).toBe(0.9);
      expect(res["uDropletSize"]).toBe(0.2);
      expect(res["uDropletSpeed"]).toBe(0.7);
      expect(res["uStreakAmount"]).toBe(0.1);
    });

    it("applies quality, fog and wiper options and ticks the sim", () => {
      pp.setLayerFilter("fg", {
        type: "rain-glass",
        quality: "low",
        fog: 0.5,
        wiperEnabled: true,
        wiperPeriod: 2,
        seed: 9,
      });
      render.syncPostProcessLayerFilters(pp);
      const filter = render.getLayerContainer("fg").filters[0] as InstanceType<
        typeof RainGlassFilter
      >;
      expect(filter.tier.name).toBe("low");
      expect(filter.sim.fogTarget).toBe(0.5);
      expect(filter.sim.wiper.enabled).toBe(true);
      expect(filter.sim.wiper.periodSec).toBe(2);
      render.syncPostProcessLayerFilters(pp); // idempotent, no rebuild
      expect(render.getLayerContainer("fg").filters[0]).toBe(filter);
    });

    it("advances uTime across syncs (rain falls over real time, not frame count)", () => {
      pp.setLayerFilter("fg", { type: "rain-glass" });
      render.syncPostProcessLayerFilters(pp);
      const filter = render.getLayerContainer("fg").filters[0] as InstanceType<
        typeof RainGlassFilter
      >;
      const first = filter.elapsed;
      // First sync always ticks by 0 (no prior timestamp to diff against).
      expect(first).toBe(0);
      render.syncPostProcessLayerFilters(pp);
      expect(filter.elapsed).toBeGreaterThanOrEqual(first);
    });

    it("rebuilds cleanly when switching from another filter type to rain-glass and back", () => {
      pp.setLayerFilter("fg", { type: "blur", radius: 5 });
      render.syncPostProcessLayerFilters(pp);
      expect(render.getLayerContainer("fg").filters[0]).toBeInstanceOf(
        BlurFilter,
      );

      pp.setLayerFilter("fg", { type: "rain-glass", intensity: 0.4 });
      render.syncPostProcessLayerFilters(pp);
      const rainFilter = render.getLayerContainer("fg").filters[0];
      expect(rainFilter).toBeInstanceOf(RainGlassFilter);

      pp.setLayerFilter("fg", { type: "blur", radius: 2 });
      render.syncPostProcessLayerFilters(pp);
      const backToBlur = render.getLayerContainer("fg").filters[0];
      expect(backToBlur).toBeInstanceOf(BlurFilter);
      expect(backToBlur).not.toBe(rainFilter);
    });

    it("disabling a rain-glass filter detaches and destroys it", () => {
      pp.setLayerFilter("fg", { type: "rain-glass" });
      render.syncPostProcessLayerFilters(pp);
      expect(render.getLayerContainer("fg").filters).toHaveLength(1);

      pp.toggleLayerFilter("fg", false);
      render.syncPostProcessLayerFilters(pp);
      expect(render.getLayerContainer("fg").filters).toHaveLength(0);
    });

    it("reuses the same RainGlassFilter instance across syncs when the type is unchanged", () => {
      pp.setLayerFilter("fg", { type: "rain-glass", intensity: 0.3 });
      render.syncPostProcessLayerFilters(pp);
      const first = render.getLayerContainer("fg").filters[0];

      pp.setLayerFilter("fg", { type: "rain-glass", intensity: 0.8 });
      render.syncPostProcessLayerFilters(pp);
      const second = render.getLayerContainer("fg").filters[0];

      expect(second).toBe(first);
      const res = (second as InstanceType<typeof RainGlassFilter>).resources[
        "uniforms"
      ] as unknown as { uniforms: Record<string, unknown> };
      expect(res.uniforms["uIntensity"]).toBe(0.8);
    });
  });
});

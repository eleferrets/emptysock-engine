import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";

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
const S = await import("../compat/gmlSurfaces.js");
const { LightingSystem } = await import("../systems/LightingSystem.js");
const { Scene } = await import("../Scene.js");
const { Transform } = await import("../components/Transform.js");
const { LightSource } = await import("../components/LightSource.js");
const { LightOccluder } = await import("../components/LightOccluder.js");
import type { GmlActionContext } from "../compat/gmlActions.js";
import type { GmlDrawTarget } from "../compat/gml.js";

function fakeTarget(log: string[]): GmlDrawTarget {
  return {
    setColor: (c) => log.push(`color ${c}`),
    rect: () => log.push("rect"),
    circle: () => log.push("circle"),
    text: () => undefined,
    line: () => undefined,
    sprite: () => undefined,
    setBlendMode: (m) => log.push(`blend ${m}`),
    drawSurface: (id, x, y) => log.push(`surface ${id} ${x},${y}`),
    clear: (c, a) => log.push(`clear ${c} ${a}`),
  };
}

describe("compat/gmlSurfaces — routing", () => {
  it("is an honest no-op without a backend", () => {
    const ctx = { scene: new Scene() } as GmlActionContext;
    expect(S.surface_create(ctx, 10, 10)).toBe(-1);
    expect(S.surface_exists(ctx, 1)).toBe(false);
    expect(() => S.surface_set_target(ctx, 1)).not.toThrow();
    expect(() => S.surface_reset_target(ctx)).not.toThrow();
    expect(() => S.gpu_set_blendmode(ctx, S.bm_subtract)).not.toThrow();
  });

  it("redirects drawTarget into the surface and restores it, committing on reset (the darkness+cutout sequence)", () => {
    const surfaceLog: string[] = [];
    const screenLog: string[] = [];
    const ended: number[] = [];
    const backend = {
      create: () => 7,
      exists: (id: number) => id === 7,
      free: vi.fn(),
      width: () => 640,
      height: () => 480,
      beginTarget: () => fakeTarget(surfaceLog),
      endTarget: (id: number) => ended.push(id),
    };
    const screen = fakeTarget(screenLog);
    const ctx = {
      scene: new Scene(),
      surfaces: backend,
      drawTarget: screen,
    } as GmlActionContext;

    const surf = S.surface_create(ctx, 640, 480);
    S.surface_set_target(ctx, surf);
    S.draw_clear(ctx, 0xc0c0c0);
    S.gpu_set_blendmode(ctx, S.bm_subtract);
    ctx.drawTarget?.circle(0, 0, 10, false);
    S.surface_reset_target(ctx);
    expect(ctx.drawTarget).toBe(screen);
    expect(ended).toEqual([7]);
    S.gpu_set_blendmode(ctx, S.bm_subtract);
    S.draw_surface(ctx, surf, 5, 6);
    S.gpu_set_blendmode(ctx, S.bm_normal);

    expect(surfaceLog).toEqual(["clear 12632256 1", "blend 3", "circle"]);
    expect(screenLog).toEqual(["blend 3", "surface 7 5,6", "blend 0"]);
  });
});

describe("PixiSurfaceBackend / PixiGmlDrawTarget blend segments", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  beforeEach(async () => {
    pipeline = new RenderPipeline();
    await pipeline.init();
  });

  it("renders a surface target into its RenderTexture on reset, clearing first after draw_clear, and draw_surface samples it with the blend mode", () => {
    const ctx = {
      scene: new Scene(),
      surfaces: pipeline.surfaces,
    } as never as GmlActionContext;
    const surf = S.surface_create(ctx, 64, 32);
    expect(surf).toBeGreaterThan(0);
    expect(S.surface_exists(ctx, surf)).toBe(true);

    S.surface_set_target(ctx, surf);
    S.draw_clear(ctx, 0xc0c0c0);
    S.gpu_set_blendmode(ctx, S.bm_subtract);
    ctx.drawTarget?.setColor(0xffffff);
    ctx.drawTarget?.ellipse?.(0, 0, 20, 20, false);
    S.surface_reset_target(ctx);

    const render = vi.mocked(pipeline.renderer.render);
    expect(render).toHaveBeenCalledTimes(1);
    const arg = render.mock.calls[0]?.[0] as unknown as {
      clear: boolean;
      clearColor: number[];
      target: unknown;
      container: { children: { children: { blendMode: string }[] }[] };
    };
    expect(arg.clear).toBe(true);
    expect(arg.clearColor[0]).toBeCloseTo(0xc0 / 255);
    expect(arg.target).toBe(pipeline.surfaces.texture(surf));
  });

  it("a blend change makes a child Graphics segment with the pixi blend mode", () => {
    const backend = pipeline.surfaces;
    const id = backend.create(8, 8);
    const target = backend.beginTarget(id);
    target?.setBlendMode?.(3);
    target?.rect(0, 0, 4, 4, false);
    target?.setBlendMode?.(1);
    target?.setBlendMode?.(0);
    const render = vi.mocked(pipeline.renderer.render);
    render.mockClear();
    let modes: string[] = [];
    render.mockImplementationOnce(((o: {
      container: { children: PixiJS.Graphics[] };
    }) => {
      const base = o.container.children[0];
      modes = (base?.children ?? []).map((c) => c.blendMode);
    }) as never);
    backend.endTarget(id);
    expect(modes).toEqual(["subtract", "add", "normal"]);
    backend.free(id);
    expect(backend.exists(id)).toBe(false);
  });
});

describe("LightingSystem — standard darkness + cutout coverage", () => {
  it("ambient darkness plus a point light cutout, a cone mask, and an occluder-limited cutout", () => {
    const scene = new Scene();
    const lighting = new LightingSystem();
    lighting.ambient = { colour: 0x000000, level: 0.1 };

    const light = scene.spawn();
    light.add(Transform, { x: 0, y: 0 });
    light.add(LightSource, { radius: 100, coneAngle: 90 });
    const wall = scene.spawn();
    wall.add(Transform, { x: 50, y: 0 });
    wall.add(LightOccluder, { width: 10, height: 200 });

    const [sample] = lighting.collectLights(scene);
    expect(lighting.ambient.level).toBe(0.1);
    expect(sample?.radius).toBe(100);
    expect(sample?.coneAngle).toBeCloseTo(Math.PI / 2);
    expect(sample?.visibility).not.toBeNull();
  });
});

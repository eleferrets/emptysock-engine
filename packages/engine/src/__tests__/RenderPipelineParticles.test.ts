import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";

// Same mocking strategy as RenderPipeline.test.ts: stub autoDetectRenderer so
// init() never needs a real GPU/canvas, while every other pixi.js export
// (Container, ParticleContainer, Particle, Texture, ...) stays real.
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
const { ParticleSystem } = await import("../systems/ParticleSystem.js");
const { Texture, ParticleContainer } = await import("pixi.js");

/**
 * RELEASE_PASS.md Track 4's real gap: `ParticleEmitter` was already a pure
 * simulation with zero pixi dependency, but nothing wired it into real
 * gameplay rendering (only the IDE's canvas preview editor consumed
 * `getParticles()`). `mountParticles()`/`unmountParticles()` close that gap
 * with a real pixi core `ParticleContainer` per mounted emitter.
 */
describe("ECS RenderPipeline — particle wiring", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;
  let particles: InstanceType<typeof ParticleSystem>;

  beforeEach(async () => {
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(Texture.WHITE)),
    });
    await pipeline.init();
    scene = new Scene();
    particles = new ParticleSystem();
  });

  it("mounts a real ParticleContainer for an emitter, nested under the stage", async () => {
    const emitter = particles.create({ emissionRate: 1000 });
    await pipeline.mountParticles(emitter);

    // With no LayerSystem layers defined, the mounted container lands in
    // the stage's single default container.
    const found = pipeline.stage.children.some((c) =>
      c.children.some((cc) => cc instanceof ParticleContainer),
    );
    expect(found).toBe(true);
  });

  it("reuses pixi Particle objects across frames instead of reallocating", async () => {
    const emitter = particles.create({
      emissionRate: 1000,
      lifetime: { min: 10, max: 10 },
      maxParticles: 5,
    });
    await pipeline.mountParticles(emitter);
    particles.update(0.5);
    pipeline.renderFrame(scene);
    const container = pipeline.stage.children
      .flatMap((c) => c.children)
      .find((c) => c instanceof ParticleContainer) as InstanceType<
      typeof ParticleContainer
    >;
    const first = [...container.particleChildren];
    expect(first.length).toBeGreaterThan(0);
    pipeline.renderFrame(scene);
    expect(container.particleChildren).toEqual(first);
    expect(container.particleChildren[0]).toBe(first[0]);
  });

  it("syncs active particles from the emitter into the mounted container each renderFrame()", async () => {
    const emitter = particles.create({
      emissionRate: 1000,
      lifetime: { min: 10, max: 10 },
      maxParticles: 5,
    });
    await pipeline.mountParticles(emitter);

    emitter.x = 50;
    emitter.y = 60;
    particles.update(0.5); // spawn some particles

    expect(emitter.activeCount).toBeGreaterThan(0);

    pipeline.renderFrame(scene);

    // Find the mounted ParticleContainer by walking the stage tree.
    let mounted: InstanceType<typeof ParticleContainer> | undefined;
    for (const child of pipeline.stage.children) {
      for (const grandchild of child.children) {
        if (grandchild instanceof ParticleContainer) mounted = grandchild;
      }
    }
    expect(mounted).toBeDefined();
    expect(mounted?.particleChildren.length).toBe(emitter.activeCount);
  });

  it("unmountParticles removes and destroys the container; a second call is a no-op", async () => {
    const emitter = particles.create();
    await pipeline.mountParticles(emitter);
    pipeline.unmountParticles(emitter);
    expect(() => pipeline.unmountParticles(emitter)).not.toThrow();
  });

  it("falls back to Texture.WHITE when the emitter has no texture set", async () => {
    const emitter = particles.create(); // options.texture defaults to ""
    await expect(pipeline.mountParticles(emitter)).resolves.not.toThrow();
  });

  it("mounts a normal-blend emitter's container with pixi's default blend mode", async () => {
    const emitter = particles.create({ emissionRate: 0 });
    await pipeline.mountParticles(emitter);
    let mounted: InstanceType<typeof ParticleContainer> | undefined;
    for (const child of pipeline.stage.children) {
      for (const grandchild of child.children) {
        if (grandchild instanceof ParticleContainer) mounted = grandchild;
      }
    }
    expect(mounted?.blendMode).toBe("normal");
  });

  it("mounts an additive-blend emitter's container with pixi's 'add' blend mode", async () => {
    const emitter = particles.create({ emissionRate: 0, blendMode: "add" });
    await pipeline.mountParticles(emitter);
    let mounted: InstanceType<typeof ParticleContainer> | undefined;
    for (const child of pipeline.stage.children) {
      for (const grandchild of child.children) {
        if (grandchild instanceof ParticleContainer) mounted = grandchild;
      }
    }
    expect(mounted?.blendMode).toBe("add");
  });
});

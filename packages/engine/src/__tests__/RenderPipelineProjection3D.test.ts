import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";

// Same mocking strategy as RenderPipelineParticles.test.ts: stub
// autoDetectRenderer so init() never needs a real GPU/canvas, while every
// other pixi.js export (Container, Sprite, PerspectiveMesh, Texture, ...)
// stays real.
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
const { Transform } = await import("../components/Transform.js");
const { Sprite } = await import("../components/Sprite.js");
const { Projection3D } = await import("../components/Projection3D.js");
const {
  Texture,
  Sprite: PixiSprite,
  PerspectiveMesh,
} = await import("pixi.js");

function findRenderables(pipeline: InstanceType<typeof RenderPipeline>) {
  const sprites: InstanceType<typeof PixiSprite>[] = [];
  const meshes: InstanceType<typeof PerspectiveMesh>[] = [];
  for (const child of pipeline.stage.children) {
    for (const grandchild of child.children) {
      if (grandchild instanceof PerspectiveMesh) meshes.push(grandchild);
      else if (grandchild instanceof PixiSprite) sprites.push(grandchild);
    }
  }
  return { sprites, meshes };
}

describe("RenderPipeline — Projection3D wiring", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;

  beforeEach(async () => {
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(Texture.WHITE)),
    });
    await pipeline.init();
    scene = new Scene();
  });

  it("an entity with no Projection3D renders as a plain PixiSprite, unchanged", () => {
    const entity = scene.spawn();
    entity.add(Transform, { x: 10, y: 20 });
    entity.add(Sprite);

    pipeline.syncEntities(scene);

    const { sprites, meshes } = findRenderables(pipeline);
    expect(sprites).toHaveLength(1);
    expect(meshes).toHaveLength(0);
    expect(sprites[0]).toMatchObject({ x: 10, y: 20 });
  });

  it("an entity with Projection3D present but inactive still renders as a plain PixiSprite", () => {
    const entity = scene.spawn();
    entity.add(Transform, { x: 5, y: 5 });
    entity.add(Sprite);
    entity.add(Projection3D, { active: false });

    pipeline.syncEntities(scene);

    const { sprites, meshes } = findRenderables(pipeline);
    expect(sprites).toHaveLength(1);
    expect(meshes).toHaveLength(0);
  });

  it("an entity with an active Projection3D renders as a real PerspectiveMesh, corners copied straight through", () => {
    const entity = scene.spawn();
    entity.add(Transform, { x: 999, y: 999 }); // must NOT be applied to a projected entity
    entity.add(Sprite);
    entity.add(Projection3D, {
      active: true,
      x0: 1,
      y0: 2,
      x1: 30,
      y1: 4,
      x2: 30,
      y2: 40,
      x3: 1,
      y3: 40,
    });

    pipeline.syncEntities(scene);

    const { sprites, meshes } = findRenderables(pipeline);
    expect(sprites).toHaveLength(0);
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0];
    expect(mesh?.geometry.corners).toEqual([1, 2, 30, 4, 30, 40, 1, 40]);
    // Transform's (999, 999) must not be applied on top of the corners.
    expect(mesh?.x).toBe(0);
    expect(mesh?.y).toBe(0);
  });

  it("flipping Projection3D.active from true to false switches the entity back to a plain sprite next sync, tearing down the mesh", () => {
    const entity = scene.spawn();
    entity.add(Transform, { x: 1, y: 1 });
    entity.add(Sprite);
    const proj = entity.add(Projection3D, { active: true });
    void proj;

    pipeline.syncEntities(scene);
    expect(findRenderables(pipeline).meshes).toHaveLength(1);

    const projection = entity.get(Projection3D);
    if (projection === undefined) throw new Error("expected Projection3D");
    projection.active = false;
    pipeline.syncEntities(scene);

    const { sprites, meshes } = findRenderables(pipeline);
    expect(meshes).toHaveLength(0);
    expect(sprites).toHaveLength(1);
  });

  it("destroying a projected entity removes its mesh on the next sync", () => {
    const entity = scene.spawn();
    entity.add(Transform);
    entity.add(Sprite);
    entity.add(Projection3D, { active: true });
    pipeline.syncEntities(scene);
    expect(findRenderables(pipeline).meshes).toHaveLength(1);

    scene.destroy(entity);
    pipeline.syncEntities(scene);
    expect(findRenderables(pipeline).meshes).toHaveLength(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";

// Same mocking strategy as RenderPipeline.test.ts: stub autoDetectRenderer so
// init() never needs a real GPU/canvas, while every other pixi.js export
// (Container, Graphics, ...) stays real, so the actual render-tree structure
// (world stage vs. gui stage) is genuinely exercised.
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
const { CameraSystem } = await import("../systems/CameraSystem.js");
const { GmlBehaviorSystem } = await import("../systems/GmlBehaviorSystem.js");
const { GmlBehaviorState, registerGmlBehavior, unregisterGmlBehavior } =
  await import("../components/GmlBehavior.js");
import type { GmlBehaviorModule } from "../components/GmlBehavior.js";
const { Transform } = await import("../components/Transform.js");
const { Meta } = await import("../components/Meta.js");

describe("GmlBehaviorSystem — Begin Step / Step / End Step ordering", () => {
  let scene: InstanceType<typeof Scene>;
  let system: InstanceType<typeof GmlBehaviorSystem>;

  beforeEach(() => {
    scene = new Scene();
    system = new GmlBehaviorSystem();
  });

  it("every entity's onStepBegin sees the PREVIOUS frame's onUpdate writes — Begin Step never interleaves with Step", () => {
    // Two entities, one behavior each: entity B's onStepBegin reads a shared
    // value entity A's onUpdate writes. If passes interleaved per-entity
    // (A-begin, A-update, A-end, B-begin, B-update, B-end), B's begin would
    // see A's *this-frame* write. The real three-global-passes ordering
    // means B's begin only ever sees what was written up through the
    // previous frame's Step pass.
    let shared = 0;
    const seenByBBegin: number[] = [];

    registerGmlBehavior("writer", {
      onUpdate: () => {
        shared += 1;
      },
    } satisfies GmlBehaviorModule);
    registerGmlBehavior("reader", {
      onStepBegin: () => {
        seenByBBegin.push(shared);
      },
    } satisfies GmlBehaviorModule);

    const a = scene.spawn();
    a.add(GmlBehaviorState, { behaviorId: "writer" });
    const b = scene.spawn();
    b.add(GmlBehaviorState, { behaviorId: "reader" });

    const ctx = { scene } as never;
    system.update(scene, 1 / 60, ctx);
    system.update(scene, 1 / 60, ctx);
    system.update(scene, 1 / 60, ctx);

    // Frame 1: shared starts at 0, B's begin runs before A's update this
    // frame → sees 0. Frame 2: sees frame 1's final value (1). Frame 3: sees
    // frame 2's final value (2).
    expect(seenByBBegin).toEqual([0, 1, 2]);
    expect(shared).toBe(3);

    unregisterGmlBehavior("writer");
    unregisterGmlBehavior("reader");
  });

  it("onStepEnd runs strictly after every entity's onUpdate this same frame", () => {
    const order: string[] = [];

    registerGmlBehavior("slow-update", {
      onUpdate: () => {
        order.push("A:update");
      },
    } satisfies GmlBehaviorModule);
    registerGmlBehavior("end-reader", {
      onStepEnd: () => {
        order.push("B:end");
      },
    } satisfies GmlBehaviorModule);

    const a = scene.spawn();
    a.add(GmlBehaviorState, { behaviorId: "slow-update" });
    const b = scene.spawn();
    b.add(GmlBehaviorState, { behaviorId: "end-reader" });

    system.update(scene, 1 / 60, { scene } as never);

    expect(order).toEqual(["A:update", "B:end"]);

    unregisterGmlBehavior("slow-update");
    unregisterGmlBehavior("end-reader");
  });
});

describe("GmlBehaviorSystem — step-based Collision dispatch (4th pass, AABB overlap)", () => {
  let scene: InstanceType<typeof Scene>;
  let system: InstanceType<typeof GmlBehaviorSystem>;

  beforeEach(() => {
    scene = new Scene();
    system = new GmlBehaviorSystem();
  });

  it("fires the matching onCollideWith<Type> handler when two entities' AABBs overlap", () => {
    const hits: number[] = [];
    registerGmlBehavior("player", {
      onCollideWithEnemy: (_entity, other: { eid: number }) => {
        hits.push(other.eid);
      },
    } satisfies GmlBehaviorModule);

    const player = scene.spawn();
    player.add(GmlBehaviorState, { behaviorId: "player" });
    player.add(Transform, { x: 0, y: 0 });

    const enemy = scene.spawn();
    enemy.add(Transform, { x: 0, y: 0 }); // same position — guaranteed overlap
    enemy.add(Meta, { name: "Enemy" });

    system.update(scene, 1 / 60, { scene } as never);

    expect(hits).toEqual([enemy.eid]);

    unregisterGmlBehavior("player");
  });

  it("does not fire when the two entities' AABBs don't overlap", () => {
    let fired = false;
    registerGmlBehavior("player2", {
      onCollideWithEnemy: () => {
        fired = true;
      },
    } satisfies GmlBehaviorModule);

    const player = scene.spawn();
    player.add(GmlBehaviorState, { behaviorId: "player2" });
    player.add(Transform, { x: 0, y: 0 });

    const enemy = scene.spawn();
    // Fallback sprite half-extent is 16px each side, so 1000px away is nowhere close.
    enemy.add(Transform, { x: 1000, y: 1000 });
    enemy.add(Meta, { name: "Enemy" });

    system.update(scene, 1 / 60, { scene } as never);

    expect(fired).toBe(false);

    unregisterGmlBehavior("player2");
  });

  it("does not fire a handler for a type the other entity isn't — only the specifically-named handler fires", () => {
    let enemyFired = false;
    let npcFired = false;
    registerGmlBehavior("player3", {
      onCollideWithEnemy: () => {
        enemyFired = true;
      },
      onCollideWithNPC: () => {
        npcFired = true;
      },
    } satisfies GmlBehaviorModule);

    const player = scene.spawn();
    player.add(GmlBehaviorState, { behaviorId: "player3" });
    player.add(Transform, { x: 0, y: 0 });

    // Overlapping, but typed "NPC" — only onCollideWithNPC should fire.
    const npc = scene.spawn();
    npc.add(Transform, { x: 0, y: 0 });
    npc.add(Meta, { name: "NPC" });

    system.update(scene, 1 / 60, { scene } as never);

    expect(npcFired).toBe(true);
    expect(enemyFired).toBe(false);

    unregisterGmlBehavior("player3");
  });
});

describe("GmlBehaviorSystem — Draw GUI is camera-independent, Draw is not", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;

  beforeEach(async () => {
    pipeline = new RenderPipeline();
    await pipeline.init();
    scene = new Scene();
  });

  it("a camera transform on the world stage moves Draw output but leaves Draw GUI output untouched", () => {
    registerGmlBehavior("hud", {
      onDraw: (_entity, ctx) => {
        ctx.drawTarget?.setColor(0xff0000);
        ctx.drawTarget?.rect(10, 10, 20, 20, false);
      },
      onDrawGui: (_entity, ctx) => {
        ctx.drawTarget?.setColor(0x00ff00);
        ctx.drawTarget?.rect(5, 5, 15, 15, false);
      },
    } satisfies GmlBehaviorModule);

    const entity = scene.spawn();
    entity.add(GmlBehaviorState, { behaviorId: "hud" });

    const system = new GmlBehaviorSystem();
    pipeline.attachGmlBehaviors(system, { scene } as never);

    const camera = new CameraSystem();
    camera.attach(pipeline.stage);
    camera.snapTo(500, 500);
    camera.snapZoom(3);
    camera.update(0);

    pipeline.renderFrame(scene);

    // The world stage (what CameraSystem transforms) really moved.
    expect(pipeline.stage.x).not.toBe(0);
    expect(pipeline.stage.scale.x).toBe(3);

    // The gui layer is a sibling of `stage`, never a descendant — so it is
    // structurally impossible for CameraSystem's writes to `stage.x`/
    // `.scale` to have reached it.
    expect(pipeline.guiLayer.x).toBe(0);
    expect(pipeline.guiLayer.y).toBe(0);
    expect(pipeline.guiLayer.scale.x).toBe(1);
    expect(pipeline.guiLayer.parent).not.toBe(pipeline.stage);
    expect(pipeline.stage.children).not.toContain(pipeline.guiLayer);

    // A real Graphics node was drawn into the gui layer's subtree (possibly
    // nested under a per-layer container), never under the camera-affected
    // world stage.
    const guiHasGraphics = pipeline.guiLayer.children.length > 0;
    expect(guiHasGraphics).toBe(true);

    unregisterGmlBehavior("hud");
  });
});

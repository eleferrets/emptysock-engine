import { describe, expect, it, afterEach } from "vitest";
import { Game, defineScene } from "../Game.js";
import {
  PhysicsBody,
  getPhysicsBody,
  type PhysicsBodyHandle,
} from "../components/PhysicsBody.js";
import type { Entity } from "../Entity.js";
import { Scene } from "../Scene.js";
import { definePrefab } from "../Prefab.js";
import { Meta } from "../components/Meta.js";
import {
  GmlBehaviorState,
  registerGmlBehavior,
  unregisterGmlBehavior,
  type GmlBehaviorModule,
} from "../components/GmlBehavior.js";

/** No-`!` narrowing helper — `getPhysicsBody` is only `undefined` for a dead/componentless entity, never for the freshly-spawned ones these tests use. */
function mustGetPhysicsBody(entity: Entity): PhysicsBodyHandle {
  const handle = getPhysicsBody(entity);
  if (handle === undefined) {
    throw new Error("expected getPhysicsBody(entity) to return a handle");
  }
  return handle;
}

describe("ECS PhysicsSystem (ENGINE_DESIGN.md §6/§10.3)", () => {
  it("steps a dynamic body under gravity, syncing position back onto PhysicsBody", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: -10 } },
    });

    const entity = scene.spawn();
    entity.add(PhysicsBody, {
      type: "dynamic",
      shape: "circle",
      radius: 0.5,
      position: { x: 0, y: 10 },
    });

    for (let i = 0; i < 30; i++) game.update(1 / 60);

    const body = entity.get(PhysicsBody);
    expect(body).toBeDefined();
    expect(body?.position.y).toBeLessThan(10);
    expect(body?.velocity.y).toBeLessThan(0);
    expect(body?.bodyHandle).not.toBeNull();

    await game.unloadScene();
  });

  it("registers bodies spawned mid-scene, not just at load time", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: -10 } },
    });

    game.update(1 / 60); // one frame with nothing physical in the scene

    const entity = scene.spawn();
    entity.add(PhysicsBody, { type: "dynamic", position: { x: 0, y: 5 } });

    for (let i = 0; i < 30; i++) game.update(1 / 60);

    expect(entity.get(PhysicsBody)?.position.y).toBeLessThan(5);

    await game.unloadScene();
  });

  it("fires onCollisionEnter when a falling body lands on a static floor", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: -20 } },
    });

    const floor = scene.spawn();
    floor.add(PhysicsBody, {
      type: "static",
      shape: "box",
      width: 20,
      height: 1,
      position: { x: 0, y: 0 },
    });

    const ball = scene.spawn();
    ball.add(PhysicsBody, {
      type: "dynamic",
      shape: "circle",
      radius: 0.5,
      position: { x: 0, y: 2 },
      restitution: 0,
    });

    let collided = false;
    let otherEntity: unknown;
    const floorHandle = mustGetPhysicsBody(floor);
    floorHandle.onCollisionEnter = (other) => {
      collided = true;
      otherEntity = other;
    };

    for (let i = 0; i < 180; i++) game.update(1 / 60);

    expect(collided).toBe(true);
    // A fresh `Entity` handle is constructed per `scene.each` iteration
    // (ENGINE_DESIGN.md §21 — handles are cheap, not cached), so compare by
    // eid rather than object identity.
    expect((otherEntity as { eid: number }).eid).toBe(ball.eid);

    await game.unloadScene();
  });

  it("fires onSensorEnter (not onCollisionEnter) for a sensor body", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: -20 } },
    });

    const sensor = scene.spawn();
    sensor.add(PhysicsBody, {
      type: "static",
      shape: "box",
      width: 20,
      height: 1,
      position: { x: 0, y: 0 },
      isSensor: true,
    });

    const ball = scene.spawn();
    ball.add(PhysicsBody, {
      type: "dynamic",
      shape: "circle",
      radius: 0.5,
      position: { x: 0, y: 2 },
    });

    let sensorEntered = false;
    let collided = false;
    mustGetPhysicsBody(sensor).onSensorEnter = () => {
      sensorEntered = true;
    };
    mustGetPhysicsBody(sensor).onCollisionEnter = () => {
      collided = true;
    };

    for (let i = 0; i < 180; i++) game.update(1 / 60);

    expect(sensorEntered).toBe(true);
    expect(collided).toBe(false);

    await game.unloadScene();
  });

  describe("GML onCollideWith<Type> dispatch on real physics contact", () => {
    afterEach(() => {
      unregisterGmlBehavior("physics-floor");
    });

    it("fires the matching GML onCollideWith<Type> handler when attachGmlDispatch is wired, on real physics contact", async () => {
      const game = new Game();
      const { scene, physics } = await game.loadScene(defineScene({}), {
        physics: { gravity: { x: 0, y: -20 } },
      });
      physics.attachGmlDispatch({ scene } as never);

      const floor = scene.spawn();
      floor.add(PhysicsBody, {
        type: "static",
        shape: "box",
        width: 20,
        height: 1,
        position: { x: 0, y: 0 },
      });
      floor.add(GmlBehaviorState, { behaviorId: "physics-floor" });

      const hits: number[] = [];
      registerGmlBehavior("physics-floor", {
        onCollideWithBall: (_entity: unknown, other: { eid: number }) => {
          hits.push(other.eid);
        },
      } as GmlBehaviorModule);

      const ball = scene.spawn();
      ball.add(PhysicsBody, {
        type: "dynamic",
        shape: "circle",
        radius: 0.5,
        position: { x: 0, y: 2 },
        restitution: 0,
      });
      ball.add(Meta, { name: "Ball" });

      for (let i = 0; i < 180; i++) game.update(1 / 60);

      expect(hits).toEqual([ball.eid]);

      await game.unloadScene();
    });

    it("never dispatches GML collision handlers when attachGmlDispatch was never called", async () => {
      const game = new Game();
      const { scene } = await game.loadScene(defineScene({}), {
        physics: { gravity: { x: 0, y: -20 } },
      });

      const floor = scene.spawn();
      floor.add(PhysicsBody, {
        type: "static",
        shape: "box",
        width: 20,
        height: 1,
        position: { x: 0, y: 0 },
      });
      floor.add(GmlBehaviorState, { behaviorId: "physics-floor" });

      let fired = false;
      registerGmlBehavior("physics-floor", {
        onCollideWithBall: () => {
          fired = true;
        },
      } as GmlBehaviorModule);

      const ball = scene.spawn();
      ball.add(PhysicsBody, {
        type: "dynamic",
        shape: "circle",
        radius: 0.5,
        position: { x: 0, y: 2 },
        restitution: 0,
      });
      ball.add(Meta, { name: "Ball" });

      for (let i = 0; i < 180; i++) game.update(1 / 60);

      expect(fired).toBe(false);

      await game.unloadScene();
    });
  });

  it("exposes an interpolation alpha in [0, 1) and an interpolated transform", async () => {
    const game = new Game();
    const { scene, physics } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: -10 }, fixedTimestep: 1 / 50 },
    });

    const entity = scene.spawn();
    entity.add(PhysicsBody, { type: "dynamic", position: { x: 0, y: 10 } });

    // A dt that isn't a whole multiple of the fixed timestep leaves a
    // fractional remainder in the accumulator (ENGINE_DESIGN.md §10.3).
    game.update(1 / 60);

    expect(physics.interpolationAlpha).toBeGreaterThanOrEqual(0);
    expect(physics.interpolationAlpha).toBeLessThan(1);

    const interpolated = physics.getInterpolatedTransform(entity);
    expect(typeof interpolated.x).toBe("number");
    expect(typeof interpolated.y).toBe("number");

    await game.unloadScene();
  });

  it("PhysicsSystem is destroyed on scene unload — the world becomes unusable", async () => {
    const game = new Game();
    const { physics } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: -10 } },
    });

    expect(() => physics.world).not.toThrow();
    await game.unloadScene();
    expect(() => physics.world).toThrow();
  });

  it("callback properties on getPhysicsBody are the registration — no separate register call", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    const entity = scene.spawn();
    entity.add(PhysicsBody, { type: "dynamic" });

    const handle = mustGetPhysicsBody(entity);
    expect(handle.onCollisionEnter).toBeUndefined();

    const cb = (): void => {};
    handle.onCollisionEnter = cb;
    expect(mustGetPhysicsBody(entity).onCollisionEnter).toBe(cb);

    // Plain-data fields still read/write through the same handle.
    handle.velocity = { x: 5, y: 0 };
    expect(entity.get(PhysicsBody)?.velocity).toEqual({ x: 5, y: 0 });

    await game.unloadScene();
  });

  it("Bug 1 regression: a pooled entity reusing a destroyed slot does not inherit the old occupant's PhysicsBody callbacks or handle", () => {
    const scene = new Scene();
    const Bullet = definePrefab("Bullet", [
      { def: PhysicsBody, overrides: { type: "dynamic" } },
    ]);

    const a = scene.spawn(Bullet, undefined, { pool: true });
    const aRawId = a.rawId;

    let aCallbackFired = false;
    const aHandle = mustGetPhysicsBody(a);
    aHandle.onCollisionEnter = () => {
      aCallbackFired = true;
    };
    expect(aHandle.onCollisionEnter).toBeDefined();

    scene.destroy(a);

    // Reuse the same bitECS slot (pooled ids are deliberately not released —
    // CLAUDE.md's "Prefab pooling keeps a pooled entity bitECS-alive").
    const b = scene.spawn(Bullet, undefined, { pool: true });
    expect(b.rawId).toBe(aRawId);

    const bHandle = mustGetPhysicsBody(b);
    // B must start with no registered callback — not A's stale one.
    expect(bHandle.onCollisionEnter).toBeUndefined();

    // And B's handle must be a fresh Proxy, not the one still closed over
    // A's (now-stripped) component data.
    expect(bHandle).not.toBe(aHandle);

    // Firing A's old callback reference directly must not somehow still be
    // "live" for B — it was never called by anything, since the side-table
    // entry was cleared, not merely shadowed.
    expect(aCallbackFired).toBe(false);

    // B's handle correctly reads/writes B's own component data.
    bHandle.velocity = { x: 3, y: 0 };
    expect(b.get(PhysicsBody)?.velocity).toEqual({ x: 3, y: 0 });
  });
});

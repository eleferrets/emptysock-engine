import { describe, expect, it } from "vitest";
import { Game, defineScene } from "../Game.js";
import {
  QueryChannel,
  type EntitySummary,
  type NavMeshQuerySource,
} from "../bridge/QueryChannel.js";
import { PhysicsBody } from "../components/PhysicsBody.js";
import { Transform } from "../components/Transform.js";
import { Meta } from "../components/Meta.js";
import { ActorSystem } from "../ActorSystem.js";
import { Actor, type Message } from "../Actor.js";

describe("ECS QueryChannel", () => {
  it("answers entity/component queries against a live scene", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));

    const entity = scene.spawn();
    entity.add(Transform, { x: 3, y: 4 });

    const channel = new QueryChannel();
    channel.registerComponents(Transform, PhysicsBody);
    channel.attach(scene);

    const list = channel.handle({ kind: "listEntities" });
    expect(list.ok).toBe(true);
    if (!list.ok) throw new Error("expected ok");
    expect(list.data).toEqual([
      {
        entityId: entity.eid,
        components: ["Transform"],
        x: 3,
        y: 4,
        rotation: 0,
      },
    ]);

    const info = channel.handle({
      kind: "entityInfo",
      entityId: entity.eid,
    });
    expect(info.ok).toBe(true);
    if (!info.ok) throw new Error("expected ok");
    expect(info.data).toEqual({
      entityId: entity.eid,
      components: ["Transform"],
      x: 3,
      y: 4,
      rotation: 0,
    });

    const component = channel.handle({
      kind: "getComponent",
      entityId: entity.eid,
      component: "Transform",
    });
    expect(component.ok).toBe(true);
    if (!component.ok) throw new Error("expected ok");
    expect(component.data).toMatchObject({ x: 3, y: 4 });

    await game.unloadScene();
  });

  it("setComponent writes through to the same live proxy getComponent/listEntities read", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));

    const entity = scene.spawn();
    entity.add(Transform, { x: 3, y: 4 });

    const channel = new QueryChannel();
    channel.registerComponents(Transform);
    channel.attach(scene);

    const written = channel.handle({
      kind: "setComponent",
      entityId: entity.eid,
      component: "Transform",
      patch: { x: 99 },
    });
    expect(written.ok).toBe(true);
    if (!written.ok) throw new Error("expected ok");
    expect(written.data).toMatchObject({ x: 99, y: 4 });

    // The write is live on the entity itself, not just the channel's echo.
    expect(entity.get(Transform)?.x).toBe(99);

    const reread = channel.handle({
      kind: "getComponent",
      entityId: entity.eid,
      component: "Transform",
    });
    expect(reread.ok).toBe(true);
    if (!reread.ok) throw new Error("expected ok");
    expect(reread.data).toMatchObject({ x: 99, y: 4 });

    await game.unloadScene();
  });

  it("setComponent returns unknown-component/not-found the same way getComponent does", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const entity = scene.spawn();
    entity.add(Transform);

    const channel = new QueryChannel();
    channel.registerComponents(Transform);
    channel.attach(scene);

    expect(
      channel.handle({
        kind: "setComponent",
        entityId: entity.eid,
        component: "NotRegistered",
        patch: {},
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "unknown-component",
        message: expect.any(String) as string,
      },
    });

    expect(
      channel.handle({
        kind: "setComponent",
        entityId: 999,
        component: "Transform",
        patch: {},
      }),
    ).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) as string },
    });

    await game.unloadScene();
  });

  it("discovers components via componentRegistry without registerComponents() being called at all", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));

    const entity = scene.spawn();
    entity.add(Transform, { x: 7, y: 8 });

    const channel = new QueryChannel();
    // Deliberately no channel.registerComponents(...) call.
    channel.attach(scene);

    const list = channel.handle({ kind: "listEntities" });
    expect(list.ok).toBe(true);
    if (!list.ok) throw new Error("expected ok");
    expect(list.data).toEqual([
      {
        entityId: entity.eid,
        components: ["Transform"],
        x: 7,
        y: 8,
        rotation: 0,
      },
    ]);

    const component = channel.handle({
      kind: "getComponent",
      entityId: entity.eid,
      component: "Transform",
    });
    expect(component.ok).toBe(true);
    if (!component.ok) throw new Error("expected ok");
    expect(component.data).toMatchObject({ x: 7, y: 8 });

    await game.unloadScene();
  });

  it("includes Meta/Transform-derived fields when present, and omits them when absent", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));

    const named = scene.spawn();
    named.add(Transform, { x: 5, y: 6, rotation: 0.5 });
    named.add(Meta, { name: "Hero", tags: ["player", "controllable"] });

    const bare = scene.spawn();
    bare.add(Transform, { x: 1, y: 2 });

    const channel = new QueryChannel();
    channel.registerComponents(Transform, Meta);
    channel.attach(scene);

    const list = channel.handle({ kind: "listEntities" });
    expect(list.ok).toBe(true);
    if (!list.ok) throw new Error("expected ok");
    const summaries = list.data as EntitySummary[];
    const namedSummary = summaries.find((s) => s.entityId === named.eid);
    const bareSummary = summaries.find((s) => s.entityId === bare.eid);
    expect(namedSummary).toEqual({
      entityId: named.eid,
      components: expect.arrayContaining(["Transform", "Meta"]) as string[],
      name: "Hero",
      tags: ["player", "controllable"],
      active: true,
      x: 5,
      y: 6,
      rotation: 0.5,
    });
    expect(bareSummary).toEqual({
      entityId: bare.eid,
      components: ["Transform"],
      x: 1,
      y: 2,
      rotation: 0,
    });
    expect(bareSummary).not.toHaveProperty("name");
    expect(bareSummary).not.toHaveProperty("tags");

    const info = channel.handle({ kind: "entityInfo", entityId: named.eid });
    expect(info.ok).toBe(true);
    if (!info.ok) throw new Error("expected ok");
    expect(info.data).toEqual({
      entityId: named.eid,
      components: expect.arrayContaining(["Transform", "Meta"]) as string[],
      name: "Hero",
      tags: ["player", "controllable"],
      active: true,
      x: 5,
      y: 6,
      rotation: 0.5,
    });

    await game.unloadScene();
  });

  it("returns not-found for a dead entity id and unknown-component for an unregistered component", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const channel = new QueryChannel();
    channel.registerComponents(Transform);
    channel.attach(scene);

    const info = channel.handle({ kind: "entityInfo", entityId: 999 });
    expect(info).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) as string },
    });

    const entity = scene.spawn();
    entity.add(Transform);
    const unknown = channel.handle({
      kind: "getComponent",
      entityId: entity.eid,
      component: "NotRegistered",
    });
    expect(unknown).toEqual({
      ok: false,
      error: {
        code: "unknown-component",
        message: expect.any(String) as string,
      },
    });

    await game.unloadScene();
  });

  it("raycast2d hits a registered PhysicsBody with real Rapier data", async () => {
    const game = new Game();
    const { scene, physics } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    const wall = scene.spawn();
    wall.add(PhysicsBody, {
      type: "static",
      shape: "circle",
      radius: 1,
      position: { x: 10, y: 0 },
    });

    // Step once so PhysicsSystem registers the body with Rapier.
    game.update(1 / 60);

    const channel = new QueryChannel();
    channel.registerComponents(PhysicsBody);
    channel.attach(scene, physics);

    const result = channel.handle({
      kind: "raycast2d",
      origin: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
      maxToi: 100,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const hit = result.data as { entityId: number; toi: number } | null;
    expect(hit).not.toBeNull();
    expect(hit?.entityId).toBe(wall.eid);
    // Matches a direct Rapier query against the same world.
    const directHit = physics.raycast({ x: 0, y: 0 }, { x: 1, y: 0 }, 100);
    expect(directHit?.toi).toBeCloseTo(hit?.toi ?? -1);

    const miss = channel.handle({
      kind: "raycast2d",
      origin: { x: 0, y: 0 },
      direction: { x: -1, y: 0 },
      maxToi: 100,
    });
    expect(miss).toEqual({ ok: true, data: null });

    await game.unloadScene();
  });

  it("overlapCircle2d and bodyState2d report real Rapier state", async () => {
    const game = new Game();
    const { scene, physics } = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    const entity = scene.spawn();
    entity.add(PhysicsBody, {
      type: "dynamic",
      shape: "circle",
      radius: 1,
      position: { x: 0, y: 0 },
    });
    game.update(1 / 60);

    const channel = new QueryChannel();
    channel.registerComponents(PhysicsBody);
    channel.attach(scene, physics);

    const overlap = channel.handle({
      kind: "overlapCircle2d",
      center: { x: 0, y: 0 },
      radius: 2,
    });
    expect(overlap).toEqual({ ok: true, data: [entity.eid] });

    const bodyState = channel.handle({
      kind: "bodyState2d",
      entityId: entity.eid,
    });
    expect(bodyState.ok).toBe(true);
    if (!bodyState.ok) throw new Error("expected ok");
    expect(bodyState.data).toMatchObject({ type: "dynamic", isSensor: false });

    await game.unloadScene();
  });

  it("returns a clear no-live-instance error, never a fabricated empty result, when nothing is attached", () => {
    const channel = new QueryChannel();
    channel.registerComponents(Transform, PhysicsBody);

    for (const query of [
      { kind: "listEntities" as const },
      { kind: "entityInfo" as const, entityId: 0 },
      { kind: "getComponent" as const, entityId: 0, component: "Transform" },
      {
        kind: "raycast2d" as const,
        origin: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
      },
      {
        kind: "overlapCircle2d" as const,
        center: { x: 0, y: 0 },
        radius: 1,
      },
      { kind: "bodyState2d" as const, entityId: 0 },
    ]) {
      const result = channel.handle(query);
      expect(result).toEqual({
        ok: false,
        error: {
          code: "no-live-instance",
          message: expect.any(String) as string,
        },
      });
    }
  });

  it("returns a clear no-physics-world error for physics queries when the scene has no physics attached", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), {
      manageLifecycle: false,
    });

    const channel = new QueryChannel();
    channel.attach(scene); // no PhysicsSystem passed — mirrors an overlay with no physics.

    const raycast = channel.handle({
      kind: "raycast2d",
      origin: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
    });
    expect(raycast).toEqual({
      ok: false,
      error: {
        code: "no-physics-world",
        message: expect.any(String) as string,
      },
    });

    const overlap = channel.handle({
      kind: "overlapCircle2d",
      center: { x: 0, y: 0 },
      radius: 1,
    });
    expect(overlap).toEqual({
      ok: false,
      error: {
        code: "no-physics-world",
        message: expect.any(String) as string,
      },
    });
  });

  it("detach() makes every subsequent query fail with no-live-instance again", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const channel = new QueryChannel();
    channel.attach(scene);
    expect(channel.isLive).toBe(true);

    channel.detach();
    expect(channel.isLive).toBe(false);
    expect(channel.handle({ kind: "listEntities" })).toEqual({
      ok: false,
      error: {
        code: "no-live-instance",
        message: expect.any(String) as string,
      },
    });

    await game.unloadScene();
  });

  // --- createEntity -----------------------------------------------------

  it("createEntity spawns a bare entity, adds known components, tags via Meta, and lists skipped unknown component names", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const channel = new QueryChannel();
    channel.registerComponents(Transform);
    channel.attach(scene);

    const created = channel.handle({
      kind: "createEntity",
      tag: "player",
      components: ["Transform", "TotallyMadeUpComponent"],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("expected ok");
    const data = created.data as {
      entityId: number;
      tag?: string;
      components: string[];
      skipped: string[];
    };
    expect(data.tag).toBe("player");
    expect(data.components).toEqual(["Transform"]);
    expect(data.skipped).toEqual(["TotallyMadeUpComponent"]);

    const info = channel.handle({
      kind: "entityInfo",
      entityId: data.entityId,
    });
    expect(info.ok).toBe(true);
    if (!info.ok) throw new Error("expected ok");
    expect(info.data).toMatchObject({
      name: "player",
      tags: ["player"],
      components: expect.arrayContaining(["Transform", "Meta"]) as string[],
    });

    await game.unloadScene();
  });

  it("createEntity with no live instance answers no-live-instance", () => {
    const channel = new QueryChannel();
    expect(channel.handle({ kind: "createEntity" })).toEqual({
      ok: false,
      error: {
        code: "no-live-instance",
        message: expect.any(String) as string,
      },
    });
  });

  // --- ActorSystem queries -----------------------------------------------

  class EchoActor extends Actor {
    received: Message[] = [];
    receive(msg: Message): void {
      this.received.push(msg);
    }
  }

  it("actor queries relay against an attached ActorSystem", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const actors = new ActorSystem();
    const alice = new EchoActor("alice");
    const bob = new EchoActor("bob");
    actors.register(alice);
    actors.register(bob);

    const channel = new QueryChannel();
    channel.attach(scene, undefined, { actors });

    const list = channel.handle({ kind: "actorList" });
    expect(list).toEqual({ ok: true, data: ["alice", "bob"] });

    const sendOk = channel.handle({
      kind: "actorSendMessage",
      actorId: "alice",
      message: { type: "ping" },
    });
    expect(sendOk).toEqual({
      ok: true,
      data: { actorId: "alice", queued: true },
    });

    const inbox = channel.handle({
      kind: "actorInboxSize",
      actorId: "alice",
    });
    expect(inbox).toEqual({ ok: true, data: 1 });

    const sendUnknown = channel.handle({
      kind: "actorSendMessage",
      actorId: "carol",
      message: { type: "ping" },
    });
    expect(sendUnknown).toEqual({
      ok: false,
      error: { code: "not-found", message: expect.any(String) as string },
    });

    const broadcast = channel.handle({
      kind: "actorBroadcast",
      message: { type: "tick" },
    });
    expect(broadcast).toEqual({ ok: true, data: { delivered: 2 } });

    const bobInbox = channel.handle({
      kind: "actorInboxSize",
      actorId: "bob",
    });
    expect(bobInbox).toEqual({ ok: true, data: 1 });

    actors.destroy();
    await game.unloadScene();
  });

  it("actor queries answer no-actor-system when the scene is live but no ActorSystem was attached", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const channel = new QueryChannel();
    channel.attach(scene);

    expect(channel.handle({ kind: "actorList" })).toEqual({
      ok: false,
      error: { code: "no-actor-system", message: expect.any(String) as string },
    });
    expect(
      channel.handle({
        kind: "actorSendMessage",
        actorId: "alice",
        message: { type: "ping" },
      }),
    ).toEqual({
      ok: false,
      error: { code: "no-actor-system", message: expect.any(String) as string },
    });

    await game.unloadScene();
  });

  it("actor queries answer no-live-instance when nothing is attached at all", () => {
    const channel = new QueryChannel();
    expect(channel.handle({ kind: "actorList" })).toEqual({
      ok: false,
      error: {
        code: "no-live-instance",
        message: expect.any(String) as string,
      },
    });
  });

  // --- NavMesh queries -----------------------------------------------------

  function fakeNavMesh(): NavMeshQuerySource {
    return {
      findPath: (from, to) =>
        from.x === to.x && from.y === to.y ? [] : [from, { x: 0, y: 0 }, to],
      nearestNode: (point) => ({ x: point.x + 1, y: point.y }),
    };
  }

  it("navmesh queries relay against an attached NavMeshQuerySource", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const channel = new QueryChannel();
    channel.attach(scene, undefined, { navmesh: fakeNavMesh() });

    const found = channel.handle({
      kind: "navmeshFindPath",
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 },
    });
    expect(found).toEqual({
      ok: true,
      data: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    });

    const notFoundPath = channel.handle({
      kind: "navmeshFindPath",
      from: { x: 5, y: 5 },
      to: { x: 5, y: 5 },
    });
    expect(notFoundPath).toEqual({ ok: true, data: null });

    const nearest = channel.handle({
      kind: "navmeshNearestNode",
      point: { x: 2, y: 3 },
    });
    expect(nearest).toEqual({ ok: true, data: { x: 3, y: 3 } });

    await game.unloadScene();
  });

  it("navmesh queries answer no-navmesh when the scene is live but no navmesh was attached", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const channel = new QueryChannel();
    channel.attach(scene);

    expect(
      channel.handle({
        kind: "navmeshNearestNode",
        point: { x: 0, y: 0 },
      }),
    ).toEqual({
      ok: false,
      error: { code: "no-navmesh", message: expect.any(String) as string },
    });

    await game.unloadScene();
  });

  it("navmesh queries answer no-live-instance when nothing is attached at all", () => {
    const channel = new QueryChannel();
    expect(
      channel.handle({ kind: "navmeshNearestNode", point: { x: 0, y: 0 } }),
    ).toEqual({
      ok: false,
      error: {
        code: "no-live-instance",
        message: expect.any(String) as string,
      },
    });
  });
});

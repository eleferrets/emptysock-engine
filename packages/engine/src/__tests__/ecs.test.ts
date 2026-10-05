import { describe, expect, it } from "vitest";
import { defineComponent } from "../Component.js";
import { Scene } from "../Scene.js";

const Position = defineComponent("Position", () => ({ x: 0, y: 0 }));
const Velocity = defineComponent("Velocity", () => ({ x: 0, y: 0 }));

describe("ECS ECS core", () => {
  it("spawns an entity and adds/gets a component", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Position, { x: 10, y: 20 });

    const pos = entity.get(Position);
    expect(pos).toBeDefined();
    expect(pos?.x).toBe(10);
    expect(pos?.y).toBe(20);
  });

  it("uses component defaults for fields not overridden", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Position, { x: 5 });
    expect(entity.get(Position)?.y).toBe(0);
  });

  it("get() returns undefined for a component never added", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    expect(entity.get(Velocity)).toBeUndefined();
  });

  it("has() reflects component presence", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    expect(entity.has(Position)).toBe(false);
    entity.add(Position);
    expect(entity.has(Position)).toBe(true);
  });

  it("mutating the proxy writes back to the same component", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Position, { x: 1, y: 1 });
    const pos = entity.get(Position);
    if (pos === undefined) throw new Error("expected component");
    pos.x = 99;
    expect(entity.get(Position)?.x).toBe(99);
  });

  it("returns the exact same cached proxy object across repeated get() calls", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Position);
    const a = entity.get(Position);
    const b = entity.get(Position);
    expect(a).toBe(b);
  });

  it("does not share proxy identity across two different entities", () => {
    const scene = new Scene();
    const e1 = scene.spawn();
    const e2 = scene.spawn();
    e1.add(Position, { x: 1, y: 1 });
    e2.add(Position, { x: 2, y: 2 });
    expect(e1.get(Position)).not.toBe(e2.get(Position));
    expect(e1.get(Position)?.x).toBe(1);
    expect(e2.get(Position)?.x).toBe(2);
  });

  it("throws adding a component that's already present", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Position);
    expect(() => entity.add(Position)).toThrow();
  });

  it("remove() detaches the component and clears its cached proxy", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Position, { x: 1, y: 1 });
    entity.remove(Position);
    expect(entity.has(Position)).toBe(false);
    expect(entity.get(Position)).toBeUndefined();
  });

  it("scene.each() iterates every entity carrying all listed components", () => {
    const scene = new Scene();
    const a = scene.spawn();
    a.add(Position, { x: 1, y: 0 });
    a.add(Velocity, { x: 5, y: 0 });

    const b = scene.spawn();
    b.add(Position, { x: 100, y: 0 }); // no Velocity — should be excluded

    const c = scene.spawn();
    c.add(Position, { x: 2, y: 0 });
    c.add(Velocity, { x: 10, y: 0 });

    const seen: number[] = [];
    scene.each(Position, Velocity, (pos, vel) => {
      pos.x += vel.x;
      seen.push(pos.x);
    });

    expect(seen.sort((x, y) => x - y)).toEqual([6, 12]);
    expect(a.get(Position)?.x).toBe(6);
    expect(c.get(Position)?.x).toBe(12);
    expect(b.get(Position)?.x).toBe(100); // untouched
  });

  it("scene.each() hands back a usable Entity handle", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Position);

    let handleEid = -1;
    scene.each(Position, (_pos, e) => {
      handleEid = e.eid;
    });
    expect(handleEid).toBe(entity.eid);
  });

  it("scene.destroy() removes the entity from entityCount", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    expect(scene.entityCount).toBe(1);
    scene.destroy(entity);
    expect(scene.entityCount).toBe(0);
  });
});

describe("ECS entity versioning / stale handles", () => {
  it("marks a destroyed entity as not alive", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    expect(entity.isAlive).toBe(true);
    scene.destroy(entity);
    expect(entity.isAlive).toBe(false);
  });

  it("a stale handle's get() returns undefined, even for a component it used to have", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Position, { x: 42, y: 42 });
    scene.destroy(entity);
    expect(entity.get(Position)).toBeUndefined();
  });

  it("a stale handle's add() throws instead of silently mutating a recycled slot", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    scene.destroy(entity);
    expect(() => entity.add(Position)).toThrow();
  });

  it("a recycled entity id does not resolve a stale handle onto the new entity", () => {
    const scene = new Scene();
    const first = scene.spawn();
    first.add(Position, { x: 1, y: 1 });
    scene.destroy(first);

    // Spawn enough entities that bitECS's id-recycling reuses `first`'s slot.
    let recycledSameSlot: ReturnType<Scene["spawn"]> | null = null;
    for (let i = 0; i < 4; i++) {
      const next = scene.spawn();
      next.add(Position, { x: 999, y: 999 });
      if (next.rawId === first.rawId) {
        recycledSameSlot = next;
      }
    }

    // The old handle must still read as stale/dead even if its raw slot
    // was reused by a new entity — that new entity has a different,
    // higher version, so the old versioned id no longer matches it.
    expect(first.isAlive).toBe(false);
    expect(first.get(Position)).toBeUndefined();

    if (recycledSameSlot !== null) {
      expect(recycledSameSlot.isAlive).toBe(true);
      expect(recycledSameSlot.eid).not.toBe(first.eid);
      expect(recycledSameSlot.get(Position)?.x).toBe(999);
    }
  });
});

describe("ECS component registry — name-keyed identity survives hot-reload (§23.1)", () => {
  it("two separately-created ComponentDef objects with the same name share one storage backing", () => {
    const scene = new Scene();
    const PositionAgain = defineComponent("Position", () => ({ x: 0, y: 0 }));

    const entity = scene.spawn();
    entity.add(Position, { x: 7, y: 8 });

    // Simulates a hot-reloaded module re-calling defineComponent("Position", ...)
    // with a brand new object reference — it must see the same data.
    expect(entity.get(PositionAgain)?.x).toBe(7);
    expect(entity.has(PositionAgain)).toBe(true);
  });
});

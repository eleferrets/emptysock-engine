import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "../Component.js";
import { Scene } from "../Scene.js";
import { ServiceRegistry } from "../Services.js";
import { SaveSystem } from "../systems/SaveSystem.js";
import { MemoryStorageAdapter } from "../systems/StorageAdapter.js";

describe("ServiceRegistry", () => {
  class ScoreService {
    score = 0;
    add(n: number): void {
      this.score += n;
    }
  }

  it("register() constructs and stores an instance", () => {
    const services = new ServiceRegistry();
    const score = services.register(ScoreService);
    expect(score).toBeInstanceOf(ScoreService);
    expect(score.score).toBe(0);
  });

  it("get() returns the exact same instance register() produced", () => {
    const services = new ServiceRegistry();
    const registered = services.register(ScoreService);
    registered.add(10);

    const fetched = services.get(ScoreService);
    expect(fetched).toBe(registered);
    expect(fetched.score).toBe(10);
  });

  it("get() throws for a service never registered", () => {
    const services = new ServiceRegistry();
    expect(() => services.get(ScoreService)).toThrow();
  });

  it("has() reflects registration state", () => {
    const services = new ServiceRegistry();
    expect(services.has(ScoreService)).toBe(false);
    services.register(ScoreService);
    expect(services.has(ScoreService)).toBe(true);
  });

  it("re-registering the same class returns the existing instance, not a new one", () => {
    const services = new ServiceRegistry();
    const first = services.register(ScoreService);
    first.add(5);
    const second = services.register(ScoreService);
    expect(second).toBe(first);
    expect(second.score).toBe(5);
  });
});

const Position = defineComponent("SaveTestPosition", () => ({ x: 0, y: 0 }));
const Health = defineComponent("SaveTestHealth", () => ({ hp: 100 }), {
  version: 2,
});

describe("SaveSystem", () => {
  it("round-trips entity/component state through save + load into a fresh scene", async () => {
    const sceneA = new Scene();
    const adapter = new MemoryStorageAdapter();
    const saveA = new SaveSystem(sceneA, [Position, Health], { adapter });

    const player = sceneA.spawn();
    player.add(Position, { x: 10, y: 20 });
    player.add(Health, { hp: 42 });

    const npc = sceneA.spawn();
    npc.add(Position, { x: 1, y: 1 });

    await saveA.save("slot1");

    // "Reload": a brand new scene, brand new SaveSystem, same adapter/slot.
    const sceneB = new Scene();
    const saveB = new SaveSystem(sceneB, [Position, Health], { adapter });
    const loaded = await saveB.load("slot1");
    expect(loaded).toBe(true);

    expect(sceneB.entityCount).toBe(2);

    const positions: Array<{ x: number; y: number }> = [];
    sceneB.each(Position, (pos) => {
      positions.push({ x: pos.x, y: pos.y });
    });
    positions.sort((a, b) => a.x - b.x);
    expect(positions).toEqual([
      { x: 1, y: 1 },
      { x: 10, y: 20 },
    ]);

    let sawHealth = false;
    sceneB.each(Health, (health) => {
      sawHealth = true;
      expect(health.hp).toBe(42);
    });
    expect(sawHealth).toBe(true);
  });

  it("reports hasSave()/listSlots()/deleteSave() correctly", async () => {
    const scene = new Scene();
    const save = new SaveSystem(scene, [Position]);

    expect(await save.hasSave("a")).toBe(false);
    scene.spawn().add(Position, { x: 1, y: 2 });
    await save.save("a");

    expect(await save.hasSave("a")).toBe(true);
    expect(await save.listSlots()).toEqual(["a"]);

    await save.deleteSave("a");
    expect(await save.hasSave("a")).toBe(false);
  });

  it("load() on a slot that doesn't exist returns false and loads nothing", async () => {
    const scene = new Scene();
    const save = new SaveSystem(scene, [Position]);
    expect(await save.load("nope")).toBe(false);
    expect(scene.entityCount).toBe(0);
  });

  it("a version mismatch with a registered migrate() hook upgrades the data instead of dropping it", async () => {
    const HealthV1 = defineComponent("MigratedHealth", () => ({ hp: 100 }), {
      version: 1,
    });

    const sceneA = new Scene();
    const adapter = new MemoryStorageAdapter();
    const saveA = new SaveSystem(sceneA, [HealthV1], { adapter });
    sceneA.spawn().add(HealthV1, { hp: 7 });
    await saveA.save("migrate-slot");

    // "Current" version bumps the shape: hp -> current/max split.
    const HealthV2 = defineComponent(
      "MigratedHealth",
      () => ({ current: 100, max: 100 }),
      { version: 2 },
    );

    const sceneB = new Scene();
    const saveB = new SaveSystem(sceneB, [HealthV2], { adapter });
    saveB.registerMigration("MigratedHealth", (oldData, oldVersion) => {
      expect(oldVersion).toBe(1);
      const hp = oldData["hp"];
      return { current: hp, max: 100 };
    });

    const loaded = await saveB.load("migrate-slot");
    expect(loaded).toBe(true);

    let seen: { current: unknown; max: unknown } | null = null;
    sceneB.each(HealthV2, (health) => {
      seen = { current: health.current, max: health.max };
    });
    expect(seen).toEqual({ current: 7, max: 100 });
  });

  it("a version mismatch with no migrate() registered warns and drops just that component, without throwing", async () => {
    const StatsV1 = defineComponent("UnmigratedStats", () => ({ level: 1 }), {
      version: 1,
    });

    const sceneA = new Scene();
    const adapter = new MemoryStorageAdapter();
    const saveA = new SaveSystem(sceneA, [StatsV1, Position], { adapter });
    const entity = sceneA.spawn();
    entity.add(StatsV1, { level: 5 });
    entity.add(Position, { x: 3, y: 4 });
    await saveA.save("drop-slot");

    const StatsV2 = defineComponent(
      "UnmigratedStats",
      () => ({ level: 1, xp: 0 }),
      { version: 2 },
    );

    const sceneB = new Scene();
    const saveB = new SaveSystem(sceneB, [StatsV2, Position], { adapter });

    const loaded = await saveB.load("drop-slot");

    expect(loaded).toBe(true);
    // The whole load did not abort — the entity still exists...
    expect(sceneB.entityCount).toBeGreaterThan(0);

    // ...Position (unaffected by the mismatch) still made it through...
    let sawPosition = false;
    sceneB.each(Position, (pos) => {
      sawPosition = true;
      expect(pos.x).toBe(3);
    });
    expect(sawPosition).toBe(true);

    // ...but the mismatched component itself was dropped, not force-loaded
    // with stale/incompatible data.
    let sawStats = false;
    sceneB.each(StatsV2, () => {
      sawStats = true;
    });
    expect(sawStats).toBe(false);
  });

  it("drops unrecognized fields injected into a saved component's data, with a warning, loading the rest fine", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const adapter = new MemoryStorageAdapter();
      const sceneA = new Scene();
      const saveA = new SaveSystem(sceneA, [Position], { adapter });
      sceneA.spawn().add(Position, { x: 5, y: 6 });
      await saveA.save("corrupt-field-slot");

      // Simulate a hand-edited/corrupted save: inject an extra field into
      // the stored component's data that isn't part of Position's shape.
      const raw = await adapter.get("emptysock_save_corrupt-field-slot");
      expect(raw).not.toBeNull();
      const blob = JSON.parse(raw as string) as {
        entities: Array<{
          components: Record<
            string,
            { version: number; data: Record<string, unknown> }
          >;
        }>;
      };
      const positionData =
        blob.entities[0]?.components["SaveTestPosition"]?.data;
      expect(positionData).toBeDefined();
      if (positionData !== undefined) {
        positionData["evilField"] = "injected";
      }
      await adapter.set(
        "emptysock_save_corrupt-field-slot",
        JSON.stringify(blob),
      );

      const sceneB = new Scene();
      const saveB = new SaveSystem(sceneB, [Position], { adapter });
      const loaded = await saveB.load("corrupt-field-slot");
      expect(loaded).toBe(true);

      let seen: { x: number; y: number; evilField?: unknown } | null = null;
      sceneB.each(Position, (pos) => {
        seen = { x: pos.x, y: pos.y };
      });
      expect(seen).toEqual({ x: 5, y: 6 });
      expect(
        (seen as unknown as Record<string, unknown> | null)?.["evilField"],
      ).toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("evilField"),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("an unrecognized component name in a save is dropped with a warning, not a crash", async () => {
    const adapter = new MemoryStorageAdapter();
    const sceneA = new Scene();
    const saveA = new SaveSystem(sceneA, [Position], { adapter });
    sceneA.spawn().add(Position, { x: 9, y: 9 });
    await saveA.save("unknown-component-slot");

    // Load with a SaveSystem that doesn't know about "SaveTestPosition" at all.
    const Unrelated = defineComponent("SomethingElse", () => ({ n: 0 }));
    const sceneB = new Scene();
    const saveB = new SaveSystem(sceneB, [Unrelated], { adapter });

    const loaded = await saveB.load("unknown-component-slot");
    expect(loaded).toBe(true);
    expect(sceneB.entityCount).toBe(1);
  });
});

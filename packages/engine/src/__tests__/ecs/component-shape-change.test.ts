import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "../../ecs/Component.js";
import { Scene } from "../../ecs/Scene.js";

describe("ECS ComponentRegistry — hot-reload shape-change detection", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("same-shape hot-swap: entity data survives unchanged (regression guard)", () => {
    const scene = new Scene();
    const HealthV1 = defineComponent("Health", () => ({ hp: 10 }));
    const entity = scene.spawn();
    entity.add(HealthV1, { hp: 7 });

    // Simulate a code-only hot-swap: a brand new ComponentDef object, same
    // name, same field set — e.g. a tweaked method elsewhere in the module,
    // not a shape change.
    const HealthV1Reswapped = defineComponent("Health", () => ({ hp: 10 }));
    expect(entity.get(HealthV1Reswapped)?.hp).toBe(7);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("added field: affected entities are reset, others using a different component are untouched", () => {
    const scene = new Scene();
    const HealthV1 = defineComponent("Health", () => ({ hp: 10 }));
    const Velocity = defineComponent("Velocity", () => ({ x: 0, y: 0 }));

    const healthy = scene.spawn();
    healthy.add(HealthV1, { hp: 42 });

    const other = scene.spawn();
    other.add(Velocity, { x: 3, y: 4 });

    const HealthV2 = defineComponent("Health", () => ({ hp: 10, maxHp: 100 }));
    const reloaded = healthy.get(HealthV2);

    expect(reloaded?.hp).toBe(10); // reset to new default, old 42 is gone
    expect(reloaded?.maxHp).toBe(100); // new field present with its default
    expect((reloaded as Record<string, unknown>)["extra"]).toBeUndefined();

    // Entity using an unrelated component is completely unaffected.
    expect(other.get(Velocity)?.x).toBe(3);
    expect(other.get(Velocity)?.y).toBe(4);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain("Health");
    expect(message).toContain("maxHp");
    expect(message).toContain("1 entity");
  });

  it("removed field: affected entities are reset to the new (smaller) shape", () => {
    const scene = new Scene();
    const HealthV1 = defineComponent("Health", () => ({ hp: 10, maxHp: 100 }));
    const a = scene.spawn();
    a.add(HealthV1, { hp: 5, maxHp: 50 });
    const b = scene.spawn();
    b.add(HealthV1, { hp: 6, maxHp: 60 });

    const HealthV2 = defineComponent("Health", () => ({ hp: 10 }));
    const reloadedA = a.get(HealthV2);
    const reloadedB = b.get(HealthV2);

    expect(reloadedA?.hp).toBe(10);
    expect((reloadedA as Record<string, unknown>)["maxHp"]).toBeUndefined();
    expect(reloadedB?.hp).toBe(10);
    expect((reloadedB as Record<string, unknown>)["maxHp"]).toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain("Health");
    expect(message).toContain("removed maxHp");
    expect(message).toContain("2 entities");
  });

  it("does not reset entities that never had the changed component", () => {
    const scene = new Scene();
    const HealthV1 = defineComponent("Health", () => ({ hp: 10 }));
    const Velocity = defineComponent("Velocity", () => ({ x: 0, y: 0 }));

    scene.spawn().add(HealthV1, { hp: 1 });
    const velocityOnly = scene.spawn();
    velocityOnly.add(Velocity, { x: 9, y: 9 });

    const HealthV2 = defineComponent("Health", () => ({ hp: 10, shield: 0 }));
    // Trigger the shape-change path via ensure(), without touching
    // velocityOnly at all.
    scene.each(HealthV2, () => undefined);

    expect(velocityOnly.get(Velocity)?.x).toBe(9);
    expect(velocityOnly.get(Velocity)?.y).toBe(9);
    expect(velocityOnly.has(HealthV2)).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "../Component.js";
import { definePrefab, flattenPrefab } from "../Prefab.js";
import {
  loadSceneFile,
  migratePrefabFile,
  parsePrefabFile,
  parsePrefabFiles,
} from "../SceneFile.js";
import type { PrefabFile, PrefabFileV1 } from "../SceneFile.js";
import type { SceneFileV1 } from "../SceneMigrations.js";
import { Scene } from "../Scene.js";

const Transform = defineComponent("Transform", () => ({ x: 0, y: 0 }));
const Health = defineComponent("Health", () => ({ current: 10, max: 10 }));
const PhysicsBody = defineComponent("PhysicsBody", () => ({ mass: 1 }));

describe("ECS Prefab: definition + spawning", () => {
  it("spawns every component a prefab declares, with default + override values", () => {
    const scene = new Scene();
    const Enemy = definePrefab("Enemy", [
      { def: Transform, overrides: { x: 5 } },
      { def: Health, overrides: { max: 50 } },
    ]);

    const entity = scene.spawn(Enemy);

    expect(entity.has(Transform)).toBe(true);
    expect(entity.has(Health)).toBe(true);
    expect(entity.get(Transform)?.x).toBe(5);
    expect(entity.get(Transform)?.y).toBe(0); // untouched default
    expect(entity.get(Health)?.max).toBe(50);
    expect(entity.get(Health)?.current).toBe(10); // untouched default
  });

  it("applies flat spawn-time props over prefab defaults/overrides, matched by field name", () => {
    const scene = new Scene();
    const Enemy = definePrefab("Enemy", [
      { def: Transform, overrides: { x: 5 } },
    ]);

    const entity = scene.spawn(Enemy, { x: 100, y: 200 });

    expect(entity.get(Transform)?.x).toBe(100);
    expect(entity.get(Transform)?.y).toBe(200);
  });

  it("warns on an unmatched prop key (typo) but still applies the rest of a valid spawn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const scene = new Scene();
      const Enemy = definePrefab("Enemy", [{ def: Health }]);

      const entity = scene.spawn(Enemy, { max: 30, helth: 10 } as never);

      expect(entity.get(Health)?.max).toBe(30);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("helth"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Enemy"));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("rejects a non-serializable prop override", () => {
    const scene = new Scene();
    const Enemy = definePrefab("Enemy", [{ def: Transform }]);
    expect(() => scene.spawn(Enemy, { onHit: () => {} } as never)).toThrow();
  });
});

describe("ECS Prefab: nesting (prefabs containing prefabs)", () => {
  it("flattens a nested prefab's components onto the same entity", () => {
    const Physical = definePrefab("Physical", [
      { def: Transform },
      { def: PhysicsBody },
    ]);
    const Enemy = definePrefab(
      "Enemy",
      [{ def: Health, overrides: { max: 50 } }],
      { extends: [Physical] },
    );

    const scene = new Scene();
    const entity = scene.spawn(Enemy);

    expect(entity.has(Transform)).toBe(true);
    expect(entity.has(PhysicsBody)).toBe(true);
    expect(entity.has(Health)).toBe(true);
    expect(entity.get(Health)?.max).toBe(50);
  });

  it("lets a prefab's own overrides win over an extended prefab's, for a shared component", () => {
    const Physical = definePrefab("Physical", [
      { def: Transform, overrides: { x: 1, y: 1 } },
    ]);
    const Enemy = definePrefab(
      "Enemy",
      [{ def: Transform, overrides: { x: 9 } }],
      {
        extends: [Physical],
      },
    );

    const flattened = flattenPrefab(Enemy);
    const transformEntry = flattened.find((e) => e.def === Transform);
    expect(transformEntry?.overrides).toEqual({ x: 9, y: 1 });
  });
});

describe("ECS Prefab: pooling folded into spawn/destroy", () => {
  it("reuses the same underlying entity slot across destroy + pool-spawn, reset to defaults", () => {
    const Bullet = definePrefab("Bullet", [
      { def: Transform, overrides: { x: 0 } },
    ]);
    const scene = new Scene();

    const first = scene.spawn(Bullet, { x: 10 }, { pool: true });
    const firstRawId = first.rawId;
    expect(first.get(Transform)?.x).toBe(10);

    scene.destroy(first);
    // Note: a pooled entity stays bitECS-"alive" internally (that's what
    // reserves its id for reuse instead of handing it to an unrelated
    // spawn) — but it now carries no components at all, so it reads as a
    // blank slate to any code still holding the old handle.
    expect(first.has(Transform)).toBe(false);

    const second = scene.spawn(Bullet, { x: 99 }, { pool: true });
    expect(second.rawId).toBe(firstRawId);
    expect(second.get(Transform)?.x).toBe(99);
    expect(second.get(Transform)?.y).toBe(0); // reset to prefab default, not stale 10/y
  });

  it("destroy() is the same call for a pooled and a non-pooled entity", () => {
    const Bullet = definePrefab("Bullet", [{ def: Transform }]);
    const scene = new Scene();

    const pooled = scene.spawn(Bullet, undefined, { pool: true });
    const plain = scene.spawn(Bullet);

    expect(() => scene.destroy(pooled)).not.toThrow();
    expect(() => scene.destroy(plain)).not.toThrow();
    expect(plain.isAlive).toBe(false);
  });

  it("does not reuse a pooled slot for a differently-named prefab", () => {
    const Bullet = definePrefab("Bullet", [{ def: Transform }]);
    const Casing = definePrefab("Casing", [{ def: Transform }]);
    const scene = new Scene();

    const bullet = scene.spawn(Bullet, undefined, { pool: true });
    scene.destroy(bullet);

    const casing = scene.spawn(Casing, undefined, { pool: true });
    expect(casing.rawId).not.toBe(bullet.rawId);
  });
});

describe("ECS Prefab: JSON scene/prefab file format", () => {
  const registry: Record<
    string,
    typeof Transform | typeof Health | typeof PhysicsBody
  > = {
    Transform,
    Health,
    PhysicsBody,
  };
  const lookup = (name: string) => registry[name];

  it("loads a scene file's prefab instances and direct entities", () => {
    const enemyPrefabFile: PrefabFile = {
      prefabName: "Enemy",
      components: {
        Transform: { data: { x: 1 } },
        Health: { v: 1, data: { max: 30 } },
      },
    };
    const prefabs = parsePrefabFiles([enemyPrefabFile], lookup);

    const sceneFile: SceneFileV1 = {
      sceneName: "Level1",
      prefabInstances: [{ prefab: "Enemy", props: { x: 50 } }],
      entities: [
        { components: [{ component: "PhysicsBody", overrides: { mass: 5 } }] },
      ],
    };

    const scene = new Scene();
    const spawned = loadSceneFile(scene, sceneFile, lookup, prefabs);

    expect(spawned).toHaveLength(2);
    expect(spawned[0]?.get(Transform)?.x).toBe(50);
    expect(spawned[0]?.get(Health)?.max).toBe(30);
    expect(spawned[1]?.get(PhysicsBody)?.mass).toBe(5);
  });

  it("resolves prefab-file `extends` references regardless of array order", () => {
    const enemyFile: PrefabFile = {
      prefabName: "Enemy",
      components: { Health: { data: {} } },
      extends: ["Physical"],
    };
    const physicalFile: PrefabFile = {
      prefabName: "Physical",
      components: { Transform: { data: {} }, PhysicsBody: { data: {} } },
    };

    // Enemy listed before the Physical it extends — must still resolve.
    const prefabs = parsePrefabFiles([enemyFile, physicalFile], lookup);
    const enemy = prefabs.get("Enemy");
    expect(enemy).toBeDefined();
    if (enemy === undefined) throw new Error("unreachable");
    const componentNames = flattenPrefab(enemy)
      .map((e) => e.def.componentName)
      .sort();
    expect(componentNames).toEqual(["Health", "PhysicsBody", "Transform"]);
  });

  it("throws a useful error for an unknown component name", () => {
    const badFile: PrefabFile = {
      prefabName: "Broken",
      components: { DoesNotExist: { data: {} } },
    };
    expect(() => parsePrefabFiles([badFile], lookup)).toThrow(/DoesNotExist/);
  });

  it("migrates the legacy array shape on read and keeps key order", () => {
    const legacy: PrefabFileV1 = {
      prefabName: "Old",
      components: [
        { component: "Health", overrides: { max: 7 } },
        { component: "Transform" },
      ],
    };
    const migrated = migratePrefabFile(legacy);
    expect(migrated).toEqual({
      prefabName: "Old",
      components: {
        Health: { data: { max: 7 } },
        Transform: { data: {} },
      },
    });
    expect(Object.keys(migrated.components)).toEqual(["Health", "Transform"]);
    expect(migratePrefabFile(migrated)).toBe(migrated);
    const def = parsePrefabFile(legacy, lookup);
    expect(def.components.map((c) => c.def.componentName)).toEqual([
      "Health",
      "Transform",
    ]);
    expect(def.components[0]?.overrides).toEqual({ max: 7 });
  });
});

import { describe, expect, it } from "vitest";
import { defineComponent } from "../Component.js";
import { Meta } from "../components/Meta.js";
import { definePrefab } from "../Prefab.js";
import { Scene } from "../Scene.js";
import { loadSceneFile } from "../SceneFile.js";
import type { SceneDocument } from "../SceneDocument.js";

const Transform = defineComponent("Transform", () => ({ x: 0, y: 0 }));
const Health = defineComponent("Health", () => ({ current: 10, max: 10 }));
const defs = [Transform, Health, Meta];
const lookup = (n: string) => defs.find((d) => d.componentName === n);
const Enemy = definePrefab("Enemy", [
  { def: Transform, overrides: { x: 5 } },
  { def: Health, overrides: { max: 50 } },
]);
const prefabs = new Map([["Enemy", Enemy]]);

describe("loadSceneFile on a v2 SceneDocument", () => {
  it("spawns in array order, applies props then component overrides, and maps Meta fields", () => {
    const doc: SceneDocument = {
      formatVersion: 2,
      name: "L",
      entities: [
        {
          id: "boss",
          name: "BossEnemy",
          tags: ["big"],
          persistent: true,
          active: false,
          prefab: { name: "Enemy", props: { x: 100 } },
          components: {
            Health: { data: { max: 99 } },
            Meta: { data: { solid: true } },
          },
        },
        {
          id: "plain",
          components: { Transform: { data: { x: 1, y: 2 } } },
        },
        { id: "child", parent: "boss", prefab: { name: "Enemy" } },
      ],
    };
    const seen: (string | undefined)[] = [];
    const out = loadSceneFile(new Scene(), doc, lookup, prefabs, {
      onSpawned: (_e, se) => seen.push(se?.id),
    });
    expect(seen).toEqual(["boss", "plain", "child"]);
    const boss = out[0]!;
    expect(boss.get(Transform)?.x).toBe(100);
    expect(boss.get(Health)?.max).toBe(99);
    expect(boss.get(Meta)).toMatchObject({
      name: "BossEnemy",
      tags: ["big"],
      persistent: true,
      active: false,
      solid: true,
    });
    expect(out[1]!.has(Meta)).toBe(false);
    expect(out[1]!.get(Transform)?.y).toBe(2);
    // Unnamed prefab instance still gets the prefab name stamped.
    expect(out[2]!.get(Meta)?.name).toBe("Enemy");
  });

  it("rejects unknown prefabs, unknown components and invalid documents", () => {
    const base = { formatVersion: 2 as const, name: "L" };
    expect(() =>
      loadSceneFile(
        new Scene(),
        { ...base, entities: [{ id: "a", prefab: { name: "Nope" } }] },
        lookup,
        prefabs,
      ),
    ).toThrow(/unknown prefab "Nope"/);
    expect(() =>
      loadSceneFile(
        new Scene(),
        { ...base, entities: [{ id: "a", components: { Zzz: { data: {} } } }] },
        lookup,
        prefabs,
      ),
    ).toThrow(/unknown component "Zzz"/);
    expect(() =>
      loadSceneFile(
        new Scene(),
        { ...base, entities: [{ id: "a" }, { id: "a" }] },
        lookup,
        prefabs,
      ),
    ).toThrow(/duplicate/);
  });

  it("loads a v1 file identically to its migrated v2 form", () => {
    const v1 = {
      sceneName: "L",
      prefabInstances: [{ prefab: "Enemy", props: { x: 7 } }],
      entities: [
        { components: [{ component: "Transform", overrides: { y: 3 } }] },
      ],
    };
    const out = loadSceneFile(new Scene(), v1, lookup, prefabs);
    expect(out).toHaveLength(2);
    expect(out[0]!.get(Transform)?.x).toBe(7);
    expect(out[1]!.get(Transform)?.y).toBe(3);
  });
});

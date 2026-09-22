import { defineComponent } from "@emptysock/engine/ecs";
import type {
  ComponentDef,
  ComponentLookup,
  PrefabFile,
} from "@emptysock/engine/ecs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { generatePrefabTypes } from "../prefabCodegen.js";

const Transform = defineComponent("Transform", () => ({ x: 0, y: 0 }));
const Health = defineComponent("Health", () => ({ current: 10, max: 10 }));

const registry: Record<string, ComponentDef> = { Transform, Health };
const lookup: ComponentLookup = (name) => registry[name];

describe("generatePrefabTypes", () => {
  const enemyFile: PrefabFile = {
    prefabName: "EnemyPrefab",
    components: [{ component: "Transform" }, { component: "Health" }],
  };

  it("emits syntactically valid TypeScript", () => {
    const dts = generatePrefabTypes([enemyFile], lookup);
    const result = ts.transpileModule(dts, {
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    expect(result.diagnostics?.length ?? 0).toBe(0);
  });

  it("contains the expected prop names and types, merged from every component", () => {
    const dts = generatePrefabTypes([enemyFile], lookup);
    expect(dts).toContain("export declare const EnemyPrefab: PrefabDef<{");
    expect(dts).toContain('"x": number;');
    expect(dts).toContain('"y": number;');
    expect(dts).toContain('"current": number;');
    expect(dts).toContain('"max": number;');
    expect(dts).toContain(
      'import type { PrefabDef } from "@emptysock/engine/ecs";',
    );
  });

  it("merges an extended prefab's fields in too", () => {
    const physicalFile: PrefabFile = {
      prefabName: "Physical",
      components: [{ component: "Transform" }],
    };
    const enemyExtendsFile: PrefabFile = {
      prefabName: "Enemy",
      components: [{ component: "Health" }],
      extends: ["Physical"],
    };
    const dts = generatePrefabTypes([physicalFile, enemyExtendsFile], lookup);
    const enemyDecl = dts
      .split("\n\n")
      .find((chunk) => chunk.includes("const Enemy:"));
    expect(enemyDecl).toBeDefined();
    expect(enemyDecl).toContain('"x": number;');
    expect(enemyDecl).toContain('"current": number;');
  });

  it("sanitizes a non-identifier prefab name into a valid declaration name", () => {
    const weirdFile: PrefabFile = {
      prefabName: "3-legged-dog",
      components: [{ component: "Transform" }],
    };
    const dts = generatePrefabTypes([weirdFile], lookup);
    expect(dts).toMatch(/export declare const _3_legged_dog: PrefabDef</);
  });

  it("throws a useful error for an unregistered component", () => {
    const badFile: PrefabFile = {
      prefabName: "Broken",
      components: [{ component: "Nope" }],
    };
    expect(() => generatePrefabTypes([badFile], lookup)).toThrow(/Nope/);
  });
});

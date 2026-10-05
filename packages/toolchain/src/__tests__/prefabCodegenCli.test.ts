import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  findPrefabFiles,
  isComponentDef,
  runCodegenPrefabs,
} from "../prefabCodegenCli.js";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "es-codegen-prefabs-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("isComponentDef", () => {
  it("accepts an object with componentName + createDefaults", () => {
    expect(
      isComponentDef({
        componentName: "Transform",
        createDefaults: () => ({}),
      }),
    ).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isComponentDef(null)).toBe(false);
    expect(isComponentDef(undefined)).toBe(false);
    expect(isComponentDef(42)).toBe(false);
    expect(isComponentDef({ componentName: "Transform" })).toBe(false);
  });
});

describe("findPrefabFiles", () => {
  it("recursively finds *.prefab.json, skipping node_modules and dist", () => {
    fs.mkdirSync(path.join(dir, "prefabs"), { recursive: true });
    fs.mkdirSync(path.join(dir, "node_modules", "foo"), { recursive: true });
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true });
    fs.writeFileSync(path.join(dir, "prefabs", "Enemy.prefab.json"), "{}");
    fs.writeFileSync(
      path.join(dir, "node_modules", "foo", "Ignored.prefab.json"),
      "{}",
    );
    fs.writeFileSync(path.join(dir, "dist", "Ignored2.prefab.json"), "{}");
    fs.writeFileSync(path.join(dir, "prefabs", "Player.scene.json"), "{}");

    const found = findPrefabFiles(dir).sort();
    expect(found).toEqual(
      [path.join(dir, "prefabs", "Enemy.prefab.json")].sort(),
    );
  });

  it("returns an empty array when there are no prefab files", () => {
    expect(findPrefabFiles(dir)).toEqual([]);
  });
});

describe("runCodegenPrefabs", () => {
  it("writes a .d.ts using @emptysock/engine's own built-in components, with no --components needed", async () => {
    const prefabFile = {
      prefabName: "PlayerPrefab",
      components: { Transform: { data: {} } },
    };
    fs.writeFileSync(
      path.join(dir, "Player.prefab.json"),
      JSON.stringify(prefabFile),
    );

    const result = await runCodegenPrefabs(dir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prefabCount).toBe(1);
    expect(result.outPath).toBe(path.join(dir, "prefabs.generated.d.ts"));
    const written = fs.readFileSync(result.outPath, "utf8");
    expect(written).toContain("export declare const PlayerPrefab: PrefabDef<{");
    expect(written).toContain('"x": number;');
  });

  it("writes to a custom --out path", async () => {
    fs.writeFileSync(
      path.join(dir, "Player.prefab.json"),
      JSON.stringify({
        prefabName: "PlayerPrefab",
        components: { Transform: { data: {} } },
      }),
    );
    const outPath = path.join(dir, "generated", "out.d.ts");

    const result = await runCodegenPrefabs(dir, { out: outPath });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outPath).toBe(outPath);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it("returns ok with prefabCount 0 and writes nothing when there are no .prefab.json files", async () => {
    const result = await runCodegenPrefabs(dir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prefabCount).toBe(0);
    expect(fs.existsSync(path.join(dir, "prefabs.generated.d.ts"))).toBe(false);
  });

  it("returns ok: false with a useful error for an unregistered component", async () => {
    fs.writeFileSync(
      path.join(dir, "Broken.prefab.json"),
      JSON.stringify({
        prefabName: "Broken",
        components: { NopeNotRegistered: { data: {} } },
      }),
    );

    const result = await runCodegenPrefabs(dir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/NopeNotRegistered/);
  });

  it("merges ComponentDef exports from a --components module in addition to the engine's built-ins", async () => {
    fs.writeFileSync(
      path.join(dir, "Enemy.prefab.json"),
      JSON.stringify({
        prefabName: "EnemyPrefab",
        components: { Transform: { data: {} }, Health: { data: {} } },
      }),
    );
    const componentsModulePath = path.join(dir, "custom-components.mjs");
    fs.writeFileSync(
      componentsModulePath,
      [
        "export const Health = {",
        '  componentName: "Health",',
        "  createDefaults: () => ({ current: 10, max: 10 }),",
        "  version: 1,",
        "};",
      ].join("\n"),
    );

    const result = await runCodegenPrefabs(dir, {
      componentModules: [componentsModulePath],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const written = fs.readFileSync(result.outPath, "utf8");
    expect(written).toContain('"current": number;');
    expect(written).toContain('"max": number;');
  });
});

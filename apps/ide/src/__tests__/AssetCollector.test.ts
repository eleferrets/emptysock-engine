import { describe, it, expect } from "vitest";
import {
  collectReferencedAssetPaths,
  collectProjectAssets,
} from "../services/AssetCollector";
import type { FileStore } from "../services/AssetStore";
import type { AssetItem } from "../store/ideStore";

describe("collectReferencedAssetPaths", () => {
  it("finds image, audio, font and json literals across files", () => {
    const files = {
      "game.ts": `
        const hero = new Sprite({ texturePath: "assets/hero.png" });
        audio.play('assets/sfx/jump.wav');
        const nav = NavMeshSystem.load("levels/level1.json");
      `,
      "ui.ts": `
        const font = "assets/fonts/main.ttf";
      `,
    };
    const paths = collectReferencedAssetPaths(files);
    expect(paths).toEqual([
      "assets/fonts/main.ttf",
      "assets/hero.png",
      "assets/sfx/jump.wav",
      "levels/level1.json",
    ]);
  });

  it("deduplicates and strips a leading ./", () => {
    const files = {
      a: `"./assets/hero.png"`,
      b: `"assets/hero.png"`,
    };
    expect(collectReferencedAssetPaths(files)).toEqual(["assets/hero.png"]);
  });

  it("returns an empty array when nothing references an asset", () => {
    expect(collectReferencedAssetPaths({ "game.ts": "console.log(1);" })).toEqual(
      [],
    );
  });
});

function makeStore(files: Record<string, string>): FileStore {
  return {
    hasRoot: () => true,
    list: () => Promise.resolve([]),
    write: () => Promise.reject(new Error("not implemented")),
    delete: () => Promise.reject(new Error("not implemented")),
    read: (path: string) => {
      const content = files[path];
      if (content === undefined) {
        return Promise.reject(new Error(`Asset not found: ${path}`));
      }
      return Promise.resolve(new Blob([content]));
    },
  };
}

describe("collectProjectAssets", () => {
  it("reads every referenced path's real bytes", async () => {
    const store = makeStore({
      "assets/hero.png": "PNGDATA",
      "assets/sfx/jump.wav": "WAVDATA",
    });
    const result = await collectProjectAssets(
      ["assets/hero.png", "assets/sfx/jump.wav"],
      [],
      store,
    );
    expect(result.missing).toEqual([]);
    expect(result.assets.map((a) => a.path).sort()).toEqual([
      "assets/hero.png",
      "assets/sfx/jump.wav",
    ]);
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it("reports unreadable references as missing instead of throwing", async () => {
    const store = makeStore({ "assets/hero.png": "PNGDATA" });
    const result = await collectProjectAssets(
      ["assets/hero.png", "assets/ghost.png"],
      [],
      store,
    );
    expect(result.missing).toEqual(["assets/ghost.png"]);
    expect(result.assets.map((a) => a.path)).toEqual(["assets/hero.png"]);
  });

  it("also bundles registry assets not referenced in source (e.g. data loaded by id)", async () => {
    const store = makeStore({
      "assets/hero.png": "PNGDATA",
      "levels/level1.json": "{}",
    });
    const registry: AssetItem[] = [
      { id: "1", name: "level1.json", type: "json", path: "levels/level1.json" },
      { id: "2", name: "game.ts", type: "script", path: "game.ts" },
    ];
    const result = await collectProjectAssets(
      ["assets/hero.png"],
      registry,
      store,
    );
    const paths = result.assets.map((a) => a.path).sort();
    expect(paths).toEqual(["assets/hero.png", "levels/level1.json"]);
  });

  it("reports progress as it goes", async () => {
    const store = makeStore({ "a.png": "x", "b.png": "y" });
    const calls: Array<[number, number, number]> = [];
    await collectProjectAssets(["a.png", "b.png"], [], store, (done, total, bytes) =>
      calls.push([done, total, bytes]),
    );
    expect(calls).toEqual([
      [1, 2, 1],
      [2, 2, 2],
    ]);
  });
});

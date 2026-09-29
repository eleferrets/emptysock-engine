import { describe, it, expect, beforeEach } from "vitest";
import { AssetRegistry } from "../systems/AssetRegistry.js";
import { Game } from "../Game.js";

const index = {
  version: 1 as const,
  entries: [
    {
      kind: "sprite" as const,
      name: "spr_hero",
      id: "./assets/sprites/spr_hero/frame_0.png",
      width: 16,
      height: 24,
      frameCount: 4,
    },
    { kind: "object" as const, name: "obj_hero", id: "obj_hero" },
    { kind: "font" as const, name: "fnt_main", id: "fnt_main", size: 12 },
    { kind: "room" as const, name: "rm_a", id: "rm_a" },
    { kind: "sound" as const, name: "snd_a", id: "snd_a" },
    // cross-kind name collision
    { kind: "object" as const, name: "thing", id: "thing" },
    { kind: "script" as const, name: "thing", id: "thing" },
  ],
};

describe("AssetRegistry", () => {
  let reg: AssetRegistry;
  beforeEach(() => {
    reg = new AssetRegistry();
    reg.load(index);
  });

  it("exists/get per kind; unknown is false/undefined", () => {
    expect(reg.exists("sprite", "spr_hero")).toBe(true);
    expect(reg.exists("object", "obj_hero")).toBe(true);
    expect(reg.exists("font", "fnt_main")).toBe(true);
    expect(reg.exists("room", "rm_a")).toBe(true);
    expect(reg.exists("sound", "snd_a")).toBe(true);
    expect(reg.exists("sprite", "nope")).toBe(false);
    expect(reg.get("object", "nope")).toBeUndefined();
    expect(reg.exists("sprite", 42)).toBe(false);
    expect(reg.exists("object", "spr_hero")).toBe(false);
  });

  it("sprite lookup by name, frame_0 path and multi-frame path", () => {
    for (const ref of [
      "spr_hero",
      "./assets/sprites/spr_hero/frame_0.png",
      "./assets/sprites/spr_hero/frame_3.png",
    ]) {
      expect(reg.spriteSize(ref)).toEqual({ width: 16, height: 24 });
      expect(reg.frameCount(ref)).toBe(4);
    }
    expect(
      reg.spriteSize("./assets/sprites/other/frame_0.png"),
    ).toBeUndefined();
  });

  it("cross-kind collision: resolve reports both, exists stays kind-scoped", () => {
    expect(
      reg
        .resolve("thing")
        .map((e) => e.kind)
        .sort(),
    ).toEqual(["object", "script"]);
    expect(reg.exists("object", "thing")).toBe(true);
    expect(reg.exists("script", "thing")).toBe(true);
    expect(reg.exists("sprite", "thing")).toBe(false);
  });

  it("load replaces, clear empties, names lists a kind", () => {
    expect(reg.isEmpty).toBe(false);
    expect(reg.names("object").sort()).toEqual(["obj_hero", "thing"]);
    reg.load({ version: 1, entries: [{ kind: "room", name: "r", id: "r" }] });
    expect(reg.exists("sprite", "spr_hero")).toBe(false);
    expect(reg.exists("room", "r")).toBe(true);
    reg.clear();
    expect(reg.isEmpty).toBe(true);
  });

  it("register overwrites within a kind", () => {
    reg.register({ kind: "font", name: "fnt_main", id: "fnt_main", size: 20 });
    expect(reg.get("font", "fnt_main")?.size).toBe(20);
  });

  it("rejects an invalid index with a schema error", () => {
    expect(() =>
      reg.load({
        version: 1,
        entries: [{ kind: "bogus", name: "x", id: "x" }],
      }),
    ).toThrow();
    // failed load leaves prior contents intact
    expect(reg.exists("sprite", "spr_hero")).toBe(true);
  });

  it("is exposed as game.assets, one per Game", () => {
    const a = new Game();
    const b = new Game();
    a.assets.load(index);
    expect(a.assets.exists("sprite", "spr_hero")).toBe(true);
    expect(b.assets.isEmpty).toBe(true);
  });
});

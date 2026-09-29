import { describe, it, expect, vi } from "vitest";
import { AssetRegistry } from "../systems/AssetRegistry.js";
import { FontRegistry } from "../systems/FontRegistry.js";
import {
  sprite_get_width,
  sprite_get_height,
  sprite_exists,
  type GmlActionContext,
} from "../compat/gmlActions.js";
import {
  font_get_size,
  object_exists,
  asset_get_index,
} from "../compat/gml.js";

function reg(): AssetRegistry {
  const r = new AssetRegistry();
  r.load({
    version: 1,
    entries: [
      {
        kind: "sprite",
        name: "spr_a",
        id: "./assets/sprites/spr_a/frame_0.png",
        width: 32,
        height: 48,
        frameCount: 2,
      },
      { kind: "sprite", name: "spr_zero", id: "z", width: 0, height: 0 },
      { kind: "object", name: "obj_a", id: "obj_a" },
      { kind: "font", name: "fnt_a", id: "fnt_a", size: 18 },
    ],
  });
  return r;
}
const withAssets = (assets: AssetRegistry) =>
  ({ assets }) as unknown as GmlActionContext;
const bare = {} as unknown as GmlActionContext;
const PATH = "./assets/sprites/spr_a/frame_0.png";

describe("sprite_get_width / sprite_get_height / sprite_exists", () => {
  it("answer from ctx.assets by name and by texture path", () => {
    const ctx = withAssets(reg());
    expect(sprite_get_width(ctx, "spr_a")).toBe(32);
    expect(sprite_get_height(ctx, PATH)).toBe(48);
    expect(sprite_get_width(ctx, "./assets/sprites/spr_a/frame_1.png")).toBe(
      32,
    );
    expect(sprite_exists(ctx, PATH)).toBe(true);
    expect(sprite_exists(ctx, "spr_missing")).toBe(false);
    expect(sprite_get_width(ctx, "spr_missing")).toBe(0);
  });
  it("a zero-size sprite still exists", () => {
    const ctx = withAssets(reg());
    expect(sprite_get_width(ctx, "spr_zero")).toBe(0);
    expect(sprite_exists(ctx, "spr_zero")).toBe(true);
  });
  it("read through ctx.game.assets", () => {
    const ctx = { game: { assets: reg() } } as unknown as GmlActionContext;
    expect(sprite_get_height(ctx, "spr_a")).toBe(48);
  });
  it("without a registry keep 0/0/false and never throw", () => {
    expect(sprite_get_width(bare, "spr_a")).toBe(0);
    expect(sprite_get_height(bare, "spr_a")).toBe(0);
    expect(sprite_exists(bare, "spr_a")).toBe(false);
    expect(sprite_exists(withAssets(new AssetRegistry()), "spr_a")).toBe(false);
  });
});

describe("font_get_size", () => {
  it("uses the asset index", () => {
    expect(font_get_size(withAssets(reg()), "fnt_a")).toBe(18);
  });
  it("falls back to a hand-registered FontRegistry descriptor", () => {
    const fonts = new FontRegistry();
    fonts.register("fnt_h", {
      family: "X",
      size: 11,
      bold: false,
      italic: false,
    });
    const ctx = {
      game: { fonts, assets: new AssetRegistry() },
    } as unknown as GmlActionContext;
    expect(font_get_size(ctx, "fnt_h")).toBe(11);
  });
  it("is 0 with neither, unknown, or legacy one-arg", () => {
    expect(font_get_size(bare, "fnt_a")).toBe(0);
    expect(font_get_size(withAssets(reg()), "nope")).toBe(0);
    expect(font_get_size("fnt_a")).toBe(0);
  });
});

describe("object_exists / asset_get_index", () => {
  it("object_exists is truthful with a registry", () => {
    const ctx = withAssets(reg());
    expect(object_exists(ctx, "obj_a")).toBe(true);
    expect(object_exists(ctx, "obj_missing")).toBe(false);
    expect(object_exists(ctx, "spr_a")).toBe(false);
  });
  it("object_exists keeps warn+true without a registry", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(object_exists(bare, "x")).toBe(true);
    expect(object_exists("x")).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it("asset_get_index returns the id, or -1 when missing", () => {
    const ctx = withAssets(reg());
    expect(asset_get_index(ctx, "spr_a")).toBe(PATH);
    expect(asset_get_index(ctx, "obj_a")).toBe("obj_a");
    expect(asset_get_index(ctx, "nope")).toBe(-1);
  });
  it("asset_get_index is identity without a registry", () => {
    expect(asset_get_index(bare, "spr_a")).toBe("spr_a");
    expect(asset_get_index("spr_a")).toBe("spr_a");
  });
});

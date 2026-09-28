import { describe, it, expect, vi } from "vitest";
import { Texture } from "pixi.js";
import { TextureStore } from "../systems/TextureStore.js";

describe("TextureStore (custom loader seam)", () => {
  it("loads once, caches, and get() is sync after load", async () => {
    const loader = vi.fn(() => Promise.resolve(Texture.WHITE));
    const store = new TextureStore(loader);
    expect(store.get("a.png")).toBeUndefined();
    await store.load("a.png");
    expect(store.get("a.png")).toBe(Texture.WHITE);
    await store.load("a.png");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent loads of one path", async () => {
    const loader = vi.fn(() => Promise.resolve(Texture.WHITE));
    const store = new TextureStore(loader);
    await Promise.all([store.load("a.png"), store.load("a.png")]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("failed load is not cached and can be retried", async () => {
    const loader = vi
      .fn<(p: string) => Promise<Texture>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(Texture.WHITE);
    const store = new TextureStore(loader);
    await expect(store.load("a.png")).rejects.toThrow("boom");
    expect(store.get("a.png")).toBeUndefined();
    await store.load("a.png");
    expect(store.get("a.png")).toBe(Texture.WHITE);
  });

  it("clear() drops the local cache", async () => {
    const loader = vi.fn(() => Promise.resolve(Texture.WHITE));
    const store = new TextureStore(loader);
    await store.load("a.png");
    store.clear();
    expect(store.get("a.png")).toBeUndefined();
  });
});

describe("TextureStore (default, pixi Assets-backed)", () => {
  it("get() reads pixi's Assets cache synchronously and load() resolves from it", async () => {
    const { Assets } = await import("pixi.js");
    const store = new TextureStore();
    expect(store.get("ts-default-key")).toBeUndefined();
    Assets.cache.set("ts-default-key", Texture.WHITE);
    expect(store.get("ts-default-key")).toBe(Texture.WHITE);
    await expect(store.load("ts-default-key")).resolves.toBe(Texture.WHITE);
    Assets.cache.remove("ts-default-key");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pixi.js", () => {
  return {
    Assets: {
      load: vi.fn((path: string) => Promise.resolve({ __texture: path })),
    },
  };
});

vi.mock("howler", () => {
  const Howl = vi.fn().mockImplementation(function (this: unknown) {
    return {
      play: vi.fn().mockReturnValue(1),
      stop: vi.fn(),
      pause: vi.fn(),
      unload: vi.fn(),
    };
  });
  const Howler = { volume: vi.fn() };
  return { Howl, Howler };
});

import { Assets } from "pixi.js";
import { AssetManifest } from "../systems/AssetManifest.js";
import { AudioSystem } from "../systems/AudioSystem.js";

describe("AssetManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads texture assets via the default pixi.js Assets.load and caches by id", async () => {
    const manifest = new AssetManifest();
    manifest.add({ id: "player", path: "player.png", type: "texture" });

    const result = await manifest.load();

    expect(Assets.load).toHaveBeenCalledWith("player.png");
    expect(result.loaded).toEqual(["player"]);
    expect(result.failed).toEqual([]);
    expect(manifest.has("player")).toBe(true);
    expect(manifest.get("player")).toEqual({ __texture: "player.png" });
  });

  it("uses a custom textureLoader when provided", async () => {
    const customLoader = vi.fn().mockResolvedValue("custom-tex");
    const manifest = new AssetManifest({ textureLoader: customLoader });
    manifest.add({ id: "tile", path: "tile.png", type: "texture" });

    await manifest.load();

    expect(customLoader).toHaveBeenCalledWith("tile.png");
    expect(Assets.load).not.toHaveBeenCalled();
    expect(manifest.get("tile")).toBe("custom-tex");
  });

  it("warms AudioSystem's cache for audio assets so play() reuses the same Howl", async () => {
    const audio = new AudioSystem();
    const loadSpy = vi.spyOn(audio, "load");
    const manifest = new AssetManifest({ audioSystem: audio });
    manifest.add({ id: "jump", path: "jump.ogg", type: "audio" });

    await manifest.load();

    expect(loadSpy).toHaveBeenCalledWith("jump", "jump.ogg");
    expect(manifest.has("jump")).toBe(true);
    // The Howl registered by the manifest's warm-up is the same one AudioSystem.play() uses.
    audio.play("jump");
  });

  it("fails audio assets clearly when no AudioSystem is configured", async () => {
    const manifest = new AssetManifest();
    manifest.add({ id: "jump", path: "jump.ogg", type: "audio" });

    const result = await manifest.load();

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.id).toBe("jump");
  });

  it("loads json assets via the injected fetch implementation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hello: "world" }),
    });
    const manifest = new AssetManifest({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    manifest.add({ id: "config", path: "config.json", type: "json" });

    await manifest.load();

    expect(fetchImpl).toHaveBeenCalledWith("config.json");
    expect(manifest.get("config")).toEqual({ hello: "world" });
  });

  it("records a per-asset failure without aborting the rest of the batch", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(null),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

    const manifest = new AssetManifest({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    manifest.add({ id: "missing", path: "missing.json", type: "json" });
    manifest.add({ id: "present", path: "present.json", type: "json" });

    const result = await manifest.load();

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      id: "missing",
      path: "missing.json",
      type: "json",
    });
    expect(result.loaded).toEqual(["present"]);
    expect(manifest.has("present")).toBe(true);
    expect(manifest.has("missing")).toBe(false);
  });

  it("aborts on first failure when continueOnError is false", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve(null),
      });
    const manifest = new AssetManifest({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      continueOnError: false,
    });
    manifest.add({ id: "a", path: "a.json", type: "json" });
    manifest.add({ id: "b", path: "b.json", type: "json" });

    await expect(manifest.load()).rejects.toMatchObject({ id: "a" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports progress as loaded/total for every asset, in order", async () => {
    const manifest = new AssetManifest();
    manifest.add({ id: "a", path: "a.png", type: "texture" });
    manifest.add({ id: "b", path: "b.png", type: "texture" });
    manifest.add({ id: "c", path: "c.png", type: "texture" });

    const calls: Array<[number, number, string]> = [];
    manifest.onProgress((loaded, total, current) =>
      calls.push([loaded, total, current.id]),
    );

    await manifest.load();

    expect(calls).toEqual([
      [1, 3, "a"],
      [2, 3, "b"],
      [3, 3, "c"],
    ]);
  });

  it("onProgress returns an unsubscribe function", async () => {
    const manifest = new AssetManifest();
    manifest.add({ id: "a", path: "a.png", type: "texture" });

    const listener = vi.fn();
    const unsubscribe = manifest.onProgress(listener);
    unsubscribe();

    await manifest.load();

    expect(listener).not.toHaveBeenCalled();
  });

  it("addAll registers multiple descriptors and total reflects the count", () => {
    const manifest = new AssetManifest();
    manifest.addAll([
      { id: "a", path: "a.png", type: "texture" },
      { id: "b", path: "b.png", type: "texture" },
    ]);
    expect(manifest.total).toBe(2);
  });
});

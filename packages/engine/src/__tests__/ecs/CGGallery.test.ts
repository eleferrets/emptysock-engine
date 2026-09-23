import { describe, it, expect, beforeEach } from "vitest";
import { CGGallery } from "../../ecs/systems/CGGallery.js";
import { MemoryStorageAdapter } from "../../ecs/systems/StorageAdapter.js";

let gallery: CGGallery;
let adapter: MemoryStorageAdapter;

beforeEach(() => {
  adapter = new MemoryStorageAdapter();
  gallery = new CGGallery({
    entries: [
      { id: "cg1", imagePath: "cg1.png" },
      { id: "cg2", imagePath: "cg2.png" },
      { id: "cg3", imagePath: "cg3.png" },
    ],
  });
});

describe("CGGallery", () => {
  it("starts with nothing unlocked", () => {
    expect(gallery.unlockedCount).toBe(0);
    expect(gallery.totalCount).toBe(3);
    expect(gallery.isUnlocked("cg1")).toBe(false);
  });

  it("unlock() marks a CG unlocked and persists it", async () => {
    await gallery.unlock(adapter, "cg1");
    expect(gallery.isUnlocked("cg1")).toBe(true);
    expect(gallery.unlockedCount).toBe(1);
    expect(gallery.unlockedEntries.map((e) => e.id)).toEqual(["cg1"]);

    const raw = await adapter.get("emptysock_cg_gallery");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ cg1: true });
  });

  it("unlocking the same id twice is a no-op", async () => {
    await gallery.unlock(adapter, "cg1");
    await gallery.unlock(adapter, "cg1");
    expect(gallery.unlockedCount).toBe(1);
  });

  it("load() restores unlocked flags from a previous session's persisted data", async () => {
    await gallery.unlock(adapter, "cg1");
    await gallery.unlock(adapter, "cg2");

    const fresh = new CGGallery({
      entries: [
        { id: "cg1", imagePath: "cg1.png" },
        { id: "cg2", imagePath: "cg2.png" },
        { id: "cg3", imagePath: "cg3.png" },
      ],
    });
    await fresh.load(adapter);

    expect(fresh.isUnlocked("cg1")).toBe(true);
    expect(fresh.isUnlocked("cg2")).toBe(true);
    expect(fresh.isUnlocked("cg3")).toBe(false);
  });

  it("load() is a no-op when nothing was ever persisted", async () => {
    await gallery.load(adapter);
    expect(gallery.unlockedCount).toBe(0);
  });

  it("load() leaves the gallery untouched on malformed stored data", async () => {
    await adapter.set("emptysock_cg_gallery", "not json");
    await gallery.unlock(adapter, "cg1"); // real state before the bad load
    await adapter.set("emptysock_cg_gallery", "not json"); // corrupt it after
    await gallery.load(adapter);
    // load() failed to parse, so in-memory state (cg1 unlocked) is untouched.
    expect(gallery.isUnlocked("cg1")).toBe(true);
  });

  it("supports a custom storage key, keeping galleries independent", async () => {
    await gallery.unlock(adapter, "cg1", "route_a_gallery");
    const other = new CGGallery({
      entries: [{ id: "cg1", imagePath: "x.png" }],
    });
    await other.load(adapter, "route_b_gallery");
    expect(other.isUnlocked("cg1")).toBe(false);

    await other.load(adapter, "route_a_gallery");
    expect(other.isUnlocked("cg1")).toBe(true);
  });
});

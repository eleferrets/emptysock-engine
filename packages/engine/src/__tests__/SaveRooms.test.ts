import { describe, expect, it, vi } from "vitest";
import { Scene } from "../Scene.js";
import { defineComponent } from "../Component.js";
import { Meta } from "../components/Meta.js";
import { RoomStateCache } from "../RoomStateCache.js";
import {
  captureEntities,
  restoreEntities,
  type EntityExtra,
  type SceneSnapshot,
} from "../SceneTransfer.js";
import { SaveFormatError, SaveSystem } from "../systems/SaveSystem.js";
import { MemoryStorageAdapter } from "../systems/StorageAdapter.js";

const Crate = defineComponent("RoomCrate", () => ({ n: 0 }), { version: 2 });
const all = { select: () => true };

let noteTable = new Map<number, unknown>();
function noteExtra(version = 1, migrate?: EntityExtra["migrate"]): EntityExtra {
  return {
    name: "note",
    version,
    ...(migrate !== undefined ? { migrate } : {}),
    export: (e) => noteTable.get(e.eid),
    import: (e, data) => void noteTable.set(e.eid, data),
    clear: (_w, eid) => void noteTable.delete(eid),
  };
}

function cacheWith(value: unknown, n = 3): RoomStateCache {
  noteTable = new Map();
  const scene = new Scene();
  const e = scene.spawn();
  e.add(Meta, { persistent: false });
  e.add(Crate, { n });
  noteTable.set(e.eid, value);
  const cache = new RoomStateCache();
  cache.store("rm", captureEntities(scene, { ...all, extras: [noteExtra()] }));
  return cache;
}

function sys(
  adapter: MemoryStorageAdapter,
  rooms: RoomStateCache,
  extras: EntityExtra[],
  scene = new Scene(),
) {
  return new SaveSystem(scene, [], {
    adapter,
    rooms,
    extras,
    transferComponents: [Meta, Crate],
  });
}

describe("SaveSystem room cache", () => {
  it("round-trips a cached room with JSON-safe extras", async () => {
    const adapter = new MemoryStorageAdapter();
    await sys(adapter, cacheWith({ a: [1, 2] }), [noteExtra()]).save("s");

    const rooms = new RoomStateCache();
    const scene = new Scene();
    noteTable = new Map();
    await sys(adapter, rooms, [noteExtra()], scene).load("s");
    const snap = rooms.take("rm") as SceneSnapshot;
    restoreEntities(scene, snap, { ...all, extras: [noteExtra()] });
    let n = -1;
    scene.each(Crate, (c) => {
      n = c.n;
    });
    expect(n).toBe(3);
    expect([...noteTable.values()]).toEqual([{ a: [1, 2] }]);
  });

  it("warns and drops non-JSON extras, keeps the rest", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const adapter = new MemoryStorageAdapter();
    await sys(adapter, cacheWith(new Map([["k", 1]])), [noteExtra()]).save("s");
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("JSON-safe")),
    ).toBe(true);
    const rooms = new RoomStateCache();
    await sys(adapter, rooms, [noteExtra()]).load("s");
    const snap = rooms.take("rm") as SceneSnapshot;
    expect(snap.entities[0]?.extras).toEqual({});
    expect(snap.entities[0]?.components.length).toBe(2);
    warn.mockRestore();
  });

  it("migrates an older extra version, or drops it without a hook", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const adapter = new MemoryStorageAdapter();
    await sys(adapter, cacheWith({ v: 1 }), [noteExtra(1)]).save("s");

    const migrated = new RoomStateCache();
    await sys(adapter, migrated, [
      noteExtra(2, (d, from) => ({ ...(d as object), from })),
    ]).load("s");
    expect(migrated.peek("rm")?.entities[0]?.extras["note"]).toEqual({
      v: 1,
      from: 1,
    });

    const dropped = new RoomStateCache();
    await sys(adapter, dropped, [noteExtra(2)]).load("s");
    expect(dropped.peek("rm")?.entities[0]?.extras).toEqual({});
    warn.mockRestore();
  });

  it("old saves without rooms still load, newer formats still throw", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(
      "emptysock_save_old",
      JSON.stringify({ formatVersion: 2, entities: [] }),
    );
    const rooms = cacheWith({});
    expect(await sys(adapter, rooms, []).load("old")).toBe(true);
    expect(rooms.has("rm")).toBe(true);
    await adapter.set(
      "emptysock_save_new",
      JSON.stringify({ formatVersion: 3, entities: [] }),
    );
    await expect(sys(adapter, rooms, []).load("new")).rejects.toBeInstanceOf(
      SaveFormatError,
    );
  });

  it("saves and restores the in-flight carry", async () => {
    const adapter = new MemoryStorageAdapter();
    let held: SceneSnapshot | undefined = cacheWith({}).peek("rm");
    const slot = {
      get: () => held,
      set: (s: SceneSnapshot) => void (held = s),
    };
    const make = () =>
      new SaveSystem(new Scene(), [], {
        adapter,
        carried: slot,
        extras: [noteExtra()],
        transferComponents: [Meta, Crate],
      });
    await make().save("c");
    held = undefined;
    await make().load("c");
    expect(held).toBeDefined();
  });
});

import { describe, expect, it, vi } from "vitest";
import { Scene } from "../Scene.js";
import { defineComponent } from "../Component.js";
import {
  SaveFormatError,
  SaveSystem,
  SAVE_FORMAT_VERSION,
} from "../systems/SaveSystem.js";
import { MemoryStorageAdapter } from "../systems/StorageAdapter.js";
import { GlobalStore } from "../systems/GlobalStore.js";
import { VariableStore } from "../systems/VariableStore.js";

const Pos = defineComponent("SavePos", () => ({ x: 0, y: 0 }));
const Hp = defineComponent("SaveHp", () => ({ hp: 1 }), { version: 2 });

function count(scene: Scene): number {
  let n = 0;
  scene.each(Pos, () => {
    n += 1;
  });
  return n;
}

describe("SaveSystem format v2", () => {
  it("stamps formatVersion 2 with meta and orders entities by id", async () => {
    const adapter = new MemoryStorageAdapter();
    const scene = new Scene();
    const save = new SaveSystem(scene, [Pos, Hp], {
      adapter,
      gameVersion: "1.2.3",
      engineVersion: "0.2.0",
      room: () => "rm_a",
    });
    const a = scene.spawn();
    a.add(Hp, { hp: 5 });
    a.add(Pos, { x: 1 });
    scene.spawn().add(Pos, { x: 2 });
    await save.save("s");
    const blob = JSON.parse((await adapter.get("emptysock_save_s")) as string);
    expect(blob.formatVersion).toBe(SAVE_FORMAT_VERSION);
    expect(blob.meta).toMatchObject({
      gameVersion: "1.2.3",
      engineVersion: "0.2.0",
    });
    expect(typeof blob.meta.savedAt).toBe("number");
    expect(blob.room).toBe("rm_a");
    const ids = blob.entities.map((e: { id: number }) => e.id);
    expect(ids).toEqual([...ids].sort((x: number, y: number) => x - y));
    expect(await save.peek("s")).toMatchObject({
      formatVersion: 2,
      room: "rm_a",
    });
  });

  it("loads a v1 blob (no ids, meta or services)", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(
      "emptysock_save_old",
      JSON.stringify({
        formatVersion: 1,
        entities: [
          { components: { SavePos: { version: 1, data: { x: 7, y: 8 } } } },
        ],
      }),
    );
    const scene = new Scene();
    const globals = new GlobalStore();
    const save = new SaveSystem(scene, [Pos], { adapter, globals });
    expect(await save.load("old")).toBe(true);
    let x = 0;
    scene.each(Pos, (p) => {
      x = p.x;
    });
    expect(x).toBe(7);
    expect((await save.peek("old"))?.formatVersion).toBe(1);
  });

  it("refuses a newer formatVersion with a clear error and loads nothing", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(
      "emptysock_save_new",
      JSON.stringify({ formatVersion: 99, entities: [{ components: {} }] }),
    );
    const scene = new Scene();
    scene.spawn().add(Pos, { x: 1 });
    const save = new SaveSystem(scene, [Pos], { adapter });
    await expect(save.load("new")).rejects.toBeInstanceOf(SaveFormatError);
    await expect(save.load("new")).rejects.toThrow(/formatVersion 99.*up to 2/);
    await expect(save.peek("new")).rejects.toBeInstanceOf(SaveFormatError);
    expect(count(scene)).toBe(1); // untouched, not even cleared
  });

  it("replace (default) clears saved-type entities first; append keeps them", async () => {
    const adapter = new MemoryStorageAdapter();
    const src = new Scene();
    src.spawn().add(Pos, { x: 1 });
    await new SaveSystem(src, [Pos], { adapter }).save("s");

    const scene = new Scene();
    scene.spawn().add(Pos, { x: 50 });
    const save = new SaveSystem(scene, [Pos], { adapter });
    await save.load("s");
    expect(count(scene)).toBe(1);
    await save.load("s", { mode: "append" });
    expect(count(scene)).toBe(2);
  });

  it("round-trips globals (persist only), variables and room", async () => {
    const adapter = new MemoryStorageAdapter();
    const g1 = new GlobalStore();
    g1.declare("gold", { persist: true });
    g1.declare("tmp", {});
    g1.set("gold", 12);
    g1.set("tmp", 1);
    const v1 = new VariableStore();
    v1.setVar(3, 44);
    v1.setSwitch(2, true);
    const s1 = new Scene();
    await new SaveSystem(s1, [Pos], {
      adapter,
      globals: g1,
      variables: v1,
      room: () => "rm_b",
    }).save("s");

    const g2 = new GlobalStore();
    g2.declare("gold", { initial: 0, persist: true });
    g2.declare("tmp", { initial: 0 });
    const v2 = new VariableStore();
    const save2 = new SaveSystem(new Scene(), [Pos], {
      adapter,
      globals: g2,
      variables: v2,
    });
    await save2.load("s");
    expect(g2.get("gold")).toBe(12);
    expect(g2.get("tmp")).toBe(0);
    expect(v2.getVar(3)).toBe(44);
    expect(v2.getSwitch(2)).toBe(true);
    expect((await save2.peek("s"))?.room).toBe("rm_b");
  });

  it("component migrations still fire on load", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(
      "emptysock_save_m",
      JSON.stringify({
        formatVersion: 2,
        entities: [
          { id: 1, components: { SaveHp: { version: 1, data: { hp: 3 } } } },
        ],
      }),
    );
    const scene = new Scene();
    const save = new SaveSystem(scene, [Hp], { adapter });
    const migrate = vi.fn((d: Record<string, unknown>) => ({
      hp: (d["hp"] as number) * 10,
    }));
    save.registerMigration("SaveHp", migrate as never);
    await save.load("m");
    let hp = 0;
    scene.each(Hp, (h) => {
      hp = h.hp;
    });
    expect(migrate).toHaveBeenCalled();
    expect(hp).toBe(30);
  });
});

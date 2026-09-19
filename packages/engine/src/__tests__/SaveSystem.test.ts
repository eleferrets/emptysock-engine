import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { SaveSystem } from "../systems/SaveSystem.js";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string): string | null => store[key] ?? null,
  setItem: (key: string, val: string): void => {
    store[key] = val;
  },
  removeItem: (key: string): void => {
    delete store[key];
  },
  clear: (): void => {
    for (const k of Object.keys(store)) delete store[k];
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number): string | null => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("SaveSystem", () => {
  let sys: SaveSystem;

  beforeEach(() => {
    localStorageMock.clear();
    sys = new SaveSystem("test_save_");
  });

  it("save and load returns the slot", () => {
    sys.save("slot1", {
      scene: "GameScene",
      data: { hp: 50 },
      timestamp: 1000,
      playtime: 30,
    });
    const slot = sys.load("slot1");
    expect(slot).not.toBeNull();
    expect(slot?.scene).toBe("GameScene");
    expect(slot?.data["hp"]).toBe(50);
  });

  it("load returns null for missing slot", () => {
    expect(sys.load("nonexistent")).toBeNull();
  });

  it("listSlots returns all saved slots", () => {
    sys.save("a", { scene: "S1", data: {}, timestamp: 1, playtime: 0 });
    sys.save("b", { scene: "S2", data: {}, timestamp: 2, playtime: 10 });
    const slots = sys.listSlots();
    expect(slots.length).toBe(2);
  });

  it("delete removes slot", () => {
    sys.save("del", { scene: "X", data: {}, timestamp: 1, playtime: 0 });
    sys.delete("del");
    expect(sys.load("del")).toBeNull();
    expect(sys.listSlots().length).toBe(0);
  });

  it("defaults timestamp and playtime when omitted", () => {
    const before = Date.now();
    sys.save("minimal", { scene: "S1", data: { x: 1 } });
    const slot = sys.load("minimal");
    expect(slot).not.toBeNull();
    expect(slot?.timestamp).toBeGreaterThanOrEqual(before);
    expect(slot?.playtime).toBe(0);
  });

  it("rejects malformed data written directly to storage and drops it from listSlots", () => {
    localStorageMock.setItem(
      "test_save_corrupt",
      JSON.stringify({
        id: "corrupt",
        scene: "X" /* missing data/timestamp/playtime */,
      }),
    );
    expect(sys.load("corrupt")).toBeNull();
    expect(sys.listSlots()).toEqual([]);
  });

  it("rejects non-JSON garbage written directly to storage", () => {
    localStorageMock.setItem("test_save_garbage", "{not json");
    expect(sys.load("garbage")).toBeNull();
  });
});

describe("SaveSystem with a custom schema", () => {
  const CharacterSaveSchema = z.object({
    id: z.string(),
    characterName: z.string(),
    level: z.number().int().positive(),
    unlockedSkills: z.array(z.string()),
  });
  type CharacterSave = z.infer<typeof CharacterSaveSchema>;

  let sys: SaveSystem<CharacterSave>;

  beforeEach(() => {
    localStorageMock.clear();
    sys = new SaveSystem("char_save_", CharacterSaveSchema);
  });

  it("persists and loads a slot in the custom shape", () => {
    sys.save("hero1", {
      characterName: "Aria",
      level: 5,
      unlockedSkills: ["dash", "parry"],
    });
    const slot = sys.load("hero1");
    expect(slot).not.toBeNull();
    expect(slot?.characterName).toBe("Aria");
    expect(slot?.level).toBe(5);
    expect(slot?.unlockedSkills).toEqual(["dash", "parry"]);
    // The default GameSaveSlot fields are not silently injected for a custom schema.
    expect(slot).not.toHaveProperty("scene");
  });

  it("rejects data that violates the custom schema and does not persist it", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // level must be a positive int — this violates the schema
    sys.save("hero2", {
      characterName: "Borin",
      level: -1,
      unlockedSkills: [],
    });
    expect(sys.load("hero2")).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("listSlots only returns slots matching the custom schema", () => {
    sys.save("a", { characterName: "Aria", level: 1, unlockedSkills: [] });
    localStorageMock.setItem(
      "char_save_bad",
      JSON.stringify({ id: "bad", characterName: "X" }),
    ); // missing level/unlockedSkills
    const slots = sys.listSlots();
    expect(slots.length).toBe(1);
    expect(slots[0]?.characterName).toBe("Aria");
  });
});

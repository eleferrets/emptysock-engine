import { describe, expect, it } from "vitest";
import { Game } from "../Game.js";
import { KeyBindings } from "../systems/KeyBindings.js";
import { MemoryStorageAdapter } from "../systems/StorageAdapter.js";

function setup() {
  const game = new Game();
  const kb = new KeyBindings(game.input);
  const frame = () => {
    game.input.snapshot();
    kb.update();
  };
  return { game, kb, frame };
}

describe("KeyBindings", () => {
  it("binds, multi-code, unbinds and rebinds", () => {
    const { game, kb, frame } = setup();
    kb.bind("jump", "Space", "KeyW");
    expect(kb.getBindings("jump")).toEqual(["Space", "KeyW"]);
    game.input.simulateKeyDown("KeyW");
    frame();
    expect(kb.isActionDown("jump")).toBe(true);
    kb.unbind("jump", "KeyW");
    expect(kb.isActionDown("jump")).toBe(false);
    kb.rebind("jump", "KeyZ");
    expect(kb.getBindings("jump")).toEqual(["KeyZ"]);
    kb.unbind("jump");
    expect(kb.getBindings("jump")).toEqual([]);
  });

  it("detects press/release edges across frames", () => {
    const { game, kb, frame } = setup();
    kb.bind("fire", "KeyF");
    frame();
    expect(kb.wasActionPressed("fire")).toBe(false);
    game.input.simulateKeyDown("KeyF");
    frame();
    expect(kb.wasActionPressed("fire")).toBe(true);
    frame();
    expect(kb.wasActionPressed("fire")).toBe(false);
    expect(kb.isActionDown("fire")).toBe(true);
    game.input.simulateKeyUp("KeyF");
    frame();
    expect(kb.wasActionReleased("fire")).toBe(true);
    frame();
    expect(kb.wasActionReleased("fire")).toBe(false);
  });

  it("round-trips through a storage adapter", async () => {
    const { game } = setup();
    const storage = new MemoryStorageAdapter();
    const a = new KeyBindings(game.input, storage);
    a.bind("jump", "Space", "KeyW");
    await a.save();
    const b = new KeyBindings(game.input, storage);
    expect(await b.load()).toBe(true);
    expect(b.getBindings("jump")).toEqual(["Space", "KeyW"]);
  });

  it("falls back safely on missing or corrupt data", async () => {
    const { game } = setup();
    const storage = new MemoryStorageAdapter();
    const kb = new KeyBindings(game.input, storage);
    kb.bind("jump", "Space");
    expect(await kb.load()).toBe(false);
    await storage.set("settings/keybindings", "{not json");
    expect(await kb.load()).toBe(false);
    await storage.set("settings/keybindings", JSON.stringify({ jump: [1] }));
    expect(await kb.load()).toBe(false);
    expect(kb.getBindings("jump")).toEqual(["Space"]);
  });
});

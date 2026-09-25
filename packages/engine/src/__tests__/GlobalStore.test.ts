import { describe, expect, it } from "vitest";
import { GlobalStore } from "../systems/GlobalStore.js";
import { Game, defineScene } from "../Game.js";

describe("GlobalStore", () => {
  it("stores and retrieves arbitrarily-named, arbitrarily-typed values", () => {
    const store = new GlobalStore();
    store.set("hasgun", false);
    store.set("kills", 3);
    store.set("playerName", "Judas");
    store.set("checkpoint", { x: 10, y: 20 });

    expect(store.get("hasgun")).toBe(false);
    expect(store.get("kills")).toBe(3);
    expect(store.get("playerName")).toBe("Judas");
    expect(store.get("checkpoint")).toEqual({ x: 10, y: 20 });
  });

  it("does not truncate float values, unlike VariableStore", () => {
    const store = new GlobalStore();
    store.set("gain", 100.5);
    expect(store.get("gain")).toBe(100.5);
  });

  it("has/delete/keys/clear work as expected", () => {
    const store = new GlobalStore();
    expect(store.has("x")).toBe(false);
    store.set("x", 1);
    expect(store.has("x")).toBe(true);
    expect([...store.keys()]).toEqual(["x"]);
    store.delete("x");
    expect(store.has("x")).toBe(false);

    store.set("a", 1);
    store.set("b", 2);
    store.clear();
    expect([...store.keys()]).toEqual([]);
  });

  it("get() on an unset name returns undefined", () => {
    const store = new GlobalStore();
    expect(store.get("missing")).toBeUndefined();
  });

  it("is registered as a real Game service, reachable via game.globals and SceneLifecycle.globals", async () => {
    const game = new Game();
    const { globals } = await game.loadScene(defineScene({}));
    globals.set("score", 42);
    expect(game.globals.get("score")).toBe(42);
    expect(game.globals).toBe(globals);
    await game.unloadScene();
  });
});

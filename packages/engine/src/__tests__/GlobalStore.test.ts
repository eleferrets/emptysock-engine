import { describe, expect, it, vi } from "vitest";
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

describe("GlobalStore declarations", () => {
  it("declare sets a copy of initial only when the name is unset", () => {
    const store = new GlobalStore();
    const initial = { hp: 10 };
    store.declare("stats", { initial });
    expect(store.get("stats")).toEqual({ hp: 10 });
    (store.get("stats") as { hp: number }).hp = 1;
    expect(initial.hp).toBe(10);
    store.set("score", 5);
    store.declare("score", { initial: 0 });
    expect(store.get("score")).toBe(5);
    expect(store.declared()).toEqual(["stats", "score"]);
  });

  it("snapshot includes only persist:true names and drops non-serialisable values with a warning", () => {
    const store = new GlobalStore();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store.declare("gold", { initial: 3, persist: true });
    store.declare("temp", { initial: 1 });
    store.declare("fn", { persist: true });
    store.declare("map", { persist: true });
    store.declare("unset", { persist: true });
    store.set("fn", () => 1);
    store.set("map", new Map());
    store.set("undeclared", 9);
    expect(store.snapshot()).toEqual({ gold: 3 });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("restore applies declared persistent names and ignores the rest with a warning", () => {
    const store = new GlobalStore();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store.declare("gold", { initial: 0, persist: true });
    store.declare("temp", { initial: 0 });
    store.restore({ gold: 42, temp: 9, nope: 1 });
    expect(store.get("gold")).toBe(42);
    expect(store.get("temp")).toBe(0);
    expect(store.has("nope")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("reset drops every value and re-applies declared initials", () => {
    const store = new GlobalStore();
    store.declare("gold", { initial: 3, persist: true });
    store.declare("flag", {});
    store.set("gold", 99);
    store.set("flag", true);
    store.set("adhoc", 1);
    store.reset();
    expect(store.get("gold")).toBe(3);
    expect(store.has("flag")).toBe(false);
    expect(store.has("adhoc")).toBe(false);
    expect(store.declared()).toEqual(["gold", "flag"]);
  });
});

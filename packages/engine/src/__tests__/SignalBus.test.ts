import { describe, it, expect, vi } from "vitest";
import { SignalBus, Game } from "../index.js";

describe("SignalBus", () => {
  it("emits to listeners in order, once fires once, off removes", () => {
    const b = new SignalBus();
    const calls: string[] = [];
    b.on("a", () => calls.push("1"));
    b.once("a", () => calls.push("2"));
    b.emit("a");
    b.emit("a");
    expect(calls).toEqual(["1", "2", "1"]);
    expect(b.listenerCount("a")).toBe(1);
  });
  it("passes payload and name; wildcards see everything", () => {
    const b = new SignalBus();
    const fn = vi.fn();
    b.onAny(fn);
    b.emit("x", 5);
    expect(fn).toHaveBeenCalledWith(5, "x");
  });
  it("a throwing listener does not block others", () => {
    const b = new SignalBus();
    const ok = vi.fn();
    b.on("a", () => {
      throw new Error("boom");
    });
    b.on("a", ok);
    expect(() => b.emit("a")).toThrow(AggregateError);
    expect(ok).toHaveBeenCalled();
  });
  it("broadcast reaches every signal; group dispose unsubscribes", () => {
    const b = new SignalBus();
    const f = vi.fn();
    const g = b.group();
    g.on("a", f);
    g.on("b", f);
    expect(b.broadcast(1)).toBe(2);
    g.dispose();
    expect(b.listenerCount()).toBe(0);
  });
  it("is per-Game", () => {
    const g1 = new Game();
    const g2 = new Game();
    const f = vi.fn();
    g1.signals.on("s", f);
    g2.signals.emit("s");
    expect(f).not.toHaveBeenCalled();
  });
});

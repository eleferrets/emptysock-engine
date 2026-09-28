import { describe, it, expect } from "vitest";
import { GlobalStore } from "../index.js";

declare module "../systems/GlobalStore.js" {
  interface GameGlobals {
    typedScore: number;
  }
}

describe("GlobalStore typing", () => {
  it("typed keys round-trip and untyped names still work", () => {
    const g = new GlobalStore();
    g.set("typedScore", 5);
    const n: number | undefined = g.get("typedScore");
    expect(n).toBe(5);
    g.set("other", "x");
    expect(g.get<string>("other")).toBe("x");
  });
});

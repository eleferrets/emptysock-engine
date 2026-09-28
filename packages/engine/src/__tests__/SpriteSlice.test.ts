import { describe, it, expect } from "vitest";
import { Scene } from "../Scene.js";
import { Sprite } from "../components/Sprite.js";

describe("Sprite slice fields", () => {
  it("default to a plain, unsliced sprite", () => {
    const e = new Scene().spawn();
    e.add(Sprite);
    const s = e.get(Sprite);
    expect(s?.sliceMode).toBe(0);
    expect(s?.sliceLeft).toBe(0);
    expect(s?.sliceBottom).toBe(0);
  });

  it("accept nine-slice overrides", () => {
    const e = new Scene().spawn();
    e.add(Sprite, { sliceMode: 1, sliceLeft: 8, width: 100, height: 60 });
    expect(e.get(Sprite)?.sliceLeft).toBe(8);
    expect(e.get(Sprite)?.width).toBe(100);
  });
});

import { describe, it, expect } from "vitest";
import { Sprite } from "../components/Sprite.js";

describe("Sprite", () => {
  it("defaults to white, full alpha, centered anchor", () => {
    const s = new Sprite();
    expect(s.tint).toBe(0xffffff);
    expect(s.alpha).toBe(1);
    expect(s.anchorX).toBe(0.5);
    expect(s.anchorY).toBe(0.5);
    expect(s.texturePath).toBe("");
  });

  it("accepts constructor options", () => {
    const s = new Sprite({
      texturePath: "player.png",
      tint: 0xff0000,
      alpha: 0.5,
      anchorX: 0,
      anchorY: 1,
    });
    expect(s.texturePath).toBe("player.png");
    expect(s.tint).toBe(0xff0000);
    expect(s.alpha).toBe(0.5);
    expect(s.anchorX).toBe(0);
    expect(s.anchorY).toBe(1);
  });

  it("serialize includes tint and texturePath", () => {
    const s = new Sprite({ texturePath: "tile.png", tint: 0x00ff00 });
    const r = s.serialize();
    expect(r["texturePath"]).toBe("tile.png");
    expect(r["tint"]).toBe(0x00ff00);
    expect(r["type"]).toBe("Sprite");
  });
});

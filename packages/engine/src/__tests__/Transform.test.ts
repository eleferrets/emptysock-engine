import { describe, it, expect } from "vitest";
import { Transform } from "../components/Transform.js";

describe("Transform", () => {
  it("defaults to origin with scale 1", () => {
    const t = new Transform();
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
    expect(t.rotation).toBe(0);
    expect(t.scaleX).toBe(1);
    expect(t.scaleY).toBe(1);
  });

  it("accepts constructor options", () => {
    const t = new Transform({
      x: 10,
      y: 20,
      rotation: Math.PI,
      scaleX: 2,
      scaleY: 3,
    });
    expect(t.x).toBe(10);
    expect(t.y).toBe(20);
    expect(t.rotation).toBeCloseTo(Math.PI);
    expect(t.scaleX).toBe(2);
    expect(t.scaleY).toBe(3);
  });

  it("setPosition mutates x and y and returns this", () => {
    const t = new Transform();
    const ret = t.setPosition(5, 7);
    expect(ret).toBe(t);
    expect(t.x).toBe(5);
    expect(t.y).toBe(7);
  });

  it("translate moves by delta", () => {
    const t = new Transform({ x: 1, y: 2 });
    t.translate(3, 4);
    expect(t.x).toBe(4);
    expect(t.y).toBe(6);
  });

  it("serialize includes all fields", () => {
    const t = new Transform({
      x: 1,
      y: 2,
      rotation: 0.5,
      scaleX: 2,
      scaleY: 2,
    });
    const s = t.serialize();
    expect(s["x"]).toBe(1);
    expect(s["y"]).toBe(2);
    expect(s["scaleX"]).toBe(2);
    expect(s["type"]).toBe("Transform");
  });
});

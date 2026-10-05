import { describe, expect, it } from "vitest";
import { Scene } from "@emptysock/engine";
import { NetworkEntityMap } from "../NetworkEntityMap.js";

describe("NetworkEntityMap", () => {
  it("maps both ways and deletes from either side", () => {
    const scene = new Scene();
    const map = new NetworkEntityMap();
    const a = scene.spawn();
    map.set("p1", a);
    expect(map.getEntity("p1")).toBe(a);
    expect(map.getNetworkId(a)).toBe("p1");
    map.deleteByEntity(a);
    expect(map.size).toBe(0);
    expect(map.getNetworkId(a)).toBeUndefined();
  });

  it("does not hand a destroyed entity's network id to the entity that recycles its slot", () => {
    const scene = new Scene();
    const map = new NetworkEntityMap();
    const a = scene.spawn();
    map.set("p1", a);
    scene.destroy(a);
    const b = scene.spawn();
    expect(map.getNetworkId(b)).toBeUndefined();
  });

  it("removes the mapping of an entity that was already destroyed", () => {
    const scene = new Scene();
    const map = new NetworkEntityMap();
    const a = scene.spawn();
    map.set("p1", a);
    scene.destroy(a);
    map.deleteByEntity(a);
    expect(map.size).toBe(0);
    expect(map.getEntity("p1")).toBeUndefined();
  });
});

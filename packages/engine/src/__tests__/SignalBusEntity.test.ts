import { describe, it, expect, vi } from "vitest";
import {
  Scene,
  SignalBus,
  Game,
  defineScene,
  definePrefab,
  defineComponent,
} from "../index.js";

const Tag = defineComponent("SigEntTag", () => ({ n: 0 }));

describe("SignalBus.onEntity", () => {
  it("fires while alive and is removed when the entity is destroyed", () => {
    const bus = new SignalBus();
    const scene = new Scene();
    const e = scene.spawn();
    const fn = vi.fn();
    bus.onEntity(e, "hit", fn);
    bus.emit("hit", 1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount("hit")).toBe(1);
    scene.destroy(e);
    expect(bus.listenerCount("hit")).toBe(0);
    bus.emit("hit", 2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("early unsubscribe works and destroyed entities are rejected", () => {
    const bus = new SignalBus();
    const scene = new Scene();
    const e = scene.spawn();
    const fn = vi.fn();
    bus.onEntity(e, "x", fn)();
    bus.emit("x");
    expect(fn).not.toHaveBeenCalled();
    scene.destroy(e);
    expect(() => bus.onEntity(e, "x", fn)).toThrow();
  });

  it("a pooled entity's reuse does not inherit listeners", () => {
    const bus = new SignalBus();
    const scene = new Scene();
    const proto = definePrefab("SigPooled", [{ def: Tag }]);
    const a = scene.spawn(proto, undefined, { pool: true });
    const fn = vi.fn();
    bus.onEntity(a, "ping", fn);
    scene.destroy(a);
    const b = scene.spawn(proto, undefined, { pool: true });
    expect(b.eid).toBe(a.eid);
    bus.emit("ping");
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("Game entity signals", () => {
  it("emits entity:destroyed and entity:parented with refs", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), { headless: true });
    const destroyed = vi.fn();
    const parented = vi.fn();
    game.signals.on("entity:destroyed", destroyed);
    game.signals.on("entity:parented", parented);
    const p = scene.spawn();
    const c = scene.spawn();
    scene.setParent(c, p);
    expect(parented).toHaveBeenCalledWith(
      { child: c.ref(), parent: p.ref() },
      "entity:parented",
    );
    const ref = p.ref();
    const childRef = c.ref();
    scene.destroy(p);
    const refs = destroyed.mock.calls.map((call) => call[0].ref.$ref);
    expect(refs).toContain(ref.$ref);
    expect(refs).toContain(childRef.$ref); // cascaded child
  });
});

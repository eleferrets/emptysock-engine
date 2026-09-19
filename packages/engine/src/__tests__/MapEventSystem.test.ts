import { describe, it, expect, vi } from "vitest";
import {
  MapEventSystem,
  type EventCommand,
  type MapEvent,
} from "../systems/MapEventSystem.js";
import { VariableStore } from "../systems/VariableStore.js";

describe("MapEventSystem", () => {
  it("autorun event fires once", () => {
    const store = new VariableStore();
    const sys = new MapEventSystem(store);
    const handler = vi.fn();
    sys.setHandler(handler);
    sys.addEvent({
      id: "intro",
      tileX: 0,
      tileY: 0,
      trigger: "autorun",
      commands: [{ type: "show-dialogue", speaker: "Narrator", text: "Hi" }],
    });

    sys.update(5, 5, false);
    sys.update(5, 5, false);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("player-touch event fires when the player stands on its tile", () => {
    const store = new VariableStore();
    const sys = new MapEventSystem(store);
    const handler = vi.fn();
    sys.setHandler(handler);
    sys.addEvent({
      id: "sign",
      tileX: 3,
      tileY: 4,
      trigger: "player-touch",
      commands: [{ type: "show-dialogue", speaker: "Sign", text: "Read me" }],
    });

    sys.update(0, 0, false);
    expect(handler).not.toHaveBeenCalled();

    sys.update(3, 4, false);
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("MapEventSystem variable-gated conditionals", () => {
  it("a `when`-gated event does not fire while the condition is false", () => {
    const store = new VariableStore();
    store.setSwitch(10, false); // "bossDefeated" is false
    const sys = new MapEventSystem(store);
    const handler = vi.fn();
    sys.setHandler(handler);
    sys.addEvent({
      id: "gate-open",
      tileX: 1,
      tileY: 1,
      trigger: "autorun",
      when: { kind: "switch", index: 10, equals: true },
      commands: [
        { type: "show-dialogue", speaker: "Gate", text: "The gate opens." },
      ],
    });

    sys.update(1, 1, false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("a `when`-gated event fires once the condition becomes true", () => {
    const store = new VariableStore();
    store.setSwitch(10, false);
    const sys = new MapEventSystem(store);
    const handler = vi.fn();
    sys.setHandler(handler);
    sys.addEvent({
      id: "gate-open",
      tileX: 1,
      tileY: 1,
      trigger: "autorun",
      when: { kind: "switch", index: 10, equals: true },
      commands: [
        { type: "show-dialogue", speaker: "Gate", text: "The gate opens." },
      ],
    });

    sys.update(1, 1, false);
    expect(handler).not.toHaveBeenCalled();

    store.setSwitch(10, true);
    sys.update(1, 1, false);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("a `when`-gated event evaluates a variable comparison", () => {
    const store = new VariableStore();
    store.setVar(2, 3); // gold = 3
    const sys = new MapEventSystem(store);
    const handler = vi.fn();
    sys.setHandler(handler);
    sys.addEvent({
      id: "merchant",
      tileX: 0,
      tileY: 0,
      trigger: "player-touch",
      when: { kind: "variable", index: 2, op: "gte", value: 5 },
      commands: [
        {
          type: "show-dialogue",
          speaker: "Merchant",
          text: "Welcome, rich traveler.",
        },
      ],
    });

    sys.update(0, 0, false);
    expect(handler).not.toHaveBeenCalled();

    store.setVar(2, 5);
    sys.update(0, 0, false);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("set-variable and set-switch commands are applied to the VariableStore automatically", () => {
    const store = new VariableStore();
    const sys = new MapEventSystem(store);
    const handler = vi.fn();
    sys.setHandler(handler);
    const event: MapEvent = {
      id: "flag-quest",
      tileX: 0,
      tileY: 0,
      trigger: "autorun",
      commands: [
        { type: "set-switch", index: 10, value: true },
        { type: "set-variable", index: 2, value: 99 },
        { type: "show-dialogue", speaker: "Narrator", text: "Quest complete." },
      ],
    };
    sys.addEvent(event);

    sys.update(0, 0, false);

    expect(store.getSwitch(10)).toBe(true);
    expect(store.getVar(2)).toBe(99);
    // set-variable / set-switch are applied internally, not forwarded to the handler
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: "show-dialogue",
      speaker: "Narrator",
      text: "Quest complete.",
    });
  });

  it("an event unlocked by its own set-switch chain reacts on the next frame", () => {
    // Simulates a two-event level: event A sets a switch, event B is gated on it.
    const store = new VariableStore();
    const sys = new MapEventSystem(store);
    const handler = vi.fn();
    sys.setHandler(handler);

    sys.addEvent({
      id: "trigger",
      tileX: 0,
      tileY: 0,
      trigger: "player-touch",
      commands: [{ type: "set-switch", index: 20, value: true }],
    });
    sys.addEvent({
      id: "reveal",
      tileX: 5,
      tileY: 5,
      trigger: "autorun",
      when: { kind: "switch", index: 20, equals: true },
      commands: [
        {
          type: "show-dialogue",
          speaker: "Narrator",
          text: "A path appears.",
        } satisfies EventCommand,
      ],
    });

    sys.update(0, 0, false); // step on the trigger tile
    expect(handler).not.toHaveBeenCalled();

    sys.update(9, 9, false); // reveal's autorun should now be unlocked
    expect(handler).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { GamepadSystem } from "../systems/GamepadSystem.js";
import { InputManager, INPUT_BINDINGS_STORAGE_KEY } from "../Input.js";
import { Game, defineScene } from "../Game.js";
import { MemoryStorageAdapter } from "../systems/StorageAdapter.js";
import { PointerSystem } from "../systems/PointerSystem.js";

describe("ECS InputManager (ENGINE_DESIGN.md §4 step 1 / §15.3)", () => {
  it("isDown reflects an action bound to a key that is simulated down", () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.snapshot();
    expect(input.isDown("jump")).toBe(false);

    input.simulateKeyDown("Space");
    input.snapshot();
    expect(input.isDown("jump")).toBe(true);

    input.simulateKeyUp("Space");
    input.snapshot();
    expect(input.isDown("jump")).toBe(false);
  });

  it("an action with no bindings is never down", () => {
    const input = new InputManager();
    input.snapshot();
    expect(input.isDown("nonexistent")).toBe(false);
  });

  it("bindAction adds an action without clearing existing ones", () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.bindAction("left", [{ kind: "key", code: "ArrowLeft" }]);
    input.simulateKeyDown("Space");
    input.simulateKeyDown("ArrowLeft");
    input.snapshot();
    expect(input.isDown("jump")).toBe(true);
    expect(input.isDown("left")).toBe(true);
  });

  it("input is polled once and frozen for the frame: a mid-frame simulated key change is not observed until the next snapshot", () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.snapshot();
    expect(input.isDown("jump")).toBe(false);
    expect(input.keyboard.isDown("Space")).toBe(false);

    // Simulate a "device event arriving mid-frame" — must not affect any
    // read until the next explicit snapshot() call.
    input.simulateKeyDown("Space");
    expect(input.isDown("jump")).toBe(false);
    expect(input.keyboard.isDown("Space")).toBe(false);

    input.snapshot();
    expect(input.isDown("jump")).toBe(true);
    expect(input.keyboard.isDown("Space")).toBe(true);
  });

  it("raw keyboard escape hatch (input.keyboard) reads the frozen snapshot", () => {
    const input = new InputManager();
    input.simulateKeyDown("KeyW");
    input.snapshot();
    expect(input.keyboard.isDown("KeyW")).toBe(true);
    expect(input.keyboard.isDown("KeyS")).toBe(false);
  });

  it("raw gamepad escape hatch returns a disconnected snapshot when no pad is present", () => {
    const input = new InputManager();
    input.snapshot();
    const pad = input.gamepad(0);
    expect(pad.connected).toBe(false);
    expect(pad.isButtonDown(0)).toBe(false);
    expect(pad.axis(0)).toBe(0);
  });

  it("raw pointer/gesture/wheel escape hatches default to empty lists headless", () => {
    const input = new InputManager();
    input.snapshot();
    expect(input.pointers).toEqual([]);
    expect(input.gestures).toEqual([]);
    expect(input.wheelEvents).toEqual([]);
  });

  it("Game.update()'s step 1 snapshots input before onUpdate runs, and onUpdate sees a frozen value", async () => {
    const seenDuringUpdate: boolean[] = [];
    const game = new Game();
    await game.loadScene(
      defineScene({
        onUpdate() {
          seenDuringUpdate.push(game.input.isDown("jump"));
        },
      }),
      { physics: { gravity: { x: 0, y: 0 } } },
    );
    game.input.bindAction("jump", [{ kind: "key", code: "Space" }]);

    game.input.simulateKeyDown("Space");
    game.update(1 / 60); // snapshot happens as step 1, so onUpdate sees it as down
    expect(seenDuringUpdate).toEqual([true]);

    // Simulating mid-frame (after this frame's update already ran) must not
    // retroactively change what already happened, and must not be visible
    // until the *next* update()'s own step-1 snapshot.
    game.input.simulateKeyUp("Space");
    expect(game.input.isDown("jump")).toBe(true); // still last frame's frozen value
    game.update(1 / 60);
    expect(seenDuringUpdate).toEqual([true, false]);

    await game.unloadScene();
  });

  it("input persists across scene loads (game-owned, not scene-owned)", async () => {
    const game = new Game();
    game.input.bindAction("jump", [{ kind: "key", code: "Space" }]);
    game.input.simulateKeyDown("Space");

    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    game.update(1 / 60);
    expect(game.input.isDown("jump")).toBe(true);
    await game.unloadScene();
  });
});

// Covers rebind, reset-to-defaults, and save/load persistence scenarios,
// all living directly on `InputManager` per RELEASE_PASS.md's Track 1
// decision to fold named-action rebinding into the input layer rather than
// a second, parallel implementation.
describe("InputManager rebinding and persistence", () => {
  it("bindAction replaces the physical input for an action", () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.simulateKeyDown("KeyW");
    input.snapshot();
    expect(input.isDown("jump")).toBe(false);

    input.bindAction("jump", [{ kind: "key", code: "KeyW" }]);
    input.snapshot();
    expect(input.isDown("jump")).toBe(true);
  });

  it("resetToDefaults restores the bindings passed to the constructor", () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.bindAction("jump", [{ kind: "key", code: "KeyW" }]);
    expect(input.getBindings("jump")).toEqual([{ kind: "key", code: "KeyW" }]);

    input.resetToDefaults();
    expect(input.getBindings("jump")).toEqual([{ kind: "key", code: "Space" }]);
  });

  it("saveBindings/loadBindings round-trip rebinds through a StorageAdapter", async () => {
    const adapter = new MemoryStorageAdapter();
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    input.bindAction("jump", [{ kind: "key", code: "KeyW" }]);
    await input.saveBindings(adapter);

    const fresh = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    const loaded = await fresh.loadBindings(adapter);
    expect(loaded).toBe(true);
    expect(fresh.getBindings("jump")).toEqual([{ kind: "key", code: "KeyW" }]);
  });

  it("loadBindings returns false and leaves bindings untouched when nothing is stored", async () => {
    const adapter = new MemoryStorageAdapter();
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    const loaded = await input.loadBindings(adapter);
    expect(loaded).toBe(false);
    expect(input.getBindings("jump")).toEqual([{ kind: "key", code: "Space" }]);
  });
});

describe("InputManager merged remap API (ex-KeyBindings)", () => {
  const K = (code: string) => ({ kind: "key" as const, code });

  it("addBinding dedupes, unbind removes one binding or the whole action, rebind replaces", () => {
    const input = new InputManager({});
    input.addBinding("jump", K("Space"));
    input.addBinding("jump", K("KeyW"));
    input.addBinding("jump", K("Space"));
    expect(input.getBindings("jump")).toEqual([K("Space"), K("KeyW")]);
    input.unbind("jump", K("KeyW"));
    expect(input.getBindings("jump")).toEqual([K("Space")]);
    input.rebind("jump", [K("KeyZ")]);
    expect(input.getBindings("jump")).toEqual([K("KeyZ")]);
    input.unbind("jump");
    expect(input.actions).not.toContain("jump");
  });

  it("wasPressed/wasReleased fire for exactly one snapshot", () => {
    const input = new InputManager({ fire: [K("KeyF")] });
    input.snapshot();
    expect(input.wasPressed("fire")).toBe(false);
    input.simulateKeyDown("KeyF");
    input.snapshot();
    expect(input.wasPressed("fire")).toBe(true);
    input.snapshot();
    expect(input.wasPressed("fire")).toBe(false);
    expect(input.isDown("fire")).toBe(true);
    input.simulateKeyUp("KeyF");
    input.snapshot();
    expect(input.wasReleased("fire")).toBe(true);
    input.snapshot();
    expect(input.wasReleased("fire")).toBe(false);
  });

  it("gamepad axis bindings drive edges", () => {
    const input = new InputManager({
      left: [{ kind: "gamepadAxis", axis: 0, threshold: -0.5 }],
    });
    input.snapshot();
    expect(input.wasPressed("left")).toBe(false);
  });

  it("loadBindings rejects corrupt or malformed data and keeps current bindings", async () => {
    const adapter = new MemoryStorageAdapter();
    const input = new InputManager({ jump: [K("Space")] });
    await adapter.set(INPUT_BINDINGS_STORAGE_KEY, "{not json");
    expect(await input.loadBindings(adapter)).toBe(false);
    await adapter.set(
      INPUT_BINDINGS_STORAGE_KEY,
      JSON.stringify({ jump: [1] }),
    );
    expect(await input.loadBindings(adapter)).toBe(false);
    await adapter.set(
      INPUT_BINDINGS_STORAGE_KEY,
      JSON.stringify({ jump: [{ kind: "key", code: "KeyQ" }] }),
    );
    expect(await input.loadBindings(adapter)).toBe(true);
    expect(input.getBindings("jump")).toEqual([K("KeyQ")]);
  });
});

// PointerSystem integration — pointer/touch/gesture/wheel folded into the
// same frozen-per-frame snapshot as keyboard/gamepad, per RELEASE_PASS.md's
// Track 1 decision to wrap PointerSystem inside InputManager rather than
// leave it a disconnected system nothing feeds into the frozen snapshot.
describe("InputManager PointerSystem integration", () => {
  it("pointers reflects the frozen snapshot of PointerSystem.pointers, not live state", () => {
    const pointerSystem = new PointerSystem();
    const input = new InputManager({}, undefined, undefined, pointerSystem);
    pointerSystem.dispatchPointerDown({
      pointerId: 1,
      clientX: 10,
      clientY: 20,
      pointerType: "touch",
    });

    expect(input.pointers).toEqual([]); // not yet snapshotted
    input.snapshot();
    expect(input.pointers).toHaveLength(1);
    expect(input.pointers[0]).toMatchObject({ id: 1, x: 10, y: 20 });
  });

  it("gestures collects only the gestures that occurred since the previous snapshot", () => {
    const pointerSystem = new PointerSystem();
    const input = new InputManager({}, undefined, undefined, pointerSystem);

    pointerSystem.dispatchSafariGestureStart();
    pointerSystem.dispatchSafariGestureChange({
      scale: 1.5,
      clientX: 0,
      clientY: 0,
    });
    input.snapshot();
    expect(input.gestures).toHaveLength(1);
    expect(input.gestures[0]).toMatchObject({ type: "pinch", scale: 1.5 });

    // A second snapshot with no new gestures in between starts fresh.
    input.snapshot();
    expect(input.gestures).toEqual([]);
  });

  it("wheelEvents collects wheel/trackpad events since the previous snapshot", () => {
    const pointerSystem = new PointerSystem();
    const input = new InputManager({}, undefined, undefined, pointerSystem);

    pointerSystem.dispatchWheel({
      deltaX: 0,
      deltaY: -5,
      deltaMode: 0,
      ctrlKey: true,
    });
    input.snapshot();
    expect(input.wheelEvents).toHaveLength(1);
    expect(input.wheelEvents[0]?.isPinchZoom).toBe(true);
  });
});

describe("InputManager layout-aware bindings (Binding.char)", () => {
  const azerty = {
    charForCode: (c: string) =>
      (({ KeyQ: "a", KeyA: "q" }) as Record<string, string | undefined>)[c],
  };

  it("char binding follows the layout; code is the fallback", () => {
    const input = new InputManager({
      left: [{ kind: "key", code: "KeyA", char: "a" }],
    });
    input.layout.setProvider(azerty);
    input.simulateKeyDown("KeyQ");
    input.snapshot();
    expect(input.isDown("left")).toBe(true);
    input.simulateKeyUp("KeyQ");
    input.layout.setProvider(null);
    input.simulateKeyDown("KeyA");
    input.snapshot();
    expect(input.isDown("left")).toBe(true); // no layout knowledge: physical code
  });

  it("plain physical bindings ignore the layout", () => {
    const input = new InputManager({ left: [{ kind: "key", code: "KeyA" }] });
    input.layout.setProvider(azerty);
    input.simulateKeyDown("KeyQ");
    input.snapshot();
    expect(input.isDown("left")).toBe(false);
    input.simulateKeyDown("KeyA");
    input.snapshot();
    expect(input.isDown("left")).toBe(true);
  });

  it("isCharDown is layout-aware, isDown stays physical", () => {
    const input = new InputManager();
    input.layout.setProvider(azerty);
    input.simulateKeyDown("KeyQ");
    input.snapshot();
    expect(input.keyboard.isCharDown("a")).toBe(true);
    expect(input.keyboard.isCharDown("q")).toBe(false);
    expect(input.keyboard.isDown("KeyQ")).toBe(true);
    expect(input.keyboard.isCharDown("z")).toBe(false);
  });

  it("sameBinding distinguishes char: addBinding dedupes only identical", () => {
    const input = new InputManager();
    input.addBinding("a", { kind: "key", code: "KeyA" });
    input.addBinding("a", { kind: "key", code: "KeyA" });
    input.addBinding("a", { kind: "key", code: "KeyA", char: "a" });
    expect(input.getBindings("a")).toHaveLength(2);
  });

  it("bindingLabel follows the layout and names pad inputs", () => {
    const input = new InputManager();
    input.layout.setProvider(azerty);
    expect(input.bindingLabel({ kind: "key", code: "KeyA", char: "a" })).toBe(
      "A",
    );
    expect(input.bindingLabel({ kind: "key", code: "KeyA" })).toBe("Q");
    expect(input.bindingLabel({ kind: "key", code: "Space" })).toBe("Space");
    expect(input.bindingLabel({ kind: "gamepadButton", index: 0 })).toBe(
      "Pad A",
    );
    expect(
      input.bindingLabel({ kind: "gamepadAxis", axis: 1, threshold: -0.5 }),
    ).toBe("Axis 1-");
  });

  it("save/load round-trips char and old saves without char still load", async () => {
    const store = new MemoryStorageAdapter();
    const a = new InputManager({
      l: [{ kind: "key", code: "KeyA", char: "a" }],
    });
    await a.saveBindings(store);
    const b = new InputManager();
    expect(await b.loadBindings(store)).toBe(true);
    expect(b.getBindings("l")).toEqual([
      { kind: "key", code: "KeyA", char: "a" },
    ]);

    await store.set(
      "old",
      JSON.stringify({ l: [{ kind: "key", code: "KeyA" }] }),
    );
    const c = new InputManager();
    expect(await c.loadBindings(store, "old")).toBe(true);
    expect(c.getBindings("l")).toEqual([{ kind: "key", code: "KeyA" }]);

    await store.set(
      "bad",
      JSON.stringify({ l: [{ kind: "key", code: "KeyA", char: 5 }] }),
    );
    expect(await new InputManager().loadBindings(store, "bad")).toBe(false);
  });
});

describe("InputManager.captureNext / rebindByCapture", () => {
  function padInput(actions = {}) {
    let state: {
      connected: boolean;
      buttons: boolean[];
      axes: number[];
    } | null = null;
    const fakePad = {
      update: () => {},
      getState: (i: number) => (i === 0 ? state : null),
    } as unknown as GamepadSystem;
    const input = new InputManager(actions, undefined, fakePad);
    return {
      input,
      setPad: (s: typeof state) => {
        state = s;
      },
    };
  }

  it("resolves with the first new key press after arming", async () => {
    const input = new InputManager();
    const p = input.captureNext();
    input.snapshot(); // arms
    input.simulateKeyDown("KeyX");
    input.snapshot();
    const r = await p;
    expect(r?.binding).toEqual({ kind: "key", code: "KeyX" });
    expect(r?.label).toBe("X");
  });

  it("ignores keys already held at arm time until released and pressed again", async () => {
    const input = new InputManager();
    input.simulateKeyDown("KeyZ");
    const p = input.captureNext();
    input.snapshot(); // arms with Z held
    input.snapshot();
    input.simulateKeyUp("KeyZ");
    input.snapshot();
    input.simulateKeyDown("KeyZ");
    input.snapshot();
    expect((await p)?.binding).toEqual({ kind: "key", code: "KeyZ" });
  });

  it("swallows the captured press so a bound action does not fire", async () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    const p = input.captureNext();
    input.snapshot();
    input.simulateKeyDown("Space");
    input.snapshot();
    await p;
    expect(input.isDown("jump")).toBe(false);
    expect(input.keyboard.isDown("Space")).toBe(false);
    expect(input.wasPressed("jump")).toBe(false);
    input.snapshot();
    expect(input.isDown("jump")).toBe(false); // still held, still hidden
    input.simulateKeyUp("Space");
    input.snapshot();
    input.simulateKeyDown("Space");
    input.snapshot();
    expect(input.isDown("jump")).toBe(true); // released, so live again
  });

  it("Escape cancels to null and is swallowed", async () => {
    const input = new InputManager({ menu: [{ kind: "key", code: "Escape" }] });
    const p = input.captureNext();
    input.snapshot();
    input.simulateKeyDown("Escape");
    input.snapshot();
    expect(await p).toBeNull();
    expect(input.isDown("menu")).toBe(false);
  });

  it("modifiers alone are not accepted unless allowModifiers", async () => {
    const input = new InputManager();
    const p = input.captureNext();
    input.snapshot();
    input.simulateKeyDown("ShiftLeft");
    input.snapshot();
    input.simulateKeyDown("KeyB");
    input.snapshot();
    expect((await p)?.binding).toEqual({ kind: "key", code: "KeyB" });

    const i2 = new InputManager();
    const p2 = i2.captureNext({ allowModifiers: true });
    i2.snapshot();
    i2.simulateKeyDown("ShiftLeft");
    i2.snapshot();
    expect((await p2)?.binding).toEqual({ kind: "key", code: "ShiftLeft" });
  });

  it("times out to null", async () => {
    vi.useFakeTimers();
    const input = new InputManager();
    const p = input.captureNext({ timeoutMs: 500 });
    input.snapshot();
    vi.advanceTimersByTime(501);
    expect(await p).toBeNull();
    vi.useRealTimers();
    input.simulateKeyDown("KeyB");
    input.snapshot(); // no pending capture; nothing thrown
  });

  it("abort signal resolves null; a new capture cancels the previous", async () => {
    const input = new InputManager();
    const ac = new AbortController();
    const p = input.captureNext({ signal: ac.signal });
    ac.abort();
    expect(await p).toBeNull();
    const first = input.captureNext();
    const second = input.captureNext();
    expect(await first).toBeNull();
    input.snapshot();
    input.simulateKeyDown("KeyC");
    input.snapshot();
    expect((await second)?.binding.kind).toBe("key");
  });

  it("kinds filter: keyboard ignored when only gamepadButton is allowed", async () => {
    const { input, setPad } = padInput();
    setPad({ connected: true, buttons: [false, false], axes: [0, 0] });
    const p = input.captureNext({ kinds: ["gamepadButton"] });
    input.snapshot();
    input.simulateKeyDown("KeyQ");
    input.snapshot();
    setPad({ connected: true, buttons: [false, true], axes: [0, 0] });
    input.snapshot();
    const r = await p;
    expect(r?.binding).toEqual({ kind: "gamepadButton", index: 1 });
    expect(r?.label).toBe("Pad B");
  });

  it("gamepad button capture is swallowed for bound actions", async () => {
    const { input, setPad } = padInput({
      fire: [{ kind: "gamepadButton", index: 0 }],
    });
    setPad({ connected: true, buttons: [false], axes: [] });
    const p = input.captureNext();
    input.snapshot();
    setPad({ connected: true, buttons: [true], axes: [] });
    input.snapshot();
    await p;
    expect(input.isDown("fire")).toBe(false);
  });

  it("axis crossing the threshold is captured with its sign", async () => {
    const { input, setPad } = padInput();
    setPad({ connected: true, buttons: [], axes: [0, 0] });
    const p = input.captureNext();
    input.snapshot();
    setPad({ connected: true, buttons: [], axes: [0, -0.9] });
    input.snapshot();
    const r = await p;
    expect(r?.binding).toEqual({
      kind: "gamepadAxis",
      axis: 1,
      threshold: -0.5,
    });
    expect(r?.label).toBe("Axis 1-");
  });

  it("mode 'char' records char for a layout-known letter, else code only", async () => {
    const input = new InputManager();
    input.layout.setProvider({
      charForCode: (c) =>
        (({ KeyQ: "a", KeyA: "ф", Digit1: "&" }) as Record<string, string>)[c],
    });
    let p = input.captureNext({ mode: "char" });
    input.snapshot();
    input.simulateKeyDown("KeyQ");
    input.snapshot();
    expect((await p)?.binding).toEqual({
      kind: "key",
      code: "KeyQ",
      char: "a",
    });
    input.simulateKeyUp("KeyQ");
    input.snapshot();

    p = input.captureNext({ mode: "char" });
    input.snapshot();
    input.simulateKeyDown("Digit1"); // digits stay physical
    input.snapshot();
    expect((await p)?.binding).toEqual({ kind: "key", code: "Digit1" });
  });

  it("rebindByCapture replaces (or adds) and returns null on cancel without touching bindings", async () => {
    const input = new InputManager({ jump: [{ kind: "key", code: "Space" }] });
    let p = input.rebindByCapture("jump");
    input.snapshot();
    input.simulateKeyDown("KeyJ");
    input.snapshot();
    await p;
    expect(input.getBindings("jump")).toEqual([{ kind: "key", code: "KeyJ" }]);
    input.simulateKeyUp("KeyJ");
    input.snapshot();
    p = input.rebindByCapture("jump", { add: true });
    input.snapshot();
    input.simulateKeyDown("KeyK");
    input.snapshot();
    await p;
    expect(input.getBindings("jump")).toHaveLength(2);
    input.simulateKeyUp("KeyK");
    input.snapshot();
    p = input.rebindByCapture("jump");
    input.snapshot();
    input.simulateKeyDown("Escape");
    input.snapshot();
    expect(await p).toBeNull();
    expect(input.getBindings("jump")).toHaveLength(2);
  });
});

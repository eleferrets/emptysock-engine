import { describe, expect, it } from "vitest";
import { InputManager } from "../../ecs/Input.js";
import { Game, defineScene } from "../../ecs/Game.js";
import { MemoryStorageAdapter } from "../../ecs/systems/StorageAdapter.js";
import { PointerSystem } from "../../systems/PointerSystem.js";

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

// Parity coverage for the deleted classic `systems/InputBindings.ts` — its
// real scenarios (rebind, reset-to-defaults, save/load persistence) now
// live directly on `InputManager`, per RELEASE_PASS.md's Track 1 decision
// to fold named-action rebinding into the ECS input layer rather than port
// a second, parallel implementation.
describe("InputManager rebinding and persistence (classic InputBindings parity)", () => {
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

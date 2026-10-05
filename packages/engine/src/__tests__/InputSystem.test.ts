import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InputSystem } from "../systems/InputSystem.js";

function fireKeydown(target: EventTarget, code: string): void {
  target.dispatchEvent(Object.assign(new Event("keydown"), { code }));
}

function fireKeyup(target: EventTarget, code: string): void {
  target.dispatchEvent(Object.assign(new Event("keyup"), { code }));
}

describe("InputSystem", () => {
  let input: InputSystem;
  let target: EventTarget;

  beforeEach(() => {
    target = new EventTarget();
    input = new InputSystem();
    input.attach(target);
  });

  afterEach(() => {
    input.detach();
  });

  it("isKeyDown returns false initially", () => {
    expect(input.isKeyDown("KeyA")).toBe(false);
  });

  it("isKeyDown returns true after keydown", () => {
    fireKeydown(target, "KeyA");
    expect(input.isKeyDown("KeyA")).toBe(true);
  });

  it("isKeyPressed returns true only on first frame", () => {
    fireKeydown(target, "KeyB");
    expect(input.isKeyPressed("KeyB")).toBe(true);
    input.flush();
    expect(input.isKeyPressed("KeyB")).toBe(false);
  });

  it("isKeyReleased returns true frame after keyup", () => {
    fireKeydown(target, "KeyC");
    input.flush();
    fireKeyup(target, "KeyC");
    expect(input.isKeyReleased("KeyC")).toBe(true);
    input.flush();
    expect(input.isKeyReleased("KeyC")).toBe(false);
  });

  it("isKeyDown returns false after keyup", () => {
    fireKeydown(target, "Space");
    input.flush();
    fireKeyup(target, "Space");
    expect(input.isKeyDown("Space")).toBe(false);
  });
});

describe("InputSystem layout learning (no DOM)", () => {
  function key(
    target: EventTarget,
    type: string,
    init: Record<string, unknown>,
  ): void {
    target.dispatchEvent(Object.assign(new Event(type), init));
  }

  it("learns from a clean keydown but state stays keyed by code", () => {
    const target = new EventTarget();
    const input = new InputSystem();
    input.attach(target);
    key(target, "keydown", { code: "KeyQ", key: "a" });
    expect(input.layout.codeForChar("a")).toBe("KeyQ");
    expect(input.isKeyDown("KeyQ")).toBe(true);
    expect(input.isKeyDown("KeyA")).toBe(false);
    input.detach();
  });

  it("does not learn from dead, composing, modified or shifted events", () => {
    const target = new EventTarget();
    const input = new InputSystem();
    input.attach(target);
    key(target, "keydown", { code: "KeyE", key: "Dead" });
    key(target, "keydown", { code: "KeyE", key: "e", isComposing: true });
    key(target, "keydown", { code: "KeyE", key: "e", ctrlKey: true });
    key(target, "keydown", { code: "KeyE", key: "e", altKey: true });
    key(target, "keydown", { code: "KeyE", key: "e", metaKey: true });
    key(target, "keydown", { code: "KeyE", key: "E", shiftKey: true });
    expect(input.layout.charForCode("KeyE")).toBeUndefined();
    input.detach();
  });

  it("keyup after a Shift press still releases the code (state not keyed by key)", () => {
    const target = new EventTarget();
    const input = new InputSystem();
    input.attach(target);
    key(target, "keydown", { code: "KeyA", key: "a" });
    key(target, "keydown", { code: "ShiftLeft", key: "Shift", shiftKey: true });
    key(target, "keyup", { code: "KeyA", key: "A", shiftKey: true });
    expect(input.isKeyDown("KeyA")).toBe(false);
    expect(input.isKeyDown("ShiftLeft")).toBe(true);
    input.detach();
  });

  it("events without a key property (legacy test events) still work", () => {
    const target = new EventTarget();
    const input = new InputSystem();
    input.attach(target);
    key(target, "keydown", { code: "KeyA" });
    expect(input.isKeyDown("KeyA")).toBe(true);
    input.detach();
  });

  it("simulateKeyDown(code, key) learns; without key it does not", () => {
    const input = new InputSystem();
    input.simulateKeyDown("KeyW");
    expect(input.layout.charForCode("KeyW")).toBeUndefined();
    input.simulateKeyDown("KeyQ", "a");
    expect(input.layout.codeForChar("a")).toBe("KeyQ");
  });
});

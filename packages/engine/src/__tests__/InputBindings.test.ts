import { describe, it, expect, beforeEach } from "vitest";
import { InputSystem } from "../systems/InputSystem.js";
import { GamepadSystem } from "../systems/GamepadSystem.js";
import {
  InputBindings,
  createBindingsSaveSystem,
} from "../systems/InputBindings.js";

// Mock localStorage for SaveSystem persistence
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string): string | null => store[key] ?? null,
  setItem: (key: string, val: string): void => {
    store[key] = val;
  },
  removeItem: (key: string): void => {
    delete store[key];
  },
  clear: (): void => {
    for (const k of Object.keys(store)) delete store[k];
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number): string | null => Object.keys(store)[i] ?? null,
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("InputBindings", () => {
  let input: InputSystem;
  let bindings: InputBindings;

  beforeEach(() => {
    localStorageMock.clear();
    input = new InputSystem();
    bindings = new InputBindings(input, {
      jump: [{ kind: "key", code: "Space" }],
      moveLeft: [{ kind: "key", code: "ArrowLeft" }],
    });
  });

  it("isActionActive queries the mapped physical key, not a raw code", () => {
    expect(bindings.isActionActive("jump")).toBe(false);
    input.attach();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(bindings.isActionActive("jump")).toBe(true);
    input.detach();
  });

  it("unknown actions are inactive", () => {
    expect(bindings.isActionActive("nope")).toBe(false);
  });

  it("rebind() replaces the physical input for an action", () => {
    input.attach();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    expect(bindings.isActionActive("jump")).toBe(false);
    bindings.rebind("jump", [{ kind: "key", code: "KeyW" }]);
    expect(bindings.isActionActive("jump")).toBe(true);
    input.detach();
  });

  it("resetToDefaults restores the original binding set", () => {
    bindings.rebind("jump", [{ kind: "key", code: "KeyW" }]);
    bindings.resetToDefaults();
    expect(bindings.getBindings("jump")).toEqual([
      { kind: "key", code: "Space" },
    ]);
  });

  it("save/load round-trips rebinds through SaveSystem", () => {
    bindings.rebind("jump", [{ kind: "key", code: "KeyW" }]);
    const save = createBindingsSaveSystem("test_bindings_");
    bindings.save(save);

    const fresh = new InputBindings(input, {
      jump: [{ kind: "key", code: "Space" }],
      moveLeft: [{ kind: "key", code: "ArrowLeft" }],
    });
    const loaded = fresh.load(save);
    expect(loaded).toBe(true);
    expect(fresh.getBindings("jump")).toEqual([{ kind: "key", code: "KeyW" }]);
  });

  it("gamepad button bindings query GamepadSystem state", () => {
    const gamepad = new GamepadSystem();
    const gpBindings = new InputBindings(
      input,
      { fire: [{ kind: "gamepadButton", index: 0, padIndex: 0 }] },
      gamepad,
    );
    // No gamepad connected — inactive, not a crash.
    expect(gpBindings.isActionActive("fire")).toBe(false);
  });
});

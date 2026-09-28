/**
 * KeyBindings — remappable action -> physical-key bindings.
 *
 * Bindings are DOM `KeyboardEvent.code` values ("KeyW", "Space", "ArrowLeft"):
 * physical-key codes, already layout-independent (the same key position on
 * QWERTY/AZERTY/Dvorak), so no layout translation is done here.
 *
 * Reads through `InputManager.keyboard.isDown`, i.e. the per-frame frozen
 * snapshot; no freezing is reimplemented. Edge detection needs one call to
 * `update()` per frame, after `game.input.snapshot()` (Game.update runs it
 * first) — call it at the top of scene `onUpdate`. Not a Game service: it
 * needs an input source and a storage adapter, so it is constructed by game
 * code. Persistence goes through an injected `StorageAdapter` (default
 * `MemoryStorageAdapter`); no DOM access.
 */
import { MemoryStorageAdapter, type StorageAdapter } from "./StorageAdapter.js";

/** Anything exposing the frozen keyboard snapshot — `InputManager` satisfies this. */
export interface KeyboardSource {
  readonly keyboard: { isDown(code: string): boolean };
}

export const KEY_BINDINGS_STORAGE_KEY = "settings/keybindings";

export class KeyBindings {
  private readonly _bindings = new Map<string, string[]>();
  private readonly _prev = new Map<string, boolean>();
  private readonly _pressed = new Set<string>();
  private readonly _released = new Set<string>();

  constructor(
    private readonly _input: KeyboardSource,
    private readonly _storage: StorageAdapter = new MemoryStorageAdapter(),
    private readonly _storageKey: string = KEY_BINDINGS_STORAGE_KEY,
  ) {}

  /** Add codes to an action (duplicates ignored). */
  bind(action: string, ...codes: string[]): void {
    const list = this._bindings.get(action) ?? [];
    for (const c of codes) if (!list.includes(c)) list.push(c);
    this._bindings.set(action, list);
  }

  /** Remove specific codes, or the whole action when no codes are given. */
  unbind(action: string, ...codes: string[]): void {
    if (codes.length === 0) {
      this._bindings.delete(action);
      this._prev.delete(action);
      return;
    }
    const list = this._bindings.get(action);
    if (!list) return;
    this._bindings.set(
      action,
      list.filter((c) => !codes.includes(c)),
    );
  }

  /** Replace an action's codes outright (the "rebind" case). */
  rebind(action: string, ...codes: string[]): void {
    this._bindings.set(action, []);
    this.bind(action, ...codes);
  }

  getBindings(action: string): readonly string[] {
    return [...(this._bindings.get(action) ?? [])];
  }

  isActionDown(action: string): boolean {
    const list = this._bindings.get(action);
    if (!list) return false;
    const kb = this._input.keyboard;
    return list.some((c) => kb.isDown(c));
  }

  /** Compute this frame's press/release edges. Call once per frame. */
  update(): void {
    this._pressed.clear();
    this._released.clear();
    for (const action of this._bindings.keys()) {
      const now = this.isActionDown(action);
      const was = this._prev.get(action) === true;
      if (now && !was) this._pressed.add(action);
      if (!now && was) this._released.add(action);
      this._prev.set(action, now);
    }
  }

  wasActionPressed(action: string): boolean {
    return this._pressed.has(action);
  }

  wasActionReleased(action: string): boolean {
    return this._released.has(action);
  }

  /** Persist the binding table as a JSON settings blob. */
  async save(): Promise<void> {
    const table: Record<string, string[]> = {};
    for (const [a, codes] of this._bindings) table[a] = [...codes];
    await this._storage.set(this._storageKey, JSON.stringify(table));
  }

  /**
   * Replace bindings from storage. Returns true if a valid table was loaded;
   * missing or corrupt data leaves current bindings untouched and returns false.
   */
  async load(): Promise<boolean> {
    let raw: string | null;
    try {
      raw = await this._storage.get(this._storageKey);
    } catch {
      return false;
    }
    if (raw === null) return false;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return false;
    const next = new Map<string, string[]>();
    for (const [action, codes] of Object.entries(parsed)) {
      if (!Array.isArray(codes) || !codes.every((c) => typeof c === "string"))
        return false;
      next.set(action, [...new Set(codes as string[])]);
    }
    this._bindings.clear();
    this._prev.clear();
    this._pressed.clear();
    this._released.clear();
    for (const [a, c] of next) this._bindings.set(a, c);
    return true;
  }
}

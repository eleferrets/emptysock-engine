import type { SceneSnapshot } from "./SceneTransfer.js";

/**
 * Game-owned store of the entity state of persistent rooms (a scene definition
 * with a `persistentKey`), keyed by that key. `Game.loadScene` fills it when a
 * persistent room is left and `SceneLifecycle.restoreRoom()` drains it when the
 * room is entered again, so the room comes back as it was left.
 */
export class RoomStateCache {
  private readonly _rooms = new Map<string, SceneSnapshot>();

  store(key: string, snapshot: SceneSnapshot): void {
    this._rooms.set(key, snapshot);
  }

  has(key: string): boolean {
    return this._rooms.has(key);
  }

  /** Remove and return the snapshot for `key`. */
  take(key: string): SceneSnapshot | undefined {
    const snap = this._rooms.get(key);
    this._rooms.delete(key);
    return snap;
  }

  /** Forget `key`, or every room when omitted. */
  clear(key?: string): void {
    if (key === undefined) this._rooms.clear();
    else this._rooms.delete(key);
  }

  /** Keys currently cached. */
  keys(): string[] {
    return [...this._rooms.keys()];
  }
}

import type { SceneSnapshot } from "./SceneTransfer.js";
/**
 * Game-owned store of the entity state of persistent rooms (a scene definition
 * with a `persistentKey`), keyed by that key. `Game.loadScene` fills it when a
 * persistent room is left and `SceneLifecycle.restoreRoom()` drains it when the
 * room is entered again, so the room comes back as it was left.
 */
export declare class RoomStateCache {
  private readonly _rooms;
  store(key: string, snapshot: SceneSnapshot): void;
  has(key: string): boolean;
  /** Remove and return the snapshot for `key`. */
  take(key: string): SceneSnapshot | undefined;
  /** Forget `key`, or every room when omitted. */
  clear(key?: string): void;
  /** Keys currently cached. */
  keys(): string[];
}

import type { StorageAdapter } from "./StorageAdapter.js";
export interface CGEntry {
  id: string;
  imagePath: string;
  title?: string;
}
export interface CGGalleryOptions {
  entries: CGEntry[];
}
/**
 * RELEASE_PASS.md Track 3 — a real, confirmed-live IDE feature, not dead
 * code. Persists unlock flags through a `StorageAdapter`, the same
 * interface `InputManager.saveBindings()`/`loadBindings()` already use for
 * a `Game`-level settings blob, not `SaveSystem` — a CG gallery's unlock
 * flags are exactly the same shape of problem `InputManager`'s bindings
 * were: a small, scene-independent blob, not per-entity component data, so
 * `SaveSystem`'s `Scene`/`ComponentDef`-bound save/load API (it serializes
 * a `Scene`'s live entities, not an arbitrary settings object) is the wrong
 * shape for it.
 */
export declare class CGGallery {
  private readonly _entries;
  private readonly _unlocked;
  constructor(opts: CGGalleryOptions);
  /** Load previously `save()`-persisted unlock flags. Leaves the gallery untouched if nothing was stored under `key` or it couldn't be parsed. */
  load(adapter: StorageAdapter, key?: string): Promise<void>;
  /** Mark a CG as unlocked and persist immediately. */
  unlock(adapter: StorageAdapter, id: string, key?: string): Promise<void>;
  isUnlocked(id: string): boolean;
  get entries(): ReadonlyArray<CGEntry>;
  get unlockedEntries(): CGEntry[];
  get totalCount(): number;
  get unlockedCount(): number;
  private _persist;
}
//# sourceMappingURL=CGGallery.d.ts.map

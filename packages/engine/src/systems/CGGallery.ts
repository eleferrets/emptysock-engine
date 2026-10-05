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
 * the release notes Track 3 — a real, confirmed-live IDE feature, not dead
 * code. Persists unlock flags through a `StorageAdapter`, the same
 * interface `InputManager.saveBindings()`/`loadBindings()` already use for
 * a `Game`-level settings blob, not `SaveSystem` — a CG gallery's unlock
 * flags are exactly the same shape of problem `InputManager`'s bindings
 * were: a small, scene-independent blob, not per-entity component data, so
 * `SaveSystem`'s `Scene`/`ComponentDef`-bound save/load API (it serializes
 * a `Scene`'s live entities, not an arbitrary settings object) is the wrong
 * shape for it.
 */
export class CGGallery {
  private readonly _entries: CGEntry[];
  private readonly _unlocked = new Set<string>();

  constructor(opts: CGGalleryOptions) {
    this._entries = opts.entries;
  }

  /** Load previously `save()`-persisted unlock flags. Leaves the gallery untouched if nothing was stored under `key` or it couldn't be parsed. */
  async load(
    adapter: StorageAdapter,
    key = "emptysock_cg_gallery",
  ): Promise<void> {
    const raw = await adapter.get(key);
    if (raw === null) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return;
      }
      this._unlocked.clear();
      for (const [id, value] of Object.entries(parsed)) {
        if (value === true) this._unlocked.add(id);
      }
    } catch {
      // Leave the gallery as-is on malformed storage — same "don't corrupt
      // in-memory state from bad persisted data" contract SaveSystem's own
      // per-component migration fallback follows.
    }
  }

  /** Mark a CG as unlocked and persist immediately. */
  async unlock(
    adapter: StorageAdapter,
    id: string,
    key = "emptysock_cg_gallery",
  ): Promise<void> {
    if (this._unlocked.has(id)) return;
    this._unlocked.add(id);
    await this._persist(adapter, key);
  }

  isUnlocked(id: string): boolean {
    return this._unlocked.has(id);
  }

  get entries(): ReadonlyArray<CGEntry> {
    return this._entries;
  }

  get unlockedEntries(): CGEntry[] {
    return this._entries.filter((e) => this._unlocked.has(e.id));
  }

  get totalCount(): number {
    return this._entries.length;
  }

  get unlockedCount(): number {
    return this._unlocked.size;
  }

  private async _persist(adapter: StorageAdapter, key: string): Promise<void> {
    const data: Record<string, boolean> = {};
    for (const id of this._unlocked) data[id] = true;
    await adapter.set(key, JSON.stringify(data));
  }
}

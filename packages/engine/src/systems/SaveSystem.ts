import { z } from "zod";

export interface SaveSlot {
  readonly id: string;
  readonly scene: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
  readonly playtime: number;
}

const SaveSlotSchema = z.object({
  id: z.string(),
  scene: z.string(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
  playtime: z.number().nonnegative(),
});

const STORAGE_PREFIX = "emptysock_save_";

export class SaveSystem {
  private readonly _prefix: string;

  constructor(prefix: string = STORAGE_PREFIX) {
    this._prefix = prefix;
  }

  /**
   * Persist a save slot. Returns `true` on success, `false` if storage is
   * unavailable (private mode, quota exceeded, etc.).
   */
  save(slotId: string, data: Omit<SaveSlot, "id">): boolean {
    if (typeof localStorage === "undefined") return false;
    const slot: SaveSlot = { ...data, id: slotId };
    try {
      localStorage.setItem(this._prefix + slotId, JSON.stringify(slot));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load a save slot. Returns `null` if the slot does not exist or is corrupt.
   * Always validate `raw.data` through your own Zod schema before use.
   */
  load(slotId: string): SaveSlot | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(this._prefix + slotId);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as unknown;
      return SaveSlotSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  /**
   * Return all save slots sorted by timestamp descending (newest first).
   * Malformed entries are silently skipped.
   */
  listSlots(): SaveSlot[] {
    if (typeof localStorage === "undefined") return [];
    const slots: SaveSlot[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === null || !k.startsWith(this._prefix)) continue;
        const raw = localStorage.getItem(k);
        if (raw === null) continue;
        try {
          const parsed = JSON.parse(raw) as unknown;
          slots.push(SaveSlotSchema.parse(parsed));
        } catch {
          // Skip malformed slots
        }
      }
    } catch {
      // Storage unavailable
    }
    return slots.sort((a, b) => b.timestamp - a.timestamp);
  }

  delete(slotId: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(this._prefix + slotId);
    } catch {
      // Storage unavailable
    }
  }

  update(_dt: number): void {}

  destroy(): void {}
}

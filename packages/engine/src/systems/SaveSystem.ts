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

const _KNOWN_KEYS = new Set(["scene", "data", "timestamp", "playtime"]);

export class SaveSystem {
  private readonly _prefix: string;

  constructor(prefix: string = STORAGE_PREFIX) {
    this._prefix = prefix;
  }

  /**
   * Persist a save slot.
   *
   * `timestamp` defaults to `Date.now()` and `playtime` defaults to `0` when
   * omitted, so a minimal call only needs `scene` and `data`.
   *
   * Any key other than `scene`, `data`, `timestamp`, and `playtime` is logged
   * as a warning and dropped — store everything inside the `data` field.
   */
  save(
    slotId: string,
    entry: {
      scene: string;
      data: Record<string, unknown>;
      timestamp?: number;
      playtime?: number;
    },
  ): void {
    for (const k of Object.keys(entry)) {
      if (!_KNOWN_KEYS.has(k)) {
        console.warn(
          `[SaveSystem] save() received unexpected key "${k}" — it will not be persisted. Store all save data inside the "data" field.`,
        );
      }
    }

    const slot: SaveSlot = {
      id: slotId,
      scene: entry.scene,
      data: entry.data,
      timestamp: entry.timestamp ?? Date.now(),
      playtime: entry.playtime ?? 0,
    };

    try {
      localStorage.setItem(this._prefix + slotId, JSON.stringify(slot));
    } catch {
      // Storage unavailable — silently fail
    }
  }

  load(slotId: string): SaveSlot | null {
    try {
      const raw = localStorage.getItem(this._prefix + slotId);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as unknown;
      return SaveSlotSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  listSlots(): SaveSlot[] {
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
    return slots;
  }

  delete(slotId: string): void {
    try {
      localStorage.removeItem(this._prefix + slotId);
    } catch {
      // Storage unavailable
    }
  }

  update(_dt: number): void {
    // No per-frame work
  }
}

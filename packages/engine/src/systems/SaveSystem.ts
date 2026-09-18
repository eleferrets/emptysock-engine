import { z } from 'zod';

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

const STORAGE_PREFIX = 'emptysock_save_';

export class SaveSystem {
  private readonly _prefix: string;

  constructor(prefix: string = STORAGE_PREFIX) {
    this._prefix = prefix;
  }

  save(slotId: string, data: Omit<SaveSlot, 'id'>): void {
    if (typeof localStorage === 'undefined') return;
    const slot: SaveSlot = { ...data, id: slotId };
    try {
      localStorage.setItem(this._prefix + slotId, JSON.stringify(slot));
    } catch {
      // Storage unavailable — silently fail
    }
  }

  load(slotId: string): SaveSlot | null {
    if (typeof localStorage === 'undefined') return null;
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
    if (typeof localStorage === 'undefined') return [];
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
    if (typeof localStorage === 'undefined') return;
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

export interface SaveSlot {
  readonly id: string;
  readonly scene: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
  readonly playtime: number;
}
export declare class SaveSystem {
  private readonly _prefix;
  constructor(prefix?: string);
  /**
   * Persist a save slot. Returns `true` on success, `false` if storage is
   * unavailable (private mode, quota exceeded, etc.).
   */
  save(slotId: string, data: Omit<SaveSlot, "id">): boolean;
  /**
   * Load a save slot. Returns `null` if the slot does not exist or is corrupt.
   * Always validate `raw.data` through your own Zod schema before use.
   */
  load(slotId: string): SaveSlot | null;
  /**
   * Return all save slots sorted by timestamp descending (newest first).
   * Malformed entries are silently skipped.
   */
  listSlots(): SaveSlot[];
  delete(slotId: string): void;
  update(_dt: number): void;
  destroy(): void;
}

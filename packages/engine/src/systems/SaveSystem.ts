import { z } from "zod";

/**
 * Default shape of a save slot for a `startScene`-style game: one scene
 * name, a free-form data bag, and bookkeeping fields. This is the schema
 * `SaveSystem` uses when no custom schema is passed to its constructor —
 * it is a *default policy*, not something the generic persistence
 * mechanism enforces. Pass your own Zod schema to `SaveSystem` to store a
 * differently-shaped slot (see the class doc comment).
 */
export interface GameSaveSlot {
  readonly id: string;
  readonly scene: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
  readonly playtime: number;
}

/** @deprecated Use `GameSaveSlot` — kept as an alias for backward compatibility. */
export type SaveSlot = GameSaveSlot;

const GameSaveSlotSchema: z.ZodType<GameSaveSlot> = z.object({
  id: z.string(),
  scene: z.string(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
  playtime: z.number().nonnegative(),
});

const STORAGE_PREFIX = "emptysock_save_";

/**
 * Generic key-value persistence for save slots, backed by `localStorage`.
 *
 * `SaveSystem` itself only knows how to store and retrieve an opaque JSON
 * object per slot under a prefixed key, and validate that a loaded slot
 * matches a schema — it has no opinion on what a "save slot" contains.
 * The *shape* of a slot is supplied as a Zod schema:
 *
 * - Construct with no schema to get the default `GameSaveSlot` shape
 *   (`{ scene, data, timestamp, playtime }`), matching a typical
 *   `startScene`-driven game.
 * - Construct with `new SaveSystem(prefix, mySchema)` to store any other
 *   slot shape your game needs (e.g. per-character saves, a different set
 *   of bookkeeping fields, no `scene` field at all). `mySchema` must
 *   describe the full slot including an `id: string` field — `save()`
 *   fills `id` in from the slot name automatically.
 */
export class SaveSystem<TSlot extends { id: string } = GameSaveSlot> {
  private readonly _prefix: string;
  private readonly _schema: z.ZodType<TSlot>;
  private readonly _isDefaultSchema: boolean;

  constructor(prefix: string = STORAGE_PREFIX, schema?: z.ZodType<TSlot>) {
    this._prefix = prefix;
    this._isDefaultSchema = schema === undefined;
    this._schema =
      schema ?? (GameSaveSlotSchema as unknown as z.ZodType<TSlot>);
  }

  /**
   * Persist a save slot.
   *
   * With the default schema, `timestamp` defaults to `Date.now()` and
   * `playtime` defaults to `0` when omitted, so a minimal call only needs
   * `scene` and `data`. With a custom schema, `entry` must supply every
   * field the schema requires except `id` (which comes from `slotId`).
   *
   * If the assembled slot does not validate against the schema, the save
   * is rejected and a warning is logged — nothing is written to storage.
   */
  save(
    slotId: string,
    entry: TSlot extends GameSaveSlot
      ? {
          scene: string;
          data: Record<string, unknown>;
          timestamp?: number;
          playtime?: number;
        }
      : Omit<TSlot, "id">,
  ): void {
    const record: Record<string, unknown> = {
      ...(entry as Record<string, unknown>),
      id: slotId,
    };

    if (this._isDefaultSchema) {
      const defaults = entry as { timestamp?: number; playtime?: number };
      record["timestamp"] = defaults.timestamp ?? Date.now();
      record["playtime"] = defaults.playtime ?? 0;
    }

    const parsed = this._schema.safeParse(record);
    if (!parsed.success) {
      console.warn(
        `[SaveSystem] save() rejected data for slot "${slotId}" — it does not match the configured slot schema: ${parsed.error.message}`,
      );
      return;
    }

    try {
      localStorage.setItem(this._prefix + slotId, JSON.stringify(parsed.data));
    } catch {
      // Storage unavailable — silently fail
    }
  }

  load(slotId: string): TSlot | null {
    try {
      const raw = localStorage.getItem(this._prefix + slotId);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as unknown;
      const result = this._schema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  listSlots(): TSlot[] {
    const slots: TSlot[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === null || !k.startsWith(this._prefix)) continue;
        const raw = localStorage.getItem(k);
        if (raw === null) continue;
        try {
          const parsed = JSON.parse(raw) as unknown;
          const result = this._schema.safeParse(parsed);
          if (result.success) slots.push(result.data);
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

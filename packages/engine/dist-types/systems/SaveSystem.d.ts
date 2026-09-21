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
export declare class SaveSystem<
  TSlot extends {
    id: string;
  } = GameSaveSlot,
> {
  private readonly _prefix;
  private readonly _schema;
  private readonly _isDefaultSchema;
  constructor(prefix?: string, schema?: z.ZodType<TSlot>);
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
  ): void;
  load(slotId: string): TSlot | null;
  listSlots(): TSlot[];
  delete(slotId: string): void;
  update(_dt: number): void;
}

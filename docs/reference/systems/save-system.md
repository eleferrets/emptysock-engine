# SaveSystem

`SaveSystem` is generic key-value persistence for save slots, backed by `localStorage`. All operations are synchronous. It only knows how to store, retrieve, and validate an opaque JSON object per slot under a prefixed key — it does not decide what a "save slot" contains. The shape of a slot is supplied to the constructor as a Zod schema.

For a task-oriented introduction, see the [Saving and Localisation guide](../../guides/saving-and-localisation.md).

Import: `import { SaveSystem, type GameSaveSlot } from '@emptysock/engine';`

---

## `new SaveSystem<TSlot>(prefix?: string, schema?: z.ZodType<TSlot>)`

- With no `schema`, `SaveSystem` uses the default `GameSaveSlot` shape — `{ id, scene, data, timestamp, playtime }` — matching a typical `startScene`-driven game. This is the _default policy_, not something baked into the persistence mechanism.
- With a `schema`, `SaveSystem` stores whatever shape that schema describes instead. `schema` must validate the full slot including an `id: string` field — `save()` fills `id` in from the slot name automatically, so your schema just needs to require it.
- `prefix` sets the `localStorage` key prefix (default `"emptysock_save_"`). Use a different prefix per `SaveSystem` instance to keep unrelated slot shapes from colliding in storage.

```typescript
import { SaveSystem } from "@emptysock/engine";

// Default GameSaveSlot shape:
const saves = new SaveSystem();
```

---

## `GameSaveSlot` — the default slot shape

```typescript
interface GameSaveSlot {
  readonly id: string;
  readonly scene: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
  readonly playtime: number;
}
```

---

## `save(slotId: string, entry): void`

Write a slot, keyed by `slotId`. With the default schema, `timestamp` defaults to `Date.now()` and `playtime` defaults to `0` when omitted, so a minimal call only needs `scene` and `data`:

```typescript
saves.save("slot-1", {
  scene: "Level2",
  data: { score: 4200, flags: { doorOpen: true } },
});
```

With a custom schema, `entry` must supply every field the schema requires except `id`.

If the assembled slot does not validate against the configured schema, `save()` logs a warning and does not write anything — it never silently drops unknown fields or partially persists invalid data.

---

## `load(slotId: string): TSlot | null`

Load and validate a slot. Returns `null` if the slot does not exist, the stored JSON is corrupted, or it no longer matches the configured schema (e.g. it was written by an older game version with a different shape).

```typescript
const slot = saves.load("slot-1");
if (slot !== null) {
  loadScene(slot.scene);
}
```

> Because `load()` already validates against the schema you gave the constructor, there's no separate "cast and hope" step — a non-null result is guaranteed to match `TSlot`.

---

## `listSlots(): TSlot[]`

Return every stored slot under this instance's prefix that currently validates against the schema. Malformed or foreign-shaped entries are skipped, not thrown.

```typescript
for (const slot of saves.listSlots()) {
  renderSlotButton(slot.id, slot.scene, slot.playtime);
}
```

---

## `delete(slotId: string): void`

Delete the named slot. Does nothing if the slot does not exist.

---

## Using a custom slot schema

A game whose save data doesn't fit `{ scene, data, timestamp, playtime }` — per-character saves, a different set of bookkeeping fields, no `scene` field at all — passes its own Zod schema instead of relying on the default:

```typescript
import { SaveSystem } from "@emptysock/engine";
import { z } from "zod";

const CharacterSaveSchema = z.object({
  id: z.string(),
  characterName: z.string(),
  level: z.number().int().positive(),
  unlockedSkills: z.array(z.string()),
});
type CharacterSave = z.infer<typeof CharacterSaveSchema>;

const characterSaves = new SaveSystem<CharacterSave>(
  "char_save_",
  CharacterSaveSchema,
);

characterSaves.save("hero-1", {
  characterName: "Aria",
  level: 5,
  unlockedSkills: ["dash", "parry"],
});

const hero = characterSaves.load("hero-1"); // CharacterSave | null
```

Nothing about `SaveSystem` special-cases `scene`, `data`, `timestamp`, or `playtime` when a custom schema is given — those are purely the default schema's fields, not a hardcoded allow-list.

---

## Full example

```typescript
import { SaveSystem, type GameSaveSlot } from "@emptysock/engine";

const saves = new SaveSystem();

function saveGame(
  slotId: string,
  scene: string,
  data: Record<string, unknown>,
): void {
  saves.save(slotId, { scene, data });
}

function loadGame(slotId: string): GameSaveSlot | null {
  return saves.load(slotId); // already validated — no manual schema.parse needed
}

function showSaveSlotMenu(): void {
  for (const slot of saves.listSlots()) {
    renderSlotButton(slot.id, slot.scene, slot.playtime);
  }
}
```

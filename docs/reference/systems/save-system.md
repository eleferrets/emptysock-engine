# SaveSystem

`SaveSystem` reads and writes persistent save slots. All operations are async. Always validate save data with a schema — save files can be corrupt, edited, or from a different game version.

For a task-oriented introduction, see the [Saving and Localisation guide](../../guides/saving-and-localisation.md).

Import: `import { SaveSystem } from '@emptysock/engine';`

---

## `SaveSystem.save(slot: string, data: unknown): Promise<void>`

Write `data` to the named slot. Overwrites any existing data in that slot.

```typescript
await SaveSystem.save("slot-1", {
  scene: "Level2",
  score: 4200,
  flags: { doorOpen: true },
});
```

---

## `SaveSystem.load(slot: string): Promise<SaveResult>`

Load data from the named slot. Throws `SlotNotFoundError` if the slot does not exist.

### SaveResult

| Field     | Type      | Description                                         |
| --------- | --------- | --------------------------------------------------- |
| `data`    | `unknown` | The raw saved value — always validate with a schema |
| `slot`    | `string`  | The slot name                                       |
| `savedAt` | `number`  | Unix timestamp (ms) when the slot was written       |

```typescript
import { z } from "zod";

const Schema = z.object({
  scene: z.string(),
  score: z.number(),
  flags: z.record(z.boolean()),
});
type SaveData = z.infer<typeof Schema>;

const raw = await SaveSystem.load("slot-1");
const data = Schema.parse(raw.data); // always validate
```

> **Warning:** Never cast `raw.data as MyType`. Save files can be corrupt, edited, or from a different game version. Schema validation is the contract between your game and its saves.

---

## `SaveSystem.delete(slot: string): Promise<void>`

Delete the named slot. Does nothing if the slot does not exist.

```typescript
await SaveSystem.delete("slot-1");
```

---

## `SaveSystem.listSlots(): Promise<string[]>`

Return the names of all existing save slots.

```typescript
const slots = await SaveSystem.listSlots();
// → ['slot-1', 'slot-2', 'autosave']
```

---

## Error types

| Class               | When thrown                                   |
| ------------------- | --------------------------------------------- |
| `SlotNotFoundError` | `load()` called on a slot that does not exist |

---

## Full example

```typescript
import { SaveSystem } from "@emptysock/engine";
import { z } from "zod";

const SaveSchema = z.object({
  level: z.string(),
  score: z.number(),
  inventory: z.array(z.string()),
});
type Save = z.infer<typeof SaveSchema>;

async function saveGame(slot: string, data: Save): Promise<void> {
  await SaveSystem.save(slot, data);
}

async function loadGame(slot: string): Promise<Save | null> {
  try {
    const raw = await SaveSystem.load(slot);
    return SaveSchema.parse(raw.data);
  } catch {
    return null; // slot not found or data invalid
  }
}

async function showSaveSlotMenu(): Promise<void> {
  const slots = await SaveSystem.listSlots();
  for (const slot of slots) {
    // render a button for each slot
  }
}
```

# Saving and Localisation

This guide covers two systems that tend to get set up together: `SaveSystem` (persistent save slots) and `LocalisationSystem` (translated strings).

For the complete API, see [SaveSystem reference](../reference/systems/save-system.md) and [LocalisationSystem reference](../reference/systems/localisation-system.md).

> **Heads up:** this page describes the classic `SaveSystem`. `@emptysock/engine/v2` has its own `SaveSystem` that takes an injected `StorageAdapter` instead of guessing the platform, and adds per-component schema versioning with migrations, so a hot-reloaded component shape change doesn't corrupt old saves. See the [Engine Overview](../getting-started/engine-overview.md) for the shape of it.

---

## SaveSystem

`SaveSystem` reads and writes persistent save slots identified by a string key. Save data gets schema-validated on load, so resist the urge to cast raw data with `as` and skip that step.

### Saving

```typescript
import { SaveSystem } from "@emptysock/engine";

await SaveSystem.save("slot-1", {
  scene: "Level2",
  score: 4200,
  flags: { bossDefeated: true },
});
```

### Loading

```typescript
import { z } from "zod";

const Schema = z.object({
  scene: z.string(),
  score: z.number(),
  flags: z.record(z.boolean()),
});
type SaveData = z.infer<typeof Schema>;

const raw = await SaveSystem.load("slot-1"); // throws SlotNotFoundError if missing
const data = Schema.parse(raw.data); // always validate
```

> **Never cast `raw.data as MyType`.** Save files can be corrupt, edited, or from a different game version. Schema validation is the contract.

### Other operations

```typescript
await SaveSystem.delete("slot-1");
const slots = await SaveSystem.listSlots(); // string[]
```

---

## LocalisationSystem

`LocalisationSystem` is instanced — create one in `onLoad`. Load locale JSON files, call `setLocale()`, then use `t()` to look up strings.

### Setup

```typescript
import { LocalisationSystem } from "@emptysock/engine";
import { z } from "zod";

export class GameScene extends Scene {
  private _loc!: LocalisationSystem;

  override async onLoad(): Promise<void> {
    this._loc = new LocalisationSystem();
    const TranslationMapSchema = z.record(z.string());

    const enRaw = await (await fetch("assets/i18n/en.json")).json();
    const frRaw = await (await fetch("assets/i18n/fr.json")).json();

    this._loc.addTranslations("en", TranslationMapSchema.parse(enRaw));
    this._loc.addTranslations("fr", TranslationMapSchema.parse(frRaw));

    this._loc.setLocale("fr");
  }
}
```

### Looking up strings

```typescript
this._loc.t("greeting"); // → "Bonjour"
this._loc.t("score", { n: 42 }); // → "Score : 42"
this._loc.t("missing.key"); // → 'missing.key' (never throws)

const lang = this._loc.currentLocale; // "fr"
```

### Locale JSON format

```json
{
  "greeting": "Hello",
  "score": "Score: {{n}}",
  "lives": "Lives: {{count}}"
}
```

Template tokens use `{{name}}` syntax. Pass a `params` object to `t()` to substitute values.

### Localisation Editor

The IDE's **Localisation Editor** panel provides a spreadsheet-style table for managing translation strings. It can export CSV that maps directly to these JSON files. Open it via **Module → Localisation** in the menu bar.

---

## Combining save and Localisation

A common pattern: save the player's chosen locale alongside game progress, and restore it on load.

```typescript
override async onLoad(): Promise<void> {
  this._loc = new LocalisationSystem();
  // ... load translations ...

  try {
    const raw = await SaveSystem.load('settings');
    const settings = SettingsSchema.parse(raw.data);
    this._loc.setLocale(settings.locale);
  } catch {
    this._loc.setLocale('en'); // default if no save exists
  }
}
```

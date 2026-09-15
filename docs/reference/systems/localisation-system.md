# LocalisationSystem

`LocalisationSystem` is an instanced i18n system. Create one instance in `onLoad`, load locale JSON files, and call `t()` to look up translated strings with optional token substitution.

For a task-oriented introduction, see the [Saving and Localisation guide](../../guides/saving-and-localisation.md).

Import: `import { LocalisationSystem } from '@emptysock/engine';`

Note: Always use **Localisation** (British spelling) — the class name matches.

---

## Constructor

```typescript
const localisation = new LocalisationSystem();
```

Create one instance per scene (or once in a persistent service). Multiple instances are independent.

---

## `localisation.addTranslations(locale: string, map: Record<string, string>): void`

Register a locale's string table. Call for each locale before calling `setLocale`.

```typescript
import { z } from "zod";

const TranslationMapSchema = z.record(z.string());

const enRaw = await (await fetch("assets/i18n/en.json")).json();
localisation.addTranslations("en", TranslationMapSchema.parse(enRaw));

const frRaw = await (await fetch("assets/i18n/fr.json")).json();
localisation.addTranslations("fr", TranslationMapSchema.parse(frRaw));
```

Calling `addTranslations` with the same locale again **merges** the new keys into the existing map (new keys are added, existing keys are overwritten).

---

## `localisation.setLocale(locale: string): void`

Switch to the named locale. Subsequent `t()` calls use this locale's string table.

```typescript
localisation.setLocale("fr");
```

Throws if the locale has not been registered with `addTranslations`.

---

## `localisation.t(key: string, params?: Record<string, string | number>): string`

Look up a string by key. Returns the key itself if the key is not found (never throws).

Token syntax: `{{name}}` in the string is replaced by the matching value in `params`.

```typescript
localisation.t("greeting"); // → "Bonjour"
localisation.t("score", { n: 42 }); // → "Score : 42"
localisation.t("missing.key"); // → 'missing.key' (fallback, no throw)
```

---

## `localisation.currentLocale: string`

Read the currently active locale tag.

```typescript
const lang = localisation.currentLocale; // 'fr'
```

---

## Locale JSON format

```json
{
  "greeting": "Hello",
  "score": "Score: {{n}}",
  "player_died": "{{name}} was defeated after {{rounds}} rounds."
}
```

- Keys are dot-notation strings by convention but any string is valid.
- Template tokens use `{{name}}` (double braces). Tokens with no matching param are left as-is.
- The **Localisation Editor** panel exports CSV that maps directly to this JSON format.

---

## Full scene example

```typescript
import { LocalisationSystem } from "@emptysock/engine";
import { z } from "zod";

export class GameScene extends Scene {
  private _loc!: LocalisationSystem;

  override async onLoad(): Promise<void> {
    this._loc = new LocalisationSystem();

    const schema = z.record(z.string());
    const en = schema.parse(await (await fetch("assets/i18n/en.json")).json());
    const fr = schema.parse(await (await fetch("assets/i18n/fr.json")).json());

    this._loc.addTranslations("en", en);
    this._loc.addTranslations("fr", fr);
    this._loc.setLocale("fr");
  }

  override onUpdate(dt: number): void {
    const scoreLabel = this._loc.t("score", { n: this._score });
    hud.setScore(scoreLabel);
  }
}
```

export type Locale = string;
export type TranslationMap = Record<string, string>;

export class LocalisationSystem {
  private _locale: Locale = 'en';
  private readonly _translations: Map<Locale, TranslationMap> = new Map();

  get currentLocale(): Locale {
    return this._locale;
  }

  setLocale(locale: Locale): void {
    this._locale = locale;
  }

  addTranslations(locale: Locale, map: TranslationMap): void {
    const existing = this._translations.get(locale) ?? {};
    this._translations.set(locale, { ...existing, ...map });
  }

  t(key: string, vars?: Record<string, string | number>): string {
    const map = this._translations.get(this._locale);
    let value = map?.[key] ?? key;

    if (vars !== undefined) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replaceAll(`{{${k}}}`, String(v));
      }
    }

    return value;
  }

  update(_dt: number): void {
    // No per-frame work
  }
}

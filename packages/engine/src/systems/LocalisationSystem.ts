export type Locale = string;
export type TranslationMap = Record<string, string>;

export class LocalisationSystem {
  private _locale: Locale = "en";
  private readonly _translations: Map<Locale, TranslationMap> = new Map();
  private readonly _localeChangeHandlers: Array<(locale: Locale) => void> = [];

  get currentLocale(): Locale {
    return this._locale;
  }

  setLocale(locale: Locale): void {
    this._locale = locale;
    for (const handler of this._localeChangeHandlers) {
      handler(locale);
    }
  }

  addTranslations(locale: Locale, map: TranslationMap): void {
    const existing = this._translations.get(locale) ?? {};
    this._translations.set(locale, { ...existing, ...map });
  }

  /**
   * Subscribe to locale changes. Returns an unsubscriber function.
   * Useful for refreshing UI text after the player changes language.
   */
  onLocaleChange(handler: (locale: Locale) => void): () => void {
    this._localeChangeHandlers.push(handler);
    return () => {
      const i = this._localeChangeHandlers.indexOf(handler);
      if (i !== -1) this._localeChangeHandlers.splice(i, 1);
    };
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

  update(_dt: number): void {}

  destroy(): void {
    this._translations.clear();
    this._localeChangeHandlers.length = 0;
  }
}

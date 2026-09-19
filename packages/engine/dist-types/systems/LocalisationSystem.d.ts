export type Locale = string;
export type TranslationMap = Record<string, string>;
export declare class LocalisationSystem {
  private _locale;
  private readonly _translations;
  private readonly _localeChangeHandlers;
  get currentLocale(): Locale;
  setLocale(locale: Locale): void;
  addTranslations(locale: Locale, map: TranslationMap): void;
  /**
   * Subscribe to locale changes. Returns an unsubscriber function.
   * Useful for refreshing UI text after the player changes language.
   */
  onLocaleChange(handler: (locale: Locale) => void): () => void;
  t(key: string, vars?: Record<string, string | number>): string;
  update(_dt: number): void;
  destroy(): void;
}

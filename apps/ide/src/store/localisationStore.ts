import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export type LocalisationTranslations = Record<string, Record<string, string>>;

// ── Initial data ─────────────────────────────────────────────────────────────

const INITIAL_LOCALISATION_LOCALES: string[] = ["en", "fr", "de", "ja"];
const INITIAL_LOCALISATION_TRANSLATIONS: LocalisationTranslations = {
  "ui.start_game": {
    en: "Start Game",
    fr: "Démarrer",
    de: "Spiel Starten",
    ja: "ゲーム開始",
  },
  "ui.settings": {
    en: "Settings",
    fr: "Paramètres",
    de: "Einstellungen",
    ja: "設定",
  },
  "ui.quit": { en: "Quit", fr: "Quitter", de: "Beenden", ja: "終了" },
  "dialog.hero.greeting": {
    en: "Hello, traveller!",
    fr: "Bonjour, voyageur!",
    de: "Hallo, Reisender!",
    ja: "こんにちは、旅人！",
  },
  "hud.health": { en: "Health", fr: "Santé", de: "Gesundheit", ja: "体力" },
};

// ── State / actions ──────────────────────────────────────────────────────────

interface LocalisationStoreState {
  localisationTranslations: LocalisationTranslations;
  localisationLocales: string[];
  setLocalisationTranslations: (t: LocalisationTranslations) => void;
  setLocalisationLocales: (locales: string[]) => void;
  resetLocalisationStore: () => void;
}

export const useLocalisationStore = create<LocalisationStoreState>((set) => ({
  localisationTranslations: INITIAL_LOCALISATION_TRANSLATIONS,
  localisationLocales: INITIAL_LOCALISATION_LOCALES,

  setLocalisationTranslations: (t) => set({ localisationTranslations: t }),
  setLocalisationLocales: (locales) => set({ localisationLocales: locales }),

  resetLocalisationStore: () =>
    set({
      localisationTranslations: {} as LocalisationTranslations,
      localisationLocales: ["en"],
    }),
}));

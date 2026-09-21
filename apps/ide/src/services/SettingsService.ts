import { z } from "zod";

function defaultBuildWorkers(): number {
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency > 0) {
    return Math.max(1, Math.floor(navigator.hardwareConcurrency / 2));
  }
  return 2;
}

export const IDESettingsSchema = z.object({
  masterVolume: z.number().min(0).max(1).default(1),
  sfxVolume: z.number().min(0).max(1).default(1),
  musicVolume: z.number().min(0).max(1).default(0.7),
  graphicsTier: z
    .enum(["auto", "potato", "low", "mid", "high", "ultra"])
    .default("auto"),
  autoBuild: z.boolean().default(true),
  autoBuildDebounceMs: z.number().int().min(100).max(2000).default(300),
  showFpsOverlay: z.boolean().default(true),
  theme: z.enum(["dark", "light", "system"]).default("dark"),
  editorFontSize: z.number().int().min(10).max(24).default(13),
  editorTabSize: z.number().int().min(2).max(8).default(2),
  editorWordWrap: z.boolean().default(false),
  editorMinimap: z.boolean().default(true),
  editorLineNumbers: z.boolean().default(true),
  /**
   * Explicit Monaco theme the user picked through Settings. `null` means
   * "never touched" — Monaco should keep following the IDE's light/dark
   * mode automatically. Once set, it sticks until the user picks
   * "Follow IDE theme" again.
   */
  editorMonacoThemeOverride: z
    .enum(["vs", "vs-dark", "hc-black", "hc-light"])
    .nullable()
    .default(null),
  /** Power / battery mode. 'saver' caps idle frame rate and disables non-essential effects. */
  powerMode: z.enum(["performance", "balanced", "saver"]).default("balanced"),
  /** Number of CPU cores to use when compiling (1–16). Default: half of available cores. */
  buildWorkers: z.number().int().min(1).max(16).default(defaultBuildWorkers()),
  /** Max CPU utilisation while navigating the IDE (0–100 %). Throttles idle requestAnimationFrame. */
  idleCpuCap: z.number().int().min(10).max(100).default(60),
});

export interface VSCodeSettingsImportResult {
  applied: string[];
  skipped: string[];
}

export function importVSCodeSettings(raw: unknown): {
  patch: Partial<IDESettings>;
  result: VSCodeSettingsImportResult;
} {
  const settings = raw as Record<string, unknown>;
  const patch: Partial<IDESettings> = {};
  const applied: string[] = [];
  const skipped: string[] = [];

  const fontSize = settings["editor.fontSize"];
  if (typeof fontSize === "number" && fontSize >= 10 && fontSize <= 24) {
    patch.editorFontSize = Math.round(fontSize);
    applied.push("editor.fontSize");
  } else if (fontSize !== undefined) {
    skipped.push("editor.fontSize");
  }

  const tabSize = settings["editor.tabSize"];
  if (typeof tabSize === "number" && tabSize >= 2 && tabSize <= 8) {
    patch.editorTabSize = Math.round(tabSize);
    applied.push("editor.tabSize");
  } else if (tabSize !== undefined) {
    skipped.push("editor.tabSize");
  }

  const wordWrap = settings["editor.wordWrap"];
  if (wordWrap === "on" || wordWrap === true) {
    patch.editorWordWrap = true;
    applied.push("editor.wordWrap");
  } else if (wordWrap === "off" || wordWrap === false) {
    patch.editorWordWrap = false;
    applied.push("editor.wordWrap");
  } else if (wordWrap !== undefined) {
    skipped.push("editor.wordWrap");
  }

  const minimap = settings["editor.minimap.enabled"];
  if (typeof minimap === "boolean") {
    patch.editorMinimap = minimap;
    applied.push("editor.minimap.enabled");
  }

  const lineNumbers = settings["editor.lineNumbers"];
  if (lineNumbers === "on" || lineNumbers === true) {
    patch.editorLineNumbers = true;
    applied.push("editor.lineNumbers");
  } else if (lineNumbers === "off" || lineNumbers === false) {
    patch.editorLineNumbers = false;
    applied.push("editor.lineNumbers");
  }

  const colorTheme = settings["workbench.colorTheme"];
  if (typeof colorTheme === "string") {
    const lower = colorTheme.toLowerCase();
    if (
      lower.includes("light") ||
      lower.includes("white") ||
      lower.includes("solarized light") ||
      lower.includes("github light")
    ) {
      patch.theme = "light";
      applied.push("workbench.colorTheme → light");
    } else if (
      lower.includes("dark") ||
      lower.includes("black") ||
      lower.includes("monokai") ||
      lower.includes("dracula") ||
      lower.includes("one dark") ||
      lower.includes("night")
    ) {
      patch.theme = "dark";
      applied.push("workbench.colorTheme → dark");
    } else {
      skipped.push("workbench.colorTheme (unrecognised)");
    }
  }

  return { patch, result: { applied, skipped } };
}

export type IDESettings = z.infer<typeof IDESettingsSchema>;

const STORAGE_KEY = "emptysock:ide-settings";

export function loadSettings(): IDESettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return IDESettingsSchema.parse({});
    return IDESettingsSchema.parse(JSON.parse(raw) as unknown);
  } catch {
    return IDESettingsSchema.parse({});
  }
}

export function saveSettings(settings: IDESettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetSettings(): IDESettings {
  localStorage.removeItem(STORAGE_KEY);
  return IDESettingsSchema.parse({});
}

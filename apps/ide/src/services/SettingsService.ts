import { z } from 'zod';

export const IDESettingsSchema = z.object({
  masterVolume: z.number().min(0).max(1).default(1),
  sfxVolume: z.number().min(0).max(1).default(1),
  musicVolume: z.number().min(0).max(1).default(0.7),
  graphicsTier: z.enum(['auto', 'potato', 'low', 'mid', 'high', 'ultra']).default('auto'),
  autoBuild: z.boolean().default(true),
  autoBuildDebounceMs: z.number().int().min(100).max(2000).default(300),
  showFpsOverlay: z.boolean().default(true),
  theme: z.enum(['dark']).default('dark'),
  editorFontSize: z.number().int().min(10).max(24).default(13),
});

export type IDESettings = z.infer<typeof IDESettingsSchema>;

const STORAGE_KEY = 'emptysock:ide-settings';

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

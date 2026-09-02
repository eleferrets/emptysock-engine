import fs from "node:fs";
import path from "node:path";

export type WindowMode = "windowed" | "fullscreen" | "borderless";

export interface WindowConfig {
  mode: WindowMode;
  width: number;
  height: number;
  title: string;
  resizable: boolean;
  minWidth: number;
  minHeight: number;
}

interface TauriWindowEntry {
  title?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  fullscreen?: boolean;
  decorations?: boolean;
  maximized?: boolean;
}

interface TauriConf {
  app?: {
    windows?: TauriWindowEntry[];
  };
  [key: string]: unknown;
}

/**
 * Read the window config section from a .project.json file.
 * Returns undefined if the file does not exist or has no windowConfig key.
 */
export function readWindowConfig(
  projectJsonPath: string,
): WindowConfig | undefined {
  try {
    const raw = fs.readFileSync(projectJsonPath, "utf8");
    const proj = JSON.parse(raw) as Record<string, unknown>;
    const wc = proj["windowConfig"];
    if (wc === null || typeof wc !== "object") return undefined;
    return wc as WindowConfig;
  } catch {
    return undefined;
  }
}

/**
 * Patch the first window entry in tauri.conf.json to match the given
 * WindowConfig. Creates or overwrites only the keys EmptySock manages;
 * all other tauri.conf.json keys are left intact.
 */
export function applyWindowConfigToTauri(
  tauriConfPath: string,
  config: WindowConfig,
): void {
  const raw = fs.readFileSync(tauriConfPath, "utf8");
  const conf = JSON.parse(raw) as TauriConf;

  conf.app ??= {};
  conf.app.windows ??= [{}];

  const win: TauriWindowEntry = conf.app.windows[0] ?? {};

  win.title = config.title;
  win.resizable = config.resizable;
  win.minWidth = config.minWidth;
  win.minHeight = config.minHeight;

  switch (config.mode) {
    case "fullscreen":
      win.fullscreen = true;
      win.decorations = true;
      win.maximized = false;
      win.width = config.width;
      win.height = config.height;
      break;
    case "borderless":
      win.fullscreen = false;
      win.decorations = false;
      win.maximized = true;
      win.width = config.width;
      win.height = config.height;
      break;
    case "windowed":
      win.fullscreen = false;
      win.decorations = true;
      win.maximized = false;
      win.width = config.width;
      win.height = config.height;
      break;
  }

  conf.app.windows[0] = win;

  fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2) + "\n", "utf8");
}

/**
 * Convenience: read window config from a project directory and apply it to
 * the tauri.conf.json in the same or a sibling location.
 *
 * projectDir  — directory containing emptysock.project.json
 * tauriDir    — directory containing tauri.conf.json (defaults to projectDir)
 */
export function syncWindowConfigToTauri(
  projectDir: string,
  tauriDir: string = projectDir,
): boolean {
  const projectJsonPath = path.join(projectDir, "emptysock.project.json");
  const tauriConfPath = path.join(tauriDir, "tauri.conf.json");

  const config = readWindowConfig(projectJsonPath);
  if (config === undefined) return false;

  applyWindowConfigToTauri(tauriConfPath, config);
  return true;
}

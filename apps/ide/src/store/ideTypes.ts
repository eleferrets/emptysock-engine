// ── Shared IDE types ─────────────────────────────────────────────────────────
// Extracted from ideStore.ts so ProjectSerializer and other modules can import
// these without creating a circular dependency on the store itself.

export type LogLevel = "info" | "warn" | "error" | "debug";
export type BuildMode = "debug" | "release";
export type BuildStatus = "idle" | "building" | "success" | "error";
export type Theme = "dark" | "light" | "system";

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

export const DEFAULT_WINDOW_CONFIG: WindowConfig = {
  mode: "windowed",
  width: 1280,
  height: 720,
  title: "My Game",
  resizable: true,
  minWidth: 320,
  minHeight: 240,
};

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  source: string | undefined;
}

export interface EntityItem {
  id: string;
  name: string;
  type: string;
  active: boolean;
  components: string[];
  children: EntityItem[];
}

export interface AssetItem {
  id: string;
  name: string;
  type: "image" | "audio" | "font" | "json" | "scene" | "script";
  path: string;
  size?: number;
}

export interface EntitySnapshot {
  id: string;
  name: string;
  active: boolean;
  components: string[];
  tags: string[];
  x: number;
  y: number;
  rotation: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  children?: FileTreeNode[];
}

export interface ProjectFile {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: ProjectFile[];
}

export interface RecentFile {
  path: string;
  name: string;
  openedAt: number;
}

export type PlayState = "stopped" | "playing" | "paused";
export type ActiveTab = "code" | "canvas" | "scene";
export type BottomTab = "console" | "assets";

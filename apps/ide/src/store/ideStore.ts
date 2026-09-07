import { create } from "zustand";
import { DEFAULT_ENABLED_MODULES } from "../services/ModuleRegistry";
import { useDBStore, type DbEntry } from "./dbStore";
import { useSequenceStore, type SequenceTrack } from "./sequenceStore";
import {
  useLocalisationStore,
  type LocalisationTranslations,
} from "./localisationStore";
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

// ── Audio Mixer ──────────────────────────────────────────────────────────────
export interface AudioBus {
  id: string;
  label: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  color: string;
}

const INITIAL_AUDIO_BUSES: AudioBus[] = [
  {
    id: "master",
    label: "Master",
    volume: 80,
    muted: false,
    solo: false,
    color: "#a78bfa",
  },
  {
    id: "music",
    label: "Music",
    volume: 70,
    muted: false,
    solo: false,
    color: "#60a5fa",
  },
  {
    id: "sfx",
    label: "SFX",
    volume: 90,
    muted: false,
    solo: false,
    color: "#4ade80",
  },
  {
    id: "voice",
    label: "Voice",
    volume: 100,
    muted: false,
    solo: false,
    color: "#fbbf24",
  },
  {
    id: "ambient",
    label: "Ambient",
    volume: 50,
    muted: false,
    solo: false,
    color: "#f87171",
  },
];

// ── Tilemap editor ───────────────────────────────────────────────────────────
export interface TileLayer {
  id: string;
  name: string;
  data: Record<string, number>; // "col,row" -> tileIndex
}

interface TransformValues {
  x: string;
  y: string;
  rotation: string;
  scaleX: string;
  scaleY: string;
}

interface SelectedEntity {
  id: string;
  name: string;
  type: string;
  transform: TransformValues;
  components: Array<{
    type: string;
    enabled: boolean;
    properties: Record<string, string>;
  }>;
}

interface IDEState {
  // Layout
  activeTab: ActiveTab;
  bottomTab: BottomTab;
  leftSidebarWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;

  // Project
  projectName: string;
  projectFolder: string;
  files: ProjectFile[];
  selectedFile: string | null;
  editorCode: string;

  // Multi-file editing
  openFiles: Record<string, string>;
  activeFilePath: string | null;

  // Scene
  entities: EntityItem[];
  selectedEntityId: string | null;
  selectedEntity: SelectedEntity | null;

  // Assets
  assets: AssetItem[];

  // Project asset state (recent + room order)
  recentAssetIds: string[];
  roomOrder: string[];

  // Recent files
  recentFiles: RecentFile[];

  // Playback
  playState: PlayState;
  fps: number;

  // Console
  logs: LogEntry[];

  // Debugger
  debuggerPaused: boolean;
  debuggerVars: Record<string, unknown>;
  debugBreakpoints: string[];

  // Build
  buildMode: BuildMode;
  buildStatus: BuildStatus;
  buildErrors: string[];
  buildDuration: number | null;
  debugOverlay: boolean;
  lastBuildAt: number | null;

  // Settings modal
  settingsOpen: boolean;

  // Project settings modal
  projectSettingsOpen: boolean;

  // Module registry
  enabledModules: string[];

  // Window
  windowConfig: WindowConfig;

  // Theme
  theme: Theme;

  // Image editor
  dropImportFolder: 'root' | 'last';
  openImageEditorRequest: { assetId: string; ts: number } | null;

  // Actions
  setActiveTab: (tab: ActiveTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setPlayState: (state: PlayState) => void;
  setFps: (fps: number) => void;
  addLog: (level: LogLevel, message: string, source?: string) => void;
  clearLogs: () => void;
  selectEntity: (id: string | null) => void;
  selectFile: (path: string | null) => void;
  setEditorCode: (code: string) => void;
  updateEntityTransform: (
    entityId: string,
    transform: Partial<TransformValues>,
  ) => void;

  // Multi-file actions
  openFile: (path: string, content?: string) => void;
  closeFile: (path: string) => void;
  setFileContent: (path: string, content: string) => void;

  // Build actions
  setBuildMode: (mode: BuildMode) => void;
  toggleBuildMode: () => void;
  setBuildStatus: (
    status: BuildStatus,
    errors?: string[],
    duration?: number,
  ) => void;
  toggleDebugOverlay: () => void;
  clearBuildCache: () => void;

  // Settings modal action
  setSettingsOpen: (open: boolean) => void;

  // Project settings modal action
  setProjectSettingsOpen: (open: boolean) => void;

  // Module actions
  toggleModule: (id: string) => void;

  // Window action
  setWindowConfig: (config: Partial<WindowConfig>) => void;

  // Theme action
  setTheme: (theme: Theme) => void;

  // Project folder
  setProjectFolder: (folder: string) => void;

  // Recent files action
  addRecentFile: (path: string, name: string) => void;
  clearRecentFiles: () => void;

  // Entity actions
  addEntity: (name: string, parentId?: string) => void;
  deleteEntity: (id: string) => void;
  renameEntity: (id: string, name: string) => void;
  toggleEntityActive: (id: string) => void;
  addComponentToEntity: (entityId: string, componentType: string) => void;
  removeComponentFromEntity: (entityId: string, componentType: string) => void;

  // Asset actions
  addAsset: (asset: AssetItem) => void;
  deleteAsset: (id: string) => void;
  setRecentAssetIds: (ids: string[]) => void;
  setRoomOrder: (ids: string[]) => void;

  // AudioMixer persistent state
  audioBuses: AudioBus[];
  setAudioBus: (id: string, patch: Partial<Omit<AudioBus, "id">>) => void;
  addAudioBus: () => void;

  // TilemapEditor persistent state
  tilemapLayers: TileLayer[];
  tilemapActiveLayer: string;
  setTilemapLayers: (layers: TileLayer[]) => void;
  setTilemapActiveLayer: (id: string) => void;

  // VariableStore persistent state
  variableStoreVars: Record<number, number>;
  variableStoreSwitches: Record<number, boolean>;
  variableStoreVarNames: Record<number, string>;
  variableStoreSwitchNames: Record<number, string>;
  setVar: (index: number, value: number) => void;
  setSwitch: (index: number, value: boolean) => void;
  setVarName: (index: number, name: string) => void;
  setSwitchName: (index: number, name: string) => void;

  // Story Graph node cache (shared with VN Preview)
  vnNodes: VnNode[];
  setVNNodes: (nodes: VnNode[]) => void;

  // Auto-tile rule sets per tileset (baseTileIndex → serialised rules)
  autoTileRuleSets: Record<string, AutoTileRule[]>;
  setAutoTileRuleSets: (ruleSets: Record<string, AutoTileRule[]>) => void;

  // Editor grid / ruler / alignment guides
  editorGridSize: number;
  editorShowGrid: boolean;
  editorShowRuler: boolean;
  editorSnapToGrid: boolean;
  editorShowGuides: boolean;
  setEditorGridSize: (size: number) => void;
  setEditorShowGrid: (show: boolean) => void;
  setEditorShowRuler: (show: boolean) => void;
  setEditorSnapToGrid: (snap: boolean) => void;
  setEditorShowGuides: (show: boolean) => void;

  // Preview FPS cap
  fpsTarget: number;
  setFpsTarget: (fps: number) => void;

  // Debugger actions
  setDebuggerPaused: (paused: boolean) => void;
  setDebuggerVars: (vars: Record<string, unknown>) => void;
  addBreakpoint: (label: string) => void;
  removeBreakpoint: (label: string) => void;
  _dispatchDebugCommand: (type: string) => void;

  // Image editor actions
  setDropImportFolder: (folder: 'root' | 'last') => void;
  openImageEditor: (assetId: string) => void;

  // Project lifecycle
  resetProject: () => void;
  loadProjectFiles: (files: Record<string, string>, name?: string) => void;
  saveProjectJson: () => string;
}

const INITIAL_CODE = `import { Scene, Entity, Transform, Sprite } from '@emptysock/engine';

export class GameScene extends Scene {
  constructor() {
    super('GameScene');
  }

  override start(): void {
    super.start();
    const player = this.createEntity('Player');
    player.addComponent(new Transform({ x: 640, y: 360 }));
    player.addComponent(new Sprite({ tint: 0x7c6af7 }));
    player.addTag('player');

    const ground = this.createEntity('Ground');
    ground.addComponent(new Transform({ x: 640, y: 680 }));
    ground.addComponent(new Sprite({ tint: 0x4ade80 }));
    ground.addTag('ground');

    console.log('GameScene started with', this.getEntities().size, 'entities');
  }
}
`;

const INITIAL_FILES: ProjectFile[] = [
  {
    name: "src",
    path: "src",
    type: "folder",
    children: [
      { name: "main.ts", path: "src/main.ts", type: "file" },
      {
        name: "scenes",
        path: "src/scenes",
        type: "folder",
        children: [
          {
            name: "GameScene.ts",
            path: "src/scenes/GameScene.ts",
            type: "file",
          },
          {
            name: "MenuScene.ts",
            path: "src/scenes/MenuScene.ts",
            type: "file",
          },
        ],
      },
      {
        name: "entities",
        path: "src/entities",
        type: "folder",
        children: [
          { name: "Player.ts", path: "src/entities/Player.ts", type: "file" },
          { name: "Enemy.js", path: "src/entities/Enemy.js", type: "file" },
        ],
      },
    ],
  },
  {
    name: "assets",
    path: "assets",
    type: "folder",
    children: [
      { name: "player.png", path: "assets/player.png", type: "file" },
      { name: "tileset.png", path: "assets/tileset.png", type: "file" },
      { name: "jump.ogg", path: "assets/jump.ogg", type: "file" },
      { name: "music.ogg", path: "assets/music.ogg", type: "file" },
    ],
  },
  {
    name: "emptysock.project.json",
    path: "emptysock.project.json",
    type: "file",
  },
];

const INITIAL_ENTITIES: EntityItem[] = [
  {
    id: "ent-1",
    name: "Player",
    type: "Entity",
    active: true,
    components: ["Transform", "Sprite", "CharacterController"],
    children: [],
  },
  {
    id: "ent-2",
    name: "Ground",
    type: "Entity",
    active: true,
    components: ["Transform", "Sprite", "PhysicsBody"],
    children: [],
  },
  {
    id: "ent-3",
    name: "Camera",
    type: "Entity",
    active: true,
    components: ["Transform", "CameraSystem"],
    children: [],
  },
  {
    id: "ent-4",
    name: "Enemies",
    type: "Entity",
    active: true,
    components: ["Transform"],
    children: [
      {
        id: "ent-4-1",
        name: "Slime_01",
        type: "Entity",
        active: true,
        components: ["Transform", "Sprite", "PhysicsBody"],
        children: [],
      },
      {
        id: "ent-4-2",
        name: "Slime_02",
        type: "Entity",
        active: false,
        components: ["Transform", "Sprite", "PhysicsBody"],
        children: [],
      },
    ],
  },
];

const INITIAL_ASSETS: AssetItem[] = [
  {
    id: "ast-1",
    name: "player.png",
    type: "image",
    path: "assets/player.png",
    size: 12400,
  },
  {
    id: "ast-2",
    name: "tileset.png",
    type: "image",
    path: "assets/tileset.png",
    size: 88200,
  },
  {
    id: "ast-3",
    name: "jump.ogg",
    type: "audio",
    path: "assets/jump.ogg",
    size: 34000,
  },
  {
    id: "ast-4",
    name: "music.ogg",
    type: "audio",
    path: "assets/music.ogg",
    size: 2800000,
  },
  {
    id: "ast-5",
    name: "GameScene.ts",
    type: "script",
    path: "src/scenes/GameScene.ts",
    size: 1200,
  },
  {
    id: "ast-6",
    name: "ui.json",
    type: "json",
    path: "src/ui.json",
    size: 4400,
  },
];

// ── Tilemap initial data ─────────────────────────────────────────────────────
const INITIAL_TILEMAP_LAYERS: TileLayer[] = [
  { id: "layer-0", name: "Ground", data: {} },
  { id: "layer-1", name: "Objects", data: {} },
];

// ── VN / auto-tile types ─────────────────────────────────────────────────────
export interface VnNode {
  id: string;
  [key: string]: unknown;
}

export interface AutoTileRule {
  [key: string]: unknown;
}

// ── Entity tree helpers ──────────────────────────────────────────────────────
function findInTree(
  items: EntityItem[],
  predicate: (e: EntityItem) => boolean,
): EntityItem | null {
  for (const e of items) {
    if (predicate(e)) return e;
    const found = findInTree(e.children, predicate);
    if (found !== null) return found;
  }
  return null;
}

function mapTree(
  items: EntityItem[],
  transform: (e: EntityItem) => EntityItem,
): EntityItem[] {
  return items.map((e) => {
    const t = transform(e);
    return { ...t, children: mapTree(t.children, transform) };
  });
}

let logCounter = 0;

// ── Initial project state factory ───────────────────────────────────────────
// All fields that should be wiped on resetProject() or loadProjectFiles().
// Adding a new resettable field here automatically propagates to both callers.
function initialProjectState() {
  return {
    projectName: "MyPlatformer",
    projectFolder: "",
    files: INITIAL_FILES,
    selectedFile: "src/scenes/GameScene.ts",
    editorCode: INITIAL_CODE,
    openFiles: { "src/scenes/GameScene.ts": INITIAL_CODE },
    activeFilePath: "src/scenes/GameScene.ts",
    playState: "stopped" as const,
    buildStatus: "idle" as const,
    buildErrors: [] as string[],
    buildDuration: null as number | null,
    lastBuildAt: null as number | null,
    logs: [] as LogEntry[],
    entities: [] as EntityItem[],
    selectedEntityId: null as string | null,
    selectedEntity: null,
    assets: [] as AssetItem[],
    recentAssetIds: [] as string[],
    roomOrder: [] as string[],
    enabledModules: DEFAULT_ENABLED_MODULES,
    audioBuses: INITIAL_AUDIO_BUSES,
    tilemapLayers: [] as TileLayer[],
    tilemapActiveLayer: "layer-0",
    variableStoreVars: {} as Record<number, number>,
    variableStoreSwitches: {} as Record<number, boolean>,
    variableStoreVarNames: {} as Record<number, string>,
    variableStoreSwitchNames: {} as Record<number, string>,
    vnNodes: [] as VnNode[],
    autoTileRuleSets: {} as Record<string, AutoTileRule[]>,
    editorGridSize: 32,
    editorShowGrid: true,
    editorShowRuler: true,
    editorSnapToGrid: true,
    editorShowGuides: true,
    windowConfig: { ...DEFAULT_WINDOW_CONFIG },
    debuggerPaused: false,
    debuggerVars: {} as Record<string, unknown>,
    debugBreakpoints: [] as string[],
    dropImportFolder: "root" as const,
    openImageEditorRequest: null as { assetId: string; ts: number } | null,
  };
}

// ── Debug command bus ────────────────────────────────────────────────────────
// A lightweight EventTarget that CanvasPreview subscribes to so it can forward
// debugger commands to the game iframe without adding unnecessary store state.
export const debugCommandBus = new EventTarget();

export const useIDEStore = create<IDEState>((set, get) => ({
  // Layout
  activeTab: "code",
  bottomTab: "console",
  leftSidebarWidth: 240,
  rightPanelWidth: 280,
  bottomPanelHeight: 180,
  sidebarOpen: false,
  rightPanelOpen: false,

  // Project
  projectName: "MyPlatformer",
  projectFolder: "",
  files: INITIAL_FILES,
  selectedFile: "src/scenes/GameScene.ts",
  editorCode: INITIAL_CODE,

  // Multi-file editing — seed with the default file open
  openFiles: { "src/scenes/GameScene.ts": INITIAL_CODE },
  activeFilePath: "src/scenes/GameScene.ts",

  // Scene
  entities: INITIAL_ENTITIES,
  selectedEntityId: "ent-1",
  selectedEntity: {
    id: "ent-1",
    name: "Player",
    type: "Entity",
    transform: { x: "640", y: "360", rotation: "0", scaleX: "1", scaleY: "1" },
    components: [
      {
        type: "Transform",
        enabled: true,
        properties: { x: "640", y: "360", rotation: "0" },
      },
      {
        type: "Sprite",
        enabled: true,
        properties: { tint: "#7c6af7", alpha: "1" },
      },
      {
        type: "CharacterController",
        enabled: true,
        properties: { speed: "200", jumpForce: "400" },
      },
    ],
  },

  // Assets
  assets: INITIAL_ASSETS,
  recentAssetIds: [],
  roomOrder: [],

  // Recent files
  recentFiles: [],

  // Playback
  playState: "stopped",
  fps: 0,

  // Console
  logs: [
    {
      id: "log-0",
      level: "info",
      message: "EmptySock Engine ready. Press Run to start your game.",
      timestamp: Date.now(),
      source: "IDE",
    },
  ],

  // Debugger
  debuggerPaused: false,
  debuggerVars: {},
  debugBreakpoints: [],

  // Build
  buildMode: "debug",
  buildStatus: "idle",
  buildErrors: [],
  buildDuration: null,
  debugOverlay: false,
  lastBuildAt: null,

  // Settings modal
  settingsOpen: false,

  // Project settings modal
  projectSettingsOpen: false,

  // Module registry
  enabledModules: DEFAULT_ENABLED_MODULES,
  windowConfig: { ...DEFAULT_WINDOW_CONFIG },

  // Theme
  theme: "dark",

  // Image editor
  dropImportFolder: 'root' as const,
  openImageEditorRequest: null,

  // AudioMixer persistent state
  audioBuses: INITIAL_AUDIO_BUSES,

  // TilemapEditor persistent state
  tilemapLayers: INITIAL_TILEMAP_LAYERS,
  tilemapActiveLayer: "layer-0",

  // VariableStore persistent state
  variableStoreVars: {},
  variableStoreSwitches: {},
  variableStoreVarNames: {},
  variableStoreSwitchNames: {},

  // Story Graph node cache
  vnNodes: [],

  // Auto-tile rule sets
  autoTileRuleSets: {},

  // Editor grid / ruler / alignment guides
  editorGridSize: 32,
  editorShowGrid: true,
  editorShowRuler: true,
  editorSnapToGrid: true,
  editorShowGuides: true,

  // Preview FPS cap
  fpsTarget: 60,

  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setBottomTab: (tab) => set({ bottomTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  setPlayState: (state) => {
    set({ playState: state });
    const { addLog } = get();
    if (state === "playing") addLog("info", "Game started", "Engine");
    else if (state === "paused") addLog("info", "Game paused", "Engine");
    else addLog("info", "Game stopped", "Engine");
  },

  setFps: (fps) => set({ fps }),

  addLog: (level, message, source) => {
    const entry: LogEntry = {
      id: `log-${logCounter++}`,
      level,
      message,
      timestamp: Date.now(),
      source,
    };
    set((s) => ({ logs: [...s.logs.slice(-199), entry] }));
  },

  clearLogs: () => set({ logs: [] }),

  selectEntity: (id) => {
    if (id === null) {
      set({ selectedEntityId: null, selectedEntity: null });
      return;
    }
    const { entities } = get();
    const entity = findInTree(entities, (e) => e.id === id);
    if (entity === null) return;
    // Preserve existing transform if this entity is already selected (avoid clobbering edits)
    const existing = get().selectedEntity;
    const existingTransform =
      existing?.id === id ? existing.transform : undefined;
    set({
      selectedEntityId: id,
      selectedEntity: {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        transform: existingTransform ?? {
          x: "0",
          y: "0",
          rotation: "0",
          scaleX: "1",
          scaleY: "1",
        },
        components: entity.components.map((c) => ({
          type: c,
          enabled: true,
          properties: getDefaultProperties(c),
        })),
      },
    });
  },

  selectFile: (path) => set({ selectedFile: path }),
  setEditorCode: (code) => {
    const { activeFilePath } = get();
    set({ editorCode: code });
    if (activeFilePath !== null) {
      set((s) => ({ openFiles: { ...s.openFiles, [activeFilePath]: code } }));
    }
  },

  updateEntityTransform: (entityId, transform) => {
    set((s) => {
      if (s.selectedEntity?.id !== entityId) return s;
      return {
        selectedEntity: {
          ...s.selectedEntity,
          transform: { ...s.selectedEntity.transform, ...transform },
        },
      };
    });
  },

  // Multi-file actions
  openFile: (path, content) => {
    set((s) => {
      const existing = s.openFiles[path];
      const newContent = content ?? existing ?? "";
      const name = path.split("/").pop() ?? path;
      const entry: RecentFile = { path, name, openedAt: Date.now() };
      const filtered = s.recentFiles.filter((r) => r.path !== path);
      const recentFiles = [entry, ...filtered].slice(0, 10);
      return {
        openFiles: { ...s.openFiles, [path]: newContent },
        activeFilePath: path,
        selectedFile: path,
        editorCode: newContent,
        recentFiles,
      };
    });
  },

  closeFile: (path) => {
    set((s) => {
      const next = { ...s.openFiles };
      delete next[path];
      const keys = Object.keys(next);
      const newActive =
        s.activeFilePath === path
          ? (keys[keys.length - 1] ?? null)
          : s.activeFilePath;
      const newCode =
        newActive !== null ? (next[newActive] ?? s.editorCode) : s.editorCode;
      return {
        openFiles: next,
        activeFilePath: newActive,
        editorCode: newCode,
      };
    });
  },

  setFileContent: (path, content) => {
    set((s) => ({
      openFiles: { ...s.openFiles, [path]: content },
      editorCode: s.activeFilePath === path ? content : s.editorCode,
    }));
  },

  setBuildMode: (mode) => set({ buildMode: mode }),
  toggleBuildMode: () =>
    set((s) => ({ buildMode: s.buildMode === "debug" ? "release" : "debug" })),

  setBuildStatus: (status, errors, duration) => {
    set({
      buildStatus: status,
      buildErrors: errors ?? [],
      buildDuration: duration !== undefined ? duration : null,
      lastBuildAt:
        status === "success" || status === "error"
          ? Date.now()
          : get().lastBuildAt,
    });
  },

  toggleDebugOverlay: () => set((s) => ({ debugOverlay: !s.debugOverlay })),

  clearBuildCache: () => {
    set({
      buildStatus: "idle",
      buildErrors: [],
      lastBuildAt: null,
      buildDuration: null,
    });
    get().addLog("info", "Build cache cleared", "BuildService");
  },

  addRecentFile: (path, name) => {
    set((s) => {
      const entry: RecentFile = { path, name, openedAt: Date.now() };
      const filtered = s.recentFiles.filter((r) => r.path !== path);
      return { recentFiles: [entry, ...filtered].slice(0, 10) };
    });
  },
  clearRecentFiles: () => set({ recentFiles: [] }),

  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setProjectSettingsOpen: (open) => set({ projectSettingsOpen: open }),
  toggleModule: (id) =>
    set((s) => ({
      enabledModules: s.enabledModules.includes(id)
        ? s.enabledModules.filter((m) => m !== id)
        : [...s.enabledModules, id],
    })),
  setWindowConfig: (config) =>
    set((s) => ({ windowConfig: { ...s.windowConfig, ...config } })),

  setTheme: (t) => set({ theme: t }),
  setProjectFolder: (folder) => set({ projectFolder: folder }),

  setAudioBus: (id, patch) =>
    set((s) => ({
      audioBuses: s.audioBuses.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      ),
    })),
  addAudioBus: () =>
    set((s) => ({
      audioBuses: [
        ...s.audioBuses,
        {
          id: `bus-${Date.now()}`,
          label: "Bus",
          volume: 80,
          muted: false,
          solo: false,
          color: "#94a3b8",
        },
      ],
    })),

  setTilemapLayers: (layers) => set({ tilemapLayers: layers }),
  setTilemapActiveLayer: (id) => set({ tilemapActiveLayer: id }),

  setVar: (index, value) =>
    set((s) => ({
      variableStoreVars: { ...s.variableStoreVars, [index]: Math.floor(value) },
    })),
  setSwitch: (index, value) =>
    set((s) => ({
      variableStoreSwitches: { ...s.variableStoreSwitches, [index]: value },
    })),
  setVarName: (index, name) =>
    set((s) => ({
      variableStoreVarNames: { ...s.variableStoreVarNames, [index]: name },
    })),
  setSwitchName: (index, name) =>
    set((s) => ({
      variableStoreSwitchNames: {
        ...s.variableStoreSwitchNames,
        [index]: name,
      },
    })),

  setVNNodes: (nodes: VnNode[]) => set({ vnNodes: nodes }),
  setAutoTileRuleSets: (ruleSets: Record<string, AutoTileRule[]>) => set({ autoTileRuleSets: ruleSets }),

  setEditorGridSize: (size) => set({ editorGridSize: Math.max(4, size) }),
  setEditorShowGrid: (show) => set({ editorShowGrid: show }),
  setEditorShowRuler: (show) => set({ editorShowRuler: show }),
  setEditorSnapToGrid: (snap) => set({ editorSnapToGrid: snap }),
  setEditorShowGuides: (show) => set({ editorShowGuides: show }),
  setFpsTarget: (fps) => set({ fpsTarget: fps }),

  // Debugger actions
  setDebuggerPaused: (paused) => set({ debuggerPaused: paused }),
  setDebuggerVars: (vars) => set({ debuggerVars: vars }),
  addBreakpoint: (label) =>
    set((s) => ({
      debugBreakpoints: s.debugBreakpoints.includes(label)
        ? s.debugBreakpoints
        : [...s.debugBreakpoints, label],
    })),
  removeBreakpoint: (label) =>
    set((s) => ({
      debugBreakpoints: s.debugBreakpoints.filter((l) => l !== label),
    })),
  _dispatchDebugCommand: (type) => {
    debugCommandBus.dispatchEvent(
      new CustomEvent('debug-cmd', { detail: { type } }),
    );
  },

  // Image editor actions
  setDropImportFolder: (folder) => set({ dropImportFolder: folder }),
  openImageEditor: (assetId) =>
    set({ openImageEditorRequest: { assetId, ts: Date.now() } }),

  resetProject: () => {
    set({ ...initialProjectState() });
    useDBStore.getState().resetDBStore();
    useSequenceStore.getState().resetSequenceStore();
    useLocalisationStore.getState().resetLocalisationStore();
    get().addLog("info", "New project created", "IDE");
  },

  addEntity: (name, parentId) => {
    const newEntity: EntityItem = {
      id: `ent-${Date.now()}`,
      name,
      type: "Entity",
      active: true,
      components: ["Transform"],
      children: [],
    };
    set((s) => {
      if (parentId === undefined) {
        return { entities: [...s.entities, newEntity] };
      }
      return {
        entities: mapTree(s.entities, (e) =>
          e.id === parentId
            ? { ...e, children: [...e.children, newEntity] }
            : e,
        ),
      };
    });
    get().addLog("info", `Entity "${name}" created`, "IDE");
  },

  deleteEntity: (id) => {
    set((s) => {
      const next = mapTree(
        s.entities.filter((e) => e.id !== id),
        (e) => ({ ...e, children: e.children.filter((c) => c.id !== id) }),
      );
      return {
        entities: next,
        selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
        selectedEntity: s.selectedEntity?.id === id ? null : s.selectedEntity,
      };
    });
    get().addLog("info", `Entity deleted`, "IDE");
  },

  renameEntity: (id, name) => {
    set((s) => {
      return {
        entities: mapTree(s.entities, (e) => (e.id === id ? { ...e, name } : e)),
        selectedEntity:
          s.selectedEntity?.id === id
            ? { ...s.selectedEntity, name }
            : s.selectedEntity,
      };
    });
  },

  toggleEntityActive: (id) => {
    set((s) => ({
      entities: mapTree(s.entities, (e) =>
        e.id === id ? { ...e, active: !e.active } : e,
      ),
    }));
  },

  addComponentToEntity: (entityId, componentType) => {
    set((s) => {
      const newEntities = mapTree(s.entities, (e) =>
        e.id === entityId && !e.components.includes(componentType)
          ? { ...e, components: [...e.components, componentType] }
          : e,
      );
      const newComponent = {
        type: componentType,
        enabled: true,
        properties: getDefaultProperties(componentType),
      };
      return {
        entities: newEntities,
        selectedEntity:
          s.selectedEntity?.id === entityId
            ? {
                ...s.selectedEntity,
                components: [
                  ...s.selectedEntity.components.filter(
                    (c) => c.type !== componentType,
                  ),
                  newComponent,
                ],
              }
            : s.selectedEntity,
      };
    });
  },

  removeComponentFromEntity: (entityId, componentType) => {
    set((s) => {
      return {
        entities: mapTree(s.entities, (e) =>
          e.id === entityId
            ? { ...e, components: e.components.filter((c) => c !== componentType) }
            : e,
        ),
        selectedEntity:
          s.selectedEntity?.id === entityId
            ? {
                ...s.selectedEntity,
                components: s.selectedEntity.components.filter(
                  (c) => c.type !== componentType,
                ),
              }
            : s.selectedEntity,
      };
    });
  },

  addAsset: (asset) => {
    set((s) => ({
      assets: [...s.assets.filter((a) => a.id !== asset.id), asset],
    }));
    get().addLog("info", `Asset "${asset.name}" imported`, "IDE");
  },

  deleteAsset: (id) => {
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));
    get().addLog("info", "Asset deleted", "IDE");
  },

  setRecentAssetIds: (ids) => set({ recentAssetIds: ids }),
  setRoomOrder: (ids) => set({ roomOrder: ids }),

  saveProjectJson: () => {
    const s = get();
    const db = useDBStore.getState();
    const seq = useSequenceStore.getState();
    const loc = useLocalisationStore.getState();
    return JSON.stringify(
      {
        projectName: get().projectName,
        entities: s.entities,
        assets: s.assets,
        enabledModules: s.enabledModules,
        audioBuses: s.audioBuses,
        tilemapLayers: s.tilemapLayers,
        tilemapActiveLayer: s.tilemapActiveLayer,
        sequenceTracks: seq.sequenceTracks,
        sequenceDuration: seq.sequenceDuration,
        localisationTranslations: loc.localisationTranslations,
        localisationLocales: loc.localisationLocales,
        variableStoreVars: s.variableStoreVars,
        variableStoreSwitches: s.variableStoreSwitches,
        variableStoreVarNames: s.variableStoreVarNames,
        variableStoreSwitchNames: s.variableStoreSwitchNames,
        windowConfig: s.windowConfig,
        vnNodes: s.vnNodes,
        autoTileRuleSets: s.autoTileRuleSets,
        dbActors: db.dbActors,
        dbClasses: db.dbClasses,
        dbItems: db.dbItems,
        dbEnemies: db.dbEnemies,
        editorGridSize: s.editorGridSize,
        editorShowGrid: s.editorShowGrid,
        editorShowRuler: s.editorShowRuler,
        editorSnapToGrid: s.editorSnapToGrid,
        editorShowGuides: s.editorShowGuides,
      },
      null,
      2,
    );
  },

  loadProjectFiles: (files, name) => {
    const paths = Object.keys(files);

    // Separate the .project.json entry from code files
    const projectJsonKey = paths.find((p) => p.endsWith(".project.json"));
    const codeFiles = Object.fromEntries(
      Object.entries(files).filter(([p]) => !p.endsWith(".project.json")),
    );
    const codePaths = Object.keys(codeFiles);
    const firstPath = codePaths[0] ?? null;
    const projectFiles: ProjectFile[] = codePaths.map((p) => ({
      name: p.split("/").pop() ?? p,
      path: p,
      type: "file" as const,
    }));

    set({
      projectName: name ?? "LoadedProject",
      files: projectFiles,
      openFiles: codeFiles,
      activeFilePath: firstPath,
      selectedFile: firstPath,
      editorCode: firstPath !== null ? (codeFiles[firstPath] ?? "") : "",
      playState: "stopped",
      buildStatus: "idle",
      buildErrors: [],
      logs: [],
      // Reset all domain fields so stale data from a previous project cannot bleed through
      entities: [],
      selectedEntityId: null,
      selectedEntity: null,
      assets: [],
      recentAssetIds: [],
      roomOrder: [],
      enabledModules: DEFAULT_ENABLED_MODULES,
      audioBuses: INITIAL_AUDIO_BUSES,
      tilemapLayers: [],
      tilemapActiveLayer: "layer-0",
      variableStoreVars: {},
      variableStoreSwitches: {},
      variableStoreVarNames: {},
      variableStoreSwitchNames: {},
      vnNodes: [],
      autoTileRuleSets: {},
      editorGridSize: 32,
      editorShowGrid: true,
      editorShowRuler: true,
      editorSnapToGrid: true,
      editorShowGuides: true,
      windowConfig: { ...DEFAULT_WINDOW_CONFIG },
      // Reset debugger
      debuggerPaused: false,
      debuggerVars: {},
      debugBreakpoints: [],
    });
    useDBStore.getState().resetDBStore();
    useSequenceStore.getState().resetSequenceStore();
    useLocalisationStore.getState().resetLocalisationStore();

    // Restore project state from .project.json if present
    if (projectJsonKey !== undefined) {
      const raw = files[projectJsonKey];
      if (raw !== undefined) {
        try {
          const proj = JSON.parse(raw) as Record<string, unknown>;
          const updates: Partial<IDEState> = {};
          if (Array.isArray(proj["entities"])) {
            updates.entities = proj["entities"] as EntityItem[];
          }
          if (Array.isArray(proj["assets"])) {
            updates.assets = proj["assets"] as AssetItem[];
          }
          if (Array.isArray(proj["enabledModules"])) {
            updates.enabledModules = proj["enabledModules"] as string[];
          }
          if (Array.isArray(proj["audioBuses"])) {
            updates.audioBuses = proj["audioBuses"] as AudioBus[];
          }
          if (Array.isArray(proj["tilemapLayers"])) {
            updates.tilemapLayers = proj["tilemapLayers"] as TileLayer[];
          }
          if (typeof proj["tilemapActiveLayer"] === "string") {
            updates.tilemapActiveLayer = proj["tilemapActiveLayer"];
          }
          if (Array.isArray(proj["sequenceTracks"])) {
            useSequenceStore.getState().setSequenceTracks(
              proj["sequenceTracks"] as SequenceTrack[],
            );
          }
          if (typeof proj["sequenceDuration"] === "number") {
            useSequenceStore.getState().setSequenceDuration(proj["sequenceDuration"]);
          }
          if (
            proj["localisationTranslations"] !== null &&
            typeof proj["localisationTranslations"] === "object"
          ) {
            useLocalisationStore.getState().setLocalisationTranslations(
              proj["localisationTranslations"] as LocalisationTranslations,
            );
          }
          if (Array.isArray(proj["localisationLocales"])) {
            useLocalisationStore.getState().setLocalisationLocales(
              proj["localisationLocales"] as string[],
            );
          }
          if (
            proj["variableStoreVars"] !== null &&
            typeof proj["variableStoreVars"] === "object"
          ) {
            updates.variableStoreVars = proj["variableStoreVars"] as Record<
              number,
              number
            >;
          }
          if (
            proj["variableStoreSwitches"] !== null &&
            typeof proj["variableStoreSwitches"] === "object"
          ) {
            updates.variableStoreSwitches = proj[
              "variableStoreSwitches"
            ] as Record<number, boolean>;
          }
          if (
            proj["variableStoreVarNames"] !== null &&
            typeof proj["variableStoreVarNames"] === "object"
          ) {
            updates.variableStoreVarNames = proj[
              "variableStoreVarNames"
            ] as Record<number, string>;
          }
          if (
            proj["variableStoreSwitchNames"] !== null &&
            typeof proj["variableStoreSwitchNames"] === "object"
          ) {
            updates.variableStoreSwitchNames = proj[
              "variableStoreSwitchNames"
            ] as Record<number, string>;
          }
          if (
            proj["windowConfig"] !== null &&
            typeof proj["windowConfig"] === "object"
          ) {
            updates.windowConfig = {
              ...DEFAULT_WINDOW_CONFIG,
              ...(proj["windowConfig"] as Partial<WindowConfig>),
            };
          }
          if (Array.isArray(proj["vnNodes"])) {
            updates.vnNodes = proj["vnNodes"] as VnNode[];
          }
          if (
            proj["autoTileRuleSets"] !== null &&
            typeof proj["autoTileRuleSets"] === "object"
          ) {
            updates.autoTileRuleSets = proj["autoTileRuleSets"] as Record<
              string,
              AutoTileRule[]
            >;
          }
          if (Array.isArray(proj["dbActors"]))
            useDBStore.getState().setDBActors(proj["dbActors"] as DbEntry[]);
          if (Array.isArray(proj["dbClasses"]))
            useDBStore.getState().setDBClasses(proj["dbClasses"] as DbEntry[]);
          if (Array.isArray(proj["dbItems"]))
            useDBStore.getState().setDBItems(proj["dbItems"] as DbEntry[]);
          if (Array.isArray(proj["dbEnemies"]))
            useDBStore.getState().setDBEnemies(proj["dbEnemies"] as DbEntry[]);
          if (typeof proj["editorGridSize"] === "number") {
            updates.editorGridSize = Math.max(
              4,
              proj["editorGridSize"] as number,
            );
          }
          if (typeof proj["editorShowGrid"] === "boolean") {
            updates.editorShowGrid = proj["editorShowGrid"];
          }
          if (typeof proj["editorShowRuler"] === "boolean") {
            updates.editorShowRuler = proj["editorShowRuler"];
          }
          if (typeof proj["editorSnapToGrid"] === "boolean") {
            updates.editorSnapToGrid = proj["editorSnapToGrid"];
          }
          if (typeof proj["editorShowGuides"] === "boolean") {
            updates.editorShowGuides = proj["editorShowGuides"];
          }
          set(updates);
        } catch (err) {
          get().addLog(
            "warn",
            `Failed to parse .project.json: ${String(err)}`,
            "IDE",
          );
        }
      }
    }

    get().addLog("info", `Loaded ${paths.length} file(s)`, "IDE");
  },
}));

function getDefaultProperties(componentType: string): Record<string, string> {
  switch (componentType) {
    case "Transform":
      return { x: "640", y: "360", rotation: "0" };
    case "Sprite":
      return { tint: "#7c6af7", alpha: "1" };
    case "PhysicsBody":
      return { bodyType: "dynamic", shape: "box", density: "1" };
    case "CharacterController":
      return { speed: "200", jumpForce: "400" };
    case "CameraSystem":
      return { zoom: "1", lerpFactor: "0.1" };
    default:
      return {};
  }
}

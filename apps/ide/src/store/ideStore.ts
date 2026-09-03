import { create } from "zustand";
import { DEFAULT_ENABLED_MODULES } from "../services/ModuleRegistry";
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

// ── Sequence editor ──────────────────────────────────────────────────────────
export type SequenceTrackType =
  | "Position X"
  | "Position Y"
  | "Rotation"
  | "Scale"
  | "Opacity"
  | "Custom";

export interface SequenceKeyframe {
  id: string;
  time: number;
  value: number;
}

export interface SequenceTrack {
  id: string;
  name: string;
  type: SequenceTrackType;
  keyframes: SequenceKeyframe[];
}

// ── Localisation editor ──────────────────────────────────────────────────────
export type LocalisationTranslations = Record<string, Record<string, string>>;

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

  // Recent files
  recentFiles: RecentFile[];

  // Playback
  playState: PlayState;
  fps: number;

  // Console
  logs: LogEntry[];

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

  // AudioMixer persistent state
  audioBuses: AudioBus[];
  setAudioBus: (id: string, patch: Partial<Omit<AudioBus, "id">>) => void;
  addAudioBus: () => void;

  // TilemapEditor persistent state
  tilemapLayers: TileLayer[];
  tilemapActiveLayer: string;
  setTilemapLayers: (layers: TileLayer[]) => void;
  setTilemapActiveLayer: (id: string) => void;

  // SequenceEditor persistent state
  sequenceTracks: SequenceTrack[];
  sequenceDuration: number;
  setSequenceTracks: (tracks: SequenceTrack[]) => void;
  setSequenceDuration: (duration: number) => void;

  // LocalisationEditor persistent state
  localisationTranslations: LocalisationTranslations;
  localisationLocales: string[];
  setLocalisationTranslations: (t: LocalisationTranslations) => void;
  setLocalisationLocales: (locales: string[]) => void;

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
  vnNodes: unknown[];
  setVNNodes: (nodes: unknown[]) => void;

  // Auto-tile rule sets per tileset (baseTileIndex → serialised rules)
  autoTileRuleSets: Record<string, unknown[]>;
  setAutoTileRuleSets: (ruleSets: Record<string, unknown[]>) => void;

  // RPG database
  dbActors: unknown[];
  dbClasses: unknown[];
  dbItems: unknown[];
  dbEnemies: unknown[];
  setDBActors: (v: unknown[]) => void;
  setDBClasses: (v: unknown[]) => void;
  setDBItems: (v: unknown[]) => void;
  setDBEnemies: (v: unknown[]) => void;

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

// ── Sequence initial data ────────────────────────────────────────────────────
let _seqIdCounter = 0;
function _seqUid(): string {
  return `id-${_seqIdCounter++}`;
}
function _makeTrack(
  type: SequenceTrackType,
  kfs: Array<{ t: number; v: number }> = [],
): SequenceTrack {
  return {
    id: _seqUid(),
    name: type,
    type,
    keyframes: kfs.map(({ t, v }) => ({ id: _seqUid(), time: t, value: v })),
  };
}

const INITIAL_SEQUENCE_TRACKS: SequenceTrack[] = [
  _makeTrack("Position X", [
    { t: 0, v: 0 },
    { t: 1.5, v: 120 },
    { t: 3, v: 0 },
  ]),
  _makeTrack("Position Y", [
    { t: 0, v: 0 },
    { t: 1, v: -60 },
    { t: 2, v: 0 },
  ]),
  _makeTrack("Rotation", [
    { t: 0.5, v: 0 },
    { t: 2, v: 360 },
  ]),
  _makeTrack("Scale", [
    { t: 0, v: 1 },
    { t: 1, v: 1.5 },
  ]),
  _makeTrack("Opacity", [
    { t: 0, v: 0 },
    { t: 0.5, v: 1 },
    { t: 4, v: 1 },
  ]),
];

// ── Localisation initial data ────────────────────────────────────────────────
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

let logCounter = 0;

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

  // AudioMixer persistent state
  audioBuses: INITIAL_AUDIO_BUSES,

  // TilemapEditor persistent state
  tilemapLayers: INITIAL_TILEMAP_LAYERS,
  tilemapActiveLayer: "layer-0",

  // SequenceEditor persistent state
  sequenceTracks: INITIAL_SEQUENCE_TRACKS,
  sequenceDuration: 4,

  // LocalisationEditor persistent state
  localisationTranslations: INITIAL_LOCALISATION_TRANSLATIONS,
  localisationLocales: INITIAL_LOCALISATION_LOCALES,

  // VariableStore persistent state
  variableStoreVars: {},
  variableStoreSwitches: {},
  variableStoreVarNames: {},
  variableStoreSwitchNames: {},

  // Story Graph node cache
  vnNodes: [],

  // Auto-tile rule sets
  autoTileRuleSets: {},

  // RPG database
  dbActors: [],
  dbClasses: [],
  dbItems: [],
  dbEnemies: [],

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
    function findEntity(list: EntityItem[]): EntityItem | undefined {
      for (const e of list) {
        if (e.id === id) return e;
        const found = findEntity(e.children);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    const entity = findEntity(entities);
    if (entity === undefined) return;
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

  setSequenceTracks: (tracks) => set({ sequenceTracks: tracks }),
  setSequenceDuration: (duration) => set({ sequenceDuration: duration }),

  setLocalisationTranslations: (t) => set({ localisationTranslations: t }),
  setLocalisationLocales: (locales) => set({ localisationLocales: locales }),

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

  setVNNodes: (nodes) => set({ vnNodes: nodes }),
  setAutoTileRuleSets: (ruleSets) => set({ autoTileRuleSets: ruleSets }),
  setDBActors: (v) => set({ dbActors: v }),
  setDBClasses: (v) => set({ dbClasses: v }),
  setDBItems: (v) => set({ dbItems: v }),
  setDBEnemies: (v) => set({ dbEnemies: v }),

  setEditorGridSize: (size) => set({ editorGridSize: Math.max(4, size) }),
  setEditorShowGrid: (show) => set({ editorShowGrid: show }),
  setEditorShowRuler: (show) => set({ editorShowRuler: show }),
  setEditorSnapToGrid: (snap) => set({ editorSnapToGrid: snap }),
  setEditorShowGuides: (show) => set({ editorShowGuides: show }),
  setFpsTarget: (fps) => set({ fpsTarget: fps }),

  resetProject: () => {
    set({
      projectName: "MyPlatformer",
      projectFolder: "",
      files: INITIAL_FILES,
      selectedFile: "src/scenes/GameScene.ts",
      editorCode: INITIAL_CODE,
      openFiles: { "src/scenes/GameScene.ts": INITIAL_CODE },
      activeFilePath: "src/scenes/GameScene.ts",
      playState: "stopped",
      buildStatus: "idle",
      buildErrors: [],
      buildDuration: null,
      lastBuildAt: null,
      logs: [],
      // Reset all domain fields for a clean new project
      entities: [],
      selectedEntityId: null,
      selectedEntity: null,
      assets: [],
      enabledModules: DEFAULT_ENABLED_MODULES,
      audioBuses: INITIAL_AUDIO_BUSES,
      tilemapLayers: [],
      tilemapActiveLayer: "layer-0",
      sequenceTracks: [],
      sequenceDuration: 10,
      localisationTranslations: {},
      localisationLocales: ["en"],
      variableStoreVars: {},
      variableStoreSwitches: {},
      variableStoreVarNames: {},
      variableStoreSwitchNames: {},
      vnNodes: [],
      autoTileRuleSets: {},
      dbActors: [],
      dbClasses: [],
      dbItems: [],
      dbEnemies: [],
      editorGridSize: 32,
      editorShowGrid: true,
      editorShowRuler: true,
      editorSnapToGrid: true,
      editorShowGuides: true,
      windowConfig: { ...DEFAULT_WINDOW_CONFIG },
    });
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
      function insertChild(list: EntityItem[]): EntityItem[] {
        return list.map((e) => {
          if (e.id === parentId) {
            return { ...e, children: [...e.children, newEntity] };
          }
          return { ...e, children: insertChild(e.children) };
        });
      }
      return { entities: insertChild(s.entities) };
    });
    get().addLog("info", `Entity "${name}" created`, "IDE");
  },

  deleteEntity: (id) => {
    set((s) => {
      function removeEntity(list: EntityItem[]): EntityItem[] {
        return list
          .filter((e) => e.id !== id)
          .map((e) => ({ ...e, children: removeEntity(e.children) }));
      }
      const next = removeEntity(s.entities);
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
      function rename(list: EntityItem[]): EntityItem[] {
        return list.map((e) => {
          if (e.id === id) return { ...e, name };
          return { ...e, children: rename(e.children) };
        });
      }
      return {
        entities: rename(s.entities),
        selectedEntity:
          s.selectedEntity?.id === id
            ? { ...s.selectedEntity, name }
            : s.selectedEntity,
      };
    });
  },

  toggleEntityActive: (id) => {
    set((s) => {
      function toggle(list: EntityItem[]): EntityItem[] {
        return list.map((e) => {
          if (e.id === id) return { ...e, active: !e.active };
          return { ...e, children: toggle(e.children) };
        });
      }
      return { entities: toggle(s.entities) };
    });
  },

  addComponentToEntity: (entityId, componentType) => {
    set((s) => {
      function addComp(list: EntityItem[]): EntityItem[] {
        return list.map((e) => {
          if (e.id === entityId && !e.components.includes(componentType)) {
            return { ...e, components: [...e.components, componentType] };
          }
          return { ...e, children: addComp(e.children) };
        });
      }
      const newEntities = addComp(s.entities);
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
      function removeComp(list: EntityItem[]): EntityItem[] {
        return list.map((e) => {
          if (e.id === entityId) {
            return {
              ...e,
              components: e.components.filter((c) => c !== componentType),
            };
          }
          return { ...e, children: removeComp(e.children) };
        });
      }
      return {
        entities: removeComp(s.entities),
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

  saveProjectJson: () => {
    const s = get();
    return JSON.stringify(
      {
        projectName: get().projectName,
        entities: s.entities,
        assets: s.assets,
        enabledModules: s.enabledModules,
        audioBuses: s.audioBuses,
        tilemapLayers: s.tilemapLayers,
        tilemapActiveLayer: s.tilemapActiveLayer,
        sequenceTracks: s.sequenceTracks,
        sequenceDuration: s.sequenceDuration,
        localisationTranslations: s.localisationTranslations,
        localisationLocales: s.localisationLocales,
        variableStoreVars: s.variableStoreVars,
        variableStoreSwitches: s.variableStoreSwitches,
        variableStoreVarNames: s.variableStoreVarNames,
        variableStoreSwitchNames: s.variableStoreSwitchNames,
        windowConfig: s.windowConfig,
        vnNodes: s.vnNodes,
        autoTileRuleSets: s.autoTileRuleSets,
        dbActors: s.dbActors,
        dbClasses: s.dbClasses,
        dbItems: s.dbItems,
        dbEnemies: s.dbEnemies,
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
      enabledModules: DEFAULT_ENABLED_MODULES,
      audioBuses: INITIAL_AUDIO_BUSES,
      tilemapLayers: [],
      tilemapActiveLayer: "layer-0",
      sequenceTracks: [],
      sequenceDuration: 10,
      localisationTranslations: {},
      localisationLocales: ["en"],
      variableStoreVars: {},
      variableStoreSwitches: {},
      variableStoreVarNames: {},
      variableStoreSwitchNames: {},
      vnNodes: [],
      autoTileRuleSets: {},
      dbActors: [],
      dbClasses: [],
      dbItems: [],
      dbEnemies: [],
      editorGridSize: 32,
      editorShowGrid: true,
      editorShowRuler: true,
      editorSnapToGrid: true,
      editorShowGuides: true,
      windowConfig: { ...DEFAULT_WINDOW_CONFIG },
    });

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
            updates.sequenceTracks = proj["sequenceTracks"] as SequenceTrack[];
          }
          if (typeof proj["sequenceDuration"] === "number") {
            updates.sequenceDuration = proj["sequenceDuration"];
          }
          if (
            proj["localisationTranslations"] !== null &&
            typeof proj["localisationTranslations"] === "object"
          ) {
            updates.localisationTranslations = proj[
              "localisationTranslations"
            ] as LocalisationTranslations;
          }
          if (Array.isArray(proj["localisationLocales"])) {
            updates.localisationLocales = proj[
              "localisationLocales"
            ] as string[];
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
            updates.vnNodes = proj["vnNodes"];
          }
          if (
            proj["autoTileRuleSets"] !== null &&
            typeof proj["autoTileRuleSets"] === "object"
          ) {
            updates.autoTileRuleSets = proj["autoTileRuleSets"] as Record<
              string,
              unknown[]
            >;
          }
          if (Array.isArray(proj["dbActors"]))
            updates.dbActors = proj["dbActors"];
          if (Array.isArray(proj["dbClasses"]))
            updates.dbClasses = proj["dbClasses"];
          if (Array.isArray(proj["dbItems"])) updates.dbItems = proj["dbItems"];
          if (Array.isArray(proj["dbEnemies"]))
            updates.dbEnemies = proj["dbEnemies"];
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

import { create } from "zustand";
import { DEFAULT_ENABLED_MODULES } from "../services/ModuleRegistry";
import {
  saveProjectJson as _saveProjectJson,
  loadProjectFiles as _loadProjectFiles,
} from "../services/ProjectSerializer";
import { useDBStore } from "./dbStore";
import { useSequenceStore } from "./sequenceStore";
import { useLocalisationStore } from "./localisationStore";
import { useVariableStore } from "./variableStore";
import { useAudioStore } from "./audioStore";
import { useVNStore } from "./vnStore";
import { useVSStore } from "./vsStore";
import { useCGStore } from "./cgStore";
import { useGameGlobalsStore } from "./gameGlobalsStore";
import { DEFAULT_WINDOW_CONFIG } from "./ideTypes";
import type {
  LogLevel,
  BuildMode,
  BuildStatus,
  Theme,
  WindowConfig,
  LogEntry,
  EntityItem,
  AssetItem,
  EntitySnapshot,
  FileTreeNode,
  ProjectFile,
  RecentFile,
  PlayState,
  ActiveTab,
  BottomTab,
} from "./ideTypes";

// Re-export all types so existing consumers don't need to change imports.
export type {
  LogLevel,
  BuildMode,
  BuildStatus,
  Theme,
  WindowMode,
  WindowConfig,
  LogEntry,
  EntityItem,
  AssetItem,
  EntitySnapshot,
  FileTreeNode,
  ProjectFile,
  RecentFile,
  PlayState,
  ActiveTab,
  BottomTab,
} from "./ideTypes";
export { DEFAULT_WINDOW_CONFIG } from "./ideTypes";

// ── Internal types ─────────────────────────────────────────────────────────────

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

  // Multi-select: every currently-selected entity id, in click order.
  // `selectedEntityId`/`selectedEntity` stay the single-selection source of
  // truth for panels that haven't been taught about multi-select yet — this
  // is purely additive. When exactly one id is selected the two stay in
  // sync; EntityProperties reads `selectedEntityIds` to detect the >1 case.
  selectedEntityIds: string[];

  // Live entity data from the running engine
  liveEntities: EntitySnapshot[];

  // Project directory tree
  projectRoot: string | null;
  fileTree: FileTreeNode[];

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
  dropImportFolder: "root" | "last";
  openImageEditorRequest: { assetId: string; ts: number } | null;

  // Generic "bring this rc-dock tab into view" request — the same
  // fire-and-consume pattern `openImageEditorRequest` already uses, for
  // AssetBrowser's per-asset-type "open in" dispatch (CLAUDE.md's rc-dock
  // "dock by anchor tab" entry: this docks/focuses an existing tab id via
  // App.tsx's openPanelInLayout, it never floats a brand-new tab type).
  openPanelRequest: { panelId: string; ts: number } | null;
  requestOpenPanel: (panelId: string) => void;

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
  // Sets the full multi-selection. Pass an empty array to clear. This also
  // keeps `selectedEntityId`/`selectedEntity` in sync (single entity ->
  // normal single-select behaviour; 0 or 2+ -> cleared, per the "collapse
  // to null on multi/none" convention SceneInspector already used locally).
  setSelectedEntityIds: (ids: string[]) => void;
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
  setAssets: (assets: AssetItem[]) => void;
  setRecentAssetIds: (ids: string[]) => void;
  setRoomOrder: (ids: string[]) => void;

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
  setDropImportFolder: (folder: "root" | "last") => void;
  openImageEditor: (assetId: string) => void;

  // Live component fields from the running engine (keyed by component type)
  liveComponentFields: Record<string, Record<string, unknown>> | null;

  // Live entity actions
  setLiveEntities: (entities: EntitySnapshot[]) => void;
  setLiveComponentFields: (
    fields: Record<string, Record<string, unknown>> | null,
  ) => void;

  // Project directory actions
  setProjectRoot: (root: string | null) => void;
  setFileTree: (tree: FileTreeNode[]) => void;

  // Project lifecycle
  resetProject: () => void;
  loadProjectFiles: (files: Record<string, string>, name?: string) => void;
  saveProjectJson: () => string;
  loadProject: (raw: string) => void;
}

const INITIAL_CODE = `import { Game, defineScene, RenderPipeline, Transform, Sprite } from '@emptysock/engine';

const gameScene = defineScene({
  onLoad(scene) {
    const player = scene.spawn('Player');
    player.add(Transform, { x: 640, y: 360, scaleX: 64, scaleY: 64 });
    player.add(Sprite, { tint: 0x7c6af7 });

    const ground = scene.spawn('Ground');
    ground.add(Transform, { x: 640, y: 680, scaleX: 1280, scaleY: 40 });
    ground.add(Sprite, { tint: 0x4ade80 });

    console.log('GameScene loaded');
  },
});

const game = new Game();
const renderer = new RenderPipeline();

async function main(): Promise<void> {
  await renderer.init({ width: GAME_WIDTH, height: GAME_HEIGHT });
  game.attachRenderer(renderer);
  document.body.appendChild(renderer.canvas);

  // manageLifecycle: false — this starter has no physics bodies or actors,
  // so it skips creating a PhysicsSystem/ActorSystem it would never use.
  await game.loadScene(gameScene, { manageLifecycle: false });

  let lastTime = performance.now();
  function frame(now: number): void {
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    game.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

void main();
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
let entityIdCounter = 0;

// ── Initial project state factory ───────────────────────────────────────────
// All fields that should be wiped on resetProject() or loadProjectFiles().
// Adding a new resettable field here automatically propagates to both callers.
const BLANK_MAIN = "// New project\n";
const BLANK_FILES: ProjectFile[] = [
  {
    name: "src",
    path: "src",
    type: "folder",
    children: [{ name: "main.ts", path: "src/main.ts", type: "file" }],
  },
  { name: "assets", path: "assets", type: "folder", children: [] },
];

function initialProjectState() {
  return {
    projectName: "Untitled",
    projectFolder: "",
    files: BLANK_FILES,
    selectedFile: "src/main.ts",
    editorCode: BLANK_MAIN,
    openFiles: { "src/main.ts": BLANK_MAIN },
    activeFilePath: "src/main.ts",
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
    openPanelRequest: null as { panelId: string; ts: number } | null,
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

  // Scene — start empty; INITIAL_ENTITIES kept for reference but not used at startup
  entities: [],
  selectedEntityId: null,
  selectedEntity: null,
  selectedEntityIds: [],
  liveEntities: [],
  liveComponentFields: null,
  projectRoot: null,
  fileTree: [],

  // Assets — start empty; INITIAL_ASSETS kept for reference but not used at startup
  assets: [],
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
  dropImportFolder: "root" as const,
  openImageEditorRequest: null,
  openPanelRequest: null,

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

  setSelectedEntityIds: (ids) => {
    set({ selectedEntityIds: ids });
    if (ids.length === 1) {
      get().selectEntity(ids[0] ?? null);
    } else {
      get().selectEntity(null);
    }
  },

  selectEntity: (id) => {
    if (id === null) {
      set({
        selectedEntityId: null,
        selectedEntity: null,
        liveComponentFields: null,
      });
      return;
    }
    const { entities } = get();
    const entity = findInTree(entities, (e) => e.id === id);
    if (entity === null) return;
    // Preserve existing transform if this entity is already selected (avoid clobbering edits)
    const existing = get().selectedEntity;
    const existingTransform =
      existing?.id === id ? existing.transform : undefined;
    const clearFields = existing?.id !== id;
    set({
      selectedEntityId: id,
      ...(clearFields ? { liveComponentFields: null } : {}),
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
      new CustomEvent("debug-cmd", { detail: { type } }),
    );
  },

  // Image editor actions
  setDropImportFolder: (folder) => set({ dropImportFolder: folder }),
  openImageEditor: (assetId) =>
    set({ openImageEditorRequest: { assetId, ts: Date.now() } }),
  requestOpenPanel: (panelId) =>
    set({ openPanelRequest: { panelId, ts: Date.now() } }),

  setLiveEntities: (entities) => set({ liveEntities: entities }),
  setLiveComponentFields: (fields) => set({ liveComponentFields: fields }),
  setProjectRoot: (root) => set({ projectRoot: root }),
  setFileTree: (tree) => set({ fileTree: tree }),

  loadProject: (raw) => {
    get().loadProjectFiles({ "project.emptysock.project.json": raw });
  },

  resetProject: () => {
    set({ ...initialProjectState() });
    useDBStore.getState().resetDBStore();
    useSequenceStore.getState().resetSequenceStore();
    useLocalisationStore.getState().resetLocalisationStore();
    useVariableStore.getState().resetVariableStore();
    useAudioStore.getState().resetAudioStore();
    useVNStore.getState().resetVNStore();
    useVSStore.getState().resetVSStore();
    useCGStore.getState().resetCGStore();
    useGameGlobalsStore.getState().resetGameGlobalsStore();
    get().addLog("info", "New project created", "IDE");
  },

  addEntity: (name, parentId) => {
    const newEntity: EntityItem = {
      id: `ent-${Date.now()}-${entityIdCounter++}`,
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
        entities: mapTree(s.entities, (e) =>
          e.id === id ? { ...e, name } : e,
        ),
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
            ? {
                ...e,
                components: e.components.filter((c) => c !== componentType),
              }
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

  setAssets: (assets) => set({ assets }),

  setRecentAssetIds: (ids) => set({ recentAssetIds: ids }),
  setRoomOrder: (ids) => set({ roomOrder: ids }),

  saveProjectJson: () => _saveProjectJson(get()),

  loadProjectFiles: (files, name) =>
    _loadProjectFiles(files, name, set, get().addLog),
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

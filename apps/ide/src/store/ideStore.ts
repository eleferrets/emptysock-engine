import { create } from "zustand";
import { DEFAULT_ENABLED_MODULES } from "../services/ModuleRegistry";
export type LogLevel = "info" | "warn" | "error" | "debug";
export type BuildMode = "debug" | "release";
export type BuildStatus = "idle" | "building" | "success" | "error";
export type Theme = "dark" | "light" | "system";

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

  // Project lifecycle
  resetProject: () => void;
  loadProjectFiles: (files: Record<string, string>, name?: string) => void;
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

  // Theme
  theme: "dark",

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
  setTheme: (t) => set({ theme: t }),
  setProjectFolder: (folder) => set({ projectFolder: folder }),

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

  loadProjectFiles: (files, name) => {
    const paths = Object.keys(files);
    const firstPath = paths[0] ?? null;
    const projectFiles: ProjectFile[] = paths.map((p) => ({
      name: p.split("/").pop() ?? p,
      path: p,
      type: "file" as const,
    }));
    set({
      projectName: name ?? "LoadedProject",
      files: projectFiles,
      openFiles: files,
      activeFilePath: firstPath,
      selectedFile: firstPath,
      editorCode: firstPath !== null ? (files[firstPath] ?? "") : "",
      playState: "stopped",
      buildStatus: "idle",
      buildErrors: [],
      logs: [],
    });
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

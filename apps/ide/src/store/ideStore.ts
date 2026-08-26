import { create } from 'zustand';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type BuildMode = 'debug' | 'release';
export type BuildStatus = 'idle' | 'building' | 'success' | 'error';

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
  type: 'image' | 'audio' | 'font' | 'json' | 'scene' | 'script';
  path: string;
  size?: number;
}

export interface ProjectFile {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: ProjectFile[];
}

export type PlayState = 'stopped' | 'playing' | 'paused';
export type ActiveTab = 'code' | 'canvas' | 'scene';
export type BottomTab = 'console' | 'assets';

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
  components: Array<{ type: string; enabled: boolean; properties: Record<string, string> }>;
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
  files: ProjectFile[];
  selectedFile: string | null;
  editorCode: string;

  // Scene
  entities: EntityItem[];
  selectedEntityId: string | null;
  selectedEntity: SelectedEntity | null;

  // Assets
  assets: AssetItem[];

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
  updateEntityTransform: (entityId: string, transform: Partial<TransformValues>) => void;

  // Build actions
  setBuildMode: (mode: BuildMode) => void;
  toggleBuildMode: () => void;
  setBuildStatus: (status: BuildStatus, errors?: string[], duration?: number) => void;
  toggleDebugOverlay: () => void;
  clearBuildCache: () => void;

  // Settings modal action
  setSettingsOpen: (open: boolean) => void;
}

const INITIAL_CODE = `import { Scene, Entity, Transform, Sprite } from '@emptysock/engine';

/**
 * GameScene — the main game scene.
 * Add entities and systems here.
 */
export class GameScene extends Scene {
  constructor() {
    super('GameScene');
  }

  override start(): void {
    super.start();

    // Create player entity
    const player = this.createEntity('Player');
    player.addComponent(new Transform({ x: 640, y: 360 }));
    player.addComponent(new Sprite({ tint: 0x7c6af7 }));
    player.addTag('player');

    // Create ground
    const ground = this.createEntity('Ground');
    ground.addComponent(new Transform({ x: 640, y: 680 }));
    ground.addComponent(new Sprite({ tint: 0x4ade80 }));
    ground.addTag('ground');

    console.log('GameScene started with', this.getEntities().size, 'entities');
  }
}
`;

const INITIAL_ENTITIES: EntityItem[] = [
  {
    id: 'ent-1',
    name: 'Player',
    type: 'Entity',
    active: true,
    components: ['Transform', 'Sprite', 'CharacterController'],
    children: [],
  },
  {
    id: 'ent-2',
    name: 'Ground',
    type: 'Entity',
    active: true,
    components: ['Transform', 'Sprite', 'PhysicsBody'],
    children: [],
  },
  {
    id: 'ent-3',
    name: 'Camera',
    type: 'Entity',
    active: true,
    components: ['Transform', 'CameraSystem'],
    children: [],
  },
  {
    id: 'ent-4',
    name: 'Enemies',
    type: 'Entity',
    active: true,
    components: ['Transform'],
    children: [
      {
        id: 'ent-4-1',
        name: 'Slime_01',
        type: 'Entity',
        active: true,
        components: ['Transform', 'Sprite', 'PhysicsBody'],
        children: [],
      },
      {
        id: 'ent-4-2',
        name: 'Slime_02',
        type: 'Entity',
        active: false,
        components: ['Transform', 'Sprite', 'PhysicsBody'],
        children: [],
      },
    ],
  },
];

const INITIAL_ASSETS: AssetItem[] = [
  { id: 'ast-1', name: 'player.png', type: 'image', path: 'assets/player.png', size: 12400 },
  { id: 'ast-2', name: 'tileset.png', type: 'image', path: 'assets/tileset.png', size: 88200 },
  { id: 'ast-3', name: 'jump.ogg', type: 'audio', path: 'assets/jump.ogg', size: 34000 },
  { id: 'ast-4', name: 'music.ogg', type: 'audio', path: 'assets/music.ogg', size: 2800000 },
  { id: 'ast-5', name: 'GameScene.ts', type: 'script', path: 'src/scenes/GameScene.ts', size: 1200 },
  { id: 'ast-6', name: 'ui.json', type: 'json', path: 'src/ui.json', size: 4400 },
];

const INITIAL_FILES: ProjectFile[] = [
  {
    name: 'src',
    path: 'src',
    type: 'folder',
    children: [
      { name: 'main.ts', path: 'src/main.ts', type: 'file' },
      {
        name: 'scenes',
        path: 'src/scenes',
        type: 'folder',
        children: [
          { name: 'GameScene.ts', path: 'src/scenes/GameScene.ts', type: 'file' },
          { name: 'MenuScene.ts', path: 'src/scenes/MenuScene.ts', type: 'file' },
        ],
      },
      {
        name: 'entities',
        path: 'src/entities',
        type: 'folder',
        children: [
          { name: 'Player.ts', path: 'src/entities/Player.ts', type: 'file' },
        ],
      },
    ],
  },
  {
    name: 'assets',
    path: 'assets',
    type: 'folder',
    children: [
      { name: 'player.png', path: 'assets/player.png', type: 'file' },
      { name: 'tileset.png', path: 'assets/tileset.png', type: 'file' },
      { name: 'jump.ogg', path: 'assets/jump.ogg', type: 'file' },
      { name: 'music.ogg', path: 'assets/music.ogg', type: 'file' },
    ],
  },
  { name: 'emptysock.project.json', path: 'emptysock.project.json', type: 'file' },
];

let logCounter = 0;

export const useIDEStore = create<IDEState>((set, get) => ({
  // Layout
  activeTab: 'code',
  bottomTab: 'console',
  leftSidebarWidth: 240,
  rightPanelWidth: 280,
  bottomPanelHeight: 180,
  sidebarOpen: false,
  rightPanelOpen: false,

  // Project
  projectName: 'MyPlatformer',
  files: INITIAL_FILES,
  selectedFile: 'src/scenes/GameScene.ts',
  editorCode: INITIAL_CODE,

  // Scene
  entities: INITIAL_ENTITIES,
  selectedEntityId: 'ent-1',
  selectedEntity: {
    id: 'ent-1',
    name: 'Player',
    type: 'Entity',
    transform: { x: '640', y: '360', rotation: '0', scaleX: '1', scaleY: '1' },
    components: [
      { type: 'Transform', enabled: true, properties: { x: '640', y: '360', rotation: '0' } },
      { type: 'Sprite', enabled: true, properties: { tint: '#7c6af7', alpha: '1' } },
      { type: 'CharacterController', enabled: true, properties: { speed: '200', jumpForce: '400' } },
    ],
  },

  // Assets
  assets: INITIAL_ASSETS,

  // Playback
  playState: 'stopped',
  fps: 0,

  // Console
  logs: [
    { id: 'log-0', level: 'info', message: 'EmptySock Engine v0.1.0 initialized', timestamp: Date.now() - 5000, source: 'Engine' },
    { id: 'log-1', level: 'info', message: 'WebGPU renderer detected — using ultra quality preset', timestamp: Date.now() - 4800, source: 'RenderSystem' },
    { id: 'log-2', level: 'debug', message: 'GPU tier: high (Apple M2)', timestamp: Date.now() - 4700, source: 'GPUTier' },
    { id: 'log-3', level: 'warn', message: 'AudioSystem: no AudioContext — user gesture required', timestamp: Date.now() - 4200, source: 'AudioSystem' },
    { id: 'log-4', level: 'info', message: 'Scene "GameScene" loaded — 4 entities', timestamp: Date.now() - 3000, source: 'Scene' },
  ],

  // Build
  buildMode: 'debug',
  buildStatus: 'idle',
  buildErrors: [],
  buildDuration: null,
  debugOverlay: false,
  lastBuildAt: null,

  // Settings modal
  settingsOpen: false,

  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setBottomTab: (tab) => set({ bottomTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  setPlayState: (state) => {
    set({ playState: state });
    const { addLog } = get();
    if (state === 'playing') addLog('info', 'Game started', 'Engine');
    else if (state === 'paused') addLog('info', 'Game paused', 'Engine');
    else addLog('info', 'Game stopped', 'Engine');
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
    const entity = entities.find(e => e.id === id) ??
      entities.flatMap(e => e.children).find(e => e.id === id);
    if (entity === undefined) return;

    set({
      selectedEntityId: id,
      selectedEntity: {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        transform: { x: '640', y: '360', rotation: '0', scaleX: '1', scaleY: '1' },
        components: entity.components.map(c => ({
          type: c,
          enabled: true,
          properties: getDefaultProperties(c),
        })),
      },
    });
  },

  selectFile: (path) => set({ selectedFile: path }),

  setEditorCode: (code) => set({ editorCode: code }),

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

  // Build actions
  setBuildMode: (mode) => set({ buildMode: mode }),

  toggleBuildMode: () => set((s) => ({ buildMode: s.buildMode === 'debug' ? 'release' : 'debug' })),

  setBuildStatus: (status, errors, duration) => {
    set({
      buildStatus: status,
      buildErrors: errors ?? [],
      buildDuration: duration !== undefined ? duration : null,
      lastBuildAt: status === 'success' || status === 'error' ? Date.now() : get().lastBuildAt,
    });
  },

  toggleDebugOverlay: () => set((s) => ({ debugOverlay: !s.debugOverlay })),

  clearBuildCache: () => {
    set({
      buildStatus: 'idle',
      buildErrors: [],
      lastBuildAt: null,
      buildDuration: null,
    });
    get().addLog('info', 'Build cache cleared', 'BuildService');
  },

  // Settings modal
  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));

function getDefaultProperties(componentType: string): Record<string, string> {
  switch (componentType) {
    case 'Transform': return { x: '640', y: '360', rotation: '0' };
    case 'Sprite': return { tint: '#7c6af7', alpha: '1' };
    case 'PhysicsBody': return { bodyType: 'dynamic', shape: 'box', density: '1' };
    case 'CharacterController': return { speed: '200', jumpForce: '400' };
    case 'CameraSystem': return { zoom: '1', lerpFactor: '0.1' };
    default: return {};
  }
}

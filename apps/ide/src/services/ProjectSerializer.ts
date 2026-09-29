// ── Project serialization helpers ─────────────────────────────────────────────
// Extracted from ideStore.ts: saveProjectJson and loadProjectFiles live here so
// the store stays thin. All sub-stores are singletons and imported directly.

import { useDBStore, type DbEntry } from "../store/dbStore";
import { useSequenceStore, type SequenceTrack } from "../store/sequenceStore";
import {
  useLocalisationStore,
  type LocalisationTranslations,
} from "../store/localisationStore";
import {
  useVariableStore,
  type VariableStoreSnapshot,
} from "../store/variableStore";
import { useAudioStore, type AudioBus } from "../store/audioStore";
import {
  useTilemapStore,
  type TileLayer,
  type AutoTileRule,
} from "../store/tilemapStore";
import { useVNStore, type VnNode } from "../store/vnStore";
import { useVSStore } from "../store/vsStore";
import { useCGStore } from "../store/cgStore";
import { useGameGlobalsStore } from "../store/gameGlobalsStore";
import {
  DEFAULT_WINDOW_CONFIG,
  type LogLevel,
  type WindowConfig,
  type EntityItem,
  type AssetItem,
  type ProjectFile,
  type LogEntry,
} from "../store/ideTypes";
import { DEFAULT_ENABLED_MODULES } from "./ModuleRegistry";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectSnapshot = {
  projectName: string;
  entities: EntityItem[];
  assets: AssetItem[];
  enabledModules: string[];
  windowConfig: WindowConfig;
  editorGridSize: number;
  editorShowGrid: boolean;
  editorShowRuler: boolean;
  editorSnapToGrid: boolean;
  editorShowGuides: boolean;
  openFiles: Record<string, string>;
  activeFilePath: string | null;
  recentAssetIds: string[];
  roomOrder: string[];
};

type IDEPartial = Partial<{
  projectName: string;
  files: ProjectFile[];
  openFiles: Record<string, string>;
  activeFilePath: string | null;
  selectedFile: string | null;
  editorCode: string;
  playState: "stopped" | "playing" | "paused";
  buildStatus: "idle" | "building" | "success" | "error";
  buildErrors: string[];
  logs: LogEntry[];
  entities: EntityItem[];
  selectedEntityId: string | null;
  selectedEntity: null;
  assets: AssetItem[];
  recentAssetIds: string[];
  roomOrder: string[];
  enabledModules: string[];
  editorGridSize: number;
  editorShowGrid: boolean;
  editorShowRuler: boolean;
  editorSnapToGrid: boolean;
  editorShowGuides: boolean;
  windowConfig: WindowConfig;
  debuggerPaused: boolean;
  debuggerVars: Record<string, unknown>;
  debugBreakpoints: string[];
}>;

// ── saveProjectJson ───────────────────────────────────────────────────────────

export function saveProjectJson(state: ProjectSnapshot): string {
  const db = useDBStore.getState();
  const seq = useSequenceStore.getState();
  const loc = useLocalisationStore.getState();
  const vars = useVariableStore.getState();
  const audio = useAudioStore.getState();
  const tilemap = useTilemapStore.getState();
  const vn = useVNStore.getState();
  const globals = useGameGlobalsStore.getState();
  return JSON.stringify(
    {
      projectName: state.projectName,
      entities: state.entities,
      assets: state.assets,
      enabledModules: state.enabledModules,
      audioBuses: audio.audioBuses,
      tilemapLayers: tilemap.tilemapLayers,
      tilemapActiveLayer: tilemap.tilemapActiveLayer,
      sequenceTracks: seq.sequenceTracks,
      sequenceDuration: seq.sequenceDuration,
      localisationTranslations: loc.localisationTranslations,
      localisationLocales: loc.localisationLocales,
      variableStoreVars: vars.variableStoreVars,
      variableStoreSwitches: vars.variableStoreSwitches,
      variableStoreVarNames: vars.variableStoreVarNames,
      variableStoreSwitchNames: vars.variableStoreSwitchNames,
      windowConfig: state.windowConfig,
      gameGlobals: globals.gameGlobals,
      vnNodes: vn.vnNodes,
      autoTileRuleSets: tilemap.autoTileRuleSets,
      dbActors: db.dbActors,
      dbClasses: db.dbClasses,
      dbItems: db.dbItems,
      dbEnemies: db.dbEnemies,
      editorGridSize: state.editorGridSize,
      editorShowGrid: state.editorShowGrid,
      editorShowRuler: state.editorShowRuler,
      editorSnapToGrid: state.editorSnapToGrid,
      editorShowGuides: state.editorShowGuides,
      openFiles: state.openFiles,
      activeFilePath: state.activeFilePath,
      recentAssetIds: state.recentAssetIds,
      roomOrder: state.roomOrder,
    },
    null,
    2,
  );
}

// ── loadProjectFiles ──────────────────────────────────────────────────────────

export function loadProjectFiles(
  files: Record<string, string>,
  name: string | undefined,
  set: (partial: IDEPartial) => void,
  addLog: (level: LogLevel, message: string, source: string) => void,
): void {
  const paths = Object.keys(files);

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
    entities: [],
    selectedEntityId: null,
    selectedEntity: null,
    assets: [],
    recentAssetIds: [],
    roomOrder: [],
    enabledModules: DEFAULT_ENABLED_MODULES,
    editorGridSize: 32,
    editorShowGrid: true,
    editorShowRuler: true,
    editorSnapToGrid: true,
    editorShowGuides: true,
    windowConfig: { ...DEFAULT_WINDOW_CONFIG },
    debuggerPaused: false,
    debuggerVars: {},
    debugBreakpoints: [],
  });

  useDBStore.getState().resetDBStore();
  useSequenceStore.getState().resetSequenceStore();
  useLocalisationStore.getState().resetLocalisationStore();
  useVariableStore.getState().resetVariableStore();
  useAudioStore.getState().resetAudioStore();
  useTilemapStore.getState().resetTilemapStore();
  useVNStore.getState().resetVNStore();
  useVSStore.getState().resetVSStore();
  useCGStore.getState().resetCGStore();
  useGameGlobalsStore.getState().resetGameGlobalsStore();

  if (projectJsonKey !== undefined) {
    const raw = files[projectJsonKey];
    if (raw !== undefined) {
      try {
        const proj = JSON.parse(raw) as Record<string, unknown>;
        const updates: IDEPartial = {};

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
          useAudioStore
            .getState()
            .setAudioBuses(proj["audioBuses"] as AudioBus[]);
        }
        if (Array.isArray(proj["tilemapLayers"])) {
          useTilemapStore
            .getState()
            .setTilemapLayers(proj["tilemapLayers"] as TileLayer[]);
        }
        if (typeof proj["tilemapActiveLayer"] === "string") {
          useTilemapStore
            .getState()
            .setTilemapActiveLayer(proj["tilemapActiveLayer"]);
        }
        if (Array.isArray(proj["sequenceTracks"])) {
          useSequenceStore
            .getState()
            .setSequenceTracks(proj["sequenceTracks"] as SequenceTrack[]);
        }
        if (typeof proj["sequenceDuration"] === "number") {
          useSequenceStore
            .getState()
            .setSequenceDuration(proj["sequenceDuration"]);
        }
        if (
          proj["localisationTranslations"] !== null &&
          typeof proj["localisationTranslations"] === "object"
        ) {
          useLocalisationStore
            .getState()
            .setLocalisationTranslations(
              proj["localisationTranslations"] as LocalisationTranslations,
            );
        }
        if (Array.isArray(proj["localisationLocales"])) {
          useLocalisationStore
            .getState()
            .setLocalisationLocales(proj["localisationLocales"] as string[]);
        }
        {
          const snapshot: Partial<VariableStoreSnapshot> = {};
          if (
            proj["variableStoreVars"] !== null &&
            typeof proj["variableStoreVars"] === "object"
          ) {
            snapshot.variableStoreVars = proj["variableStoreVars"] as Record<
              number,
              number
            >;
          }
          if (
            proj["variableStoreSwitches"] !== null &&
            typeof proj["variableStoreSwitches"] === "object"
          ) {
            snapshot.variableStoreSwitches = proj[
              "variableStoreSwitches"
            ] as Record<number, boolean>;
          }
          if (
            proj["variableStoreVarNames"] !== null &&
            typeof proj["variableStoreVarNames"] === "object"
          ) {
            snapshot.variableStoreVarNames = proj[
              "variableStoreVarNames"
            ] as Record<number, string>;
          }
          if (
            proj["variableStoreSwitchNames"] !== null &&
            typeof proj["variableStoreSwitchNames"] === "object"
          ) {
            snapshot.variableStoreSwitchNames = proj[
              "variableStoreSwitchNames"
            ] as Record<number, string>;
          }
          if (Object.keys(snapshot).length > 0) {
            useVariableStore.getState().hydrateVariableStore({
              variableStoreVars: {},
              variableStoreSwitches: {},
              variableStoreVarNames: {},
              variableStoreSwitchNames: {},
              ...snapshot,
            });
          }
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
        if (
          proj["gameGlobals"] !== null &&
          typeof proj["gameGlobals"] === "object" &&
          !Array.isArray(proj["gameGlobals"])
        ) {
          // name -> TypeScript type expression; anything else is dropped.
          const restored: Record<string, string> = {};
          for (const [k, v] of Object.entries(
            proj["gameGlobals"] as Record<string, unknown>,
          )) {
            if (typeof v === "string") restored[k] = v;
          }
          useGameGlobalsStore.getState().hydrateGameGlobals(restored);
        }
        if (Array.isArray(proj["vnNodes"])) {
          useVNStore.getState().setVNNodes(proj["vnNodes"] as VnNode[]);
        }
        if (
          proj["autoTileRuleSets"] !== null &&
          typeof proj["autoTileRuleSets"] === "object"
        ) {
          useTilemapStore
            .getState()
            .setAutoTileRuleSets(
              proj["autoTileRuleSets"] as Record<string, AutoTileRule[]>,
            );
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
        if (
          proj["openFiles"] !== null &&
          typeof proj["openFiles"] === "object" &&
          !Array.isArray(proj["openFiles"])
        ) {
          const saved = proj["openFiles"] as Record<string, unknown>;
          const restored: Record<string, string> = {};
          for (const [k, v] of Object.entries(saved)) {
            if (typeof v === "string") restored[k] = v;
          }
          if (
            Object.keys(codeFiles).length === 0 &&
            Object.keys(restored).length > 0
          ) {
            updates.openFiles = restored;
          }
        }
        if (typeof proj["activeFilePath"] === "string") {
          const availableFiles = updates.openFiles ?? codeFiles;
          if (proj["activeFilePath"] in availableFiles) {
            updates.activeFilePath = proj["activeFilePath"];
          }
        }
        if (Array.isArray(proj["recentAssetIds"])) {
          updates.recentAssetIds = (proj["recentAssetIds"] as unknown[]).filter(
            (v): v is string => typeof v === "string",
          );
        }
        if (Array.isArray(proj["roomOrder"])) {
          updates.roomOrder = (proj["roomOrder"] as unknown[]).filter(
            (v): v is string => typeof v === "string",
          );
        }

        set(updates);
      } catch (err) {
        addLog("warn", `Failed to parse .project.json: ${String(err)}`, "IDE");
      }
    }
  }

  addLog("info", `Loaded ${paths.length} file(s)`, "IDE");
}

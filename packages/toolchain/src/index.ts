export {
  ToolchainSettingsSchema,
  loadToolchainSettings,
  saveToolchainSettings,
} from "./ToolchainSettings.js";
export type { ToolchainSettings } from "./ToolchainSettings.js";

export { detectToolchain, formatToolchainReport } from "./ToolchainDetector.js";
export type {
  ToolReport,
  ToolchainReport,
  ToolStatus,
} from "./ToolchainDetector.js";

export { runInVM, pullImage, imageExists, runLinuxTests } from "./VMRunner.js";
export type {
  VMRunOptions,
  VMRunResult,
  LinuxTestOptions,
} from "./VMRunner.js";

export { convertGms2Sprite } from "./gms2-sprite-import.js";
export type { SpriteAsset } from "./gms2-sprite-import.js";

export {
  convertGms2Room,
  convertGms2RoomBackgrounds,
  droppedBackgroundSprites,
} from "./gms2-room-import.js";
export type {
  RoomData,
  RoomLayer,
  TileEntry,
  InstanceEntry,
  RoomBackgroundEntity,
} from "./gms2-room-import.js";

export { convertGms2Sound, buildSoundAsset } from "./gms2-sound-import.js";
export type { SoundAsset } from "./gms2-sound-import.js";

export { convertGms2Font, buildFontAsset } from "./gms2-font-import.js";
export type { FontAsset } from "./gms2-font-import.js";

export { convertGms2Note, buildNoteMarkdown } from "./gms2-note-import.js";
export type { NoteAsset } from "./gms2-note-import.js";

export {
  readWindowConfig,
  applyWindowConfigToTauri,
  syncWindowConfigToTauri,
} from "./window-config.js";
export type { WindowConfig, WindowMode } from "./window-config.js";

export { importGMS2Project } from "./gms2-import.js";
export type { ImportResult } from "./gms2-import.js";

// NOTE: gms2/spriteImport.ts, gms2/roomImport.ts, and gms2/gmlStubConverter.ts
// were removed as near-duplicates of ./gms2-sprite-import.ts,
// ./gms2-room-import.ts, and ./gms2-codegen.ts's buildObjectBehavior(),
// which are the canonical implementations wired into importGMS2Project.
// gmlStubConverter.ts additionally predated ground rule 15's prefab/scene
// JSON redesign — it still generated `extends Scene` class stubs, a shape
// no longer used anywhere, which nothing in the real import pipeline (or
// anything else) called.

export { generatePrefabTypes } from "./prefabCodegen.js";
export type { PrefabCodegenOptions } from "./prefabCodegen.js";

export { runCodegenPrefabs } from "./prefabCodegenCli.js";
export type {
  CodegenPrefabsOptions,
  CodegenPrefabsResult,
} from "./prefabCodegenCli.js";

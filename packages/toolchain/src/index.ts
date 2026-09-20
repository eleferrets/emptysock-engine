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

export { convertGms2Room } from "./gms2-room-import.js";
export type {
  RoomData,
  RoomLayer,
  TileEntry,
  InstanceEntry,
} from "./gms2-room-import.js";

export { generateObjectStub } from "./gms2-gml-stub.js";

export {
  readWindowConfig,
  applyWindowConfigToTauri,
  syncWindowConfigToTauri,
} from "./window-config.js";
export type { WindowConfig, WindowMode } from "./window-config.js";

export { importGMS2Project } from "./gms2-import.js";
export type { ImportResult } from "./gms2-import.js";

// NOTE: gms2/spriteImport.ts and gms2/roomImport.ts were removed as
// near-duplicates of ./gms2-sprite-import.ts and ./gms2-room-import.ts,
// which are the canonical implementations wired into importGMS2Project.

export {
  gmlObjectToTypeScript,
  gmlObjectDirToTypeScript,
} from "./gms2/gmlStubConverter.js";

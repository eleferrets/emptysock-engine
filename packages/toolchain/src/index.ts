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

export {
  readWindowConfig,
  applyWindowConfigToTauri,
  syncWindowConfigToTauri,
} from "./window-config.js";
export type { WindowConfig, WindowMode } from "./window-config.js";

export { generatePrefabTypes } from "./prefabCodegen.js";
export type { PrefabCodegenOptions } from "./prefabCodegen.js";

export { runCodegenPrefabs } from "./prefabCodegenCli.js";
export type {
  CodegenPrefabsOptions,
  CodegenPrefabsResult,
} from "./prefabCodegenCli.js";

export { compressAudioFile, ffmpegAvailable } from "./audioCompress.js";
export type {
  AudioCodec,
  CompressAudioOptions,
  CompressAudioResult,
} from "./audioCompress.js";

export { stageNativePlatform, includedFilesDestFor } from "./nativeStage.js";
export type {
  StagedNativePlatform,
  StageNativeOptions,
  StageNativeResult,
} from "./nativeStage.js";
export {
  loadIncludedFilesManifest,
  resolveIncludedFilesForPlatform,
  copyIncludedFiles,
  includedFilesManifestPath,
  stageIncludedFilesForPlatform,
  INCLUDED_FILES_MANIFEST_NAME,
} from "./includedFiles.js";
export type {
  IncludedFileEntry,
  IncludedFilesManifest,
  IncludedFilePlatform,
  CopyIncludedFilesResult,
} from "./includedFiles.js";

export { buildDesktopApp, bundleGameEntry } from "./desktopBuild.js";
export type {
  DesktopBuildOptions,
  DesktopBuildResult,
  DesktopPlatform,
  BundleGameEntryOptions,
  BundleGameEntryResult,
} from "./desktopBuild.js";

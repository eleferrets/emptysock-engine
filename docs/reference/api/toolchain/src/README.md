[**emptysock-engine**](../../README.md)

***

[emptysock-engine](../../README.md) / toolchain/src

# toolchain/src

## Interfaces

- [BundleGameEntryOptions](interfaces/BundleGameEntryOptions.md)
- [CodegenPrefabsOptions](interfaces/CodegenPrefabsOptions.md)
- [CompressAudioOptions](interfaces/CompressAudioOptions.md)
- [CopyIncludedFilesResult](interfaces/CopyIncludedFilesResult.md)
- [DesktopBuildOptions](interfaces/DesktopBuildOptions.md)
- [DesktopBuildResult](interfaces/DesktopBuildResult.md)
- [IncludedFileEntry](interfaces/IncludedFileEntry.md)
- [IncludedFilesManifest](interfaces/IncludedFilesManifest.md)
- [LinuxTestOptions](interfaces/LinuxTestOptions.md)
- [PrefabCodegenOptions](interfaces/PrefabCodegenOptions.md)
- [StageNativeOptions](interfaces/StageNativeOptions.md)
- [ToolchainReport](interfaces/ToolchainReport.md)
- [ToolReport](interfaces/ToolReport.md)
- [VMRunOptions](interfaces/VMRunOptions.md)
- [VMRunResult](interfaces/VMRunResult.md)
- [WindowConfig](interfaces/WindowConfig.md)

## Type Aliases

- [AudioCodec](type-aliases/AudioCodec.md)
- [BundleGameEntryResult](type-aliases/BundleGameEntryResult.md)
- [CodegenPrefabsResult](type-aliases/CodegenPrefabsResult.md)
- [CompressAudioResult](type-aliases/CompressAudioResult.md)
- [DesktopPlatform](type-aliases/DesktopPlatform.md)
- [IncludedFilePlatform](type-aliases/IncludedFilePlatform.md)
- [StagedNativePlatform](type-aliases/StagedNativePlatform.md)
- [StageNativeResult](type-aliases/StageNativeResult.md)
- [ToolchainSettings](type-aliases/ToolchainSettings.md)
- [ToolStatus](type-aliases/ToolStatus.md)
- [WindowMode](type-aliases/WindowMode.md)

## Variables

- [INCLUDED\_FILES\_MANIFEST\_NAME](variables/INCLUDED_FILES_MANIFEST_NAME.md)
- [ToolchainSettingsSchema](variables/ToolchainSettingsSchema.md)

## Functions

- [applyWindowConfigToTauri](functions/applyWindowConfigToTauri.md)
- [buildDesktopApp](functions/buildDesktopApp.md)
- [bundleGameEntry](functions/bundleGameEntry.md)
- [compressAudioFile](functions/compressAudioFile.md)
- [copyIncludedFiles](functions/copyIncludedFiles.md)
- [detectToolchain](functions/detectToolchain.md)
- [ffmpegAvailable](functions/ffmpegAvailable.md)
- [formatToolchainReport](functions/formatToolchainReport.md)
- [generatePrefabTypes](functions/generatePrefabTypes.md)
- [imageExists](functions/imageExists.md)
- [includedFilesDestFor](functions/includedFilesDestFor.md)
- [includedFilesManifestPath](functions/includedFilesManifestPath.md)
- [loadIncludedFilesManifest](functions/loadIncludedFilesManifest.md)
- [loadToolchainSettings](functions/loadToolchainSettings.md)
- [pullImage](functions/pullImage.md)
- [readWindowConfig](functions/readWindowConfig.md)
- [resolveIncludedFilesForPlatform](functions/resolveIncludedFilesForPlatform.md)
- [runCodegenPrefabs](functions/runCodegenPrefabs.md)
- [runInVM](functions/runInVM.md)
- [runLinuxTests](functions/runLinuxTests.md)
- [saveToolchainSettings](functions/saveToolchainSettings.md)
- [stageIncludedFilesForPlatform](functions/stageIncludedFilesForPlatform.md)
- [stageNativePlatform](functions/stageNativePlatform.md)
- [syncWindowConfigToTauri](functions/syncWindowConfigToTauri.md)

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Settings schema — stored in emptysock.toolchain.json at project root
// ---------------------------------------------------------------------------

export const ToolchainSettingsSchema = z.object({
  // macOS / iOS
  xcodePath: z.string().optional()
    .describe('Path to Xcode.app, e.g. /Applications/Xcode.app'),
  xcrunPath: z.string().optional()
    .describe('Override for xcrun binary (default: auto-detected via PATH)'),
  codesignIdentity: z.string().optional()
    .describe('Apple code signing identity, e.g. "Developer ID Application: ..."'),
  appleTeamId: z.string().optional()
    .describe('Apple Developer Team ID for code signing'),

  // Windows
  msbuildPath: z.string().optional()
    .describe('Path to MSBuild.exe, e.g. C:\\Program Files\\Microsoft Visual Studio\\...'),
  vcvarsPath: z.string().optional()
    .describe('Path to vcvarsall.bat for Visual C++ environment setup'),
  nsisPath: z.string().optional()
    .describe('Path to makensis.exe for Windows installer generation'),
  windowsSdkPath: z.string().optional()
    .describe('Windows SDK root, e.g. C:\\Program Files (x86)\\Windows Kits\\10'),

  // Android
  androidSdkPath: z.string().optional()
    .describe('Android SDK root, e.g. ~/Library/Android/sdk or %LOCALAPPDATA%\\Android\\Sdk'),
  androidNdkPath: z.string().optional()
    .describe('Android NDK root (if separate from SDK)'),
  javaHome: z.string().optional()
    .describe('JAVA_HOME for Gradle, e.g. /usr/lib/jvm/java-17-openjdk-amd64'),
  keystorePath: z.string().optional()
    .describe('Path to Android keystore file for APK signing'),
  keystoreAlias: z.string().optional()
    .describe('Alias inside the keystore'),

  // Linux packaging
  appImageToolPath: z.string().optional()
    .describe('Path to appimagetool binary'),
  dpkgDebPath: z.string().optional()
    .describe('Path to dpkg-deb binary (default: auto-detected)'),

  // Docker / VM
  dockerPath: z.string().optional()
    .describe('Path to docker binary (default: auto-detected via PATH)'),
  dockerLinuxImage: z.string().default('node:22-bookworm-slim')
    .describe('Docker image used for Linux build/test VM'),
  dockerAndroidImage: z.string().default('reactnativecommunity/react-native-android:latest')
    .describe('Docker image used for Android build VM'),

  // General
  nodeHome: z.string().optional()
    .describe('Node.js installation root (default: auto-detected via PATH)'),
  npmPath: z.string().optional()
    .describe('Override for npm binary'),
  pnpmPath: z.string().optional()
    .describe('Override for pnpm binary'),
});

export type ToolchainSettings = z.infer<typeof ToolchainSettingsSchema>;

// ---------------------------------------------------------------------------
// Load / save helpers
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SETTINGS_FILE = 'emptysock.toolchain.json';

export function loadToolchainSettings(projectDir: string): ToolchainSettings {
  const path = join(projectDir, SETTINGS_FILE);
  if (!existsSync(path)) return ToolchainSettingsSchema.parse({});
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return ToolchainSettingsSchema.parse(raw);
  } catch {
    return ToolchainSettingsSchema.parse({});
  }
}

export function saveToolchainSettings(projectDir: string, settings: ToolchainSettings): void {
  const path = join(projectDir, SETTINGS_FILE);
  writeFileSync(path, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

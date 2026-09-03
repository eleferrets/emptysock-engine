import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ToolchainSettings } from "./ToolchainSettings.js";

export type ToolStatus = "found" | "missing" | "misconfigured";

export interface ToolReport {
  name: string;
  status: ToolStatus;
  path: string | null;
  version: string | null;
  note: string | null;
  /** True means this tool is required to perform the stated action */
  required: boolean;
}

export interface ToolchainReport {
  platform: NodeJS.Platform;
  tools: ToolReport[];
  /** Tools that are required but missing */
  blocking: ToolReport[];
  /** True if all required tools are present */
  ready: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function which(bin: string): string | null {
  try {
    const result = spawnSync("which", [bin], { encoding: "utf-8" });
    if (result.status === 0) return result.stdout.trim();
    return null;
  } catch {
    return null;
  }
}

function tryVersion(cmd: string): string | null {
  try {
    return (
      execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })
        .trim()
        .split("\n")[0] ?? null
    );
  } catch {
    return null;
  }
}

function checkBin(
  name: string,
  candidates: (string | null | undefined)[],
  versionCmd: (p: string) => string,
  required: boolean,
  note?: string,
): ToolReport {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    if (existsSync(candidate)) {
      const version = tryVersion(versionCmd(candidate));
      return {
        name,
        status: "found",
        path: candidate,
        version,
        note: note ?? null,
        required,
      };
    }
  }
  // Try PATH
  const found = which(name);
  if (found !== null) {
    const version = tryVersion(versionCmd(found));
    return {
      name,
      status: "found",
      path: found,
      version,
      note: note ?? null,
      required,
    };
  }
  return {
    name,
    status: "missing",
    path: null,
    version: null,
    note: note ?? null,
    required,
  };
}

// ---------------------------------------------------------------------------
// Platform-specific checks
// ---------------------------------------------------------------------------

function checkCommon(settings: ToolchainSettings): ToolReport[] {
  return [
    checkBin(
      "node",
      [settings.nodeHome ? join(settings.nodeHome, "bin", "node") : null],
      (p) => `${p} --version`,
      true,
    ),
    checkBin(
      "zip",
      [],
      () => "zip --version",
      false,
      "Used for web export zip packaging",
    ),
    checkBin(
      "tar",
      [],
      () => "tar --version",
      false,
      "Used for Raspi/Linux .tar.gz packaging",
    ),
    checkBin(
      "docker",
      [settings.dockerPath],
      (p) => `${p} --version`,
      false,
      "Required for VM-based build/test runners",
    ),
  ];
}

function checkMacOS(settings: ToolchainSettings): ToolReport[] {
  const xcodeApp = settings.xcodePath ?? "/Applications/Xcode.app";
  const xcrun = settings.xcrunPath ?? which("xcrun") ?? "/usr/bin/xcrun";

  const xcodeInstalled = existsSync(xcodeApp);
  const xcodeReport: ToolReport = {
    name: "Xcode",
    status: xcodeInstalled ? "found" : "missing",
    path: xcodeInstalled ? xcodeApp : null,
    version: xcodeInstalled
      ? (tryVersion(`xcrun xcodebuild -version`) ?? null)
      : null,
    note: xcodeInstalled
      ? null
      : "Install Xcode from the App Store, then run: sudo xcode-select --install",
    required: true,
  };

  const xcrunReport = checkBin(
    "xcrun",
    [xcrun],
    (p) => `${p} --version`,
    true,
    "Part of Xcode Command Line Tools — run: xcode-select --install",
  );

  const codesignReport: ToolReport =
    settings.codesignIdentity !== undefined
      ? {
          name: "codesign-identity",
          status: "found",
          path: null,
          version: null,
          note: settings.codesignIdentity,
          required: false,
        }
      : {
          name: "codesign-identity",
          status: "missing",
          path: null,
          version: null,
          note: "Set codesignIdentity in emptysock.toolchain.json for signed builds",
          required: false,
        };

  const createDmg = checkBin(
    "create-dmg",
    [],
    (p) => `${p} --version`,
    false,
    "Install via: brew install create-dmg",
  );

  return [xcodeReport, xcrunReport, codesignReport, createDmg];
}

function checkWindows(settings: ToolchainSettings): ToolReport[] {
  const msbuildCandidates = [
    settings.msbuildPath,
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\MSBuild\\Current\\Bin\\MSBuild.exe",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe",
    "C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\MSBuild\\Current\\Bin\\MSBuild.exe",
  ];

  const msbuild = checkBin(
    "MSBuild",
    msbuildCandidates,
    (p) => `"${p}" -version`,
    true,
    'Install Visual Studio with "Desktop development with C++" or standalone Build Tools from https://aka.ms/vs/17/release/vs_buildtools.exe',
  );

  const nsisCandidates = [
    settings.nsisPath,
    "C:\\Program Files (x86)\\NSIS\\makensis.exe",
    "C:\\Program Files\\NSIS\\makensis.exe",
  ];
  const nsis = checkBin(
    "makensis",
    nsisCandidates,
    (p) => `"${p}" /VERSION`,
    false,
    "Install NSIS from https://nsis.sourceforge.io/Download for Windows installer generation",
  );

  return [msbuild, nsis];
}

function checkAndroid(settings: ToolchainSettings): ToolReport[] {
  const sdkRoot =
    settings.androidSdkPath ??
    process.env["ANDROID_HOME"] ??
    process.env["ANDROID_SDK_ROOT"];
  const sdkOk = sdkRoot !== undefined && existsSync(sdkRoot);
  const sdkReport: ToolReport = {
    name: "Android SDK",
    status: sdkOk ? "found" : "missing",
    path: sdkOk ? sdkRoot : null,
    version: null,
    note: sdkOk
      ? null
      : "Set androidSdkPath in emptysock.toolchain.json or install Android Studio",
    required: true,
  };

  const javaHome = settings.javaHome ?? process.env["JAVA_HOME"];
  const javaBin = javaHome ? join(javaHome, "bin", "java") : null;
  const java = checkBin(
    "java",
    [javaBin],
    (p) => `${p} -version 2>&1`,
    true,
    "Install JDK 17+: https://adoptium.net/ — set JAVA_HOME or javaHome in toolchain settings",
  );

  const gradleReport = checkBin(
    "gradle",
    [],
    (p) => `${p} --version`,
    false,
    "Gradle is bundled in Android projects via gradlew — not required globally",
  );

  return [sdkReport, java, gradleReport];
}

function checkLinux(settings: ToolchainSettings): ToolReport[] {
  const appimage = checkBin(
    "appimagetool",
    [settings.appImageToolPath],
    (p) => `${p} --version`,
    false,
    "Download from https://github.com/AppImage/appimagetool/releases and place in PATH",
  );
  const dpkg = checkBin(
    "dpkg-deb",
    [settings.dpkgDebPath],
    (p) => `${p} --version`,
    false,
    "Install via: sudo apt-get install dpkg-dev",
  );
  return [appimage, dpkg];
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

export function detectToolchain(
  settings: ToolchainSettings,
  targets: string[] = [],
): ToolchainReport {
  const platform = process.platform;
  const common = checkCommon(settings);
  const platformTools: ToolReport[] = [];

  const wantsIos = targets.includes("ios") || targets.includes("macos");
  const wantsWindows = targets.includes("windows");
  const wantsAndroid = targets.includes("android");
  const wantsLinux = targets.includes("linux") || targets.includes("raspi");

  if (platform === "darwin" || wantsIos)
    platformTools.push(...checkMacOS(settings));
  if (platform === "win32" || wantsWindows)
    platformTools.push(...checkWindows(settings));
  if (wantsAndroid) platformTools.push(...checkAndroid(settings));
  if (wantsLinux && platform === "linux")
    platformTools.push(...checkLinux(settings));

  const tools = [...common, ...platformTools];
  const blocking = tools.filter((t) => t.required && t.status !== "found");

  return { platform, tools, blocking, ready: blocking.length === 0 };
}

/** Format a toolchain report as a human-readable string */
export function formatToolchainReport(report: ToolchainReport): string {
  const lines: string[] = [`Platform: ${report.platform}`, ""];
  for (const t of report.tools) {
    const icon = t.status === "found" ? "✓" : t.required ? "✗" : "–";
    const version =
      t.version !== null ? ` (${t.version.substring(0, 40)})` : "";
    const path = t.path !== null ? `  → ${t.path}` : "";
    lines.push(`${icon} ${t.name}${version}${path}`);
    if (t.status !== "found" && t.note !== null) {
      lines.push(`    ${t.note}`);
    }
  }
  if (!report.ready) {
    lines.push(
      "",
      `BLOCKING: ${report.blocking.map((b) => b.name).join(", ")} must be installed before this build target can proceed.`,
    );
  } else {
    lines.push("", "All required tools present.");
  }
  return lines.join("\n");
}

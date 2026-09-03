import React, { useState, useCallback, useMemo } from "react";
import {
  X,
  Download,
  Globe,
  Monitor,
  Apple,
  Terminal,
  Smartphone,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "../ui/Button";
import { useIDEStore } from "../../store/ideStore";
import { gameBuildService } from "../../services/GameBuildService";
import { BrowserFileService } from "../../services/BrowserFileService";
import { ENGINE_BUNDLE } from "../../runtime/engineBundle.generated";

export type ExportPlatform =
  | "web"
  | "windows"
  | "macos"
  | "linux"
  | "android"
  | "ios";
type WindowsArch = "x64" | "arm64" | "x86";
type LinuxArch = "x64" | "arm64";
type WindowsFormat = "ZIP" | "EXE" | "MSI";
type LinuxFormat = "AppImage" | "tar.gz" | "Flatpak";
type EngineMode = "separate" | "inline";
type ESTarget = "es2015" | "es2018" | "es2020" | "es2022" | "esnext";
type ExportStatus = "idle" | "exporting" | "success" | "error";

const PLATFORMS: Array<{
  id: ExportPlatform;
  label: string;
  icon: React.ReactElement;
}> = [
  { id: "web", label: "Web", icon: <Globe size={14} /> },
  { id: "windows", label: "Windows", icon: <Monitor size={14} /> },
  { id: "macos", label: "macOS", icon: <Apple size={14} /> },
  { id: "linux", label: "Linux", icon: <Terminal size={14} /> },
  { id: "android", label: "Android", icon: <Smartphone size={14} /> },
  { id: "ios", label: "iOS", icon: <Smartphone size={14} /> },
];

const ES_TARGETS: Array<{ value: ESTarget; label: string }> = [
  { value: "es2015", label: "ES2015 (wide compat)" },
  { value: "es2018", label: "ES2018" },
  { value: "es2020", label: "ES2020 (default)" },
  { value: "es2022", label: "ES2022" },
  { value: "esnext", label: "ESNext (modern only)" },
];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportModal({
  open,
  onClose,
}: ExportModalProps): React.ReactElement | null {
  // Platform
  const [selectedPlatform, setSelectedPlatform] =
    useState<ExportPlatform>("web");
  // Windows
  const [windowsArch, setWindowsArch] = useState<WindowsArch>("x64");
  const [windowsFormat, setWindowsFormat] = useState<WindowsFormat>("ZIP");
  // Linux
  const [linuxArch, setLinuxArch] = useState<LinuxArch>("x64");
  const [linuxFormats, setLinuxFormats] = useState<Set<LinuxFormat>>(
    new Set(["AppImage"]),
  );
  // Build — compiler
  const [minify, setMinify] = useState(true);
  const [dropConsole, setDropConsole] = useState(true);
  const [sourcemap, setSourcemap] = useState(false);
  const [aggressiveMode, setAggressiveMode] = useState(false);
  const [esTarget, setEsTarget] = useState<ESTarget>("es2020");
  // Build — packaging
  const [cleanBuild, setCleanBuild] = useState(true);
  const [engineMode, setEngineMode] = useState<EngineMode>("separate");
  const [includeUnreferenced, setIncludeUnreferenced] = useState(false);
  const [includeSources, setIncludeSources] = useState(false);
  // Entry point
  const [entryPath, setEntryPath] = useState<string>("");
  // Advanced section open
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Status
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [outputPath, setOutputPath] = useState("");

  const {
    projectName,
    editorCode,
    openFiles,
    activeFilePath,
    clearBuildCache,
  } = useIDEStore();

  // Derive the list of script entry-point candidates from open files
  const scriptFiles = useMemo(
    () => Object.keys(openFiles).filter((p) => /\.(ts|tsx|js|jsx)$/.test(p)),
    [openFiles],
  );

  // Resolved entry: user pick or active file or first script
  const resolvedEntry =
    entryPath !== "" ? entryPath : (activeFilePath ?? scriptFiles[0] ?? "");
  const entryCode = openFiles[resolvedEntry] ?? editorCode;

  const toggleLinuxFormat = (fmt: LinuxFormat): void => {
    setLinuxFormats((prev) => {
      const next = new Set(prev);
      if (next.has(fmt)) {
        if (next.size > 1) next.delete(fmt);
      } else next.add(fmt);
      return next;
    });
  };

  const handleExport = useCallback(async (): Promise<void> => {
    setStatus("exporting");
    setErrorMsg("");
    setOutputPath("");

    try {
      if (cleanBuild) clearBuildCache();

      const isTauri =
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

      if (isTauri && selectedPlatform !== "web") {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<{
          success: boolean;
          outputPath: string;
          error?: string;
        }>("export_game", {
          platform: selectedPlatform,
          format:
            selectedPlatform === "windows"
              ? windowsFormat
              : selectedPlatform === "linux"
                ? [...linuxFormats].join(",")
                : undefined,
          arch:
            selectedPlatform === "windows"
              ? windowsArch
              : selectedPlatform === "linux"
                ? linuxArch
                : undefined,
          entryPath: resolvedEntry,
          code: entryCode,
          virtualFiles: openFiles,
          minify,
          dropConsole,
          sourcemap,
          aggressiveMode,
          esTarget,
          cleanBuild,
          engineMode,
          includeUnreferenced,
          includeSources,
        });
        if (result.success) {
          setStatus("success");
          setOutputPath(result.outputPath);
        } else {
          setStatus("error");
          setErrorMsg(result.error ?? "Export failed");
        }
        return;
      }

      if (selectedPlatform !== "web") {
        const platformFlag =
          selectedPlatform === "macos" ? "macos" : selectedPlatform;
        setStatus("error");
        setErrorMsg(
          `Desktop export requires the EmptySock CLI:\n  npx emptysock-toolchain export --platform ${platformFlag}`,
        );
        return;
      }

      // ── Web export (browser) ────────────────────────────────────────────

      const buildResult = await gameBuildService.buildNow({
        code: entryCode,
        filename: resolvedEntry || "game.ts",
        mode: minify ? "release" : "debug",
        aggressiveMode,
        target: [esTarget],
        virtualFiles: openFiles,
      });

      if (!buildResult.success) {
        setStatus("error");
        setErrorMsg(buildResult.errors.join("\n"));
        return;
      }

      const engineJs =
        engineMode === "inline"
          ? `// EmptySock Engine (inlined)\n${ENGINE_BUNDLE}\n`
          : ENGINE_BUNDLE;

      const gameJs =
        engineMode === "inline"
          ? `${engineJs}\n${buildResult.js}`
          : buildResult.js;

      const scriptTags =
        engineMode === "separate"
          ? `  <script src="engine.js"></script>\n  <script src="game.js"></script>`
          : `  <script src="game.js"></script>`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; display: flex; align-items: center; justify-content: center; height: 100dvh; overflow: hidden; }
    canvas { display: block; max-width: 100%; max-height: 100%; }
  </style>
</head>
<body>
  <canvas id="game-canvas"></canvas>
${scriptTags}
</body>
</html>`;

      const zip = new JSZip();
      zip.file("index.html", html);
      if (engineMode === "separate") zip.file("engine.js", ENGINE_BUNDLE);
      zip.file("game.js", gameJs);

      if (sourcemap && buildResult.js.includes("//# sourceMappingURL")) {
        // sourcemap is already inlined in debug mode; nothing extra to add
      }

      if (includeSources) {
        const src = zip.folder("src");
        if (src !== null) {
          for (const [path, content] of Object.entries(openFiles)) {
            src.file(path, content);
          }
        }
      } else if (includeUnreferenced) {
        // include open files that aren't reachable from the entry point
        // (we don't do a full import graph walk — just include all open scripts)
        const src = zip.folder("src");
        if (src !== null) {
          for (const [path, content] of Object.entries(openFiles)) {
            if (path !== resolvedEntry) src.file(path, content);
          }
        }
      }

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const filename = `${projectName.replace(/\s+/g, "-").toLowerCase()}-web.zip`;
      BrowserFileService.downloadBlob(filename, blob);
      setStatus("success");
      setOutputPath(filename);
    } catch (e) {
      setStatus("error");
      setErrorMsg(String(e));
    }
  }, [
    selectedPlatform,
    windowsArch,
    windowsFormat,
    linuxArch,
    linuxFormats,
    entryCode,
    resolvedEntry,
    openFiles,
    minify,
    dropConsole,
    sourcemap,
    aggressiveMode,
    esTarget,
    cleanBuild,
    engineMode,
    includeUnreferenced,
    includeSources,
    projectName,
    clearBuildCache,
  ]);

  if (!open) return null;

  const selectStyle: React.CSSProperties = {
    background: "var(--es-bg)",
    border: "1px solid var(--es-border)",
    borderRadius: 6,
    color: "var(--es-text)",
    fontSize: 12,
    padding: "5px 8px",
    cursor: "pointer",
    outline: "none",
    width: "100%",
  };

  const SectionLabel = ({ text }: { text: string }): React.ReactElement => (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--es-text-muted)",
        marginBottom: 7,
      }}
    >
      {text}
    </div>
  );

  const Checkbox = ({
    label,
    checked,
    onChange,
    note,
  }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    note?: string;
  }): React.ReactElement => (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        cursor: "pointer",
        fontSize: 12,
        color: "var(--es-text)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          accentColor: "var(--es-accent)",
          width: 13,
          height: 13,
          marginTop: 1,
          flexShrink: 0,
        }}
      />
      <div>
        <div>{label}</div>
        {note !== undefined && (
          <div
            style={{
              fontSize: 10,
              color: "var(--es-text-muted)",
              marginTop: 1,
              lineHeight: 1.5,
            }}
          >
            {note}
          </div>
        )}
      </div>
    </label>
  );

  const SectionLabel = ({ text }: { text: string }): React.ReactElement => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 7 }}>{text}</div>
  );

  const Checkbox = ({ label, checked, onChange, note }: { label: string; checked: boolean; onChange: (v: boolean) => void; note?: string }): React.ReactElement => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 13, height: 13, marginTop: 1, flexShrink: 0 }} />
      <div>
        <div>{label}</div>
        {note !== undefined && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.5 }}>{note}</div>}
      </div>
    </label>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--es-surface)",
          border: "1px solid var(--es-border)",
          borderRadius: 10,
          width: 580,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--es-border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={14} style={{ color: "var(--es-accent)" }} />
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "var(--es-text)" }}
            >
              Export Project
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--es-text-muted)",
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Platform */}
          <div>
            <SectionLabel text="Platform" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
              }}
            >
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlatform(p.id);
                    setStatus("idle");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px",
                    borderRadius: 7,
                    border: `1px solid ${selectedPlatform === p.id ? "var(--es-accent)" : "var(--es-border)"}`,
                    background:
                      selectedPlatform === p.id
                        ? "rgba(124,106,247,0.12)"
                        : "var(--es-bg)",
                    color:
                      selectedPlatform === p.id
                        ? "var(--es-accent)"
                        : "var(--es-text-muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    transition: "all 0.12s",
                  }}
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Entry point */}
          {scriptFiles.length > 1 && (
            <div>
              <SectionLabel text="Entry Point" />
              <select
                value={resolvedEntry}
                onChange={(e) => setEntryPath(e.target.value)}
                style={selectStyle}
              >
                {scriptFiles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                    {p === activeFilePath ? " (active)" : ""}
                  </option>
                ))}
              </select>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--es-text-muted)",
                  marginTop: 4,
                }}
              >
                The selected file is the root of the bundle. All imports it
                reaches are included automatically.
              </div>
            </div>
          )}

          {/* Windows options */}
          {selectedPlatform === "windows" && (
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <SectionLabel text="Architecture" />
                <select
                  value={windowsArch}
                  onChange={(e) =>
                    setWindowsArch(e.target.value as WindowsArch)
                  }
                  style={selectStyle}
                >
                  <option value="x64">
                    x64 — Intel/AMD 64-bit (recommended)
                  </option>
                  <option value="arm64">
                    ARM64 — Snapdragon X / Surface Pro X
                  </option>
                  <option value="x86">x86 — 32-bit (legacy)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <SectionLabel text="Format" />
                <select
                  value={windowsFormat}
                  onChange={(e) =>
                    setWindowsFormat(e.target.value as WindowsFormat)
                  }
                  style={selectStyle}
                >
                  <option value="ZIP">Portable ZIP (no installer)</option>
                  <option value="EXE">Installer EXE (NSIS)</option>
                  <option value="MSI">MSI Package</option>
                </select>
              </div>
            </div>
          )}

          {/* macOS */}
          {selectedPlatform === "macos" && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 7,
                background: "rgba(124,106,247,0.07)",
                border: "1px solid rgba(124,106,247,0.22)",
                fontSize: 12,
                color: "var(--es-text-muted)",
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: "var(--es-accent)", fontWeight: 600 }}>
                Universal binary:{" "}
              </span>
              macOS builds produce a single universal{" "}
              <code style={{ fontFamily: "monospace", fontSize: 11 }}>
                .app
              </code>{" "}
              that runs natively on both Intel and Apple Silicon (arm64 +
              x86_64). Requires Xcode on the build machine — Export generates an
              Xcode project for archiving and notarisation.
            </div>
          )}

          {/* Linux options */}
          {selectedPlatform === "linux" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <SectionLabel text="Architecture" />
                <select
                  value={linuxArch}
                  onChange={(e) => setLinuxArch(e.target.value as LinuxArch)}
                  style={selectStyle}
                >
                  <option value="x64">x86_64 — Intel/AMD (recommended)</option>
                  <option value="arm64">
                    ARM64 — Raspberry Pi 4+, Ampere, AWS Graviton
                  </option>
                </select>
              </div>
              <div>
                <SectionLabel text="Output Formats (select all that apply)" />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["AppImage", "tar.gz", "Flatpak"] as LinuxFormat[]).map(
                    (fmt) => {
                      const checked = linuxFormats.has(fmt);
                      return (
                        <label
                          key={fmt}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: `1px solid ${checked ? "var(--es-accent)" : "var(--es-border)"}`,
                            background: checked
                              ? "rgba(124,106,247,0.10)"
                              : "var(--es-bg)",
                            fontSize: 12,
                            color: checked
                              ? "var(--es-accent)"
                              : "var(--es-text)",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLinuxFormat(fmt)}
                            style={{
                              accentColor: "var(--es-accent)",
                              width: 12,
                              height: 12,
                            }}
                          />
                          {fmt}
                          {fmt === "AppImage" && (
                            <span
                              style={{
                                fontSize: 9,
                                color: "var(--es-text-muted)",
                              }}
                            >
                              no install
                            </span>
                          )}
                        </label>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Android / iOS */}
          {(selectedPlatform === "android" || selectedPlatform === "ios") && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 7,
                background: "rgba(248,113,113,0.06)",
                border: "1px solid rgba(248,113,113,0.2)",
                fontSize: 12,
                color: "var(--es-text-muted)",
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: "var(--es-red)", fontWeight: 600 }}>
                Mobile export requires the EmptySock CLI:
              </span>
              <pre
                style={{
                  marginTop: 6,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                  color: "var(--text)",
                  background: "var(--bg)",
                  padding: "6px 8px",
                  borderRadius: 5,
                  overflowX: "auto",
                }}
              >
                {`npx emptysock-toolchain export --platform ${selectedPlatform}`}
              </pre>
            </div>
          )}

          {/* Build Stage */}
          <div>
            <SectionLabel text="Build Stage" />
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <Checkbox
                label="Clean build"
                checked={cleanBuild}
                onChange={setCleanBuild}
                note="Discards previous build cache before compiling. Slower but guarantees a fresh output — use when troubleshooting stale artefacts."
              />
            </div>
          </div>

          {/* Compiler Options */}
          <div>
            <SectionLabel text="Compiler" />
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <Checkbox
                label="Minify output"
                checked={minify}
                onChange={setMinify}
              />
              <Checkbox
                label="Drop console.* calls"
                checked={dropConsole}
                onChange={setDropConsole}
                note="Strips all console.log / warn / error calls from the bundle."
              />
              <Checkbox
                label="Emit source maps (inline)"
                checked={sourcemap}
                onChange={setSourcemap}
                note="Embeds source maps in the bundle for browser DevTools. Increases file size significantly."
              />

              <div style={{ marginTop: 4 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--es-text-muted)",
                    marginBottom: 5,
                  }}
                >
                  ECMAScript target
                </div>
                <select
                  value={esTarget}
                  onChange={(e) => setEsTarget(e.target.value as ESTarget)}
                  style={{ ...selectStyle, width: "auto" }}
                >
                  {ES_TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aggressive optimisation */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  cursor: "pointer",
                  marginTop: 4,
                  padding: "8px 10px",
                  borderRadius: 7,
                  border: `1px solid ${aggressiveMode ? "rgba(251,191,36,0.4)" : "var(--es-border)"}`,
                  background: aggressiveMode
                    ? "rgba(251,191,36,0.06)"
                    : "transparent",
                  transition: "all 0.12s",
                }}
              >
                <input
                  type="checkbox"
                  checked={aggressiveMode}
                  onChange={(e) => setAggressiveMode(e.target.checked)}
                  style={{
                    accentColor: "var(--es-accent)",
                    width: 13,
                    height: 13,
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12,
                      color: aggressiveMode
                        ? "var(--es-yellow)"
                        : "var(--es-text)",
                      fontWeight: 500,
                    }}
                  >
                    <Zap size={11} /> Aggressive Optimisation
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--es-text-muted)",
                      marginTop: 2,
                      lineHeight: 1.5,
                    }}
                  >
                    Enables identifier mangling, dead-code elimination, and
                    syntax reduction. Smallest possible output but may break
                    code that uses dynamic property access on mangled
                    identifiers.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Packaging Options (Advanced) */}
          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--es-text-muted)",
                fontSize: 11,
                fontWeight: 600,
                padding: 0,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {advancedOpen ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              Packaging Options
            </button>

            {advancedOpen && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div>
                  <SectionLabel text="Engine Bundle" />
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["separate", "inline"] as EngineMode[]).map((m) => (
                      <label
                        key={m}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 12px",
                          borderRadius: 6,
                          border: `1px solid ${engineMode === m ? "var(--es-accent)" : "var(--es-border)"}`,
                          background:
                            engineMode === m
                              ? "rgba(124,106,247,0.10)"
                              : "var(--es-bg)",
                          fontSize: 12,
                          cursor: "pointer",
                          color:
                            engineMode === m
                              ? "var(--es-accent)"
                              : "var(--es-text)",
                        }}
                      >
                        <input
                          type="radio"
                          name="engineMode"
                          value={m}
                          checked={engineMode === m}
                          onChange={() => setEngineMode(m)}
                          style={{ accentColor: "var(--es-accent)" }}
                        />
                        {m === "separate"
                          ? "Separate engine.js + game.js"
                          : "Inline engine into game.js"}
                      </label>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--es-text-muted)",
                      marginTop: 5,
                      lineHeight: 1.5,
                    }}
                  >
                    {engineMode === "separate"
                      ? "Two files — engine.js can be cached separately by the browser. Recommended for iterative builds."
                      : "Single game.js file — simpler to distribute but the engine cannot be cached independently."}
                  </div>
                </div>

                <Checkbox
                  label="Include unreferenced open files"
                  checked={includeUnreferenced}
                  onChange={setIncludeUnreferenced}
                  note="Adds all open files that aren't imported by the entry point to a src/ folder inside the zip. Useful when your project has intentionally detached modules."
                />

                <Checkbox
                  label="Include original source files"
                  checked={includeSources}
                  onChange={(v) => {
                    setIncludeSources(v);
                    if (v) setIncludeUnreferenced(false);
                  }}
                  note="Copies all open TypeScript/JavaScript files into src/ alongside the compiled bundle. Useful for open-source games or when distributing the source."
                />
              </div>
            )}
          </div>

          {/* Status */}
          {status === "success" && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 7,
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.25)",
                fontSize: 12,
                color: "var(--es-green)",
              }}
            >
              Export complete →{" "}
              <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {outputPath}
              </span>
            </div>
          )}
          {status === "error" && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 7,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.25)",
                fontSize: 12,
                color: "var(--es-red)",
                whiteSpace: "pre-wrap",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid var(--es-border)",
            flexShrink: 0,
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              void handleExport();
            }}
            disabled={
              status === "exporting" ||
              selectedPlatform === "android" ||
              selectedPlatform === "ios"
            }
          >
            <Download size={12} />
            {status === "exporting" ? "Exporting…" : "Export"}
          </Button>
        </div>
      </div>
    </div>
  );
}

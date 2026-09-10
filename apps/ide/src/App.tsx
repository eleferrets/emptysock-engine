import React from "react";
import DockLayout from "rc-dock";
import type { LayoutData, TabData } from "rc-dock";
import "rc-dock/dist/rc-dock.css";
import { Toolbar } from "./components/panels/Toolbar";
import { LeftSidebar } from "./components/panels/LeftSidebar";
import { CanvasPreview } from "./components/panels/CanvasPreview";
import { CodeEditor } from "./components/panels/CodeEditor";
import { SceneInspector } from "./components/panels/SceneInspector";
import { EntityProperties } from "./components/panels/EntityProperties";
import { ConsolePanel } from "./components/panels/ConsolePanel";
import { AssetBrowser } from "./components/panels/AssetBrowser";
import { TilemapEditor } from "./components/panels/TilemapEditor";
import { ParticleEditor } from "./components/panels/ParticleEditor";
import { VNEditor } from "./components/panels/VNEditor";
import { VisualScriptEditor } from "./components/panels/VisualScriptEditor";
import { SequenceEditor } from "./components/panels/SequenceEditor";
import { AudioMixer } from "./components/panels/AudioMixer";
import { Profiler } from "./components/panels/Profiler";
import { LocalisationEditor } from "./components/panels/LocalisationEditor";
import { VariablesPanel } from "./components/panels/VariablesPanel";
import { VNPreviewPanel } from "./components/panels/VNPreviewPanel";
import { UIPlacementPanel } from "./components/panels/UIPlacementPanel";
import { DatabaseEditor } from "./components/panels/DatabaseEditor";
import { ShaderEditor } from "./components/panels/ShaderEditor";
import { GitPanel } from "./components/panels/GitPanel";
import { ImageEditor } from "./components/panels/ImageEditor";
import { CGGallery } from "./components/panels/CGGallery";
import { SettingsModal } from "./components/modals/SettingsModal";
import { ExportModal } from "./components/modals/ExportModal";
import { CommandPalette } from "./components/modals/CommandPalette";
import { ShortcutsModal } from "./components/modals/ShortcutsModal";
import { DownloadEngineModal } from "./components/modals/DownloadEngineModal";
import { MenuBar } from "./components/panels/MenuBar";
import { useIDEStore } from "./store/ideStore";
import { ProjectService } from "./services/ProjectService";
import { ProjectSettingsModal } from "./components/modals/ProjectSettingsModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PanelErrorBoundary } from "./components/PanelErrorBoundary";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { useIdleCpuCap } from "./hooks/useIdleCpuCap";
import { MobileLayout } from "./components/MobileLayout";
import {
  useAutosave,
  offerRestore,
  applyRestore,
  clearRestore,
} from "./hooks/useAutosave";

function useApplyTheme(): void {
  const theme = useIDEStore((s) => s.theme);
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);
}

function makeTab(
  id: string,
  title: string,
  content: React.ReactElement,
  closable = true,
): TabData {
  return {
    id,
    title,
    content: (
      <PanelErrorBoundary key={id}>
        <ErrorBoundary>{content}</ErrorBoundary>
      </PanelErrorBoundary>
    ),
    closable,
  };
}

function makeImageEditorTab(assetId: string): TabData {
  return makeTab(
    `image-editor-${assetId}`,
    "Image Editor",
    <ImageEditor assetId={assetId} />,
  );
}

const GATED_TABS: Record<string, TabData> = {
  tilemap: makeTab("tilemap", "Tilemap", <TilemapEditor />, true),
  particle: makeTab("particle", "Particles", <ParticleEditor />, true),
  vn: makeTab("vn", "Story Graph", <VNEditor />, true),
  "visual-script": makeTab(
    "visual-script",
    "Visual Script",
    <VisualScriptEditor />,
    true,
  ),
  sequence: makeTab("sequence", "Sequence", <SequenceEditor />, true),
  audio: makeTab("audio", "Audio Mixer", <AudioMixer />, true),
  profiler: makeTab("profiler", "Profiler", <Profiler />, true),
  git: makeTab("git", "Git", <GitPanel />, true),
  i18n: makeTab("i18n", "Localisation", <LocalisationEditor />, true),
  shader: makeTab("shader", "Shader Editor", <ShaderEditor />, true),
  variables: makeTab("variables", "Variables", <VariablesPanel />, true),
  "vn-preview": makeTab("vn-preview", "VN Preview", <VNPreviewPanel />, true),
  "ui-placement": makeTab("ui-placement", "UI Placement", <UIPlacementPanel />),
  database: makeTab("database", "Database", <DatabaseEditor />, true),
  "cg-gallery": makeTab("cg-gallery", "CG Gallery", <CGGallery />, true),
};

function getModuleTabs(ids: string[]): TabData[] {
  return ids.flatMap((id) => {
    const tab = GATED_TABS[id];
    return tab !== undefined ? [tab] : [];
  });
}

function buildDefaultLayout(): LayoutData {
  const enabledModules = useIDEStore.getState().enabledModules;
  const mainGated = [
    "tilemap",
    "particle",
    "vn",
    "vn-preview",
    "visual-script",
    "sequence",
    "cg-gallery",
  ];
  const bottomGated = [
    "profiler",
    "git",
    "i18n",
    "audio",
    "variables",
    "ui-placement",
    "database",
  ];
  return {
    dockbox: {
      mode: "horizontal",
      children: [
        {
          size: 220,
          tabs: [makeTab("files", "Files", <LeftSidebar />)],
        },
        {
          size: 800,
          mode: "vertical",
          children: [
            {
              size: 580,
              tabs: [
                makeTab("code", "Code", <CodeEditor />),
                makeTab("canvas", "Preview", <CanvasPreview />),
                makeTab("scene", "Scene", <SceneInspector />),
                ...getModuleTabs(
                  mainGated.filter((id) => enabledModules.includes(id)),
                ),
              ],
            },
            {
              size: 200,
              tabs: [
                makeTab("console", "Console", <ConsolePanel />),
                makeTab("assets", "Assets", <AssetBrowser />),
                ...getModuleTabs(
                  bottomGated.filter((id) => enabledModules.includes(id)),
                ),
              ],
            },
          ],
        },
        {
          size: 280,
          tabs: [makeTab("inspector", "Inspector", <EntityProperties />)],
        },
      ],
    },
  };
}

const DEFAULT_LAYOUT: LayoutData = buildDefaultLayout();
const LAYOUT_STORAGE_KEY = "es-dock-layout";

function loadPersistedLayout(): LayoutData {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LayoutData;
  } catch {
    // corrupted — fall through to default
  }
  return DEFAULT_LAYOUT;
}

const ALL_PANEL_TABS: Record<string, () => TabData> = {
  code: () => makeTab("code", "Code", <CodeEditor />),
  canvas: () => makeTab("canvas", "Preview", <CanvasPreview />),
  scene: () => makeTab("scene", "Scene", <SceneInspector />),
  files: () => makeTab("files", "Files", <LeftSidebar />),
  console: () => makeTab("console", "Console", <ConsolePanel />),
  assets: () => makeTab("assets", "Assets", <AssetBrowser />),
  inspector: () => makeTab("inspector", "Inspector", <EntityProperties />),
  tilemap: () =>
    GATED_TABS["tilemap"] ?? makeTab("tilemap", "Tilemap", <TilemapEditor />),
  particle: () =>
    GATED_TABS["particle"] ??
    makeTab("particle", "Particles", <ParticleEditor />),
  vn: () => GATED_TABS["vn"] ?? makeTab("vn", "Story Graph", <VNEditor />),
  "visual-script": () =>
    GATED_TABS["visual-script"] ??
    makeTab("visual-script", "Visual Script", <VisualScriptEditor />),
  sequence: () =>
    GATED_TABS["sequence"] ??
    makeTab("sequence", "Sequence", <SequenceEditor />),
  audio: () =>
    GATED_TABS["audio"] ?? makeTab("audio", "Audio Mixer", <AudioMixer />),
  profiler: () =>
    GATED_TABS["profiler"] ?? makeTab("profiler", "Profiler", <Profiler />),
  git: () => GATED_TABS["git"] ?? makeTab("git", "Git", <GitPanel />),
  i18n: () =>
    GATED_TABS["i18n"] ??
    makeTab("i18n", "Localisation", <LocalisationEditor />),
  shader: () =>
    GATED_TABS["shader"] ??
    makeTab("shader", "Shader Editor", <ShaderEditor />),
  variables: () =>
    GATED_TABS["variables"] ??
    makeTab("variables", "Variables", <VariablesPanel />),
  "vn-preview": () =>
    GATED_TABS["vn-preview"] ??
    makeTab("vn-preview", "VN Preview", <VNPreviewPanel />),
  "ui-placement": () =>
    GATED_TABS["ui-placement"] ??
    makeTab("ui-placement", "UI Placement", <UIPlacementPanel />),
  database: () =>
    GATED_TABS["database"] ??
    makeTab("database", "Database", <DatabaseEditor />),
  "cg-gallery": () =>
    GATED_TABS["cg-gallery"] ??
    makeTab("cg-gallery", "CG Gallery", <CGGallery />, true),
};

export function App(): React.ReactElement {
  const settingsOpen = useIDEStore((s) => s.settingsOpen);
  const setSettingsOpen = useIDEStore((s) => s.setSettingsOpen);
  const projectSettingsOpen = useIDEStore((s) => s.projectSettingsOpen);
  const setProjectSettingsOpen = useIDEStore((s) => s.setProjectSettingsOpen);
  const openImageEditorRequest = useIDEStore((s) => s.openImageEditorRequest);
  const { isMobile } = useBreakpoint();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [downloadEngineOpen, setDownloadEngineOpen] = React.useState(false);
  const layoutRef = React.useRef<DockLayout>(null);
  const [dockLayout, setDockLayout] =
    React.useState<LayoutData>(loadPersistedLayout);
  const prevImageEditorReqRef = React.useRef<{
    assetId: string;
    ts: number;
  } | null>(null);

  // Restore banner — shown once on mount if an autosave snapshot exists
  const [showRestoreBanner, setShowRestoreBanner] = React.useState(() =>
    offerRestore(),
  );

  const handleRestore = React.useCallback((): void => {
    applyRestore();
    clearRestore();
    setShowRestoreBanner(false);
  }, []);

  const handleDismissRestore = React.useCallback((): void => {
    clearRestore();
    setShowRestoreBanner(false);
  }, []);

  const handleLayoutChange = React.useCallback(
    (newLayout: LayoutData): void => {
      setDockLayout(newLayout);
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout));
      } catch {
        // storage full — ignore
      }
    },
    [],
  );

  const loadTab = React.useCallback((tab: TabData): TabData => {
    const id = tab.id ?? "";
    if (id.startsWith("image-editor-")) {
      const assetId = id.slice("image-editor-".length);
      return makeImageEditorTab(assetId);
    }
    const factory = ALL_PANEL_TABS[id];
    return factory ? factory() : tab;
  }, []);

  const openPanelInLayout = React.useCallback((tabId: string): void => {
    const layout = layoutRef.current;
    if (!layout) return;
    const existing = layout.find(tabId);
    if (existing) {
      layout.updateTab(tabId, null, true);
      return;
    }
    const factory = ALL_PANEL_TABS[tabId];
    if (!factory) return;
    layout.dockMove(factory(), null, "float");
  }, []);

  useApplyTheme();
  useIdleCpuCap();
  useAutosave();

  // Open image editor when requested from the store
  React.useEffect(() => {
    const req = openImageEditorRequest;
    if (req === null) return;
    if (
      prevImageEditorReqRef.current !== null &&
      prevImageEditorReqRef.current.ts === req.ts
    )
      return;
    prevImageEditorReqRef.current = req;
    const layout = layoutRef.current;
    if (layout === null) return;
    const tabId = `image-editor-${req.assetId}`;
    const existing = layout.find(tabId);
    if (existing) {
      layout.updateTab(tabId, null, true);
      return;
    }
    layout.dockMove(makeImageEditorTab(req.assetId), null, "float");
  }, [openImageEditorRequest]);

  // Auto-open a module's panel when the module is enabled
  const enabledModules = useIDEStore((s) => s.enabledModules);
  const prevModulesRef = React.useRef<string[]>(enabledModules);
  React.useEffect(() => {
    const prev = prevModulesRef.current;
    const added = enabledModules.filter((id) => !prev.includes(id));
    for (const id of added) {
      openPanelInLayout(id);
    }
    prevModulesRef.current = enabledModules;
  }, [enabledModules, openPanelInLayout]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "k" || e.key === "p") {
          e.preventDefault();
          setPaletteOpen((prev) => !prev);
        } else if (e.key === "s") {
          e.preventDefault();
          void ProjectService.saveProject();
        } else if (e.key === "o") {
          e.preventDefault();
          void ProjectService.loadProject();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "var(--es-bg)",
        overflow: "hidden",
      }}
    >
      {showRestoreBanner && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            height: 36,
            background: "var(--es-surface)",
            borderBottom: "1px solid var(--es-border)",
            fontSize: 12,
            color: "var(--es-text)",
          }}
        >
          <span style={{ flex: 1 }}>Unsaved session found. Restore it?</span>
          <button
            type="button"
            onClick={handleRestore}
            style={{
              background: "rgba(124,106,247,0.18)",
              border: "1px solid rgba(124,106,247,0.4)",
              borderRadius: 4,
              color: "var(--es-text)",
              cursor: "pointer",
              fontSize: 12,
              padding: "2px 10px",
            }}
          >
            Restore unsaved session
          </button>
          <button
            type="button"
            onClick={handleDismissRestore}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--es-text-muted)",
              cursor: "pointer",
              fontSize: 12,
              padding: "2px 6px",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {!isMobile && (
        <>
          <MenuBar
            onOpenExport={() => setExportOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenDownload={() => setDownloadEngineOpen(true)}
            onOpenPanel={openPanelInLayout}
            onOpenModules={() => setProjectSettingsOpen(true)}
          />
          <Toolbar onExport={() => setExportOpen(true)} />
        </>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ProjectSettingsModal
        open={projectSettingsOpen}
        onClose={() => setProjectSettingsOpen(false)}
      />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <DownloadEngineModal
        open={downloadEngineOpen}
        onClose={() => setDownloadEngineOpen(false)}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenExport={() => {
          setPaletteOpen(false);
          setExportOpen(true);
        }}
      />

      {isMobile ? (
        <MobileLayout />
      ) : (
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
            marginTop: showRestoreBanner ? 36 : 0,
          }}
          className="es-dock-container"
        >
          <DockLayout
            ref={layoutRef}
            layout={dockLayout}
            onLayoutChange={handleLayoutChange}
            loadTab={loadTab}
            style={{ position: "absolute", inset: 0 }}
          />
        </div>
      )}
    </div>
  );
}

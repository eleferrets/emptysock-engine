import React from 'react';
import DockLayout from 'rc-dock';
import type { LayoutData, TabData } from 'rc-dock';
import 'rc-dock/dist/rc-dock.css';
import { Toolbar } from './components/panels/Toolbar';
import { LeftSidebar } from './components/panels/LeftSidebar';
import { CanvasPreview } from './components/panels/CanvasPreview';
import { CodeEditor } from './components/panels/CodeEditor';
import { SceneInspector } from './components/panels/SceneInspector';
import { EntityProperties } from './components/panels/EntityProperties';
import { ConsolePanel } from './components/panels/ConsolePanel';
import { AssetBrowser } from './components/panels/AssetBrowser';
import { TilemapEditor } from './components/panels/TilemapEditor';
import { ParticleEditor } from './components/panels/ParticleEditor';
import { VNEditor } from './components/panels/VNEditor';
import { VisualScriptEditor } from './components/panels/VisualScriptEditor';
import { SequenceEditor } from './components/panels/SequenceEditor';
import { AudioMixer } from './components/panels/AudioMixer';
import { Profiler } from './components/panels/Profiler';
import { LocalisationEditor } from './components/panels/LocalisationEditor';
import { GitPanel } from './components/panels/GitPanel';
import { SettingsModal } from './components/modals/SettingsModal';
import { ExportModal } from './components/modals/ExportModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { DownloadEngineModal } from './components/modals/DownloadEngineModal';
import { MenuBar } from './components/panels/MenuBar';
import { useIDEStore } from './store/ideStore';
import { ProjectSettingsModal } from './components/modals/ProjectSettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useBreakpoint } from './hooks/useBreakpoint';
import { MobileLayout } from './components/MobileLayout';

function useApplyTheme(): void {
  const theme = useIDEStore((s) => s.theme);
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

function makeTab(id: string, title: string, content: React.ReactElement, closable = false): TabData {
  return { id, title, content: <ErrorBoundary>{content}</ErrorBoundary>, closable };
}

const GATED_TABS: Record<string, TabData> = {
  tilemap: makeTab('tilemap', 'Tilemap', <TilemapEditor />, true),
  particle: makeTab('particle', 'Particles', <ParticleEditor />, true),
  vn: makeTab('vn', 'VN Graph', <VNEditor />, true),
  'visual-script': makeTab('visual-script', 'Visual Script', <VisualScriptEditor />, true),
  sequence: makeTab('sequence', 'Sequence', <SequenceEditor />, true),
  audio: makeTab('audio', 'Audio Mixer', <AudioMixer />, true),
  profiler: makeTab('profiler', 'Profiler', <Profiler />, true),
  git: makeTab('git', 'Git', <GitPanel />, true),
  i18n: makeTab('i18n', 'Localisation', <LocalisationEditor />, true),
};

function getModuleTabs(ids: string[]): TabData[] {
  return ids.flatMap((id) => {
    const tab = GATED_TABS[id];
    return tab !== undefined ? [tab] : [];
  });
}

function buildDefaultLayout(): LayoutData {
  const enabledModules = useIDEStore.getState().enabledModules;
  const mainGated = ['tilemap', 'particle', 'vn', 'visual-script', 'sequence'];
  const bottomGated = ['profiler', 'git', 'i18n', 'audio'];
  return {
    dockbox: {
      mode: 'horizontal',
      children: [
        {
          size: 220,
          tabs: [makeTab('files', 'Files', <LeftSidebar />)],
        },
        {
          size: 800,
          mode: 'vertical',
          children: [
            {
              size: 580,
              tabs: [
                makeTab('code', 'Code', <CodeEditor />),
                makeTab('canvas', 'Preview', <CanvasPreview />),
                makeTab('scene', 'Scene', <SceneInspector />),
                ...getModuleTabs(mainGated.filter((id) => enabledModules.includes(id))),
              ],
            },
            {
              size: 200,
              tabs: [
                makeTab('console', 'Console', <ConsolePanel />),
                makeTab('assets', 'Assets', <AssetBrowser />),
                ...getModuleTabs(bottomGated.filter((id) => enabledModules.includes(id))),
              ],
            },
          ],
        },
        {
          size: 280,
          tabs: [makeTab('inspector', 'Inspector', <EntityProperties />)],
        },
      ],
    },
  };
}

const DEFAULT_LAYOUT: LayoutData = buildDefaultLayout();

export function App(): React.ReactElement {
  const { settingsOpen, setSettingsOpen, projectSettingsOpen, setProjectSettingsOpen } = useIDEStore();
  const { isMobile } = useBreakpoint();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [downloadEngineOpen, setDownloadEngineOpen] = React.useState(false);

  useApplyTheme();

  React.useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'p')) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <MenuBar onOpenExport={() => setExportOpen(true)} onOpenPalette={() => setPaletteOpen(true)} onOpenShortcuts={() => setShortcutsOpen(true)} onOpenDownload={() => setDownloadEngineOpen(true)} />
      <Toolbar onExport={() => setExportOpen(true)} />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProjectSettingsModal open={projectSettingsOpen} onClose={() => setProjectSettingsOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <DownloadEngineModal open={downloadEngineOpen} onClose={() => setDownloadEngineOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenExport={() => { setPaletteOpen(false); setExportOpen(true); }}
      />

      {isMobile ? (
        <MobileLayout />
      ) : (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }} className="es-dock-container">
          <DockLayout
            defaultLayout={DEFAULT_LAYOUT}
            style={{ position: 'absolute', inset: 0 }}
          />
        </div>
      )}
    </div>
  );
}

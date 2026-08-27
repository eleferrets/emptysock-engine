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
import { AudioMixer } from './components/panels/AudioMixer';
import { Profiler } from './components/panels/Profiler';
import { LocalisationEditor } from './components/panels/LocalisationEditor';
import { GitPanel } from './components/panels/GitPanel';
import { SettingsModal } from './components/modals/SettingsModal';
import { ExportModal } from './components/modals/ExportModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { MenuBar } from './components/panels/MenuBar';
import { useIDEStore } from './store/ideStore';
import { ErrorBoundary } from './components/ErrorBoundary';

function useApplyTheme(): void {
  const theme = useIDEStore(s => s.theme);
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

function makeTab(id: string, title: string, content: React.ReactElement, closable = false): TabData {
  return { id, title, content: <ErrorBoundary>{content}</ErrorBoundary>, closable };
}

const DEFAULT_LAYOUT: LayoutData = {
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
              makeTab('tilemap', 'Tilemap', <TilemapEditor />, true),
              makeTab('particle', 'Particles', <ParticleEditor />, true),
              makeTab('vn', 'VN Graph', <VNEditor />, true),
            ],
          },
          {
            size: 200,
            tabs: [
              makeTab('console', 'Console', <ConsolePanel />),
              makeTab('assets', 'Assets', <AssetBrowser />),
              makeTab('profiler', 'Profiler', <Profiler />, true),
              makeTab('git', 'Git', <GitPanel />, true),
              makeTab('i18n', 'Localisation', <LocalisationEditor />, true),
              makeTab('audio', 'Audio Mixer', <AudioMixer />, true),
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

export function App(): React.ReactElement {
  const { settingsOpen, setSettingsOpen } = useIDEStore();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  useApplyTheme();

  React.useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'p')) {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
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
      <MenuBar onOpenExport={() => setExportOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
      <Toolbar onExport={() => setExportOpen(true)} />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenExport={() => { setPaletteOpen(false); setExportOpen(true); }}
      />

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <DockLayout
          defaultLayout={DEFAULT_LAYOUT}
          style={{ position: 'absolute', inset: 0 }}
        />
      </div>
    </div>
  );
}

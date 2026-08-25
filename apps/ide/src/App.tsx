import React from 'react';
import { Code, Monitor, Layers, Terminal, Folder, Menu, X, PanelRight } from 'lucide-react';
import { Toolbar } from './components/panels/Toolbar';
import { LeftSidebar } from './components/panels/LeftSidebar';
import { CanvasPreview } from './components/panels/CanvasPreview';
import { CodeEditor } from './components/panels/CodeEditor';
import { SceneInspector } from './components/panels/SceneInspector';
import { EntityProperties } from './components/panels/EntityProperties';
import { ConsolePanel } from './components/panels/ConsolePanel';
import { AssetBrowser } from './components/panels/AssetBrowser';
import { useIDEStore } from './store/ideStore';
import { ErrorBoundary } from './components/ErrorBoundary';

function useIsMobile(): boolean {
  const [mobile, setMobile] = React.useState(() => window.innerWidth < 768);
  React.useEffect(() => {
    const handler = (): void => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

function CenterTabBar(): React.ReactElement {
  const { activeTab, setActiveTab } = useIDEStore();

  const tabs = [
    { id: 'code' as const, label: 'Code', icon: <Code size={12} /> },
    { id: 'canvas' as const, label: 'Preview', icon: <Monitor size={12} /> },
    { id: 'scene' as const, label: 'Scene', icon: <Layers size={12} /> },
  ];

  return (
    <div
      className="flex items-center gap-0 flex-shrink-0"
      style={{
        height: 36,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        paddingLeft: 4,
      }}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className="flex items-center gap-1.5 px-4 h-full text-xs transition-colors"
          style={{
            color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            background: activeTab === tab.id ? 'rgba(124,106,247,0.06)' : undefined,
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function BottomPanel({ height }: { height: number }): React.ReactElement {
  const { bottomTab, setBottomTab } = useIDEStore();

  const tabs = [
    { id: 'console' as const, label: 'Console', icon: <Terminal size={11} /> },
    { id: 'assets' as const, label: 'Assets', icon: <Folder size={11} /> },
  ];

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{
        height,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div
        className="flex items-center gap-0 flex-shrink-0"
        style={{ height: 28, borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setBottomTab(tab.id)}
            className="flex items-center gap-1.5 px-3 h-full text-xs transition-colors"
            style={{
              color: bottomTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: bottomTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {bottomTab === 'console' ? <ConsolePanel /> : <AssetBrowser />}
      </div>
    </div>
  );
}

function MobileDrawer({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 40,
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          background: 'var(--surface)',
          zIndex: 50,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Files</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LeftSidebar />
        </div>
      </div>
    </>
  );
}

export function App(): React.ReactElement {
  const { activeTab, sidebarOpen, toggleSidebar, setSidebarOpen, rightPanelOpen, setRightPanelOpen } = useIDEStore();
  const isMobile = useIsMobile();
  const bottomPanelHeight = isMobile ? 140 : 180;

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', background: 'var(--bg)', overflow: 'hidden' }}
    >
      {/* Top toolbar */}
      <Toolbar />

      {/* Mobile hamburger row */}
      {isMobile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 36,
            padding: '0 8px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={toggleSidebar}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Menu size={18} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Files</span>
          </button>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: rightPanelOpen ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <PanelRight size={18} />
            <span style={{ fontSize: 12 }}>Properties</span>
          </button>
        </div>
      )}

      {/* Mobile sidebar drawer */}
      {isMobile && sidebarOpen && <MobileDrawer onClose={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — desktop only */}
        {!isMobile && <LeftSidebar />}

        {/* Center workspace */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <CenterTabBar />

          <div className="flex flex-1 overflow-hidden">
            {/* Main panel content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'canvas' && <ErrorBoundary><CanvasPreview /></ErrorBoundary>}
                {activeTab === 'code' && <CodeEditor />}
                {activeTab === 'scene' && <SceneInspector />}
              </div>

              <BottomPanel height={bottomPanelHeight} />
            </div>

            {/* Right panel — desktop always, mobile only when toggled */}
            {(!isMobile || rightPanelOpen) && <EntityProperties />}
          </div>
        </div>
      </div>
    </div>
  );
}

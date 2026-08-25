import React from 'react';
import { Code, Monitor, Layers, Terminal, Folder } from 'lucide-react';
import { Toolbar } from './components/panels/Toolbar';
import { LeftSidebar } from './components/panels/LeftSidebar';
import { CanvasPreview } from './components/panels/CanvasPreview';
import { CodeEditor } from './components/panels/CodeEditor';
import { SceneInspector } from './components/panels/SceneInspector';
import { EntityProperties } from './components/panels/EntityProperties';
import { ConsolePanel } from './components/panels/ConsolePanel';
import { AssetBrowser } from './components/panels/AssetBrowser';
import { useIDEStore } from './store/ideStore';

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

function BottomPanel(): React.ReactElement {
  const { bottomTab, setBottomTab } = useIDEStore();

  const tabs = [
    { id: 'console' as const, label: 'Console', icon: <Terminal size={11} /> },
    { id: 'assets' as const, label: 'Assets', icon: <Folder size={11} /> },
  ];

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{
        height: 180,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      {/* Tab bar */}
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

      {/* Panel content */}
      <div className="flex flex-1 overflow-hidden">
        {bottomTab === 'console' ? <ConsolePanel /> : <AssetBrowser />}
      </div>
    </div>
  );
}

export function App(): React.ReactElement {
  const { activeTab } = useIDEStore();

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}
    >
      {/* Top toolbar */}
      <Toolbar />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <LeftSidebar />

        {/* Center workspace */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <CenterTabBar />

          <div className="flex flex-1 overflow-hidden">
            {/* Main panel content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'canvas' && <CanvasPreview />}
                {activeTab === 'code' && <CodeEditor />}
                {activeTab === 'scene' && <SceneInspector />}
              </div>

              {/* Bottom panel */}
              <BottomPanel />
            </div>

            {/* Right panel */}
            <EntityProperties />
          </div>
        </div>
      </div>
    </div>
  );
}

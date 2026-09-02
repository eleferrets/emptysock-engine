import React from "react";
import {
  Code2,
  Layers,
  FolderOpen,
  Terminal,
  PanelRight,
  X,
  Play,
  Square,
} from "lucide-react";
import { CodeEditor } from "./panels/CodeEditor";
import { SceneInspector } from "./panels/SceneInspector";
import { LeftSidebar } from "./panels/LeftSidebar";
import { ConsolePanel } from "./panels/ConsolePanel";
import { AssetBrowser } from "./panels/AssetBrowser";
import { EntityProperties } from "./panels/EntityProperties";
import { Profiler } from "./panels/Profiler";
import { GitPanel } from "./panels/GitPanel";
import { useIDEStore } from "../store/ideStore";
import { ErrorBoundary } from "./ErrorBoundary";

function useWindowWidth(): number {
  const [width, setWidth] = React.useState(() => window.innerWidth);
  React.useEffect(() => {
    const handler = (): void => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

type MainTab = "code" | "scene" | "files" | "console";
type SheetTab = "assets" | "inspector" | "profiler" | "git";

const MAIN_TABS: Array<{
  id: MainTab;
  label: string;
  Icon: React.FC<{ size?: number }>;
}> = [
  { id: "code", label: "Code", Icon: Code2 },
  { id: "scene", label: "Scene", Icon: Layers },
  { id: "files", label: "Files", Icon: FolderOpen },
  { id: "console", label: "Console", Icon: Terminal },
];

const SHEET_TABS: Array<{ id: SheetTab; label: string }> = [
  { id: "assets", label: "Assets" },
  { id: "inspector", label: "Inspector" },
  { id: "profiler", label: "Profiler" },
  { id: "git", label: "Git" },
];

function PanelForTab({ tab }: { tab: MainTab }): React.ReactElement {
  switch (tab) {
    case "code":
      return <CodeEditor />;
    case "scene":
      return <SceneInspector />;
    case "files":
      return <LeftSidebar />;
    case "console":
      return <ConsolePanel />;
  }
}

function SheetContent({ tab }: { tab: SheetTab }): React.ReactElement {
  switch (tab) {
    case "assets":
      return <AssetBrowser />;
    case "inspector":
      return <EntityProperties />;
    case "profiler":
      return <Profiler />;
    case "git":
      return <GitPanel />;
  }
}

export function MobileLayout(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<MainTab>("code");
  const [fabOpen, setFabOpen] = React.useState(false);
  const [sheetTab, setSheetTab] = React.useState<SheetTab | null>(null);

  const projectName = useIDEStore((s) => s.projectName);
  const playState = useIDEStore((s) => s.playState);
  const setPlayState = useIDEStore((s) => s.setPlayState);

  const windowWidth = useWindowWidth();
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  // Swipe gesture state
  const touchStartX = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent): void => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent): void => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(delta) < 50) return;

    const order: MainTab[] = ["code", "scene", "files", "console"];
    const idx = order.indexOf(activeTab);
    if (delta < 0 && idx < order.length - 1) {
      setActiveTab(order[idx + 1] as MainTab);
    } else if (delta > 0 && idx > 0) {
      setActiveTab(order[idx - 1] as MainTab);
    }
  };

  const openSheet = (tab: SheetTab): void => {
    setSheetTab(tab);
    setFabOpen(false);
  };

  const closeSheet = (): void => setSheetTab(null);

  const isPlaying = playState === "playing";

  return (
    <div className="es-mobile-layout">
      {/* Top header bar */}
      <header className="es-mobile-header">
        <span className="es-mobile-project-name">{projectName}</span>
        <button
          className={`es-mobile-run-btn${isPlaying ? " es-mobile-run-btn--stop" : ""}`}
          onClick={() => setPlayState(isPlaying ? "stopped" : "playing")}
        >
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
          <span>{isPlaying ? "Stop" : "Run"}</span>
        </button>
      </header>

      {/* Main panel area */}
      {isTablet ? (
        <div className="es-tablet-panel-area">
          <div className="es-tablet-left">
            <ErrorBoundary>
              <LeftSidebar />
            </ErrorBoundary>
          </div>
          <div className="es-tablet-right">
            <ErrorBoundary>
              <CodeEditor />
            </ErrorBoundary>
          </div>
        </div>
      ) : (
        <div
          className="es-mobile-panel-area"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <ErrorBoundary>
            <PanelForTab tab={activeTab} />
          </ErrorBoundary>
        </div>
      )}

      {/* Floating action button */}
      <div className="es-mobile-fab-area">
        {fabOpen && (
          <div className="es-mobile-fab-menu">
            {SHEET_TABS.map(({ id, label }) => (
              <button
                key={id}
                className="es-mobile-fab-item"
                onClick={() => openSheet(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <button
          className="es-mobile-fab"
          aria-label={fabOpen ? "Close panels menu" : "Open panels"}
          onClick={() => setFabOpen((prev) => !prev)}
        >
          {fabOpen ? (
            <X size={20} />
          ) : (
            <>
              <PanelRight size={18} />
              <span className="es-mobile-fab-label">Panels</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom navigation */}
      <nav className="es-mobile-nav" aria-label="Main navigation">
        {MAIN_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`es-mobile-nav-btn${activeTab === id ? " es-mobile-nav-btn--active" : ""}`}
            aria-label={label}
            aria-current={activeTab === id ? "page" : undefined}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={22} />
            <span className="es-mobile-nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* Half-screen drawer sheet */}
      {sheetTab !== null && (
        <>
          <div className="es-mobile-sheet-backdrop" onClick={closeSheet} />
          <div className="es-mobile-sheet" role="dialog" aria-modal="true">
            <div className="es-mobile-sheet-handle" />
            <div className="es-mobile-sheet-header">
              <span className="es-mobile-sheet-title">
                {SHEET_TABS.find((t) => t.id === sheetTab)?.label}
              </span>
              <button
                className="es-mobile-sheet-close"
                aria-label="Close panel"
                onClick={closeSheet}
              >
                <X size={18} />
              </button>
            </div>
            <div className="es-mobile-sheet-content">
              <ErrorBoundary>
                <SheetContent tab={sheetTab} />
              </ErrorBoundary>
            </div>
          </div>
        </>
      )}

      <style>{`
        .es-mobile-layout {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--es-bg);
          overflow: hidden;
          position: relative;
        }

        /* ── Tablet two-column layout ───────────── */
        .es-tablet-panel-area {
          flex: 1;
          display: flex;
          flex-direction: row;
          overflow: hidden;
        }

        .es-tablet-left {
          width: 40%;
          min-width: 0;
          overflow: hidden;
          border-right: 1px solid var(--es-border);
        }

        .es-tablet-right {
          width: 60%;
          min-width: 0;
          overflow: hidden;
        }

        .es-tablet-left > *,
        .es-tablet-right > * {
          height: 100%;
        }

        /* ── Header ──────────────────────────────── */
        .es-mobile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 44px;
          min-height: 44px;
          padding: 0 12px;
          background: var(--es-surface);
          border-bottom: 1px solid var(--es-border);
          flex-shrink: 0;
        }

        .es-mobile-project-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--es-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 60%;
        }

        .es-mobile-run-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          height: 32px;
          padding: 0 14px;
          border: none;
          border-radius: 16px;
          background: var(--es-accent);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .es-mobile-run-btn--stop {
          background: var(--red, #ef4444);
        }

        .es-mobile-run-btn:active {
          opacity: 0.85;
        }

        /* ── Panel area ──────────────────────────── */
        .es-mobile-panel-area {
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        .es-mobile-panel-area > * {
          height: 100%;
        }

        /* ── FAB ─────────────────────────────────── */
        .es-mobile-fab-area {
          position: absolute;
          right: 16px;
          bottom: calc(var(--es-nav-height) + 16px + env(safe-area-inset-bottom));
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          z-index: 20;
        }

        .es-mobile-fab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 40px;
          padding: 0 16px;
          border-radius: 20px;
          border: none;
          background: var(--es-surface-2);
          color: var(--es-text);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          font-size: 13px;
          font-weight: 500;
        }

        .es-mobile-fab:active {
          opacity: 0.8;
        }

        .es-mobile-fab-label {
          font-size: 13px;
          font-weight: 500;
        }

        .es-mobile-fab-menu {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .es-mobile-fab-item {
          min-height: 44px;
          padding: 0 20px;
          border-radius: 22px;
          border: none;
          background: var(--es-surface-2);
          color: var(--es-text);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          white-space: nowrap;
        }

        .es-mobile-fab-item:active {
          opacity: 0.8;
        }

        /* ── Bottom nav ──────────────────────────── */
        .es-mobile-nav {
          display: flex;
          height: var(--es-nav-height);
          padding-bottom: env(safe-area-inset-bottom);
          background: var(--es-surface);
          border-top: 1px solid var(--es-border);
          flex-shrink: 0;
        }

        .es-mobile-nav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          border: none;
          background: transparent;
          color: var(--es-text-muted);
          cursor: pointer;
          min-height: var(--es-touch-target);
          position: relative;
          padding-top: 4px;
        }

        .es-mobile-nav-btn--active {
          color: var(--es-accent);
        }

        .es-mobile-nav-btn--active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 20%;
          right: 20%;
          height: 2px;
          border-radius: 1px;
          background: var(--es-accent);
        }

        .es-mobile-nav-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        /* ── Sheet ───────────────────────────────── */
        .es-mobile-sheet-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 30;
        }

        .es-mobile-sheet {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          height: 55vh;
          background: var(--es-surface);
          border-top: 1px solid var(--es-border);
          border-radius: 16px 16px 0 0;
          z-index: 31;
          display: flex;
          flex-direction: column;
          animation: es-sheet-slide-up 0.22s ease-out;
          padding-bottom: env(safe-area-inset-bottom);
        }

        @keyframes es-sheet-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        .es-mobile-sheet-handle {
          width: 36px;
          height: 4px;
          border-radius: 2px;
          background: var(--es-border);
          margin: 10px auto 0;
          flex-shrink: 0;
        }

        .es-mobile-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 44px;
          min-height: 44px;
          padding: 0 16px;
          flex-shrink: 0;
          border-bottom: 1px solid var(--es-border);
        }

        .es-mobile-sheet-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--es-text);
        }

        .es-mobile-sheet-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border: none;
          background: transparent;
          color: var(--es-text-muted);
          cursor: pointer;
          border-radius: 8px;
        }

        .es-mobile-sheet-close:active {
          background: var(--es-surface-2);
        }

        .es-mobile-sheet-content {
          flex: 1;
          overflow: auto;
        }
      `}</style>
    </div>
  );
}

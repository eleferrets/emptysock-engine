import React from 'react';
import {
  Play,
  Pause,
  Square,
  Download,
  Settings,
  Zap,
  ChevronDown,
  Bug,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useIDEStore } from '../../store/ideStore';

function BuildStatusPill(): React.ReactElement | null {
  const buildStatus = useIDEStore(s => s.buildStatus);
  const buildDuration = useIDEStore(s => s.buildDuration);
  const setBottomTab = useIDEStore(s => s.setBottomTab);

  if (buildStatus === 'idle') return null;

  if (buildStatus === 'building') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 10,
          background: 'rgba(250,204,21,0.10)',
          border: '1px solid rgba(250,204,21,0.25)',
          fontSize: 11,
          color: '#facc15',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#facc15',
            display: 'inline-block',
            animation: 'es-spin 1s linear infinite',
          }}
        />
        Building…
      </div>
    );
  }

  if (buildStatus === 'success') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 10,
          background: 'rgba(74,222,128,0.10)',
          border: '1px solid rgba(74,222,128,0.25)',
          fontSize: 11,
          color: 'var(--green)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--green)',
            display: 'inline-block',
          }}
        />
        {buildDuration !== null ? `${buildDuration}ms` : 'OK'}
      </div>
    );
  }

  if (buildStatus === 'error') {
    return (
      <button
        type="button"
        title="Click to view errors in console"
        onClick={() => setBottomTab('console')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 10,
          background: 'rgba(248,113,113,0.10)',
          border: '1px solid rgba(248,113,113,0.25)',
          fontSize: 11,
          color: 'var(--red)',
          cursor: 'pointer',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--red)',
            display: 'inline-block',
          }}
        />
        Build error
      </button>
    );
  }

  return null;
}

export function Toolbar(): React.ReactElement {
  const { playState, projectName, setPlayState, buildMode, toggleBuildMode, setSettingsOpen } = useIDEStore();

  const handlePlay = (): void => {
    if (playState === 'playing') {
      setPlayState('paused');
    } else {
      setPlayState('playing');
    }
  };

  const handleStop = (): void => {
    setPlayState('stopped');
  };

  const debugTooltip =
    buildMode === 'debug'
      ? 'Debug: physics overlays visible, console kept. Click for Release.'
      : 'Release: stripped, minified. Click for Debug.';

  return (
    <>
      {/* Keyframe for the building spinner */}
      <style>{`
        @keyframes es-spin {
          from { opacity: 1; }
          50% { opacity: 0.3; }
          to { opacity: 1; }
        }
      `}</style>

      <header
        className="flex items-center h-10 px-3 gap-2 border-b"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: 'var(--accent)' }}
          >
            <Zap size={13} color="white" strokeWidth={2.5} />
          </div>
          <span
            className="font-semibold text-sm tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            EmptySock
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

        {/* Project name */}
        <button
          type="button"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <span style={{ color: 'var(--text)' }} className="font-medium">
            {projectName}
          </span>
          <ChevronDown size={11} />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Build status pill */}
        <BuildStatusPill />

        {/* Play controls */}
        <div
          className="flex items-center rounded overflow-hidden border"
          style={{ borderColor: 'var(--border)' }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePlay}
            title={playState === 'playing' ? 'Pause' : 'Play'}
            style={{
              borderRadius: 0,
              color: playState === 'playing' ? 'var(--yellow)' : 'var(--green)',
              background: playState === 'playing' ? 'rgba(250,204,21,0.08)' : undefined,
            }}
          >
            {playState === 'playing' ? <Pause size={13} /> : <Play size={13} />}
          </Button>
          <div className="w-px h-5" style={{ background: 'var(--border)' }} />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStop}
            disabled={playState === 'stopped'}
            title="Stop"
            style={{ borderRadius: 0, color: 'var(--red)' }}
          >
            <Square size={13} />
          </Button>

          <div className="w-px h-5" style={{ background: 'var(--border)' }} />

          {/* Debug / Release toggle */}
          <button
            type="button"
            title={debugTooltip}
            onClick={toggleBuildMode}
            className="flex items-center gap-1 px-2"
            style={{
              height: '100%',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.05em',
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              background: buildMode === 'debug' ? 'rgba(124,106,247,0.12)' : 'transparent',
              color: buildMode === 'debug' ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s',
              minWidth: 64,
              justifyContent: 'center',
            }}
          >
            <Bug size={10} />
            {buildMode === 'debug' ? 'DEBUG' : 'RELEASE'}
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

        {/* Export */}
        <Button variant="accent" size="sm">
          <Download size={11} />
          Export
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings size={13} />
        </Button>
      </header>
    </>
  );
}

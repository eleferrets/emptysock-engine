import React from 'react';
import {
  Play,
  Pause,
  Square,
  Download,
  Settings,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useIDEStore } from '../../store/ideStore';

export function Toolbar(): React.ReactElement {
  const { playState, projectName, setPlayState } = useIDEStore();

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

  return (
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
      </div>

      {/* Separator */}
      <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

      {/* Export */}
      <Button variant="accent" size="sm">
        <Download size={11} />
        Export
      </Button>

      {/* Settings */}
      <Button variant="ghost" size="icon" title="Settings">
        <Settings size={13} />
      </Button>
    </header>
  );
}

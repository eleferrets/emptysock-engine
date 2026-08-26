import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIDEStore } from '../../store/ideStore';
import { BrowserFileService } from '../../services/BrowserFileService';
import { TauriFileService } from '../../services/TauriFileService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuItem {
  type: 'item';
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

interface MenuSeparator {
  type: 'separator';
}

type MenuEntry = MenuItem | MenuSeparator;

interface MenuDef {
  label: string;
  items: MenuEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function Kbd({ shortcut }: { shortcut: string }): React.ReactElement {
  return (
    <span style={{ marginLeft: 'auto', paddingLeft: 24, color: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', opacity: 0.8 }}>
      {shortcut}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single dropdown menu
// ---------------------------------------------------------------------------

interface DropdownProps {
  def: MenuDef;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onHoverSibling: (open: boolean) => void;
}

function Dropdown({ def, open, onOpen, onClose, onHoverSibling }: DropdownProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); open ? onClose() : onOpen(); }}
        onMouseEnter={() => onHoverSibling(open)}
        style={{
          background: open ? 'rgba(124,106,247,0.14)' : 'transparent',
          border: 'none',
          color: open ? 'var(--text)' : 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 12,
          padding: '0 10px',
          height: 28,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          transition: 'background 0.1s, color 0.1s',
          userSelect: 'none',
        }}
        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
        onMouseOut={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
      >
        {def.label}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            minWidth: 220,
            padding: '4px 0',
            marginTop: 2,
          }}
        >
          {def.items.map((item, i) => {
            if (item.type === 'separator') {
              return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
            }
            return (
              <button
                key={i}
                type="button"
                disabled={item.disabled === true}
                onMouseDown={e => {
                  e.preventDefault();
                  if (item.disabled !== true) { item.action(); onClose(); }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: item.disabled === true ? 'default' : 'pointer',
                  color: item.disabled === true ? 'var(--text-muted)' : 'var(--text)',
                  fontSize: 12,
                  textAlign: 'left',
                  opacity: item.disabled === true ? 0.45 : 1,
                }}
                onMouseOver={e => { if (item.disabled !== true) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,106,247,0.1)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {item.label}
                {item.shortcut !== undefined && <Kbd shortcut={item.shortcut} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MenuBar
// ---------------------------------------------------------------------------

interface MenuBarProps {
  onOpenExport: () => void;
  onOpenPalette: () => void;
}

export function MenuBar({ onOpenExport, onOpenPalette }: MenuBarProps): React.ReactElement {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const {
    playState, setPlayState, toggleDebugOverlay, clearLogs,
    setActiveTab, setSettingsOpen, toggleBuildMode, buildMode, clearBuildCache,
    setEditorCode, editorCode, projectName,
  } = useIDEStore();

  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const mod = isMac ? '⌘' : 'Ctrl';

  const openFile = useCallback((): void => {
    const svc = isTauri() ? TauriFileService : BrowserFileService;
    void svc.openFile().then(r => { if (r.success && r.content !== undefined) setEditorCode(r.content); });
  }, [setEditorCode]);

  const saveFile = useCallback((): void => {
    if (isTauri()) {
      void TauriFileService.saveFile(null, editorCode);
    } else {
      void BrowserFileService.saveFile(`${projectName}.ts`, editorCode);
    }
  }, [editorCode, projectName]);

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { type: 'item', label: 'Open File…', shortcut: `${mod}+O`, action: openFile },
        { type: 'item', label: 'Save File', shortcut: `${mod}+S`, action: saveFile },
        { type: 'separator' },
        { type: 'item', label: 'Export…', shortcut: `${mod}+Shift+E`, action: onOpenExport },
        { type: 'separator' },
        { type: 'item', label: 'Settings', shortcut: `${mod}+,`, action: () => setSettingsOpen(true) },
      ],
    },
    {
      label: 'Edit',
      items: [
        { type: 'item', label: 'Command Palette', shortcut: `${mod}+K`, action: onOpenPalette },
        { type: 'separator' },
        { type: 'item', label: 'Clear Console', action: clearLogs },
        { type: 'item', label: 'Clear Build Cache', action: clearBuildCache },
      ],
    },
    {
      label: 'View',
      items: [
        { type: 'item', label: 'Code Editor', shortcut: `${mod}+1`, action: () => setActiveTab('code') },
        { type: 'item', label: 'Preview', shortcut: `${mod}+2`, action: () => setActiveTab('canvas') },
        { type: 'item', label: 'Scene Inspector', shortcut: `${mod}+3`, action: () => setActiveTab('scene') },
        { type: 'separator' },
        { type: 'item', label: 'Toggle Debug Overlay', shortcut: `${mod}+D`, action: toggleDebugOverlay },
        {
          type: 'item',
          label: buildMode === 'debug' ? 'Switch to Release Mode' : 'Switch to Debug Mode',
          action: toggleBuildMode,
        },
      ],
    },
    {
      label: 'Run',
      items: [
        {
          type: 'item',
          label: playState === 'playing' ? 'Pause' : 'Play',
          shortcut: `${mod}+Enter`,
          action: () => setPlayState(playState === 'playing' ? 'paused' : 'playing'),
        },
        {
          type: 'item',
          label: 'Stop',
          shortcut: `${mod}+.`,
          disabled: playState === 'stopped',
          action: () => setPlayState('stopped'),
        },
      ],
    },
  ];

  // Close menu on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpenIdx(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Additional keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'o') { e.preventDefault(); openFile(); }
      else if (e.key === 's') { e.preventDefault(); saveFile(); }
      else if (e.key === 'Enter') { e.preventDefault(); setPlayState(playState === 'playing' ? 'paused' : 'playing'); }
      else if (e.key === '.') { e.preventDefault(); setPlayState('stopped'); }
      else if (e.key === '1') { e.preventDefault(); setActiveTab('code'); }
      else if (e.key === '2') { e.preventDefault(); setActiveTab('canvas'); }
      else if (e.key === '3') { e.preventDefault(); setActiveTab('scene'); }
      else if (e.key === 'd') { e.preventDefault(); toggleDebugOverlay(); }
      else if (e.key === ',' ) { e.preventDefault(); setSettingsOpen(true); }
      else if (e.shiftKey && e.key === 'E') { e.preventDefault(); onOpenExport(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openFile, saveFile, playState, setPlayState, setActiveTab, toggleDebugOverlay, setSettingsOpen, onOpenExport]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 28,
        padding: '0 6px',
        gap: 2,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {menus.map((menu, i) => (
        <Dropdown
          key={menu.label}
          def={menu}
          open={openIdx === i}
          onOpen={() => setOpenIdx(i)}
          onClose={() => setOpenIdx(null)}
          onHoverSibling={anyOpen => { if (anyOpen) setOpenIdx(i); }}
        />
      ))}
    </div>
  );
}

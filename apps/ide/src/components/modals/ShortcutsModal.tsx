import React from 'react';
import { X } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
const mod = isMac ? '⌘' : 'Ctrl';

const GROUPS: Array<{ heading: string; rows: Array<[string, string]> }> = [
  {
    heading: 'File',
    rows: [
      [`${mod}+N`, 'New Project'],
      [`${mod}+O`, 'Open File…'],
      [`${mod}+S`, 'Save Active File'],
      [`${mod}+Shift+Z`, 'Download Project as ZIP'],
      [`${mod}+Shift+E`, 'Export…'],
      [`${mod}+,`, 'Settings'],
    ],
  },
  {
    heading: 'Playback',
    rows: [
      [`${mod}+Enter`, 'Play / Pause'],
      [`${mod}+.`, 'Stop'],
    ],
  },
  {
    heading: 'View',
    rows: [
      [`${mod}+1`, 'Code Editor'],
      [`${mod}+2`, 'Preview'],
      [`${mod}+3`, 'Scene Inspector'],
      [`${mod}+D`, 'Toggle Debug Overlay'],
    ],
  },
  {
    heading: 'Editor',
    rows: [
      [`${mod}+K`, 'Command Palette'],
      [`${mod}+Z`, 'Undo'],
      [`${mod}+Shift+Z`, 'Redo'],
      [`${mod}+/`, 'Toggle Line Comment'],
      [`${mod}+Shift+F`, 'Format Document'],
      [`${mod}+G`, 'Go to Line'],
      ['F12', 'Go to Definition'],
      ['Alt+Click', 'Add Cursor'],
    ],
  },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          width: 520,
          maxWidth: '92vw',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Keyboard Shortcuts</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '12px 20px 20px' }}>
          {GROUPS.map(group => (
            <div key={group.heading} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                {group.heading}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {group.rows.map(([kbd, label]) => (
                    <tr key={kbd}>
                      <td style={{ padding: '4px 0', width: '45%' }}>
                        <kbd style={{
                          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                          fontSize: 11,
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          padding: '2px 7px',
                          color: 'var(--text)',
                          display: 'inline-block',
                        }}>{kbd}</kbd>
                      </td>
                      <td style={{ padding: '4px 0', fontSize: 12, color: 'var(--text-muted)' }}>{label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

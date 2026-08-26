import React, { useState, useRef } from 'react';
import { Image, Music, FileCode, FileJson, Search, Upload, X, Grid } from 'lucide-react';
import { useIDEStore } from '../../store/ideStore';
import type { AssetItem } from '../../store/ideStore';
import { Button } from '../ui/Button';

function AssetIcon({ type }: { type: AssetItem['type'] }): React.ReactElement {
  const props = { size: 20, strokeWidth: 1.5 };
  switch (type) {
    case 'image': return <Image {...props} style={{ color: 'var(--green)' }} />;
    case 'audio': return <Music {...props} style={{ color: 'var(--accent)' }} />;
    case 'script': return <FileCode {...props} style={{ color: 'var(--blue)' }} />;
    case 'json': return <FileJson {...props} style={{ color: 'var(--yellow)' }} />;
    default: return <FileCode {...props} style={{ color: 'var(--text-muted)' }} />;
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const STRIP_RE = /_strip(\d+)/i;

interface StripDialog {
  fileName: string;
  detectedN: number;
  frameCount: string;
  objectUrl: string;
  size: number;
}

export function AssetBrowser(): React.ReactElement {
  const { assets } = useIDEStore();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stripDialog, setStripDialog] = useState<StripDialog | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = assets.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    for (const file of files) {
      const match = STRIP_RE.exec(file.name);
      if (match !== null && file.type.startsWith('image/')) {
        const n = parseInt(match[1] ?? '0', 10);
        setStripDialog({
          fileName: file.name,
          detectedN: n,
          frameCount: String(n),
          objectUrl: URL.createObjectURL(file),
          size: file.size,
        });
        // Reset input so same file can be re-selected
        e.target.value = '';
        return;
      }
    }
    // Non-strip files: import directly (no-op in this browser stub)
    e.target.value = '';
  };

  const confirmStripImport = (): void => {
    if (stripDialog === null) return;
    const n = parseInt(stripDialog.frameCount, 10);
    if (isNaN(n) || n < 1) return;
    // In a real implementation this would register the sprite sheet with the asset system.
    // Here we just close the dialog and release the object URL.
    URL.revokeObjectURL(stripDialog.objectUrl);
    setStripDialog(null);
  };

  const cancelStripImport = (): void => {
    if (stripDialog !== null) URL.revokeObjectURL(stripDialog.objectUrl);
    setStripDialog(null);
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ height: 28, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search assets…"
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--text)', fontFamily: 'inherit' }}
        />
        <input ref={fileInputRef} type="file" accept="image/*,audio/*,.json,.ts,.js" multiple
          style={{ display: 'none' }} onChange={handleFileChange} />
        <Button variant="ghost" size="sm" title="Import asset" onClick={() => fileInputRef.current?.click()}>
          <Upload size={11} />
          Import
        </Button>
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-3"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, alignContent: 'start' }}>
        {filtered.map(asset => (
          <button key={asset.id}
            onClick={() => setSelectedId(id => id === asset.id ? null : asset.id)}
            className="flex flex-col items-center gap-1 p-2 rounded text-center transition-colors"
            style={{ background: selectedId === asset.id ? 'rgba(124,106,247,0.15)' : 'var(--surface-2)', border: `1px solid ${selectedId === asset.id ? 'var(--accent)' : 'var(--border)'}` }}>
            <AssetIcon type={asset.type} />
            <span className="text-[10px] w-full truncate"
              style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {asset.name.length > 10 ? asset.name.substring(0, 9) + '…' : asset.name}
            </span>
            {asset.size !== undefined && (
              <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{formatSize(asset.size)}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sprite sheet strip import dialog */}
      {stripDialog !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) cancelStripImport(); }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, width: 400, maxWidth: 'calc(100vw - 32px)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Grid size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Import Sprite Sheet</span>
              </div>
              <button onClick={cancelStripImport} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={15} /></button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
                {stripDialog.fileName}
                <span style={{ marginLeft: 8, opacity: 0.6 }}>{formatSize(stripDialog.size)}</span>
              </div>

              {/* Preview */}
              <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: '#0e0e10', maxHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={stripDialog.objectUrl} alt="strip preview"
                  style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain', imageRendering: 'pixelated' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>Frame count</label>
                <input
                  type="number" min={1} max={1024}
                  value={stripDialog.frameCount}
                  onChange={e => setStripDialog(d => d === null ? null : { ...d, frameCount: e.target.value })}
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontSize: 12, padding: '4px 8px', outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
                />
                {stripDialog.detectedN > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>detected: {stripDialog.detectedN}</span>
                )}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Frames are read left-to-right from a single horizontal strip. Set the frame count manually if the filename detection was incorrect.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <Button variant="ghost" size="sm" onClick={cancelStripImport}>Cancel</Button>
              <Button variant="accent" size="sm" onClick={confirmStripImport}
                disabled={isNaN(parseInt(stripDialog.frameCount, 10)) || parseInt(stripDialog.frameCount, 10) < 1}>
                <Grid size={11} />
                Import Strip
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

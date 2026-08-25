import React, { useState } from 'react';
import {
  Image,
  Music,
  FileCode,
  FileJson,
  Search,
  Upload,
} from 'lucide-react';
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

export function AssetBrowser(): React.ReactElement {
  const { assets } = useIDEStore();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = assets.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ height: 28, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
      >
        <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search assets…"
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--text)', fontFamily: 'inherit' }}
        />
        <Button variant="ghost" size="sm" title="Import asset">
          <Upload size={11} />
          Import
        </Button>
      </div>

      {/* Asset grid */}
      <div
        className="flex-1 overflow-y-auto p-3"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, alignContent: 'start' }}
      >
        {filtered.map(asset => (
          <button
            key={asset.id}
            onClick={() => setSelectedId(id => id === asset.id ? null : asset.id)}
            className="flex flex-col items-center gap-1 p-2 rounded text-center transition-colors"
            style={{
              background: selectedId === asset.id ? 'rgba(124,106,247,0.15)' : 'var(--surface-2)',
              border: `1px solid ${selectedId === asset.id ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            <AssetIcon type={asset.type} />
            <span
              className="text-[10px] w-full truncate"
              style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}
            >
              {asset.name.length > 10 ? asset.name.substring(0, 9) + '…' : asset.name}
            </span>
            {asset.size !== undefined && (
              <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                {formatSize(asset.size)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

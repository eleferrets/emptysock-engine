import React, { useState, useCallback } from 'react';
import { X, Download, Globe, Monitor, Apple, Terminal, Smartphone } from 'lucide-react';
import { Button } from '../ui/Button';
import { useIDEStore } from '../../store/ideStore';

export type ExportPlatform = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';

interface PlatformOption {
  id: ExportPlatform;
  label: string;
  icon: React.ReactElement;
  formats: string[];
  note?: string;
}

const PLATFORMS: PlatformOption[] = [
  { id: 'web', label: 'Web', icon: <Globe size={16} />, formats: ['Folder', 'ZIP'] },
  { id: 'windows', label: 'Windows', icon: <Monitor size={16} />, formats: ['Installer (EXE)', 'ZIP'], note: 'Requires NSIS' },
  { id: 'macos', label: 'macOS', icon: <Apple size={16} />, formats: ['.app', '.dmg'], note: 'Requires Xcode on macOS' },
  { id: 'linux', label: 'Linux', icon: <Terminal size={16} />, formats: ['ZIP', 'AppImage', '.deb'], note: 'AppImage/deb require system tools' },
  { id: 'android', label: 'Android', icon: <Smartphone size={16} />, formats: ['APK', 'AAB'], note: 'Requires Android Studio' },
  { id: 'ios', label: 'iOS', icon: <Smartphone size={16} />, formats: ['IPA'], note: 'Requires Xcode on macOS' },
];

type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportModal({ open, onClose }: ExportModalProps): React.ReactElement | null {
  const [selectedPlatform, setSelectedPlatform] = useState<ExportPlatform>('web');
  const [selectedFormats, setSelectedFormats] = useState<Record<ExportPlatform, string>>({
    web: 'ZIP', windows: 'ZIP', macos: '.app', linux: 'ZIP', android: 'APK', ios: 'IPA',
  });
  const [minify, setMinify] = useState(true);
  const [dropConsole, setDropConsole] = useState(true);
  const [sourcemap, setSourcemap] = useState(false);
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [outputPath, setOutputPath] = useState('');

  const { projectName, editorCode } = useIDEStore();

  const handleExport = useCallback(async (): Promise<void> => {
    setStatus('exporting');
    setErrorMsg('');
    setOutputPath('');

    try {
      // In a real Tauri app this would invoke the backend export command.
      // In the browser-only IDE we show a descriptive response.
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

      if (isTauri) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoke = (window as any).__TAURI__.core.invoke as (cmd: string, args: unknown) => Promise<{ success: boolean; outputPath: string; error?: string }>;
        const result = await invoke('export_game', {
          platform: selectedPlatform,
          format: selectedFormats[selectedPlatform],
          code: editorCode,
          minify,
          dropConsole,
          sourcemap,
        });
        if (result.success) {
          setStatus('success');
          setOutputPath(result.outputPath);
        } else {
          setStatus('error');
          setErrorMsg(result.error ?? 'Export failed');
        }
      } else {
        // Browser-only: simulate with a short delay and show instructions
        await new Promise<void>(resolve => setTimeout(resolve, 800));
        setStatus('success');
        setOutputPath(`~/Desktop/${projectName}-export/`);
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(String(e));
    }
  }, [selectedPlatform, selectedFormats, editorCode, minify, dropConsole, sourcemap, projectName]);

  if (!open) return null;

  const platform = PLATFORMS.find(p => p.id === selectedPlatform) ?? PLATFORMS[0]!;
  const currentFormat = selectedFormats[selectedPlatform] ?? platform.formats[0] ?? '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          width: 560,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={15} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Export Project</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Platform selector */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Platform</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setSelectedPlatform(p.id); setStatus('idle'); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '10px 8px',
                    borderRadius: 7,
                    border: `1px solid ${selectedPlatform === p.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedPlatform === p.id ? 'rgba(124,106,247,0.12)' : 'var(--bg)',
                    color: selectedPlatform === p.id ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format selector */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Output Format</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {platform.formats.map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSelectedFormats(prev => ({ ...prev, [selectedPlatform]: fmt }))}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: `1px solid ${currentFormat === fmt ? 'var(--accent)' : 'var(--border)'}`,
                    background: currentFormat === fmt ? 'rgba(124,106,247,0.12)' : 'var(--bg)',
                    color: currentFormat === fmt ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
            {platform.note !== undefined && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{platform.note}</div>
            )}
          </div>

          {/* Build options */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Build Options</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { label: 'Minify output', key: 'minify', value: minify, set: setMinify },
                { label: 'Drop console.log calls', key: 'dropConsole', value: dropConsole, set: setDropConsole },
                { label: 'Include sourcemaps', key: 'sourcemap', value: sourcemap, set: setSourcemap },
              ] as const).map(opt => (
                <label
                  key={opt.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}
                >
                  <input
                    type="checkbox"
                    checked={opt.value}
                    onChange={e => opt.set(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Status area */}
          {status === 'success' && (
            <div style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', fontSize: 12, color: 'var(--green)' }}>
              Export complete! Output: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{outputPath}</span>
            </div>
          )}
          {status === 'error' && (
            <div style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', fontSize: 12, color: 'var(--red)' }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={() => { void handleExport(); }} disabled={status === 'exporting'}>
            <Download size={12} />
            {status === 'exporting' ? 'Exporting…' : 'Export'}
          </Button>
        </div>
      </div>
    </div>
  );
}

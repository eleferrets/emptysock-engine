import React, { useState, useCallback } from 'react';
import { X, Download, Globe, Monitor, Apple, Terminal, Smartphone, Zap } from 'lucide-react';
import JSZip from 'jszip';
import { Button } from '../ui/Button';
import { useIDEStore } from '../../store/ideStore';
import { gameBuildService } from '../../services/GameBuildService';
import { BrowserFileService } from '../../services/BrowserFileService';
import { ENGINE_BUNDLE } from '../../runtime/engineBundle.generated';

export type ExportPlatform = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';
type WindowsArch = 'x64' | 'x86';
type LinuxArch = 'x64' | 'x86' | 'arm';
type WindowsFormat = 'EXE' | 'MSI' | 'ZIP';
type LinuxFormat = 'Flatpak' | 'AppImage' | 'tar.gz';

const PLATFORMS: Array<{ id: ExportPlatform; label: string; icon: React.ReactElement }> = [
  { id: 'web', label: 'Web', icon: <Globe size={16} /> },
  { id: 'windows', label: 'Windows', icon: <Monitor size={16} /> },
  { id: 'macos', label: 'macOS', icon: <Apple size={16} /> },
  { id: 'linux', label: 'Linux', icon: <Terminal size={16} /> },
  { id: 'android', label: 'Android', icon: <Smartphone size={16} /> },
  { id: 'ios', label: 'iOS', icon: <Smartphone size={16} /> },
];

type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportModal({ open, onClose }: ExportModalProps): React.ReactElement | null {
  const [selectedPlatform, setSelectedPlatform] = useState<ExportPlatform>('web');
  const [windowsArch, setWindowsArch] = useState<WindowsArch>('x64');
  const [windowsFormat, setWindowsFormat] = useState<WindowsFormat>('EXE');
  const [linuxArch, setLinuxArch] = useState<LinuxArch>('x64');
  const [linuxFormats, setLinuxFormats] = useState<Set<LinuxFormat>>(new Set(['tar.gz']));
  const [minify, setMinify] = useState(true);
  const [dropConsole, setDropConsole] = useState(true);
  const [sourcemap, setSourcemap] = useState(false);
  const [aggressiveMode, setAggressiveMode] = useState(false);
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [outputPath, setOutputPath] = useState('');

  const { projectName, editorCode } = useIDEStore();

  const toggleLinuxFormat = (fmt: LinuxFormat): void => {
    if (fmt === 'tar.gz') return;
    setLinuxFormats(prev => {
      const next = new Set(prev);
      if (next.has(fmt)) next.delete(fmt); else next.add(fmt);
      return next;
    });
  };

  const handleExport = useCallback(async (): Promise<void> => {
    setStatus('exporting');
    setErrorMsg('');
    setOutputPath('');
    try {
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

      if (isTauri && selectedPlatform !== 'web') {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<{ success: boolean; outputPath: string; error?: string }>('export_game', {
          platform: selectedPlatform,
          format: selectedPlatform === 'windows' ? windowsFormat
            : selectedPlatform === 'linux' ? [...linuxFormats].join(',') : undefined,
          arch: selectedPlatform === 'windows' ? windowsArch
            : selectedPlatform === 'linux' ? linuxArch : undefined,
          code: editorCode,
          minify,
          dropConsole,
          sourcemap,
          aggressiveMode,
        });
        if (result.success) { setStatus('success'); setOutputPath(result.outputPath); }
        else { setStatus('error'); setErrorMsg(result.error ?? 'Export failed'); }
        return;
      }

      if (selectedPlatform !== 'web') {
        setStatus('error');
        setErrorMsg('Non-web exports require the desktop app.');
        return;
      }

      const buildResult = await gameBuildService.buildNow({ code: editorCode, mode: minify ? 'release' : 'debug', aggressiveMode });
      if (!buildResult.success) {
        setStatus('error');
        setErrorMsg(buildResult.errors.join('\n'));
        return;
      }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;height:100dvh;overflow:hidden}canvas{display:block;max-width:100%;max-height:100%}</style>
</head>
<body>
  <canvas id="game-canvas"></canvas>
  <script src="engine.js"></script>
  <script src="game.js"></script>
</body>
</html>`;

      const zip = new JSZip();
      zip.file('index.html', html);
      zip.file('engine.js', ENGINE_BUNDLE);
      zip.file('game.js', buildResult.js);
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const filename = `${projectName.replace(/\s+/g, '-').toLowerCase()}-web.zip`;
      BrowserFileService.downloadBlob(filename, blob);
      setStatus('success');
      setOutputPath(filename);
    } catch (e) {
      setStatus('error');
      setErrorMsg(String(e));
    }
  }, [selectedPlatform, windowsArch, windowsFormat, linuxArch, linuxFormats, editorCode, minify, dropConsole, sourcemap, aggressiveMode, projectName]);

  if (!open) return null;

  const SectionLabel = ({ text }: { text: string }): React.ReactElement => (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{text}</div>
  );

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 12,
    padding: '4px 8px',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, width: 560, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={15} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Export Project</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Platform */}
          <div>
            <SectionLabel text="Platform" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setSelectedPlatform(p.id); setStatus('idle'); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 8px', borderRadius: 7, border: `1px solid ${selectedPlatform === p.id ? 'var(--accent)' : 'var(--border)'}`, background: selectedPlatform === p.id ? 'rgba(124,106,247,0.12)' : 'var(--bg)', color: selectedPlatform === p.id ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 500, transition: 'all 0.15s' }}>
                  {p.icon}{p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Windows options */}
          {selectedPlatform === 'windows' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <SectionLabel text="Architecture" />
                <select value={windowsArch} onChange={e => setWindowsArch(e.target.value as WindowsArch)} style={selectStyle}>
                  <option value="x64">x64 (64-bit)</option>
                  <option value="x86">x86 (32-bit)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <SectionLabel text="Format" />
                <select value={windowsFormat} onChange={e => setWindowsFormat(e.target.value as WindowsFormat)} style={selectStyle}>
                  <option value="EXE">Installer (EXE)</option>
                  <option value="MSI">MSI Package</option>
                  <option value="ZIP">Portable ZIP</option>
                </select>
              </div>
            </div>
          )}

          {/* macOS handoff note */}
          {selectedPlatform === 'macos' && (
            <div style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(124,106,247,0.08)', border: '1px solid rgba(124,106,247,0.25)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Xcode handoff: </span>
              macOS builds are compiled locally via Xcode. Clicking Export generates an Xcode project — open it and archive for App Store or notarised distribution.
            </div>
          )}

          {/* Linux options */}
          {selectedPlatform === 'linux' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <SectionLabel text="Architecture" />
                <select value={linuxArch} onChange={e => setLinuxArch(e.target.value as LinuxArch)} style={selectStyle}>
                  <option value="x64">x86_64</option>
                  <option value="x86">x86 (32-bit)</option>
                  <option value="arm">ARM (aarch64)</option>
                </select>
              </div>
              <div>
                <SectionLabel text="Output Formats" />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['tar.gz', 'AppImage', 'Flatpak'] as LinuxFormat[]).map(fmt => {
                    const isArmAppImage = fmt === 'AppImage' && linuxArch === 'arm';
                    const checked = linuxFormats.has(fmt);
                    return (
                      <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: `1px solid ${checked && !isArmAppImage ? 'var(--accent)' : 'var(--border)'}`, background: checked && !isArmAppImage ? 'rgba(124,106,247,0.10)' : 'var(--bg)', fontSize: 12, color: isArmAppImage ? 'var(--text-muted)' : checked ? 'var(--accent)' : 'var(--text)', cursor: isArmAppImage ? 'not-allowed' : 'pointer', opacity: isArmAppImage ? 0.45 : 1 }}>
                        <input type="checkbox" checked={checked} disabled={isArmAppImage} onChange={() => toggleLinuxFormat(fmt)} style={{ accentColor: 'var(--accent)', width: 12, height: 12 }} />
                        {fmt}
                        {fmt === 'tar.gz' && <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.7 }}>required</span>}
                      </label>
                    );
                  })}
                </div>
                {linuxArch === 'arm' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>AppImage is not available for ARM targets.</div>}
              </div>
            </div>
          )}

          {/* Android / iOS future targets */}
          {(selectedPlatform === 'android' || selectedPlatform === 'ios') && (
            <div style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--red)', fontWeight: 600 }}>Future target: </span>
              {selectedPlatform === 'android' ? 'Android' : 'iOS'} export is not yet supported. It will be available in a future release.
            </div>
          )}

          {/* Build options */}
          <div>
            <SectionLabel text="Build Options" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([{ label: 'Minify output', key: 'minify', value: minify, set: setMinify }, { label: 'Drop console.log calls', key: 'dropConsole', value: dropConsole, set: setDropConsole }, { label: 'Include sourcemaps', key: 'sourcemap', value: sourcemap, set: setSourcemap }] as const).map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
                  <input type="checkbox" checked={opt.value} onChange={e => opt.set(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                  {opt.label}
                </label>
              ))}

              {/* Aggressive Optimisation */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginTop: 4, padding: '8px 10px', borderRadius: 7, border: `1px solid ${aggressiveMode ? 'rgba(251,191,36,0.4)' : 'var(--border)'}`, background: aggressiveMode ? 'rgba(251,191,36,0.06)' : 'transparent', transition: 'all 0.15s' }}>
                <input type="checkbox" checked={aggressiveMode} onChange={e => setAggressiveMode(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: aggressiveMode ? 'var(--yellow)' : 'var(--text)', fontWeight: 500 }}>
                    <Zap size={12} />
                    Aggressive Optimisation
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
                    Enables identifier mangling, tree-shaking, and syntax reduction. Smaller bundles but may break dynamic property access.
                  </div>
                </div>
              </label>
            </div>
          </div>

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
          <Button variant="accent" size="sm" onClick={() => { void handleExport(); }} disabled={status === 'exporting' || selectedPlatform === 'android' || selectedPlatform === 'ios'}>
            <Download size={12} />
            {status === 'exporting' ? 'Exporting…' : 'Export'}
          </Button>
        </div>
      </div>
    </div>
  );
}

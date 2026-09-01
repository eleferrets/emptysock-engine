import React from 'react';
import { X, Download, Monitor, Apple, Terminal, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';

interface DownloadEngineModalProps {
  open: boolean;
  onClose: () => void;
}

type Platform = 'mac' | 'windows' | 'linux';
type Arch = 'x64' | 'arm64' | 'universal';

interface Release {
  arch: Arch;
  label: string;
  note?: string;
  recommended?: boolean;
}

interface PlatformConfig {
  id: Platform;
  label: string;
  icon: React.ReactElement;
  releases: Release[];
}

const RELEASES_BASE = 'https://github.com/eleferrets/emptysock-engine/releases/latest/download';
const RELEASES_PAGE = 'https://github.com/eleferrets/emptysock-engine/releases/latest';

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'mac',
    label: 'macOS',
    icon: <Apple size={18} />,
    releases: [
      { arch: 'universal', label: 'Universal Binary', note: 'Intel + Apple Silicon (M1/M2/M3/M4)', recommended: true },
    ],
  },
  {
    id: 'windows',
    label: 'Windows',
    icon: <Monitor size={18} />,
    releases: [
      { arch: 'x64', label: 'Windows x64', note: 'For 64-bit Intel/AMD CPUs', recommended: true },
      { arch: 'arm64', label: 'Windows ARM64', note: 'For Snapdragon X / Surface Pro X' },
    ],
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: <Terminal size={18} />,
    releases: [
      { arch: 'x64', label: 'Linux x86_64', note: 'AppImage — runs on any distro, no install', recommended: true },
      { arch: 'arm64', label: 'Linux ARM64', note: 'AppImage — Raspberry Pi 4+, Ampere, etc.' },
    ],
  },
];

function detectPlatform(): Platform | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (ua.includes('Mac')) return 'mac';
  if (ua.includes('Win')) return 'windows';
  if (ua.includes('Linux')) return 'linux';
  return null;
}

function downloadUrl(platform: Platform, arch: Arch): string {
  const suffix = platform === 'mac'
    ? 'EmptySock-macos-universal.zip'
    : platform === 'windows'
      ? arch === 'arm64' ? 'EmptySock-windows-arm64.zip' : 'EmptySock-windows-x64.zip'
      : arch === 'arm64' ? 'EmptySock-linux-arm64.AppImage.zip' : 'EmptySock-linux-x64.AppImage.zip';
  return `${RELEASES_BASE}/${suffix}`;
}

export function DownloadEngineModal({ open, onClose }: DownloadEngineModalProps): React.ReactElement | null {
  const detected = React.useMemo(detectPlatform, []);
  const [activePlatform, setActivePlatform] = React.useState<Platform>(detected ?? 'mac');

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const platformDef = PLATFORMS.find(p => p.id === activePlatform)!;

  const chip = (text: string, highlight = false): React.ReactElement => (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
      padding: '1px 6px', borderRadius: 10,
      background: highlight ? 'rgba(124,106,247,0.18)' : 'rgba(255,255,255,0.06)',
      color: highlight ? 'var(--accent)' : 'var(--text-muted)',
      border: highlight ? '1px solid rgba(124,106,247,0.35)' : '1px solid var(--border)',
    }}>{text}</span>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: 500, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Download EmptySock Engine</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Desktop app — full file system access, native performance</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}><X size={16} /></button>
        </div>

        {/* Platform tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px', gap: 2, background: 'var(--bg)' }}>
          {PLATFORMS.map(p => {
            const active = activePlatform === p.id;
            const isDetected = detected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePlatform(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  transition: 'color 0.12s',
                }}
              >
                {p.icon}
                {p.label}
                {isDetected && chip('your platform', active)}
              </button>
            );
          })}
        </div>

        {/* Downloads */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {platformDef.releases.map(r => (
            <div key={r.arch} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 8,
              border: `1px solid ${r.recommended ? 'rgba(124,106,247,0.35)' : 'var(--border)'}`,
              background: r.recommended ? 'rgba(124,106,247,0.06)' : 'var(--bg)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {r.label}
                  {r.recommended && chip('recommended', true)}
                </div>
                {r.note !== undefined && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{r.note}</div>
                )}
              </div>
              <a
                href={downloadUrl(activePlatform, r.arch)}
                download
                style={{ textDecoration: 'none' }}
              >
                <Button variant="accent" size="sm">
                  <Download size={12} />
                  Download
                </Button>
              </a>
            </div>
          ))}

          {/* Platform-specific notes */}
          {activePlatform === 'mac' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
              After downloading: unzip, right-click <strong style={{ color: 'var(--text)' }}>EmptySock.app</strong> → Open (first launch only, to bypass Gatekeeper). Universal binary runs natively on both Intel and Apple Silicon.
            </div>
          )}
          {activePlatform === 'windows' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
              Portable ZIP — no installer. Unzip and run <strong style={{ color: 'var(--text)' }}>EmptySock.exe</strong> directly. No registry writes, no admin required.
            </div>
          )}
          {activePlatform === 'linux' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
              AppImage — runs on any distro without installation.{' '}
              After download: <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text)' }}>chmod +x EmptySock-*.AppImage && ./EmptySock-*.AppImage</code>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'center' }}>
            <a href={RELEASES_PAGE} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
              <ExternalLink size={11} />
              All releases &amp; changelogs on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

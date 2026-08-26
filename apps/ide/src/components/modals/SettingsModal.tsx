import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { loadSettings, saveSettings, resetSettings, type IDESettings } from '../../services/SettingsService';
import { useIDEStore } from '../../store/ideStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }): React.ReactElement {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 10,
        paddingBottom: 4,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {label}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: SliderRowProps): React.ReactElement {
  const display = format !== undefined ? format(value) : String(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text)', width: 160, flexShrink: 0 }}>
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {display}
      </span>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, value, onChange }: ToggleRowProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text)', flex: 1, cursor: 'pointer' }}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          background: value ? 'var(--accent)' : 'var(--border)',
          position: 'relative',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  );
}

interface SelectRowProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}

function SelectRow({ label, value, options, onChange }: SelectRowProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text)', width: 160, flexShrink: 0 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--text)',
          fontSize: 12,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function SettingsModal({ open, onClose }: Props): React.ReactElement {
  const clearBuildCache = useIDEStore(s => s.clearBuildCache);
  const [settings, setSettings] = React.useState<IDESettings>(() => loadSettings());

  // Reload from storage whenever the modal opens
  React.useEffect(() => {
    if (open) {
      setSettings(loadSettings());
    }
  }, [open]);

  function patch<K extends keyof IDESettings>(key: K, value: IDESettings[K]): void {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function handleSave(): void {
    saveSettings(settings);
    onClose();
  }

  function handleReset(): void {
    const defaults = resetSettings();
    setSettings(defaults);
  }

  const graphicsTierOptions: Array<{ value: string; label: string }> = [
    { value: 'auto', label: 'Auto (detect)' },
    { value: 'potato', label: 'Potato' },
    { value: 'low', label: 'Low' },
    { value: 'mid', label: 'Mid' },
    { value: 'high', label: 'High' },
    { value: 'ultra', label: 'Ultra' },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 101,
            width: 480,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100dvh - 64px)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <Dialog.Title
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}
            >
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

            {/* Audio */}
            <SectionHeader label="Audio" />
            <SliderRow
              label="Master Volume"
              value={Math.round(settings.masterVolume * 100)}
              min={0}
              max={100}
              format={v => `${v}%`}
              onChange={v => patch('masterVolume', v / 100)}
            />
            <SliderRow
              label="SFX Volume"
              value={Math.round(settings.sfxVolume * 100)}
              min={0}
              max={100}
              format={v => `${v}%`}
              onChange={v => patch('sfxVolume', v / 100)}
            />
            <SliderRow
              label="Music Volume"
              value={Math.round(settings.musicVolume * 100)}
              min={0}
              max={100}
              format={v => `${v}%`}
              onChange={v => patch('musicVolume', v / 100)}
            />

            {/* Build */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Build" />
            </div>
            <ToggleRow
              label="Auto-build on keystroke"
              value={settings.autoBuild}
              onChange={v => patch('autoBuild', v)}
            />
            <SliderRow
              label="Build debounce"
              value={settings.autoBuildDebounceMs}
              min={100}
              max={2000}
              step={50}
              format={v => `${v}ms`}
              onChange={v => patch('autoBuildDebounceMs', v)}
            />

            {/* Graphics */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Graphics" />
            </div>
            <SelectRow
              label="Graphics tier"
              value={settings.graphicsTier}
              options={graphicsTierOptions}
              onChange={v => patch('graphicsTier', v as IDESettings['graphicsTier'])}
            />
            <ToggleRow
              label="Show FPS overlay"
              value={settings.showFpsOverlay}
              onChange={v => patch('showFpsOverlay', v)}
            />

            {/* Editor */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Editor" />
            </div>
            <SliderRow
              label="Font size"
              value={settings.editorFontSize}
              min={10}
              max={24}
              format={v => `${v}px`}
              onChange={v => patch('editorFontSize', v)}
            />

            {/* Cache */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Cache" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <button
                type="button"
                onClick={clearBuildCache}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text)',
                  fontSize: 12,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                Clear Build Cache
              </button>
              <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                Resets build status and clears errors
              </span>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-muted)',
                fontSize: 12,
                padding: '5px 12px',
                cursor: 'pointer',
              }}
            >
              Reset to defaults
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  padding: '5px 12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '5px 16px',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

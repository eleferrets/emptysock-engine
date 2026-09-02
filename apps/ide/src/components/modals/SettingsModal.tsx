import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Upload } from "lucide-react";
import {
  loadSettings,
  saveSettings,
  resetSettings,
  importVSCodeSettings,
  type IDESettings,
} from "../../services/SettingsService";
import { useIDEStore } from "../../store/ideStore";
import { Button } from "../ui/Button";

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
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--es-text-muted)",
        marginBottom: 10,
        paddingBottom: 4,
        borderBottom: "1px solid var(--es-border)",
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
      }}
    >
      <label
        style={{
          fontSize: 12,
          color: "var(--es-text)",
          width: 160,
          flexShrink: 0,
        }}
      >
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: "var(--es-accent)", cursor: "pointer" }}
      />
      <span
        style={{
          fontSize: 11,
          color: "var(--es-text-muted)",
          width: 44,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
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

function ToggleRow({
  label,
  value,
  onChange,
}: ToggleRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
      }}
    >
      <label
        style={{
          fontSize: 12,
          color: "var(--es-text)",
          flex: 1,
          cursor: "pointer",
        }}
      >
        {label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          background: value ? "var(--es-accent)" : "var(--es-border)",
          position: "relative",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.15s",
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

function SelectRow({
  label,
  value,
  options,
  onChange,
}: SelectRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
      }}
    >
      <label
        style={{
          fontSize: 12,
          color: "var(--es-text)",
          width: 160,
          flexShrink: 0,
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: "var(--es-bg)",
          border: "1px solid var(--es-border)",
          borderRadius: 4,
          color: "var(--es-text)",
          fontSize: 12,
          padding: "4px 8px",
          cursor: "pointer",
          colorScheme: "dark light",
        }}
      >
        {options.map((o) => (
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
  const { clearBuildCache, setTheme } = useIDEStore();
  const [settings, setSettings] = React.useState<IDESettings>(() =>
    loadSettings(),
  );
  const [vscodeImportStatus, setVscodeImportStatus] = React.useState<{
    applied: string[];
    skipped: string[];
  } | null>(null);
  const vscodeFileRef = React.useRef<HTMLInputElement>(null);

  // Reload from storage whenever the modal opens
  React.useEffect(() => {
    if (open) {
      setSettings(loadSettings());
    }
  }, [open]);

  function patch<K extends keyof IDESettings>(
    key: K,
    value: IDESettings[K],
  ): void {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(): void {
    saveSettings(settings);
    setTheme(settings.theme);
    onClose();
  }

  function handleVSCodeImport(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file === undefined) return;
    const reader = new FileReader();
    reader.onload = (): void => {
      try {
        const parsed: unknown = JSON.parse(reader.result as string);
        const { patch, result } = importVSCodeSettings(parsed);
        setSettings((prev) => ({ ...prev, ...patch }));
        setVscodeImportStatus(result);
      } catch {
        setVscodeImportStatus({ applied: [], skipped: ["Invalid JSON"] });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleReset(): void {
    const defaults = resetSettings();
    setSettings(defaults);
  }

  const graphicsTierOptions: Array<{ value: string; label: string }> = [
    { value: "auto", label: "Auto (detect)" },
    { value: "potato", label: "Potato" },
    { value: "low", label: "Low" },
    { value: "mid", label: "Mid" },
    { value: "high", label: "High" },
    { value: "ultra", label: "Ultra" },
  ];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 101,
            width: 480,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100dvh - 64px)",
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--es-border)",
              flexShrink: 0,
            }}
          >
            <Dialog.Title
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--es-text)",
                margin: 0,
              }}
            >
              Settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--es-text-muted)",
                  display: "flex",
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {/* Audio */}
            <SectionHeader label="Audio" />
            <SliderRow
              label="Master Volume"
              value={Math.round(settings.masterVolume * 100)}
              min={0}
              max={100}
              format={(v) => `${v}%`}
              onChange={(v) => patch("masterVolume", v / 100)}
            />
            <SliderRow
              label="SFX Volume"
              value={Math.round(settings.sfxVolume * 100)}
              min={0}
              max={100}
              format={(v) => `${v}%`}
              onChange={(v) => patch("sfxVolume", v / 100)}
            />
            <SliderRow
              label="Music Volume"
              value={Math.round(settings.musicVolume * 100)}
              min={0}
              max={100}
              format={(v) => `${v}%`}
              onChange={(v) => patch("musicVolume", v / 100)}
            />

            {/* Performance */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Performance" />
            </div>
            <SelectRow
              label="Power mode"
              value={settings.powerMode}
              options={[
                {
                  value: "performance",
                  label: "⚡ Performance — full frame rate",
                },
                { value: "balanced", label: "⚖️ Balanced (recommended)" },
                {
                  value: "saver",
                  label: "🔋 Power Saver — reduced idle activity",
                },
              ]}
              onChange={(v) =>
                patch("powerMode", v as IDESettings["powerMode"])
              }
            />
            <SliderRow
              label="Idle CPU cap"
              value={settings.idleCpuCap}
              min={10}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              onChange={(v) => patch("idleCpuCap", v)}
            />
            <SliderRow
              label="Build workers"
              value={settings.buildWorkers}
              min={1}
              max={Math.max(
                1,
                typeof navigator !== "undefined"
                  ? navigator.hardwareConcurrency || 8
                  : 8,
              )}
              step={1}
              format={(v) => (v === 1 ? "1 core" : `${v} cores`)}
              onChange={(v) => patch("buildWorkers", v)}
            />

            {/* Build */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Build" />
            </div>
            <ToggleRow
              label="Auto-build on keystroke"
              value={settings.autoBuild}
              onChange={(v) => patch("autoBuild", v)}
            />
            <SliderRow
              label="Build debounce"
              value={settings.autoBuildDebounceMs}
              min={100}
              max={2000}
              step={50}
              format={(v) => `${v}ms`}
              onChange={(v) => patch("autoBuildDebounceMs", v)}
            />

            {/* Graphics */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Graphics" />
            </div>
            <SelectRow
              label="Graphics tier"
              value={settings.graphicsTier}
              options={graphicsTierOptions}
              onChange={(v) =>
                patch("graphicsTier", v as IDESettings["graphicsTier"])
              }
            />
            <ToggleRow
              label="Show FPS overlay"
              value={settings.showFpsOverlay}
              onChange={(v) => patch("showFpsOverlay", v)}
            />

            {/* Editor */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Editor" />
            </div>
            <SelectRow
              label="Theme"
              value={settings.theme}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
                { value: "system", label: "System (follow OS)" },
              ]}
              onChange={(v) => patch("theme", v as IDESettings["theme"])}
            />
            <SliderRow
              label="Font size"
              value={settings.editorFontSize}
              min={10}
              max={24}
              format={(v) => `${v}px`}
              onChange={(v) => patch("editorFontSize", v)}
            />
            <SliderRow
              label="Tab size"
              value={settings.editorTabSize}
              min={2}
              max={8}
              format={(v) => `${v} spaces`}
              onChange={(v) => patch("editorTabSize", v)}
            />
            <ToggleRow
              label="Word wrap"
              value={settings.editorWordWrap}
              onChange={(v) => patch("editorWordWrap", v)}
            />
            <ToggleRow
              label="Minimap"
              value={settings.editorMinimap}
              onChange={(v) => patch("editorMinimap", v)}
            />
            <ToggleRow
              label="Line numbers"
              value={settings.editorLineNumbers}
              onChange={(v) => patch("editorLineNumbers", v)}
            />

            {/* VS Code Import */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Import VS Code Settings" />
            </div>
            <div
              style={{
                marginBottom: 8,
                fontSize: 11,
                color: "var(--es-text-muted)",
                lineHeight: 1.5,
              }}
            >
              Import a VS Code{" "}
              <code
                style={{
                  background: "var(--es-surface-2)",
                  padding: "1px 4px",
                  borderRadius: 3,
                }}
              >
                settings.json
              </code>{" "}
              or{" "}
              <code
                style={{
                  background: "var(--es-surface-2)",
                  padding: "1px 4px",
                  borderRadius: 3,
                }}
              >
                extensions.json
              </code>{" "}
              file to apply compatible settings. Mapped: font size, tab size,
              word wrap, minimap, line numbers, color theme.
            </div>
            <div
              style={{
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <input
                ref={vscodeFileRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleVSCodeImport}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setVscodeImportStatus(null);
                  vscodeFileRef.current?.click();
                }}
              >
                <Upload size={12} style={{ marginRight: 5 }} />
                Choose settings.json
              </Button>
            </div>
            {vscodeImportStatus !== null && (
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.6,
                  padding: "8px 10px",
                  borderRadius: 4,
                  background: "var(--es-surface-2)",
                  border: "1px solid var(--es-border)",
                  marginBottom: 10,
                }}
              >
                {vscodeImportStatus.applied.length > 0 && (
                  <div style={{ color: "var(--es-green)" }}>
                    Applied: {vscodeImportStatus.applied.join(", ")}
                  </div>
                )}
                {vscodeImportStatus.skipped.length > 0 && (
                  <div style={{ color: "var(--es-text-muted)" }}>
                    Skipped: {vscodeImportStatus.skipped.join(", ")}
                  </div>
                )}
                {vscodeImportStatus.applied.length === 0 &&
                  vscodeImportStatus.skipped.length === 0 && (
                    <div style={{ color: "var(--es-text-muted)" }}>
                      No recognised settings found.
                    </div>
                  )}
              </div>
            )}

            {/* Cache */}
            <div style={{ marginTop: 20 }}>
              <SectionHeader label="Cache" />
            </div>
            <div
              style={{
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Button variant="outline" size="sm" onClick={clearBuildCache}>
                Clear Build Cache
              </Button>
              <span style={{ fontSize: 11, color: "var(--es-text-muted)" }}>
                Resets build status and clears errors
              </span>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderTop: "1px solid var(--es-border)",
              flexShrink: 0,
            }}
          >
            <Button variant="danger" size="sm" onClick={handleReset}>
              Reset to defaults
            </Button>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="accent" size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

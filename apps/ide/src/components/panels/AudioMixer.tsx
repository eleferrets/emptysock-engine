import React, { useEffect } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { audioMixerService } from "../../services/AudioMixerService";
import { useAudioStore } from "../../store/audioStore";
import type { AudioBus } from "../../store/audioStore";
import { useHistory } from "../../hooks/useHistory";

export function AudioMixer(): React.ReactElement {
  const buses = useAudioStore((s) => s.audioBuses);
  const setAudioBuses = useAudioStore((s) => s.setAudioBuses);

  const {
    state: histBuses,
    set: histSet,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<AudioBus[]>(buses);

  // Sync history state → audioStore (handles both normal mutations and undo/redo restores)
  useEffect(() => {
    setAudioBuses(histBuses);
  }, [histBuses, setAudioBuses]);

  // Keyboard undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, canRedo, undo, redo]);

  const update = (id: string, patch: Partial<Omit<AudioBus, "id">>): void => {
    const newBuses = histBuses.map((b) =>
      b.id === id ? { ...b, ...patch } : b,
    );
    histSet(newBuses);
    const updatedBus = newBuses.find((b) => b.id === id);
    if (updatedBus === undefined) return;
    if (patch.volume !== undefined) {
      audioMixerService.setVolume(id, patch.volume / 100);
    }
    if (patch.muted !== undefined) {
      audioMixerService.setMute(id, patch.muted);
    }
    if (patch.solo !== undefined) {
      audioMixerService.setSolo(id, patch.solo);
    }
    if (patch.volume !== undefined || patch.muted !== undefined) {
      const iframe =
        document.querySelector<HTMLIFrameElement>(
          'iframe[title="Game Preview"]',
        ) ?? document.querySelector<HTMLIFrameElement>("iframe");
      if (
        iframe?.contentWindow !== null &&
        iframe?.contentWindow !== undefined
      ) {
        iframe.contentWindow.postMessage(
          {
            type: "audio-bus",
            busId: updatedBus.id,
            volume: updatedBus.volume,
            mute: updatedBus.muted,
          },
          "*",
        );
      }
    }
  };

  const addBus = (): void => {
    histSet((prev) => [
      ...prev,
      {
        id: `bus-${Date.now()}`,
        label: "Bus",
        volume: 80,
        muted: false,
        solo: false,
        color: "#94a3b8",
      },
    ]);
  };

  const hasSolo = histBuses.some((b) => b.solo);

  const effectiveVolume = (bus: AudioBus): number => {
    if (bus.muted) return 0;
    if (hasSolo && !bus.solo) return 0;
    return bus.volume;
  };

  const iconBtnStyle = (enabled: boolean): React.CSSProperties => ({
    background: "none",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    color: "var(--es-text)",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.35,
    display: "flex",
    alignItems: "center",
    padding: "3px 6px",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        fontSize: 12,
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          fontWeight: 600,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ flex: 1 }}>Audio Mixer</span>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
          style={iconBtnStyle(canUndo)}
        >
          <RotateCcw size={12} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
          style={iconBtnStyle(canRedo)}
        >
          <RotateCw size={12} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "stretch",
          padding: 16,
          gap: 12,
          overflowX: "auto",
        }}
      >
        {histBuses.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "var(--es-text-muted)",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            <div>No buses yet — click + Bus to add one.</div>
          </div>
        )}
        {histBuses.map((bus) => {
          const vol = effectiveVolume(bus);
          const fillPct = vol;
          return (
            <div
              key={bus.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                minWidth: 72,
              }}
            >
              {/* Label */}
              <div style={{ fontWeight: 600, color: bus.color }}>
                {bus.label}
              </div>

              {/* dB label */}
              <div style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
                {vol === 0
                  ? "-∞ dB"
                  : `${(20 * Math.log10(vol / 100)).toFixed(1)} dB`}
              </div>

              {/* Fader track */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                  position: "relative",
                  width: 28,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: "100%",
                    background: "var(--es-surface)",
                    borderRadius: 3,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${fillPct}%`,
                      background:
                        vol > 90
                          ? "var(--es-red)"
                          : vol > 70
                            ? "var(--es-green)"
                            : bus.color,
                      borderRadius: 3,
                      transition: "height 0.1s",
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={bus.volume}
                  onChange={(e) =>
                    update(bus.id, { volume: Number(e.target.value) })
                  }
                  style={
                    {
                      position: "absolute",
                      inset: 0,
                      appearance: "none",
                      WebkitAppearance: "none",
                      writingMode: "vertical-lr",
                      direction: "rtl",
                      width: 32,
                      height: "100%",
                      opacity: 0.01,
                      cursor: "ns-resize",
                    } as React.CSSProperties
                  }
                />
              </div>

              {/* Volume number */}
              <div style={{ fontSize: 11, color: "var(--es-text)" }}>
                {bus.volume}%
              </div>

              {/* Mute */}
              <button
                onClick={() => update(bus.id, { muted: !bus.muted })}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 600,
                  background: bus.muted ? "var(--es-red)" : "var(--es-surface)",
                  color: bus.muted
                    ? "var(--es-text-on-accent)"
                    : "var(--es-text-muted)",
                }}
              >
                M
              </button>

              {/* Solo */}
              <button
                onClick={() => update(bus.id, { solo: !bus.solo })}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 600,
                  background: bus.solo
                    ? "var(--es-yellow)"
                    : "var(--es-surface)",
                  color: bus.solo
                    ? "var(--es-text-on-yellow)"
                    : "var(--es-text-muted)",
                }}
              >
                S
              </button>
            </div>
          );
        })}
        {/* Add bus */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 60,
          }}
        >
          <button
            onClick={addBus}
            style={{
              padding: "6px 10px",
              background: "var(--es-surface)",
              border: "1px dashed var(--es-border)",
              borderRadius: 6,
              color: "var(--es-text-muted)",
              cursor: "pointer",
            }}
          >
            + Bus
          </button>
        </div>
      </div>
    </div>
  );
}

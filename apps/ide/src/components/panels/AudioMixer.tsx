import React from "react";
import { audioMixerService } from "../../services/AudioMixerService";
import { useAudioStore } from "../../store/audioStore";
import type { AudioBus } from "../../store/audioStore";

export function AudioMixer(): React.ReactElement {
  const buses = useAudioStore((s) => s.audioBuses);
  const setAudioBus = useAudioStore((s) => s.setAudioBus);
  const addAudioBus = useAudioStore((s) => s.addAudioBus);

  const update = (id: string, patch: Partial<Omit<AudioBus, "id">>): void => {
    setAudioBus(id, patch);
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
      const updatedBus = useAudioStore
        .getState()
        .audioBuses.find((b) => b.id === id);
      if (updatedBus !== undefined) {
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
    }
  };

  const hasSolo = buses.some((b) => b.solo);

  const effectiveVolume = (bus: AudioBus): number => {
    if (bus.muted) return 0;
    if (hasSolo && !bus.solo) return 0;
    return bus.volume;
  };

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
        }}
      >
        Audio Mixer
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
        {buses.map((bus) => {
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
                        vol > 90 ? "#ef4444" : vol > 70 ? "#4ade80" : bus.color,
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
                  background: bus.muted ? "#ef4444" : "var(--es-surface)",
                  color: bus.muted ? "#fff" : "var(--es-text-muted)",
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
                  background: bus.solo ? "#fbbf24" : "var(--es-surface)",
                  color: bus.solo ? "#000" : "var(--es-text-muted)",
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
            onClick={addAudioBus}
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

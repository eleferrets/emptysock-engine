import React from "react";

interface Bus {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  color: string;
}

const INITIAL_BUSES: Bus[] = [
  {
    id: "master",
    name: "Master",
    volume: 80,
    muted: false,
    solo: false,
    color: "#a78bfa",
  },
  {
    id: "music",
    name: "Music",
    volume: 70,
    muted: false,
    solo: false,
    color: "#60a5fa",
  },
  {
    id: "sfx",
    name: "SFX",
    volume: 90,
    muted: false,
    solo: false,
    color: "#4ade80",
  },
  {
    id: "voice",
    name: "Voice",
    volume: 100,
    muted: false,
    solo: false,
    color: "#fbbf24",
  },
  {
    id: "ambient",
    name: "Ambient",
    volume: 50,
    muted: false,
    solo: false,
    color: "#f87171",
  },
];

export function AudioMixer(): React.ReactElement {
  const [buses, setBuses] = React.useState<Bus[]>(INITIAL_BUSES);

  const update = (id: string, patch: Partial<Bus>): void => {
    setBuses((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    // In a real integration: AudioSystem.setBusVolume(id, volume / 100)
  };

  const hasSolo = buses.some((b) => b.solo);

  const effectiveVolume = (bus: Bus): number => {
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
        background: "var(--bg)",
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
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
                {bus.name}
              </div>

              {/* dB label */}
              <div style={{ color: "var(--text-muted)", fontSize: 10 }}>
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
                    background: "var(--surface)",
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
                      width: "100%",
                      height: "100%",
                      WebkitAppearance: "slider-vertical",
                      opacity: 0.01,
                      cursor: "ns-resize",
                    } as React.CSSProperties
                  }
                />
              </div>

              {/* Volume number */}
              <div style={{ fontSize: 11, color: "var(--text)" }}>
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
                  background: bus.muted ? "#ef4444" : "var(--surface)",
                  color: bus.muted ? "#fff" : "var(--text-muted)",
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
                  background: bus.solo ? "#fbbf24" : "var(--surface)",
                  color: bus.solo ? "#000" : "var(--text-muted)",
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
            onClick={() =>
              setBuses((prev) => [
                ...prev,
                {
                  id: `bus-${Date.now()}`,
                  name: "Bus",
                  volume: 80,
                  muted: false,
                  solo: false,
                  color: "#94a3b8",
                },
              ])
            }
            style={{
              padding: "6px 10px",
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
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

import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AudioBus {
  id: string;
  label: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  color: string;
}

// ── Initial data ─────────────────────────────────────────────────────────────

export const INITIAL_AUDIO_BUSES: AudioBus[] = [
  {
    id: "master",
    label: "Master",
    volume: 80,
    muted: false,
    solo: false,
    color: "#a78bfa",
  },
  {
    id: "music",
    label: "Music",
    volume: 70,
    muted: false,
    solo: false,
    color: "#60a5fa",
  },
  {
    id: "sfx",
    label: "SFX",
    volume: 90,
    muted: false,
    solo: false,
    color: "#4ade80",
  },
  {
    id: "voice",
    label: "Voice",
    volume: 100,
    muted: false,
    solo: false,
    color: "#fbbf24",
  },
  {
    id: "ambient",
    label: "Ambient",
    volume: 50,
    muted: false,
    solo: false,
    color: "#f87171",
  },
];

// ── State / actions ──────────────────────────────────────────────────────────

interface AudioStoreState {
  audioBuses: AudioBus[];
  setAudioBus: (id: string, patch: Partial<Omit<AudioBus, "id">>) => void;
  setAudioBuses: (buses: AudioBus[]) => void;
  addAudioBus: () => void;
  resetAudioStore: () => void;
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  audioBuses: INITIAL_AUDIO_BUSES,

  setAudioBus: (id, patch) =>
    set((s) => ({
      audioBuses: s.audioBuses.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      ),
    })),

  setAudioBuses: (buses) => set({ audioBuses: buses }),

  addAudioBus: () =>
    set((s) => ({
      audioBuses: [
        ...s.audioBuses,
        {
          id: `bus-${Date.now()}`,
          label: "Bus",
          volume: 80,
          muted: false,
          solo: false,
          color: "#94a3b8",
        },
      ],
    })),

  resetAudioStore: () => set({ audioBuses: INITIAL_AUDIO_BUSES }),
}));

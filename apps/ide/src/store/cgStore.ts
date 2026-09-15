import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CGEntry {
  id: string;
  title: string;
  imagePath: string;
}

// ── State / actions ──────────────────────────────────────────────────────────

interface CGStoreState {
  cgGallery: { entries: CGEntry[]; unlocked: Record<string, boolean> };
  setCGGallery: (gallery: {
    entries: CGEntry[];
    unlocked: Record<string, boolean>;
  }) => void;
  resetCGStore: () => void;
}

export const useCGStore = create<CGStoreState>((set) => ({
  cgGallery: { entries: [], unlocked: {} },

  setCGGallery: (gallery) => set({ cgGallery: gallery }),

  resetCGStore: () => set({ cgGallery: { entries: [], unlocked: {} } }),
}));

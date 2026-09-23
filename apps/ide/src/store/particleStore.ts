import { create } from "zustand";
import type { ParticleEmitterOptions } from "@emptysock/engine/ecs";

// ── Initial data ─────────────────────────────────────────────────────────────
// Mirrors the defaults ParticleEmitter itself falls back to (see
// packages/engine/src/systems/ParticleSystem.ts) so a freshly opened panel
// previews the same emitter a developer gets from `new ParticleEmitter({})`.

export const DEFAULT_PARTICLE_OPTIONS: ParticleEmitterOptions = {
  texture: "",
  emissionRate: 20,
  lifetime: { min: 0.5, max: 1.5 },
  velocity: {
    x: { min: -50, max: 50 },
    y: { min: -100, max: -50 },
  },
  acceleration: { x: 0, y: 100 },
  startScale: 1,
  endScale: 0,
  startAlpha: 1,
  endAlpha: 0,
  colorGradient: [0xffffff],
  shape: "point",
  shapeRadius: 0,
  shapeWidth: 0,
  shapeHeight: 0,
  rotationSpeed: 0,
  maxParticles: 500,
};

// ── State / actions ──────────────────────────────────────────────────────────

interface ParticleStoreState {
  /** The real ParticleEmitterOptions shape — no ad hoc translation layer. */
  particleOptions: ParticleEmitterOptions;
  setParticleOptions: (options: ParticleEmitterOptions) => void;
  resetParticleStore: () => void;
}

export const useParticleStore = create<ParticleStoreState>((set) => ({
  particleOptions: DEFAULT_PARTICLE_OPTIONS,

  setParticleOptions: (options) => set({ particleOptions: options }),

  resetParticleStore: () => set({ particleOptions: DEFAULT_PARTICLE_OPTIONS }),
}));

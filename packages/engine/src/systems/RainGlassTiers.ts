// Quality tier table for the windshield rain effect (pure, no pixi).
// GPU/CPU cost figures for these tiers are design estimates, not measurements.
import type { GPUTier } from "../GPUTier.js";

export type RainTierName = "potato" | "low" | "medium" | "high";
export type RainQuality = "auto" | RainTierName;

export interface RainTier {
  name: RainTierName;
  /** Drop-map height in px; width follows the view aspect. */
  mapH: number;
  /** Map width at 16:9 (the default aspect). */
  mapW: number;
  maxDrops: number;
  /** Spawns per second at intensity 1. */
  spawnPerSec: number;
  /** Sliding drops stamp the wet map and shed volume. */
  trails: boolean;
  /** Max simultaneous trail beads (0 = wet map only). */
  beadCap: number;
  /** Sim substeps per second. */
  simHz: number;
  /** Upload the map every N frames. */
  uploadEvery: number;
  /** Fog blur disc taps (0 = tint only). */
  blurTaps: number;
  /** Extra chromatic-split refraction samples. */
  chromatic: boolean;
}

export const RAIN_TIERS: Readonly<Record<RainTierName, RainTier>> = {
  potato: {
    name: "potato",
    mapW: 128,
    mapH: 72,
    maxDrops: 40,
    spawnPerSec: 6,
    trails: false,
    beadCap: 0,
    simHz: 30,
    uploadEvery: 2,
    blurTaps: 0,
    chromatic: false,
  },
  low: {
    name: "low",
    mapW: 160,
    mapH: 90,
    maxDrops: 64,
    spawnPerSec: 12,
    trails: true,
    beadCap: 0,
    simHz: 30,
    uploadEvery: 2,
    blurTaps: 6,
    chromatic: false,
  },
  medium: {
    name: "medium",
    mapW: 256,
    mapH: 144,
    maxDrops: 128,
    spawnPerSec: 24,
    trails: true,
    beadCap: 24,
    simHz: 60,
    uploadEvery: 1,
    blurTaps: 8,
    chromatic: false,
  },
  high: {
    name: "high",
    mapW: 384,
    mapH: 216,
    maxDrops: 256,
    spawnPerSec: 48,
    trails: true,
    beadCap: 64,
    simHz: 60,
    uploadEvery: 1,
    blurTaps: 8,
    chromatic: true,
  },
};

export const RAIN_TIER_ORDER: readonly RainTierName[] = [
  "potato",
  "low",
  "medium",
  "high",
];

/** Maps a host GPU tier to a rain tier; unknown or missing falls back to medium. */
export function resolveRainTier(
  gpuTier?: GPUTier | string | null,
): RainTierName {
  switch (gpuTier) {
    case "potato":
      return "potato";
    case "low":
      return "low";
    case "mid":
      return "medium";
    case "high":
      return "high";
    default:
      return "medium";
  }
}

/** Resolves a `quality` option (with "auto") to a concrete tier. */
export function resolveRainQuality(
  quality: RainQuality | undefined,
  gpuTier?: GPUTier | string | null,
): RainTier {
  if (quality === undefined || quality === "auto") {
    return RAIN_TIERS[resolveRainTier(gpuTier)];
  }
  return RAIN_TIERS[quality] ?? RAIN_TIERS.medium;
}

/** Map size for a tier at a given view aspect (width / height). */
export function rainMapSize(
  tier: RainTier,
  aspect: number,
): { width: number; height: number } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const clamped = Math.min(4, Math.max(0.25, a));
  return {
    width: Math.max(8, Math.round(tier.mapH * clamped)),
    height: tier.mapH,
  };
}

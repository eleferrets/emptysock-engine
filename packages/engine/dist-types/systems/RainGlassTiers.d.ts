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
export declare const RAIN_TIERS: Readonly<Record<RainTierName, RainTier>>;
export declare const RAIN_TIER_ORDER: readonly RainTierName[];
/** Maps a host GPU tier to a rain tier; unknown or missing falls back to medium. */
export declare function resolveRainTier(
  gpuTier?: GPUTier | string | null,
): RainTierName;
/** Resolves a `quality` option (with "auto") to a concrete tier. */
export declare function resolveRainQuality(
  quality: RainQuality | undefined,
  gpuTier?: GPUTier | string | null,
): RainTier;
/** Map size for a tier at a given view aspect (width / height). */
export declare function rainMapSize(
  tier: RainTier,
  aspect: number,
): {
  width: number;
  height: number;
};

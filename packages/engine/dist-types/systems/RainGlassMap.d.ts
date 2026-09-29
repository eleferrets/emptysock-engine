import type { RainGlassSim } from "./RainGlassSim.js";
export type RainMapSource = Pick<
  RainGlassSim,
  "pool" | "wet" | "width" | "height"
>;
/** Writes `sim` into `out` (length width * height * 4). Allocation free. */
export declare function rasterizeRainDropMap(
  sim: RainMapSource,
  out: Uint8Array,
): void;

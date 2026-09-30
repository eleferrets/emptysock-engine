// Rasterises the rain sim into the RGBA8 drop map the filter samples (pure).
//   R,G: surface normal xy, 128 = flat
//   B:   thickness (drop hemisphere height; trail film at low values)
//   A:   wet/covered mask (255 under a drop, ramps with the wet trail)
import type { RainGlassSim } from "./RainGlassSim.js";

export type RainMapSource = Pick<
  RainGlassSim,
  "pool" | "wet" | "width" | "height"
>;

function enc(v: number): number {
  // sign-symmetric rounding so mirrored pixels encode to mirrored bytes
  const q = Math.round(Math.abs(v) * 127);
  return v < 0 ? 128 - q : 128 + q;
}

/** Writes `sim` into `out` (length width * height * 4). Allocation free. */
export function rasterizeRainDropMap(
  sim: RainMapSource,
  out: Uint8Array,
): void {
  const w = sim.width;
  const h = sim.height;
  const wet = sim.wet;
  for (let k = 0, o = 0; k < w * h; k++, o += 4) {
    const v = wet[k] ?? 0;
    out[o] = 128;
    out[o + 1] = 128;
    out[o + 2] = v >> 2; // trail film height, at most 63
    out[o + 3] = v > 127 ? 255 : v * 2;
  }
  const p = sim.pool;
  for (let i = 0; i < p.capacity; i++) {
    if (p.alive[i] === 0) continue;
    const cx = p.x[i] ?? 0;
    const cy = p.y[i] ?? 0;
    const r = p.r[i] ?? 0;
    if (r <= 0) continue;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / r;
        const dy = (y + 0.5 - cy) / r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const height = Math.sqrt(1 - d2);
        const hb = Math.round(height * 255);
        const o = (y * w + x) * 4;
        if (hb >= (out[o + 2] ?? 0)) {
          const f = 1 - height;
          out[o] = enc(dx * f);
          out[o + 1] = enc(dy * f);
          out[o + 2] = hb;
        }
        out[o + 3] = 255;
      }
    }
  }
}

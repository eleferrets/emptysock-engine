import type { GPUTier, HostAdapter } from "@emptysock/types";

export type { GPUTier };

/**
 * The slice of HostAdapter that detectGPUTier actually needs. Narrowed from
 * the full HostAdapter interface (interface segregation) so callers — and
 * test mocks — don't have to supply postMessage/addMessageListener/
 * removeMessageListener/setInterval/clearInterval, none of which GPU
 * detection touches.
 */
export type GPUTierAdapter = Pick<HostAdapter, "detectGPUTier">;

/**
 * Detect GPU tier by delegating to the HostAdapter.
 * The adapter implementation may use document.createElement('canvas') and
 * WebGL debug renderer info — DOM access belongs in the host layer, not here.
 *
 * Pass a NullHostAdapter (or omit the adapter) in Node.js / headless contexts;
 * it returns 'mid' as a safe fallback.
 */
export function detectGPUTier(adapter: GPUTierAdapter): GPUTier {
  return adapter.detectGPUTier();
}

/**
 * Classify a raw WebGL renderer string into a GPUTier. Exported so that
 * HostAdapter implementations can reuse the classification logic.
 */
export function classifyRenderer(renderer: string): GPUTier {
  const r = renderer.toLowerCase();

  // Potato tier
  if (
    r.includes("swiftshader") ||
    r.includes("llvmpipe") ||
    r.includes("softpipe")
  ) {
    return "potato";
  }

  // Low tier — older mobile or integrated
  if (
    r.includes("mali-4") ||
    r.includes("mali-t") ||
    r.includes("adreno 3") ||
    r.includes("powervr sgx")
  ) {
    return "low";
  }

  // Mid tier — modern mobile / older integrated
  if (
    r.includes("mali-g") ||
    r.includes("adreno 5") ||
    r.includes("adreno 6") ||
    r.includes("intel hd") ||
    r.includes("intel(r) hd")
  ) {
    return "mid";
  }

  // High tier — modern discrete / Apple Silicon
  if (
    r.includes("apple m") ||
    r.includes("adreno 7") ||
    r.includes("radeon") ||
    r.includes("gtx") ||
    r.includes("intel iris")
  ) {
    return "high";
  }

  // Ultra — top discrete GPUs
  if (r.includes("rtx") || r.includes("rx 6") || r.includes("rx 7")) {
    return "ultra";
  }

  return "mid";
}

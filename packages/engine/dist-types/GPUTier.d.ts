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
export declare function detectGPUTier(adapter: GPUTierAdapter): GPUTier;
/**
 * Classify a raw WebGL renderer string into a GPUTier. Exported so that
 * HostAdapter implementations can reuse the classification logic.
 */
export declare function classifyRenderer(renderer: string): GPUTier;
//# sourceMappingURL=GPUTier.d.ts.map

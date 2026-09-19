export type GPUTier = "potato" | "low" | "mid" | "high" | "ultra";
/** Detect GPU tier based on available context info */
export declare function detectGPUTier(): Promise<GPUTier>;

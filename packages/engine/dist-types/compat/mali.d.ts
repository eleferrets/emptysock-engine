/** Mali GPU compatibility fixes */
export interface MaliInfo {
  isMali: boolean;
  renderer: string;
  generation: "old" | "mid" | "current" | "unknown";
}
export declare function detectMali(): MaliInfo;
export interface MaliFixes {
  disableInstancedArrays: boolean;
  forcePOTTextures: boolean;
  forceLinearMipmaps: boolean;
  maxTextureSize: number | null;
}
export declare function getMaliFixes(info: MaliInfo): MaliFixes;
/** Apply Mali compatibility fixes to a canvas context */
export declare function applyMaliFixes(fixes: MaliFixes): void;

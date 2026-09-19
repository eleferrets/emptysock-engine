import { Filter, type Container } from "pixi.js";
export type LightType = "point" | "directional" | "spot" | "ambient";
export interface Light {
  readonly id: string;
  readonly type: LightType;
  colour: number;
  intensity: number;
  radius?: number;
  angle?: number;
  direction?: {
    x: number;
    y: number;
  };
  castShadows: boolean;
  /** World-space position for point/spot lights (updated each frame) */
  x?: number;
  y?: number;
}
export declare class LightingFilter extends Filter {
  constructor();
}
export declare class LightingSystem {
  private readonly _lights;
  private _ambientColour;
  private _ambientIntensity;
  private _filter;
  private _stage;
  private _useNormalMap;
  private _canvasWidth;
  private _canvasHeight;
  private readonly _pColour;
  private readonly _pIntensity;
  private readonly _pPos;
  private readonly _pRadius;
  private readonly _dColour;
  private readonly _dIntensity;
  private readonly _dDir;
  private readonly _texSize;
  get lights(): ReadonlyMap<string, Light>;
  addLight(config: Light): void;
  removeLight(id: string): boolean;
  setAmbient(colour: number, intensity: number): void;
  get ambientColour(): number;
  get ambientIntensity(): number;
  /**
   * Attach the GPU lighting filter to a PixiJS container (typically the scene stage).
   * This replaces the previous registry-only placeholder with real GPU rendering.
   */
  attachFilter(
    stage: Container,
    useNormalMap?: boolean,
    canvasWidth?: number,
    canvasHeight?: number,
  ): void;
  setResolution(width: number, height: number): void;
  detachFilter(): void;
  update(_dt: number): void;
}

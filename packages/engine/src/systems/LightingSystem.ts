export type LightType = 'point' | 'directional' | 'spot' | 'ambient';

export interface Light {
  readonly id: string;
  readonly type: LightType;
  colour: number;
  intensity: number;
  radius?: number;
  castShadows: boolean;
}

export class LightingSystem {
  public readonly lights: Map<string, Light> = new Map();
  private _ambientColour: number = 0xffffff;
  private _ambientIntensity: number = 0.2;

  addLight(config: Light): void {
    this.lights.set(config.id, { ...config });
  }

  removeLight(id: string): boolean {
    return this.lights.delete(id);
  }

  setAmbient(colour: number, intensity: number): void {
    this._ambientColour = colour;
    this._ambientIntensity = intensity;
  }

  get ambientColour(): number {
    return this._ambientColour;
  }

  get ambientIntensity(): number {
    return this._ambientIntensity;
  }

  update(_dt: number): void {
    // Placeholder for future GPU-driven light pass
  }
}

import type { Container } from 'pixi.js';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export class CameraSystem {
  private _x: number = 0;
  private _y: number = 0;
  private _targetX: number = 0;
  private _targetY: number = 0;
  private _zoom: number = 1;
  private _targetZoom: number = 1;
  private _rotation: number = 0;
  private _lerpFactor: number = 0.1;
  private _shakeIntensity: number = 0;
  private _shakeDuration: number = 0;
  private _shakeElapsed: number = 0;
  private _stage: Container | null = null;

  attach(stage: Container): void {
    this._stage = stage;
  }

  get state(): CameraState {
    return {
      x: this._x,
      y: this._y,
      zoom: this._zoom,
      rotation: this._rotation,
    };
  }

  moveTo(x: number, y: number): void {
    this._targetX = x;
    this._targetY = y;
  }

  zoomTo(zoom: number): void {
    this._targetZoom = Math.max(0.1, zoom);
  }

  shake(intensity: number, duration: number): void {
    this._shakeIntensity = intensity;
    this._shakeDuration = duration;
    this._shakeElapsed = 0;
  }

  setLerpFactor(factor: number): void {
    this._lerpFactor = Math.max(0, Math.min(1, factor));
  }

  update(deltaTime: number): void {
    // Smooth follow
    this._x += (this._targetX - this._x) * this._lerpFactor;
    this._y += (this._targetY - this._y) * this._lerpFactor;
    this._zoom += (this._targetZoom - this._zoom) * this._lerpFactor;

    // Screen shake
    let shakeX = 0;
    let shakeY = 0;
    if (this._shakeElapsed < this._shakeDuration) {
      this._shakeElapsed += deltaTime;
      const progress = 1 - this._shakeElapsed / this._shakeDuration;
      shakeX = (Math.random() * 2 - 1) * this._shakeIntensity * progress;
      shakeY = (Math.random() * 2 - 1) * this._shakeIntensity * progress;
    }

    if (this._stage !== null) {
      this._stage.x = -this._x + shakeX;
      this._stage.y = -this._y + shakeY;
      this._stage.scale.set(this._zoom);
      this._stage.rotation = this._rotation;
    }
  }
}

import type { Container } from "pixi.js";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  viewWidth: number;
  viewHeight: number;
}

export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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
  private _viewWidth: number = 1280;
  private _viewHeight: number = 720;
  private _followFn: (() => { x: number; y: number }) | null = null;
  private _bounds: CameraBounds | null = null;

  /** Attach the PixiJS stage container that the camera will transform. */
  attach(stage: Container): void {
    this._stage = stage;
  }

  /** Set the logical viewport size (used by worldToScreen / screenToWorld). */
  setViewSize(width: number, height: number): void {
    this._viewWidth = width;
    this._viewHeight = height;
  }

  get state(): CameraState {
    return {
      x: this._x,
      y: this._y,
      zoom: this._zoom,
      rotation: this._rotation,
      viewWidth: this._viewWidth,
      viewHeight: this._viewHeight,
    };
  }

  // View accessors
  get viewX(): number {
    return this._x;
  }
  get viewY(): number {
    return this._y;
  }
  get viewWidth(): number {
    return this._viewWidth;
  }
  get viewHeight(): number {
    return this._viewHeight;
  }

  /** Pan immediately to world position (x, y). Clears any active follow target. */
  snapTo(x: number, y: number): void {
    this._followFn = null;
    this._x = x;
    this._y = y;
    this._targetX = x;
    this._targetY = y;
  }

  /** Smoothly move toward world position (x, y). Clears any active follow target. */
  moveTo(x: number, y: number): void {
    this._followFn = null;
    this._targetX = x;
    this._targetY = y;
  }

  /**
   * Follow a moving target each frame.
   * Provide a function that returns the current world {x, y} of the target.
   * The camera will smoothly track it using the current lerpFactor.
   *
   *   camera.setFollow(() => player.transform.position);
   *   camera.setFollow(null); // stop following
   */
  setFollow(fn: (() => { x: number; y: number }) | null): void {
    this._followFn = fn;
  }

  zoomTo(zoom: number): void {
    this._targetZoom = Math.max(0.1, zoom);
  }

  snapZoom(zoom: number): void {
    this._zoom = Math.max(0.1, zoom);
    this._targetZoom = this._zoom;
  }

  setRotation(radians: number): void {
    this._rotation = radians;
  }

  shake(intensity: number, duration: number): void {
    this._shakeIntensity = intensity;
    this._shakeDuration = duration;
    this._shakeElapsed = 0;
  }

  /**
   * Set the lerp factor used for smooth follow / moveTo.
   * This is expressed as a per-second fraction — the camera closes
   * `factor * 100 %` of the remaining distance every second.
   * Use 1.0 for instant tracking, 0.05 for very slow drift.
   */
  setLerpFactor(factor: number): void {
    this._lerpFactor = Math.max(0, Math.min(1, factor));
  }

  /**
   * Clamp the camera position to a world-space rectangle.
   * Pass `null` to remove clamping.
   * The camera's visible half-size is taken into account so the view never
   * shows outside the bounds when zoom is 1.
   */
  setBounds(bounds: CameraBounds | null): void {
    this._bounds = bounds;
  }

  /**
   * Convert a world-space position to screen-space pixel coordinates.
   * Useful for UI elements that must track world objects.
   */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cx = this._viewWidth / 2;
    const cy = this._viewHeight / 2;
    const cos = Math.cos(-this._rotation);
    const sin = Math.sin(-this._rotation);
    const rx = wx - this._x;
    const ry = wy - this._y;
    return {
      x: (rx * cos - ry * sin) * this._zoom + cx,
      y: (rx * sin + ry * cos) * this._zoom + cy,
    };
  }

  /**
   * Convert a screen-space pixel position to world-space coordinates.
   * Useful for click / touch hit detection against world objects.
   */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const cx = this._viewWidth / 2;
    const cy = this._viewHeight / 2;
    const cos = Math.cos(this._rotation);
    const sin = Math.sin(this._rotation);
    const rx = (sx - cx) / this._zoom;
    const ry = (sy - cy) / this._zoom;
    return {
      x: rx * cos - ry * sin + this._x,
      y: rx * sin + ry * cos + this._y,
    };
  }

  update(deltaTime: number): void {
    // If following a target, update the goal position first
    if (this._followFn !== null) {
      const pos = this._followFn();
      this._targetX = pos.x;
      this._targetY = pos.y;
    }

    // Frame-rate-independent exponential lerp.
    const alpha = 1 - Math.pow(1 - this._lerpFactor, deltaTime * 60);
    this._x += (this._targetX - this._x) * alpha;
    this._y += (this._targetY - this._y) * alpha;

    // Clamp to bounds, accounting for the visible half-size at zoom=1
    if (this._bounds !== null) {
      const hw = this._viewWidth / 2 / this._zoom;
      const hh = this._viewHeight / 2 / this._zoom;
      this._x = Math.max(
        this._bounds.minX + hw,
        Math.min(this._bounds.maxX - hw, this._x),
      );
      this._y = Math.max(
        this._bounds.minY + hh,
        Math.min(this._bounds.maxY - hh, this._y),
      );
      this._targetX = this._x;
      this._targetY = this._y;
    }
    this._zoom += (this._targetZoom - this._zoom) * alpha;

    // Screen shake — decreasing envelope over duration
    let shakeX = 0;
    let shakeY = 0;
    if (this._shakeElapsed < this._shakeDuration) {
      this._shakeElapsed += deltaTime;
      const progress = 1 - this._shakeElapsed / this._shakeDuration;
      shakeX = (Math.random() * 2 - 1) * this._shakeIntensity * progress;
      shakeY = (Math.random() * 2 - 1) * this._shakeIntensity * progress;
    }

    if (this._stage !== null) {
      // (x, y) is the world point at the view's top-left; the stage is
      // scaled by `zoom`, so its offset is in scaled units.
      this._stage.x = -this._x * this._zoom + shakeX;
      this._stage.y = -this._y * this._zoom + shakeY;
      this._stage.scale.set(this._zoom);
      this._stage.rotation = this._rotation;
    }
  }

  destroy(): void {
    this._stage = null;
    this._followFn = null;
    this._bounds = null;
  }
}

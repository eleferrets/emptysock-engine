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
export declare class CameraSystem {
  private _x;
  private _y;
  private _targetX;
  private _targetY;
  private _zoom;
  private _targetZoom;
  private _rotation;
  private _lerpFactor;
  private _shakeIntensity;
  private _shakeDuration;
  private _shakeElapsed;
  private _stage;
  private _viewWidth;
  private _viewHeight;
  private _followFn;
  private _bounds;
  /** Attach the PixiJS stage container that the camera will transform. */
  attach(stage: Container): void;
  /** Set the logical viewport size (used by worldToScreen / screenToWorld). */
  setViewSize(width: number, height: number): void;
  get state(): CameraState;
  get viewX(): number;
  get viewY(): number;
  get viewWidth(): number;
  get viewHeight(): number;
  /** Pan immediately to world position (x, y). Clears any active follow target. */
  snapTo(x: number, y: number): void;
  /** Smoothly move toward world position (x, y). Clears any active follow target. */
  moveTo(x: number, y: number): void;
  /**
   * Follow a moving target each frame.
   * Provide a function that returns the current world {x, y} of the target.
   * The camera will smoothly track it using the current lerpFactor.
   *
   *   camera.setFollow(() => player.transform.position);
   *   camera.setFollow(null); // stop following
   */
  setFollow(
    fn:
      | (() => {
          x: number;
          y: number;
        })
      | null,
  ): void;
  zoomTo(zoom: number): void;
  snapZoom(zoom: number): void;
  setRotation(radians: number): void;
  shake(intensity: number, duration: number): void;
  /**
   * Set the lerp factor used for smooth follow / moveTo.
   * This is expressed as a per-second fraction — the camera closes
   * `factor * 100 %` of the remaining distance every second.
   * Use 1.0 for instant tracking, 0.05 for very slow drift.
   */
  setLerpFactor(factor: number): void;
  /**
   * Clamp the camera position to a world-space rectangle.
   * Pass `null` to remove clamping.
   * The camera's visible half-size is taken into account so the view never
   * shows outside the bounds when zoom is 1.
   */
  setBounds(bounds: CameraBounds | null): void;
  /**
   * Convert a world-space position to screen-space pixel coordinates.
   * Useful for UI elements that must track world objects.
   */
  worldToScreen(
    wx: number,
    wy: number,
  ): {
    x: number;
    y: number;
  };
  /**
   * Convert a screen-space pixel position to world-space coordinates.
   * Useful for click / touch hit detection against world objects.
   */
  screenToWorld(
    sx: number,
    sy: number,
  ): {
    x: number;
    y: number;
  };
  update(deltaTime: number): void;
  destroy(): void;
}

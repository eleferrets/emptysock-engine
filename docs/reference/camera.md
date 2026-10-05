# CameraSystem

`CameraSystem` controls the viewport — position, zoom, rotation, follow behaviour, and screen shake. It is an **instanced** class: create one per scene, wire it to the PixiJS stage container, call `update(dt)` every frame, and `destroy()` in `onDestroy`.

Import: `import { CameraSystem, type CameraBounds, type CameraState } from '@emptysock/engine'`

---

## Quickstart

```typescript
import { CameraSystem } from "@emptysock/engine";

export class GameScene extends Scene {
  private _camera = new CameraSystem();

  override onLoad(): void {
    this._camera.attach(this.stage); // wire to PixiJS container — required
    this._camera.setFollow(() => player.position);
    this._camera.setLerpFactor(0.08);
    this._camera.setBounds({ minX: 0, minY: 0, maxX: 3200, maxY: 900 });
  }

  override onUpdate(dt: number): void {
    this._camera.update(dt); // must be called every frame
  }

  override onDestroy(): void {
    this._camera.destroy();
  }
}
```

---

## Methods

### `attach(stage: Container): void`

Wire the camera to a PixiJS `Container` (typically `this.stage`). The camera applies position, zoom, and rotation transforms to this container every `update()` call. Must be called before any other camera method has effect.

---

### `setFollow(fn: (() => { x: number; y: number }) | null): void`

Track a moving target each frame. Supply a function that returns the current world `{x, y}` of the target. Pass `null` to stop following.

```typescript
this._camera.setFollow(() => player.position);
this._camera.setFollow(null); // stop following
```

---

### `setLerpFactor(factor: number): void`

Smoothing for follow and `moveTo`. The camera closes `factor × 100%` of the remaining distance per second. `0.05` = very slow drift; `1.0` = instant tracking.

```typescript
this._camera.setLerpFactor(0.08); // natural feel for most platformers
```

---

### `snapTo(x: number, y: number): void`

Immediately jump to a world position. Clears any active follow target.

---

### `moveTo(x: number, y: number): void`

Smoothly move toward a world position (using `lerpFactor`). Clears any active follow target.

---

### `zoomTo(zoom: number): void`

Smoothly zoom toward a scale factor. `1.0` = no zoom, `2.0` = 2× magnification.

```typescript
this._camera.zoomTo(1.5); // zoom in over time (uses lerpFactor)
```

### `snapZoom(zoom: number): void`

Immediately set zoom, no animation.

---

### `shake(intensity: number, duration: number): void`

Apply a screen shake. The intensity decreases linearly to zero over the duration.

```typescript
this._camera.shake(8, 0.4); // 8 px intensity, 0.4 s duration
```

---

### `setBounds(bounds: CameraBounds | null): void`

Clamp camera position to a world-space rectangle. The visible half-size is subtracted so the view never shows outside the bounds at `zoom = 1`. Pass `null` to remove clamping.

```typescript
this._camera.setBounds({ minX: 0, minY: 0, maxX: 3200, maxY: 900 });
this._camera.setBounds(null); // remove bounds
```

`CameraBounds`: `{ minX: number; minY: number; maxX: number; maxY: number }`

---

### `setViewSize(width: number, height: number): void`

Set the logical viewport size used by `worldToScreen` and `screenToWorld`. Defaults to `1280 × 720`. Call this when your canvas dimensions change.

---

### `setRotation(radians: number): void`

Rotate the entire view. `0` is upright.

---

### `worldToScreen(wx: number, wy: number): { x: number; y: number }`

Convert a world-space position to screen-space pixel coordinates. Useful for UI elements that must overlay world objects.

```typescript
const screen = this._camera.worldToScreen(enemy.position.x, enemy.position.y);
// draw health bar at screen.x, screen.y
```

### `screenToWorld(sx: number, sy: number): { x: number; y: number }`

Convert a screen-space pixel position to world-space coordinates. Useful for click / touch hit detection.

```typescript
const world = this._camera.screenToWorld(pointerX, pointerY);
```

---

### `update(dt: number): void`

Advance camera state and apply transforms to the attached stage. **Must be called every frame from `onUpdate`.**

---

### `destroy(): void`

Releases references to the stage and follow function. Call in `onDestroy`.

---

## State

### `camera.state: CameraState`

Read-only snapshot: `{ x, y, zoom, rotation, viewWidth, viewHeight }`.

### `camera.viewX / viewY / viewWidth / viewHeight: number`

Individual view accessors.

---

## Tips

- Create one `CameraSystem` per scene. Do not share a camera instance across scenes.
- For boss fights: call `setFollow(null)` and animate manually with `moveTo` or `zoomTo`.
- `shake` stacks with the current camera position — it is cosmetic displacement only and does not affect follow behaviour.
- `setBounds` accounts for zoom at `zoom = 1`. At other zoom levels the visible area changes but bounds are still enforced in world space.

# Camera

`Camera` controls what is visible in the game view. It is a static utility — no instantiation required.

Import: `import { Camera } from '@emptysock/engine';`

---

## Follow

### `Camera.follow(entity, options?): void`

Make the camera smoothly track an entity.

| Option     | Type                       | Default          | Description                                                                           |
| ---------- | -------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| `lerp`     | `number`                   | `0.1`            | Smoothing factor (0 = instant, 1 = no movement). `0.08` feels natural for most games. |
| `deadzone` | `{ x: number; y: number }` | `{ x: 0, y: 0 }` | Inner box in which the target can move without the camera following                   |

```typescript
Camera.follow(player, { lerp: 0.08, deadzone: { x: 60, y: 30 } });
```

### `Camera.stopFollowing(): void`

Stop tracking the entity. The camera stays at its current position.

---

## Shake

### `Camera.shake(options): void`

Apply a screen shake effect. The camera returns to its resting position automatically.

| Option      | Type     | Description                    |
| ----------- | -------- | ------------------------------ |
| `intensity` | `number` | Maximum displacement in pixels |
| `duration`  | `number` | Duration in seconds            |

```typescript
Camera.shake({ intensity: 8, duration: 0.4 });
```

---

## Zoom

### `Camera.zoom(factor, options?): void`

Zoom the viewport. `1.0` is no zoom, `2.0` is 2× magnification.

| Option     | Type         | Description                               |
| ---------- | ------------ | ----------------------------------------- |
| `duration` | `number`     | Duration of the zoom animation in seconds |
| `ease`     | `EasingName` | Easing function for the animation         |

```typescript
Camera.zoom(2.0, { duration: 0.5, ease: "sineOut" });
Camera.zoom(1.0, { duration: 0.3 }); // zoom back out
```

---

## Fade

### `Camera.fade(options): void`

Fade the screen to or from a color.

| Option     | Type                 | Description                         |
| ---------- | -------------------- | ----------------------------------- |
| `to`       | `number` (hex color) | Fade from current to this color     |
| `from`     | `number` (hex color) | Fade from this color to transparent |
| `duration` | `number`             | Duration in seconds                 |

```typescript
// Fade to black (before a scene transition):
Camera.fade({ to: 0x000000, duration: 0.6 });

// Fade in from black (after a scene transition):
Camera.fade({ from: 0x000000, duration: 0.6 });
```

---

## Position

### `Camera.position: { x: number; y: number }`

Read or set the camera's current position directly.

```typescript
Camera.position = { x: 0, y: 0 }; // reset to origin
const pos = Camera.position;
```

---

## Tips

- Call `Camera.follow` once in `onLoad`, not every frame — it sets up an internal tracking state that persists.
- For boss fights: call `Camera.stopFollowing()` and animate the camera manually with `Camera.position` or `Camera.zoom`.
- For cutscenes: use `Camera.fade` at transitions and `Camera.zoom` for cinematic emphasis.

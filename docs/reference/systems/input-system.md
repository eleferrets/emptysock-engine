# InputSystem

`InputSystem` handles keyboard, mouse, and touch input. Create one instance per scene, attach it to the canvas, and call `flush()` at the start of every frame.

For a usage-oriented introduction, see the [Input and Gamepad guide](../../guides/input-and-gamepad.md).

Import: `import { InputSystem } from '@emptysock/engine';`

---

## Setup

```typescript
const input = new InputSystem();
input.attach(canvasElement); // registers event listeners on the element
```

Call `input.flush()` at the top of every `onUpdate` before reading any state.

---

## Keyboard

### `input.isKeyDown(code: string): boolean`

Returns `true` while the key is held.

### `input.isKeyPressed(code: string): boolean`

Returns `true` only on the first frame the key goes down.

### `input.isKeyReleased(code: string): boolean`

Returns `true` only on the first frame the key goes up.

Key codes use `KeyboardEvent.code` values: `'ArrowLeft'`, `'ArrowRight'`, `'ArrowUp'`, `'ArrowDown'`, `'Space'`, `'Enter'`, `'Escape'`, `'KeyW'`, `'KeyA'`, `'KeyS'`, `'KeyD'`, etc.

```typescript
input.flush();

if (input.isKeyDown("ArrowRight")) player.x += speed * dt;
if (input.isKeyPressed("Space")) player.jump();
if (input.isKeyReleased("Escape")) pauseMenu.open();
```

---

## Axes

### `input.axis(name: string): number`

Returns a value from -1 to 1. Built-in axis names:

| Axis name      | Keyboard keys                               | Gamepad      |
| -------------- | ------------------------------------------- | ------------ |
| `'Horizontal'` | `ArrowLeft` / `ArrowRight`, `KeyA` / `KeyD` | Left stick X |
| `'Vertical'`   | `ArrowUp` / `ArrowDown`, `KeyW` / `KeyS`    | Left stick Y |

```typescript
const h = input.axis("Horizontal");
const v = input.axis("Vertical");
player.x += h * speed * dt;
player.y += v * speed * dt;
```

---

## Pointer (mouse)

### `input.pointer.position: { x: number; y: number }`

Current pointer position in canvas pixels.

### `input.pointer.delta: { x: number; y: number }`

Pointer movement since last frame.

### `input.pointer.isDown(button: number): boolean`

Whether a mouse button is held. `0` = left, `1` = middle, `2` = right.

### `input.pointer.isPressed(button: number): boolean`

Whether a mouse button was just pressed this frame.

### `input.pointer.isReleased(button: number): boolean`

Whether a mouse button was just released this frame.

---

## Touch

### `input.touchCount: number`

Number of active touch points.

### `input.primaryTouch: TouchPoint | undefined`

The first active touch, or `undefined` if no touch is active.

### `input.touches: readonly TouchPoint[]`

All active touch points.

### `input.isTouchStarted(id?: number): boolean`

Whether any new touch started this frame. Pass a touch ID to check a specific touch.

### `input.isTouchEnded(id?: number): boolean`

Whether a touch was lifted this frame.

### TouchPoint

| Field | Type     | Description               |
| ----- | -------- | ------------------------- |
| `id`  | `number` | Browser touch identifier  |
| `x`   | `number` | Current canvas X position |
| `y`   | `number` | Current canvas Y position |
| `dx`  | `number` | X delta since last frame  |
| `dy`  | `number` | Y delta since last frame  |

All touch listeners are registered as `{ passive: true }`. Never call `e.preventDefault()` on events you did not add.

---

## `input.flush(): void`

Advances input state: promotes `isPressed` / `isReleased` deltas, snapshots pointer position deltas. **Must be called at the start of every `onUpdate`** before reading any state.

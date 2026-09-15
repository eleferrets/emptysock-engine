# Input and Gamepad

EmptySock provides two systems for reading player input: `InputSystem` (keyboard, mouse, touch) and `GamepadSystem` (gamepads and rumble). In most games you use both together.

For the complete API, see [InputSystem reference](../reference/systems/input-system.md).

---

## InputSystem

`InputSystem` handles keyboard, mouse, and touch input. Create one instance in `onLoad`, attach it to the canvas element, and call `flush()` at the start of every frame before reading any state.

```typescript
import { InputSystem } from "@emptysock/engine";

export class GameScene extends Scene {
  private _input!: InputSystem;

  override async onLoad(): Promise<void> {
    this._input = new InputSystem();
    this._input.attach(canvasElement);
  }

  override onUpdate(dt: number): void {
    // Call flush() first, every frame:
    this._input.flush();

    // Then read state:
    if (this._input.isKeyDown("ArrowRight")) {
      player.x += speed * dt;
    }
  }
}
```

### Keyboard state

```typescript
// Key held down this frame:
input.isKeyDown("Space");

// Key pressed this frame (fires once on keydown):
input.isKeyPressed("ArrowRight");

// Key released this frame (fires once on keyup):
input.isKeyReleased("Escape");
```

Key names use the `KeyboardEvent.code` string — e.g. `'ArrowLeft'`, `'KeyW'`, `'Space'`, `'Enter'`.

### Axes

`input.axis()` returns a value from -1 to 1 that works with both keyboard and gamepad:

```typescript
const h = input.axis("Horizontal"); // -1 (left) to 1 (right)
const v = input.axis("Vertical"); // -1 (up) to 1 (down)

player.x += h * speed * dt;
player.y += v * speed * dt;
```

> Use `Input.axis` instead of checking individual arrow keys — axis works with both keyboard and gamepad automatically.

### Mouse / pointer

```typescript
// Current position in canvas space:
const pos = input.pointer.position; // { x, y }

// Movement since last frame:
const delta = input.pointer.delta;

// Button state (0 = left, 1 = middle, 2 = right):
if (input.pointer.isDown(0)) {
  /* left button held */
}
if (input.pointer.isPressed(2)) {
  /* right button just clicked */
}
```

---

## Touch input

After calling `input.flush()` each frame, touch state is available:

```typescript
const count = input.touchCount;
const primary = input.primaryTouch; // TouchPoint | undefined

if (primary) {
  // primary.x, primary.y  — current canvas position
  // primary.dx, primary.dy — delta since last frame
  // primary.id            — browser touch identifier
}

for (const touch of input.touches) {
  drawTouchIndicator(touch.x, touch.y);
}

if (input.isTouchStarted()) {
  // any new touch this frame
}
if (input.isTouchStarted(id)) {
  // specific touch started
}
if (input.isTouchEnded(id)) {
  // specific touch lifted
}
```

All listeners are registered as `{ passive: true }`. Never call `e.preventDefault()` on events you did not add.

---

## GamepadSystem

`GamepadSystem` provides snapshot-based polling for connected gamepads. For keyboard and mouse input, use `InputSystem` — `GamepadSystem` handles gamepad-specific axis and button queries.

```typescript
import { GamepadSystem, type GamepadState } from "@emptysock/engine";

export class GameScene extends Scene {
  private _pads!: GamepadSystem;

  override async onLoad(): Promise<void> {
    this._pads = new GamepadSystem();
  }

  override onUpdate(dt: number): void {
    // Must call update() before reading state:
    this._pads.update();

    const state: GamepadState | null = this._pads.getState(0);
    if (state !== null && state.connected) {
      const jump = state.buttons[0] ?? false; // A / Cross
      const attack = state.buttons[2] ?? false; // X / Square
      const lx = state.axes[0] ?? 0; // left stick X
      const ly = state.axes[1] ?? 0; // left stick Y
    }
  }
}
```

`pads.update()` calls `navigator.getGamepads()` — this is a snapshot, not event-driven. Always call it at the top of `onUpdate` before reading pad state.

### Rumble

```typescript
// Equal-motor rumble for 200 ms at 50%:
pads.rumble(0, 0.5, 200);

// Dual-motor (where browser supports it):
pads.rumbleDual(0, { weakMagnitude: 0.3, strongMagnitude: 0.8, duration: 300 });
```

Rumble support varies by browser and gamepad. It is a best-effort call with no error thrown when unsupported.

---

## Tips

- Put all input reads **after** `input.flush()` in `onUpdate`. Reading state before `flush()` gives you last frame's values.
- For on-screen virtual buttons (mobile), implement them as UI widgets that set boolean flags your game logic reads — do not reach into `InputSystem` from touch event handlers.
- `GamepadSystem` gamepad index 0 is the first connected gamepad. Indices are browser-assigned and may skip numbers if gamepads are disconnected and reconnected.

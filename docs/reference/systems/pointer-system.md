# PointerSystem

`PointerSystem` unifies mouse, touch, and pen input into a single pointer stream using native Pointer Events, and layers a small gesture recognizer (tap, long-press, swipe, pinch) on top of it. It also classifies wheel events as trackpad or mouse-wheel scrolling.

Import: `import { PointerSystem } from '@emptysock/engine';`

---

## Setup

```typescript
const pointers = new PointerSystem();
pointers.attach(canvasElement); // no-op outside a browser-like environment
```

Call `pointers.update()` once per frame — this is what polls for `longpress` gestures on pointers held still past the threshold. `destroy()` (an alias for `detach()`) removes listeners on scene teardown.

---

## Pointer stream

### `pointers.pointers: readonly PointerState[]`

All currently active pointers, keyed internally by `pointerId` — supports multi-touch.

### `pointers.getPointer(id: number): PointerState | undefined`

### `pointers.primaryPointer: PointerState | undefined`

The first pointer to go down (mouse, or the first touch).

### `PointerState`

| Field              | Type                                       | Description                           |
| ------------------ | ------------------------------------------ | ------------------------------------- |
| `id`               | `number`                                   | Pointer id (multi-touch key)          |
| `x`, `y`           | `number`                                   | Current position                      |
| `dx`, `dy`         | `number`                                   | Delta since last move                 |
| `startX`, `startY` | `number`                                   | Position at pointerdown               |
| `startTime`        | `number`                                   | Timestamp at pointerdown              |
| `pointerType`      | `'mouse' \| 'touch' \| 'pen' \| 'unknown'` | Device type                           |
| `isPrimary`        | `boolean`                                  | True for the first pointer down       |
| `buttons`          | `number`                                   | Mouse button bitmask (touch/pen: `1`) |

### Subscriptions

`onPointerDown`, `onPointerMove`, `onPointerUp`, `onGesture`, `onWheel` each take a handler and return an unsubscribe function.

---

## Gestures

Delivered via `onGesture`:

- **tap** — pointer down and up within 300ms, moving less than 10px.
- **longpress** — pointer held for 500ms with movement under 10px (fires from `update()`, not a tap on release).
- **swipe** — pointer released with velocity ≥ 0.3px/ms and distance ≥ 30px; carries a `direction` (`'up' | 'down' | 'left' | 'right'`).
- **pinch** — fires while exactly two pointers are active and one moves; carries `scale` (current distance / start distance) and `deltaScale`.

```typescript
pointers.onGesture((g) => {
  if (g.type === "tap") button.triggerClick();
  if (g.type === "swipe" && g.direction === "left") menu.next();
  if (g.type === "pinch") camera.zoom *= 1 + g.deltaScale;
});
```

---

## Wheel / trackpad discrimination

### `pointers.onWheel(handler: (w: WheelEventInfo) => void): () => void`

`WheelEventInfo.source` is `'trackpad'` or `'mouse-wheel'`, classified heuristically from `deltaMode` and delta magnitude. `isPinchZoom` is `true` when the browser reports a synthesized `ctrlKey` pinch-to-zoom gesture from a trackpad.

```typescript
pointers.onWheel((w) => {
  if (w.isPinchZoom) camera.zoom *= 1 - w.deltaY * 0.01;
  else if (w.source === "trackpad") camera.pan(w.deltaX, w.deltaY);
  else camera.zoom *= w.deltaY > 0 ? 0.9 : 1.1;
});
```

---

## Minimum touch target

### `MIN_TOUCH_TARGET_SIZE: number`

`44` — the recommended minimum interactive-widget dimension in pixels, per the iOS Human Interface Guidelines. `UISystem` uses the equivalent `MIN_INTERACTIVE_SIZE` constant internally to warn when a button-like widget is configured smaller.

---

## Relationship to UISystem

`UISystem.dispatchPointerDown` / `dispatchPointerDrag` / `dispatchPointerUp` give widget hit-testing real press/drag/release semantics; feed them from a `PointerSystem`'s `onPointerDown` / `onPointerMove` / `onPointerUp` handlers. `UISystem.setScale()` accepts the canvas-to-design-resolution ratio (e.g. from a viewport/resize system) and applies it to widget positioning and hit-testing.

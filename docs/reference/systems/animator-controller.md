# AnimatorController

A code-first animation state machine: named states (each wrapping an `AnimationClip`), named transitions gated by conditions over a small parameter bag (floats, bools, triggers), and optional linear cross-fade blending between the outgoing and incoming clip when a transition fires.

`AnimatorController` is a separate component from `Animator`. `Animator` stays a minimal, unmodified single-clip player for anyone who doesn't need states; `AnimatorController` owns the added complexity of a transition graph and blend timing.

Import: `import { AnimatorController } from '@emptysock/engine';`

---

## States

### `addState(name: string, clip: AnimationClip): void`

Registers a named state backed by an `AnimationClip` (the same interface `Animator` uses — `name`, `frameStart`, `frameEnd`, `frameRate`, `loop`).

### `play(name: string): void`

Jumps straight into a state with no transition or blend. Use this once, on setup, to pick the initial state.

### `currentState: string | null`

The name of the state currently playing (the outgoing state during a blend).

### `isBlending: boolean`

True while a cross-fade transition is in progress.

---

## Parameters

### `setFloat(name: string, value: number): void`

### `setBool(name: string, value: boolean): void`

### `setTrigger(name: string): void`

Arms a trigger. It is consumed automatically the first time a transition condition observes it via `ctx.isTriggered(name)` — after evaluation each `update()`, all triggers reset. Call `setTrigger()` again to re-arm.

### `resetTrigger(name: string): void`

Clears a trigger without waiting for it to be consumed.

### `getParam(name: string): number | boolean | undefined`

---

## Transitions

### `addTransition(from: string, options: AnimTransitionOptions): void`

| Field       | Type                                      | Description                                                            |
| ----------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `to`        | `string`                                  | Target state name.                                                     |
| `condition` | `(ctx: AnimTransitionContext) => boolean` | Evaluated every `update()`; the transition fires when it returns true. |
| `duration`  | `number` (optional, default `0`)          | Cross-fade duration in seconds. `0` is an instant cut.                 |

`from` may be a specific state name, or `'*'` to match a transition from any current state (useful for interrupts like an attack that can fire from idle, walk, or run).

Transitions are evaluated in registration order; the first whose condition returns true wins. New transitions are not evaluated while a blend is already in progress — it must resolve first.

`AnimTransitionContext` passed to `condition`:

```typescript
interface AnimTransitionContext {
  getParam(name: string): number | boolean | undefined;
  isTriggered(name: string): boolean;
}
```

---

## Reading the current pose

### `getActiveClips(): ActiveClipFrame[]`

Returns what should be composited this frame:

- One entry (`weight: 1`) when not blending.
- Two entries during a cross-fade — the outgoing and incoming clip/frame, with weights that interpolate linearly from `[1, 0]` to `[0, 1]` over the transition's `duration` and always sum to `1`.

```typescript
interface ActiveClipFrame {
  state: string;
  clip: AnimationClip;
  frame: number;
  weight: number;
}
```

A renderer composites every entry (e.g. draw both frames with alpha equal to `weight`) to get a blended pose; with a single entry it's a normal draw.

---

## Update loop

### `update(deltaTime: number): void`

Call once per frame. Evaluates transitions against the current parameter/trigger state, advances the current (and, mid-blend, the incoming) clip's frame at its `frameRate`, and finalizes a blend once its `duration` elapses.

### `speed: number`

Playback speed multiplier, default `1`. Applies to both the outgoing and incoming clip during a blend.

---

## Example: idle/walk/attack

```typescript
import { AnimatorController } from "@emptysock/engine";

const controller = player.addComponent(AnimatorController);

controller.addState("idle", {
  name: "idle",
  frameStart: 0,
  frameEnd: 3,
  frameRate: 6,
  loop: true,
});
controller.addState("walk", {
  name: "walk",
  frameStart: 0,
  frameEnd: 7,
  frameRate: 12,
  loop: true,
});
controller.addState("attack", {
  name: "attack",
  frameStart: 0,
  frameEnd: 5,
  frameRate: 15,
  loop: false,
});

controller.addTransition("idle", {
  to: "walk",
  condition: (ctx) => (ctx.getParam("speed") as number) > 0,
  duration: 0.2,
});
controller.addTransition("walk", {
  to: "idle",
  condition: (ctx) => (ctx.getParam("speed") as number) === 0,
  duration: 0.2,
});
controller.addTransition("*", {
  to: "attack",
  condition: (ctx) => ctx.isTriggered("attack"),
});

controller.play("idle");

function onUpdate(dt: number): void {
  controller.setFloat("speed", velocity.length());
  if (input.isKeyPressed("Space")) controller.setTrigger("attack");
  controller.update(dt);
}
```

# Timer and Coroutine

`Timer` and coroutines are the two tools for time-based game logic. Use `Timer` for fire-and-forget callbacks; use coroutines for multi-step sequences that unfold over multiple frames.

---

## Timer

`Timer` runs code after a delay or on a repeating interval, integrated with the game loop. Use `Timer` instead of `setTimeout`/`setInterval` — browser timers are not paused when the game pauses, and they do not respect frame timing.

Import: `import { Timer, type TimerHandle } from '@emptysock/engine';`

### `Timer.after(seconds, fn): TimerHandle`

Runs `fn` once after `seconds` seconds (game time, not wall time).

```typescript
const handle = Timer.after(3.0, () => {
  this.spawnBoss();
});
```

### `Timer.every(seconds, fn): TimerHandle`

Runs `fn` repeatedly every `seconds` seconds.

```typescript
const handle = Timer.every(1.0, () => {
  this.flashHealthBar();
});
```

### `TimerHandle.cancel(): void`

Stops the timer before it fires (or before the next repeat). **Always call this in `onDestroy()`** — if you forget, the callback fires after the scene is gone and attempts to modify destroyed state.

```typescript
export class BossScene extends Scene {
  private _phaseTimer!: TimerHandle;
  private _tickTimer!: TimerHandle;

  override async onLoad(): Promise<void> {
    this._phaseTimer = Timer.after(30, () => this.startPhase2());
    this._tickTimer = Timer.every(1.0, () => this.flashHealthBar());
  }

  override onDestroy(): void {
    this._phaseTimer.cancel();
    this._tickTimer.cancel();
  }
}
```

---

## Coroutines

A coroutine is a generator function that can pause mid-execution without blocking the game loop. They are the right tool for cutscenes, boss attack patterns, tutorial prompts, and intro animations — anything that unfolds over multiple frames.

### Starting a coroutine

```typescript
import {
  waitSeconds,
  waitFrames,
  waitUntil,
  waitForAnimation,
} from "@emptysock/engine";

entity.startCoroutine(function* introCutscene() {
  hud.hide();
  Camera.fade({ from: 0x000000, duration: 1.0 });

  yield waitSeconds(1.0);

  dialogue.show("Welcome to the dungeon...");
  yield waitSeconds(3.0);

  dialogue.hide();
  hud.show();

  yield waitFrames(30);

  boss.activate();
  yield waitUntil(() => boss.health < 100);

  music.transition("boss_phase2");
});
```

### Yield helpers

| Helper                       | Description                                 |
| ---------------------------- | ------------------------------------------- |
| `waitSeconds(n)`             | Pause for `n` seconds                       |
| `waitFrames(n)`              | Pause for `n` frames                        |
| `waitForAnimation(animator)` | Pause until the current animation clip ends |
| `waitUntil(() => boolean)`   | Pause until the callback returns `true`     |

### Stopping a coroutine

```typescript
const handle = entity.startCoroutine(function* () {
  /* ... */
});
handle.stop(); // cancel before completion
```

Coroutines are cleaned up automatically when the entity is destroyed — you do not need to stop them in `onDestroy()` unless you need to stop them early.

---

## When to use each

| Situation                                                | Tool                       |
| -------------------------------------------------------- | -------------------------- |
| Fire a one-shot callback after N seconds                 | `Timer.after`              |
| Repeat something every N seconds                         | `Timer.every`              |
| A sequence with waits between steps (cutscene, tutorial) | Coroutine                  |
| Wait for a condition to become true                      | `waitUntil` in a coroutine |
| Multi-frame animation logic                              | Coroutine                  |

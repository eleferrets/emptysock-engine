# Entities and Scenes

This guide explains how EmptySock organises game logic. Understanding Scene, Entity, Component, and the game loop is the foundation for everything else.

For the full API signatures, see the [Scene reference](../reference/scene.md), [Entity reference](../reference/entity.md), and [Component reference](../reference/component.md).

---

## What is a Scene?

A **Scene** is a self-contained game level or screen — a main menu, a gameplay level, a cutscene, or a settings screen. The engine loads one Scene at a time. When a Scene loads, it sets up everything it needs; when it unloads, it cleans everything up.

Every Scene has three lifecycle methods:

- `onLoad()` — called once when the Scene becomes active. Create entities, set up systems, load assets here.
- `onUpdate(dt)` — called every frame. `dt` is the time in seconds since the last frame. Move things, check input, run game logic here.
- `onDestroy()` — called once when the Scene is removed. Destroy systems, cancel timers, release resources here.

```typescript
import { Scene } from "@emptysock/engine";

export class GameScene extends Scene {
  override async onLoad(): Promise<void> {
    // Set up everything this scene needs.
  }

  override onUpdate(dt: number): void {
    // Runs every frame. dt keeps movement frame-rate independent.
  }

  override onDestroy(): void {
    // Clean up. Cancel every timer handle here.
  }
}
```

---

## The game loop

The engine calls your scene methods in this order:

1. `onLoad()` — once at startup, awaited before the first frame
2. `onUpdate(dt)` — once per frame, as fast as the display allows
3. `onDestroy()` — once at shutdown

`dt` keeps your game frame-rate independent. Moving an entity by `speed * dt` metres every frame produces the same real-world travel time at 30 fps and 120 fps.

**Never declare `onUpdate` as `async`.** The engine calls it as a plain function and discards any returned Promise. Use coroutines instead for work that spans multiple frames.

---

## What is an Entity?

An **Entity** is a named game object. By itself it has no behaviour — it is just a container with an ID. Everything an entity does comes from the components attached to it.

```typescript
const player = scene.createEntity("player");
```

---

## What is a Component?

A **Component** is data (and optional methods) attached to an entity. Components give entities their behaviour and appearance.

```typescript
import { Transform, Sprite } from "@emptysock/engine";

const player = scene.createEntity("player");
player.addComponent(Transform, { x: 100, y: 200 });
player.addComponent(Sprite, { texture: "hero.png" });

// Retrieve it later:
const t = player.requireComponent(Transform);
t.x += 10;
```

One rule: each entity can hold at most one component of a given type. `addComponent` throws if you add the same type twice.

Components do not have their own `update()`. Game logic that reads and mutates component state lives in the scene's `onUpdate()`.

---

## Querying entities

`scene.query(...ComponentTypes)` returns all entities that have all of the specified component types attached:

```typescript
const enemies = this.query(EnemyTag, PhysicsBody);
for (const e of enemies) {
  const body = e.requireComponent(PhysicsBody);
  body.applyImpulse({ x: 0, y: -50 });
}
```

> `query()` does an O(n) scan over scene entities every time it is called. Cache the results or call it outside of tight loops.

---

## SceneManager

`SceneManager` controls which scene is running:

```typescript
import { SceneManager } from "@emptysock/engine";

// Replace the active scene:
SceneManager.load("MenuScene");

// Replace with a visual transition:
SceneManager.transition("Level2Scene", { effect: "fade", duration: 0.4 });

// Push an overlay scene (pauses the one beneath):
SceneManager.push("PauseScene");

// Return to the scene beneath the overlay:
SceneManager.pop();
```

---

## Coroutines

A coroutine is a generator function that can pause itself and resume on the next frame (or after a delay). Use `entity.startCoroutine` for animations, timed events, or any sequence that should not block the game loop.

```typescript
import { waitSeconds, waitFrames, waitUntil } from "@emptysock/engine";

entity.startCoroutine(function* introCutscene() {
  hud.hide();
  Camera.fade({ from: 0x000000, duration: 1.0 });

  yield waitSeconds(1.0); // wait 1 second

  dialogue.show("Welcome to the dungeon...");
  yield waitSeconds(3.0); // player reads the text

  dialogue.hide();
  hud.show();

  yield waitUntil(() => boss.health < 100);
  music.transition("boss_phase2");
});
```

| Yield helper                 | Description                                 |
| ---------------------------- | ------------------------------------------- |
| `waitSeconds(n)`             | Pause for `n` seconds                       |
| `waitFrames(n)`              | Pause for `n` frames                        |
| `waitForAnimation(animator)` | Pause until the current animation clip ends |
| `waitUntil(() => condition)` | Pause until the callback returns `true`     |

To stop a coroutine manually:

```typescript
const handle = entity.startCoroutine(function* () {
  /* ... */
});
handle.stop();
```

Coroutines are cleaned up automatically when the entity is destroyed.

---

## Timers

`Timer` lets you run code after a delay or on a repeating interval, integrated with the game loop. Use `Timer` instead of `setTimeout`/`setInterval` — browser timers are not paused when the game pauses.

```typescript
import { Timer, type TimerHandle } from "@emptysock/engine";

export class BossScene extends Scene {
  private phaseTimer!: TimerHandle;
  private tickTimer!: TimerHandle;

  override async onLoad(): Promise<void> {
    this.phaseTimer = Timer.after(30, () => this.startPhase2());
    this.tickTimer = Timer.every(1.0, () => this.flashHealthBar());
  }

  override onDestroy(): void {
    // Always cancel timer handles in onDestroy.
    this.phaseTimer.cancel();
    this.tickTimer.cancel();
  }
}
```

> If you forget to call `handle.cancel()` in `onDestroy`, the callback fires after the scene is gone and attempts to modify destroyed state.

---

## A complete example

```typescript
import { Scene, Transform } from "@emptysock/engine";

export class MyScene extends Scene {
  override async onLoad(): Promise<void> {
    const box = this.createEntity("box");
    box.addComponent(Transform, { x: 0, y: 0 });
  }

  override onUpdate(dt: number): void {
    const box = this.findEntity("box");
    if (box === null) return;
    const t = box.requireComponent(Transform);
    t.x += 100 * dt; // move right at 100 units per second
  }

  override onDestroy(): void {
    // nothing to clean up in this example
  }
}
```

---

See also: [Physics guide](./physics.md), [Actors and Networking guide](./actors-and-networking.md)

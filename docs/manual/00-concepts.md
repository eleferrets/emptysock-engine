# 0 — Core Concepts

A quick introduction to how EmptySock is structured. No prior game-engine experience needed.

---

## What is a Scene?

A Scene is a self-contained game level or screen — a main menu, a gameplay level, a cutscene, or a settings screen. The engine loads one Scene at a time. When a Scene loads, it sets up everything it needs; when it unloads, it cleans everything up.

Every Scene has three lifecycle methods:

- `onLoad()` — called once when the Scene becomes active. Create entities, set up systems, load assets here.
- `onUpdate(dt)` — called every frame. `dt` is the time in seconds since the last frame. Move things, check input, run game logic here.
- `onDestroy()` — called once when the Scene is removed. Destroy systems, remove DOM nodes, release any resources here.

---

## What is an Entity?

An Entity is a named game object. By itself it has no behaviour — it is just a container with an ID. Everything an entity does comes from the components attached to it.

```typescript
const player = scene.createEntity("player");
```

---

## What is a Component?

A Component is data attached to an entity. Components give entities their behaviour and appearance — a `Transform` places the entity in the world, a `Sprite` draws it, a `PhysicsBody` makes it collide with things.

```typescript
import { Transform, Sprite } from "@emptysock/engine";

const player = scene.createEntity("player");
player.addComponent(new Transform({ x: 100, y: 200 }));
player.addComponent(new Sprite({ textureName: "hero.png" }));

// Retrieve it later:
const t = player.getComponent(Transform);
t.x += 10;
```

One rule to remember: each entity can hold at most one component of a given type. Calling `addComponent(new Transform())` twice replaces the first one.

---

## What is a System?

A System is an engine subsystem that manages a category of game logic. Physics, audio, camera, and input are all systems. You create a system in `onLoad` and destroy it in `onDestroy`.

```typescript
import { PhysicsSystem, AudioSystem } from "@emptysock/engine";

export class GameScene extends Scene {
  private _physics!: PhysicsSystem;

  override async onLoad(): Promise<void> {
    this._physics = new PhysicsSystem({ gravity: { x: 0, y: 9.8 } });
  }

  override onDestroy(): void {
    this._physics.destroy();
  }
}
```

---

## The game loop

The engine calls your scene methods in this order:

1. `onLoad()` — once at startup
2. `onUpdate(dt)` — once per frame, as fast as the display allows
3. `onDestroy()` — once at shutdown

`dt` keeps your game frame-rate independent. Moving an entity by `speed * dt` metres every frame produces the same real-world travel time at 30 fps and 120 fps.

**Never declare `onUpdate` as `async`.** The engine calls it as a plain function and discards any returned Promise. Use coroutines instead for work that spans multiple frames.

---

## Coroutines

A coroutine is a generator function that can pause itself and resume on the next frame (or after a delay). Use `entity.startCoroutine` for animations, timed events, or any sequence that should not block the game loop.

```typescript
import { waitSeconds } from "@emptysock/engine";

entity.startCoroutine(function* () {
  yield waitSeconds(1); // pause for 1 second, then continue
  console.log("one second has passed");
});
```

---

## Quick code template

A minimal working scene with one entity and a Transform:

```typescript
import { Scene, Transform } from "@emptysock/engine";

export class MyScene extends Scene {
  override async onLoad(): Promise<void> {
    const box = this.createEntity("box");
    box.addComponent(new Transform({ x: 0, y: 0 }));
  }

  override onUpdate(dt: number): void {
    const box = this.findEntity("box");
    if (box === null) return;
    const t = box.getComponent(Transform);
    t.x += 100 * dt; // move right at 100 units per second
  }

  override onDestroy(): void {
    // nothing to clean up in this example
  }
}
```

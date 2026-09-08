# 20 — Tutorial: Build a Mini Bullet Hell

This tutorial builds a minimal bullet hell game — a player ship that dodges waves of bullets fired by an enemy spawner. By the end you will have:

- A player that moves in 8 directions
- An enemy that fires bullets using a coroutine spawner
- Bullet-player collision detected by PhysicsSystem
- A lives counter that ends the game after three hits

Estimated time: 20–30 minutes.

---

## Step 1 — Set up the scene

Open `src/scenes/GameScene.ts` in the Files panel. Replace its contents with the scene scaffold:

```typescript
import {
  Scene,
  Entity,
  Transform,
  PhysicsSystem,
  InputSystem,
  CoroutineSystem,
  waitSeconds,
  EightDirBehavior,
  BulletBehavior,
  type BehaviorContext,
} from "@emptysock/engine";

const W = 480;
const H = 640;
const BULLET_SPEED = 220; // px/s — edit this and save to hot-reload the change
const SPAWN_INTERVAL = 0.8; // seconds between bursts
```

The constants at the top are the first thing you will tweak. Keep them in one place so the live hot-reload cycle is fast.

---

## Step 2 — Create the player

Add a `createPlayer` function below the constants:

```typescript
function createPlayer(scene: Scene, input: InputSystem): Entity {
  const player = scene.createEntity("player");
  player.addComponent(new Transform({ x: W / 2, y: H - 80 }));
  player.addTag("player");
  // EightDirBehavior reads arrow keys and WASD from InputSystem each frame.
  // The update call is wired through the scene system added in onLoad.
  (player as unknown as { _eightDir: EightDirBehavior })._eightDir =
    new EightDirBehavior(input, 180);
  return player;
}
```

The behavior is stored on the entity as a plain property so we can call `update()` from the scene system in Step 4. There is no built-in "behavior runner" component — you drive behaviors yourself from a scene system. This keeps the control flow explicit.

---

## Step 3 — Write the bullet spawner coroutine

A coroutine lets you write timed logic as a generator function instead of accumulating a timer variable by hand:

```typescript
function* spawnBullets(
  scene: Scene,
  physics: PhysicsSystem,
): Generator<unknown, void, unknown> {
  while (true) {
    yield waitSeconds(SPAWN_INTERVAL);

    // Fire five bullets spread in a fan
    const angles = [-0.4, -0.2, 0, 0.2, 0.4];
    for (const angle of angles) {
      const bullet = scene.createEntity("bullet");
      const t = new Transform({ x: W / 2, y: 80 });
      bullet.addComponent(t);
      bullet.addTag("bullet");

      // BulletBehavior moves the entity along a fixed angle each frame.
      // destroyOutside removes it once it leaves the layout bounds.
      const behavior = new BulletBehavior({
        speed: BULLET_SPEED,
        angle: Math.PI / 2 + angle, // downward fan
        destroyOutside: true,
        boundsWidth: W,
        boundsHeight: H,
      });
      (bullet as unknown as { _bullet: BulletBehavior })._bullet = behavior;

      physics.addCircle(bullet, { radius: 6, sensor: true, tag: "bullet" });
    }
  }
}
```

The `while (true)` loop combined with `yield waitSeconds(...)` is safe here — the CoroutineSystem drives the generator one step per frame, so it never blocks.

---

## Step 4 — Wire everything in onLoad

```typescript
export class GameScene extends Scene {
  private _physics = new PhysicsSystem();
  private _input = new InputSystem();
  private _coroutines = new CoroutineSystem();
  private _lives = 3;

  onLoad(): void {
    this._input.attach();

    const player = createPlayer(this, this._input);
    this._physics.addCircle(player, {
      radius: 14,
      sensor: false,
      tag: "player",
    });

    // Collision callback — called when a bullet sensor overlaps the player body
    this._physics.onSensorOverlap((a, b) => {
      const bulletEntity =
        a.tag === "bullet" ? a.entity : b.tag === "bullet" ? b.entity : null;
      if (bulletEntity === null) return;
      this.removeEntity(bulletEntity);
      this._lives -= 1;
      console.log(`Hit! Lives remaining: ${this._lives}`);
      if (this._lives <= 0) {
        console.log("Game over");
      }
    });

    this._coroutines.start(spawnBullets(this, this._physics));

    // Scene system: runs every frame, updates behaviors and physics
    this.addSystem("main", (_scene, dt) => {
      this._input.flush();
      this._coroutines.update(dt);

      // Update player movement behavior
      const playerEntity = this.getEntitiesByTag("player")[0];
      if (playerEntity !== undefined) {
        const eightDir = (
          playerEntity as unknown as { _eightDir: EightDirBehavior }
        )._eightDir;
        eightDir.update({
          entity: playerEntity,
          dt,
          scene: this,
        } satisfies BehaviorContext);
      }

      // Update bullet movement behaviors
      for (const bullet of this.getEntitiesByTag("bullet")) {
        const b = (bullet as unknown as { _bullet: BulletBehavior })._bullet;
        if (b !== undefined) {
          b.update({
            entity: bullet,
            dt,
            scene: this,
          } satisfies BehaviorContext);
        }
      }

      this._physics.update(dt);
    });
  }

  onDestroy(): void {
    this._input.detach();
    this._physics.destroy();
  }
}
```

`PhysicsSystem.destroy()` is mandatory — Rapier allocates its world buffers in WASM linear memory outside the JavaScript heap. If you skip it, memory leaks accumulate across scene transitions.

---

## Step 5 — Play and iterate

Click **Play** in the IDE toolbar. The spawner fires a bullet fan every 0.8 seconds. Move with arrow keys or WASD.

**Hot-reload tip:** Change `BULLET_SPEED` from `220` to `350` and save the file. The IDE detects the change and hot-reloads the code into the running iframe within 300 ms — no restart needed. You will see the bullets immediately speed up. This works for any constant or behaviour tweak; structural changes (new entities, new physics bodies) need a full restart.

---

## What to try next

- Add a `WrapBehavior` to the player so it wraps around the screen edges instead of stopping at them.
- Replace the fan pattern with a spiral by incrementing the base angle each burst.
- Add a `SineBehavior` to the enemy position to make it oscillate side-to-side.
- Wire a `UISystem` text component to display the live `_lives` count on screen.
- Add sound effects via `AudioSystem.play()` on each hit.

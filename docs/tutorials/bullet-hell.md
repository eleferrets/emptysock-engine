# Tutorial: Build a Mini Bullet Hell

This tutorial builds a minimal bullet hell game — a player ship that dodges waves of bullets fired by an enemy spawner. By the end you will have:

- A player that moves in 8 directions
- An enemy that fires bullets using a coroutine spawner
- Bullet-player collision detected by PhysicsSystem2D
- A lives counter that ends the game after three hits

Estimated time: 20–30 minutes.

---

## Step 1 — Set up the scene

Open `src/scenes/GameScene.ts` in the Files panel. Replace its contents with:

```typescript
import {
  Scene,
  InputSystem,
  PhysicsBody,
  waitSeconds,
} from "@emptysock/engine";

const W = 480;
const H = 640;
const BULLET_SPEED = 220; // px/s — edit this and save to hot-reload the change
const SPAWN_INTERVAL = 0.8; // seconds between bursts
```

Constants at the top are the first thing you will tweak. Keep them here so the live hot-reload cycle is fast.

---

## Step 2 — Create the player entity

Add a `_buildPlayer()` method:

```typescript
export class GameScene extends Scene {
  private _input!: InputSystem;
  private _playerEntity!: ReturnType<Scene["createEntity"]>;
  private _lives = 3;

  private _buildPlayer(): void {
    const player = this.createEntity("Player");
    player.position.x = W / 2;
    player.position.y = H - 80;
    player.addTag("player");

    player.addComponent(PhysicsBody, {
      shape: "circle",
      bodyType: "dynamic",
      gravityScale: 0,
      restitution: 0,
      isSensor: false,
    });

    const body = player.requireComponent(PhysicsBody);
    body.onCollisionEnter((other) => {
      if (other.entity.hasTag("bullet")) {
        other.entity.destroy();
        this._lives -= 1;
        if (this._lives <= 0) {
          console.log("Game over");
        }
      }
    });

    this._playerEntity = player;
  }
}
```

---

## Step 3 — Write the bullet spawner coroutine

A coroutine lets you write timed logic as a generator function instead of accumulating a timer variable by hand:

```typescript
private *_spawnBullets(): Generator<unknown, void, unknown> {
  while (true) {
    yield waitSeconds(SPAWN_INTERVAL);

    // Fire five bullets spread in a fan
    const angles = [-0.4, -0.2, 0, 0.2, 0.4];
    for (const angle of angles) {
      const bullet = this.createEntity('Bullet');
      bullet.position.x = W / 2;
      bullet.position.y = 80;
      bullet.addTag('bullet');

      // Store angle and speed on the entity for movement in onUpdate
      (bullet as unknown as Record<string, unknown>)['_angle'] = Math.PI / 2 + angle;
      (bullet as unknown as Record<string, unknown>)['_speed'] = BULLET_SPEED;

      bullet.addComponent(PhysicsBody, {
        shape: 'circle',
        bodyType: 'kinematic',
        isSensor: true,
        gravityScale: 0,
        restitution: 0,
      });
    }
  }
}
```

The `while (true)` combined with `yield waitSeconds(...)` is safe — the engine drives the generator one step per frame and never blocks.

---

## Step 4 — Wire everything in `onLoad` and `onUpdate`

```typescript
override onLoad(): void {
  this._input = new InputSystem();
  this._input.attach(document.querySelector('canvas') as HTMLCanvasElement);

  this._buildPlayer();

  // Start the spawner coroutine on any entity (bullet spawner lives on a dummy entity)
  const spawner = this.createEntity('Spawner');
  spawner.startCoroutine(this._spawnBullets());
}

override onUpdate(dt: number): void {
  this._input.flush();

  // Player movement
  const speed = 180;
  const h = this._input.axis('Horizontal');
  const v = this._input.axis('Vertical');
  this._playerEntity.position.x += h * speed * dt;
  this._playerEntity.position.y += v * speed * dt;

  // Clamp player to screen
  this._playerEntity.position.x = Math.max(0, Math.min(W, this._playerEntity.position.x));
  this._playerEntity.position.y = Math.max(0, Math.min(H, this._playerEntity.position.y));

  // Move bullets
  for (const entity of this.query({ tags: ['bullet'] })) {
    const angle = (entity as unknown as Record<string, unknown>)['_angle'] as number;
    const spd   = (entity as unknown as Record<string, unknown>)['_speed'] as number;
    entity.position.x += Math.cos(angle) * spd * dt;
    entity.position.y += Math.sin(angle) * spd * dt;

    // Destroy bullets that leave the screen
    if (entity.position.x < 0 || entity.position.x > W ||
        entity.position.y < 0 || entity.position.y > H) {
      entity.destroy();
    }
  }
}

override onDestroy(): void {
  this._input.attach(null as unknown as HTMLCanvasElement);
}
```

---

## Step 5 — Play and iterate

Click **Play** in the IDE toolbar. The spawner fires a bullet fan every 0.8 seconds. Move with arrow keys or WASD.

**Hot-reload tip:** Change `BULLET_SPEED` from `220` to `350` and save. The IDE hot-reloads the code into the running preview within 300 ms — no restart needed. You will see bullets immediately speed up. Structural changes (new entities, new physics bodies) need a full restart.

---

## What to try next

- Add a `WrapBehavior` so the player wraps around screen edges instead of being clamped.
- Replace the fan pattern with a spiral by incrementing the base angle each burst.
- Add a `SineBehavior` to the enemy position to make it oscillate side-to-side.
- Wire a UISystem text widget to display the live `_lives` count on screen.
- Add sound effects via `Audio.play()` on each hit.
- Add a particle burst on bullet impact with `ParticleSystem.burst()`.

---

## What you practised

| Concept                                             | Where                                |
| --------------------------------------------------- | ------------------------------------ |
| Scene lifecycle (`onLoad`, `onUpdate`, `onDestroy`) | `GameScene`                          |
| Entity creation and tags                            | `_buildPlayer`, `_spawnBullets`      |
| PhysicsBody collision callbacks                     | `onCollisionEnter` in `_buildPlayer` |
| Coroutines with `waitSeconds`                       | `_spawnBullets`                      |
| InputSystem — `attach`, `flush`, `axis`             | `onLoad`, `onUpdate`                 |
| Frame-accurate movement with `dt`                   | `onUpdate`                           |
| Hot-reload workflow                                 | Step 5                               |

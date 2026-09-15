# Scene

`Scene` is the root container for one game screen. It owns entities, manages the game loop, and receives lifecycle callbacks.

Import: `import { Scene, type SceneConfig } from '@emptysock/engine';`

---

## SceneConfig

Optional static configuration object on your Scene subclass:

```typescript
export class GameScene extends Scene {
  static readonly config: SceneConfig = {
    renderMode: "2d", // '2d' | '3d'
    gameSpeed: 60, // target fps
  };
}
```

| Field        | Type           | Default | Description                   |
| ------------ | -------------- | ------- | ----------------------------- |
| `renderMode` | `'2d' \| '3d'` | `'2d'`  | Render pipeline to initialise |
| `gameSpeed`  | `number`       | `60`    | Target frames per second      |

---

## Lifecycle methods

### `onLoad(): Promise<void>`

Called once when the Scene becomes active, awaited before the first frame. Create entities, initialise systems, and load assets here.

```typescript
override async onLoad(): Promise<void> {
  this._physics = new PhysicsSystem3D();
  await this._physics.init({ x: 0, y: -9.81, z: 0 });

  const player = this.createEntity('Player');
  player.addComponent(Transform, { x: 400, y: 300 });
}
```

### `onUpdate(dt: number): void`

Called every frame. `dt` is wall-clock seconds since the last frame (capped internally to prevent spiral-of-death on tab suspend).

**Never declare `onUpdate` as `async`.** The engine calls it as a plain synchronous function and discards any returned Promise. Use coroutines for multi-frame work.

```typescript
override onUpdate(dt: number): void {
  this._actors.update(dt);
  this._physics.update(dt);
}
```

### `onDestroy(): void`

Called once when the Scene is unloaded. Cancel every timer handle. Call `physics.destroy()` if you used 3D physics.

```typescript
override onDestroy(): void {
  this._spawnTimer.cancel();
  this._actors.destroy();
  this._physics.destroy(); // mandatory for PhysicsSystem3D
}
```

---

## Entity management

### `scene.createEntity(name: string): Entity`

Creates a named entity and registers it with the scene. Returns the new `Entity` instance.

```typescript
const player = this.createEntity("Player");
```

### `scene.findEntity(name: string): Entity | null`

Returns the first entity with the given name, or `null` if not found.

```typescript
const boss = this.findEntity("Boss");
if (boss !== null) boss.requireComponent(Health).takeDamage(50);
```

### `scene.query(...ComponentTypes): Entity[]`

Returns all entities that have all of the specified component types attached.

```typescript
const enemies = this.query(EnemyTag, PhysicsBody);
for (const e of enemies) {
  e.requireComponent(Health).takeDamage(10);
}
```

> `query()` is O(n) over scene entities. Cache the result when calling inside tight loops.

---

## SceneManager

`SceneManager` controls which Scene is running.

Import: `import { SceneManager } from '@emptysock/engine';`

### `SceneManager.load(name: string): void`

Replace the active scene.

```typescript
SceneManager.load("MenuScene");
```

### `SceneManager.transition(name: string, options: TransitionOptions): void`

Replace the active scene with a visual transition effect.

| Option     | Type                | Description          |
| ---------- | ------------------- | -------------------- |
| `effect`   | `'fade' \| 'slide'` | Transition animation |
| `duration` | `number`            | Duration in seconds  |

```typescript
SceneManager.transition("Level2Scene", { effect: "fade", duration: 0.4 });
```

### `SceneManager.push(name: string): void`

Push an overlay scene. The scene beneath is paused (its `onUpdate` stops) but not destroyed.

```typescript
SceneManager.push("PauseScene");
```

### `SceneManager.pop(): void`

Return to the scene beneath the overlay.

```typescript
SceneManager.pop();
```

### `SceneManager.stackDepth: number`

Current scene stack depth.

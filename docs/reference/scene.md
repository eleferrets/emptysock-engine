# Scene

`Scene` is the root container for one game screen. It owns entities, drives the game loop, and receives lifecycle callbacks.

Import: `import { Scene, type SceneConfig } from '@emptysock/engine';`

> **Heads up:** this is the classic, class-based `Scene`. `@emptysock/engine/ecs` has its own `Scene` built on bitECS, with a different shape (`scene.spawn()`, `scene.each()`, prefabs with built-in pooling). See the [Core API reference](./core-api.md) and [Entities and Components](../guides/entities-and-components.md).

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

`SceneManagerInstance` is the module-level singleton that controls which Scene is running.

Import: `import { SceneManagerInstance } from '@emptysock/engine';`

For a complete guide with push/pop patterns and transition examples see [`docs/manual/21-scene-manager.md`](../../manual/21-scene-manager.md).

### `register(name: string, factory: () => Scene): void`

Register a scene factory before calling `load` or `transition`. Called once at startup.

```typescript
SceneManagerInstance.register("game", () => new GameScene());
SceneManagerInstance.load("game");
```

### `load(name: string): Scene`

Stop the current scene and start the named scene immediately. Throws if `name` is not registered.

### `transition(name: string, options?): void`

Queues a scene switch with a timed delay and an optional visual effect. Completes on the next `update()` after the duration.

| Option     | Type                                    | Default    | Description                                    |
| ---------- | --------------------------------------- | ---------- | ---------------------------------------------- |
| `duration` | `number`                                | `0.3`      | Delay in seconds before the switch             |
| `colour`   | `number`                                | `0x000000` | Overlay colour (hex) for `fade`/`wipe`/`slide` |
| `effect`   | `'none' \| 'fade' \| 'wipe' \| 'slide'` | `'none'`   | Visual transition style                        |

`SceneManager` only tracks and times the effect — it never touches pixi/DOM. Attach a `PostProcessSystem` with `attachPostProcess()` so `transition()` drives its transition state, and call `RenderPipeline.renderTransitionOverlay()` (or `renderFrame(scene, postProcess)`) each frame to paint it.

```typescript
SceneManagerInstance.attachPostProcess(postProcess);
SceneManagerInstance.transition("level2", { duration: 0.5, effect: "wipe" });
```

### `queue(name: string): void`

Queues a scene switch with no effect — fires on the next `update()`. Use when you need to finish the current frame before switching.

### `pushScene(scene: Scene): void`

Push a scene on top of the current one. The current scene is paused (its `onUpdate` stops) but not destroyed. Use for pause menus and dialogue overlays.

```typescript
SceneManagerInstance.pushScene(new PauseMenuScene());
```

### `popScene(): void`

Stop the overlay scene and resume the one beneath. No-op if nothing is stacked.

### `update(deltaTime: number): void`

Must be called inside the game loop. Drives the active scene's update and handles pending transitions.

### Properties

| Property          | Type            | Description                                        |
| ----------------- | --------------- | -------------------------------------------------- |
| `current`         | `Scene \| null` | The currently active scene                         |
| `stackDepth`      | `number`        | Total scenes on the stack including the active one |
| `isTransitioning` | `boolean`       | `true` while a `transition()` effect is running    |

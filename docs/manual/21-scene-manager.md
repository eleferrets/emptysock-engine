# 21 — SceneManager

`SceneManager` handles scene transitions, stacking, and registration. It is a module-level singleton exported as `SceneManagerInstance`. Import it wherever you need to switch scenes.

```typescript
import { SceneManagerInstance } from "@emptysock/engine";
```

---

## Registration

Before any scene can be loaded by name, register a factory for it. Call `register` once at startup — before the first `load` or `transition` call.

```typescript
import { SceneManagerInstance } from "@emptysock/engine";
import { TitleScene, GameScene, GameOverScene } from "./scenes";

SceneManagerInstance.register("title", () => new TitleScene());
SceneManagerInstance.register("game", () => new GameScene());
SceneManagerInstance.register("gameover", () => new GameOverScene());

// Load the first scene immediately
SceneManagerInstance.load("title");
```

---

## Methods

### `register(name, factory)`

Registers a scene factory under a string key. The factory is called every time the scene is loaded — returning a fresh instance each time, so scene state does not persist between loads unless you write it to `SaveSystem`.

| Parameter | Type          | Description                               |
| --------- | ------------- | ----------------------------------------- |
| `name`    | `string`      | Key used in `load` and `transition` calls |
| `factory` | `() => Scene` | Called each time the scene is loaded      |

---

### `load(name)`

Stops the current scene (calls `stop()`) and immediately starts the named scene. No transition effect.

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `name`    | `string` | Registered scene name |

Returns: `Scene` — the newly started scene instance.

Throws if `name` is not registered.

```typescript
SceneManagerInstance.load("gameover");
```

---

### `transition(name, options?)`

Queues a scene switch with a delay and an optional visual effect. The switch completes on the next `update()` call once the duration has elapsed.

| Parameter          | Type                                    | Description                                                    |
| ------------------ | --------------------------------------- | -------------------------------------------------------------- |
| `name`             | `string`                                | Registered scene name                                          |
| `options.duration` | `number`                                | Delay before the switch, in seconds. Default: `0.3`            |
| `options.colour`   | `number`                                | Overlay colour (hex) used by the `fade`/`wipe`/`slide` effects |
| `options.effect`   | `'none' \| 'fade' \| 'wipe' \| 'slide'` | Visual transition style. Default: `'none'` (instant cut)       |

Rendering the effect is `RenderPipeline`'s job, not `SceneManager`'s — `SceneManager` stays render-agnostic (no pixi/DOM imports). Call `SceneManagerInstance.attachPostProcess(postProcessSystem)` once at startup so `transition()`/`update()` drive that `PostProcessSystem`'s `transitionEffect`/`transitionProgress`/`transitionColour`, then call `renderPipeline.renderTransitionOverlay(postProcessSystem)` (or pass it as `renderPipeline.renderFrame(scene, postProcessSystem)`) each frame to actually paint it.

```typescript
// Delay 0.5 seconds then load the game scene, with a fade through black
SceneManagerInstance.attachPostProcess(postProcess);
SceneManagerInstance.transition("game", {
  duration: 0.5,
  effect: "fade",
  colour: 0x000000,
});
```

---

### `queue(name)`

Queues a scene switch with no effect — the switch happens on the next `update()`. Useful for deferred loads when you want to finish the current frame cleanly before switching.

---

### `pushScene(scene)`

Pushes a scene on top of the current one. The current scene is paused (`stop()`) but not destroyed. The pushed scene starts immediately. Use this for overlay scenes — pause menus, dialogue boxes — that should resume the underlying scene when closed.

```typescript
SceneManagerInstance.pushScene(new PauseMenuScene());
```

---

### `popScene()`

Stops the current scene and resumes the scene underneath. No-op if nothing is stacked.

```typescript
// Inside PauseMenuScene, resume button handler:
SceneManagerInstance.popScene();
```

---

## Properties

| Property          | Type            | Description                                        |
| ----------------- | --------------- | -------------------------------------------------- |
| `current`         | `Scene \| null` | The currently active scene                         |
| `stackDepth`      | `number`        | Total scenes on the stack including the active one |
| `isTransitioning` | `boolean`       | `true` while a `transition()` delay is in progress |

---

## update(deltaTime)

Call `SceneManagerInstance.update(dt)` inside your game loop. This drives the active scene's own `update()` and handles pending transitions.

```typescript
// In your game loop:
function tick(dt: number) {
  SceneManagerInstance.update(dt);
  requestAnimationFrame(() => tick(/* next dt */));
}
```

---

## Typical scene lifecycle with transitions

```typescript
class LevelCompleteScene extends Scene {
  override async onLoad(): Promise<void> {
    // Show score, play fanfare ...
    await this.waitSeconds(2);
    SceneManagerInstance.transition("game", { duration: 0.4 });
  }
}
```

---

## Push / pop for pause menus

```typescript
// In game scene — player presses Escape
SceneManagerInstance.pushScene(new PauseScene());

// In PauseScene — resume button clicked
SceneManagerInstance.popScene();
// The game scene's update() resumes on the next frame.
```

> Call `physics.destroy()` and clean up timers in `onDestroy` before the scene is popped or replaced — `popScene()` calls `stop()` which triggers `onDestroy`.

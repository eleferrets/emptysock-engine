# 4 — Core Engine Reference

This section is the reference for the building blocks every game uses: Scene, Entity, Component, Timer, Coroutine, Camera, and Audio. For system-level APIs (Physics, Input, NavMesh, etc.) see Section 5.

---

## 4.1 Scene

A **Scene** is the root container for one game screen. It owns entities, manages the game loop, and receives lifecycle callbacks. Think of it as the director of a single level or menu.

```typescript
import { Scene, type SceneConfig } from '@emptysock/engine';

export class GameScene extends Scene {
  // Optional: configure render mode and target frame rate
  static readonly config: SceneConfig = {
    renderMode: '2d',  // '2d' | '3d'
    gameSpeed: 60,     // target fps
  };

  override async onLoad(): Promise<void> {
    // Runs once, awaited before the first frame.
    // Create entities, load assets, await async systems here.
  }

  override onUpdate(dt: number): void {
    // Runs every frame. dt = seconds since last frame.
    // Move things, check collisions, read input here.
    // Never use async/await inside this method.
  }

  override onDestroy(): void {
    // Runs when the scene is unloaded.
    // Cancel timer handles here. Call physics.destroy() if you used 3D physics.
  }
}
```

### Scene.createEntity(name)

Creates a named entity and registers it with the scene. Returns the new `Entity` instance.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Human-readable label for the entity (shown in the Inspector panel) |

```typescript
const player = this.createEntity('Player');
```

### Scene.query(...ComponentTypes)

Returns all entities that have **all** of the specified component types attached. Useful for iterating over a group of similar objects (all enemies, all collectibles).

| Parameter | Type | Description |
|-----------|------|-------------|
| `...types` | `ComponentType[]` | One or more component constructor references |

```typescript
const enemies = this.query(EnemyTag, PhysicsBody);
for (const e of enemies) {
  const body = e.requireComponent(PhysicsBody);
  body.applyImpulse({ x: 0, y: -50 });
}
```

> **Common mistake:** `query()` does an O(n) scan over scene entities every time it is called. Cache the results or call it outside of tight loops.

---

## 4.2 Entity

An **Entity** is a named container for components. It carries a unique auto-generated `id` and a human-readable `name`. On its own it does nothing — behaviors come from the components you attach.

### entity.addComponent(Type, options?)

Attaches a component of the given type to this entity. Throws if a component of the same type is already attached.

| Parameter | Type | Description |
|-----------|------|-------------|
| `Type` | Component constructor | The class of the component to add |
| `options` | `object` (optional) | Initial values passed to the component's constructor |

```typescript
player.addComponent(Sprite, { texture: 'hero.png', anchor: { x: 0.5, y: 1.0 } });
player.addComponent(PhysicsBody, { shape: 'capsule', width: 32, height: 64 });
```

### entity.getComponent(Type)

Returns the component instance if it exists, or `undefined` if not. Use when the component is optional.

```typescript
const sprite = player.getComponent(Sprite);
sprite?.setAlpha(0.5); // safe — only called if sprite exists
```

### entity.requireComponent(Type)

Returns the component instance, or throws `ComponentNotFoundError` if it is not attached. Use when the component must exist and you want an error if it's missing.

```typescript
const body = player.requireComponent(PhysicsBody);
body.applyImpulse({ x: 100, y: 0 });
```

> **Common mistake:** Do not use `getComponent(BaseClass)` expecting to find a subclass added with `addComponent(SubClass)`. The lookup is by exact constructor — `getComponent(BaseHealth)` will not find a `SpecializedHealth` component.

### entity.removeComponent(Type)

Detaches and destroys the component instance.

```typescript
player.removeComponent(Animator); // stop animating this entity
```

### entity.destroy()

Removes the entity and all its components from the scene. Always call this when an entity is no longer needed.

```typescript
bullet.destroy(); // remove bullet when it hits a wall
```

### entity.position, entity.scale, entity.rotation

Shorthand transform properties. Writing to these updates the entity's transform directly and syncs to any attached rendering component.

```typescript
enemy.position = { x: 300, y: 400 };
enemy.rotation = Math.PI / 4; // 45 degrees
enemy.scale = { x: 2, y: 2 }; // twice as big
```

---

## 4.3 Component base class

**Components** are plain TypeScript classes. They do not need to extend any base class. When attached to an entity via `addComponent`, they receive a reference to their owning entity.

```typescript
// Define a custom component:
export class Health {
  current: number;
  max: number;

  constructor(max: number) {
    this.current = max;
    this.max = max;
  }

  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  get isDead(): boolean {
    return this.current <= 0;
  }
}

// Attach and use it:
const player = this.createEntity('Player');
player.addComponent(Health, 100);

// Later, in onUpdate:
const health = player.requireComponent(Health);
health.takeDamage(25);
if (health.isDead) {
  this.showGameOver();
  player.destroy();
}
```

> **Common mistake:** Components do not have their own `update()` method. Game logic that reads and writes component data should live in the scene's `onUpdate()`, not inside the component class.

---

## 4.4 Timer

**Timer** lets you run code after a delay or on a repeating interval, integrated with the game loop. Use `Timer` instead of `setTimeout`/`setInterval` — browser timers are not paused when the game pauses, and they do not respect frame timing.

| Method | Description |
|--------|-------------|
| `Timer.after(seconds, fn)` | Run `fn` once after `seconds` seconds |
| `Timer.every(seconds, fn)` | Run `fn` repeatedly every `seconds` seconds |
| `handle.cancel()` | Stop the timer before it fires |

```typescript
import { Timer, type TimerHandle } from '@emptysock/engine';

export class BossScene extends Scene {
  private phaseTimer!: TimerHandle;
  private tickTimer!: TimerHandle;

  override async onLoad(): Promise<void> {
    // Trigger boss phase 2 after 30 seconds
    this.phaseTimer = Timer.after(30, () => this.startPhase2());

    // Flash the health bar every second
    this.tickTimer = Timer.every(1.0, () => this.flashHealthBar());
  }

  override onDestroy(): void {
    // Always cancel timers in onDestroy!
    this.phaseTimer.cancel();
    this.tickTimer.cancel();
  }
}
```

> **Common mistake:** If you forget to call `handle.cancel()` in `onDestroy`, the callback fires after the scene is gone and attempts to modify destroyed state. This usually crashes with "cannot read property of undefined".

---

## 4.5 Coroutines

A **Coroutine** is a generator function that can pause mid-execution without blocking the game loop. They are the right tool for sequences that happen over multiple frames: cutscenes, boss patterns, tutorial prompts, intro animations.

Think of a coroutine as a recipe with "wait here" steps — the engine reads one step per frame until it hits a `yield`, then pauses and comes back the next frame.

| Yield helper | Description |
|-------------|-------------|
| `waitSeconds(n)` | Pause for `n` seconds |
| `waitFrames(n)` | Pause for `n` frames |
| `waitForAnimation(animator)` | Pause until the current animation clip ends |
| `waitUntil(() => condition)` | Pause until the callback returns `true` |

```typescript
import { waitSeconds, waitFrames, waitUntil } from '@emptysock/engine';

// A complete cutscene sequence:
entity.startCoroutine(function* introCutscene() {
  hud.hide();
  Camera.fade({ from: 0x000000, duration: 1.0 }); // fade in from black

  yield waitSeconds(1.0);   // wait for fade to finish

  dialogue.show('Welcome to the dungeon...');
  yield waitSeconds(3.0);   // player reads the text

  dialogue.hide();
  hud.show();

  yield waitFrames(30);     // half a second at 60fps

  boss.activate();
  yield waitUntil(() => boss.health < 100); // wait until boss takes damage

  music.transition('boss_phase2');
});
```

Coroutines are cleaned up automatically when the entity is destroyed. To stop a coroutine manually:

```typescript
const handle = entity.startCoroutine(function* () { /* ... */ });
handle.stop();
```

> **Common mistake:** Do not use `async/await` inside `onUpdate`. If you need something to happen over time, use a coroutine instead.

---

## 4.6 SceneManager

**SceneManager** controls which scene is running. Use it to switch between the main menu, levels, and game over screens.

| Method | Description |
|--------|-------------|
| `SceneManager.load(name)` | Replace the active scene |
| `SceneManager.transition(name, options)` | Replace with a visual transition effect |
| `SceneManager.push(name)` | Push an overlay scene (pauses the one beneath) |
| `SceneManager.pop()` | Return to the scene beneath the overlay |

```typescript
import { SceneManager } from '@emptysock/engine';

// In your game over screen:
SceneManager.load('MenuScene');

// With a fade transition:
SceneManager.transition('Level2Scene', { duration: 0.4 });

// Open a pause menu without destroying the game scene:
SceneManager.push('PauseScene');

// Close the pause menu and resume:
SceneManager.pop();
```

---

## 4.7 Tween

A **Tween** smoothly animates a numeric property from its current value to a target value over time.

| Parameter | Type | Description |
|-----------|------|-------------|
| `target` | `object` | The object whose properties you want to animate |
| `to` | `object` | The target values (must be numbers) |
| `options.duration` | `number` | Duration in seconds |
| `options.ease` | `EasingName` | The easing curve (see list below) |
| `options.onComplete` | `() => void` | Called when the tween finishes |

```typescript
import { Tween } from '@emptysock/engine';

// Slide entity to a new position over 0.5 seconds:
Tween.to(entity, { x: 400, y: 200 }, { duration: 0.5, ease: 'bounceOut' });

// Fade out and then destroy:
Tween.to(sprite, { alpha: 0 }, {
  duration: 0.3,
  ease: 'sineIn',
  onComplete: () => entity.destroy(),
});
```

**Available easing functions:** `linear`, `sineIn`, `sineOut`, `sineInOut`, `quadIn`, `quadOut`, `quadInOut`, `cubicIn`, `cubicOut`, `cubicInOut`, `bounceOut`, `elasticOut`, `backIn`, `backOut`.

---

## 4.8 Input (keyboard & mouse)

```typescript
import { Input } from '@emptysock/engine';

// In your onUpdate():

// Keyboard — held, just pressed, just released
if (Input.isDown('ArrowRight'))  { player.moveRight(dt); }
if (Input.isPressed('Space'))    { player.jump(); }    // fires once on keydown
if (Input.isReleased('Space'))   { player.land(); }   // fires once on keyup

// Axis — returns -1..1, works with keyboard WASD/arrows AND gamepad sticks
const horizontal = Input.axis('Horizontal'); // -1 (left) to 1 (right)
const vertical   = Input.axis('Vertical');   // -1 (up) to 1 (down)

// Mouse / pointer
const pos    = Input.pointer.position;   // { x, y } in canvas space
const delta  = Input.pointer.delta;      // movement since last frame
if (Input.pointer.isDown(0))    { /* left button held */ }
if (Input.pointer.isPressed(2)) { /* right button just clicked */ }
```

> **Tip:** Use `Input.axis` instead of checking individual arrow keys — axis works with both keyboard and gamepad automatically.

---

## 4.9 Camera

**Camera** controls what is visible in the game view. You can make it follow an entity, zoom, shake, or fade.

```typescript
import { Camera } from '@emptysock/engine';

// Follow the player smoothly (lerp = smoothing factor, 0.08 feels natural):
Camera.follow(player, { lerp: 0.08, deadzone: { x: 60, y: 30 } });

// Stop following:
Camera.stopFollowing();

// Screen shake (great for explosions):
Camera.shake({ intensity: 8, duration: 0.4 });

// Zoom in over 0.5 seconds:
Camera.zoom(2.0, { duration: 0.5, ease: 'sineOut' });

// Fade to black (before a scene transition):
Camera.fade({ to: 0x000000, duration: 0.6 });

// Fade in from black (after a scene transition):
Camera.fade({ from: 0x000000, duration: 0.6 });
```

---

## 4.10 Audio

```typescript
import { Audio } from '@emptysock/engine';

// Play a sound effect:
Audio.play('jump_sfx');

// Play a sound at a position in the game world (spatial audio):
Audio.play('footstep', { volume: 0.6, spatial: true, position: entity.position });

// Start background music (loops automatically):
Audio.music('level_theme', { loop: true, fade: 0.5 });

// Stop music with a fade:
Audio.stopMusic({ fade: 0.5 });

// Set volume for a group (these are wired to the Audio Mixer panel):
Audio.setGroupVolume('sfx', 0.8);
Audio.setGroupVolume('music', 0.5);
```

> **Tip:** Sound names passed to `Audio.play()` must match the filename in your project's Assets folder, without the extension.

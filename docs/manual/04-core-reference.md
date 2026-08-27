# 4 — Core Engine Reference

---

## 4.1 Scene

A scene is the root container for a game screen. It owns entities, manages the game loop, and receives lifecycle callbacks.

```typescript
import { Scene, type SceneConfig } from '@emptysock/engine';

export class GameScene extends Scene {
  // Optional: configure render mode and target frame rate
  static readonly config: SceneConfig = {
    renderMode: '2d',  // '2d' | '3d'
    gameSpeed: 60,     // target fps
  };

  override async onLoad(): Promise<void> { /* ... */ }
  override onUpdate(dt: number): void { /* ... */ }
  override onDestroy(): void { /* ... */ }
}
```

### Scene.createEntity(name)

Creates a named entity and registers it with the scene. Returns the new `Entity` instance.

```typescript
const player = scene.createEntity('Player');
```

### Scene.query(ComponentType, ...)

Returns all entities that have all specified component types. O(n) scan over scene entities.

```typescript
const enemies = scene.query(EnemyTag, PhysicsBody);
for (const e of enemies) {
  const body = e.requireComponent(PhysicsBody);
  body.applyImpulse({ x: 0, y: -50 });
}
```

---

## 4.2 Entity

An entity is a named container for components. It carries a unique auto-generated `id` and a human-readable `name`.

### addComponent(Type, options?)

```typescript
player.addComponent(Sprite, { texture: 'hero.png', anchor: { x: 0.5, y: 1.0 } });
```

Throws if a component of the same type is already attached.

### getComponent(Type)

Returns `T | undefined`. Use when the component is optional.

```typescript
const sprite = player.getComponent(Sprite);
sprite?.setAlpha(0.5);
```

### requireComponent(Type)

Returns `T` or throws `ComponentNotFoundError`. Use when the component must exist.

```typescript
const body = player.requireComponent(PhysicsBody);
```

### removeComponent(Type)

Detaches and destroys the component instance.

### destroy()

Removes the entity and all components from the scene. Always call this when an entity is no longer needed.

### entity.position, entity.scale, entity.rotation

Shorthand transform properties. Writing to these updates the entity's transform directly and syncs to any attached rendering component.

---

## 4.3 Component base class

Components are plain TypeScript classes. They do not need to extend any base class, but they receive a reference to their owning entity on attachment.

```typescript
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
  get isDead(): boolean { return this.current <= 0; }
}

// Usage:
player.addComponent(Health, 100);
const health = player.requireComponent(Health);
health.takeDamage(25);
```

---

## 4.4 Timer

Use `Timer` instead of `setTimeout`/`setInterval`. Timer callbacks are integrated into the scene's game loop and are automatically paused when the scene pauses.

```typescript
import { Timer, type TimerHandle } from '@emptysock/engine';

// Fire once after 2.5 seconds:
const h = Timer.after(2.5, () => this.spawnBoss());

// Fire repeatedly every 1 second:
const h2 = Timer.every(1.0, () => this.tick());

// Cancel (always do this in onDestroy):
h.cancel();
h2.cancel();
```

> **Warning:** If you forget to call `handle.cancel()` in `onDestroy`, the callback will fire after the scene is gone and attempt to mutate destroyed state.

---

## 4.5 Coroutines

Coroutines are generator functions that can pause mid-execution without blocking the game loop. They are the correct way to write sequences (cutscenes, tutorials, boss patterns, intro text) that happen over multiple frames.

```typescript
import { waitSeconds, waitFrames, waitForAnimation, waitUntil } from '@emptysock/engine';

entity.startCoroutine(function* intro_sequence() {
  yield waitSeconds(1.0);          // wait 1 second
  hud.showMessage('Level Start!');
  yield waitFrames(90);            // wait 90 frames (1.5s at 60fps)
  hud.hideMessage();
  yield waitForAnimation(boss);    // wait for Animator to finish current clip
  boss.startPhase2();
  yield waitUntil(() => boss.health < 50);  // wait until condition is true
  Camera.shake({ intensity: 15, duration: 0.5 });
});
```

Coroutines are cleaned up automatically when the entity is destroyed. To stop a running coroutine manually:

```typescript
const handle = entity.startCoroutine(function* () { /* ... */ });
handle.stop();
```

---

## 4.6 SceneManager

```typescript
import { SceneManager } from '@emptysock/engine';

// Replace the active scene:
SceneManager.load('GameScene');

// Transition with an effect:
SceneManager.transition('MenuScene', { effect: 'fade', duration: 0.4 });

// Push an overlay (pauses the scene beneath):
SceneManager.push('PauseScene');

// Return to the scene beneath:
SceneManager.pop();
```

---

## 4.7 Tween

```typescript
import { Tween } from '@emptysock/engine';

Tween.to(entity, { x: 400, y: 200 }, { duration: 0.5, ease: 'bounceOut' });
Tween.to(sprite, { alpha: 0 }, {
  duration: 0.3,
  ease: 'sineIn',
  onComplete: () => entity.destroy(),
});
```

Available easing functions: `linear`, `sineIn/Out/InOut`, `quadIn/Out/InOut`, `cubicIn/Out/InOut`, `bounceOut`, `elasticOut`, `backIn/Out`.

---

## 4.8 Input (keyboard & mouse)

```typescript
import { Input } from '@emptysock/engine';

// Keyboard
if (Input.isDown('ArrowRight')) { /* held */ }
if (Input.isPressed('Space'))   { /* fired once on keydown */ }
if (Input.isReleased('Space'))  { /* fired once on keyup */ }

// Axis (-1..1, works with keyboard WASD/arrows and gamepad sticks)
const h = Input.axis('Horizontal');
const v = Input.axis('Vertical');

// Mouse / pointer
const pos = Input.pointer.position;  // { x, y } in canvas space
const delta = Input.pointer.delta;
if (Input.pointer.isDown(0)) { /* left button held */ }
if (Input.pointer.isPressed(2)) { /* right button just clicked */ }
```

---

## 4.9 Camera

```typescript
import { Camera } from '@emptysock/engine';

Camera.follow(player, { lerp: 0.08, deadzone: { x: 60, y: 30 } });
Camera.stopFollowing();

Camera.shake({ intensity: 8, duration: 0.4 });
Camera.zoom(2.0, { duration: 0.5, ease: 'sineOut' });
Camera.fade({ to: 0x000000, duration: 0.6 });   // fade to black
Camera.fade({ from: 0x000000, duration: 0.6 }); // fade in
```

---

## 4.10 Audio

```typescript
import { Audio } from '@emptysock/engine';

Audio.play('jump_sfx');
Audio.play('footstep', { volume: 0.6, spatial: true, position: entity.position });
Audio.music('level_theme', { loop: true, fade: 0.5 });
Audio.stopMusic({ fade: 0.5 });
Audio.setGroupVolume('sfx', 0.8);   // synced with AudioMixer panel
```

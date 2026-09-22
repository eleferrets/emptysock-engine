# Component

Components are the data and behavior objects that give entities their capabilities. A `Sprite` component draws the entity, a `PhysicsBody` makes it collide, a custom `Health` component tracks hit points.

> **Heads up:** this describes the classic, class-based components. `@emptysock/engine/v2` defines components very differently, as flat, array-backed shapes via `defineComponent(name, defaults, options?)`, with no functions allowed in the data itself. See the [Core API reference](./core-api.md) for that shape.

---

## Conventions

Components in EmptySock are plain TypeScript classes. They do not need to extend any base class. When attached to an entity via `addComponent`, they receive a reference to their owning entity through the framework.

```typescript
// Define a custom component:
export class Health {
  current: number;
  readonly max: number;

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

// Attach and use:
const player = this.createEntity("Player");
player.addComponent(Health, 100);

// Later, in onUpdate:
const health = player.requireComponent(Health);
health.takeDamage(25);
if (health.isDead) {
  this.showGameOver();
  player.destroy();
}
```

---

## Key rules

**One component type per entity slot.** The engine's internal component map is keyed on the component constructor. Adding the same type twice replaces the first one (or throws, depending on configuration). Don't assume two components with different classes but similar logic are distinct slots, check with `hasComponent` before adding.

**No `update()` on components.** Components don't get their own game-loop callback. Game logic that reads and writes component data lives in the scene's `onUpdate()`, not inside the component class itself. That keeps update order explicit and lets the Inspector panel display component data at any time.

**Lookup by exact constructor.** `getComponent(BaseHealth)` will not find a `SpecializedHealth` component even if `SpecializedHealth extends BaseHealth`. Use the exact constructor you passed to `addComponent`. If you need polymorphic access, store a reference to the component when you attach it.

---

## Built-in components

These ship with `@emptysock/engine`:

| Component               | Description                                   |
| ----------------------- | --------------------------------------------- |
| `Transform`             | Position, rotation, scale                     |
| `Sprite`                | 2D texture rendering                          |
| `Animator`              | Spritesheet clip playback — requires `Sprite` |
| `PhysicsBody`           | 2D physics body                               |
| `CharacterController`   | Slope/stair-aware character movement          |
| `ParticleSystem`        | Component-based particle emitter              |
| `VisualScriptComponent` | Runs a `.esvs` graph at runtime               |

For full API details on `PhysicsBody` and `CharacterController`, see [PhysicsSystem2D](./systems/physics-2d.md). For `Animator`, see [systems reference](./systems/physics-2d.md) and the Sequence Editor in the IDE.

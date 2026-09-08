# 10 — TypeScript & JavaScript Language Reference

This section is a self-contained offline reference for TypeScript and JavaScript as used in EmptySock Engine. It covers the language features you will reach for most often when writing game logic, and explains how each feature interacts with the engine's build pipeline. No internet connection is required to use it.

---

## Coming from JavaScript?

If you already know JavaScript, you can start writing EmptySock games immediately. Everything in this reference that uses `const`, `let`, arrow functions, classes, and `async/await` is standard JavaScript — TypeScript is a superset that adds type annotations on top.

The main things to know:
- **Type annotations** like `dt: number` are optional extras that help the IDE catch mistakes. You can omit them and use `.js` files.
- **`override`** before a method is a TypeScript signal meaning "I'm intentionally replacing a method from the parent class." It is not required in `.js` files.
- **Engine-specific rule:** never use `async/await` inside `onUpdate()`. The game loop discards the returned Promise. For multi-frame sequences, use coroutines (`entity.startCoroutine`).

---

## Coming from GML (GameMaker Language)?

If you are migrating from GMS2, the language difference is bigger than the engine difference. Here are the most common adjustments:

| GML habit | EmptySock equivalent | Why this matters |
|-----------|---------------------|-----------------|
| `var x = 5` | `let x = 5` or `const x = 5` | `const` is safer — use it by default |
| `x = 5` (event variable) | `this.x = 5` (class field) | Object state is on `this`, not a local variable scope |
| `show_debug_message(s)` | `console.log(s)` | Appears in the Console panel |
| `alarm[0] = 60` | `Timer.after(1.0, fn)` or `waitFrames(60)` | Timers are time-based, not frame-counted |
| `with (obj_enemy) { ... }` | `this.query(EnemyTag).forEach(e => { ... })` | Query by component type |
| `global.score` | module-level `let score = 0` | Module scope is process-global |
| `instance_create_layer(...)` | `this.createEntity(name)` + `addComponent(...)` | Entities need explicit components |
| `draw_sprite(spr, img, x, y)` | `entity.addComponent(Sprite, { texture: 'spr.png' })` | Drawing is declarative |

For the full GML → TypeScript mapping table and the automated import tool, see **Section 11 — GMS2 Migration Guide**.

---

## 10.1 Which language should I use?

Both TypeScript and JavaScript are fully supported. The esbuild-wasm pipeline that runs inside the IDE handles `.ts`, `.tsx`, `.js`, and `.jsx` files through the same compilation path. You can mix languages freely within one project.

| | TypeScript | JavaScript |
|---|---|---|
| Extension | `.ts` / `.tsx` | `.js` / `.jsx` |
| Type errors caught at | Build time (in the IDE) | Never (types are absent) |
| IDE autocompletion | Full, including engine API | Partial (JSDoc can restore it) |
| Runtime behavior | Identical | Identical |
| Good for | Most projects | Quick prototypes, ports from JS codebases |

The engine's public API (`@emptysock/engine`) ships TypeScript declaration files (`.d.ts`). Even in a `.js` project, Monaco uses those declarations to offer autocompletion.

---

## 10.2 Variables

### `const` and `let`

Always prefer `const`. Use `let` only when you need to reassign the binding. Avoid `var` — it is function-scoped and hoists in ways that produce hard-to-trace bugs.

```typescript
const speed = 200;          // cannot be reassigned
let health = 100;           // can be reassigned
health -= 10;

// var is function-scoped — avoid it
```

### Destructuring

```typescript
const { x, y } = entity.getComponent(Transform);

const [first, ...rest] = entities;

// With defaults
const { tint = 0xffffff } = options;
```

---

## 10.3 Functions

### Regular vs arrow functions

Arrow functions capture `this` from the enclosing scope. Use arrow functions for callbacks passed into engine APIs so that `this` still refers to your class instance.

```typescript
// Regular function — `this` depends on how it is called
function tick() { console.log(this); }

// Arrow function — `this` is captured from the enclosing scope
const tick = () => { console.log(this); };
```

### Default parameters

```typescript
function createEnemy(name: string, health = 100, speed = 80) {
  // health and speed are optional
}
```

### Rest parameters

```typescript
function logAll(...messages: string[]): void {
  messages.forEach(m => console.log(m));
}
```

### Async functions

Async functions return a `Promise` automatically. Use them in `onLoad` (which is awaited by the engine). **Never make `onUpdate` async** — the game loop discards the returned Promise (see Section 9, troubleshooting).

```typescript
override async onLoad(): Promise<void> {
  await this.loadAssets();   // safe — onLoad is awaited
}

override onUpdate(dt: number): void {
  // Never async. Use coroutines for multi-frame work.
}
```

---

## 10.4 Classes

EmptySock game logic lives in classes that extend engine base classes (`Scene`, `Actor`, `Component`).

### Basic class anatomy

```typescript
import { Scene, Entity, Transform } from '@emptysock/engine';

export class GameScene extends Scene {
  private score = 0;

  constructor() {
    super('GameScene');   // pass scene name to parent
  }

  override async onLoad(): Promise<void> {
    const player = this.createEntity('Player');
    player.addComponent(new Transform({ x: 640, y: 360 }));
  }

  override onUpdate(dt: number): void {
    this.score += dt * 10;
  }

  override onDestroy(): void {
    // clean up timers, listeners, systems
  }
}
```

### Access modifiers (TypeScript)

| Modifier | Accessible from |
|---|---|
| `public` (default) | Anywhere |
| `private` | This class only |
| `protected` | This class and subclasses |
| `readonly` | Can be read but not reassigned after construction |

```typescript
class Player {
  public name: string;
  private health: number;
  protected speed: number;
  readonly id: string;

  constructor(id: string) {
    this.id = id;
    this.name = 'Player';
    this.health = 100;
    this.speed = 200;
  }
}
```

### Static members

```typescript
class GameConfig {
  static readonly TARGET_FPS = 60;
  static readonly GRAVITY = 9.8;
}

// Access without instantiating
console.log(GameConfig.TARGET_FPS);
```

### Getters and setters

```typescript
class Health {
  private _value = 100;

  get value(): number { return this._value; }
  set value(v: number) { this._value = Math.max(0, v); }
}
```

---

## 10.5 Types (TypeScript only)

### Primitive types

```typescript
let name: string = 'Player';
let health: number = 100;
let alive: boolean = true;
let nothing: null = null;
let missing: undefined = undefined;
```

### Arrays

```typescript
let scores: number[] = [10, 20, 30];
let names: Array<string> = ['Alice', 'Bob'];
```

### Union types

```typescript
type Result = 'win' | 'lose' | 'draw';
type StringOrNumber = string | number;
```

### Interfaces

```typescript
interface Enemy {
  name: string;
  health: number;
  attack(): void;
}
```

### Type aliases

```typescript
type Vec2 = { x: number; y: number };
type EntityId = string;
```

### Generics

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const top = first([10, 20, 30]); // inferred as number | undefined
```

### Optional and nullable

```typescript
interface Options {
  tint?: number;           // optional — may be undefined
  alpha: number | null;   // required but can be null
}
```

### `as` type assertions

Use sparingly — only when you know more than the compiler.

```typescript
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
```

### Enums

```typescript
enum Direction { Up, Down, Left, Right }

function move(dir: Direction): void { /* ... */ }
move(Direction.Up);
```

---

## 10.6 Control flow

### `if` / `else if` / `else`

```typescript
if (health <= 0) {
  die();
} else if (health < 20) {
  playHurtAnimation();
} else {
  playIdleAnimation();
}
```

### `switch`

```typescript
switch (state) {
  case 'idle':   playIdle(); break;
  case 'run':    playRun();  break;
  case 'attack': playAttack(); break;
  default:       console.warn(`Unknown state: ${state}`);
}
```

### Ternary

```typescript
const label = health > 0 ? 'alive' : 'dead';
```

### Nullish coalescing (`??`)

Returns the right-hand side only when the left is `null` or `undefined`.

```typescript
const name = playerName ?? 'Anonymous';
```

### Optional chaining (`?.`)

Short-circuits to `undefined` if any step in the chain is `null` / `undefined`.

```typescript
const x = entity?.getComponent(Transform)?.x;
```

---

## 10.7 Loops

### `for...of` (recommended for arrays)

```typescript
for (const entity of scene.getEntities()) {
  entity.getComponent(Transform).x += speed * dt;
}
```

### `for` (when you need the index)

```typescript
for (let i = 0; i < enemies.length; i++) {
  enemies[i].update(dt);
}
```

### `while`

```typescript
while (queue.length > 0) {
  process(queue.shift());
}
```

### Array methods (prefer over manual loops)

```typescript
const alive = enemies.filter(e => e.health > 0);
const names = enemies.map(e => e.name);
const total = scores.reduce((sum, s) => sum + s, 0);
enemies.forEach(e => e.update(dt));
const found = enemies.find(e => e.name === 'Boss');
const anyAlive = enemies.some(e => e.health > 0);
const allDead = enemies.every(e => e.health <= 0);
```

---

## 10.8 Objects and spread

```typescript
const base = { x: 0, y: 0, speed: 100 };
const fast = { ...base, speed: 300 };     // override speed
const merged = { ...defaults, ...overrides };
```

### Short-hand properties

```typescript
const x = 10, y = 20;
const point = { x, y };   // same as { x: x, y: y }
```

### Computed keys

```typescript
const key = 'name';
const obj = { [key]: 'Player' };   // { name: 'Player' }
```

---

## 10.9 Modules

All project files are ES modules. Use named exports — the build pipeline tree-shakes unused exports in release mode.

```typescript
// entities/Player.ts
export class Player { /* ... */ }
export const DEFAULT_SPEED = 200;

// scenes/GameScene.ts
import { Player, DEFAULT_SPEED } from '../entities/Player';
import { Scene } from '@emptysock/engine';
```

### Re-exporting

```typescript
// entities/index.ts
export { Player } from './Player';
export { Enemy } from './Enemy';
```

### Dynamic import

Defer loading a module until it is needed. Useful for large optional features.

```typescript
const { LargeSystem } = await import('../systems/LargeSystem');
```

> **Virtual FS note:** Dynamic imports resolve through the IDE's in-memory virtual filesystem. The imported path must be open in the IDE at build time, same as static imports.

---

## 10.10 Promises and async/await

### Creating a Promise

```typescript
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### `async` / `await`

```typescript
async function loadLevel(id: string): Promise<Level> {
  const data = await fetch(`/levels/${id}.json`);
  const json = await data.json() as LevelData;
  return new Level(json);
}
```

### `Promise.all` — run concurrently

```typescript
const [texture, audio] = await Promise.all([
  loadTexture('player.png'),
  loadAudio('jump.ogg'),
]);
```

### `Promise.allSettled` — all results, even failures

```typescript
const results = await Promise.allSettled(tasks);
for (const r of results) {
  if (r.status === 'fulfilled') use(r.value);
  else console.error(r.reason);
}
```

### Error handling

```typescript
try {
  const data = await fetchSaveFile();
} catch (e) {
  if (e instanceof NetworkError) retry();
  else throw e;
}
```

---

## 10.11 Error handling

```typescript
// Throw
throw new Error('Entity not found');

// Custom error
class GameError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'GameError';
  }
}

// Catch
try {
  dangerousOp();
} catch (e) {
  if (e instanceof GameError) console.error(e.code, e.message);
  else throw e;  // re-throw unexpected errors
} finally {
  cleanup();     // always runs
}
```

---

## 10.12 Iterators and generators

Generators let you write multi-step logic that suspends at `yield`. The engine's `Coroutine` system wraps generators — prefer `entity.startCoroutine()` over raw generators in game code. See Section 4.

```typescript
// Raw generator — produces values lazily
function* range(start: number, end: number): Generator<number> {
  for (let i = start; i < end; i++) yield i;
}

for (const n of range(0, 5)) console.log(n);  // 0 1 2 3 4
```

---

## 10.13 Maps and Sets

Prefer `Map` and `Set` over plain objects for collections that need non-string keys, guaranteed insertion order, or fast membership tests.

```typescript
// Map — key/value with any key type
const entityById = new Map<string, Entity>();
entityById.set(entity.id, entity);
const found = entityById.get(someId);
entityById.delete(someId);
entityById.has(someId);   // boolean

// Iterating
for (const [id, entity] of entityById) { /* ... */ }

// Set — unique values
const tags = new Set<string>();
tags.add('player');
tags.add('player');   // duplicate — ignored
tags.has('player');   // true
tags.size;            // 1
```

---

## 10.14 Template literals

```typescript
const name = 'Player';
const hp = 75;

const label = `${name} — HP: ${hp}`;         // string interpolation
const multiline = `
  Line 1
  Line 2
`;                                             // multi-line string
const tag = String.raw`C:\Users\game\save`;   // raw — no escape processing
```

---

## 10.15 Symbols and well-known symbols

Symbols create unique, non-enumerable property keys. Rarely needed in game code but useful for library authors extending engine objects without key collisions.

```typescript
const MY_KEY = Symbol('myKey');
entity[MY_KEY] = 42;   // does not conflict with any string key
```

---

## 10.16 Typed arrays (performance-critical data)

When dealing with large numeric arrays (particle positions, vertex buffers, network packet payloads), use typed arrays. They live in contiguous memory and avoid boxing overhead.

```typescript
const positions = new Float32Array(1000 * 2);  // 1000 (x,y) pairs
for (let i = 0; i < 1000; i++) {
  positions[i * 2]     = Math.random() * 1280; // x
  positions[i * 2 + 1] = Math.random() * 720;  // y
}
```

Common typed arrays:

| Type | Element range | Use |
|---|---|---|
| `Int8Array` | −128 to 127 | Compact signed integers |
| `Uint8Array` | 0 to 255 | Binary data, colors |
| `Uint8ClampedArray` | 0 to 255, clamped | Pixel buffers |
| `Int16Array` | −32768 to 32767 | Audio samples |
| `Uint16Array` | 0 to 65535 | Unsigned indices |
| `Int32Array` | −2³¹ to 2³¹−1 | Signed integers |
| `Uint32Array` | 0 to 2³²−1 | Large indices |
| `Float32Array` | ±3.4×10³⁸ (32-bit) | Positions, UVs |
| `Float64Array` | ±1.8×10³⁰⁸ (64-bit) | High-precision coords |

---

## 10.17 JSDoc (JavaScript type annotations)

If you write `.js` files but want type-checking and better autocompletion, use JSDoc comments. esbuild and Monaco both honour them.

```javascript
/**
 * @param {string} name
 * @param {number} health
 * @returns {import('@emptysock/engine').Entity}
 */
function spawnEnemy(name, health) { /* ... */ }

/** @type {Map<string, number>} */
const scoreBoard = new Map();
```

Importing engine types in JSDoc:

```javascript
/** @param {import('@emptysock/engine').Transform} transform */
function centerTransform(transform) {
  transform.x = 640;
  transform.y = 360;
}
```

---

## 10.18 Common patterns in engine game code

### Scene startup checklist

```typescript
export class MyScene extends Scene {
  private actorSystem!: ActorSystem;
  private physics!: PhysicsSystem;

  override async onLoad(): Promise<void> {
    this.actorSystem = new ActorSystem();
    this.physics = new PhysicsSystem();
    // create entities, load assets
  }

  override onUpdate(dt: number): void {
    this.actorSystem.update(dt);
    this.physics.update(dt);
  }

  override onDestroy(): void {
    this.actorSystem.destroy();
    this.physics.destroy();   // mandatory — frees WASM memory
  }
}
```

### Entity lookup patterns

```typescript
// By tag — returns first match
const player = this.getEntityByTag('player');

// All entities with a tag
const enemies = [...this.getEntities()].filter(e => e.hasTag('enemy'));

// By component type
const withPhysics = [...this.getEntities()]
  .filter(e => e.getComponent(PhysicsBody) !== null);
```

### Coroutine (multi-frame async logic)

```typescript
// Inside an Actor or Scene method
entity.startCoroutine(function*() {
  yield* waitSeconds(2);           // pause 2 seconds
  playExplosion();
  yield* waitFrames(10);           // pause 10 frames
  entity.destroy();
});
```

### Event-style messaging via Actors

```typescript
// Sending
actorSystem.send('enemy-spawner', { type: 'spawn', count: 3 });

// Receiving (inside the Actor)
override receive(msg: unknown): void {
  const m = msg as { type: string; count: number };
  if (m.type === 'spawn') spawnEnemies(m.count);
}
```

---

## 10.19 Language features not available in the engine sandbox

The following are unavailable or behave differently inside the game preview iframe:

| Feature | Status | Reason |
|---|---|---|
| `import()` with URL strings | Works only for virtual-FS paths | No network fetch inside sandbox |
| `fetch()` | Available | Sandbox allows scripts |
| `localStorage` | Available | Persists across reloads |
| `WebSocket` / `WebRTC` | Available | Use via Transport interface |
| `document.createElement` | Available (sandboxed) | iframe is `allow-scripts` only |
| `window.open` | Blocked | `allow-popups` not set |
| `navigator.clipboard` | Blocked | Requires user gesture and origin |
| Worker threads | Not available | `allow-scripts` does not include workers |

> **Tip:** Test platform-specific APIs (clipboard, gamepad vibration, file system) in desktop mode (`pnpm tauri:dev`) rather than the browser preview.

---

## 10.20 esbuild target and supported syntax

The IDE compiles to `es2020`. All syntax in that target is available. Features that require a polyfill or are above `es2020` are transpiled by esbuild automatically when possible.

| Feature | Available |
|---|---|
| Optional chaining `?.` | Yes (es2020) |
| Nullish coalescing `??` | Yes (es2020) |
| Logical assignment `&&=`, `\|\|=`, `??=` | Yes (es2021, transpiled) |
| Top-level `await` | Yes (transpiled to async IIFE) |
| Class fields / private fields (`#x`) | Yes (es2022, transpiled) |
| `Array.at()` | Needs runtime support (Chrome 92+) |
| `Object.hasOwn()` | Needs runtime support (Chrome 93+) |
| Decorators (experimental) | Not supported in this pipeline |

---

*For the full engine API — `Scene`, `Entity`, `Actor`, systems — see Sections 4, 5, and 6.*

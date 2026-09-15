# Tutorial: Build a Mini Platformer

This tutorial builds a complete mini platformer from scratch inside the EmptySock IDE. By the end you will have:

- A scrolling Tilemap level
- A player character with sprite animation, physics, and both keyboard and touch controls
- A camera that follows the player
- Collectible coins tracked with tags
- A HUD showing the coin count
- A sound effect on coin pickup
- Save/load for the coin count across sessions
- Export to web and desktop

Estimated time: 60–90 minutes.

---

## Step 1 — Open the IDE and create the project files

1. Start the IDE (`pnpm dev` from `apps/ide/`, or open the desktop app).
2. In the **Files** panel you will see the default `src/scenes/GameScene.ts`. You will replace this file.
3. Create these additional files in the Files panel:
   - `src/components/CoinPickup.ts`
   - `src/locales/en.json`

---

## Step 2 — Design the level in the Tilemap Editor

Open the **Tilemap Editor** panel (drag it from the panel bar if it is not visible).

1. Add two layers: **Ground** and **Spawns**.
2. On the **Ground** layer, paint a simple platformer layout — a wide floor, several floating platforms, and walls on each side.
3. On the **Spawns** layer, place marker tiles where you want coins to appear.
4. Click **Export** and save the file as `assets/levels/level1.esmap`.
5. Place `level1.esmap` under `apps/ide/public/assets/levels/` so Vite serves it.

---

## Step 3 — Set up the scene skeleton

Replace `src/scenes/GameScene.ts` with:

```typescript
import {
  Scene,
  type SceneConfig,
  Input,
  Audio,
  Camera,
  UISystem,
  TilemapSystem,
  SaveSystem,
  LocalisationSystem,
  Sprite,
  PhysicsBody,
  CharacterController,
  Animator,
} from "@emptysock/engine";
import { z } from "zod";
import { CoinPickup } from "../components/CoinPickup";

const SaveSchema = z.object({ coins: z.number() });
type GameSave = z.infer<typeof SaveSchema>;

export class GameScene extends Scene {
  static readonly config: SceneConfig = { renderMode: "2d", gameSpeed: 60 };

  private _coins = 0;
  private _playerEntity!: ReturnType<Scene["createEntity"]>;
  private _loc!: LocalisationSystem;
  private _touchLeft = false;
  private _touchRight = false;
  private _touchJump = false;

  override async onLoad(): Promise<void> {
    this._loc = new LocalisationSystem();
    const schema = z.record(z.string());
    const en = schema.parse(await (await fetch("assets/i18n/en.json")).json());
    this._loc.addTranslations("en", en);
    this._loc.setLocale("en");

    await Audio.preload("coin_sfx", "assets/sounds/coin.wav");
    await Audio.preload("level_music", "assets/music/level1.ogg");

    await this._loadSave();
    this._buildLevel();
    this._buildPlayer();
    this._buildCamera();

    Audio.music("level_music", { loop: true, fade: 0.5 });
  }

  override onUpdate(dt: number): void {
    this._handlePlayerMovement(dt);
  }

  override onDestroy(): void {
    TilemapSystem.unload("assets/levels/level1.esmap");
  }

  collectCoin(): void {
    this._coins++;
    Audio.play("coin_sfx");
    this._saveCoinCount();
  }
}
```

---

## Step 4 — Load the Tilemap and spawn coins

Add `_buildLevel()` inside the class:

```typescript
private _buildLevel(): void {
  const map = TilemapSystem.load('assets/levels/level1.esmap');
  map.getLayer('Ground').enablePhysics();

  const spawns = map.getLayer('Spawns').entities;
  for (const spawn of spawns) {
    const coin = this.createEntity('Coin');
    coin.addComponent(Sprite, {
      texture: 'assets/sprites/coin.png',
      anchor: { x: 0.5, y: 0.5 },
    });
    coin.position.x = spawn.position.x;
    coin.position.y = spawn.position.y;
    coin.addTag('coin');
    coin.addComponent(CoinPickup, { scene: this });
  }
}
```

---

## Step 5 — Build the player entity

Add `_buildPlayer()` inside the class:

```typescript
private _buildPlayer(): void {
  const player = this.createEntity('Player');
  this._playerEntity = player;

  player.addComponent(Sprite, {
    texture: 'assets/sprites/hero.png',
    anchor: { x: 0.5, y: 1.0 },
  });

  player.addComponent(PhysicsBody, {
    shape: 'capsule',
    bodyType: 'dynamic',
    gravityScale: 1,
    friction: 0.1,
    restitution: 0.0,
  });

  player.addComponent(CharacterController, { slopeAngle: 45 });

  player.addComponent(Animator, {
    spritesheet: 'assets/sprites/hero.esanim',
    defaultClip: 'idle',
  });

  player.position.x = 120;
  player.position.y = 100;
}
```

---

## Step 6 — Player movement (keyboard + touch)

Add `_handlePlayerMovement(dt)` inside the class:

```typescript
private _handlePlayerMovement(dt: number): void {
  const ctrl = this._playerEntity.requireComponent(CharacterController);
  const anim = this._playerEntity.requireComponent(Animator);

  let h = Input.axis('Horizontal');
  if (this._touchLeft)  h = -1;
  if (this._touchRight) h =  1;

  const wantsJump =
    Input.isPressed('Space') ||
    Input.isPressed('ArrowUp') ||
    this._touchJump;

  const speed = 220;
  ctrl.moveAndSlide({ x: h * speed * dt, y: 0 });

  if (wantsJump && ctrl.isOnFloor()) {
    const body = this._playerEntity.requireComponent(PhysicsBody);
    body.applyImpulse({ x: 0, y: -560 });
    this._touchJump = false;
  }

  if (Math.abs(h) > 0.1) {
    this._playerEntity.scale.x = h > 0 ? 1 : -1;
  }

  const clip = !ctrl.isOnFloor()
    ? 'jump'
    : Math.abs(h) > 0.05 ? 'run' : 'idle';
  anim.play(clip);
}
```

> `onUpdate` must not be `async`. Use coroutines for sequenced async work.

---

## Step 7 — Camera follow

Add `_buildCamera()` inside the class:

```typescript
private _buildCamera(): void {
  Camera.follow(this._playerEntity, {
    lerp: 0.08,
    deadzone: { x: 60, y: 30 },
  });
}
```

---

## Step 8 — Coin collectible component

Create `src/components/CoinPickup.ts`:

```typescript
import { Tween } from "@emptysock/engine";
import type { GameScene } from "../scenes/GameScene";

interface CoinPickupOptions {
  scene: GameScene;
}

export class CoinPickup {
  readonly type = "CoinPickup";
  private _scene: GameScene;
  private _collected = false;

  constructor(opts: CoinPickupOptions) {
    this._scene = opts.scene;
  }

  onCollisionEnter(other: {
    entity: { hasTag: (t: string) => boolean };
  }): void {
    if (this._collected) return;
    if (!other.entity.hasTag("player")) return;
    this._collected = true;
    this._scene.collectCoin();
  }
}
```

---

## Step 9 — Localisation file

Create `src/locales/en.json`:

```json
{
  "hud.coins": "Coins: {{n}}"
}
```

---

## Step 10 — Save and load the coin count

Add `_loadSave()` and `_saveCoinCount()` inside the class:

```typescript
private async _loadSave(): Promise<void> {
  const slots = await SaveSystem.listSlots();
  if (!slots.includes('platformer-save')) return;
  try {
    const raw  = await SaveSystem.load('platformer-save');
    const data = SaveSchema.parse(raw.data) as GameSave;
    this._coins = data.coins;
  } catch {
    this._coins = 0;
  }
}

private _saveCoinCount(): void {
  SaveSystem.save('platformer-save', { coins: this._coins }).catch(() => undefined);
}
```

---

## Step 11 — Play it

Press **Play** (or `Ctrl+Enter`) in the IDE.

- **Keyboard:** Arrow keys to move, Space to jump.
- Walk over a coin to collect it. The coin count is saved.
- Reload the page — the coin count persists.

---

## Step 12 — Export

**Web:**

```bash
pnpm emptysock-toolchain export --platform web \
  --entry src/scenes/GameScene.ts --out dist/platformer
```

**Desktop (Linux):**

```bash
pnpm emptysock-toolchain export --platform linux --format appimage \
  --entry src/scenes/GameScene.ts --out dist/platformer
```

**Desktop (Windows):**

```bash
pnpm emptysock-toolchain export --platform windows --format installer \
  --entry src/scenes/GameScene.ts --out dist/platformer
```

---

## What you practised

| Concept                                             | Where                         |
| --------------------------------------------------- | ----------------------------- |
| Scene lifecycle                                     | GameScene skeleton            |
| TilemapSystem — load, physics layer, spawn entities | `_buildLevel`                 |
| PhysicsBody + CharacterController                   | `_buildPlayer`                |
| Sprite + Animator                                   | `_buildPlayer`                |
| Keyboard input                                      | `_handlePlayerMovement`       |
| Camera follow with deadzone                         | `_buildCamera`                |
| Entity tags                                         | `coin.addTag('coin')`         |
| CoinPickup component                                | `CoinPickup.ts`               |
| LocalisationSystem                                  | `en.json`, `loc.t()`          |
| Audio — SFX and background music                    | `onLoad`                      |
| SaveSystem with Zod validation                      | `_loadSave`, `_saveCoinCount` |
| Export pipeline                                     | Step 12                       |

From here you can extend the game: add enemies with ActorSystem and NavMeshSystem, add a goal door with `SceneManager.transition`, or add particle effects on coin pickup with ParticleSystem.

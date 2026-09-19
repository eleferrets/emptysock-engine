# 12 — Tutorial: Build a Mini Platformer

This tutorial builds a complete mini platformer from scratch inside the EmptySock IDE. By the end you will have:

- A scrolling tilemap level
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
   - `src/scenes/GameScene.ts` (edit existing)
   - `src/components/CoinPickup.ts`
   - `src/locales/en.json`

---

## Step 2 — Design the level in the TilemapEditor

Open the **TilemapEditor** panel (drag it from the panel bar if it is not visible).

1. Add two layers: **Ground** and **Spawns**.
2. On the **Ground** layer, paint a simple platformer layout — a wide floor, several floating platforms, and walls on each side.
3. On the **Spawns** layer, place marker tiles (any colour) where you want coins to appear. Name the tile property `type = coin` if your tileset supports it; otherwise you will position coins manually in code.
4. Click **Export** and save the file as `assets/levels/level1.esmap`.
5. Place `level1.esmap` under `apps/ide/public/assets/levels/` so Vite serves it.

---

## Step 3 — Set up PhysicsSystem and load the tilemap

Replace `src/scenes/GameScene.ts` with the following skeleton. You will add methods to it in the steps that follow.

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
  i18n,
} from "@emptysock/engine";
import { z } from "zod";
import { CoinPickup } from "../components/CoinPickup";

const SaveSchema = z.object({ coins: z.number() });
type GameSave = z.infer<typeof SaveSchema>;

export class GameScene extends Scene {
  static readonly config: SceneConfig = { renderMode: "2d", gameSpeed: 60 };

  // --- private state ---
  private _coins = 0;
  private _playerEntity!: ReturnType<Scene["createEntity"]>;
  private _ui!: UISystem;
  private _coinLabel!: ReturnType<UISystem["createLabel"]>;
  private _touchLeft = false;
  private _touchRight = false;
  private _touchJump = false;

  override async onLoad(): Promise<void> {
    await i18n.load("en", () => import("../locales/en.json"));
    i18n.setLocale("en");

    await Audio.preload("coin_sfx", "assets/sounds/coin.wav");
    await Audio.preload("level_music", "assets/music/level1.ogg");

    this._loadSave();
    this._buildLevel();
    this._buildPlayer();
    this._buildCamera();
    this._buildUI();
    this._buildTouchButtons();

    Audio.music("level_music", { loop: true, fade: 0.5 });
  }

  override onUpdate(dt: number): void {
    this._handlePlayerMovement(dt);
    this._checkCoinPickups();
    this._updateUI();
  }

  override onDestroy(): void {
    TilemapSystem.unload("assets/levels/level1.esmap");
    this._ui.destroy();
  }

  // --- called by CoinPickup when the player overlaps a coin ---
  collectCoin(): void {
    this._coins++;
    Audio.play("coin_sfx");
    this._saveCoinCount();
  }
}
```

---

## Step 4 — Load the tilemap and spawn coins

Add `_buildLevel()` inside the class:

```typescript
private _buildLevel(): void {
  const map = TilemapSystem.load('assets/levels/level1.esmap')

  // Enable physics colliders on the Ground layer
  map.getLayer('Ground').enablePhysics()

  // Spawn coin entities from the Spawns layer
  const spawns = map.getLayer('Spawns').entities
  for (const spawn of spawns) {
    const coin = this.createEntity('Coin')
    coin.addComponent(Sprite, {
      texture: 'assets/sprites/coin.png',
      anchor: { x: 0.5, y: 0.5 },
    })
    coin.position.x = spawn.position.x
    coin.position.y = spawn.position.y
    coin.addTag('coin')
    coin.addComponent(CoinPickup, { scene: this })
  }
}
```

> If your tileset does not support spawn markers, replace the loop with hard-coded positions:
>
> ```typescript
> const coinPositions = [
>   { x: 200, y: 300 },
>   { x: 500, y: 200 },
>   { x: 800, y: 400 },
> ];
> for (const pos of coinPositions) {
>   const coin = this.createEntity("Coin");
>   // ... (same as above, set coin.position from pos)
> }
> ```

---

## Step 5 — Build the player entity

Add these imports at the top of `GameScene.ts`:

```typescript
import {
  Sprite,
  PhysicsBody,
  CharacterController,
  Animator,
} from "@emptysock/engine";
```

Add `_buildPlayer()` inside the class:

```typescript
private _buildPlayer(): void {
  const player = this.createEntity('Player')
  this._playerEntity = player

  player.addComponent(Sprite, {
    texture: 'assets/sprites/hero.png',
    anchor: { x: 0.5, y: 1.0 },  // pivot at feet for accurate ground contact
  })

  player.addComponent(PhysicsBody, {
    shape: 'capsule',
    bodyType: 'dynamic',
    gravityScale: 1,
    friction: 0.1,
    restitution: 0.0,
  })

  player.addComponent(CharacterController, { slopeAngle: 45 })

  player.addComponent(Animator, {
    spritesheet: 'assets/sprites/hero.esanim',
    defaultClip: 'idle',
  })

  // Spawn at top-left of level
  player.position.x = 120
  player.position.y = 100
}
```

---

## Step 6 — Player movement (keyboard + touch)

Add `_handlePlayerMovement(dt)` inside the class:

```typescript
private _handlePlayerMovement(dt: number): void {
  const ctrl = this._playerEntity.requireComponent(CharacterController)
  const anim = this._playerEntity.requireComponent(Animator)

  // Combine keyboard and touch axis
  let h = Input.axis('Horizontal')
  if (this._touchLeft)  h = -1
  if (this._touchRight) h =  1

  const wantsJump =
    Input.isPressed('Space') ||
    Input.isPressed('ArrowUp') ||
    this._touchJump

  // Apply movement
  const speed = 220
  const vy    = ctrl.isGrounded() ? 0 : undefined  // let gravity drive vertical

  ctrl.moveAndSlide({ x: h * speed * dt, y: vy ?? 0 })

  if (wantsJump && ctrl.isGrounded()) {
    ctrl.jump(560)
    this._touchJump = false  // consume the touch jump so it fires once
  }

  // Flip sprite toward movement direction
  if (Math.abs(h) > 0.1) {
    this._playerEntity.scale.x = h > 0 ? 1 : -1
  }

  // Animate
  const clip = !ctrl.isGrounded()
    ? 'jump'
    : Math.abs(h) > 0.05 ? 'run' : 'idle'
  anim.play(clip)
}
```

> `onUpdate` must not be `async`. Gravity is handled internally by `CharacterController` when `isGrounded()` is false — you do not need to accumulate a `vy` manually unless you want custom gravity. If you do, track it in a class field and pass it as the `y` component of `moveAndSlide`.

---

## Step 7 — Camera follow

Add `_buildCamera()` inside the class:

```typescript
private _buildCamera(): void {
  this._camera.setFollow(() => this._playerEntity.position)
  this._camera.setLerpFactor(0.08)
  // Constrain camera to level bounds (in pixels — match your tilemap size)
  this._camera.setBounds({ minX: 0, minY: 0, maxX: 3200, maxY: 900 })
}
```

---

## Step 8 — Coin collectible component

Create `src/components/CoinPickup.ts`:

```typescript
import { type Component, PhysicsBody, Tween } from "@emptysock/engine";
import type { GameScene } from "../scenes/GameScene";

interface CoinPickupOptions {
  scene: GameScene;
}

export class CoinPickup implements Component {
  private _scene: GameScene;
  private _collected = false;

  constructor(opts: CoinPickupOptions) {
    this._scene = opts.scene;
  }

  // Called each frame by the engine because it is on an entity
  update(dt: number): void {
    if (this._collected) return;

    const player = this._scene.findEntityByName("Player");
    if (!player) return;

    // Simple AABB overlap check
    const coin = this.entity;
    const dx = Math.abs(coin.position.x - player.position.x);
    const dy = Math.abs(coin.position.y - player.position.y);
    if (dx < 28 && dy < 28) {
      this._collected = true;
      this._scene.collectCoin();
      // Pop-and-fade the coin sprite
      Tween.to(
        coin,
        { y: coin.position.y - 40 },
        { duration: 0.25, ease: "sineOut" },
      );
      Tween.to(
        coin,
        { alpha: 0 },
        {
          duration: 0.25,
          ease: "sineIn",
          onComplete: () => coin.destroy(),
        },
      );
    }
  }

  // The engine attaches 'entity' automatically when the component is added
  entity!: ReturnType<import("@emptysock/engine").Scene["createEntity"]>;
}
```

---

## Step 9 — UI (coin count HUD)

Prepare the localisation file `src/locales/en.json`:

```json
{
  "hud.coins": "Coins: {{n}}"
}
```

Add `_buildUI()` inside the class:

```typescript
private _buildUI(): void {
  this._ui = new UISystem()

  const panel = this._ui.createPanel({
    x: 16, y: 16,
    width: 180, height: 36,
  })

  this._coinLabel = this._ui.createLabel({
    parent: panel,
    text: i18n.t('hud.coins', { n: this._coins }),
    color: '#fff',
  })

  this.setUI(this._ui)  // engine renders ui.render() for you each frame
}

private _updateUI(): void {
  this._coinLabel.setText(i18n.t('hud.coins', { n: this._coins }))
}
```

---

## Step 10 — On-screen touch buttons for mobile

Add `_buildTouchButtons()` inside the class. Touch buttons sit on top of the game canvas and feed flags that `_handlePlayerMovement` reads:

```typescript
private _buildTouchButtons(): void {
  const leftBtn = this._ui.createButton({
    text: '◀',
    x: 24, y: -96,      // bottom-left; negative y anchors from the bottom
    width: 72, height: 72,
    onClick: () => { /* handled by touch down/up below */ },
  })

  const rightBtn = this._ui.createButton({
    text: '▶',
    x: 112, y: -96,
    width: 72, height: 72,
    onClick: () => { /* handled by touch down/up below */ },
  })

  const jumpBtn = this._ui.createButton({
    text: '▲',
    x: -112, y: -96,   // bottom-right
    width: 72, height: 72,
    onClick: () => { /* handled by touch down/up below */ },
  })

  leftBtn.onPointerDown  = () => { this._touchLeft  = true  }
  leftBtn.onPointerUp    = () => { this._touchLeft  = false }
  rightBtn.onPointerDown = () => { this._touchRight = true  }
  rightBtn.onPointerUp   = () => { this._touchRight = false }
  jumpBtn.onPointerDown  = () => { this._touchJump  = true  }
  jumpBtn.onPointerUp    = () => { this._touchJump  = false }
}
```

> Touch buttons also respond to mouse pointer events, so they work in the browser preview without needing a touchscreen.

---

## Step 11 — Save and load the coin count

Add `_loadSave()` and `_saveCoinCount()` inside the class:

```typescript
private _loadSave(): void {
  SaveSystem.listSlots().then(async (slots) => {
    if (!slots.includes('platformer-save')) return
    try {
      const raw  = await SaveSystem.load('platformer-save')
      const data = SaveSchema.parse(raw.data) as GameSave
      this._coins = data.coins
    } catch {
      // Corrupt or missing save — start fresh
      this._coins = 0
    }
  })
}

private _saveCoinCount(): void {
  // Fire-and-forget; errors are non-fatal
  SaveSystem.save('platformer-save', { coins: this._coins }).catch(() => undefined)
}
```

---

## Step 12 — Check coin pickups

`CoinPickup.update()` already handles overlap detection and calls `scene.collectCoin()`. The `_checkCoinPickups()` method in `onUpdate` is a hook for any frame-level coin logic beyond what the component handles (e.g., visual feedback effects). For this tutorial it can be left empty:

```typescript
private _checkCoinPickups(): void {
  // Pickup logic is handled by CoinPickup component on each coin entity.
  // Add additional frame-level effects here if needed.
}
```

---

## Step 13 — Play it

Press **Play** (or `Ctrl+Enter`) in the IDE. The player appears in the Canvas Preview panel.

- **Keyboard:** Arrow keys to move, Space to jump.
- **Touch / mobile browser:** Use the on-screen buttons at the bottom of the canvas.
- Walk over a coin to collect it. The HUD updates and the count is saved.
- Reload the page — the coin count persists.

---

## Step 14 — Export

**Web (PWA / itch.io):**

```bash
pnpm emptysock-toolchain export --platform web --entry src/scenes/GameScene.ts --out dist/platformer
```

This produces a self-contained `index.html` + assets directory. Upload the `dist/platformer/` folder to any static host.

**Desktop (Linux AppImage):**

```bash
pnpm emptysock-toolchain export --platform linux --format appimage --entry src/scenes/GameScene.ts --out dist/platformer
```

**Desktop (Windows installer):**

```bash
pnpm emptysock-toolchain export --platform windows --format installer --entry src/scenes/GameScene.ts --out dist/platformer
```

---

## What you practised

| Concept                                             | Where                                         |
| --------------------------------------------------- | --------------------------------------------- |
| Scene lifecycle (`onLoad`, `onUpdate`, `onDestroy`) | GameScene skeleton                            |
| TilemapSystem — load, physics layer, spawn entities | `_buildLevel`                                 |
| PhysicsBody + CharacterController                   | `_buildPlayer`                                |
| Sprite + Animator                                   | `_buildPlayer`                                |
| Keyboard and touch input                            | `_handlePlayerMovement`, `_buildTouchButtons` |
| Camera follow with deadzone and bounds              | `_buildCamera`                                |
| Entity tags for coin identification                 | `coin.addTag('coin')`                         |
| CoinPickup component with Tween feedback            | `CoinPickup.ts`                               |
| UISystem — label HUD                                | `_buildUI`, `_updateUI`                       |
| Localisation with `i18n`                            | `en.json`, `i18n.t()`                         |
| AudioSystem — SFX and background music              | `onLoad`                                      |
| SaveSystem — slot save/load with Zod validation     | `_loadSave`, `_saveCoinCount`                 |
| Export pipeline                                     | Step 14                                       |

From here you can extend the game: add enemies (Actor Model + NavMesh), add a goal door that loads the next scene (`SceneManager.transition`), or add particle effects on coin pickup (ParticleSystem burst).

# Tutorial: Build a Pong Clone

This tutorial builds a complete, playable Pong clone from scratch inside the EmptySock IDE. By the end you will have:

- Two paddles controlled by keyboard
- A bouncing ball with increasing speed
- A score display
- A sound effect on bounce
- An Actor-driven score system
- A Game Over screen

Estimated time: 30–45 minutes.

---

## Step 1 — Open the IDE and create the project files

1. Start the IDE (`pnpm dev` from `apps/ide/`, or open the desktop app).
2. In the **Files** panel, you will see the default `src/scenes/GameScene.ts`. You will edit this file.
3. Create a second file: click **+ File** in the Files panel, name it `src/actors/ScoreActor.ts`.

---

## Step 2 — Define game constants

At the top of `GameScene.ts`, add constants so magic numbers are in one place:

```typescript
const W = 800;
const H = 600;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 8;
const PADDLE_SPEED = 400; // px/s
const BALL_SPEED_INIT = 280; // px/s
const BALL_SPEED_MAX = 600; // px/s
const SPEED_INCREMENT = 20; // added on each bounce
```

---

## Step 3 — Write the ScoreActor

In `src/actors/ScoreActor.ts`:

```typescript
import { Actor, type Message } from "@emptysock/engine";

export type ScoreMessage = { type: "SCORE"; player: 1 | 2 } | { type: "RESET" };

export class ScoreActor extends Actor {
  private _scores: [number, number] = [0, 0];
  private _onChange: (s: [number, number]) => void;

  constructor(id: string, onChange: (s: [number, number]) => void) {
    super(id);
    this._onChange = onChange;
  }

  receive(msg: Message): void {
    const m = msg as unknown as ScoreMessage;
    if (m.type === "SCORE") {
      this._scores[m.player - 1]++;
      this._onChange([...this._scores] as [number, number]);
    } else if (m.type === "RESET") {
      this._scores = [0, 0];
      this._onChange([0, 0]);
    }
  }

  get scores(): [number, number] {
    return this._scores;
  }
}
```

---

## Step 4 — Set up the scene skeleton

Replace `src/scenes/GameScene.ts` with:

```typescript
import { Scene, InputSystem, Audio, ActorSystem } from "@emptysock/engine";
import { ScoreActor } from "../actors/ScoreActor";

const W = 800,
  H = 600;
const PADDLE_W = 12,
  PADDLE_H = 80;
const BALL_R = 8;
const PADDLE_SPEED = 400;
const BALL_SPEED_INIT = 280,
  BALL_SPEED_MAX = 600,
  SPEED_INCREMENT = 20;

type GameState = "playing" | "over";

export class GameScene extends Scene {
  private _p1 = { x: 20, y: H / 2 };
  private _p2 = { x: W - 20 - PADDLE_W, y: H / 2 };
  private _ball = {
    x: W / 2,
    y: H / 2,
    vx: BALL_SPEED_INIT,
    vy: BALL_SPEED_INIT * 0.7,
  };
  private _canvas!: HTMLCanvasElement;
  private _ctx!: CanvasRenderingContext2D;
  private _actorSystem!: ActorSystem;
  private _scoreActor!: ScoreActor;
  private _scores: [number, number] = [0, 0];
  private _state: GameState = "playing";

  override async onLoad(): Promise<void> {
    this._canvas = document.createElement("canvas");
    this._canvas.width = W;
    this._canvas.height = H;
    document.body.appendChild(this._canvas);
    this._ctx = this._canvas.getContext("2d") as CanvasRenderingContext2D;

    this._actorSystem = new ActorSystem();
    this._scoreActor = new ScoreActor("score", (s) => {
      this._scores = s;
      if (s[0] >= 7 || s[1] >= 7) this._state = "over";
    });
    this._actorSystem.register(this._scoreActor);
  }

  override onUpdate(dt: number): void {
    if (this._state === "over") {
      this._drawGameOver();
      return;
    }
    this._movePaddles(dt);
    this._moveBall(dt);
    this._actorSystem.update(dt);
    this._draw();
  }

  override onDestroy(): void {
    this._actorSystem.destroy();
    this._canvas.remove();
  }
}
```

---

## Step 5 — Paddle movement

Add `_movePaddles(dt)` inside the class:

```typescript
private _movePaddles(dt: number): void {
  // Player 1: W/S keys
  if (InputSystem.isDown('KeyW')) this._p1.y -= PADDLE_SPEED * dt;
  if (InputSystem.isDown('KeyS')) this._p1.y += PADDLE_SPEED * dt;

  // Player 2: ArrowUp/ArrowDown
  if (InputSystem.isDown('ArrowUp'))   this._p2.y -= PADDLE_SPEED * dt;
  if (InputSystem.isDown('ArrowDown')) this._p2.y += PADDLE_SPEED * dt;

  const clamp = (y: number) => Math.max(0, Math.min(H - PADDLE_H, y));
  this._p1.y = clamp(this._p1.y);
  this._p2.y = clamp(this._p2.y);
}
```

---

## Step 6 — Ball physics

Add `_moveBall(dt)` inside the class:

```typescript
private _moveBall(dt: number): void {
  const b = this._ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
  if (b.y + BALL_R > H) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy); }

  const hitPaddle = (px: number, py: number): boolean =>
    b.x - BALL_R < px + PADDLE_W && b.x + BALL_R > px &&
    b.y - BALL_R < py + PADDLE_H && b.y + BALL_R > py;

  if (hitPaddle(this._p1.x, this._p1.y) && b.vx < 0) {
    b.vx = Math.min(Math.abs(b.vx) + SPEED_INCREMENT, BALL_SPEED_MAX);
    const relY = (b.y - (this._p1.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    b.vy = relY * Math.abs(b.vx) * 0.75;
    Audio.play('bounce_sfx');
  }

  if (hitPaddle(this._p2.x, this._p2.y) && b.vx > 0) {
    b.vx = -Math.min(Math.abs(b.vx) + SPEED_INCREMENT, BALL_SPEED_MAX);
    const relY = (b.y - (this._p2.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    b.vy = relY * Math.abs(b.vx) * 0.75;
    Audio.play('bounce_sfx');
  }

  if (b.x < 0) { this._actorSystem.send('score', { type: 'SCORE', player: 2 }); this._resetBall(-1); }
  if (b.x > W) { this._actorSystem.send('score', { type: 'SCORE', player: 1 }); this._resetBall(1); }
}

private _resetBall(dirX: -1 | 1): void {
  this._ball = { x: W / 2, y: H / 2, vx: dirX * BALL_SPEED_INIT, vy: BALL_SPEED_INIT * 0.7 };
}
```

---

## Step 7 — Drawing

Add `_draw()` and `_drawGameOver()` inside the class:

```typescript
private _draw(): void {
  const ctx = this._ctx;
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#fff';
  ctx.fillRect(this._p1.x, this._p1.y, PADDLE_W, PADDLE_H);
  ctx.fillRect(this._p2.x, this._p2.y, PADDLE_W, PADDLE_H);

  ctx.beginPath();
  ctx.arc(this._ball.x, this._ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center';
  ctx.fillText(String(this._scores[0]), W / 2 - 60, 60);
  ctx.fillText(String(this._scores[1]), W / 2 + 60, 60);
}

private _drawGameOver(): void {
  const ctx = this._ctx;
  ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
  const winner = this._scores[0] >= 7 ? 'Player 1' : 'Player 2';
  ctx.font = '32px monospace';
  ctx.fillText(`${winner} wins!`, W / 2, H / 2 + 20);
  ctx.font = '20px monospace'; ctx.fillStyle = '#888';
  ctx.fillText('Press R to restart', W / 2, H / 2 + 70);

  if (InputSystem.isPressed('KeyR')) this._restart();
}

private _restart(): void {
  this._actorSystem.send('score', { type: 'RESET' });
  this._scores = [0, 0];
  this._state = 'playing';
  this._resetBall(1);
  this._p1.y = H / 2;
  this._p2.y = H / 2;
}
```

---

## Step 8 — Play it

Press **Play** (or `Ctrl+Enter`) in the IDE. The Pong game appears in the Canvas Preview panel.

- **Player 1:** W / S keys
- **Player 2:** ↑ / ↓ arrow keys
- First to 7 wins. Press **R** to restart.

---

## Step 9 — Add a sound effect

Wire in a real sound in `onLoad()`:

```typescript
await Audio.preload("bounce_sfx", "assets/sounds/bounce.wav");
```

Drop a `bounce.wav` into `apps/ide/public/assets/sounds/`. The Vite dev server serves `public/` at the root.

---

## Step 10 — Export

```bash
pnpm emptysock-toolchain export --platform linux --format appimage \
  --entry src/scenes/GameScene.ts --out dist/pong

pnpm emptysock-toolchain export --platform windows --format installer \
  --entry src/scenes/GameScene.ts --out dist/pong
```

---

## What you practised

| Concept                                                     | Where                      |
| ----------------------------------------------------------- | -------------------------- |
| Scene lifecycle (`onLoad`, `onUpdate`, `onDestroy`)         | GameScene skeleton         |
| Frame-accurate keyboard input                               | `_movePaddles`             |
| Manual physics (velocity, AABB collision, angle reflection) | `_moveBall`                |
| Actor Model (message passing, no shared state)              | ScoreActor                 |
| `ActorSystem.send()` and `update()` in game loop            | GameScene                  |
| Canvas 2D rendering                                         | `_draw()`                  |
| Audio playback                                              | `Audio.play('bounce_sfx')` |
| Export pipeline                                             | Step 10                    |

From here you can extend the game: add a serving animation (Animator), add AI for Player 2, or make it multiplayer by attaching a `Transport` to the ScoreActor.

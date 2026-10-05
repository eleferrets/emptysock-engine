import { Application, Graphics, Container } from "pixi.js";

interface Ball {
  graphics: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  trailAlpha: number;
}

const COLORS = [
  0x7c6af7, // violet
  0x60a5fa, // blue
  0x4ade80, // green
  0xfacc15, // yellow
  0xf87171, // red
  0xfb923c, // orange
  0x34d399, // emerald
  0xa78bfa, // purple
];

export class BouncingBallsDemo {
  private app: Application | null = null;
  private balls: Ball[] = [];
  private container: Container | null = null;
  private fpsCallback: ((fps: number) => void) | null = null;
  private fpsBuffer: number[] = [];
  /**
   * Inits and teardowns of every demo run one after another. A strict-mode
   * remount destroys the first demo while pixi is still initialising, and two
   * renderers on one canvas (or a global release under a live one) leave the
   * preview blank.
   */
  private static queue: Promise<unknown> = Promise.resolve();
  private started: Promise<void> = Promise.resolve();

  init(canvas: HTMLCanvasElement, onFps: (fps: number) => void): Promise<void> {
    const run = BouncingBallsDemo.queue.then(() => this.start(canvas, onFps));
    this.started = run;
    BouncingBallsDemo.queue = run.catch(() => undefined);
    return run;
  }

  private async start(
    canvas: HTMLCanvasElement,
    onFps: (fps: number) => void,
  ): Promise<void> {
    this.fpsCallback = onFps;

    const app = new Application();
    this.app = app;
    await app.init({
      canvas,
      resizeTo: canvas.parentElement ?? canvas,
      backgroundColor: 0x0e0e10,
      antialias: true,
      resolution: window.devicePixelRatio,
      autoDensity: true,
      preference: ["webgpu", "webgl"],
      powerPreference: "high-performance",
    });

    this.container = new Container();
    app.stage.addChild(this.container);

    this.spawnBalls(18);

    app.ticker.add(this.update);
  }

  private spawnBalls(count: number): void {
    if (this.app === null || this.container === null) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;

    for (let i = 0; i < count; i++) {
      const radius = 12 + Math.random() * 22;
      const color = COLORS[i % COLORS.length] as number;
      const g = new Graphics();
      this.drawBall(g, radius, color);

      const ball: Ball = {
        graphics: g,
        x: radius + Math.random() * (w - radius * 2),
        y: radius + Math.random() * (h - radius * 2),
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        radius,
        color,
        trailAlpha: 0.6 + Math.random() * 0.4,
      };

      g.x = ball.x;
      g.y = ball.y;
      this.container.addChild(g);
      this.balls.push(ball);
    }
  }

  private drawBall(g: Graphics, radius: number, color: number): void {
    g.clear();
    // Outer glow
    g.circle(0, 0, radius + 4);
    g.fill({ color, alpha: 0.15 });
    // Main body
    g.circle(0, 0, radius);
    g.fill({ color, alpha: 1 });
    // Highlight
    g.circle(-radius * 0.3, -radius * 0.3, radius * 0.28);
    g.fill({ color: 0xffffff, alpha: 0.35 });
  }

  private readonly update = (ticker: {
    deltaTime: number;
    deltaMS: number;
    FPS: number;
  }): void => {
    if (this.app === null || this.container === null) return;

    const dt = ticker.deltaMS / 1000; // seconds
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    for (const ball of this.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Bounce off walls
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.radius > w) {
        ball.x = w - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }

      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y + ball.radius > h) {
        ball.y = h - ball.radius;
        ball.vy = -Math.abs(ball.vy);
      }

      ball.graphics.x = ball.x;
      ball.graphics.y = ball.y;

      // Slight rotation for visual interest
      ball.graphics.rotation += dt * 0.5;
    }

    // FPS tracking
    this.fpsBuffer.push(ticker.FPS);
    if (this.fpsBuffer.length > 30) this.fpsBuffer.shift();
    if (this.fpsCallback !== null) {
      const avg =
        this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length;
      this.fpsCallback(Math.round(avg));
    }
  };

  resize(): void {
    // Handled by resizeTo
  }

  /** Tears the demo down once its init (if still running) has finished. */
  destroy(): void {
    const teardown = this.started
      .catch(() => undefined)
      .then(() => {
        const app = this.app;
        this.app = null;
        this.balls = [];
        if (app === null || this.container === null) return;
        app.ticker.remove(this.update);
        app.destroy({ releaseGlobalResources: true });
        this.container = null;
      });
    BouncingBallsDemo.queue = BouncingBallsDemo.queue.then(() => teardown);
  }
}

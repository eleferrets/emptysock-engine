import {
  CameraSystem,
  Game,
  RenderPipeline,
  ViewportSystem,
} from "@emptysock/engine";
import { GameScene } from "./scenes/GameScene";

async function main(): Promise<void> {
  // RenderPipeline is the only rendering setup a game needs: any entity with
  // Transform + Sprite is drawn automatically, on the layer/depth the Sprite
  // component asks for. There is no separate step to hand it PixiJS objects.
  const renderPipeline = new RenderPipeline();
  await renderPipeline.init({
    width: 1280,
    height: 720,
    backgroundColor: 0x1a1a2e,
  });
  document.body.appendChild(renderPipeline.canvas);

  const camera = new CameraSystem();
  camera.attach(renderPipeline.stage);

  // Game owns input, audio, physics (created per scene), actors and the fixed
  // per-frame update order. Attaching the renderer makes Game.update() draw.
  const game = Game.create();
  game.attachRenderer(renderPipeline);
  game.input.attach(window);

  // ViewportSystem letterboxes the 1280x720 design resolution into whatever
  // size the browser window (or, in Tauri, the WebView) actually gives us,
  // and keeps RenderPipeline + CameraSystem in sync on resize/orientation
  // change — no manual resize listener required.
  game.services
    .get(ViewportSystem)
    .init(
      { designWidth: 1280, designHeight: 720, scaleMode: "fit" },
      { renderTarget: renderPipeline, cameraSystem: camera },
    );

  await game.loadScene(GameScene);

  let lastTime = performance.now();

  function loop(now: number): void {
    const deltaTime = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = now;

    game.update(deltaTime);
    camera.update(deltaTime);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);

import {
  RenderPipeline,
  PhysicsSystem,
  InputSystem,
  AudioSystem,
  SceneManager,
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

  const physics = new PhysicsSystem();
  await physics.init({
    gravity: { x: 0, y: -200 },
  });

  const input = new InputSystem();
  input.attach(window);

  const audio = new AudioSystem();
  audio.masterVolume = 1;

  document.body.appendChild(renderPipeline.canvas);

  SceneManager.register("game", () => new GameScene());
  SceneManager.load("game");

  let lastTime = performance.now();

  function loop(now: number): void {
    const deltaTime = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = now;

    physics.step(deltaTime);
    SceneManager.update(deltaTime);
    const scene = SceneManager.current;
    if (scene !== null) {
      physics.syncToTransforms(scene.getEntities().values());
      renderPipeline.renderFrame(scene);
    }
    input.flush();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);

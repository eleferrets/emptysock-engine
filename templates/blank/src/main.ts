import { RenderSystem, PhysicsSystem, InputSystem, AudioSystem } from '@emptysock/engine';
import { GameScene } from './scenes/GameScene';

async function main(): Promise<void> {
  // Initialize systems
  const render = new RenderSystem();
  await render.init({
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

  // Mount canvas
  document.body.appendChild(render.canvas);

  // Load scene
  const scene = new GameScene(render.stage);
  scene.start();

  // Game loop
  let lastTime = performance.now();

  function loop(now: number): void {
    const deltaTime = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = now;

    physics.step(deltaTime);
    scene.update(deltaTime);
    render.render();
    input.flush();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);

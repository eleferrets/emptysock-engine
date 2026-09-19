import { Scene, Transform, Sprite } from "@emptysock/engine";

export class GameScene extends Scene {
  constructor() {
    super("GameScene");
  }

  override onStart(): void {
    // Create a basic entity to get started. Transform + Sprite is the whole
    // contract for "this shows up on screen" — RenderPipeline picks it up
    // automatically, no manual PixiJS wiring required.
    const player = this.createEntity("Player");
    player.addComponent(new Transform({ x: 640, y: 360 }));
    player.addComponent(new Sprite({ tint: 0x7c6af7 }));
    player.addTag("player");

    console.log(
      "[GameScene] started — edit src/scenes/GameScene.ts to build your game",
    );
  }
}

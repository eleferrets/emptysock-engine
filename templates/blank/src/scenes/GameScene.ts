import { Sprite, Transform, defineScene } from "@emptysock/engine";

export const GameScene = defineScene({
  onLoad(scene) {
    // Create a basic entity to get started. Transform + Sprite is the whole
    // contract for "this shows up on screen" — RenderPipeline picks it up
    // automatically, no manual PixiJS wiring required.
    const player = scene.spawn("Player");
    player.add(Transform, { x: 640, y: 360 });
    player.add(Sprite, { tint: 0x7c6af7 });

    console.log(
      "[GameScene] started — edit src/scenes/GameScene.ts to build your game",
    );
  },
});

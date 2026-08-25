import { Scene, Entity, Transform, Sprite } from '@emptysock/engine';
import type { Container } from 'pixi.js';

export class GameScene extends Scene {
  private readonly _stage: Container;

  constructor(stage: Container) {
    super('GameScene');
    this._stage = stage;
  }

  override start(): void {
    super.start();

    // Create a basic entity to get started
    const player = this.createEntity('Player');
    player.addComponent(new Transform({ x: 640, y: 360 }));
    player.addComponent(new Sprite({ tint: 0x7c6af7 }));
    player.addTag('player');

    console.log('[GameScene] started — edit src/scenes/GameScene.ts to build your game');
  }
}

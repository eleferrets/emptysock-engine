import {
  Scene,
  Transform,
  Sprite,
  PhysicsBody,
  CharacterController,
  InputSystem,
} from "@emptysock/engine";
import type { Entity } from "@emptysock/engine";

export class GameScene extends Scene {
  private _input: InputSystem = new InputSystem();

  constructor() {
    super("GameScene");
  }

  override start(): void {
    super.start();

    this._input.attach(window);

    // Player entity with physics character controller
    const player: Entity = this.createEntity("Player");
    player.addComponent(new Transform({ x: 200, y: 300 }));
    player.addComponent(new Sprite({ tint: 0x7c6af7 }));
    player.addComponent(new PhysicsBody({ bodyType: "dynamic", shape: "box" }));
    player.addComponent(
      new CharacterController({ speed: 200, jumpForce: 400 }),
    );
    player.addTag("player");

    // Ground platform
    const ground: Entity = this.createEntity("Ground");
    ground.addComponent(
      new Transform({ x: 640, y: 680, scaleX: 12, scaleY: 1 }),
    );
    ground.addComponent(new Sprite({ tint: 0x4ade80 }));
    ground.addComponent(new PhysicsBody({ bodyType: "fixed", shape: "box" }));
    ground.addTag("ground");

    // Platform
    const platform: Entity = this.createEntity("Platform");
    platform.addComponent(
      new Transform({ x: 400, y: 500, scaleX: 4, scaleY: 1 }),
    );
    platform.addComponent(new Sprite({ tint: 0x60a5fa }));
    platform.addComponent(new PhysicsBody({ bodyType: "fixed", shape: "box" }));
    platform.addTag("platform");

    // Input system for movement
    this.addSystem("input", (_scene, dt) => {
      const playerEntity = _scene.getEntitiesByTag("player")[0];
      if (playerEntity === undefined) return;
      const cc = playerEntity.getComponent<CharacterController>(
        "CharacterController",
      );
      if (cc === undefined) return;

      const moveX =
        (this._input.isKeyDown("ArrowRight") || this._input.isKeyDown("KeyD")
          ? 1
          : 0) -
        (this._input.isKeyDown("ArrowLeft") || this._input.isKeyDown("KeyA")
          ? 1
          : 0);
      const jump =
        this._input.isKeyPressed("ArrowUp") ||
        this._input.isKeyPressed("Space");

      cc.moveX = moveX * cc.speed * dt;
      if (jump) cc.requestJump();
    });

    console.log("Platformer GameScene started");
  }

  override stop(): void {
    this._input.detach();
    super.stop();
  }
}

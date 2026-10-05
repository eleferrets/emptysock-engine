import { Sprite, Transform } from "@emptysock/engine";
import type { Entity, SceneDefinition, Scene } from "@emptysock/engine";

// Minimal hand-rolled platformer movement. The engine has no character
// controller: PhysicsSystem simulates bodies but offers no API to drive one,
// so this template moves the player through Transform and resolves landing
// against a list of platform rectangles itself.
const SPEED = 240; // px/s
const JUMP_SPEED = 620; // px/s, upwards
const GRAVITY = 1600; // px/s^2, downwards
const PLAYER_HALF = 16;

interface Platform {
  readonly x: number; // centre
  readonly y: number; // centre
  readonly halfWidth: number;
  readonly halfHeight: number;
}

const PLATFORMS: readonly Platform[] = [
  { x: 640, y: 680, halfWidth: 640, halfHeight: 20 }, // ground
  { x: 400, y: 500, halfWidth: 128, halfHeight: 16 },
  { x: 900, y: 380, halfWidth: 128, halfHeight: 16 },
];

function spawnBox(
  scene: Scene,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  tint: number,
): Entity {
  // A Sprite with no texturePath draws the 1x1 white texture; scale it to
  // the wanted pixel size and tint it.
  const e = scene.spawn(name);
  e.add(Transform, { x, y, scaleX: w, scaleY: h });
  e.add(Sprite, { tint });
  return e;
}

export function createGameScene(): SceneDefinition {
  let onFrame: ((dt: number) => void) | undefined;
  return {
    onLoad(scene, ctx) {
      ctx.input.setActions({
        left: [
          { kind: "key", code: "ArrowLeft" },
          { kind: "key", code: "KeyA" },
        ],
        right: [
          { kind: "key", code: "ArrowRight" },
          { kind: "key", code: "KeyD" },
        ],
        jump: [
          { kind: "key", code: "ArrowUp" },
          { kind: "key", code: "Space" },
        ],
      });

      for (const [i, p] of PLATFORMS.entries()) {
        spawnBox(
          scene,
          `Platform${i}`,
          p.x,
          p.y,
          p.halfWidth * 2,
          p.halfHeight * 2,
          i === 0 ? 0x4ade80 : 0x60a5fa,
        );
      }

      const player = spawnBox(scene, "Player", 200, 300, 32, 32, 0x7c6af7);
      let velocityY = 0; // positive = downwards (screen space)
      let grounded = false;

      onFrame = (dt: number): void => {
        const t = player.get(Transform);
        if (t === undefined) return;

        const moveX =
          (ctx.input.isDown("right") ? 1 : 0) -
          (ctx.input.isDown("left") ? 1 : 0);
        t.x += moveX * SPEED * dt;

        if (grounded && ctx.input.wasPressed("jump")) {
          velocityY = -JUMP_SPEED;
          grounded = false;
        }
        velocityY += GRAVITY * dt;
        const previousBottom = t.y + PLAYER_HALF;
        t.y += velocityY * dt;

        grounded = false;
        for (const p of PLATFORMS) {
          const top = p.y - p.halfHeight;
          const overlapsX = Math.abs(t.x - p.x) < p.halfWidth + PLAYER_HALF;
          const bottom = t.y + PLAYER_HALF;
          if (
            overlapsX &&
            velocityY >= 0 &&
            previousBottom <= top &&
            bottom >= top
          ) {
            t.y = top - PLAYER_HALF;
            velocityY = 0;
            grounded = true;
          }
        }
      };
    },
    onUpdate(dt) {
      onFrame?.(dt);
    },
  };
}

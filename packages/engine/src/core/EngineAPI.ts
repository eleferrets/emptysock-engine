import { SceneManagerInstance } from "./SceneManager.js";
import { Diagnostics } from "../ecs/Diagnostics.js";

/**
 * `Engine`'s error/file-log/debugger surface lives in `../ecs/Diagnostics.ts`
 * now (zero classic-model coupling — a future ECS-only host wires it without
 * needing this object's `pushScene`/`popScene` facade, which genuinely does
 * need `SceneManagerInstance`). `Engine` spreads that one implementation
 * rather than duplicating it, and adds only the scene-stack methods that are
 * actually classic-only.
 */
export const Engine = {
  ...Diagnostics,

  // ── Scene stack ───────────────────────────────────────────────────────────
  // These delegate directly to SceneManagerInstance — no forwarding logic of
  // their own — so `Engine.pushScene` stays a convenient facade for game code
  // without hiding a second scene-stack implementation behind it.

  /**
   * Push a new scene on top of the active scene (e.g. a pause menu over the game).
   * The scene underneath is paused but stays in memory. Call popScene() to return.
   */
  pushScene: SceneManagerInstance.pushScene.bind(SceneManagerInstance),

  /** Pop the top scene off the stack and resume the scene underneath. */
  popScene: SceneManagerInstance.popScene.bind(SceneManagerInstance),
};

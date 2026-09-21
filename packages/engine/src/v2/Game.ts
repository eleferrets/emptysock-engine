import { ActorSystem } from "../core/ActorSystem.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { Scene } from "./Scene.js";

/**
 * A game-defined update hook. TypeScript enforces ENGINE_DESIGN.md §4's
 * "onUpdate cannot be async" at compile time by typing this as returning
 * `void`, not `Promise<void>` — a TS caller declaring `async onUpdate` gets
 * a type error, not a runtime footgun. JS callers get no compile-time check,
 * so `Game.update()` also does a dev-mode runtime check (see `_warnIfAsync`).
 */
export type UpdateFn = (dt: number) => void;

/** Optional per-frame hooks a `SceneDefinition` may implement. */
export interface SceneDefinition {
  /** Called once, after the engine has created this scene's systems. */
  onLoad?(scene: Scene, ctx: SceneLifecycle): void | Promise<void>;
  /** Called once, before the engine tears this scene's systems down. */
  onUnload?(scene: Scene, ctx: SceneLifecycle): void | Promise<void>;
  /** Called every frame, after physics/actors/collision, before render. */
  onUpdate?: UpdateFn;
}

/** What a loaded scene gets handed for the lifetime of that load. */
export interface SceneLifecycle {
  readonly scene: Scene;
  readonly actors: ActorSystem;
  readonly physics: PhysicsSystem;
}

export interface LoadSceneOptions {
  /**
   * ENGINE_DESIGN.md §4's escape hatch. `false` hands back the raw
   * `ActorSystem`/`PhysicsSystem` instances for the caller to own (create,
   * destroy, share across scenes) instead of the engine doing it
   * automatically. Default `true`.
   */
  manageLifecycle?: boolean;
  /** Physics gravity/config, forwarded to `PhysicsSystem.init()`. */
  physics?: Parameters<PhysicsSystem["init"]>[0];
  /**
   * Swap in a no-op render step (ENGINE_DESIGN.md §15.1's headless testing
   * harness uses this). Game code never sets this directly — see
   * `packages/engine/src/testing`.
   */
  headless?: boolean;
}

/**
 * ENGINE_DESIGN.md §4/§10.2 — "`onUpdate` cannot be `async` — not
 * 'shouldn't,' _cannot_. The type it's assigned to is `(dt: number) =>
 * void`; returning a `Promise<void>` is a type error."
 *
 * A bare `SceneDefinition` object literal does *not* actually get this for
 * free: TypeScript's return-type-`void` contextual typing is deliberately
 * lenient (a function returning `Promise<void>` type-checks fine against a
 * `(dt: number) => void` parameter/property type — this is the same
 * leniency that lets `array.forEach(async fn)` compile without a peep).
 * `defineScene` closes that gap by inferring `T`'s *actual* return type
 * from the literal before any contextual "void accepts anything" coercion
 * applies, and rejecting the literal if `onUpdate` resolves to a function
 * returning `Promise<unknown>`.
 *
 * ```ts
 * defineScene({
 *   async onUpdate(dt) { ... } // ts(2345): not assignable — see below
 * });
 * ```
 */
type RejectAsyncOnUpdate<T extends SceneDefinition> = T["onUpdate"] extends (
  dt: number,
) => infer R
  ? R extends Promise<unknown>
    ? {
        onUpdate: "onUpdate must not be async — declare it to return void, and use entity.startCoroutine() for work that spans multiple frames";
      }
    : T
  : T;

/**
 * Type-checked scene definition constructor. Prefer this over a bare object
 * literal passed straight to `Game.loadScene` when you want the compiler to
 * catch an accidentally-`async onUpdate` (see `RejectAsyncOnUpdate`). JS
 * callers get no compile-time check either way — see `warnIfPromiseReturned`
 * for the runtime fallback `Game.update()` always performs regardless of how
 * the scene was defined.
 */
export function defineScene<T extends SceneDefinition>(
  definition: T & RejectAsyncOnUpdate<T>,
): T {
  return definition;
}

interface LoadedScene {
  readonly definition: SceneDefinition;
  readonly lifecycle: SceneLifecycle;
  readonly manageLifecycle: boolean;
}

/**
 * ENGINE_DESIGN.md §4 — "the engine owns everything it creates". `Game` is
 * the one place that constructs and tears down a scene's `ActorSystem`/
 * `PhysicsSystem`, and the one place that runs the fixed, one-phase-per-
 * frame update order. There is no code path where a developer constructs
 * those systems by hand unless they explicitly opt out with
 * `{ manageLifecycle: false }`.
 */
export class Game {
  private _current: LoadedScene | null = null;
  private _renderStep: (() => void) | null = null;

  /**
   * Load a scene: creates its `Scene` (bitECS world), its `ActorSystem` and
   * `PhysicsSystem` (unless `manageLifecycle: false`), and calls the
   * definition's `onLoad`. If a scene is already loaded, it is unloaded
   * first via `unloadScene()` — same "engine owns it" guarantee applies to
   * the outgoing scene.
   */
  async loadScene(
    definition: SceneDefinition,
    options: LoadSceneOptions = {},
  ): Promise<SceneLifecycle> {
    if (this._current !== null) {
      await this.unloadScene();
    }

    const manageLifecycle = options.manageLifecycle ?? true;
    const scene = new Scene();
    const actors = new ActorSystem();
    const physics = new PhysicsSystem();
    if (manageLifecycle) {
      await physics.init(options.physics);
    }

    const lifecycle: SceneLifecycle = { scene, actors, physics };
    this._current = { definition, lifecycle, manageLifecycle };
    this._renderStep = options.headless ? () => {} : null;

    await definition.onLoad?.(scene, lifecycle);
    return lifecycle;
  }

  /**
   * Tear down the currently loaded scene: calls `onUnload`, then destroys
   * the scene's `ActorSystem`/`PhysicsSystem` — unconditionally, before
   * `onUnload` finishes matters less than that it happens at all, so this
   * always runs the teardown even if `onUnload` throws. No-op if
   * `manageLifecycle: false` was passed to `loadScene` — the caller owns
   * those systems and is responsible for destroying them itself.
   */
  async unloadScene(): Promise<void> {
    const current = this._current;
    if (current === null) return;
    this._current = null;

    try {
      await current.definition.onUnload?.(
        current.lifecycle.scene,
        current.lifecycle,
      );
    } finally {
      if (current.manageLifecycle) {
        current.lifecycle.actors.destroy();
        current.lifecycle.physics.destroy();
      }
    }
  }

  get currentScene(): Scene | null {
    return this._current?.lifecycle.scene ?? null;
  }

  get lifecycle(): SceneLifecycle | null {
    return this._current?.lifecycle ?? null;
  }

  /**
   * Runs the fixed, one-phase-per-frame update order from ENGINE_DESIGN.md
   * §4:
   *
   * 1. Input snapshot — out of scope for Track 0 (no `InputSystem` wiring
   *    here yet; Track 1 owns that), so this is a no-op placeholder step.
   * 2. Actor mailbox flush + actor `update()` (unchanged v1 semantics —
   *    drain every inbox before any actor's `update()` runs).
   * 3–4. Physics step + collision/sensor dispatch — delegated to
   *    `PhysicsSystem.step()`, which is Track 1 scope; Track 0 only
   *    guarantees the system exists and is destroyed correctly.
   * 5. The scene definition's `onUpdate(dt)`.
   * 6. Camera/viewport resolve — Track 1/2 scope, no-op here.
   * 7. Render — swapped for a no-op by the headless harness.
   */
  update(dt: number): void {
    const current = this._current;
    if (current === null) return;

    // 2. Actor mailbox flush, then actor update (v1 semantics, unchanged).
    current.lifecycle.actors.update(dt);

    // 3–4. Physics step + collision dispatch (Track 1 wires the real step).

    // 5. Behavior/component update.
    const onUpdate = current.definition.onUpdate;
    if (onUpdate !== undefined) {
      const result = onUpdate(dt) as unknown;
      warnIfPromiseReturned(result);
    }

    // 7. Render.
    this._renderStep?.();
  }
}

/**
 * ENGINE_DESIGN.md §4/§10.2 — TypeScript rejects `async onUpdate` at compile
 * time (its declared type is `(dt: number) => void`). JS callers get no such
 * check, so this dev-mode runtime check catches the same mistake: an
 * `onUpdate` that returns a thenable is almost certainly `async function
 * onUpdate`, whose real work runs at an undefined time outside the frame
 * budget the engine can no longer see or catch errors from.
 */
function warnIfPromiseReturned(result: unknown): void {
  if (
    typeof result === "object" &&
    result !== null &&
    "then" in result &&
    typeof (result as { then?: unknown }).then === "function"
  ) {
    console.warn(
      "onUpdate returned a Promise. That's not a thing here — use entity.startCoroutine() instead.",
    );
  }
}

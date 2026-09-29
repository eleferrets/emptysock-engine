import { ActorSystem } from "./ActorSystem.js";
import { PluginSystem } from "./PluginSystem.js";
import { AudioSystem } from "./systems/AudioSystem.js";
import { LocalisationSystem } from "./systems/LocalisationSystem.js";
import { VariableStore } from "./systems/VariableStore.js";
import { GlobalStore } from "./systems/GlobalStore.js";
import { SignalBus } from "./systems/SignalBus.js";
import { GmlFileSystem } from "./systems/GmlFileSystem.js";
import { FontRegistry } from "./systems/FontRegistry.js";
import { AssetRegistry } from "./systems/AssetRegistry.js";
import { ViewportSystem } from "./systems/ViewportSystem.js";
import { WindowSystem } from "./systems/WindowSystem.js";
import { updateCoroutines } from "./Coroutines.js";
import { PhysicsSystem } from "./systems/PhysicsSystem.js";
import { SpriteAnimationSystem } from "./systems/SpriteAnimationSystem.js";
import { InputManager } from "./Input.js";
import { Scene } from "./Scene.js";
import { ServiceRegistry } from "./Services.js";

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
  /**
   * Game-owned, not scene-owned (unlike `actors`/`physics`): one
   * `InputManager` persists across every scene load for the lifetime of the
   * `Game`, because raw device state (which keys are held down) has no
   * relationship to which scene happens to be loaded. Handed here purely
   * for convenience so scene code doesn't need a separate reference to the
   * owning `Game`.
   */
  readonly input: InputManager;
  /** Game-owned, same reasoning as `input` — music/sfx commonly outlive a scene transition. */
  readonly audio: AudioSystem;
  /**
   * Game-owned, same reasoning as `audio`/`input` — the one canonical
   * `VariableStore` for the lifetime of this `Game`, shared across every
   * scene unless a system is deliberately constructed with its own isolated
   * instance instead (e.g. `new VNSystem(new VariableStore())` for a
   * self-contained minigame). Pass this to `VNSystem`/`MapEventSystem`
   * constructors that need the shared switches/variables a save-gated
   * dialogue tree or map trigger expects.
   */
  readonly variables: VariableStore;
  /**
   * Game-owned, same reasoning as `audio`/`input`/`variables` — one
   * `GlobalStore` for the lifetime of this `Game`. This is the real target
   * for GameMaker's `global.x = expr` semantic (arbitrary named,
   * arbitrary-typed values reachable from anywhere) — see
   * `systems/GlobalStore.ts`'s own doc comment for why it's a distinct
   * service from `variables` rather than reusing `VariableStore`'s
   * numbered, integer-only shape.
   */
  readonly globals: GlobalStore;
  /** Game-owned signal/broadcast bus — see `systems/SignalBus.ts`. */
  readonly signals: SignalBus;
  /** Game-owned, same reasoning as `globals` — one `GmlFileSystem` for the lifetime of this `Game`, real handle-based file_text_* support. See `systems/GmlFileSystem.ts`'s own doc comment. */
  readonly files: GmlFileSystem;
  /** Game-owned, same reasoning as `globals`/`files` — one `FontRegistry` for the lifetime of this `Game`, a real component for working with fonts. See `systems/FontRegistry.ts`'s own doc comment. */
  readonly fonts: FontRegistry;
  /** Game-owned typed asset lookup (sprite sizes, font sizes, asset existence) loaded from the importer's `asset-index.json`. See `systems/AssetRegistry.ts`. */
  readonly assets: AssetRegistry;
  /**
   * Game-owned, same reasoning as `audio`/`input`/`variables` — one
   * `PluginSystem` for the lifetime of this `Game`. Equivalent to
   * `game.services.get(PluginSystem)`, handed here for convenience so scene
   * code doesn't need a separate reference to the owning `Game`.
   */
  readonly plugins: PluginSystem;
  /**
   * Game-owned, same reasoning as `plugins`/`variables` — one
   * `LocalisationSystem` for the lifetime of this `Game`, so a locale change
   * made from a settings menu in one scene is visible to every other scene's
   * UI text without threading a reference through scene boundaries.
   */
  readonly localisation: LocalisationSystem;
  /**
   * Game-owned, same reasoning as `plugins`/`variables`/`localisation` —
   * one `ViewportSystem` for the lifetime of this `Game`, since there is
   * normally exactly one canvas/viewport for the whole running game,
   * regardless of which scene happens to be loaded. Call
   * `ctx.viewport.init({ designWidth, designHeight, scaleMode }, { renderTarget, cameraSystem })`
   * once (typically from the `startScene`'s `onLoad`) to start automatic
   * resize/scale handling.
   */
  readonly viewport: ViewportSystem;
  /**
   * Game-owned, same reasoning as `viewport` — one OS window for the whole
   * running desktop app (a no-op on platforms without a Tauri window, per
   * `WindowSystem`'s own runtime Tauri-detection guard).
   */
  readonly window: WindowSystem;
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
   * Force step 7 (render) to stay a no-op for this scene regardless of
   * whether a renderer is attached (ENGINE_DESIGN.md §15.1's headless
   * testing harness uses this). Game code never sets this directly — see
   * `packages/engine/src/testing`. Belt-and-suspenders alongside "no
   * renderer attached": a headless game that somehow has a renderer
   * attached (e.g. a test that reuses a `Game` instance) still never
   * touches it.
   */
  headless?: boolean;
}

/**
 * ENGINE_DESIGN.md §12.3 — options for `Game.loadOverlay()`. Deliberately a
 * narrower surface than `LoadSceneOptions`: an overlay has no `physics` field
 * unless the caller opts in, because "no PhysicsSystem by default, since a
 * HUD doesn't need one" is the whole point of overlays being a separate call
 * from `loadScene`.
 */
export interface LoadOverlayOptions {
  /** Same escape hatch as `LoadSceneOptions.manageLifecycle`. Default `true`. */
  manageLifecycle?: boolean;
  /**
   * Opt-in only. Omitted (the common case), this overlay's `PhysicsSystem`
   * is constructed but never `.init()`-ed — inert, not stepped by
   * `Game.update()`, present only so `SceneLifecycle`'s shape stays uniform
   * between `loadScene` and `loadOverlay`. Pass this if an overlay genuinely
   * needs its own physics world (rare — most overlays are HUD/menu chrome).
   * When passed, `Game.update()` now actually steps this overlay's physics
   * world every frame alongside its actor/onUpdate treatment (Finding 7,
   * engine code-quality pass) — the caller no longer has to drive it
   * manually from their own `onUpdate`.
   */
  physics?: Parameters<PhysicsSystem["init"]>[0];
  /** Same as `LoadSceneOptions.headless` — set only by the testing harness. */
  headless?: boolean;
}

/**
 * ENGINE_DESIGN.md §4 step 7 / §12.3 — the minimal shape `Game.attachRenderer()`
 * needs. Deliberately a plain structural interface, not an import of the
 * concrete Pixi-backed `ecs/systems/RenderPipeline` — `Game.ts` must stay
 * inside the engine environment boundary (CLAUDE.md: "the engine package
 * must not import anything from the DOM"; pixi.js's renderer construction
 * needs a canvas) so it keeps running under the headless testing harness
 * with zero Pixi involvement, import included. This mirrors the pattern
 * documented in CLAUDE.md under "Scene transitions: SceneTransitionManager
 * times them, RenderPipeline paints them" — `SceneTransitionManager` drives
 * a `TransitionEffectSink` interface that `PostProcessSystem` satisfies
 * structurally, never importing pixi itself. `RenderPipeline` satisfies
 * `SceneRenderer` the same way here.
 */
export interface SceneRenderer {
  /**
   * Render `main` (the currently loaded scene), then every entry of
   * `overlays` on top of it, in array order — array order is call order
   * (ENGINE_DESIGN.md §12.3: overlays "stack in call order"), so the most
   * recently `loadOverlay()`-ed scene paints last/topmost.
   */
  renderFrame(main: Scene, overlays: readonly Scene[]): void;
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
  readonly headless: boolean;
  /**
   * Whether `runFrame()` should step this scene's `PhysicsSystem`. `true`
   * for every main scene (`loadScene` always inits physics when
   * `manageLifecycle`). For an overlay this is `true` only when the caller
   * passed `LoadOverlayOptions.physics` — the common HUD-only overlay has an
   * uninitialized `PhysicsSystem` that must never be stepped (§12.3: "no
   * PhysicsSystem by default").
   */
  readonly physicsEnabled: boolean;
}

/**
 * Finding 5/7 (engine code-quality pass) — "what a scene does per frame"
 * defined once, used by both `Game.update()`'s main-scene branch and its
 * overlay loop, instead of each hand-duplicating "flush actor mailbox, step
 * physics if enabled, call onUpdate with the async-Promise warning check".
 * This also directly wires `LoadOverlayOptions.physics` in: an overlay
 * loaded with `options.physics` now actually gets stepped here (previously
 * `Game.update()` never stepped *any* overlay's physics, silently leaving a
 * constructed-and-initialized Rapier world for the caller to have to drive
 * manually from their own `onUpdate` despite the option implying it "just
 * works").
 */
const spriteAnimation = new SpriteAnimationSystem();

function runFrame(loaded: LoadedScene, dt: number): void {
  loaded.lifecycle.actors.update(dt);

  if (loaded.physicsEnabled) {
    loaded.lifecycle.physics.update(loaded.lifecycle.scene, dt);
  }

  // General-purpose, not GML-specific (see `SpriteAnimationSystem`'s own
  // doc comment) — every loaded scene (main + overlays) gets its `Sprite`
  // frames advanced every tick, the same reach `actors`/`physics` above get.
  spriteAnimation.update(loaded.lifecycle.scene);

  // After physics settles, before onUpdate — a coroutine resuming this
  // frame sees this frame's post-physics state, and onUpdate sees whatever
  // the resumed coroutine just did, same "engine-driven state settles
  // before user code runs" ordering as actors/physics above.
  updateCoroutines(loaded.lifecycle.scene.world, dt);

  const onUpdate = loaded.definition.onUpdate;
  if (onUpdate !== undefined) {
    warnIfPromiseReturned(onUpdate(dt) as unknown);
  }
}

/**
 * ENGINE_DESIGN.md §4 — "the engine owns everything it creates". `Game` is
 * the one place that constructs and tears down a scene's `ActorSystem`/
 * `PhysicsSystem`, and the one place that runs the fixed, one-phase-per-
 * frame update order. There is no code path where a developer constructs
 * those systems by hand unless they explicitly opt out with
 * `{ manageLifecycle: false }`.
 */
/** Options passed to `new Game(options)` / `Game.create(options)`. */
export interface GameOptions {
  /**
   * ENGINE_DESIGN.md §15.2 — opt-in cross-platform bit-for-bit-deterministic
   * physics. Swaps `@dimforge/rapier{2,3}d-compat` for the
   * `-deterministic-compat` builds for every scene's `PhysicsSystem` this
   * `Game` creates, unless a call's own `options.physics.deterministic`
   * overrides it. Off by default (§15 round 6: "most games never need this
   * and shouldn't pay for it" — the deterministic build has no SIMD).
   */
  deterministic?: boolean;
}

export class Game {
  /**
   * Every live `Game` instance, in construction order. Pure in-memory
   * bookkeeping — no DOM, no globals, nothing that violates the engine
   * environment boundary — so a headless/Node `Game` is unaffected. This
   * exists so host code that doesn't own the `new Game()` call (the IDE's
   * preview iframe bootstrap script, which runs alongside arbitrary game
   * code it never wrote) has a documented way to find the game instance
   * the user's own code just created, instead of requiring every game to
   * opt in to some IDE-specific registration call. See
   * `ecs/bridge/QueryChannel.ts`'s doc comment for the other half: the host
   * is expected to `new QueryChannel().attach(game.currentScene, ...)`
   * once it finds a `Game` here, not the other way around.
   */
  static readonly instances = new Set<Game>();

  private readonly _deterministic: boolean;
  private _current: LoadedScene | null = null;
  /**
   * Overlay scenes, in call order (ENGINE_DESIGN.md §12.3: "stack in call
   * order"). A `Set` would lose that order; an array preserves it and gives
   * `renderFrame()`'s `overlays` argument its topmost-last ordering for
   * free.
   */
  private readonly _overlays: LoadedScene[] = [];
  private _renderer: SceneRenderer | null = null;
  /**
   * ENGINE_DESIGN.md §5 — process-global for the lifetime of this `Game`
   * instance, constructed once here (not per-scene, unlike `actors`/
   * `physics` in `SceneLifecycle`) and never reset by `loadScene`/
   * `unloadScene`. `PluginSystem` and `VariableStore` are registered here in
   * the constructor as the first two real services — see `Services.ts`.
   */
  readonly services = new ServiceRegistry();
  /**
   * Game-owned, not per-scene (ENGINE_DESIGN.md §4 step 1 / §15.3) — one
   * `InputManager` for the lifetime of this `Game`, snapshotted once per
   * `update()` call. Never recreated on `loadScene`/`loadOverlay`, since
   * raw device state has no relationship to which scene is loaded.
   */
  private readonly _input: InputManager = new InputManager();
  /** Game-owned, not per-scene — same reasoning as `_input` (see `SceneLifecycle.audio`). */
  private readonly _audio: AudioSystem = new AudioSystem();

  constructor(options: GameOptions = {}) {
    this._deterministic = options.deterministic ?? false;
    this.services.register(PluginSystem);
    this.services.register(VariableStore);
    this.services.register(GlobalStore);
    this.services.register(SignalBus);
    this.services.register(GmlFileSystem);
    this.services.register(FontRegistry);
    this.services.register(AssetRegistry);
    this.services.register(LocalisationSystem);
    this.services.register(ViewportSystem);
    this.services.register(WindowSystem);
    Game.instances.add(this);
  }

  /** Equivalent to `new Game(options)` — reads better at a call site than `new`. */
  static create(options: GameOptions = {}): Game {
    return new Game(options);
  }

  /**
   * Wire a concrete renderer (the real `ecs/systems/RenderPipeline`, or a
   * test double) into step 7 of `update()`. Never called by the headless
   * testing harness — a `Game`/`HeadlessGame` with no renderer attached (the
   * default) already makes step 7 a no-op with nothing extra to configure;
   * `attachRenderer` exists for the host app (browser preview, Tauri
   * WebView) to call once, after constructing the renderer against its own
   * canvas.
   */
  attachRenderer(renderer: SceneRenderer): void {
    this._renderer = renderer;
  }

  /** Undo `attachRenderer` — step 7 goes back to a no-op. */
  detachRenderer(): void {
    this._renderer = null;
  }

  /**
   * The `Game`'s single `InputManager` (ENGINE_DESIGN.md §15.3). Call
   * `game.input.attach()` from browser/Tauri bootstrap code to start
   * listening to real device events — `Game` itself never calls `attach()`,
   * so a headless/Node `Game` never touches `window` (CLAUDE.md's
   * engine-environment-boundary rule).
   */
  get input(): InputManager {
    return this._input;
  }

  /** The `Game`'s single `AudioSystem` (§18 — Howler-backed). */
  get audio(): AudioSystem {
    return this._audio;
  }

  /** The `Game`'s single `GlobalStore` — see that class's own doc comment. */
  /**
   * Forwards a scene's built-in entity events onto the game's `SignalBus`:
   * `entity:destroyed` `{ ref }` and `entity:parented` `{ child, parent }`.
   * Payloads carry scene-local `EntityRef`s (safe to queue), so listeners on
   * a shared bus should only interpret them for the scene they care about.
   */
  private forwardSceneSignals(scene: Scene): void {
    const bus = this.services.get(SignalBus);
    scene.onDestroyed((ref) => {
      bus.emit("entity:destroyed", { ref });
    });
    scene.onParented((child, parent) => {
      bus.emit("entity:parented", { child, parent });
    });
  }

  get signals(): SignalBus {
    return this.services.get(SignalBus);
  }
  get globals(): GlobalStore {
    return this.services.get(GlobalStore);
  }

  /** The `Game`'s single `GmlFileSystem` — see that class's own doc comment. */
  get files(): GmlFileSystem {
    return this.services.get(GmlFileSystem);
  }

  /** The `Game`'s single `AssetRegistry` — see that class's own doc comment. */
  get assets(): AssetRegistry {
    return this.services.get(AssetRegistry);
  }

  /** The `Game`'s single `FontRegistry` — see that class's own doc comment. */
  get fonts(): FontRegistry {
    return this.services.get(FontRegistry);
  }

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
    this.forwardSceneSignals(scene);
    const actors = new ActorSystem();
    const physics = new PhysicsSystem();
    if (manageLifecycle) {
      await physics.init({
        deterministic: this._deterministic,
        ...options.physics,
      });
    }

    const lifecycle: SceneLifecycle = {
      scene,
      actors,
      physics,
      input: this._input,
      audio: this._audio,
      variables: this.services.get(VariableStore),
      globals: this.services.get(GlobalStore),
      signals: this.services.get(SignalBus),
      files: this.services.get(GmlFileSystem),
      fonts: this.services.get(FontRegistry),
      assets: this.services.get(AssetRegistry),
      plugins: this.services.get(PluginSystem),
      localisation: this.services.get(LocalisationSystem),
      viewport: this.services.get(ViewportSystem),
      window: this.services.get(WindowSystem),
    };
    this._current = {
      definition,
      lifecycle,
      manageLifecycle,
      headless: options.headless ?? false,
      physicsEnabled: manageLifecycle,
    };

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

  /**
   * ENGINE_DESIGN.md §12.3 — stack an additional, independently-lifecycled
   * scene on top of whatever `loadScene()` currently has loaded (a HUD,
   * pause menu, minimap). Unlike `loadScene`, this never tears anything
   * down first: multiple overlays stack, in call order, and an overlay
   * survives the main scene being reloaded underneath it (`loadScene`
   * only ever touches `this._current`, never `this._overlays`).
   *
   * Gets its own `ActorSystem` (same "one per scene" guarantee as the main
   * scene, CLAUDE.md's "One ActorSystem per scene" decision, carried over
   * here). Gets a `PhysicsSystem` too, for `SceneLifecycle`'s shape to stay
   * uniform with `loadScene`'s — but it is **not** `.init()`-ed unless the
   * caller passes `options.physics` explicitly, so it never steps and never
   * costs a WASM physics world for the common HUD-only case ("no
   * PhysicsSystem by default, since a HUD doesn't need one").
   */
  async loadOverlay(
    definition: SceneDefinition,
    options: LoadOverlayOptions = {},
  ): Promise<SceneLifecycle> {
    const manageLifecycle = options.manageLifecycle ?? true;
    const scene = new Scene();
    this.forwardSceneSignals(scene);
    const actors = new ActorSystem();
    const physics = new PhysicsSystem();
    const physicsEnabled = manageLifecycle && options.physics !== undefined;
    if (physicsEnabled) {
      await physics.init(options.physics);
    }

    const lifecycle: SceneLifecycle = {
      scene,
      actors,
      physics,
      input: this._input,
      audio: this._audio,
      variables: this.services.get(VariableStore),
      globals: this.services.get(GlobalStore),
      signals: this.services.get(SignalBus),
      files: this.services.get(GmlFileSystem),
      fonts: this.services.get(FontRegistry),
      assets: this.services.get(AssetRegistry),
      plugins: this.services.get(PluginSystem),
      localisation: this.services.get(LocalisationSystem),
      viewport: this.services.get(ViewportSystem),
      window: this.services.get(WindowSystem),
    };
    const loaded: LoadedScene = {
      definition,
      lifecycle,
      manageLifecycle,
      headless: options.headless ?? false,
      physicsEnabled,
    };
    this._overlays.push(loaded);

    await definition.onLoad?.(scene, lifecycle);
    return lifecycle;
  }

  /**
   * Tear down an overlay scene: calls its `onUnload`, then destroys its
   * `ActorSystem`/`PhysicsSystem` (unless it was loaded with
   * `manageLifecycle: false`) — same unconditional-teardown guarantee as
   * `unloadScene()`. With no argument, unloads the most-recently-loaded
   * overlay (LIFO, matching the "stack" framing); pass a specific overlay's
   * `Scene` (from the `SceneLifecycle` `loadOverlay()` returned) to unload
   * one out of order, e.g. closing a pause menu while a toast overlay
   * loaded after it stays up. No-op if that scene isn't a currently loaded
   * overlay (already unloaded, or never was one).
   */
  async unloadOverlay(scene?: Scene): Promise<void> {
    const index =
      scene === undefined
        ? this._overlays.length - 1
        : this._overlays.findIndex((o) => o.lifecycle.scene === scene);
    if (index === -1) return;

    const [overlay] = this._overlays.splice(index, 1);
    if (overlay === undefined) return;

    try {
      await overlay.definition.onUnload?.(
        overlay.lifecycle.scene,
        overlay.lifecycle,
      );
    } finally {
      if (overlay.manageLifecycle) {
        overlay.lifecycle.actors.destroy();
        overlay.lifecycle.physics.destroy();
      }
    }
  }

  /** Currently loaded overlays, oldest (bottom of the stack) first. */
  get overlays(): readonly SceneLifecycle[] {
    return this._overlays.map((o) => o.lifecycle);
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
   * 1. Input snapshot (§15.3) — `this._input.snapshot()`, unconditional and
   *    first, even if no scene is loaded. Copies live device state into a
   *    frozen snapshot that every `input.isDown()`/`input.keyboard`/
   *    `input.gamepad()`/`input.pointers`/`input.gestures`/
   *    `input.wheelEvents` read for the rest of this frame, including
   *    everything steps 2–7 below do — see `InputManager.snapshot`.
   * 2. Actor mailbox flush + actor `update()` (unchanged actor-mailbox semantics —
   *    drain every inbox before any actor's `update()` runs).
   * 3–4. Physics step + collision/sensor dispatch — delegated to
   *    `PhysicsSystem.step()`, which is Track 1 scope; Track 0 only
   *    guarantees the system exists and is destroyed correctly.
   * 5. The scene definition's `onUpdate(dt)`.
   * 6. Camera/viewport resolve — Track 1/2 scope, no-op here.
   * 7. Render — the main scene, then any active overlays on top of it, in
   *    call order (ENGINE_DESIGN.md §12.3). A no-op if no renderer is
   *    attached (`attachRenderer()`), or if the currently loaded scene was
   *    loaded with `headless: true` — the headless testing harness relies on
   *    this to never construct or touch a real Pixi renderer.
   *
   * Overlays run steps 2-5 too — their own `ActorSystem` mailbox flush, their
   * own physics step (steps 3-4, only if `loadOverlay({ physics })` actually
   * initialized one — the common HUD-only overlay's inert default
   * `PhysicsSystem` stays unstepped, §12.3: "no PhysicsSystem by default"),
   * and their own `onUpdate(dt)` — right after the main scene's, in call
   * order, so HUD/menu logic keeps ticking every frame exactly like a normal
   * scene's does. Both the main scene and every overlay run this same
   * per-frame sequence through the shared `runFrame()` helper below, gated
   * only by each `LoadedScene`'s own `physicsEnabled` flag.
   */
  update(dt: number): void {
    // 1. Input snapshot — frozen for the rest of this frame.
    this._input.snapshot();

    const current = this._current;

    if (current !== null) {
      // 2-5: actor mailbox flush, fixed-timestep physics step(s) +
      // collision/sensor dispatch (§10.3/§6 — a no-op for an uninitialized
      // PhysicsSystem, see `PhysicsSystem.update`'s own guard), then
      // onUpdate(dt) — all via the shared `runFrame` helper (Finding 5).
      runFrame(current, dt);
    }

    // Overlays: same per-frame treatment, in call order — each overlay's
    // own PhysicsSystem is stepped too now, but only if it was actually
    // initialized (`loadOverlay({ physics })`, Finding 7); the default,
    // physics-less overlay stays exactly as before.
    for (const overlay of this._overlays) {
      runFrame(overlay, dt);
    }

    // 7. Render.
    if (current !== null && !current.headless && this._renderer !== null) {
      this._renderer.renderFrame(
        current.lifecycle.scene,
        this._overlays.map((o) => o.lifecycle.scene),
      );
    }
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

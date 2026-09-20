import {
  Component,
  componentType,
  type ComponentType,
} from "../core/Component.js";
import type { AnimationClip } from "./Animator.js";

/** A parameter value in the controller's parameter bag. Triggers are booleans that auto-reset after being consumed. */
export type AnimParamValue = number | boolean;

/** Read-only view of parameters/triggers handed to a transition's condition function. */
export interface AnimTransitionContext {
  /** Current value of a parameter, or undefined if never set. */
  getParam(name: string): AnimParamValue | undefined;
  /** Whether a trigger is currently armed (set since the last consumption). */
  isTriggered(name: string): boolean;
}

export interface AnimTransitionOptions {
  /** Target state name to transition into. */
  to: string;
  /** Condition evaluated every update; transition fires when it returns true. */
  condition: (ctx: AnimTransitionContext) => boolean;
  /**
   * Cross-fade duration in seconds. 0 (default) is an instant cut.
   * During a non-zero duration both the outgoing and incoming clip are
   * reported by getActiveClips() with interpolated weights.
   */
  duration?: number;
}

interface AnimTransition extends AnimTransitionOptions {
  from: string;
}

/** One frame of one clip contributing to the current pose, with its blend weight in [0, 1]. */
export interface ActiveClipFrame {
  state: string;
  clip: AnimationClip;
  frame: number;
  weight: number;
}

const WILDCARD = "*";

/**
 * Code-first animation state machine: named states (each wrapping an
 * AnimationClip), named transitions gated by parameter/trigger conditions,
 * and optional linear cross-fade blending between the outgoing and incoming
 * clip. Modelled after Unity's Animator Controller (parameters + triggers)
 * and Godot's AnimationTree conditions, without a visual graph editor.
 *
 * This is a separate component from Animator by design: Animator is a deep,
 * minimal single-clip player and must keep working unmodified for anyone who
 * doesn't need states. AnimatorController owns the added complexity of a
 * transition graph, parameter bag, and cross-fade timing so Animator's
 * surface area never grows to accommodate it.
 */
export class AnimatorController extends Component {
  static readonly TYPE: ComponentType<AnimatorController> =
    componentType<AnimatorController>("AnimatorController");

  private readonly _states: Map<string, AnimationClip> = new Map();
  private readonly _transitions: AnimTransition[] = [];
  private readonly _params: Map<string, AnimParamValue> = new Map();
  private readonly _triggers: Set<string> = new Set();

  private _currentState: string | null = null;
  private _currentFrame: number = 0;
  private _currentElapsed: number = 0;

  private _blendState: string | null = null;
  private _blendFrame: number = 0;
  private _blendElapsed: number = 0;
  private _blendDuration: number = 0;
  private _blendTime: number = 0;

  public speed: number = 1;

  constructor() {
    super("AnimatorController");
  }

  /** Register a named state backed by a clip. */
  addState(name: string, clip: AnimationClip): void {
    this._states.set(name, clip);
  }

  /** Register a transition from a state (or '*' to match from any state) to another. */
  addTransition(from: string, options: AnimTransitionOptions): void {
    this._transitions.push({ from, ...options });
  }

  setFloat(name: string, value: number): void {
    this._params.set(name, value);
  }

  setBool(name: string, value: boolean): void {
    this._params.set(name, value);
  }

  /** Arms a trigger. It stays armed until a transition condition consumes it or it is reset manually. */
  setTrigger(name: string): void {
    this._triggers.add(name);
  }

  resetTrigger(name: string): void {
    this._triggers.delete(name);
  }

  getParam(name: string): AnimParamValue | undefined {
    return this._params.get(name);
  }

  get currentState(): string | null {
    return this._currentState;
  }

  get isBlending(): boolean {
    return this._blendState !== null;
  }

  /** Jump straight into a state with no transition/blend, e.g. on setup. */
  play(name: string): void {
    const clip = this._states.get(name);
    if (clip === undefined) {
      console.warn(`AnimatorController: state "${name}" not found`);
      return;
    }
    this._currentState = name;
    this._currentFrame = clip.frameStart;
    this._currentElapsed = 0;
    this._blendState = null;
    this._blendElapsed = 0;
    this._blendTime = 0;
  }

  override update(deltaTime: number): void {
    this._evaluateTransitions();
    this._triggers.clear();

    if (this._currentState === null) return;

    this._advanceFrame(deltaTime);

    if (this._blendState !== null) {
      this._blendTime += deltaTime * this.speed;
      if (this._blendTime >= this._blendDuration) {
        // Blend complete: incoming state becomes current.
        this._currentState = this._blendState;
        this._currentFrame = this._blendFrame;
        this._currentElapsed = this._blendElapsed;
        this._blendState = null;
        this._blendTime = 0;
        this._blendElapsed = 0;
      }
    }
  }

  private _advanceFrame(deltaTime: number): void {
    if (this._currentState === null) return;
    const clip = this._states.get(this._currentState);
    if (clip === undefined) return;

    const current = this._stepClipFrame(
      clip,
      this._currentFrame,
      this._currentElapsed,
      deltaTime,
    );
    this._currentFrame = current.frame;
    this._currentElapsed = current.elapsed;

    if (this._blendState !== null) {
      const blendClip = this._states.get(this._blendState);
      if (blendClip !== undefined) {
        const blend = this._stepClipFrame(
          blendClip,
          this._blendFrame,
          this._blendElapsed,
          deltaTime,
        );
        this._blendFrame = blend.frame;
        this._blendElapsed = blend.elapsed;
      }
    }
  }

  private _stepClipFrame(
    clip: AnimationClip,
    frame: number,
    elapsed: number,
    deltaTime: number,
  ): { frame: number; elapsed: number } {
    let nextElapsed = elapsed + deltaTime * this.speed;
    const frameDuration = 1 / clip.frameRate;
    let next = frame;

    while (nextElapsed >= frameDuration) {
      nextElapsed -= frameDuration;
      next++;
      if (next > clip.frameEnd) {
        next = clip.loop ? clip.frameStart : clip.frameEnd;
      }
    }

    return { frame: next, elapsed: nextElapsed };
  }

  private _evaluateTransitions(): void {
    if (this._currentState === null || this._blendState !== null) return;

    const ctx: AnimTransitionContext = {
      getParam: (name) => this._params.get(name),
      isTriggered: (name) => this._triggers.has(name),
    };

    for (const t of this._transitions) {
      if (t.from !== WILDCARD && t.from !== this._currentState) continue;
      if (t.to === this._currentState) continue;
      const targetClip = this._states.get(t.to);
      if (targetClip === undefined) continue;
      if (!t.condition(ctx)) continue;

      const duration = t.duration ?? 0;
      if (duration <= 0) {
        this._currentState = t.to;
        this._currentFrame = targetClip.frameStart;
        this._currentElapsed = 0;
      } else {
        this._blendState = t.to;
        this._blendFrame = targetClip.frameStart;
        this._blendElapsed = 0;
        this._blendDuration = duration;
        this._blendTime = 0;
      }
      return;
    }
  }

  /**
   * Returns the clip(s)/frame(s)/weight(s) that should be composited this
   * frame. Normally a single entry with weight 1; during a cross-fade,
   * two entries whose weights sum to 1 and interpolate linearly over the
   * transition's duration.
   */
  getActiveClips(): ActiveClipFrame[] {
    if (this._currentState === null) return [];
    const currentClip = this._states.get(this._currentState);
    if (currentClip === undefined) return [];

    if (this._blendState === null) {
      return [
        {
          state: this._currentState,
          clip: currentClip,
          frame: this._currentFrame,
          weight: 1,
        },
      ];
    }

    const blendClip = this._states.get(this._blendState);
    if (blendClip === undefined) {
      return [
        {
          state: this._currentState,
          clip: currentClip,
          frame: this._currentFrame,
          weight: 1,
        },
      ];
    }

    const t =
      this._blendDuration > 0
        ? Math.min(1, this._blendTime / this._blendDuration)
        : 1;
    return [
      {
        state: this._currentState,
        clip: currentClip,
        frame: this._currentFrame,
        weight: 1 - t,
      },
      {
        state: this._blendState,
        clip: blendClip,
        frame: this._blendFrame,
        weight: t,
      },
    ];
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      states: Array.from(this._states.entries()).map(([name, clip]) => ({
        name,
        clip,
      })),
      currentState: this._currentState,
      speed: this.speed,
    };
  }
}

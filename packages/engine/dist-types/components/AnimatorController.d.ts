import { Component, type ComponentType } from "../core/Component.js";
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
/** One frame of one clip contributing to the current pose, with its blend weight in [0, 1]. */
export interface ActiveClipFrame {
  state: string;
  clip: AnimationClip;
  frame: number;
  weight: number;
}
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
export declare class AnimatorController extends Component {
  static readonly TYPE: ComponentType<AnimatorController>;
  private readonly _states;
  private readonly _transitions;
  private readonly _params;
  private readonly _triggers;
  private _currentState;
  private _currentFrame;
  private _currentElapsed;
  private _blendState;
  private _blendFrame;
  private _blendElapsed;
  private _blendDuration;
  private _blendTime;
  speed: number;
  constructor();
  /** Register a named state backed by a clip. */
  addState(name: string, clip: AnimationClip): void;
  /** Register a transition from a state (or '*' to match from any state) to another. */
  addTransition(from: string, options: AnimTransitionOptions): void;
  setFloat(name: string, value: number): void;
  setBool(name: string, value: boolean): void;
  /** Arms a trigger. It stays armed until a transition condition consumes it or it is reset manually. */
  setTrigger(name: string): void;
  resetTrigger(name: string): void;
  getParam(name: string): AnimParamValue | undefined;
  get currentState(): string | null;
  get isBlending(): boolean;
  /** Jump straight into a state with no transition/blend, e.g. on setup. */
  play(name: string): void;
  update(deltaTime: number): void;
  private _advanceFrame;
  private _stepClipFrame;
  private _evaluateTransitions;
  /**
   * Returns the clip(s)/frame(s)/weight(s) that should be composited this
   * frame. Normally a single entry with weight 1; during a cross-fade,
   * two entries whose weights sum to 1 and interpolate linearly over the
   * transition's duration.
   */
  getActiveClips(): ActiveClipFrame[];
  serialize(): Record<string, unknown>;
}

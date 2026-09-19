import { Component } from "../core/Component.js";
export interface AnimationClip {
  name: string;
  frameStart: number;
  frameEnd: number;
  frameRate: number;
  loop: boolean;
}
export declare class Animator extends Component {
  clips: Map<string, AnimationClip>;
  currentClip: string | null;
  currentFrame: number;
  speed: number;
  private _elapsed;
  private _playing;
  constructor();
  addClip(clip: AnimationClip): void;
  play(name: string): void;
  stop(): void;
  get isPlaying(): boolean;
  update(deltaTime: number): void;
  serialize(): Record<string, unknown>;
}

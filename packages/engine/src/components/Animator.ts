import {
  Component,
  componentType,
  type ComponentType,
} from "../core/Component.js";

export interface AnimationClip {
  name: string;
  frameStart: number;
  frameEnd: number;
  frameRate: number;
  loop: boolean;
}

export class Animator extends Component {
  static readonly TYPE: ComponentType<Animator> =
    componentType<Animator>("Animator");

  public clips: Map<string, AnimationClip> = new Map();
  public currentClip: string | null = null;
  public currentFrame: number = 0;
  public speed: number = 1;

  private _elapsed: number = 0;
  private _playing: boolean = false;

  constructor() {
    super("Animator");
  }

  addClip(clip: AnimationClip): void {
    this.clips.set(clip.name, clip);
  }

  play(name: string): void {
    const clip = this.clips.get(name);
    if (clip === undefined) {
      console.warn(`Animator: clip "${name}" not found`);
      return;
    }
    this.currentClip = name;
    this.currentFrame = clip.frameStart;
    this._elapsed = 0;
    this._playing = true;
  }

  stop(): void {
    this._playing = false;
  }

  get isPlaying(): boolean {
    return this._playing;
  }

  override update(deltaTime: number): void {
    if (!this._playing || this.currentClip === null) return;

    const clip = this.clips.get(this.currentClip);
    if (clip === undefined) return;

    this._elapsed += deltaTime * this.speed;
    const frameDuration = 1 / clip.frameRate;

    while (this._elapsed >= frameDuration) {
      this._elapsed -= frameDuration;
      this.currentFrame++;

      if (this.currentFrame > clip.frameEnd) {
        if (clip.loop) {
          this.currentFrame = clip.frameStart;
        } else {
          this.currentFrame = clip.frameEnd;
          this._playing = false;
          break;
        }
      }
    }
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      clips: Array.from(this.clips.values()),
      currentClip: this.currentClip,
      speed: this.speed,
    };
  }
}

// AccessibilitySettings — accessibility primitive #3: a global text-scale
// multiplier that UI text widgets read at render time.
//
// This is intentionally a tiny module-level singleton rather than something
// threaded through every widget's constructor: a
// settings-menu slider needs to affect every LabelWidget already on screen,
// in every scene, without each panel wiring a prop down through its tree.

export class AccessibilitySettings {
  private _textScale = 1;

  /** Multiplier applied to every LabelWidget's fontSize at render time. */
  get textScale(): number {
    return this._textScale;
  }

  set textScale(value: number) {
    this._textScale = Math.max(0.5, Math.min(3, value));
  }

  reset(): void {
    this._textScale = 1;
  }
}

export const accessibilitySettings = new AccessibilitySettings();

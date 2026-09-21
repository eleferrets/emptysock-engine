export declare class AccessibilitySettings {
  private _textScale;
  /** Multiplier applied to every LabelWidget's fontSize at render time. */
  get textScale(): number;
  set textScale(value: number);
  reset(): void;
}
export declare const accessibilitySettings: AccessibilitySettings;

export type EasingName =
  | "linear"
  | "sineIn"
  | "sineOut"
  | "sineInOut"
  | "quadIn"
  | "quadOut"
  | "quadInOut"
  | "cubicIn"
  | "cubicOut"
  | "cubicInOut"
  | "bounceOut"
  | "elasticOut";
export declare function ease(name: EasingName, t: number): number;

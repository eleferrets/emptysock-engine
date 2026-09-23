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

export function ease(name: EasingName, t: number): number {
  switch (name) {
    case "linear":
      return t;
    case "sineIn":
      return 1 - Math.cos((t * Math.PI) / 2);
    case "sineOut":
      return Math.sin((t * Math.PI) / 2);
    case "sineInOut":
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case "quadIn":
      return t * t;
    case "quadOut":
      return 1 - (1 - t) * (1 - t);
    case "quadInOut":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "cubicIn":
      return t * t * t;
    case "cubicOut":
      return 1 - Math.pow(1 - t, 3);
    case "cubicInOut":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "bounceOut": {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) {
        const t2 = t - 1.5 / d1;
        return n1 * t2 * t2 + 0.75;
      }
      if (t < 2.5 / d1) {
        const t2 = t - 2.25 / d1;
        return n1 * t2 * t2 + 0.9375;
      }
      const t3 = t - 2.625 / d1;
      return n1 * t3 * t3 + 0.984375;
    }
    case "elasticOut": {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
  }
}

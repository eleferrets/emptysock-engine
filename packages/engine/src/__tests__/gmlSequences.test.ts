import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Scene } from "../Scene.js";
import { layer_sequence_create } from "../compat/gmlSequences.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import {
  GmlSequenceState,
  registerGmlSequence,
  unregisterGmlSequence,
} from "../components/GmlSequence.js";
import { Transform } from "../components/Transform.js";

describe("layer_sequence_create", () => {
  let scene: Scene;
  let ctx: GmlActionContext;

  beforeEach(() => {
    scene = new Scene();
    ctx = { scene };
    registerGmlSequence("sqExplosion", {
      length: 30,
      tracks: [
        {
          target: "sprite.alpha",
          keyframes: [
            { time: 0, value: 1, interpolation: "linear" },
            { time: 30, value: 0, interpolation: "linear" },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    unregisterGmlSequence("sqExplosion");
  });

  it("spawns an entity at (x, y) with a real, playing GmlSequenceState bound to the sequence", () => {
    const entity = layer_sequence_create(
      ctx,
      "Effects",
      64,
      128,
      "sqExplosion",
    );
    expect(entity).toBeDefined();
    expect(entity?.get(Transform)?.x).toBe(64);
    expect(entity?.get(Transform)?.y).toBe(128);
    const state = entity?.get(GmlSequenceState);
    expect(state?.sequenceId).toBe("sqExplosion");
    expect(state?.playing).toBe(true);
    expect(state?.position).toBe(0);
  });

  it("returns undefined and warns, spawning nothing, for an unregistered sequence id", () => {
    const entity = layer_sequence_create(ctx, "Effects", 0, 0, "sqMissing");
    expect(entity).toBeUndefined();
    let count = 0;
    scene.each(Transform, () => {
      count++;
    });
    expect(count).toBe(0);
  });
});

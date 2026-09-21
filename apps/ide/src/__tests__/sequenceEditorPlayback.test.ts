import { describe, it, expect } from "vitest";
import { TweenManager, SequenceSystem } from "@emptysock/engine";
import {
  tracksToSequenceDefinition,
  interpolate,
  makeTrack,
} from "../components/panels/sequence-editor/helpers";
import type { Track } from "../components/panels/sequence-editor/types";

describe("SequenceEditor <-> SequenceSystem parity", () => {
  it("tracksToSequenceDefinition maps track type to the exact engine property key", () => {
    const tracks: Track[] = [
      makeTrack("Position X", [
        { t: 0, v: 0 },
        { t: 1, v: 50 },
      ]),
      makeTrack("Rotation", [
        { t: 0, v: 0 },
        { t: 2, v: 360 },
      ]),
    ];
    const def = tracksToSequenceDefinition(tracks, 2);
    expect(def.tracks[0]?.property).toBe("x");
    expect(def.tracks[1]?.property).toBe("rotation");
    expect(def.duration).toBe(2);
  });

  it("excludes non-numeric lanes (dialogue/audio/expression/wait) from playback", () => {
    const dialogue: Track = {
      ...makeTrack("Custom", [{ t: 0, v: 0 }]),
      laneType: "dialogue",
    };
    const keyframeTrack = makeTrack("Opacity", [
      { t: 0, v: 0 },
      { t: 1, v: 1 },
    ]);
    const def = tracksToSequenceDefinition([dialogue, keyframeTrack], 1);
    expect(def.tracks).toHaveLength(1);
    expect(def.tracks[0]?.property).toBe("opacity");
  });

  it("playing the converted definition through a real TweenManager reproduces the panel's interpolate() badge value", () => {
    const track = makeTrack("Position Y", [
      { t: 0, v: 0 },
      { t: 1, v: 100 },
    ]);
    const def = tracksToSequenceDefinition([track], 1);

    const tweens = new TweenManager();
    const seq = new SequenceSystem();
    const target: Record<string, number> = {};
    seq.play(tweens, target, def);

    let t = 0;
    const dt = 1 / 60;
    while (t < 1) {
      t += dt;
      tweens.update(dt);
      expect(target["y"]).toBeCloseTo(interpolate(track.keyframes, t), 0);
    }
  });

  it("respects a per-track ease on playback, matching evaluateTrackAt", () => {
    const track: Track = {
      ...makeTrack("Scale", [
        { t: 0, v: 0 },
        { t: 1, v: 1 },
      ]),
      ease: "quadOut",
    };
    const def = tracksToSequenceDefinition([track], 1);
    expect(def.tracks[0]?.ease).toBe("quadOut");

    const tweens = new TweenManager();
    const seq = new SequenceSystem();
    const target: Record<string, number> = {};
    seq.play(tweens, target, def);
    tweens.update(0.5);
    // quadOut(0.5) = 1 - (1-0.5)^2 = 0.75
    expect(target["scale"]).toBeCloseTo(0.75, 5);
  });
});

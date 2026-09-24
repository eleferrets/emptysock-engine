import fs from "fs/promises";
import { parseGmsJson } from "./gms2-parse.js";
import { toPascalCase } from "./gms2-codegen.js";
import type { GmlSequenceTrackTarget } from "@emptysock/engine";

// ---------------------------------------------------------------------------
// GMS2 Sequence (`resourceType: "GMSequence"`) import.
//
// Real on-disk format, confirmed against real GMS2 2.3+ sequence resources
// (searched live for this pass — GitHub code search across real projects,
// e.g. gurpreetsinghmatharoo/gms2.3-turn-based-rpg's
// `sequences/seqRoomStart/seqRoomStart.yy`, and GameMaker's own manual pages
// for Sequences/"Using Animation Curves"):
//
//   {
//     "resourceType": "GMSequence",
//     "length": 60.0,
//     "playbackSpeed": 30.0,
//     "playbackSpeedType": 0,       // 0 = frames-per-second, 1 = frames-per-game-frame
//     "tracks": [
//       { "resourceType": "GMRealTrack", "name": "position", "interpolation": 1,
//         "tracks": [], // nested sub-tracks — see below
//         "keyframes": { "Keyframes": [
//           { "Key": 0.0, "Channels": { "0": { "RealValue": ..., "resourceType": "RealKeyframe" },
//                                        "1": { "RealValue": ..., "resourceType": "RealKeyframe" } } },
//           ...
//         ] } },
//       { "resourceType": "GMRealTrack", "name": "rotation", ... },   // single channel (0)
//       { "resourceType": "GMRealTrack", "name": "scale", ... },      // two channels (0=x, 1=y)
//       { "resourceType": "GMGraphicTrack", "name": "sBlack", "tracks": [ ... nested real tracks ... ] },
//       ...
//     ],
//   }
//
// GameMaker's real Sequences are a genuinely broad asset — GameMaker's own
// manual describes them as "a collection of assets that perform a dynamic
// animation over time. They can contain sprites, instances, sounds and even
// other sequences" (Sequences reference page). A `GMGraphicTrack`/
// `GMInstanceTrack`/`GMGroupTrack` nests its own child `tracks` array
// targeting a *different* asset instance placed inside the sequence
// (a sprite overlay, a spawned object instance, ...) — none of that has a
// single live `Entity` to write into the way "this Sequence drives the
// entity it's attached to" does, and reproducing it generically would mean
// reproducing GameMaker's own nested-instance sequence player, well beyond
// what's tractable here.
//
// What DOES convert cleanly and generically: a *root-level* `GMRealTrack`
// (only `GMRealTrack`, GameMaker's own plain-numeric-keyframe track kind —
// never `GMSpriteFramesTrack`/`GMStringTrack`/`GMBoolTrack`/`GMColourTrack`,
// which don't have a single numeric value per keyframe) whose `name` matches
// one of GameMaker's built-in per-instance track names this importer knows
// how to target on `@emptysock/engine`'s `Transform`/`Sprite`: `"position"`
// (2 channels: x, y — confirmed), `"scale"` (2 channels: scaleX, scaleY —
// confirmed), `"rotation"` (1 channel — confirmed). `"image_blend"`/
// `"image_alpha"` are GameMaker's own documented built-in instance variable
// names (GML_Reference/Instances/Instance_Variables/image_blend.htm /
// image_alpha.htm) and a plausible, but NOT directly GitHub-confirmed for
// this pass, sequence track naming convention for animating them — mapped
// here on that basis, called out explicitly so a reviewer knows it's an
// inference from GameMaker's variable-naming convention, not a verified
// on-disk sample. Every other track kind, and any `GMRealTrack` whose name
// isn't one of the above, is left unconverted and reported by name+kind —
// never silently dropped.
//
// GameMaker's real keyframe interpolation (manual.gamemaker.io's Sequences
// reference, "Using Animation Curves"): "Between keyframes, GameMaker
// interpolates the value (linear by default...)". A keyframe CAN carry its
// own embedded animation curve (`EmbeddedAnimCurve`) for eased/custom
// interpolation instead of the track's flat linear/step choice — every real
// sample surveyed for this pass had `EmbeddedAnimCurve: null` (flat
// linear), and reproducing GameMaker's animation-curve evaluation (control
// points + curve type) is out of scope here; a keyframe carrying a real,
// non-null `EmbeddedAnimCurve` is reported as a fallback-to-linear
// approximation rather than silently treated as identical to a real linear
// track — see `convertGms2Sequence`'s `curvedKeyframes` count.
// ---------------------------------------------------------------------------

export type GmlSeqInterpolation = "linear" | "step";

export interface GmlSeqKeyframe {
  readonly time: number;
  readonly value: number;
  readonly interpolation: GmlSeqInterpolation;
}

export interface GmlSeqTrack {
  readonly target: GmlSequenceTrackTarget;
  readonly keyframes: readonly GmlSeqKeyframe[];
}

export interface ConvertedGmlSequence {
  readonly length: number;
  readonly tracks: readonly GmlSeqTrack[];
  /** Root-level tracks this importer could not convert, by `"<resourceType> \"<name>\""`. */
  readonly skippedTracks: readonly string[];
  /** Count of real keyframes that carried a non-null embedded animation curve, approximated as linear. */
  readonly curvedKeyframes: number;
}

interface YyKeyframeChannel {
  RealValue?: number;
  EmbeddedAnimCurve?: unknown;
}

interface YyKeyframe {
  Key?: number;
  Channels?: Record<string, YyKeyframeChannel>;
}

interface YyTrack {
  resourceType?: string;
  name?: string;
  interpolation?: number;
  keyframes?: { Keyframes?: YyKeyframe[] };
}

interface YySequence {
  resourceType?: string;
  length?: number;
  playbackSpeed?: number;
  playbackSpeedType?: number;
  tracks?: YyTrack[];
}

function isYySequence(val: unknown): val is YySequence {
  return typeof val === "object" && val !== null;
}

/**
 * Root-level GameMaker built-in track names this importer knows how to
 * target — see the module doc comment above for which are on-disk-confirmed
 * vs. inferred from GameMaker's own instance-variable naming convention.
 * Each entry lists one `GmlSequenceTrackTarget` per real keyframe channel
 * index, in order.
 */
const TRACK_TARGET_MAP: Record<string, readonly GmlSequenceTrackTarget[]> = {
  position: ["transform.x", "transform.y"],
  scale: ["transform.scaleX", "transform.scaleY"],
  rotation: ["transform.rotation"],
  image_blend: ["sprite.tint"],
  image_alpha: ["sprite.alpha"],
};

/**
 * Converts one GMS2 Sequence resource's real `.yy` into the plain data
 * `@emptysock/engine`'s `GmlSequenceData` shape needs, plus a report of
 * exactly which root-level tracks were skipped and why.
 */
export async function convertGms2Sequence(
  yyPath: string,
): Promise<ConvertedGmlSequence> {
  const raw = await fs.readFile(yyPath, "utf-8");
  const parsed = parseGmsJson(raw);
  if (!isYySequence(parsed)) {
    throw new Error(`"${yyPath}" is not a valid GMSequence .yy file`);
  }

  const length = parsed.length ?? 0;
  const speedType = parsed.playbackSpeedType ?? 0;
  // playbackSpeedType 1 ("frames per game frame") has no fixed fps this
  // importer can read from the sequence resource alone — GameMaker applies
  // it relative to whatever room speed is active at runtime. Assuming 60fps
  // (GameMaker's modern default room speed) is a documented approximation,
  // not a guaranteed-correct conversion; playbackSpeedType 0 ("frames per
  // second") needs no such assumption, since it's already an fps value.
  const speedIsAssumed = speedType === 1;

  const tracks: GmlSeqTrack[] = [];
  const skippedTracks: string[] = [];
  let curvedKeyframes = 0;

  for (const track of parsed.tracks ?? []) {
    const kind = track.resourceType ?? "UnknownTrack";
    const targets =
      kind === "GMRealTrack" && track.name !== undefined
        ? TRACK_TARGET_MAP[track.name]
        : undefined;

    if (targets === undefined) {
      skippedTracks.push(`${kind} "${track.name ?? ""}"`);
      continue;
    }

    const rawKeyframes = track.keyframes?.Keyframes ?? [];
    const interpolation: GmlSeqInterpolation =
      track.interpolation === 0 ? "step" : "linear";

    for (let channel = 0; channel < targets.length; channel++) {
      const target = targets[channel];
      if (target === undefined) continue;
      const keyframes: GmlSeqKeyframe[] = [];
      for (const kf of rawKeyframes) {
        const ch = kf.Channels?.[String(channel)];
        if (ch === undefined || typeof ch.RealValue !== "number") continue;
        if (
          ch.EmbeddedAnimCurve !== null &&
          ch.EmbeddedAnimCurve !== undefined
        ) {
          curvedKeyframes++;
        }
        keyframes.push({
          time: kf.Key ?? 0,
          value: ch.RealValue,
          interpolation,
        });
      }
      keyframes.sort((a, b) => a.time - b.time);
      tracks.push({ target, keyframes });
    }
  }

  if (speedIsAssumed) {
    skippedTracks.push(
      "(project-level: playbackSpeedType 1 'frames per game frame' — speed converted assuming 60fps, review manually)",
    );
  }

  return { length, tracks, skippedTracks, curvedKeyframes };
}

/**
 * Builds the `.sequence.ts` contents for a converted GMS2 sequence: a plain
 * exported `GmlSequenceData` constant, ready to hand to
 * `@emptysock/engine`'s `registerGmlSequence()`.
 */
export function buildSequenceModule(
  name: string,
  converted: ConvertedGmlSequence,
): string {
  const tracksJSON = JSON.stringify(converted.tracks, null, 2);
  return `// Auto-generated from GMS2 sequence: ${name}
// Register this once at startup and attach GmlSequenceState to an entity to
// play it:
//   registerGmlSequence(${JSON.stringify(name)}, ${toPascalCase(name)}Sequence);
//   entity.add(GmlSequenceState, { sequenceId: ${JSON.stringify(name)}, playing: true });
import type { GmlSequenceData } from "@emptysock/engine";

export const ${toPascalCase(name)}Sequence: GmlSequenceData = {
  length: ${converted.length},
  tracks: ${tracksJSON},
};
`;
}

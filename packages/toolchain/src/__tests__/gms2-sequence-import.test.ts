import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  convertGms2Sequence,
  buildSequenceModule,
} from "../gms2-sequence-import.js";

// ---------------------------------------------------------------------------
// Fully synthetic fixture, hand-authored to match the real on-disk GMS2
// Sequence format confirmed via GitHub code search for this pass (e.g.
// gurpreetsinghmatharoo/gms2.3-turn-based-rpg's
// `sequences/seqRoomStart/seqRoomStart.yy`) — never real project content.
// ---------------------------------------------------------------------------

const SEQ_YY = `{
  "resourceType":"GMSequence",
  "resourceVersion":"2.0",
  "length":10.0,
  "playbackSpeed":30.0,
  "playbackSpeedType":0,
  "tracks":[
    {"resourceType":"GMRealTrack","name":"position","interpolation":1,"tracks":[],
      "keyframes":{"Keyframes":[
        {"Key":0.0,"Channels":{"0":{"RealValue":0.0,"resourceType":"RealKeyframe","EmbeddedAnimCurve":null,},"1":{"RealValue":0.0,"resourceType":"RealKeyframe","EmbeddedAnimCurve":null,},},},
        {"Key":10.0,"Channels":{"0":{"RealValue":100.0,"resourceType":"RealKeyframe","EmbeddedAnimCurve":null,},"1":{"RealValue":50.0,"resourceType":"RealKeyframe","EmbeddedAnimCurve":null,},},},
      ]},},
    {"resourceType":"GMRealTrack","name":"rotation","interpolation":0,"tracks":[],
      "keyframes":{"Keyframes":[
        {"Key":0.0,"Channels":{"0":{"RealValue":0.0,"resourceType":"RealKeyframe","EmbeddedAnimCurve":null,},},},
        {"Key":5.0,"Channels":{"0":{"RealValue":90.0,"resourceType":"RealKeyframe","EmbeddedAnimCurve":null,},},},
      ]},},
    {"resourceType":"GMGraphicTrack","name":"sOverlay","tracks":[],"keyframes":{"Keyframes":[]},},
    {"resourceType":"GMRealTrack","name":"origin","interpolation":1,"tracks":[],
      "keyframes":{"Keyframes":[{"Key":0.0,"Channels":{"0":{"RealValue":0.0,"resourceType":"RealKeyframe",},"1":{"RealValue":0.0,"resourceType":"RealKeyframe",},},},]},},
  ],
}`;

describe("convertGms2Sequence / buildSequenceModule", () => {
  let projectRoot: string;

  beforeAll(async () => {
    projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-sequence-fixture-"),
    );
    const dir = path.join(projectRoot, "sequences", "seqTest");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "seqTest.yy"), SEQ_YY, "utf-8");
  });

  afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("converts position (2ch) and rotation (1ch, step interpolation) tracks", async () => {
    const converted = await convertGms2Sequence(
      path.join(projectRoot, "sequences", "seqTest", "seqTest.yy"),
    );
    expect(converted.length).toBe(10);

    const x = converted.tracks.find((t) => t.target === "transform.x");
    const y = converted.tracks.find((t) => t.target === "transform.y");
    const rotation = converted.tracks.find(
      (t) => t.target === "transform.rotation",
    );

    expect(x?.keyframes).toEqual([
      { time: 0, value: 0, interpolation: "linear" },
      { time: 10, value: 100, interpolation: "linear" },
    ]);
    expect(y?.keyframes).toEqual([
      { time: 0, value: 0, interpolation: "linear" },
      { time: 10, value: 50, interpolation: "linear" },
    ]);
    expect(rotation?.keyframes).toEqual([
      { time: 0, value: 0, interpolation: "step" },
      { time: 5, value: 90, interpolation: "step" },
    ]);
  });

  it("reports unconvertible tracks (a graphic track, an unmapped real-track name) honestly, never silently drops them", async () => {
    const converted = await convertGms2Sequence(
      path.join(projectRoot, "sequences", "seqTest", "seqTest.yy"),
    );
    expect(converted.skippedTracks).toContain('GMGraphicTrack "sOverlay"');
    expect(converted.skippedTracks).toContain('GMRealTrack "origin"');
  });

  it("buildSequenceModule emits a real GmlSequenceData constant", async () => {
    const converted = await convertGms2Sequence(
      path.join(projectRoot, "sequences", "seqTest", "seqTest.yy"),
    );
    const content = buildSequenceModule("seqTest", converted);
    expect(content).toContain("export const SeqTestSequence: GmlSequenceData");
    expect(content).toContain('"target": "transform.x"');
    expect(content).toContain("length: 10");
  });

  it("flags playbackSpeedType 1 as an assumed-fps conversion", async () => {
    const dir = path.join(projectRoot, "sequences", "seqGameFrame");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "seqGameFrame.yy"),
      `{"resourceType":"GMSequence","length":5.0,"playbackSpeed":1.0,"playbackSpeedType":1,"tracks":[],}`,
      "utf-8",
    );
    const converted = await convertGms2Sequence(
      path.join(dir, "seqGameFrame.yy"),
    );
    expect(
      converted.skippedTracks.some((t) => t.includes("playbackSpeedType 1")),
    ).toBe(true);
  });
});

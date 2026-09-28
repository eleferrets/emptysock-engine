import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { buildTimelineModule } from "../gms2-timeline-import.js";

// ---------------------------------------------------------------------------
// Fully synthetic fixture, hand-authored to match the real on-disk GMS2
// Timeline format confirmed via GitHub code search for this pass (e.g.
// LSDonkeyKong/Castlevania-ReVamped-Open-Source-Edition's
// `timelines/tmJiggle/tmJiggle.yy` + its `moment_0.gml`/`moment_1.gml`
// companion files) — never real project content.
// ---------------------------------------------------------------------------

describe("buildTimelineModule", () => {
  let projectRoot: string;

  beforeAll(async () => {
    projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-timeline-fixture-"),
    );
    const dir = path.join(projectRoot, "timelines", "tmJiggle");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "tmJiggle.yy"),
      `{
        "$GMTimeline":"",
        "%Name":"tmJiggle",
        "momentList":[
          {"$GMMoment":"","%Name":"","evnt":{"$GMEvent":"v1","%Name":"","collisionObjectId":null,"eventNum":0,"eventType":0,"isDnD":false,"name":"","resourceType":"GMEvent","resourceVersion":"2.0",},"moment":0,"name":"","resourceType":"GMMoment","resourceVersion":"2.0",},
          {"$GMMoment":"","%Name":"","evnt":{"$GMEvent":"v1","%Name":"","collisionObjectId":null,"eventNum":1,"eventType":0,"isDnD":false,"name":"","resourceType":"GMEvent","resourceVersion":"2.0",},"moment":4,"name":"","resourceType":"GMMoment","resourceVersion":"2.0",},
        ],
        "name":"tmJiggle",
        "resourceType":"GMTimeline",
        "resourceVersion":"2.0",
      }`,
      "utf-8",
    );
    await fs.writeFile(path.join(dir, "moment_0.gml"), "x = xstart;", "utf-8");
    await fs.writeFile(
      path.join(dir, "moment_4.gml"),
      "x = xstart + 1;",
      "utf-8",
    );

    // A timeline whose .yy references a moment step with no companion .gml
    // file on disk at all — must still emit a real (stubbed) function, not
    // silently vanish.
    const missingDir = path.join(projectRoot, "timelines", "tmMissing");
    await fs.mkdir(missingDir, { recursive: true });
    await fs.writeFile(
      path.join(missingDir, "tmMissing.yy"),
      `{
        "momentList":[
          {"moment":2,"resourceType":"GMMoment",},
        ],
        "resourceType":"GMTimeline",
      }`,
      "utf-8",
    );
  });

  afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("emits one transpiled function per moment, in ascending step order", async () => {
    const content = await buildTimelineModule("tmJiggle", projectRoot);
    expect(content).toContain("function moment_0(");
    expect(content).toContain("function moment_4(");
    expect(content).toContain(
      "_t.x = GmlActions.get_gml_xstart(_entity, _ctx);",
    );
    expect(content).toContain(
      "_t.x = GmlActions.get_gml_xstart(_entity, _ctx) + 1;",
    );
    expect(content).toContain("{ step: 0, run: moment_0 },");
    expect(content).toContain("{ step: 4, run: moment_4 },");
    expect(content).toContain("export const TmJiggleTimeline: TimelineModule");
    // Ascending order: step 0's entry appears before step 4's.
    expect(content.indexOf("step: 0")).toBeLessThan(content.indexOf("step: 4"));
  });

  it("emits a TODO stub (not silent data loss) when a moment's .gml file is missing", async () => {
    const content = await buildTimelineModule("tmMissing", projectRoot);
    expect(content).toContain("function moment_2(");
    expect(content).toContain("TODO: migrate moment 2");
    expect(content).toContain("{ step: 2, run: moment_2 },");
  });

  it("emits an empty-moments module (not a throw) for a stale/missing timeline .yy", async () => {
    const content = await buildTimelineModule("tmDoesNotExist", projectRoot);
    expect(content).toContain("moments: []");
    expect(content).toContain("could not be read");
  });
});

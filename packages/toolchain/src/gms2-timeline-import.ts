import fs from "fs/promises";
import path from "path";
import { parseGmsJson } from "./gms2-parse.js";
import { readAndTranspileGML, indent } from "./gms2-transpile.js";
import { toPascalCase } from "./gms2-codegen.js";

// ---------------------------------------------------------------------------
// GMS2 Timeline (`resourceType: "GMTimeline"`) import.
//
// Real on-disk format, confirmed against real GMS2 2.3+ project timeline
// resources (searched live for this pass — GitHub code search across real
// projects, e.g. LSDonkeyKong/Castlevania-ReVamped-Open-Source-Edition's
// `timelines/tmJiggle/tmJiggle.yy`):
//
//   {
//     "$GMTimeline": "",
//     "%Name": "tmJiggle",
//     "momentList": [
//       { "$GMMoment": "", "evnt": { "$GMEvent": "v1", "eventNum": 0, ... },
//         "moment": 0, "resourceType": "GMMoment", "resourceVersion": "2.0" },
//       ...
//     ],
//     "name": "tmJiggle",
//     "resourceType": "GMTimeline",
//     "resourceVersion": "2.0",
//   }
//
// `momentList[].moment` is the real step number (not `evnt.eventNum`, which
// GameMaker's IDE mirrors it into but which is not the field this importer
// should read — `moment` is the one the manual's own Timelines documentation
// and every real project's `.yy` agree on). The moment's actual GML code is
// NOT inlined in the `.yy` at all — GameMaker writes one companion file per
// moment, `moment_<step>.gml`, alongside the `.yy` (confirmed against the
// same real project: `timelines/tmJiggle/moment_0.gml`, `moment_1.gml`),
// exactly the same "structural data in `.yy`, real code in a sibling `.gml`
// file" split objects' `Create_0.gml`/`Step_0.gml`/etc already use.
//
// Real GameMaker timeline playback semantics (manual.gamemaker.io's
// `timeline_speed`/`timeline_loop` reference pages, confirmed live for this
// pass): a timeline does not auto-advance merely because `timeline_index` is
// set — `timeline_running` must also be true. Each step, `timeline_position`
// advances by `timeline_speed` (default `1`); a speed above `1` can fire
// several moments in one step, in step order. `timeline_loop` wraps the
// position back to the start (or, for a negative speed, to the last defined
// moment) instead of stopping once the last moment is passed. See
// `@emptysock/engine`'s `TimelineState`/`TimelineSystem` for the runtime half
// that actually implements this — this module only produces the moment data.
// ---------------------------------------------------------------------------

interface YyMoment {
  moment?: number;
}

interface YyTimeline {
  momentList?: YyMoment[];
}

function isYyTimeline(val: unknown): val is YyTimeline {
  return typeof val === "object" && val !== null;
}

/**
 * Builds the `.timeline.ts` contents for a GMS2 timeline: one plain function
 * per moment (transpiled from its `moment_<step>.gml` companion file, same
 * `transpileGML()` pipeline object events/scripts use), collected into a
 * `TimelineModule`-shaped `moments` array sorted ascending by step (the order
 * `@emptysock/engine`'s `TimelineSystem` expects, so it never has to re-sort
 * at runtime).
 */
export async function buildTimelineModule(
  name: string,
  projectRoot: string,
): Promise<string> {
  const yyPath = path.join(projectRoot, "timelines", name, `${name}.yy`);
  const timelineDir = path.join(projectRoot, "timelines", name);

  let raw: string;
  try {
    raw = await fs.readFile(yyPath, "utf-8");
  } catch {
    return `// Auto-generated from GMS2 timeline: ${name}
// The timeline's .yy could not be read — likely a stale/orphaned project
// reference. Migrate its moments manually.
import type { TimelineModule } from "@emptysock/engine";

export const ${toPascalCase(name)}Timeline: TimelineModule = { moments: [] };
`;
  }

  let parsed: unknown;
  try {
    parsed = parseGmsJson(raw);
  } catch {
    parsed = undefined;
  }

  const steps: number[] = [];
  if (isYyTimeline(parsed) && Array.isArray(parsed.momentList)) {
    for (const moment of parsed.momentList) {
      if (typeof moment.moment === "number") steps.push(moment.moment);
    }
  }
  steps.sort((a, b) => a - b);

  const fnNames: string[] = [];
  const fnBlocks: string[] = [];
  for (const step of steps) {
    const gmlPath = path.join(timelineDir, `moment_${step}.gml`);
    const fnName = `moment_${step}`;
    let transpiled: string | null = null;
    try {
      transpiled = await readAndTranspileGML(gmlPath);
    } catch {
      transpiled = null;
    }
    const body =
      transpiled !== null
        ? indent(transpiled.trimEnd(), 2)
        : `  // TODO: migrate moment ${step} (moment_${step}.gml not found)`;
    fnNames.push(fnName);
    fnBlocks.push(
      `function ${fnName}(_entity: Entity, _ctx: GmlActionContext): void {\n  // [GML auto-transpiled from moment_${step}.gml — review carefully]\n${body}\n}`,
    );
  }

  const momentsList = steps
    .map((step, i) => `    { step: ${step}, run: ${fnNames[i]} },`)
    .join("\n");

  const fnsBlock = fnBlocks.length > 0 ? fnBlocks.join("\n\n") + "\n\n" : "";

  return `// Auto-generated from GMS2 timeline: ${name}
// GameMaker's real timeline semantics: a moment's code runs once the
// playhead crosses its step while the entity's TimelineState is running
// (see @emptysock/engine's TimelineState/TimelineSystem). Register this
// module once at startup and attach TimelineState to an entity to play it:
//   registerGmlTimeline(${JSON.stringify(name)}, ${toPascalCase(name)}Timeline);
//   entity.add(TimelineState, { timelineId: ${JSON.stringify(name)}, running: true });
import type { Entity, GmlActionContext, TimelineModule } from "@emptysock/engine";

${fnsBlock}export const ${toPascalCase(name)}Timeline: TimelineModule = {
  moments: [
${momentsList}
  ],
};
`;
}

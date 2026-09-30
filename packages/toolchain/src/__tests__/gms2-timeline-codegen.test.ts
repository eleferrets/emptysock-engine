import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildObjectBehavior } from "../gms2-behavior-codegen.js";
import { loadGmlProject } from "../gms2-project.js";

// ---------------------------------------------------------------------------
// End-to-end proof that a real object's Create event assigning
// `timeline_index` produces a real, working `.behavior.ts` — not just that
// `transpileGML()` in isolation rewrites the right regex. See
// `packages/engine/src/__tests__/GmsRuntime.test.ts`'s
// "timeline_index assignment" describe block for the companion proof that
// the exact emitted call shape actually attaches/re-targets/removes a real
// `TimelineState` at runtime.
// ---------------------------------------------------------------------------

describe("buildObjectBehavior — GMS2 timeline_index wiring", () => {
  it("transpiles a Create event's timeline_index assignment into a real TimelineState attach call", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-timeline-obj-"));
    try {
      const objectDir = path.join(dir, "objects", "objJiggler");
      await fs.mkdir(objectDir, { recursive: true });
      await fs.writeFile(
        path.join(objectDir, "Create_0.gml"),
        `timeline_index = tmJiggle;\ntimeline_loop = true;`,
        "utf-8",
      );

      const content = await buildObjectBehavior(
        "objJiggler",
        dir,
        await loadGmlProject(dir, { assets: { timeline: ["tmJiggle"] } }),
      );

      // Uses the module's already-unconditional `import * as GmlActions
      // from '@emptysock/engine'` — no new import bookkeeping needed.
      expect(content).toContain(
        "import * as GmlActions from '@emptysock/engine';",
      );
      expect(content).toContain(
        '(() => { const _tl = _entity.get(GmlActions.TimelineState); if (_tl) { _tl.timelineId = "tmJiggle"; _tl.position = 0; _tl.running = true; } else { _entity.add(GmlActions.TimelineState, { timelineId: "tmJiggle", position: 0, running: true }); } })();',
      );
      expect(content).toContain(
        "(() => { const _tl = _entity.get(GmlActions.TimelineState); if (_tl) _tl.loop = true; })();",
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("transpiles timeline_index = -1 into a real TimelineState removal call", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-timeline-stop-"));
    try {
      const objectDir = path.join(dir, "objects", "objStopper");
      await fs.mkdir(objectDir, { recursive: true });
      await fs.writeFile(
        path.join(objectDir, "Step_0.gml"),
        `if (y > 400) {\n  timeline_index = -1;\n}`,
        "utf-8",
      );

      const content = await buildObjectBehavior("objStopper", dir);

      expect(content).toContain("_entity.remove(GmlActions.TimelineState);");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

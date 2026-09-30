import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { buildObjectBehavior } from "../gms2-behavior-codegen.js";

/**
 * Regression coverage for gms2-codegen.ts's Step/Draw sub-event mapping —
 * synthetic fixtures only, no reference to any real project (see CLAUDE.md's
 * "GMS2 `.yyp`/`.yy` are not strict JSON..." entry on how this codebase
 * treats real-project-derived knowledge).
 *
 * Real GameMaker eventnum suffixes verified against GameMaker's own manual
 * (manual.gamemaker.io/lts/en/The_Asset_Editors/Object_Properties/Event_Order.htm
 * — "First all Begin Step events are executed, then all Step events are
 * executed, after that all End Step events are executed") and GML's
 * `event_number` constants (`ev_step_normal` = 0, `ev_step_begin` = 1,
 * `ev_step_end` = 2 — exactly the numeric suffix GMS2 writes onto
 * `Step_<n>.gml`), plus the long-standing, manual- and community-confirmed
 * `ev_draw_gui` = 64 constant for Draw's GUI sub-event.
 */
describe("gms2-codegen buildObjectBehavior — Step/Draw sub-event mapping", () => {
  let projectRoot: string;
  const objectName = "obj_hud";

  beforeAll(async () => {
    projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-codegen-events-"),
    );
    const objectDir = path.join(projectRoot, "objects", objectName);
    await fs.mkdir(objectDir, { recursive: true });

    await fs.writeFile(
      path.join(objectDir, "Step_1.gml"),
      "// begin step marker",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "Step_0.gml"),
      "// normal step marker",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "Step_2.gml"),
      "// end step marker",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "Draw_0.gml"),
      "// draw marker",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "Draw_64.gml"),
      "// draw gui marker",
      "utf-8",
    );
  });

  afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("maps Step_1/Step_0/Step_2 to onStepBegin/onUpdate/onStepEnd, each as its own function", async () => {
    const behavior = await buildObjectBehavior(objectName, projectRoot);

    expect(behavior).toContain("export function onStepBegin(");
    expect(behavior).toContain("export function onUpdate(");
    expect(behavior).toContain("export function onStepEnd(");

    // Each generated function body is transpiled from the correct source
    // file — not just present, but distinguishable from one another.
    const beginIdx = behavior.indexOf("export function onStepBegin(");
    const updateIdx = behavior.indexOf("export function onUpdate(");
    const endIdx = behavior.indexOf("export function onStepEnd(");
    expect(beginIdx).toBeGreaterThanOrEqual(0);
    expect(updateIdx).toBeGreaterThan(beginIdx);
    expect(endIdx).toBeGreaterThan(updateIdx);

    expect(
      behavior.slice(beginIdx, updateIdx).includes("begin step marker"),
    ).toBe(true);
    expect(
      behavior.slice(updateIdx, endIdx).includes("normal step marker"),
    ).toBe(true);
    expect(behavior.slice(endIdx).includes("end step marker")).toBe(true);
  });

  it("maps Draw_0/Draw_64 to onDraw/onDrawGui as separate functions", async () => {
    const behavior = await buildObjectBehavior(objectName, projectRoot);

    expect(behavior).toContain("export function onDraw(");
    expect(behavior).toContain("export function onDrawGui(");

    const drawIdx = behavior.indexOf("export function onDraw(");
    const drawGuiIdx = behavior.indexOf("export function onDrawGui(");
    expect(drawGuiIdx).toBeGreaterThan(drawIdx);
    expect(behavior.slice(drawIdx, drawGuiIdx).includes("draw marker")).toBe(
      true,
    );
    expect(behavior.slice(drawGuiIdx).includes("draw gui marker")).toBe(true);
  });

  it("omits onStepBegin/onStepEnd/onDrawGui entirely when the object has no such event files", async () => {
    const plainObject = "obj_plain";
    const objectDir = path.join(projectRoot, "objects", plainObject);
    await fs.mkdir(objectDir, { recursive: true });
    await fs.writeFile(
      path.join(objectDir, "Step_0.gml"),
      "// only normal step",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "Draw_0.gml"),
      "// only normal draw",
      "utf-8",
    );

    const behavior = await buildObjectBehavior(plainObject, projectRoot);

    expect(behavior).toContain("export function onUpdate(");
    expect(behavior).toContain("export function onDraw(");
    expect(behavior).not.toContain("export function onStepBegin(");
    expect(behavior).not.toContain("export function onStepEnd(");
    expect(behavior).not.toContain("export function onDrawGui(");
  });
});

describe("gms2-codegen buildObjectBehavior — draw_* calls thread through _ctx.drawTarget", () => {
  // Regression test: Draw_0.gml/Draw_64.gml's real draw_* calls used to pass
  // straight through untouched (a bare, unresolved `draw_rectangle(...)` /
  // `draw_text(...)` identifier reference in the generated .behavior.ts —
  // compat/gml.ts's draw_* functions are not part of @emptysock/engine's one
  // export surface, so nothing named `draw_rectangle` is even importable).
  // `GmlBehaviorSystem.renderDraw`/`renderDrawGui` set `ctx.drawTarget` for
  // exactly the duration of one dispatch call — the generated code must call
  // through that, not a bare unresolved function name.
  it("rewrites draw_set_colour/draw_rectangle/draw_text into _ctx.drawTarget calls in onDraw and onDrawGui", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-codegen-draw-"));
    const objectName = "obj_hud2";
    const objectDir = path.join(dir, "objects", objectName);
    await fs.mkdir(objectDir, { recursive: true });
    await fs.writeFile(
      path.join(objectDir, "Draw_0.gml"),
      "draw_set_colour(0xff0000);\ndraw_rectangle(10, 10, 20, 20, false);",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "Draw_64.gml"),
      'draw_text(5, 5, "score");',
      "utf-8",
    );

    try {
      const behavior = await buildObjectBehavior(objectName, dir);

      expect(behavior).toContain("_ctx.drawTarget?.setColor(0xff0000);");
      expect(behavior).toContain(
        "_ctx.drawTarget?.rect(10, 10, 20, 20, false);",
      );
      expect(behavior).toContain('_ctx.drawTarget?.text(5, 5, "score");');

      // Never left as a bare, unresolved GML function-name reference.
      expect(behavior).not.toMatch(/[^.]\bdraw_rectangle\s*\(/);
      expect(behavior).not.toMatch(/[^.]\bdraw_set_colour\s*\(/);
      expect(behavior).not.toMatch(/[^.]\bdraw_text\s*\(/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // GameMaker objects carry real, common event kinds this codegen pass has
  // no dedicated mapping for at all — Alarm_<n>.gml, CleanUp_0.gml,
  // Other_<n>.gml (the "Other" category — room-start/end, User Event 0-15,
  // and more), and Draw sub-events beyond plain Draw/Draw GUI (e.g. a
  // "Pre Draw" event written as Draw_72.gml). A `.gml` file for one of
  // these used to vanish from the generated output entirely — not even a
  // `// TODO: migrate ...` stub — which is real GML logic silently lost,
  // unlike every other unmapped-but-recognised event kind (which always
  // gets at least a stub). Each such file must now get its own generated
  // function, named after the file, so nothing is ever dropped without a
  // trace.
  it("generates a function for every .gml file with no dedicated event mapping, instead of silently dropping it", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-codegen-leftover-"),
    );
    const objectName = "obj_misc_events";
    const objectDir = path.join(dir, "objects", objectName);
    await fs.mkdir(objectDir, { recursive: true });
    await fs.writeFile(
      path.join(objectDir, "Alarm_0.gml"),
      "hp -= 1;",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "Other_7.gml"),
      "play_footstep_sound();",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "CleanUp_0.gml"),
      "cleanup_resources();",
      "utf-8",
    );
    await fs.writeFile(
      path.join(objectDir, "Draw_72.gml"),
      "pre_draw_setup();",
      "utf-8",
    );

    try {
      const behavior = await buildObjectBehavior(objectName, dir);

      expect(behavior).toContain("export function onAlarm0(");
      expect(behavior).toContain(
        'GmlActions.setGmlVar(_entity, _ctx, "hp", GmlActions.gmlNum(GmlActions.getGmlVar(_entity, _ctx, "hp")) - 1);',
      );
      expect(behavior).toContain("export function onOther7(");
      expect(behavior).toContain(
        'GmlActions.gmlUnknown("play_footstep_sound")();',
      );
      expect(behavior).toContain("export function onCleanUp0(");
      expect(behavior).toContain(
        'GmlActions.gmlUnknown("cleanup_resources")();',
      );
      expect(behavior).toContain("export function onDraw72(");
      expect(behavior).toContain('GmlActions.gmlUnknown("pre_draw_setup")();');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

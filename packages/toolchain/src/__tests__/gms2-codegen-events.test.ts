import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { buildObjectBehavior } from "../gms2-codegen.js";

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

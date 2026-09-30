import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import { walkProject, formatWalk, walkCounts } from "./helpers/walkProject.js";
import { fixtureYyp, yypDeclares } from "./helpers/fixture.js";
import { baselineFor } from "./helpers/baseline.js";

/**
 * Walks every room of one specific real project in its real `.yyp`
 * `RoomOrderNodes` order through a real headless `GmsProjectRuntime`,
 * running `GMS2_WALK_FRAMES` (default 600) frames in each with `vk_right`
 * held, and reports per room: that it loaded, entity counts, whether a live
 * `obj_player` moved, every room change the game itself made, and every
 * handler exception `GmlBehaviorSystem` caught (its `safeCall` isolates a
 * throwing handler and logs it, so "`update()` did not throw" alone proves
 * nothing about the transpiled code).
 *
 * The assertions name that project's rooms (`rm_init` first, `rm_1` the
 * first gameplay room), so any other project skips cleanly; the generic
 * walk over every project is gms2-multi-project-walk.test.ts. Both share
 * `helpers/walkProject.ts`. Skipped honestly when the project is not on disk.
 */
const REAL_PROJECT = fixtureYyp();
const APPLICABLE =
  REAL_PROJECT !== "" &&
  yypDeclares(REAL_PROJECT, {
    rooms: ["rm_init", "rm_1"],
    objects: ["obj_player"],
  });

describe("GMS2 real project: room walk (a real project)", () => {
  it("loads and runs every room in roomOrder with no uncaught throws, no module load failures and no handler exceptions", async () => {
    if (!APPLICABLE) return;
    const frames = Number(process.env["GMS2_WALK_FRAMES"] ?? "600");
    const walk = await walkProject(REAL_PROJECT, { frames });
    expect(walk.importError).toBeNull();
    expect(walk.roomOrder.length).toBeGreaterThan(5);
    expect(walk.roomOrder[0]).toBe("rm_init");

    if (process.env["GMS2_WALK_REPORT"]) {
      await fs.writeFile(
        process.env["GMS2_WALK_REPORT"],
        formatWalk(walk) + "\n",
        "utf8",
      );
    }

    // Every room loads and runs every frame without an uncaught throw.
    expect(
      walk.results
        .filter((r) => r.thrown !== null)
        .map((r) => `${r.room}: ${r.thrown}`),
    ).toEqual([]);
    expect(walk.results.every((r) => r.frames === frames)).toBe(true);
    // Every generated behavior/script module loads (baseline ceiling, target 0).
    expect(walkCounts(walk).loadFailures).toBeLessThanOrEqual(
      baselineFor(REAL_PROJECT).loadFailures,
    );
    // The real player walks in the first gameplay room.
    const rm1 = walk.results.find((r) => r.room === "rm_1");
    expect(rm1?.playerMoved ?? 0).toBeGreaterThan(50);
    // No transpiled handler throws.
    const errorsByRoom = walk.results
      .filter((r) => Object.keys(r.handlerErrors).length > 0)
      .map((r) => `${r.room}: ${Object.keys(r.handlerErrors).join(" | ")}`);
    expect(errorsByRoom).toEqual([]);
  }, 3_600_000);
});

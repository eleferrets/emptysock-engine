import { describe, it, expect } from "vitest";
import { migrationReport } from "../gms2-report.js";

// migrationReport is a pure function from a plain data structure to a
// formatted string — no filesystem or import-time I/O involved. These tests
// exercise it directly with hand-built fixtures.

describe("migrationReport (pure formatting, no filesystem)", () => {
  it("summarises converted and manual assets by category", () => {
    const report = migrationReport({
      projectName: "Fixture Project",
      entries: [
        { kind: "object", name: "obj_hero", status: "converted" },
        { kind: "script", name: "scr_util", status: "converted" },
        { kind: "room", name: "rm_start", status: "converted" },
        {
          kind: "room",
          name: "rm_broken",
          status: "manual",
          note: "conversion failed — see warnings",
        },
        { kind: "sprite", name: "spr_hero", status: "converted" },
        { kind: "sound", name: "snd_jump", status: "manual" },
        { kind: "tileset", name: "ts_ground", status: "manual" },
      ],
      warnings: ["Resource with missing name skipped (path: foo/bar)"],
    });

    expect(report).toContain("# GMS2 Migration Report — Fixture Project");
    expect(report).toContain("| Objects (converted) | 1 |");
    expect(report).toContain("| Scripts (converted) | 1 |");
    expect(report).toContain("| Rooms (converted) | 1 |");
    expect(report).toContain("| Rooms (manual) | 1 |");
    expect(report).toContain("| Sprites (converted) | 1 |");
    expect(report).toContain("| Sounds (manual) | 1 |");
    expect(report).toContain("| Tilesets (manual) | 1 |");
    expect(report).toContain("| **Total found** | **7** |");
    expect(report).toContain("| **Total converted** | **4** |");

    expect(report).toContain(
      "- Room: `rm_broken` (conversion failed — see warnings)",
    );
    expect(report).toContain("- Sound: `snd_jump`");
    expect(report).toContain("- Tileset: `ts_ground`");

    expect(report).toContain("## Warnings");
    expect(report).toContain(
      "- Resource with missing name skipped (path: foo/bar)",
    );
  });

  it("omits the Warnings section entirely when there are no warnings", () => {
    const report = migrationReport({
      projectName: "No Warnings",
      entries: [{ kind: "object", name: "obj_a", status: "converted" }],
      warnings: [],
    });
    expect(report).not.toContain("## Warnings");
  });

  it("prints '_None_' for manual assets when everything converted cleanly", () => {
    const report = migrationReport({
      projectName: "All Clean",
      entries: [{ kind: "object", name: "obj_a", status: "converted" }],
      warnings: [],
    });
    expect(report).toContain("_None_");
  });

  it("counts totals correctly with zero entries", () => {
    const report = migrationReport({
      projectName: "Empty",
      entries: [],
      warnings: [],
    });
    expect(report).toContain("| **Total found** | **0** |");
    expect(report).toContain("| **Total converted** | **0** |");
  });
});

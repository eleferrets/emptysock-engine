/**
 * Migration report construction — pure formatting over a plain data
 * structure, no filesystem or import-time I/O involved. `importGMS2Project`
 * (gms2-import.ts) is the only caller that builds a real `MigrationReportEntry[]`
 * from an actual import run; `migrationReport` itself can be exercised with a
 * hand-built fixture in tests with no filesystem touched.
 */

export type MigrationEntryKind =
  | "object"
  | "script"
  | "room"
  | "sprite"
  | "sound"
  | "tileset";

export type MigrationEntryStatus = "converted" | "manual";

export interface MigrationReportEntry {
  kind: MigrationEntryKind;
  name: string;
  status: MigrationEntryStatus;
  /** Shown next to a manual-status asset, e.g. why conversion failed. */
  note?: string;
}

export interface MigrationReportOptions {
  projectName: string;
  entries: MigrationReportEntry[];
  warnings: string[];
}

const CATEGORY_LABELS: Record<
  `${MigrationEntryKind}:${MigrationEntryStatus}`,
  string
> = {
  "object:converted": "Objects (converted)",
  "object:manual": "Objects (manual)",
  "script:converted": "Scripts (converted)",
  "script:manual": "Scripts (manual)",
  "room:converted": "Rooms (converted)",
  "room:manual": "Rooms (manual)",
  "sprite:converted": "Sprites (converted)",
  "sprite:manual": "Sprites (manual)",
  "sound:converted": "Sounds (converted)",
  "sound:manual": "Sounds (manual)",
  "tileset:converted": "Tilesets (converted)",
  "tileset:manual": "Tilesets (manual)",
};

// The rows to always render, in this order, even when a category is empty
// (count 0) — matches the original report's fixed table shape.
const SUMMARY_ROWS: Array<[MigrationEntryKind, MigrationEntryStatus]> = [
  ["object", "converted"],
  ["script", "converted"],
  ["room", "converted"],
  ["room", "manual"],
  ["sprite", "converted"],
  ["sprite", "manual"],
  ["sound", "manual"],
  ["tileset", "manual"],
];

function labelFor(kind: MigrationEntryKind): string {
  switch (kind) {
    case "object":
      return "Object";
    case "script":
      return "Script";
    case "room":
      return "Room";
    case "sprite":
      return "Sprite";
    case "sound":
      return "Sound";
    case "tileset":
      return "Tileset";
  }
}

/**
 * Build the Markdown migration report from a plain, already-computed list of
 * migration entries — a pure function from data to string, independently
 * testable with a hand-built fixture and no filesystem involved.
 */
export function migrationReport(opts: MigrationReportOptions): string {
  const { projectName, entries, warnings } = opts;

  const manualEntries = entries.filter((e) => e.status === "manual");
  const manualAssets = manualEntries.map((e) => {
    const label = labelFor(e.kind);
    const note = e.note ? ` (${e.note})` : "";
    return `- ${label}: \`${e.name}\`${note}`;
  });

  const totalFound = entries.length;
  const totalConverted = entries.filter((e) => e.status === "converted").length;

  const warningSection =
    warnings.length > 0
      ? `\n## Warnings\n\n${warnings.map((w) => `- ${w}`).join("\n")}\n`
      : "";

  const summaryRows = SUMMARY_ROWS.map(([kind, status]) => {
    const count = entries.filter(
      (e) => e.kind === kind && e.status === status,
    ).length;
    return `| ${CATEGORY_LABELS[`${kind}:${status}`]} | ${count} |`;
  }).join("\n");

  return `# GMS2 Migration Report — ${projectName}

## Asset Summary

| Category | Count |
|----------|-------|
${summaryRows}
| **Total found** | **${totalFound}** |
| **Total converted** | **${totalConverted}** |

## Converted Assets

Objects and scripts have been emitted as TypeScript stubs in this directory.
See \`project.ts\` for the generated entrypoint.
${warningSection}
## Assets Needing Manual Work

The following asset types have no automatic migration path and must be recreated manually:

${manualAssets.length > 0 ? manualAssets.join("\n") : "_None_"}

## Next Steps

1. **Objects** — open each \`obj_*.ts\` stub and migrate the GML event logic into the corresponding TypeScript method. See [Core Reference](/manual/04-core-reference.md) for Entity/Component APIs.
2. **Scripts** — open each \`scr_*.ts\` stub and migrate the GML function bodies. See [Language Reference](/manual/10-language-reference.md).
3. **Rooms** — recreate your room layouts as EmptySock Scenes. See [Architecture](/manual/03-architecture.md).
4. **Sprites** — import sprite sheets into the IDE asset panel. See [IDE Reference](/manual/07-ide-reference.md).
5. **Sounds** — add audio files via the IDE. See [Systems Reference](/manual/05-systems-reference.md).
6. **Tilesets** — recreate tilesets and wire them to your scenes.
7. **Register components** — call \`registerAll()\` from \`project.ts\` in your scene's \`onLoad()\`.
8. **Physics** — if your GMS2 project used built-in physics, review [Systems Reference § Physics](/manual/05-systems-reference.md).
`;
}

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
  | "tileset"
  | "font"
  | "note";

/**
 * "copied" is distinct from "converted": a `note` resource's real text
 * content is preserved verbatim (copied) into the import output, but it
 * never becomes a real `@emptysock/engine`-native asset the way a
 * sprite/sound/room/font does — there is no engine-side "note" concept and
 * there shouldn't be one. Keeping the two statuses separate lets the report
 * say "content preserved as reference material" for notes without
 * overclaiming the same kind of conversion a gameplay asset gets.
 */
export type MigrationEntryStatus = "converted" | "manual" | "copied";

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

const CATEGORY_LABELS: Partial<
  Record<`${MigrationEntryKind}:${MigrationEntryStatus}`, string>
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
  "font:converted": "Fonts (converted)",
  "font:manual": "Fonts (manual)",
  "note:copied": "Notes (copied)",
  "note:manual": "Notes (manual)",
};

// The rows to always render, in this order, even when a category is empty
// (count 0) — matches the original report's fixed table shape.
const SUMMARY_ROWS: Array<[MigrationEntryKind, MigrationEntryStatus]> = [
  ["object", "converted"],
  ["object", "manual"],
  ["script", "converted"],
  ["room", "converted"],
  ["room", "manual"],
  ["sprite", "converted"],
  ["sprite", "manual"],
  ["sound", "converted"],
  ["sound", "manual"],
  ["font", "converted"],
  ["font", "manual"],
  ["note", "copied"],
  ["note", "manual"],
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
    case "font":
      return "Font";
    case "note":
      return "Note";
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

  const copiedEntries = entries.filter((e) => e.status === "copied");
  const copiedAssets = copiedEntries.map(
    (e) => `- ${labelFor(e.kind)}: \`${e.name}\``,
  );

  const totalFound = entries.length;
  const totalConverted = entries.filter(
    (e) => e.status === "converted" || e.status === "copied",
  ).length;

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

Each object was emitted as a \`<name>.prefab.json\` (a real \`PrefabFile\` every
\`Scene.spawn()\` can load directly) plus a companion \`<name>.behavior.ts\`
holding its transpiled GML event handlers as plain exported functions. Each
room was emitted as a \`rooms/<name>.scene.json\` (a real \`SceneFile\`) listing
its prefab instances — including a real \`Transform\`+\`Sprite\` entity on the
engine's built-in \`"background"\` render layer for any room background image.
Each sound was emitted as \`assets/<name>.sound.ts\`, its real audio file
copied alongside it, ready for \`AudioSystem.load\`/\`.play\`. Each font was
emitted as \`assets/<name>.font.ts\` — family/size/style metadata only, since
this engine renders text via Canvas/CSS fonts, not bitmap glyph atlases; the
source glyph atlas image itself was not copied. See \`project-manifest.json\`
for the full list of prefab/behavior/scene files this import produced.
${warningSection}
## Reference Material Copied (Not Engine Assets)

GMS2 "note" resources (including GameMaker's own auto-generated
compatibility-report notes) are IDE-only documentation with no equivalent
concept in \`@emptysock/engine\` — nothing was fabricated to call these
"converted" the way a sprite or sound is. Their real text content was copied
verbatim into \`notes/<name>.md\` so it's still available to read, not lost:

${copiedAssets.length > 0 ? copiedAssets.join("\n") : "_None_"}

## Assets Needing Manual Work

The following asset types have no automatic migration path and must be recreated manually:

${manualAssets.length > 0 ? manualAssets.join("\n") : "_None_"}

## Next Steps

1. **Objects** — open each \`<name>.behavior.ts\` file and finish migrating any GML event logic the transpiler could not convert (unresolved identifiers are left as-is, not faked). Wire these functions to their prefab instances from your own game code — see [Core Reference](/manual/04-core-reference.md) for the Entity/Component APIs the functions receive.
2. **Scripts** — open each \`<name>.ts\` script stub and migrate the GML function bodies. See [Language Reference](/manual/10-language-reference.md).
3. **Rooms** — open each \`rooms/<name>.scene.json\` and load it via \`loadSceneFile\`/\`Scene.spawn()\`; adjust prefab instance placement as needed. See [Architecture](/manual/03-architecture.md).
4. **Sprites** — import sprite sheets into the IDE asset panel. See [IDE Reference](/manual/07-ide-reference.md).
5. **Sounds** — each converted sound's \`assets/<name>.sound.ts\` shows the exact \`AudioSystem.load\`/\`.play\` call to wire it up; the real audio file is already copied alongside it.
6. **Fonts** — each converted font's \`assets/<name>.font.ts\` gives the \`Label\`/\`ButtonState\`/\`Checkbox\` \`font\`/\`fontSize\` values to use; make sure the family is actually installed wherever the game runs.
7. **Notes** — read \`notes/<name>.md\` for any GMS2 note content (including auto-generated compatibility reports) worth carrying into your project's own docs.
8. **Tilesets** — recreate tilesets and wire them to your scenes.
9. **Load the manifest** — read \`project-manifest.json\` from your game's bootstrap code to enumerate every generated prefab/behavior/scene file.
10. **Physics** — if your GMS2 project used built-in physics, review [Systems Reference § Physics](/manual/05-systems-reference.md).
`;
}

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
  | "note"
  | "shader"
  | "timeline"
  | "sequence"
  | "extension"
  | "includedFile"
  | "enum";

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

/** A defect in the original GameMaker source, found by `gms2-source-bugs.ts`. */
export interface SourceBugFinding {
  kind: "unset-variable" | "missing-font" | "missing-sprite" | "missing-object";
  name: string;
  /** `objects/<name>/<Event>.gml:<line>` */
  location: string;
  detail: string;
  /** What the importer emitted instead of code that throws. */
  emitted: string;
}

export interface MigrationReportOptions {
  projectName: string;
  entries: MigrationReportEntry[];
  warnings: string[];
  sourceBugs?: readonly SourceBugFinding[];
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
  "shader:converted": "Shaders (converted)",
  "shader:manual": "Shaders (manual)",
  "timeline:converted": "Timelines (converted)",
  "timeline:manual": "Timelines (manual)",
  "sequence:converted": "Sequences (converted)",
  "sequence:manual": "Sequences (manual)",
  "extension:converted": "Extensions (converted)",
  "extension:manual": "Extensions (manual)",
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
  ["shader", "converted"],
  ["shader", "manual"],
  ["timeline", "converted"],
  ["timeline", "manual"],
  ["sequence", "converted"],
  ["sequence", "manual"],
  ["extension", "converted"],
  ["extension", "manual"],
  ["tileset", "converted"],
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
    case "shader":
      return "Shader";
    case "timeline":
      return "Timeline";
    case "sequence":
      return "Sequence";
    case "extension":
      return "Extension";
    case "includedFile":
      return "Included File(s)";
    case "enum":
      return "Enum";
  }
}

/**
 * Build the Markdown migration report from a plain, already-computed list of
 * migration entries — a pure function from data to string, independently
 * testable with a hand-built fixture and no filesystem involved.
 */
export function migrationReport(opts: MigrationReportOptions): string {
  const { projectName, entries, warnings, sourceBugs = [] } = opts;

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

  const bugKindLabel: Record<SourceBugFinding["kind"], string> = {
    "unset-variable": "Variable read but never set",
    "missing-font": "Font not in the project",
    "missing-sprite": "Sprite not in the project",
    "missing-object": "Object not in the project",
  };
  const sourceBugSection =
    sourceBugs.length > 0
      ? `\n## Source bugs (defects in the original project)\n\nThese are problems in the GameMaker source itself, not conversion failures: a name is used that nothing in the project defines. GameMaker would fail (or draw nothing) if the line ran. The import emits a defined-safe default so the converted game does not throw; decide whether each should be fixed in the game.\n\n${sourceBugs
          .map(
            (b) =>
              `- **${bugKindLabel[b.kind]}**: \`${b.name}\` at \`${b.location}\`. ${b.detail} Emitted: ${b.emitted}.`,
          )
          .join("\n")}\n`
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
room was emitted as a \`rooms/<name>.scene.json\` (a real \`SceneDocument\`, \`formatVersion: 2\`) listing
its prefab instances — including a real \`Transform\`+\`Sprite\` entity on the
engine's built-in \`"background"\` render layer for any room background image.
Each sound was emitted as \`assets/<name>.sound.ts\`, its real audio file
copied alongside it, ready for \`AudioSystem.load\`/\`.play\`. Each font was
emitted as \`assets/<name>.font.ts\` — family/size/style metadata only, since
this engine renders text via Canvas/CSS fonts, not bitmap glyph atlases; the
source glyph atlas image itself was not copied. Each GLSL ES shader was
mechanically translated to \`assets/<name>.shader.ts\` for
\`CustomShaderFilter\`/\`RenderSystem.addLayerShaderFilter\` — GPU compilation
was not verified (no headless WebGL context available at import time); an
HLSL11 shader (DirectX-only, structurally different from GLSL) or a shader
with non-passthrough per-vertex logic this importer can't safely reproduce is
reported manual instead. Each timeline was emitted as \`<name>.timeline.ts\`
(a real \`TimelineModule\` for \`@emptysock/engine\`'s \`TimelineState\`/
\`TimelineSystem\`) with one transpiled function per moment. Each sequence
was emitted as \`<name>.sequence.ts\` (a real \`GmlSequenceData\` for
\`GmlSequenceState\`/\`GmlSequenceSystem\`); only root-level, numeric,
Transform/Sprite-targeting tracks (position/scale/rotation/image_blend/
image_alpha) convert — nested instance/graphic/group tracks and non-numeric
track kinds are reported, never silently dropped. Each extension's GML- or
JS-backed functions were emitted as \`<extension>/<file>.ts\`; a
native-library-backed function (\`.dll\`/\`.so\`/\`.dylib\`/\`.jar\`/Obj-C) has no
source to convert and is listed by name below. Each tileset was emitted as
\`assets/<name>.tileset.ts\` (a real \`TilesetConfig\` for
\`@emptysock/tilemap\`'s \`TilemapSystem\`), its source tile-sheet image (found
via the tileset's own real \`spriteId\` reference) copied alongside it; a
room's tile layers get a real \`rooms/<name>.tilemap.ts\` (a real
\`TilemapData\`) per distinct, successfully-converted tileset they reference
— \`rooms/<name>.tilemap.ts\` itself when the room uses exactly one tileset,
or one sibling \`rooms/<name>.<tileset>.tilemap.ts\` per tileset when it uses
several, each holding only that tileset's own placed tile data. See
\`project-manifest.json\` for the full list of prefab/behavior/scene files
this import produced.
${warningSection}${sourceBugSection}
## Reference Material Copied (Not Engine Assets)

GMS2 "note" resources (including GameMaker's own auto-generated
compatibility-report notes) are IDE-only documentation with no equivalent
concept in \`@emptysock/engine\` — nothing was fabricated to call these
"converted" the way a sprite or sound is. Their real text content was copied
verbatim into \`notes/<name>.txt\` so it's still available to read, not lost:

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
7. **Notes** — read \`notes/<name>.txt\` for any GMS2 note content (including auto-generated compatibility reports) worth carrying into your project's own docs.
8. **Tilesets** — each converted tileset's \`assets/<name>.tileset.ts\` is a real \`TilesetConfig\`, its source tile-sheet image copied alongside it; a room's tile layers produce one \`TilemapData\` module per distinct converted tileset they reference (\`rooms/<name>.tilemap.ts\` for a single tileset, \`rooms/<name>.<tileset>.tilemap.ts\` per tileset when there are several) — call \`TilemapSystem.register(...)\`/\`.loadInto(scene, name)\` (\`@emptysock/tilemap\`) once per module to load them all into the same room. A tileset reported manual still leaves the tile data referencing it unconverted — see the warnings above — and needs to be recreated by hand.
9. **Load the manifest** — read \`project-manifest.json\` from your game's bootstrap code to enumerate every generated prefab/behavior/scene file.
10. **Physics** — if your GMS2 project used built-in physics, review [Systems Reference § Physics](/manual/05-systems-reference.md).
11. **Shaders** — each converted shader's \`assets/<name>.shader.ts\` gives the \`vertexSrc\`/\`fragmentSrc\` to pass to \`createCustomShaderFilter\`; GPU compilation was not verified during import, so test it in-engine before shipping. A shader reported manual (HLSL11, or non-passthrough vertex logic) needs to be rewritten by hand against \`CustomShaderFilter\`'s GLSL ES 3.00 contract.
12. **Timelines** — register each \`<name>.timeline.ts\`'s default export with \`registerGmlTimeline(id, module)\`, then attach \`TimelineState\` to an entity and set \`running: true\` to play it.
13. **Sequences** — register each \`<name>.sequence.ts\`'s export with \`registerGmlSequence(id, data)\`, then attach \`GmlSequenceState\` to an entity and set \`playing: true\`. Review any sequence noted with skipped tracks — those animation channels need to be recreated by hand (e.g. with \`TweenManager\`/\`SequenceSystem\`).
14. **Extensions** — review each \`extensions/<name>/<file>.ts\` module before shipping; a native-library-backed function listed in the warnings above has no automatic migration path and must be reimplemented or replaced.
`;
}

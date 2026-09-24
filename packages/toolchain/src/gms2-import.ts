import fs from "fs/promises";
import path from "path";
import { parseGmsJson, type YYProject } from "./gms2-parse.js";
import {
  buildObjectBehavior,
  buildObjectPrefabJSON,
  buildRoomSceneJSON,
  buildSpriteAsset,
  projectManifestJSON,
  scriptStub,
} from "./gms2-codegen.js";
import { migrationReport, type MigrationReportEntry } from "./gms2-report.js";
import {
  convertGms2Room,
  convertGms2RoomBackgrounds,
} from "./gms2-room-import.js";
import { buildSoundAsset } from "./gms2-sound-import.js";
import { convertGms2Font, buildFontAsset } from "./gms2-font-import.js";
import { convertGms2Note, buildNoteMarkdown } from "./gms2-note-import.js";

// Re-exported for backward compatibility — some callers (and the test
// suite) import `parseGmsJson` directly from this module.
export { parseGmsJson } from "./gms2-parse.js";

export interface ImportResult {
  converted: number;
  skipped: string[];
  warnings: string[];
}

export async function importGMS2Project(
  yypPath: string,
  outDir: string,
  opts?: { dryRun?: boolean; verbose?: boolean },
): Promise<ImportResult> {
  const dryRun = opts?.dryRun ?? false;
  const verbose = opts?.verbose ?? false;

  const warnings: string[] = [];
  const skipped: string[] = [];
  let converted = 0;

  // Read and parse the .yyp file
  let raw: string;
  try {
    raw = await fs.readFile(yypPath, "utf-8");
  } catch {
    throw new Error(`Cannot read .yyp file at "${yypPath}"`);
  }

  let project: YYProject;
  try {
    project = parseGmsJson(raw) as YYProject;
  } catch {
    throw new Error(`Failed to parse .yyp file as JSON: "${yypPath}"`);
  }

  if (!Array.isArray(project.resources)) {
    throw new Error('.yyp file does not contain a "resources" array');
  }

  const projectName =
    project.name ?? project["%Name"] ?? path.basename(path.dirname(yypPath));
  // Root of the GMS2 project — where objects/, scripts/ etc. live.
  const projectRoot = path.dirname(yypPath);

  // NOTE: `defaultScriptType` in real .yyp files does NOT reliably indicate
  // "this project uses GML Visual (drag-and-drop)" — a real, fully
  // text-GML project (verified against the J3 Adventure fixture) can carry
  // defaultScriptType: 1 and still have ordinary .gml files for every
  // event. Whether an individual event is GML Visual is only knowable by
  // checking for the corresponding .gml file per object/event, which
  // buildObjectBehavior already does (falling back to a TODO stub when no
  // .gml file is found). We no longer emit a project-wide warning from
  // this field alone, since it produced false positives on real projects.

  // Classify assets by the path prefix in each resource's id.path
  const objects: string[] = [];
  const scripts: string[] = [];
  const rooms: string[] = [];
  const sprites: string[] = [];
  const sounds: string[] = [];
  const tilesets: string[] = [];
  const fonts: string[] = [];
  const notes: string[] = [];

  for (const res of project.resources) {
    const name = res.id.name;
    const resPath = res.id.path;
    if (!name) {
      warnings.push(`Resource with missing name skipped (path: ${resPath})`);
      continue;
    }

    if (resPath.startsWith("objects/")) {
      objects.push(name);
    } else if (resPath.startsWith("scripts/")) {
      scripts.push(name);
    } else if (resPath.startsWith("rooms/")) {
      rooms.push(name);
    } else if (resPath.startsWith("sprites/")) {
      sprites.push(name);
    } else if (resPath.startsWith("sounds/")) {
      sounds.push(name);
    } else if (resPath.startsWith("tilesets/")) {
      tilesets.push(name);
    } else if (resPath.startsWith("fonts/")) {
      fonts.push(name);
    } else if (resPath.startsWith("notes/")) {
      // GameMaker's own auto-generated compatibility-report resources are
      // also plain GMNote notes under notes/, so this one bucket covers both.
      notes.push(name);
    } else {
      // A resource type this importer has no migration path for at all
      // (extensions, timelines, and any other kind this importer has never
      // been audited against) — not one of the categories above that get
      // their own report-table row. Still surfaced as a real warning so it
      // shows up in migration-report.md, rather than only living in the
      // returned `skipped` array where a caller reading just the generated
      // report file would never learn it exists.
      skipped.push(name);
      warnings.push(
        `"${name}" (${resPath}) has no import path in this tool and was skipped entirely — recreate it manually.`,
      );
      if (verbose) {
        console.log(
          `  [skip] ${name} (unrecognised resource path: ${resPath})`,
        );
      }
    }
  }

  // Build the list of files to write, and the plain report-entry data
  // alongside it. Report-entry construction never touches the filesystem —
  // only `filesToWrite`'s contents (built via the same loops) does.
  const filesToWrite: { rel: string; content: string }[] = [];
  const reportEntries: MigrationReportEntry[] = [];

  for (const name of objects) {
    if (verbose) console.log(`  [object] ${name}`);
    const prefabJSON = buildObjectPrefabJSON(name);
    const behavior = await buildObjectBehavior(name, projectRoot);
    filesToWrite.push({ rel: `${name}.prefab.json`, content: prefabJSON });
    filesToWrite.push({ rel: `${name}.behavior.ts`, content: behavior });
    reportEntries.push({ kind: "object", name, status: "converted" });
  }

  for (const name of scripts) {
    if (verbose) console.log(`  [script] ${name}`);
    filesToWrite.push({ rel: `${name}.ts`, content: scriptStub(name) });
    reportEntries.push({ kind: "script", name, status: "converted" });
  }

  const convertedSprites: string[] = [];
  for (const name of sprites) {
    if (verbose) console.log(`  [sprite] ${name}`);
    try {
      const content = await buildSpriteAsset(name, projectRoot, outDir);
      filesToWrite.push({ rel: `assets/${name}.sprite.ts`, content });
      convertedSprites.push(name);
      reportEntries.push({ kind: "sprite", name, status: "converted" });
    } catch (err) {
      const reason = `conversion failed (${String(err)}) — skipped, needs manual import`;
      warnings.push(
        `Sprite "${name}" could not be converted (${String(err)}) — skipped, needs manual import.`,
      );
      skipped.push(name);
      reportEntries.push({
        kind: "sprite",
        name,
        status: "manual",
        note: reason,
      });
    }
  }

  const convertedRooms: string[] = [];
  for (const name of rooms) {
    if (verbose) console.log(`  [room] ${name}`);
    try {
      const sceneJSON = await buildRoomSceneJSON(name, projectRoot, objects);
      const room = await convertGms2Room(
        path.join(projectRoot, "rooms", name, `${name}.yy`),
      );

      // Real background images (a GMRBackgroundLayer with a real spriteId)
      // now get a genuine runtime representation: a Transform+Sprite entity
      // on the engine's built-in "background" render layer, sized to cover
      // the room — see convertGms2RoomBackgrounds's doc comment for why this
      // is a direct SceneFileEntity rather than a prefab instance. Merged
      // into the already-built .scene.json rather than threading this
      // through buildRoomSceneJSON itself (gms2-codegen.ts has ongoing
      // parallel work in flight this pass avoids touching).
      const { entities: backgroundEntities, failed: failedBackgrounds } =
        await convertGms2RoomBackgrounds(room, projectRoot, outDir);

      let content = sceneJSON;
      if (backgroundEntities.length > 0) {
        const scene = JSON.parse(sceneJSON) as {
          entities?: unknown[];
          [key: string]: unknown;
        };
        scene.entities = [...(scene.entities ?? []), ...backgroundEntities];
        content = JSON.stringify(scene, null, 2) + "\n";
      }
      // A background sprite that failed to convert (missing on disk, bad
      // frame data, …) is reported here — convertGms2RoomBackgrounds already
      // explains why per-sprite, so there's nothing further to add.
      for (const failure of failedBackgrounds) {
        warnings.push(
          `${failure} It has been left out of the generated .scene.json — recreate it manually.`,
        );
      }

      filesToWrite.push({ rel: `rooms/${name}.scene.json`, content });
      convertedRooms.push(name);
      reportEntries.push({ kind: "room", name, status: "converted" });
    } catch (err) {
      const note = "conversion failed — see warnings";
      warnings.push(
        `Room "${name}" could not be converted (${String(err)}) — skipped, needs manual import.`,
      );
      skipped.push(name);
      reportEntries.push({ kind: "room", name, status: "manual", note });
    }
  }
  for (const name of sounds) {
    if (verbose) console.log(`  [sound] ${name}`);
    try {
      const content = await buildSoundAsset(name, projectRoot, outDir);
      filesToWrite.push({ rel: `assets/${name}.sound.ts`, content });
      reportEntries.push({ kind: "sound", name, status: "converted" });
    } catch (err) {
      const reason = `conversion failed (${String(err)}) — skipped, needs manual import`;
      warnings.push(
        `Sound "${name}" could not be converted (${String(err)}) — skipped, needs manual import.`,
      );
      skipped.push(name);
      reportEntries.push({
        kind: "sound",
        name,
        status: "manual",
        note: reason,
      });
    }
  }
  for (const name of fonts) {
    if (verbose) console.log(`  [font] ${name}`);
    try {
      const font = await convertGms2Font(path.join(projectRoot, "fonts", name));
      const content = buildFontAsset(font);
      filesToWrite.push({ rel: `assets/${name}.font.ts`, content });
      reportEntries.push({ kind: "font", name, status: "converted" });
      warnings.push(
        `Font "${name}" converted as family/size/style metadata only — its pre-rendered glyph atlas image was not used, since @emptysock/engine renders text via Canvas/CSS fonts, not bitmap glyph atlases.`,
      );
    } catch (err) {
      const reason = `conversion failed (${String(err)}) — skipped, needs manual import`;
      warnings.push(
        `Font "${name}" could not be converted (${String(err)}) — skipped, needs manual import.`,
      );
      skipped.push(name);
      reportEntries.push({
        kind: "font",
        name,
        status: "manual",
        note: reason,
      });
    }
  }
  for (const name of notes) {
    if (verbose) console.log(`  [note] ${name}`);
    try {
      const note = await convertGms2Note(path.join(projectRoot, "notes", name));
      const content = buildNoteMarkdown(note);
      filesToWrite.push({ rel: `notes/${name}.md`, content });
      reportEntries.push({ kind: "note", name, status: "copied" });
    } catch (err) {
      const reason = `could not be read (${String(err)}) — skipped, needs manual import`;
      warnings.push(
        `Note "${name}" could not be copied (${String(err)}) — skipped, needs manual import.`,
      );
      skipped.push(name);
      reportEntries.push({
        kind: "note",
        name,
        status: "manual",
        note: reason,
      });
    }
  }
  for (const name of tilesets) {
    if (verbose) console.log(`  [skip/manual] tileset: ${name}`);
    skipped.push(name);
    reportEntries.push({ kind: "tileset", name, status: "manual" });
  }

  filesToWrite.push({
    rel: "project-manifest.json",
    content: projectManifestJSON(objects, convertedRooms),
  });
  filesToWrite.push({
    rel: "migration-report.md",
    content: migrationReport({
      projectName,
      entries: reportEntries,
      warnings,
    }),
  });

  if (dryRun) {
    console.log(
      `[dry-run] Would write ${filesToWrite.length} files to: ${outDir}`,
    );
    for (const f of filesToWrite) {
      console.log(`  ${f.rel}`);
    }
  } else {
    await fs.mkdir(outDir, { recursive: true });
    for (const f of filesToWrite) {
      const dest = path.join(outDir, f.rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, f.content, "utf-8");
      if (verbose) console.log(`  wrote: ${dest}`);
    }
  }

  converted = reportEntries.filter(
    (e) => e.status === "converted" || e.status === "copied",
  ).length;
  return { converted, skipped, warnings };
}

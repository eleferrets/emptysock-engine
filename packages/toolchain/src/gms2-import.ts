import fs from "fs/promises";
import path from "path";
import {
  parseGmsJson,
  normalizeYypResources,
  buildLegacyResourceGuidMap,
  type YYProject,
} from "./gms2-parse.js";
import {
  buildObjectBehavior,
  buildObjectPrefabJSON,
  buildRoomSceneJSON,
  buildSpriteAsset,
  buildScriptModule,
  projectManifestJSON,
} from "./gms2-codegen.js";
import { migrationReport, type MigrationReportEntry } from "./gms2-report.js";
import {
  convertGms2Room,
  convertGms2RoomBackgrounds,
} from "./gms2-room-import.js";
import { buildSoundAsset } from "./gms2-sound-import.js";
import { convertGms2Font, buildFontAsset } from "./gms2-font-import.js";
import { convertGms2Note, buildNoteMarkdown } from "./gms2-note-import.js";
import {
  convertGms2Shader,
  buildShaderAsset,
  ShaderTranslationError,
} from "./gms2-shader-import.js";
import { buildTimelineModule } from "./gms2-timeline-import.js";
import {
  convertGms2Sequence,
  buildSequenceModule,
} from "./gms2-sequence-import.js";
import { convertGms2Extension } from "./gms2-extension-import.js";

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
  const shaders: string[] = [];
  const timelines: string[] = [];
  const sequences: string[] = [];
  const extensions: string[] = [];

  const resources = normalizeYypResources(project.resources);
  const guidToObjectName = buildLegacyResourceGuidMap(project.resources);
  for (const res of resources) {
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
    } else if (resPath.startsWith("shaders/")) {
      shaders.push(name);
    } else if (resPath.startsWith("timelines/")) {
      timelines.push(name);
    } else if (resPath.startsWith("sequences/")) {
      sequences.push(name);
    } else if (resPath.startsWith("extensions/")) {
      extensions.push(name);
    } else {
      // A resource type this importer has no migration path for at all
      // (e.g. GameMaker's own IDE-only asset kinds this importer has never
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

  const convertedObjects: string[] = [];
  for (const name of objects) {
    if (verbose) console.log(`  [object] ${name}`);
    // A stale/orphaned resource-list entry (common in long-lived real GMS2
    // projects — a resource deleted from disk without being fully removed
    // from the .yyp) must be reported honestly, not silently treated as a
    // successful conversion with a fabricated empty prefab. This mirrors
    // convertGms2Sound/convertGms2Font/convertGms2Note's existing "check the
    // real file/directory exists, fail honestly if not" pattern. An object
    // directory that exists but has zero .gml files is a real, valid,
    // different case (an object with only a sprite/properties and no code)
    // and must still convert — only a genuinely missing .yy is a failure.
    const objectYyPath = path.join(projectRoot, "objects", name, `${name}.yy`);
    let objectExists = true;
    try {
      await fs.access(objectYyPath);
    } catch {
      objectExists = false;
    }

    if (!objectExists) {
      const reason =
        "object's .yy not found on disk, likely a stale/orphaned project reference";
      warnings.push(
        `Object "${name}" could not be converted (${reason}) — skipped, needs manual import.`,
      );
      skipped.push(name);
      reportEntries.push({
        kind: "object",
        name,
        status: "manual",
        note: reason,
      });
      continue;
    }

    const prefabJSON = await buildObjectPrefabJSON(name, projectRoot);
    const behavior = await buildObjectBehavior(name, projectRoot, scripts);
    filesToWrite.push({ rel: `${name}.prefab.json`, content: prefabJSON });
    filesToWrite.push({ rel: `${name}.behavior.ts`, content: behavior });
    convertedObjects.push(name);
    reportEntries.push({ kind: "object", name, status: "converted" });
  }

  for (const name of scripts) {
    if (verbose) console.log(`  [script] ${name}`);
    const content = await buildScriptModule(name, projectRoot, scripts);
    filesToWrite.push({ rel: `${name}.ts`, content });
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
      const sceneJSON = await buildRoomSceneJSON(
        name,
        projectRoot,
        convertedObjects,
        guidToObjectName,
      );
      const room = await convertGms2Room(
        path.join(projectRoot, "rooms", name, `${name}.yy`),
        guidToObjectName,
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

      // convertGms2Room's parseTiles() already parses every GMRTileLayer's
      // placed tile data into RoomLayer.tiles, but buildRoomSceneJSON has no
      // way to carry it into the generated .scene.json — @emptysock/tilemap's
      // TilemapSystem.register() needs a real TilesetConfig (image path,
      // tile size, column/row count) that would have to come from actually
      // converting the referenced *tileset* resource, and tilesets are
      // currently reported "manual" (no import path at all — see the
      // tilesets loop below), so there is no real converted tileset asset to
      // point a generated Tilemap at yet. Rather than let this be silent
      // data loss (an asset invisible in migration-report.md is effectively
      // undocumented, per this importer's rule for every other asset kind),
      // surface it as a real, honest warning and report note naming exactly
      // how many tiles/tile layers were dropped, so nobody discovers a
      // "converted" room is actually missing its tile-based level geometry
      // only by noticing it's missing in-game.
      const tileLayers = room.layers.filter((layer) => layer.tiles.length > 0);
      const totalTiles = tileLayers.reduce(
        (sum, layer) => sum + layer.tiles.length,
        0,
      );
      let roomNote: string | undefined;
      if (totalTiles > 0) {
        roomNote = `${totalTiles} tile(s) across ${tileLayers.length} tile layer(s) parsed but not converted — this importer has no Tilemap-asset conversion path yet (would need the referenced tileset resource converted first). Recreate tile layers manually with @emptysock/tilemap.`;
        warnings.push(`Room "${name}": ${roomNote}`);
      }
      reportEntries.push({
        kind: "room",
        name,
        status: "converted",
        ...(roomNote !== undefined ? { note: roomNote } : {}),
      });
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
  for (const name of shaders) {
    if (verbose) console.log(`  [shader] ${name}`);
    try {
      const shader = await convertGms2Shader(
        path.join(projectRoot, "shaders", name),
      );
      if (shader.language === "hlsl11") {
        const reason =
          "written in HLSL11 (DirectX-only, structurally different from GLSL) — this importer only translates GLSL ES shaders; recreate this shader manually against CustomShaderFilter";
        warnings.push(`Shader "${name}" could not be converted (${reason}).`);
        skipped.push(name);
        reportEntries.push({
          kind: "shader",
          name,
          status: "manual",
          note: reason,
        });
        continue;
      }
      if (shader.language === "unknown") {
        const reason =
          "could not determine whether this shader is GLSL ES or HLSL11 from its source — recreate manually";
        warnings.push(`Shader "${name}" could not be converted (${reason}).`);
        skipped.push(name);
        reportEntries.push({
          kind: "shader",
          name,
          status: "manual",
          note: reason,
        });
        continue;
      }
      const content = buildShaderAsset(shader);
      filesToWrite.push({ rel: `assets/${name}.shader.ts`, content });
      reportEntries.push({ kind: "shader", name, status: "converted" });
      warnings.push(
        `Shader "${name}" converted mechanically from GameMaker's GLSL ES convention to @emptysock/engine's CustomShaderFilter contract — GPU compilation was not verified (no headless WebGL context available at import time); review the generated assets/${name}.shader.ts before shipping.`,
      );
    } catch (err) {
      const reason =
        err instanceof ShaderTranslationError
          ? err.message
          : `conversion failed (${String(err)}) — skipped, needs manual import`;
      warnings.push(`Shader "${name}" could not be converted (${reason}).`);
      skipped.push(name);
      reportEntries.push({
        kind: "shader",
        name,
        status: "manual",
        note: reason,
      });
    }
  }
  for (const name of timelines) {
    if (verbose) console.log(`  [timeline] ${name}`);
    try {
      const content = await buildTimelineModule(name, projectRoot);
      filesToWrite.push({ rel: `${name}.timeline.ts`, content });
      reportEntries.push({ kind: "timeline", name, status: "converted" });
    } catch (err) {
      const reason = `conversion failed (${String(err)}) — skipped, needs manual import`;
      warnings.push(`Timeline "${name}" could not be converted (${reason}).`);
      skipped.push(name);
      reportEntries.push({
        kind: "timeline",
        name,
        status: "manual",
        note: reason,
      });
    }
  }

  for (const name of sequences) {
    if (verbose) console.log(`  [sequence] ${name}`);
    try {
      const yyPath = path.join(projectRoot, "sequences", name, `${name}.yy`);
      const converted = await convertGms2Sequence(yyPath);
      const content = buildSequenceModule(name, converted);
      filesToWrite.push({ rel: `${name}.sequence.ts`, content });

      let note: string | undefined;
      if (converted.skippedTracks.length > 0) {
        note = `${converted.skippedTracks.length} track(s)/setting(s) not converted: ${converted.skippedTracks.join(", ")}.`;
        warnings.push(`Sequence "${name}": ${note}`);
      }
      if (converted.curvedKeyframes > 0) {
        const curveNote = `${converted.curvedKeyframes} keyframe(s) carried a real embedded animation curve, approximated as linear interpolation.`;
        warnings.push(`Sequence "${name}": ${curveNote}`);
        note = note !== undefined ? `${note} ${curveNote}` : curveNote;
      }
      reportEntries.push({
        kind: "sequence",
        name,
        status: "converted",
        ...(note !== undefined ? { note } : {}),
      });
    } catch (err) {
      const reason = `conversion failed (${String(err)}) — skipped, needs manual import`;
      warnings.push(
        `Sequence "${name}" could not be converted (${String(err)}).`,
      );
      skipped.push(name);
      reportEntries.push({
        kind: "sequence",
        name,
        status: "manual",
        note: reason,
      });
    }
  }

  for (const name of extensions) {
    if (verbose) console.log(`  [extension] ${name}`);
    try {
      const converted = await convertGms2Extension(name, projectRoot);
      for (const mod of converted.modules) {
        filesToWrite.push({
          rel: `extensions/${name}/${mod.fileName}`,
          content: mod.content,
        });
      }
      if (converted.nativeFunctions.length > 0) {
        const names = converted.nativeFunctions.map((fn) => fn.name).join(", ");
        warnings.push(
          `Extension "${name}": ${converted.nativeFunctions.length} native-library-backed function(s) have no source to convert and were skipped: ${names}. Reimplement or replace these manually.`,
        );
      }
      const status = converted.modules.length > 0 ? "converted" : "manual";
      const note =
        converted.nativeFunctions.length > 0
          ? `${converted.nativeFunctions.length} native function(s) skipped: ${converted.nativeFunctions.map((fn) => fn.name).join(", ")}`
          : undefined;
      reportEntries.push({
        kind: "extension",
        name,
        status,
        ...(note !== undefined ? { note } : {}),
      });
      if (status === "converted") {
        // (kept out of `skipped` — at least one function of this extension
        // has a real generated module, even if others are native-only.)
      } else {
        skipped.push(name);
      }
    } catch (err) {
      const reason = `conversion failed (${String(err)}) — skipped, needs manual import`;
      warnings.push(
        `Extension "${name}" could not be converted (${String(err)}).`,
      );
      skipped.push(name);
      reportEntries.push({
        kind: "extension",
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
    content: projectManifestJSON(convertedObjects, convertedRooms),
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

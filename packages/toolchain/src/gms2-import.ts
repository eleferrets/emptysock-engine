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
import {
  scanGmlMacros,
  setGmlMacros,
  setGmlEnumNames,
  setGmlObjectNames,
  setGmlSpriteNames,
  setGmlSoundNames,
  setGmlFontNames,
  setGmlShaderNames,
  setGmlRoomNames,
  setGmlCrossFileEntityRefFields,
  setGmlObjectFieldNames,
} from "./gms2-transpile.js";
import { scanGmlEnums, buildEnumsModule } from "./gms2-enums.js";
import {
  scanGmlCrossFileEntityRefFields,
  scanGmlObjectFieldNames,
} from "./gms2-crossfile-refs.js";
import { migrationReport, type MigrationReportEntry } from "./gms2-report.js";
import {
  convertGms2Room,
  convertGms2RoomBackgrounds,
  convertGms2RoomLayerElements,
  buildRoomSceneFileViews,
} from "./gms2-room-import.js";
import { buildSoundAsset } from "./gms2-sound-import.js";
import {
  convertGms2Font,
  buildFontAsset,
  copyFontAtlas,
} from "./gms2-font-import.js";
import { convertGms2Note, buildNoteText } from "./gms2-note-import.js";
import {
  convertGms2Shader,
  buildShaderAsset,
  ShaderTranslationError,
} from "./gms2-shader-import.js";
import { buildTimelineModule } from "./gms2-timeline-import.js";
import {
  buildTilesetAsset,
  buildRoomTilemapModule,
  type TilesetAsset,
} from "./gms2-tileset-import.js";
import {
  convertGms2Sequence,
  buildSequenceModule,
} from "./gms2-sequence-import.js";
import { convertGms2Extension } from "./gms2-extension-import.js";
import {
  convertGms2IncludedFiles,
  includedFilesManifestJSON,
} from "./gms2-includedfiles-import.js";

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
  opts?: { dryRun?: boolean; verbose?: boolean; compressAudio?: boolean },
): Promise<ImportResult> {
  const dryRun = opts?.dryRun ?? false;
  const verbose = opts?.verbose ?? false;
  const compressAudio = opts?.compressAudio ?? false;

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

  // Real, project-wide #macro resolution must happen before any file is
  // transpiled — a macro defined in one script is routinely used in a
  // dozen unrelated object/script files (see `scanGmlMacros`'s own doc
  // comment in gms2-transpile.ts).
  setGmlMacros(await scanGmlMacros(projectRoot));

  // Real, project-wide `enum Name { ... }` resolution — same "must happen
  // before any file is transpiled" reasoning as #macro above (see
  // `scanGmlEnums`'s own doc comment in gms2-enums.ts and CLAUDE.md's "Real
  // project-defined GML enums" section). The shared generated module is
  // written once, up front, so every object/script's own generated file
  // can import from it regardless of import order.
  const gmlEnums = await scanGmlEnums(projectRoot);
  setGmlEnumNames(new Set(gmlEnums.keys()));

  // Real, project-wide cross-file Entity-reference field-name resolution —
  // same "must happen before any file is transpiled" reasoning as #macro/
  // enum above (see `scanGmlCrossFileEntityRefFields`'s own doc comment in
  // gms2-crossfile-refs.ts and CLAUDE.md's "real cross-file dataflow
  // analysis" entry). A field one object's `with (target) { field =
  // other.id; }` assignment populates is routinely read from a wholly
  // different object's own event files, so this has to be known before any
  // single file's dotted-reference rewrite pass runs.
  setGmlCrossFileEntityRefFields(
    await scanGmlCrossFileEntityRefFields(projectRoot),
  );

  // Real, project-wide per-object implicit-instance-variable field names —
  // same "must happen before any file is transpiled" reasoning as above.
  // Closes a real, confirmed gap distinct from the Entity-reference scan:
  // a script's `with (objName) { field = ...; }` reading a plain instance
  // field `objName`'s own event files assign via ordinary assignment (not
  // the `other.id` back-reference idiom) — see
  // `scanGmlObjectFieldNames`'s own doc comment.
  setGmlObjectFieldNames(await scanGmlObjectFieldNames(projectRoot));

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

  // Always written, even when the project declares zero enums — every
  // generated object/script file that (conditionally) imports
  // `assets/gml-enums.generated.js` must find a real file there.
  filesToWrite.push({
    rel: "assets/gml-enums.generated.ts",
    content: buildEnumsModule(gmlEnums),
  });
  if (gmlEnums.size > 0) {
    reportEntries.push({
      name: "gml-enums",
      kind: "enum",
      status: "converted",
      note: `${gmlEnums.size} real GML enum(s) resolved project-wide (${[...gmlEnums.keys()].join(", ")}) — see assets/gml-enums.generated.ts.`,
    });
  }

  // Real, project-wide object-type names for the cross-instance dotted-
  // reference rewrite pass (`obj_x.field` — see gms2-transpile.ts's
  // `setGmlObjectNames`/CLAUDE.md's "Cross-file symbol table..." section).
  // Every object listed in the project, not just ones that end up
  // successfully converted — a dotted reference to an object that itself
  // fails to import still deserves the real runtime-lookup rewrite (it
  // will simply find no live instance at runtime, the same honest
  // "no-live-instance" no-op `getGmlObjectVar`/`setGmlObjectVar` already
  // give any object type with zero active instances).
  setGmlObjectNames(new Set(objects));
  // Real, project-wide sprite/sound/font/room name registries for the
  // "bare asset-name identifier used as a plain value" rewrite pass (see
  // gms2-transpile.ts's own doc comment right above that pass, and
  // CLAUDE.md's "GMS2 transpiler: project-wide asset-name registry"
  // entry). Every listed resource of each kind, not just ones that end up
  // successfully converted — the same "still worth resolving even if the
  // underlying asset itself failed to import" reasoning `setGmlObjectNames`
  // above already documents for objects.
  setGmlSpriteNames(new Set(sprites));
  setGmlSoundNames(new Set(sounds));
  setGmlFontNames(new Set(fonts));
  setGmlRoomNames(new Set(rooms));
  setGmlShaderNames(new Set(shaders));

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

  // Tilesets are converted before rooms so a room's tile layers (see the
  // rooms loop below) can look up an already-converted tileset by name and
  // emit a real TilemapData module for it, rather than the previous
  // unconditional "manual" treatment with no conversion attempted at all.
  const convertedTilesets = new Map<string, TilesetAsset>();
  for (const name of tilesets) {
    if (verbose) console.log(`  [tileset] ${name}`);
    try {
      const { content, tileset } = await buildTilesetAsset(
        name,
        projectRoot,
        outDir,
      );
      filesToWrite.push({ rel: `assets/${name}.tileset.ts`, content });
      convertedTilesets.set(name, tileset);
      reportEntries.push({ kind: "tileset", name, status: "converted" });
      if (tileset.asymmetryWarning !== undefined) {
        warnings.push(tileset.asymmetryWarning);
      }
    } catch (err) {
      const reason = `conversion failed (${String(err)}) — skipped, needs manual import`;
      warnings.push(
        `Tileset "${name}" could not be converted (${String(err)}) — skipped, needs manual import.`,
      );
      skipped.push(name);
      reportEntries.push({
        kind: "tileset",
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

      // The room's real camera/view data (`views` array + room-wide
      // `viewSettings.enableViews`) gets merged onto the generated
      // `.scene.json` the same way background entities do above — see
      // `SceneFile.views`/`.viewsEnabled`'s own doc comment in
      // `@emptysock/engine`'s SceneFile.ts, and `GmsRuntime.ts`'s
      // `applyRoomViews` for how a loaded room actually wires this into a
      // live `CameraSystem`/multi-viewport render pass.
      // Room-layer sprite/sequence elements (`GMRAssetLayer` graphics) become
      // real entities carrying a `LayerElement`, merged the same way.
      const {
        entities: elementEntities,
        failed: failedElements,
        sequences: elementSequences,
      } = await convertGms2RoomLayerElements(
        room,
        projectRoot,
        new Set(sequences),
      );
      for (const failure of failedElements) {
        warnings.push(
          `${failure} It has been left out of the generated .scene.json — recreate it manually.`,
        );
      }
      const sceneFileViews = buildRoomSceneFileViews(room);
      const activeViewCount = sceneFileViews.filter((v) => v.visible).length;

      let content = sceneJSON;
      if (
        backgroundEntities.length > 0 ||
        elementEntities.length > 0 ||
        sceneFileViews.length > 0
      ) {
        const scene = JSON.parse(sceneJSON) as {
          entities?: unknown[];
          views?: unknown[];
          viewsEnabled?: boolean;
          [key: string]: unknown;
        };
        if (backgroundEntities.length > 0 || elementEntities.length > 0) {
          scene.entities = [
            ...(scene.entities ?? []),
            ...backgroundEntities,
            ...elementEntities,
          ];
        }
        if (sceneFileViews.length > 0) {
          scene.views = sceneFileViews;
          scene.viewsEnabled = room.viewsEnabled;
        }
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

      // convertGms2Room's parseTiles() parses every GMRTileLayer's placed
      // tile data into RoomLayer.tiles; now that tilesets themselves convert
      // (see the tilesets loop above), a room's tile layer(s) get a real
      // <room>.tilemap.ts module — a TilemapData `@emptysock/tilemap`'s
      // TilemapSystem.register() can load directly — for every distinct
      // tileset its tile layers reference that actually converted.
      // TilemapData carries exactly one `tileset` (it's `@emptysock/tilemap`'s
      // real, unchanged shape — see gms2-tileset-import.ts), so a room with
      // N distinct tilesets gets N sibling TilemapData modules, one per
      // tileset, each holding only the cells that reference it (a real
      // GameMaker room legitimately draws several tile layers against
      // different tilesets, e.g. a ground tileset plus a separate props/
      // decoration tileset — this is common real data, not a hypothetical
      // edge case). A room with exactly one distinct tileset keeps the
      // original single-file naming (`rooms/<name>.tilemap.ts`) for
      // backward compatibility; a room with more than one gets
      // `rooms/<name>.<tileset>.tilemap.ts` per tileset, so multiple
      // sibling files never collide. A tileset that itself failed to
      // convert still gets a real, honest per-tileset note rather than
      // silently dropping that portion of the room's tile data.
      const tileLayers = room.layers.filter((layer) => layer.tiles.length > 0);
      const totalTiles = tileLayers.reduce(
        (sum, layer) => sum + layer.tiles.length,
        0,
      );
      let roomNote: string | undefined;
      if (totalTiles > 0) {
        const distinctTilesetIds = [
          ...new Set(
            tileLayers.flatMap((layer) =>
              layer.tiles.map((tile) => tile.tilesetId),
            ),
          ),
        ];
        const multi = distinctTilesetIds.length > 1;
        const noteParts: string[] = [];

        for (const tilesetName of distinctTilesetIds) {
          const tilesForThisTileset = tileLayers.reduce(
            (sum, layer) =>
              sum +
              layer.tiles.filter((tile) => tile.tilesetId === tilesetName)
                .length,
            0,
          );
          const tileset =
            tilesetName !== "" ? convertedTilesets.get(tilesetName) : undefined;

          if (tileset === undefined) {
            const part = `${tilesForThisTileset} tile(s) reference tileset "${tilesetName}", which was not converted (see the Tilesets section above) — no tilemap was generated for that tileset. Recreate those tile layers manually with @emptysock/tilemap once the tileset converts.`;
            noteParts.push(part);
            warnings.push(`Room "${name}": ${part}`);
            continue;
          }

          const tilesetNameResolved = tilesetName;
          const tilemapResult = buildRoomTilemapModule(
            name,
            room,
            tilesetNameResolved,
            tileset,
          );
          const rel = multi
            ? `rooms/${name}.${tilesetNameResolved}.tilemap.ts`
            : `rooms/${name}.tilemap.ts`;
          filesToWrite.push({ rel, content: tilemapResult.content });

          // buildRoomTilemapModule's own tilesDropped is deliberately a
          // combined count (tiles referencing a *different* tileset than
          // this one, plus tiles genuinely out of the room's computed grid
          // bounds) — that's the correct count for its own single-tileset
          // regression tests. Here, the "different tileset" component is
          // expected (those tiles are converted by this same loop's other
          // iteration, not lost) and would be misleading to report as
          // "dropped" — the note only ever surfaces a real, genuine
          // out-of-bounds count.
          const otherTilesetCount = totalTiles - tilesForThisTileset;
          const outOfBounds = tilemapResult.tilesDropped - otherTilesetCount;

          let part = `${tilemapResult.tilesPlaced} tile(s) converted to ${rel} (tileset "${tilesetNameResolved}") — register it with @emptysock/tilemap's TilemapSystem.register()/.loadInto().`;
          if (outOfBounds > 0) {
            part += ` ${outOfBounds} tile(s) were dropped (out of the room's computed tile grid bounds).`;
            warnings.push(`Room "${name}": ${part}`);
          }
          noteParts.push(part);
        }

        roomNote = noteParts.join(" ");
      }
      if (elementEntities.length > 0) {
        const elNote = `${elementEntities.length} room-layer sprite/sequence element(s) converted to scene entities (LayerElement) — layer_sprite_get_id/layer_sequence_get_instance find them by name.${elementSequences.length > 0 ? ` Sequence element(s) need registerGmlSequence() for: ${elementSequences.join(", ")}.` : ""}`;
        roomNote = roomNote !== undefined ? `${roomNote} ${elNote}` : elNote;
      }
      if (activeViewCount > 0) {
        const viewNote = `${activeViewCount} active camera view(s) converted (viewsEnabled: ${String(room.viewsEnabled)}) — loaded automatically by GmsProjectRuntime.loadRoom() into CameraSystem${activeViewCount > 1 ? " / RenderSystem.renderMultiCamera()" : ""}.`;
        roomNote =
          roomNote !== undefined ? `${roomNote} ${viewNote}` : viewNote;
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
      const built = await buildSoundAsset(name, projectRoot, outDir, {
        compress: compressAudio,
      });
      filesToWrite.push({
        rel: `assets/${name}.sound.ts`,
        content: built.content,
      });
      if (built.warning !== undefined) warnings.push(built.warning);
      reportEntries.push({
        kind: "sound",
        name,
        status: "converted",
        ...(built.warning !== undefined ? { note: built.warning } : {}),
      });
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
      await copyFontAtlas(font, outDir);
      reportEntries.push({ kind: "font", name, status: "converted" });
      if (font.bitmap === undefined) {
        warnings.push(
          `Font "${name}" converted as family/size/style metadata only — no glyph atlas image/glyph data was found, so GML draw_text falls back to Canvas/CSS text.`,
        );
      }
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
      const content = buildNoteText(note);
      filesToWrite.push({ rel: `notes/${name}.txt`, content });
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

  if (!dryRun) {
    await fs.mkdir(outDir, { recursive: true });
    const includedResult = await convertGms2IncludedFiles(
      project.IncludedFiles,
      projectRoot,
      outDir,
    );
    warnings.push(...includedResult.warnings);
    if (includedResult.entries.length > 0) {
      filesToWrite.push({
        rel: "included-files.json",
        content: includedFilesManifestJSON(includedResult.entries),
      });
      reportEntries.push({
        kind: "includedFile",
        name: `${includedResult.entries.length} file(s)`,
        status: "converted",
      });
      if (verbose) {
        for (const e of includedResult.entries) {
          console.log(`  [included] ${e.name} -> ${e.outPath}`);
        }
      }
    }
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

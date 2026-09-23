import fs from "fs/promises";
import path from "path";
import { convertGms2Sprite } from "./gms2-sprite-import.js";
import { convertGms2Room } from "./gms2-room-import.js";
import { indent, readAndTranspileGML } from "./gms2-transpile.js";

// ---------------------------------------------------------------------------
// Per-asset-kind codegen — RELEASE_PASS.md Track 7 / ground rule 15:
// GameMaker objects emit a `.prefab.json` (structural, ECS-native, matches
// `@emptysock/engine/ecs`'s `PrefabFile` shape) plus a companion
// `.behavior.ts` module of plain exported functions for the transpiled GML
// event logic (real executable code, which a `PrefabFile`'s components
// cannot hold — see `Widgets.ts`'s and `PhysicsBody.ts`'s "a component's
// fields must stay plain `Serializable` data" constraint). Rooms emit a
// `.scene.json` (`SceneFile` shape) of prefab instances instead of a
// `loadRoomX(scene)` TypeScript function. No more `class X extends
// Component`/`extends Scene` anywhere in this importer's output.
// ---------------------------------------------------------------------------

export function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Builds the `.prefab.json` contents for a GMS2 object — the *structural*
 * half of the object, in `@emptysock/engine/ecs`'s real `PrefabFile` shape
 * (`packages/engine/src/ecs/SceneFile.ts`). Every GameMaker object instance
 * has a position, so every prefab gets a `Transform` component; richer
 * structural mapping (a `sprite_id` → `Sprite`, physics settings →
 * `PhysicsBody`) is a real, separate extension to make once a project
 * actually needs it — not assumed here without a real `.yy` sample to
 * verify the field names against (the same "audit before assuming"
 * discipline that caught the `.yy`/`.yyp` quirks in the first place).
 */
export function buildObjectPrefabJSON(name: string): string {
  const prefab = {
    prefabName: name,
    components: [{ component: "Transform" }],
  };
  return JSON.stringify(prefab, null, 2) + "\n";
}

/**
 * Builds the `.behavior.ts` contents for a GMS2 object: one plain exported
 * function per GML event, transpiled where a `.gml` file is found. This
 * used to be a `class X extends Component` with one method per event —
 * ground rule 15 drops the class shape entirely; a game wires these
 * functions up to its own prefab instances however it wants (a per-prefab
 * dispatch table keyed by `PrefabFile.prefabName`, the same "engine defines
 * the shape, game code wires the actual behavior" pattern used throughout
 * this pass), since the engine has no single opinionated "GMS2 object
 * behavior" runtime concept to hand this off to automatically.
 */
export async function buildObjectBehavior(
  name: string,
  projectRoot: string,
): Promise<string> {
  // Look for GML event files alongside the .yy file.
  const objectDir = path.join(projectRoot, "objects", name);

  // Scan for available .gml files in the object dir, matching known event prefixes.
  let gmlFiles: string[] = [];
  try {
    const entries = await fs.readdir(objectDir);
    gmlFiles = entries.filter((e) => e.endsWith(".gml"));
  } catch {
    // directory doesn't exist — no GML available, emit pure stubs
  }

  async function buildMethod(
    methodName: string,
    eventLabel: string,
    paramStr: string,
    prefixRe: RegExp,
  ): Promise<string> {
    const gmlFile = gmlFiles.find((f) => prefixRe.test(f));
    if (gmlFile) {
      const gmlPath = path.join(objectDir, gmlFile);
      const transpiled = await readAndTranspileGML(gmlPath);
      if (transpiled !== null) {
        const body = indent(transpiled.trimEnd(), 2);
        return `export function ${methodName}(${paramStr}): void {\n  // [GML auto-transpiled — review carefully]\n${body}\n}`;
      }
    }
    return `export function ${methodName}(${paramStr}): void {\n  // TODO: migrate ${eventLabel}\n}`;
  }

  const onCreate = await buildMethod(
    "onCreate",
    "Create event",
    "_entity: Entity",
    /^Create_/i,
  );
  const onUpdate = await buildMethod(
    "onUpdate",
    "Step event",
    "_entity: Entity, _dt: number",
    /^Step_/i,
  );
  const onDraw = await buildMethod(
    "onDraw",
    "Draw event",
    "_entity: Entity",
    /^Draw_/i,
  );
  const onDestroy = await buildMethod(
    "onDestroy",
    "Destroy event",
    "_entity: Entity",
    /^Destroy_/i,
  );

  // -- Collision events -------------------------------------------------------
  // GMS2 names one file per colliding object: Collision_<other object>.gml.
  // Emit one onCollideWith<Other>(entity, other) function per file found.
  const collisionFiles = gmlFiles.filter((f) => /^Collision_/i.test(f));
  const collisionFns: string[] = [];
  for (const gmlFile of collisionFiles) {
    const otherName = gmlFile
      .replace(/^Collision_/i, "")
      .replace(/\.gml$/i, "");
    const otherClass = toPascalCase(otherName);
    const gmlPath = path.join(objectDir, gmlFile);
    const transpiled = await readAndTranspileGML(gmlPath);
    const body =
      transpiled !== null
        ? indent(transpiled.trimEnd(), 2)
        : `  // TODO: migrate collision with ${otherName}`;
    collisionFns.push(
      `export function onCollideWith${otherClass}(_entity: Entity, _other: Entity): void {\n  // [GML auto-transpiled from Collision_${otherName}.gml — review carefully]\n${body}\n}`,
    );
  }

  // -- Keyboard events ----------------------------------------------------------
  // GMS2 keyboard events are named by virtual key code (GameMaker vk_* constants).
  // 37-40 are the arrow keys; anything else falls back to a generic name.
  const vkNames: Record<string, string> = {
    "8": "Backspace",
    "13": "Enter",
    "16": "Shift",
    "17": "Control",
    "27": "Escape",
    "32": "Space",
    "37": "Left",
    "38": "Up",
    "39": "Right",
    "40": "Down",
  };
  function vkMethodName(prefix: string, code: string): string {
    const label = vkNames[code] ?? `Vk${code}`;
    return `${prefix}${label}`;
  }

  async function buildKeyFns(
    filePrefix: RegExp,
    methodPrefix: string,
    eventLabel: string,
  ): Promise<string[]> {
    const files = gmlFiles.filter((f) => filePrefix.test(f));
    const fns: string[] = [];
    for (const gmlFile of files) {
      const match = /_(\d+)\.gml$/i.exec(gmlFile);
      const code = match?.[1] ?? "0";
      const methodName = vkMethodName(methodPrefix, code);
      const gmlPath = path.join(objectDir, gmlFile);
      const transpiled = await readAndTranspileGML(gmlPath);
      const body =
        transpiled !== null
          ? indent(transpiled.trimEnd(), 2)
          : `  // TODO: migrate ${eventLabel} (vk ${code})`;
      fns.push(
        `export function ${methodName}(_entity: Entity): void {\n  // [GML auto-transpiled from ${gmlFile} — review carefully]\n${body}\n}`,
      );
    }
    return fns;
  }

  const keyPressFns = await buildKeyFns(
    /^KeyPress_/i,
    "onKeyPress",
    "KeyPress event",
  );
  const keyReleaseFns = await buildKeyFns(
    /^KeyRelease_/i,
    "onKeyRelease",
    "KeyRelease event",
  );

  const extraFns = [...collisionFns, ...keyPressFns, ...keyReleaseFns];
  const extraBlock = extraFns.length > 0 ? "\n\n" + extraFns.join("\n\n") : "";

  return `// Auto-generated GMS2 behavior for object: ${name}
// Review and replace GML logic with EmptySock equivalents. Wire these
// functions up to your own prefab instances however your game dispatches
// per-prefab behavior — see ${name}.prefab.json for this object's
// structural (component) data.
import type { Entity } from '@emptysock/engine';

${onCreate}

${onUpdate}

${onDraw}

${onDestroy}${extraBlock}
`;
}

/**
 * Build a TypeScript Sprite-asset descriptor from a converted GMS2 sprite,
 * plus copy its frame PNGs into `<outDir>/assets/sprites/<name>/`.
 * Returns the descriptor's .ts source; throws on missing/unreadable frames.
 */
export async function buildSpriteAsset(
  name: string,
  projectRoot: string,
  outDir: string,
): Promise<string> {
  const spriteDir = path.join(projectRoot, "sprites", name);
  const sprite = await convertGms2Sprite(spriteDir);

  const assetDir = path.join(outDir, "assets", "sprites", name);
  await fs.mkdir(assetDir, { recursive: true });

  const frameFiles: string[] = [];
  for (let i = 0; i < sprite.frames.length; i++) {
    const frame = sprite.frames[i];
    if (frame === undefined) continue;
    const destName = `frame_${i}.png`;
    await fs.copyFile(frame.imagePath, path.join(assetDir, destName));
    frameFiles.push(destName);
  }

  const relBase = `./assets/sprites/${name}/`;
  return `// Auto-generated from GMS2 sprite: ${name}
// Use with @emptysock/engine's Sprite component:
//   new Sprite({ texturePath: ${JSON.stringify(relBase + (frameFiles[0] ?? "frame_0.png"))} })
export const ${toPascalCase(name)}Sprite = {
  name: ${JSON.stringify(name)},
  width: ${sprite.width},
  height: ${sprite.height},
  frameCount: ${sprite.frameCount},
  frames: ${JSON.stringify(frameFiles.map((f) => relBase + f))},
} as const;
`;
}

/**
 * Build a `.scene.json` file (`@emptysock/engine/ecs`'s real `SceneFile`
 * shape) from a converted GMS2 room: one prefab instance per room instance,
 * referencing the `.prefab.json` `buildObjectPrefabJSON()` emits for each
 * imported object — ground rule 15's actual ask, replacing the old
 * `loadRoomX(scene)` TypeScript function. An instance whose object wasn't
 * imported (skipped or missing) is omitted with a comment explaining why
 * would be lost in translation to plain JSON (no comments), so instead it's
 * dropped from `prefabInstances` and the caller is expected to surface that
 * via the migration report (`gms2-report.ts`), the same place other
 * skip/manual notices already live.
 */
export async function buildRoomSceneJSON(
  name: string,
  projectRoot: string,
  objects: string[],
): Promise<string> {
  const roomYyPath = path.join(projectRoot, "rooms", name, `${name}.yy`);
  const room = await convertGms2Room(roomYyPath);
  const knownObjects = new Set(objects);

  const prefabInstances = room.layers.flatMap((layer) =>
    layer.instances
      .filter((inst) => knownObjects.has(inst.objectName))
      .map((inst) => ({
        prefab: inst.objectName,
        props: { x: inst.x, y: inst.y },
      })),
  );

  const scene = {
    sceneName: name,
    prefabInstances,
  };
  return JSON.stringify(scene, null, 2) + "\n";
}

export function scriptStub(name: string): string {
  return `// Auto-generated from GMS2 script: ${name}
// Migrate GML functions to TypeScript below.
// Import GML compat helpers if needed: import * as GML from '@emptysock/engine/compat';

export function placeholder_${name}(): void {
  // TODO: migrate GML script body
}
`;
}

/**
 * A plain manifest of every prefab/scene file this import produced —
 * there's no "register a component" step for the JSON output the way the
 * old class-based entrypoint had, since `.prefab.json`/`.scene.json` are
 * loaded via `@emptysock/engine/ecs`'s `parsePrefabFile`/`loadSceneFile`
 * directly, not imported as modules. This is a plain data file (not code)
 * so a game's own bootstrap can enumerate what got imported without
 * parsing directory listings.
 */
export function projectManifestJSON(
  objects: string[],
  rooms: string[],
): string {
  const manifest = {
    prefabs: objects.map((name) => `${name}.prefab.json`),
    behaviors: objects.map((name) => `${name}.behavior.ts`),
    scenes: rooms.map((name) => `rooms/${name}.scene.json`),
  };
  return JSON.stringify(manifest, null, 2) + "\n";
}

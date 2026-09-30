import fs from "fs/promises";
import path from "path";
import { convertGms2Sprite, type SpriteAsset } from "./gms2-sprite-import.js";
import { convertGms2Room } from "./gms2-room-import.js";
import { parseGmsJson } from "./gms2-parse.js";

// ---------------------------------------------------------------------------
// Per-asset-kind codegen — RELEASE_PASS.md Track 7 / ground rule 15:
// GameMaker objects emit a `.prefab.json` (structural, ECS-native, matches
// `@emptysock/engine`'s `PrefabFile` shape) plus a companion
// `.behavior.ts` module of plain exported functions for the transpiled GML
// event logic (real executable code, which a `PrefabFile`'s components
// cannot hold — see `Widgets.ts`'s and `PhysicsBody.ts`'s "a component's
// fields must stay plain `Serializable` data" constraint). Rooms emit a
// `.scene.json` (`SceneDocument` shape) of prefab instances instead of a
// `loadRoomX(scene)` TypeScript function. No more `class X extends
// Component`/`extends Scene` anywhere in this importer's output.
// ---------------------------------------------------------------------------

export function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** On-disk shape of the object-relevant fields of a GMS2 object `.yy` file. */
interface YyObjectProperty {
  varType?: number;
  value?: string;
  name?: string;
}

interface YyObject {
  spriteId?: { name?: string } | null;
  physicsObject?: boolean;
  physicsSensor?: boolean;
  physicsShape?: number;
  physicsDensity?: number;
  physicsFriction?: number;
  physicsRestitution?: number;
  physicsKinematic?: boolean;
  solid?: boolean;
  /** Real GameMaker per-object "Persistent" checkbox — carried onto `Meta.persistent`. */
  persistent?: boolean;
  /** Real GameMaker object-type reference for inheritance — `null` for a
   * root object with no parent, `{ name }` naming the parent object
   * resource otherwise. See `resolveGmlObjectChain()`'s own doc comment. */
  parentObjectId?: { name?: string } | null;
  /** GMS2.3+ "Variable Definitions" — real, typed instance-variable
   * defaults declared on the object resource itself (not in any `.gml`
   * file). See `resolveGmlObjectProperties()`'s own doc comment — this is
   * a genuinely different mechanism from inheritance, confirmed against a
   * real project object (`obj_enemy`'s own `grv`/`has_weapon`
   * fields, which this importer previously had no read path for at all). */
  properties?: YyObjectProperty[];
  [key: string]: unknown;
}

function isYyObject(val: unknown): val is YyObject {
  return typeof val === "object" && val !== null;
}

async function readYyObject(
  name: string,
  projectRoot: string,
): Promise<YyObject | undefined> {
  const yyPath = path.join(projectRoot, "objects", name, `${name}.yy`);
  try {
    const raw = await fs.readFile(yyPath, "utf-8");
    const parsed = parseGmsJson(raw);
    return isYyObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Walks a GMS2 object's real `parentObjectId` chain (an object can inherit
 * from a parent that itself inherits from a grandparent — confirmed real
 * GameMaker behaviour via the manual's Object Inheritance page). Returns
 * the chain starting with `name` itself, then its parent, grandparent, etc.
 * A cycle (malformed project data) is defended against with a `visited`
 * set — genuinely impossible in a valid GameMaker project, but this is
 * offline codegen reading arbitrary on-disk data, so it must not hang.
 */
export async function resolveGmlObjectChain(
  name: string,
  projectRoot: string,
): Promise<string[]> {
  const chain: string[] = [];
  const visited = new Set<string>();
  let current: string | undefined = name;
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    chain.push(current);
    const yy = await readYyObject(current, projectRoot);
    const parentName = yy?.parentObjectId?.name;
    current = typeof parentName === "string" ? parentName : undefined;
  }
  return chain;
}

/**
 * Resolves a GMS2 object's real, merged "Variable Definitions" — GMS2.3+'s
 * per-object typed instance-variable defaults (the `.yy` `properties`
 * array), walking the real `parentObjectId` chain so a child inherits its
 * parent's declared defaults the same way GameMaker itself does (child
 * overrides parent on a same-named property). `varType 3` is GameMaker's
 * real Boolean property type (confirmed against a real project's own
 * `obj_enemy.yy`: `afraid_of_heights`/`grounded`/`has_weapon` all carry
 * `varType: 3` with `"True"`/`"0"`/`"1"`-shaped string values); every other
 * `varType` is read as a number when the raw string parses as one, else
 * passed through as a string — GameMaker's own Real/String/Colour/Asset
 * property types all ultimately resolve to a plain GML value at runtime,
 * and this importer has no richer typed representation to target. A value
 * that references another property by name as an expression (a real,
 * observed shape — `obj_enemy.yy`'s own `hsp` property has the literal
 * value `"walksp"`) is not evaluated as an expression — this importer has
 * no expression evaluator for object-property defaults, so it's read at
 * face value and, since `"walksp"` doesn't parse as a number, falls back
 * to the raw string; a real, honest, narrow gap rather than a fabricated
 * evaluation.
 */
export async function resolveGmlObjectProperties(
  name: string,
  projectRoot: string,
): Promise<Map<string, number | string | boolean | { expr: string }>> {
  const chain = await resolveGmlObjectChain(name, projectRoot);
  const merged = new Map<
    string,
    number | string | boolean | { expr: string }
  >();
  // Walk root-most parent first so a child's own properties override.
  for (const objectName of [...chain].reverse()) {
    const yy = await readYyObject(objectName, projectRoot);
    for (const prop of yy?.properties ?? []) {
      if (typeof prop.name !== "string" || prop.name.length === 0) continue;
      const raw = prop.value ?? "";
      let value: number | string | boolean | { expr: string };
      if (prop.varType === 3) {
        value = raw === "True" || raw === "true" || raw === "1";
      } else {
        const num = Number(raw);
        if (raw !== "" && !Number.isNaN(num)) value = num;
        // A real-typed (varType 0) default that is not a number is a GML
        // expression, evaluated when the instance is created (`hsp` =
        // `walksp`). Other types (string) keep their literal text.
        else if (prop.varType === 0 && raw !== "") value = { expr: raw };
        else value = raw;
      }
      merged.set(prop.name, value);
    }
  }
  return merged;
}

/**
 * Builds the `.prefab.json` contents for a GMS2 object — the *structural*
 * half of the object, in `@emptysock/engine`'s real `PrefabFile` shape
 * (`packages/engine/src/SceneFile.ts`). Every GameMaker object instance has
 * a position, so every prefab gets a `Transform` component. This reads the
 * object's real `<name>.yy` (via the shared trailing-comma-tolerant
 * `parseGmsJson`, same as every other real `.yy` read in this codebase) and
 * layers on real structural data when it's present:
 *
 * - A real `spriteId` (not `null`, which GameMaker writes for a spriteless
 *   object) adds a `Sprite` component, wired to that sprite's generated
 *   asset the same `./assets/sprites/<name>/frame_0.png` convention
 *   `buildSpriteAsset`/`convertGms2RoomBackgrounds` already use, since the
 *   sprite is expected to have been imported by the same run's sprite loop.
 * - `physicsObject: true` adds a `PhysicsBody` component (see
 *   `packages/engine/src/components/PhysicsBody.ts` for its real field
 *   shape) — only the fields that shape actually has are ever emitted:
 *   `type` (`"kinematic"` when `physicsKinematic` is true, else
 *   `"dynamic"` — GameMaker's physics has no static/kinematic distinction
 *   this importer can reliably read, so a static-in-GameMaker object still
 *   comes through as `"dynamic"` and is a real, documented gap, not silently
 *   wrong data), `isSensor` (from `physicsSensor`), and `density`/
 *   `friction`/`restitution` (from their `physics*` equivalents) when
 *   present. `PhysicsBody.shape` is deliberately never overridden here —
 *   GameMaker's `physicsShape` enum (circle/rectangle/custom-polygon) has no
 *   confident, verified mapping onto `PhysicsBody`'s `"box"|"circle"|
 *   "capsule"` without a real project's `.yy` to check the enum values
 *   against, so the component's own `"box"` default is left in place rather
 *   than guessing.
 *
 * An object whose `.yy` has neither a real `spriteId` nor `physicsObject:
 * true` still gets exactly the previous `Transform`-only prefab — this is
 * additive, not a behavior change for objects that don't use either.
 */
export async function buildObjectPrefabJSON(
  name: string,
  projectRoot: string,
): Promise<string> {
  const yyPath = path.join(projectRoot, "objects", name, `${name}.yy`);

  // Every object gets a companion `.behavior.ts` module unconditionally
  // (see `buildObjectBehavior`'s own doc comment), and `GmlBehaviorSystem`/
  // `GmsProjectRuntime` only ever dispatch onCreate/Step/Collision/Draw/
  // onDestroy against an entity that actually carries `GmlBehaviorState` —
  // without this component, a GMS2-imported prefab's generated behavior
  // functions are dead code no dispatcher can ever reach (see CLAUDE.md's
  // "GML behavior dispatch" entry). `behaviorId` matches the same object
  // name `registerGmlBehavior(name, module)` is keyed on.
  const components: Array<{
    component: string;
    overrides?: Record<string, unknown>;
  }> = [
    { component: "Transform" },
    { component: "GmlBehaviorState", overrides: { behaviorId: name } },
  ];

  let raw: string | undefined;
  try {
    raw = await fs.readFile(yyPath, "utf-8");
  } catch {
    raw = undefined;
  }

  if (raw !== undefined) {
    let parsed: unknown;
    try {
      parsed = parseGmsJson(raw);
    } catch {
      parsed = undefined;
    }

    if (isYyObject(parsed)) {
      const spriteName =
        parsed.spriteId !== null &&
        parsed.spriteId !== undefined &&
        typeof parsed.spriteId.name === "string"
          ? parsed.spriteId.name
          : undefined;
      if (spriteName !== undefined) {
        // Read the sprite's own real frame count/playback rate (see
        // `SpriteAsset.frameSpeed`'s doc comment) so a multi-frame object's
        // initial `Sprite` component seeds a real, animated default instead
        // of a bare single-frame guess — a GMS2 object whose sprite has
        // more than one frame plays its idle/default animation from frame
        // 0 the instant it spawns, matching GameMaker's own behaviour.
        // Wrapped in try/catch: a sprite this object references but that
        // failed to import for its own reasons (missing frames, bad `.yy`)
        // must not also take the *object's* prefab down with it — the
        // texture path convention below is still emitted either way, the
        // same "honestly degrade, don't cascade-fail" shape this importer
        // uses throughout (see CLAUDE.md's stale-object-reference entry).
        let frameCount = 1;
        let frameSpeed: number | undefined;
        let spriteWidth = 0;
        let spriteHeight = 0;
        let nineSlice: SpriteAsset["nineSlice"];
        let spriteOrigin: { x: number; y: number } | undefined;
        let spriteBbox: SpriteAsset["bbox"];
        try {
          const spriteAsset = await convertGms2Sprite(
            path.join(projectRoot, "sprites", spriteName),
          );
          frameCount = spriteAsset.frameCount;
          frameSpeed = spriteAsset.frameSpeed;
          spriteWidth = spriteAsset.width;
          spriteHeight = spriteAsset.height;
          nineSlice = spriteAsset.nineSlice;
          if (
            spriteAsset.originX !== undefined &&
            spriteAsset.originY !== undefined
          )
            spriteOrigin = { x: spriteAsset.originX, y: spriteAsset.originY };
          spriteBbox = spriteAsset.bbox;
        } catch {
          // Left at the single-frame default — the sprite loop elsewhere in
          // `importGMS2Project` is responsible for reporting the real
          // failure by name in the migration report.
        }

        const overrides: Record<string, unknown> = {
          texturePath:
            frameCount > 1
              ? `./assets/sprites/${spriteName}/frame_{n}.png`
              : `./assets/sprites/${spriteName}/frame_0.png`,
        };
        if (frameCount > 1) {
          overrides["frameCount"] = frameCount;
          overrides["frameSpeed"] = frameSpeed ?? 1;
        }
        // Real per-sprite pixel dimensions, read from the sprite resource's
        // own `.yy` `width`/`height` — this is what makes
        // `compat/gmlActions.ts`'s `spriteHalfExtents()` use real collision
        // extents instead of its fixed 32x32 fallback. See that function's
        // own doc comment.
        if (spriteWidth > 0 && spriteHeight > 0) {
          overrides["width"] = spriteWidth;
          overrides["height"] = spriteHeight;
          // GameMaker positions an instance by the sprite's origin, not its
          // centre, and its collision mask is a box relative to that origin.
          if (spriteOrigin !== undefined) {
            overrides["anchorX"] = spriteOrigin.x / spriteWidth;
            overrides["anchorY"] = spriteOrigin.y / spriteHeight;
          }
          if (spriteBbox !== undefined) {
            overrides["bboxLeft"] = spriteBbox.left;
            overrides["bboxTop"] = spriteBbox.top;
            overrides["bboxRight"] = spriteBbox.right;
            overrides["bboxBottom"] = spriteBbox.bottom;
          }
        }
        // An object with its "Visible" box unticked (invisible collision
        // blocks, controllers) draws nothing.
        if (parsed["visible"] === false) overrides["visible"] = false;
        if (nineSlice !== undefined) {
          overrides["sliceMode"] = 1;
          overrides["sliceLeft"] = nineSlice.left;
          overrides["sliceRight"] = nineSlice.right;
          overrides["sliceTop"] = nineSlice.top;
          overrides["sliceBottom"] = nineSlice.bottom;
        }
        components.push({ component: "Sprite", overrides });
      }

      if (parsed.physicsObject === true) {
        const overrides: Record<string, unknown> = {
          type: parsed.physicsKinematic === true ? "kinematic" : "dynamic",
        };
        if (typeof parsed.physicsSensor === "boolean") {
          overrides["isSensor"] = parsed.physicsSensor;
        }
        if (typeof parsed.physicsDensity === "number") {
          overrides["density"] = parsed.physicsDensity;
        }
        if (typeof parsed.physicsFriction === "number") {
          overrides["friction"] = parsed.physicsFriction;
        }
        if (typeof parsed.physicsRestitution === "number") {
          overrides["restitution"] = parsed.physicsRestitution;
        }
        components.push({ component: "PhysicsBody", overrides });
      }

      // GameMaker's own per-object "Solid" checkbox — independent of
      // `physicsObject`, since a classic non-physics DnD/GML game's solid
      // walls are plain `Meta.solid`-flagged instances that
      // `place_free`/`position_free` (`compat/gmlCollisionQueries.ts`) check
      // against, not `PhysicsBody`. Only emitted when actually `true` — the
      // component's own `false` default already covers the common case, and
      // this keeps a non-solid object's prefab unchanged.
      // `persistent` shares the same single `Meta` override entry (a prefab
      // may not list one component twice). Real per-object `.yy` field —
      // room `.yy` instances carry no per-instance persistent flag, and a
      // room's own `roomSettings.persistent` is a different, unimplemented
      // concept (whole-room state persistence).
      const metaOverrides: Record<string, unknown> = {};
      if (parsed.solid === true) metaOverrides["solid"] = true;
      if (parsed.persistent === true) metaOverrides["persistent"] = true;
      if (Object.keys(metaOverrides).length > 0) {
        components.push({ component: "Meta", overrides: metaOverrides });
      }
    }
  }

  const prefab = {
    prefabName: name,
    components,
  };
  return JSON.stringify(prefab, null, 2) + "\n";
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
  // A multi-frame sprite's `Sprite.texturePath` is the `"{n}"`-templated
  // convention `resolveSpriteFramePath` (`@emptysock/engine`'s
  // `components/Sprite.ts`) resolves at render time; a single-frame sprite
  // keeps the old literal `frame_0.png` path unchanged (`frameCount <= 1`
  // is a no-op for `resolveSpriteFramePath`, so this stays byte-identical
  // to pre-animation behaviour for every sprite that only ever had one
  // frame).
  const texturePath =
    sprite.frameCount > 1
      ? `${relBase}frame_{n}.png`
      : relBase + (frameFiles[0] ?? "frame_0.png");
  return `// Auto-generated from GMS2 sprite: ${name}
// Use with @emptysock/engine's Sprite component:
//   new Sprite({ texturePath: ${JSON.stringify(texturePath)}${
    sprite.frameCount > 1
      ? `, frameCount: ${sprite.frameCount}, frameSpeed: ${sprite.frameSpeed ?? 1}`
      : ""
  } })
export const ${toPascalCase(name)}Sprite = {
  name: ${JSON.stringify(name)},
  width: ${sprite.width},
  height: ${sprite.height},
  frameCount: ${sprite.frameCount},
  frameSpeed: ${sprite.frameSpeed ?? 1},
  texturePath: ${JSON.stringify(texturePath)},
  frames: ${JSON.stringify(frameFiles.map((f) => relBase + f))},
} as const;
`;
}

/**
 * Build a `.scene.json` file (`@emptysock/engine`'s real `SceneDocument`,
 * `formatVersion: 2`) from a converted GMS2 room: one prefab instance per room instance,
 * referencing the `.prefab.json` `buildObjectPrefabJSON()` emits for each
 * imported object — ground rule 15's actual ask, replacing the old
 * `loadRoomX(scene)` TypeScript function. An instance whose object wasn't
 * imported (skipped or missing) is omitted with a comment explaining why
 * would be lost in translation to plain JSON (no comments), so instead it's
 * dropped from the entities and the caller is expected to surface that
 * via the migration report (`gms2-report.ts`), the same place other
 * skip/manual notices already live.
 */
/**
 * Spawn props for one room instance: position always, and only the transform
 * and blend values that differ from GameMaker's defaults (scale 1, angle 0,
 * white, image_index 0, image_speed 1) so unchanged instances stay compact.
 * GameMaker rotation is counter-clockwise degrees; `Transform.rotation` is
 * clockwise radians (pixi), so the sign flips.
 */
export function roomInstanceProps(inst: {
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  colour?: number;
  imageIndex?: number;
  imageSpeed?: number;
}): Record<string, number> {
  const props: Record<string, number> = { x: inst.x, y: inst.y };
  if (inst.scaleX !== undefined && inst.scaleX !== 1)
    props["scaleX"] = inst.scaleX;
  if (inst.scaleY !== undefined && inst.scaleY !== 1)
    props["scaleY"] = inst.scaleY;
  if (inst.rotation !== undefined && inst.rotation !== 0)
    props["rotation"] = (-inst.rotation * Math.PI) / 180;
  if (inst.colour !== undefined) {
    const c = inst.colour >>> 0;
    const rgb = ((c & 0xff) << 16) | (c & 0xff00) | ((c >>> 16) & 0xff);
    const alpha = ((c >>> 24) & 0xff) / 255;
    if ((c & 0xffffff) !== 0xffffff) props["tint"] = rgb;
    if (alpha !== 1) props["alpha"] = alpha;
  }
  if (inst.imageIndex !== undefined && inst.imageIndex !== 0)
    props["currentFrame"] = inst.imageIndex;
  if (inst.imageSpeed !== undefined && inst.imageSpeed !== 1)
    props["frameSpeed"] = inst.imageSpeed;
  return props;
}

export async function buildRoomSceneJSON(
  name: string,
  projectRoot: string,
  objects: string[],
  guidToObjectName: Readonly<Record<string, string>> = {},
): Promise<string> {
  const roomYyPath = path.join(projectRoot, "rooms", name, `${name}.yy`);
  const room = await convertGms2Room(roomYyPath, guidToObjectName);
  const knownObjects = new Set(objects);

  // Entity ids: the placed instance's own editor name (`inst_XXXX`) when it is
  // a valid id, so ids survive re-import; otherwise `p<index>`. Made unique.
  const usedIds = new Set<string>();
  const uniqueId = (wanted: string): string => {
    let id = wanted;
    for (let n = 2; usedIds.has(id); n++) id = `${wanted}_${n}`;
    usedIds.add(id);
    return id;
  };
  let index = 0;
  const entities = room.layers.flatMap((layer) =>
    layer.instances
      .filter((inst) => knownObjects.has(inst.objectName))
      .map((inst) => ({
        id: uniqueId(inst.id ?? `p${index++}`),
        prefab: {
          name: inst.objectName,
          props: roomInstanceProps(inst),
        },
        ...(inst.gmlVars !== undefined
          ? { ext: { gml: { vars: inst.gmlVars } } }
          : {}),
      })),
  );

  const scene = {
    formatVersion: 2,
    name,
    entities,
  };
  return JSON.stringify(scene, null, 2) + "\n";
}

/**
 * A plain manifest of every prefab/scene file this import produced —
 * there's no "register a component" step for the JSON output the way the
 * old class-based entrypoint had, since `.prefab.json`/`.scene.json` are
 * loaded via `@emptysock/engine`'s `parsePrefabFile`/`loadSceneFile`
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

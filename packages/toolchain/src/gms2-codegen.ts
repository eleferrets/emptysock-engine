import fs from "fs/promises";
import path from "path";
import { convertGms2Sprite, type SpriteAsset } from "./gms2-sprite-import.js";
import { convertGms2Room } from "./gms2-room-import.js";
import {
  indent,
  readAndTranspileGML,
  transpileGML,
  scanGmlImplicitVars,
  scanGmlImplicitArrayVars,
} from "./gms2-transpile.js";
import { parseGmsJson } from "./gms2-parse.js";
import {
  getGmlUnsetVars,
  getGmlScriptInstanceVars,
  getGmlProjectInstanceVars,
} from "./gms2-source-bugs.js";

// ---------------------------------------------------------------------------
// Per-asset-kind codegen — RELEASE_PASS.md Track 7 / ground rule 15:
// GameMaker objects emit a `.prefab.json` (structural, ECS-native, matches
// `@emptysock/engine`'s `PrefabFile` shape) plus a companion
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
   * real Freedom Backup object (`obj_enemy`'s own `grv`/`has_weapon`
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
 * real Boolean property type (confirmed against Freedom Backup's own
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
  knownScripts: string[] = [],
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

  // A real GML instance variable can be *set* in one event (Create) and
  // only ever *read* — never assigned — in another (Step): Freedom Backup's
  // obj_camera sets cam/view_w_half/buff/etc. once in Create and reads them
  // every frame in Step. `transpileGML` processes one event file per call,
  // each becoming its own generated function, so a name never assigned
  // within that one file's own text is invisible to its own detection no
  // matter how many sibling event files set it. Pre-scanning every one of
  // this object's own .gml files up front and unioning the results (passed
  // as `knownImplicitVars` into every `readAndTranspileGML` call below)
  // closes that gap — see `scanGmlImplicitVars`'s own doc comment.
  const objectImplicitVars = new Set<string>();
  // `scanGmlImplicitArrayVars`'s exact array-shaped sibling union — see its
  // own doc comment for the real `obj_ending`/`endtext[]` cross-event-file
  // gap this closes.
  const objectArrayVars = new Set<string>();
  for (const gmlFile of gmlFiles) {
    try {
      const source = await fs.readFile(path.join(objectDir, gmlFile), "utf-8");
      for (const v of scanGmlImplicitVars(source)) objectImplicitVars.add(v);
      for (const v of scanGmlImplicitArrayVars(source)) objectArrayVars.add(v);
    } catch {
      // unreadable — skip; the per-file readAndTranspileGML call below
      // will report this the same honest way it always has.
    }
  }
  // A real GMS2.3+ variable-definition default (`grv`/`has_weapon` on a
  // real Freedom Backup `obj_enemy`, see `resolveGmlObjectProperties()`'s
  // own doc comment) is never *assigned* inside any `.gml` file — it's
  // declared on the object resource itself — so `scanGmlImplicitVars`'s
  // own "was this name ever assigned in this object's own source" scan can
  // never discover it, and a bare *read* of it would stay an unresolved
  // JS identifier (`ReferenceError`) even after the onCreate prelude below
  // sets it into the real per-entity side-table, since the read side would
  // never be rewritten to look there. Seeding every resolved property name
  // into `objectImplicitVars` up front closes that gap: a bare read of
  // `grv` is now recognised the same way a same-named ordinary implicit
  // instance variable already is.
  const resolvedProperties = await resolveGmlObjectProperties(
    name,
    projectRoot,
  );
  for (const propName of resolvedProperties.keys()) {
    objectImplicitVars.add(propName);
  }
  // Real GameMaker inheritance: a child instance owns every variable its
  // parent chain assigns, so a name only a *parent's* event file assigns
  // (obj_bullet_par's `bullet_tolerance`) is a plain instance variable in
  // the child's own events too. Scanning only the object's own files left
  // those reads as bare identifiers (`ReferenceError`).
  {
    const chainForVars = await resolveGmlObjectChain(name, projectRoot);
    for (const ancestor of chainForVars.slice(1)) {
      let ancestorEntries: string[] = [];
      try {
        ancestorEntries = (
          await fs.readdir(path.join(projectRoot, "objects", ancestor))
        ).filter((e) => e.endsWith(".gml"));
      } catch {
        /* ancestor directory missing: nothing to scan */
      }
      for (const f of ancestorEntries) {
        try {
          const source = await fs.readFile(
            path.join(projectRoot, "objects", ancestor, f),
            "utf-8",
          );
          for (const v of scanGmlImplicitVars(source))
            objectImplicitVars.add(v);
          for (const v of scanGmlImplicitArrayVars(source))
            objectArrayVars.add(v);
        } catch {
          /* unreadable: skipped, same as the object's own files above */
        }
      }
    }
  }
  // Source bugs (gms2-source-bugs.ts): names this object reads that nothing
  // in the project defines. Registering them as implicit instance variables
  // makes every read go through `getGmlVar`/`gmlNum` (a defined `0`) instead
  // of a bare identifier that throws.
  const unsetVars = getGmlUnsetVars(name);
  for (const v of unsetVars) objectImplicitVars.add(v);
  // Names any script assigns (a script runs in its caller's instance scope).
  const scriptVars = getGmlScriptInstanceVars();
  for (const v of scriptVars.scalars) objectImplicitVars.add(v);
  for (const v of scriptVars.arrays) objectArrayVars.add(v);

  // Real GameMaker object inheritance: an object without its own event
  // file for a given event slot still runs its parent's compiled event
  // code for that same slot (confirmed against GameMaker's manual's Object
  // Inheritance page — "if the child object does not have an event that
  // the parent has, then it will use the parent's event"). `objectChain`
  // is `[name, parent, grandparent, ...]`; `buildMethod` below searches it
  // in order so the *nearest* ancestor that actually has the event file
  // wins, matching GameMaker's own resolution order.
  const objectChain = await resolveGmlObjectChain(name, projectRoot);
  const ancestorGmlFiles = new Map<string, string[]>();
  ancestorGmlFiles.set(name, gmlFiles);
  for (const ancestor of objectChain.slice(1)) {
    try {
      const entries = await fs.readdir(
        path.join(projectRoot, "objects", ancestor),
      );
      ancestorGmlFiles.set(
        ancestor,
        entries.filter((e) => e.endsWith(".gml")),
      );
    } catch {
      ancestorGmlFiles.set(ancestor, []);
    }
  }

  // `event_inherited()` runs the parent object's handler for the same event.
  // The parent's generated module is imported under an alias and the handler
  // looked up by name (a parent without that event simply has none).
  const inheritAliases = new Map<string, string>();
  const parentModuleExists = new Map<string, boolean>();
  for (const anc of objectChain.slice(1)) {
    parentModuleExists.set(
      anc,
      await fs
        .access(path.join(projectRoot, "objects", anc, `${anc}.yy`))
        .then(() => true)
        .catch(() => false),
    );
  }
  function applyInherited(
    body: string,
    ownerName: string,
    handler: string,
    params: string,
  ): string {
    const re = /\bevent_inherited\s*\(\s*\)/g;
    if (!re.test(body)) return body;
    const parent = objectChain[objectChain.indexOf(ownerName) + 1];
    if (parent === undefined || parentModuleExists.get(parent) !== true)
      return body.replace(re, "undefined");
    const alias = `__Inherit_${parent.replace(/\W/g, "_")}`;
    inheritAliases.set(parent, alias);
    const args = params
      .split(",")
      .map((p) => p.split(":")[0]?.trim() ?? "")
      .filter((p) => p.length > 0)
      .join(", ");
    return body.replace(
      re,
      `(${alias} as unknown as Record<string, ((...a: unknown[]) => void) | undefined>)[${JSON.stringify(handler)}]?.(${args})`,
    );
  }

  async function buildMethod(
    methodName: string,
    eventLabel: string,
    paramStr: string,
    prefixRe: RegExp,
    optional = false,
  ): Promise<string> {
    for (const ownerName of objectChain) {
      const ownerFiles = ancestorGmlFiles.get(ownerName) ?? [];
      const gmlFile = ownerFiles.find((f) => prefixRe.test(f));
      if (gmlFile === undefined) continue;
      const gmlPath = path.join(projectRoot, "objects", ownerName, gmlFile);
      const transpiled = await readAndTranspileGML(
        gmlPath,
        objectImplicitVars,
        false,
        `${name}_${methodName}`,
        objectArrayVars,
      );
      if (transpiled !== null) {
        const body = indent(
          applyInherited(
            injectContextArgs(transpiled, knownScripts).trimEnd(),
            ownerName,
            methodName,
            paramStr,
          ),
          2,
        );
        const source =
          ownerName === name
            ? "// [GML auto-transpiled — review carefully]"
            : `// [GML auto-transpiled from parent object '${ownerName}' — ${name} has no own ${eventLabel}, real GameMaker object-inheritance fallback, review carefully]`;
        return `export function ${methodName}(${paramStr}): void {\n  ${source}\n${body}\n}`;
      }
    }
    // Begin Step/End Step/Draw GUI are genuinely optional — GameMaker's own
    // default is a plain Step/Draw event only, and `GmlBehaviorSystem`
    // (@emptysock/engine) treats a missing export as "this entity has no
    // handler for this pass", not an error. Emitting an empty stub for every
    // object that never used Begin/End Step or Draw GUI would bloat every
    // generated `.behavior.ts` file for no reason — see that module's own
    // doc comment for how a missing handler is treated at dispatch time.
    if (optional) return "";
    return `export function ${methodName}(${paramStr}): void {\n  // TODO: migrate ${eventLabel}\n}`;
  }

  let onCreate = await buildMethod(
    "onCreate",
    "Create event",
    "_entity: Entity, _ctx: GmlActionContext",
    /^Create_/i,
  );
  // Real GMS2.3+ "Variable Definitions" (the object's own `.yy`
  // `properties` array, merged up the real `parentObjectId` chain — see
  // `resolveGmlObjectProperties()`'s own doc comment) become real
  // `GmlActions.setGmlVar()` calls prepended to the very start of
  // `onCreate`, before any transpiled Create-event body runs — matching
  // GameMaker's own real timing (a variable definition's default is
  // applied before Create-event code executes) and fixing a real,
  // previously-undiscovered gap: a real Freedom Backup object
  // (`obj_enemy`) reads `grv`/`has_weapon` in its own Create event despite
  // never assigning either anywhere in any `.gml` file — they're real
  // GameMaker variable-definition defaults this importer had no read path
  // for at all.
  const propertyDefaults = resolvedProperties;
  if (propertyDefaults.size > 0) {
    const propNames = new Set(propertyDefaults.keys());
    const prelude = Array.from(propertyDefaults.entries())
      .map(([propName, value]) => {
        if (typeof value === "object") {
          // Evaluate the expression like any other GML statement.
          const stmt = transpileGML(
            `${propName} = ${value.expr};`,
            [],
            propNames,
            false,
            `${name}_prop_${propName}`,
          );
          return indent(stmt.trimEnd(), 2);
        }
        return `  GmlActions.setGmlVarDefault(_entity, _ctx, ${JSON.stringify(propName)}, ${JSON.stringify(value)});`;
      })
      .join("\n");
    onCreate = onCreate.replace(
      /^(export function onCreate\([^)]*\): void \{\n)/,
      `$1  // [GMS2.3+ variable-definition defaults]\n${prelude}\n`,
    );
  }
  // GameMaker's real Step-family eventnum suffixes, confirmed against
  // GameMaker's own manual (manual.gamemaker.io/lts/.../Event_Order.htm —
  // "First all Begin Step events are executed, then all Step events are
  // executed, after that all End Step events are executed") and its GML
  // constants (ev_step_normal = 0, ev_step_begin = 1, ev_step_end = 2, which
  // is exactly what `Step_<n>.gml`'s on-disk suffix is built from). A real
  // GMS2 object only ever has at most one file per suffix — `buildMethod`'s
  // per-suffix regex naturally yields at most one match each, so there's no
  // "multiple Step_0.gml files" case to worry about.
  const onStepBegin = await buildMethod(
    "onStepBegin",
    "Begin Step event",
    "_entity: Entity, _ctx: GmlActionContext",
    /^Step_1\.gml$/i,
    true,
  );
  let onUpdate = await buildMethod(
    "onUpdate",
    "Step event",
    "_entity: Entity, _dt: number, _ctx: GmlActionContext",
    /^Step_0\.gml$/i,
  );
  const onStepEnd = await buildMethod(
    "onStepEnd",
    "End Step event",
    "_entity: Entity, _ctx: GmlActionContext",
    /^Step_2\.gml$/i,
    true,
  );
  // Draw's real eventnum suffixes: 0 = plain Draw (world-space, affected by
  // the room camera), 64 = Draw GUI (screen-space, camera-independent) — the
  // "64" value is GameMaker's own long-standing, community- and
  // manual-confirmed constant for `ev_draw_gui` (GameMaker reserves eventnum
  // 64+ for the GUI-layer draw sub-events). Draw Begin/End and Draw GUI
  // Begin/End sub-variants are a real, separate gap — not covered here, same
  // as this pass's own scope note.
  const onDraw = await buildMethod(
    "onDraw",
    "Draw event",
    "_entity: Entity, _ctx: GmlActionContext",
    /^Draw_0\.gml$/i,
  );
  const onDrawGui = await buildMethod(
    "onDrawGui",
    "Draw GUI event",
    "_entity: Entity, _ctx: GmlActionContext",
    /^Draw_64\.gml$/i,
    true,
  );
  const onDestroy = await buildMethod(
    "onDestroy",
    "Destroy event",
    "_entity: Entity, _ctx: GmlActionContext",
    /^Destroy_/i,
  );

  // `gmlActionsStep` applies any pending `action_move`/`action_move_to`
  // velocity and ticks `action_set_alarm` timers for one entity — meant to
  // be called once per entity per Step (see that function's own doc
  // comment in @emptysock/engine's compat/gmlActions.ts, which already
  // documents this as "codegen calls this once per generated
  // onUpdate/Step handler for any object that uses a motion action"). Wire
  // that call in for real here whenever this object's transpiled events
  // actually use one of those actions — otherwise `action_move`/
  // `action_set_alarm` write into the per-entity side-table but nothing
  // ever reads it back out, and the object silently never moves/never
  // fires its alarm.
  const usesMotionOrAlarm = [onCreate, onStepBegin, onUpdate, onStepEnd].some(
    (fn) =>
      /GmlActions\.action_move\(|GmlActions\.action_move_to\(|GmlActions\.action_set_alarm\(/.test(
        fn,
      ),
  );
  if (usesMotionOrAlarm) {
    onUpdate = onUpdate.replace(
      /\n\}$/,
      "\n  GmlActions.gmlActionsStep(_entity);\n}",
    );
  }

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
    const transpiled = await readAndTranspileGML(
      gmlPath,
      objectImplicitVars,
      true,
      `${name}_onCollideWith${otherClass}`,
      objectArrayVars,
    );
    const body =
      transpiled !== null
        ? indent(
            applyInherited(
              injectContextArgs(transpiled, knownScripts).trimEnd(),
              name,
              `onCollideWith${otherClass}`,
              "_entity, _other, _ctx",
            ),
            2,
          )
        : `  // TODO: migrate collision with ${otherName}`;
    collisionFns.push(
      `export function onCollideWith${otherClass}(_entity: Entity, _other: Entity, _ctx: GmlActionContext): void {\n  // [GML auto-transpiled from Collision_${otherName}.gml — review carefully]\n${body}\n}`,
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
      const transpiled = await readAndTranspileGML(
        gmlPath,
        objectImplicitVars,
        false,
        `${name}_${methodName}`,
        objectArrayVars,
      );
      const body =
        transpiled !== null
          ? indent(
              applyInherited(
                injectContextArgs(transpiled, knownScripts).trimEnd(),
                name,
                methodName,
                "_entity, _ctx",
              ),
              2,
            )
          : `  // TODO: migrate ${eventLabel} (vk ${code})`;
      fns.push(
        `export function ${methodName}(_entity: Entity, _ctx: GmlActionContext): void {\n  // [GML auto-transpiled from ${gmlFile} — review carefully]\n${body}\n}`,
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

  // -- Everything else on disk -------------------------------------------
  // GameMaker objects carry plenty of real, common event kinds this pass
  // has no dedicated mapping for — Alarm_<n>.gml (the Alarm event family),
  // CleanUp_0.gml, Other_<n>.gml (the "Other" category: room-start/end,
  // animation-end, User Event 0-15, and more, keyed by GameMaker's own
  // eventnum — see GameMaker's manual's Event Order/constants pages for the
  // full table), and Draw sub-events beyond plain Draw/Draw GUI (Draw_72,
  // GameMaker's ev_draw_pre "Pre Draw" being one real example). Silently
  // leaving a `.gml` file on disk with no corresponding generated function
  // at all — as opposed to a `// TODO: migrate ...` stub, which every
  // *recognised* event kind gets when its own file is missing — would be
  // real GML logic vanishing from the generated output with no trace and
  // no report entry, the opposite of the "surface for manual review, don't
  // silently drop" rule this importer follows everywhere else (stale
  // objects, unconvertible resource kinds, genuinely unmodelled GML
  // functions). Every `.gml` file not already claimed by one of the named
  // event kinds above gets its own generated function instead, transpiled
  // the same way and named directly after the source file (`Alarm_0.gml` →
  // `onAlarm0`, `Other_7.gml` → `onOther7`, `Draw_72.gml` → `onDraw72`) —
  // this doesn't know or guess GameMaker's specific eventnum semantics for
  // a given "Other" sub-event, but it guarantees the code itself is never
  // lost, and the generated name makes clear it needs a human to look up
  // what that specific event actually means and wire it up accordingly.
  const knownEventFile =
    /^(Create_|Step_[012]\.gml$|Draw_(0|64)\.gml$|Destroy_|Collision_|KeyPress_|KeyRelease_)/i;
  const leftoverFiles = gmlFiles.filter((f) => !knownEventFile.test(f));
  const leftoverFns: string[] = [];
  for (const gmlFile of leftoverFiles) {
    const baseName = gmlFile.replace(/\.gml$/i, "");
    const methodName = `on${toPascalCase(baseName)}`;
    const gmlPath = path.join(objectDir, gmlFile);
    const transpiled = await readAndTranspileGML(
      gmlPath,
      objectImplicitVars,
      false,
      `${name}_${methodName}`,
      objectArrayVars,
    );
    const body =
      transpiled !== null
        ? indent(
            applyInherited(
              injectContextArgs(transpiled, knownScripts).trimEnd(),
              name,
              methodName,
              "_entity, _ctx",
            ),
            2,
          )
        : `  // TODO: migrate ${baseName}`;
    leftoverFns.push(
      `export function ${methodName}(_entity: Entity, _ctx: GmlActionContext): void {\n  // [GML auto-transpiled from ${gmlFile} — review carefully; unmapped event kind, verify its real GameMaker semantics before wiring it up]\n${body}\n}`,
    );
  }

  const extraFns = [
    ...collisionFns,
    ...keyPressFns,
    ...keyReleaseFns,
    ...leftoverFns,
  ];
  const extraBlock = extraFns.length > 0 ? "\n\n" + extraFns.join("\n\n") : "";

  // Object event code routinely calls a user-defined GMS2 script by name —
  // that script's own generated module (`buildScriptModule`) is what
  // actually holds the transpiled implementation now (see that function's
  // doc comment), so a generated `.behavior.ts` file that calls one needs a
  // real import line, same plain regex-scan approach used there.
  const allEventBodies = [
    onCreate,
    onStepBegin,
    onUpdate,
    onStepEnd,
    onDraw,
    onDrawGui,
    onDestroy,
    ...extraFns,
  ].join("\n");
  const calledScripts = knownScripts.filter((script) =>
    new RegExp(`\\b${escapeRegExp(script)}\\s*\\(`).test(allEventBodies),
  );
  // `${name}.behavior.ts` and `${script}.ts` are both written at the
  // import output directory's root (see `importGMS2Project`'s
  // `filesToWrite` calls) — a sibling import, never a parent-directory one.
  const scriptImportLines = calledScripts
    .map((script) => `import { ${script} } from './${script}.js';`)
    .join("\n");

  const bodyText = [
    onCreate,
    onStepBegin,
    onUpdate,
    onStepEnd,
    onDraw,
    onDrawGui,
    onDestroy,
    extraBlock,
  ].join("\n");
  // GML `enum Name { ... }` references (e.g. `TRANS_MODE.FADE`) get
  // rewritten by `transpileGML`'s enum pass onto `GmlEnums.Name` — see
  // CLAUDE.md's "Real project-defined GML enums" section. Only import the
  // shared generated module when this object's own transpiled body
  // actually references one, so an object that never touches an enum
  // doesn't carry a dead import.
  const enumImportLine = bodyText.includes("GmlEnums.")
    ? "import * as GmlEnums from './assets/gml-enums.generated.js';\n"
    : "";

  const sourceBugHeader =
    unsetVars.size > 0
      ? `// [source bug] ${name}'s GML reads ${[...unsetVars].map((v) => `"${v}"`).join(", ")} without any definition anywhere in the original project (see migration-report.md); these read as 0.\n`
      : "";

  return `${sourceBugHeader}// Auto-generated GMS2 behavior for object: ${name}
// Review and replace GML logic with EmptySock equivalents. Wire these
// functions up to your own prefab instances however your game dispatches
// per-prefab behavior — see ${name}.prefab.json for this object's
// structural (component) data.
//
// Every generated event handler takes a trailing \`_ctx: GmlActionContext\`
// so transpiled GameMaker 8.1 drag-and-drop actions (action_move,
// action_create_object, action_if_collision, ...) have a live Scene/Game to
// act against — see @emptysock/engine's GmlActionContext for what a real
// game needs to wire into it (at minimum { scene }; room/prefab/sound
// actions need more, see that type's own doc comment).
import type { Entity, GmlActionContext } from '@emptysock/engine';
import * as GmlActions from '@emptysock/engine';
${enumImportLine}${scriptImportLines ? scriptImportLines + "\n" : ""}${[...inheritAliases].map(([p, a]) => `import * as ${a} from './${p}.behavior.js';\n`).join("")}
${onCreate}
${onStepBegin ? `\n${onStepBegin}\n` : ""}
${onUpdate}
${onStepEnd ? `\n${onStepEnd}\n` : ""}
${onDraw}
${onDrawGui ? `\n${onDrawGui}\n` : ""}
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
 * Build a `.scene.json` file (`@emptysock/engine`'s real `SceneFile`
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

  const prefabInstances = room.layers.flatMap((layer) =>
    layer.instances
      .filter((inst) => knownObjects.has(inst.objectName))
      .map((inst) => ({
        prefab: inst.objectName,
        props: roomInstanceProps(inst),
        ...(inst.gmlVars !== undefined ? { gmlVars: inst.gmlVars } : {}),
      })),
  );

  const scene = {
    sceneName: name,
    prefabInstances,
  };
  return JSON.stringify(scene, null, 2) + "\n";
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A real GMS2 script runs in the *caller's* instance scope — GameMaker has
 * no per-script `self`, so `scr_foo()` called from `obj_player`'s Step event
 * sees `obj_player`'s own instance variables, and `scr_foo` calling
 * `action_move(...)`/`file_text_open_write(...)`/any other entity-affecting
 * built-in acts on that same caller instance too. This engine models that by
 * giving every generated script function its own leading
 * `_entity`/`_ctx` parameters (see `buildScriptModule`) and rewriting every
 * call site — inside another script's body, or inside an object behavior's
 * event body, both already have `_entity`/`_ctx` in scope — to thread them
 * through. Without this, a script whose body calls a GML action/query
 * built-in (`GmlActions.*`) references `_entity`/`_ctx` as bare, undeclared
 * identifiers that don't exist anywhere in that script's own generated
 * module, a guaranteed `ReferenceError` at runtime — confirmed by a full
 * `tsc --noEmit` sweep against a real, full GameMaker project's regenerated
 * output (`scr_load_game`/`scr_save_game`/`scr_load_json`, among others).
 */
function injectContextArgs(
  code: string,
  knownScripts: readonly string[],
): string {
  let out = code;
  for (const script of knownScripts) {
    const re = new RegExp(`\\b${escapeRegExp(script)}\\s*\\(\\s*(\\))?`, "g");
    out = out.replace(re, (_m, closeParen: string | undefined) =>
      closeParen ? `${script}(_entity, _ctx)` : `${script}(_entity, _ctx, `,
    );
  }
  return out;
}

/**
 * Real GMS2 2.3+ script files (`scripts/<name>/<name>.gml`) are literally
 * `function <name>(<params>) { ... }` — the script's own `.yy` carries no
 * parameter metadata at all, only the `.gml` source does, so parameter
 * names/count are read from the real function signature here, not from
 * `.yy`. A legacy-style script (no `function` wrapper — just a bare
 * statement body referencing `argument0`/`argument1`/…, GameMaker's older
 * convention) has no declared parameter names to read at all; those fall
 * back to a variadic `...args: unknown[]` signature, with every
 * `argumentN` reference in the transpiled body rewritten to `args[N]` so the
 * generated function is actually callable, not just plausible-looking.
 */
function extractScriptSignature(source: string): {
  paramNames: string[];
  body: string;
  isLegacyArgStyle: boolean;
} {
  const sigMatch = /function\s+\w+\s*\(([^)]*)\)\s*\{/.exec(source);
  if (sigMatch) {
    const paramList = sigMatch[1] ?? "";
    const paramNames = paramList
      .split(",")
      .map((p) => p.trim().split("=")[0]?.trim() ?? "")
      .filter((p) => p.length > 0);
    // Body is everything between the signature's opening brace and the
    // matching closing brace — tracked by real depth, not a naive
    // lastIndexOf("}"), since the body itself very likely contains its own
    // nested `{`/`}` blocks (if/for/while/struct literals).
    const braceStart = sigMatch.index + sigMatch[0].length - 1;
    let depth = 0;
    let end = source.length;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    return {
      paramNames,
      body: source.slice(braceStart + 1, end),
      isLegacyArgStyle: false,
    };
  }
  return { paramNames: [], body: source, isLegacyArgStyle: true };
}

/**
 * Build a real `.ts` module for a GMS2 script: transpiles the script's
 * actual GML body via the same `transpileGML()` pipeline object events use,
 * with a real parameter signature (see `extractScriptSignature`) and a
 * return type inferred from whether the transpiled body contains a
 * top-level `return expr;`. Any other known script this script's body
 * actually calls gets a real `import { other } from "./other.js"` line —
 * found by a plain regex scan for `<scriptName>(` in the transpiled text,
 * consistent with this transpiler's existing regex-based (not a real
 * parser) approach. This also covers script-calls-script chains
 * transitively: each generated module imports whatever it calls, and that
 * called script's own module in turn imports whatever *it* calls.
 *
 * Falls back to a `// TODO: migrate GML script body` stub only when the
 * script's `.gml` file genuinely can't be read (e.g. a stale/orphaned
 * resource reference) — mirrors every other asset kind's "honest failure,
 * not a fabricated result" rule in this importer.
 */
export async function buildScriptModule(
  name: string,
  projectRoot: string,
  knownScripts: string[],
): Promise<string> {
  const gmlPath = path.join(projectRoot, "scripts", name, `${name}.gml`);
  let source: string;
  try {
    source = await fs.readFile(gmlPath, "utf-8");
  } catch {
    return `// Auto-generated from GMS2 script: ${name}
// The script's .gml source could not be read — likely a stale/orphaned
// project reference. Migrate the GML function body manually.

export function ${name}(
  _entity: unknown,
  _ctx: unknown,
  ...args: unknown[]
): unknown {
  // TODO: migrate GML script body
  return undefined;
}
`;
  }

  const { paramNames, body, isLegacyArgStyle } = extractScriptSignature(source);
  // A script runs in its caller's instance scope, so a bare name that any
  // object or script assigns is an instance variable here too (minus the
  // script's own parameters and `var` locals, which transpileGML handles).
  const projectVars = getGmlProjectInstanceVars();
  let transpiled = transpileGML(
    body,
    paramNames,
    projectVars.scalars,
    false,
    name,
    undefined,
    projectVars.arrays,
  );
  // A real GMS2 script can declare `function name() { ... }` (so
  // `extractScriptSignature` sees a real signature and reports
  // `isLegacyArgStyle: false`) while its *body* still uses the legacy
  // `argument`/`argumentN`/`argument[N]`/`argument_count` idiom, since that
  // idiom predates GMS2.3's named-parameter syntax and GameMaker never
  // forces a script to stop using it just because it also has an (empty)
  // parameter list — confirmed real in Freedom Backup's own
  // scr_slide_transition.gml (`function scr_slide_transition() { ... mode =
  // argument[0]; ... }`). Rewriting legacy-arg syntax whenever the script
  // declared zero named parameters is safe either way: a script with real
  // named parameters never contains a bare `argument`/`argumentN` reference
  // in valid GML, so this never misfires on one that doesn't need it.
  // A script with named parameters may still refer to them as `argumentN`
  // (GameMaker aliases them); map each onto the matching named parameter.
  if (paramNames.length > 0) {
    transpiled = transpiled.replace(
      /(?<![\w.])argument(?:\[(\d+)\]|(\d+))(?![\w])/g,
      (m: string, a: string | undefined, b: string | undefined) => {
        const idx = Number(a ?? b);
        return paramNames[idx] ?? m;
      },
    );
  }
  if (isLegacyArgStyle || paramNames.length === 0) {
    // Assignment targets first: `argument4 = current_time;` must stay an
    // lvalue (`args[4] = ...`), not a `gmlNum(...)` call.
    transpiled = transpiled.replace(
      /(?<![\w.])argument(?:\[(\d+)\]|(\d+))(\s*(?:[-+*\/%|&^]|<<|>>)?=(?!=))/g,
      (_m: string, a: string | undefined, b: string | undefined, op: string) =>
        `args[${a ?? b}]${op}`,
    );
    // `argument[N]` (bracket-index legacy syntax — GameMaker's own doc notes
    // this is interchangeable with `argumentN`, real confirmed usage in
    // Freedom Backup's scr_slide_transition.gml) must be rewritten before
    // the bare `argumentN` pass below, or its `[N]` survives untouched.
    // `args` is typed `unknown[]` (a script's real arguments are
    // dynamically typed) — `args[N]` is coerced through
    // `GmlActions.gmlNum()`, the same real, valid-JS-at-runtime numeric
    // coercion `gms2-transpile.ts`'s own bare `getGmlVar` read uses (see
    // that function's own doc comment), rather than a TypeScript-only `as
    // number` assertion, so a legacy `argumentN`/`argument[N]` read used
    // arithmetically doesn't trade one real `tsc` error category
    // (`TS2304`) for another (`TS18046`/`TS2571` from an unknown array
    // element in arithmetic position) while staying genuinely runnable as
    // plain JS before any TypeScript build step strips type syntax.
    transpiled = transpiled.replace(
      /\bargument\[(\d+)\]/g,
      "GmlActions.gmlNum(args[$1])",
    );
    transpiled = transpiled.replace(
      /\bargument(\d+)\b/g,
      "GmlActions.gmlNum(args[$1])",
    );
    // `argument_count` (how many arguments this call actually passed) and a
    // bare `argument` (the whole legacy arguments array, real GameMaker
    // syntax predating argument0/argument1/... entirely) — both confirmed
    // real, both previously unrewritten `Cannot find name` identifiers.
    transpiled = transpiled.replace(/\bargument_count\b/g, "args.length");
    transpiled = transpiled.replace(/\bargument\b(?!\[)/g, "args");
  }
  // A GMS2 script runs in its caller's instance scope (see
  // `injectContextArgs`'s own doc comment) — every call this script's body
  // makes to another known script is rewritten to thread `_entity`/`_ctx`
  // through, and this script's own signature gains those same two leading
  // parameters below so a caller (another script, or an object behavior
  // event, both of which already have `_entity`/`_ctx` in scope) has
  // something real to pass.
  transpiled = injectContextArgs(transpiled, knownScripts);

  const hasReturn = /\breturn\b[^;{}]*;/.test(transpiled);
  const returnType = hasReturn ? "unknown" : "void";
  // Typed `number`, not `unknown` — the same honest, already-precedented
  // assumption `getGmlVar`'s bare-read cast makes: a real GML script
  // parameter used in the script's own body is overwhelmingly arithmetic
  // (`scr_screen_shake(magnitude, frames)`, confirmed real in Freedom
  // Backup — both params compared/assigned numerically throughout). This is
  // a type-level-only choice; a caller genuinely passing a string still
  // works identically at runtime (TypeScript's structural typing doesn't
  // insert a runtime check here), it just stops the real, previously
  // dominant `unknown`-used-arithmetically `tsc` error category from firing
  // on every generated script parameter.
  //
  // One real, narrow exception: a parameter that's forwarded bare into a
  // `GmlDrawTarget.setFont(fontId: string)` call (`draw_set_font(font)`,
  // real, confirmed usage: `scr_draw_set_text`'s own `font` parameter,
  // called as `draw_set_font(argument1)`) is genuinely, structurally a
  // string at that one real call site — the project-wide asset-name
  // registry (see CLAUDE.md's "project-wide asset-name registry" entry)
  // resolves a caller's `fnt_sign`-style argument into a real font-id
  // string before this script ever sees it. A blanket `number | string`
  // widening across every named parameter was tried first and reverted:
  // it broke real arithmetic on every other script's numeric parameters
  // (`shake_magnitude = argument0`-style assignments into a `number`
  // field, confirmed via a real sweep regression from 193 to 271 error
  // lines) — the same class of "loosened a shared type and broke
  // everything downstream" mistake CLAUDE.md's other type-fix entries
  // already warn against. Detecting the one real forwarding shape and
  // typing only that parameter `string` fixes the real call site without
  // touching any other parameter's real, already-correct `number` type.
  const stringParams = new Set(
    paramNames.filter((p) =>
      new RegExp(`\\.setFont\\?\\.\\(\\s*${escapeRegExp(p)}\\s*\\)`).test(
        transpiled,
      ),
    ),
  );
  // A parameter (or a `var alias = param;` local copy of it) tested with
  // `is_string(...)` is explicitly polymorphic in the source (real:
  // `load_string`'s `keyword`), so it is typed `string | number`.
  const polyParams = new Set(
    paramNames.filter((p) => {
      const names = [p];
      for (const m of transpiled.matchAll(
        new RegExp(`\\bvar\\s+(\\w+)\\s*=\\s*${escapeRegExp(p)}\\s*;`, "g"),
      )) {
        if (m[1] !== undefined) names.push(m[1]);
      }
      return names.some((n) =>
        new RegExp(`is_string\\(\\s*${escapeRegExp(n)}\\s*\\)`).test(
          transpiled,
        ),
      );
    }),
  );
  const paramList =
    paramNames.length > 0
      ? paramNames
          .map(
            (p) =>
              `${p}: ${stringParams.has(p) ? "string" : polyParams.has(p) ? "string | number" : "number"}`,
          )
          .join(", ")
      : "...args: unknown[]";
  const paramStr = `_entity: Entity, _ctx: GmlActionContext, ${paramList}`;

  const calledScripts = knownScripts.filter(
    (other) =>
      other !== name &&
      new RegExp(`\\b${escapeRegExp(other)}\\s*\\(`).test(transpiled),
  );
  const importLines = [
    `import type { Entity, GmlActionContext } from "@emptysock/engine";`,
    `import * as GmlActions from "@emptysock/engine";`,
    ...(transpiled.includes("GmlEnums.")
      ? [`import * as GmlEnums from "./assets/gml-enums.generated.js";`]
      : []),
    ...calledScripts.map(
      (other) => `import { ${other} } from "./${other}.js";`,
    ),
  ].join("\n");

  const indentedBody = indent(transpiled.trimEnd(), 2);
  const bodyBlock = indentedBody.length > 0 ? `\n${indentedBody}\n` : "\n";
  return `// Auto-generated from GMS2 script: ${name}
${importLines}

export function ${name}(${paramStr}): ${returnType} {${bodyBlock}}
`;
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

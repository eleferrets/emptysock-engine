import fs from "fs/promises";
import path from "path";
import { convertGms2Sprite } from "./gms2-sprite-import.js";
import { convertGms2Room } from "./gms2-room-import.js";
import {
  indent,
  readAndTranspileGML,
  transpileGML,
  scanGmlImplicitVars,
} from "./gms2-transpile.js";
import { parseGmsJson } from "./gms2-parse.js";

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
  [key: string]: unknown;
}

function isYyObject(val: unknown): val is YyObject {
  return typeof val === "object" && val !== null;
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
        components.push({
          component: "Sprite",
          overrides: {
            texturePath: `./assets/sprites/${spriteName}/frame_0.png`,
          },
        });
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
      if (parsed.solid === true) {
        components.push({ component: "Meta", overrides: { solid: true } });
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
  for (const gmlFile of gmlFiles) {
    try {
      const source = await fs.readFile(path.join(objectDir, gmlFile), "utf-8");
      for (const v of scanGmlImplicitVars(source)) objectImplicitVars.add(v);
    } catch {
      // unreadable — skip; the per-file readAndTranspileGML call below
      // will report this the same honest way it always has.
    }
  }

  async function buildMethod(
    methodName: string,
    eventLabel: string,
    paramStr: string,
    prefixRe: RegExp,
    optional = false,
  ): Promise<string> {
    const gmlFile = gmlFiles.find((f) => prefixRe.test(f));
    if (gmlFile) {
      const gmlPath = path.join(objectDir, gmlFile);
      const transpiled = await readAndTranspileGML(gmlPath, objectImplicitVars);
      if (transpiled !== null) {
        const body = indent(
          injectContextArgs(transpiled, knownScripts).trimEnd(),
          2,
        );
        return `export function ${methodName}(${paramStr}): void {\n  // [GML auto-transpiled — review carefully]\n${body}\n}`;
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

  const onCreate = await buildMethod(
    "onCreate",
    "Create event",
    "_entity: Entity, _ctx: GmlActionContext",
    /^Create_/i,
  );
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
    );
    const body =
      transpiled !== null
        ? indent(injectContextArgs(transpiled, knownScripts).trimEnd(), 2)
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
      const transpiled = await readAndTranspileGML(gmlPath, objectImplicitVars);
      const body =
        transpiled !== null
          ? indent(injectContextArgs(transpiled, knownScripts).trimEnd(), 2)
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
    const transpiled = await readAndTranspileGML(gmlPath, objectImplicitVars);
    const body =
      transpiled !== null
        ? indent(injectContextArgs(transpiled, knownScripts).trimEnd(), 2)
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

  return `// Auto-generated GMS2 behavior for object: ${name}
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
${scriptImportLines ? scriptImportLines + "\n" : ""}
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
        props: { x: inst.x, y: inst.y },
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
  let transpiled = transpileGML(body, paramNames);
  if (isLegacyArgStyle) {
    transpiled = transpiled.replace(/\bargument(\d+)\b/g, "args[$1]");
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
  const paramList =
    paramNames.length > 0
      ? paramNames.map((p) => `${p}: unknown`).join(", ")
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

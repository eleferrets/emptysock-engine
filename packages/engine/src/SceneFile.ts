import type { ComponentDef } from "./Component.js";
import { definePrefab, type PrefabDef } from "./Prefab.js";
import type { Scene, SpawnOptions } from "./Scene.js";
import type { SerializableRecord } from "./Serializable.js";
import { Meta } from "./components/Meta.js";

/**
 * ENGINE_DESIGN.md §13.4 — "scene/prefab files: JSON with generated `.d.ts`
 * types alongside". This module is the *runtime* half: parsing an
 * already-loaded JSON blob (a `.prefab.json`/`.scene.json` file's contents)
 * into the engine's `PrefabDef`/spawn calls, plus loading a scene's own
 * entity/prefab-instance list onto a live `Scene`. The offline half — the
 * `.d.ts` codegen that reads these same files to give `scene.spawn(...)`
 * autocomplete — lives in `packages/toolchain/src/prefabCodegen.ts` (see
 * that file's header comment for why the split lands there).
 *
 * File naming convention (not enforced by the loader, just what the IDE and
 * toolchain agree on): a prefab template lives at `<Name>.prefab.json` next
 * to the code that references it; a scene lives at `<Name>.scene.json`.
 * Both are plain JSON — no comments, no trailing commas (unlike the GMS2
 * importer's `.yy` quirk-handling, these are files *this* engine writes,
 * so there's no legacy format to tolerate).
 */

/** On-disk shape of one component entry inside a `.prefab.json` file. */
export interface PrefabFileComponentEntry {
  /** Must match a `ComponentDef.componentName` registered before loading. */
  readonly component: string;
  /** Field overrides layered over that component's own defaults. */
  readonly overrides?: SerializableRecord;
}

/** On-disk shape of a `.prefab.json` file. */
export interface PrefabFile {
  readonly prefabName: string;
  readonly components: readonly PrefabFileComponentEntry[];
  /** Names of other prefab files this one extends (§11.2 — prefabs-in-prefabs). */
  readonly extends?: readonly string[];
}

/** On-disk shape of one prefab-instance entry inside a `.scene.json` file. */
export interface SceneFilePrefabInstance {
  /** Name of a `PrefabFile` this instance spawns (resolved via `prefabsByName`). */
  readonly prefab: string;
  readonly props?: SerializableRecord;
  readonly pool?: boolean;
}

/** On-disk shape of one directly-declared (no prefab) entity in a `.scene.json` file. */
export interface SceneFileEntity {
  readonly components: readonly PrefabFileComponentEntry[];
}

/**
 * On-disk shape of one GameMaker room "view" (up to 8 per room) — see
 * `packages/toolchain/src/gms2-room-import.ts`'s `RoomView` for the real
 * `.yy` field names this is converted from, and `GmsRuntime.ts`'s
 * `applyRoomViews`/`compat/gmlCamera.ts` for how it's actually wired into a
 * live `CameraSystem`/multi-viewport render pass when a room loads. Field
 * names here are this engine's own (world/screen prefixes), not GameMaker's
 * `xview`/`xport`-style short names — this is the runtime-facing shape, the
 * `.yy` names are a toolchain-import-only concern.
 */
export interface SceneFileView {
  readonly visible: boolean;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly borderX: number;
  readonly borderY: number;
  readonly speedX: number;
  readonly speedY: number;
  /** The GameMaker object-type name this view follows (its `.yy` `objectId.name`), or absent for "no follow target". Resolved at runtime against `Meta.name` — see `resolveGmlObjectType`. */
  readonly followObject?: string;
}

/** On-disk shape of a `.scene.json` file. */
export interface SceneFile {
  readonly sceneName: string;
  /** Module/system names this scene needs enabled (e.g. `["physics"]`) — informational for now. */
  readonly systems?: readonly string[];
  readonly prefabInstances?: readonly SceneFilePrefabInstance[];
  readonly entities?: readonly SceneFileEntity[];
  /** Whether this room's viewport/camera system is active at all — GameMaker's room-wide `viewSettings.enableViews` (`view_enabled`). Views data (below) still parses and is still readable back via `gmlCamera.ts`'s compat functions even when this is `false`; it's just never mirrored onto a live `CameraSystem`/multi-viewport render pass. */
  readonly viewsEnabled?: boolean;
  /** Up to 8 view slots (index = GameMaker view slot 0-7), converted from the room's real `.yy` `views` array. */
  readonly views?: readonly SceneFileView[];
}

/** Looks up a registered `ComponentDef` by name, throwing with a useful message if missing. */
export type ComponentLookup = (name: string) => ComponentDef | undefined;

function resolveComponentEntries(
  entries: readonly PrefabFileComponentEntry[],
  lookup: ComponentLookup,
  context: string,
): { def: ComponentDef; overrides?: SerializableRecord }[] {
  return entries.map((entry) => {
    const def = lookup(entry.component);
    if (def === undefined) {
      throw new Error(
        `${context}: unknown component "${entry.component}" — it must be registered (via defineComponent + a lookup table) before loading this file.`,
      );
    }
    return entry.overrides === undefined
      ? { def }
      : { def, overrides: entry.overrides };
  });
}

/**
 * Parses a `.prefab.json` file's contents into a runtime `PrefabDef`.
 * `resolvePrefab` is only needed when `file.extends` is non-empty — it
 * resolves an extended prefab's *name* back to its already-parsed
 * `PrefabDef` (typically a small map you build by parsing a project's
 * prefab files in dependency order, or a second pass once every file's been
 * parsed once).
 */
export function parsePrefabFile(
  file: PrefabFile,
  lookup: ComponentLookup,
  resolvePrefab?: (name: string) => PrefabDef,
): PrefabDef {
  const components = resolveComponentEntries(
    file.components,
    lookup,
    `Prefab "${file.prefabName}"`,
  );
  const extendsList = (file.extends ?? []).map((name) => {
    if (resolvePrefab === undefined) {
      throw new Error(
        `Prefab "${file.prefabName}" extends "${name}" but no resolvePrefab lookup was provided.`,
      );
    }
    return resolvePrefab(name);
  });
  return definePrefab(file.prefabName, components, { extends: extendsList });
}

/**
 * Parses every prefab file in `files` in one pass, resolving `extends`
 * references between them regardless of array order (a two-pass topological
 * approach: define bare templates first, then re-resolve `extends` — simple
 * because prefab trees in practice are shallow and this only runs at
 * load/codegen time, never per-frame).
 */
export function parsePrefabFiles(
  files: readonly PrefabFile[],
  lookup: ComponentLookup,
): Map<string, PrefabDef> {
  const byName = new Map<string, PrefabFile>();
  for (const file of files) byName.set(file.prefabName, file);

  const resolved = new Map<string, PrefabDef>();
  const resolving = new Set<string>();

  const resolve = (name: string): PrefabDef => {
    const cached = resolved.get(name);
    if (cached !== undefined) return cached;
    if (resolving.has(name)) {
      throw new Error(`Prefab "${name}" has a circular "extends" reference.`);
    }
    const file = byName.get(name);
    if (file === undefined) {
      throw new Error(
        `Prefab "${name}" is referenced by "extends" but was not provided.`,
      );
    }
    resolving.add(name);
    const def = parsePrefabFile(file, lookup, resolve);
    resolving.delete(name);
    resolved.set(name, def);
    return def;
  };

  for (const file of files) resolve(file.prefabName);
  return resolved;
}

/**
 * Loads a parsed `.scene.json` file onto a live `Scene`: spawns every
 * prefab instance (via `scene.spawn(prefab, props, { pool })`) and every
 * directly-declared entity (a bare `scene.spawn()` with each listed
 * component `.add()`ed in order). Returns every entity spawned, in file
 * order, for a caller that wants to keep references (e.g. tagging the
 * player entity).
 */
/** Options for `loadSceneFile()`. */
export interface LoadSceneFileOptions {
  /**
   * Called once per entity, immediately after it's fully spawned (every
   * component attached, every prop applied) — the one real hook point for
   * "run one-time post-spawn setup" without `Scene`/`SceneFile` growing a
   * required dependency on any specific optional system. This is the
   * integration point `GmlBehaviorSystem.dispatchCreate()` uses to fire a
   * GMS2-imported prefab instance's `onCreate` (see that method's doc
   * comment): a GMS2-imported room's `.scene.json` is loaded through exactly
   * this function, and `onSpawned` is where a game calling `loadSceneFile()`
   * dispatches per-entity setup that depends on data only available once the
   * entity is live (its final component values), not at prefab-definition
   * time.
   */
  onSpawned?: (entity: ReturnType<Scene["spawn"]>) => void;
}

/**
 * Stamps a spawned prefab instance's `Meta.name` with the `PrefabDef` it was
 * spawned from, when nothing already gave it a name — this is what lets
 * `systems/GmlCollision.ts`'s `resolveGmlObjectType()` (and anything else
 * that wants "which object type is this instance") resolve a GMS2-imported
 * room's prefab instances back to their GameMaker object name, reusing the
 * one existing "this entity has an editor/tooling-visible name" component
 * (`Meta`, see CLAUDE.md's `QueryChannel`/`Meta.name`/`Meta.tags` note)
 * rather than inventing a second identity concept just for this. A prefab
 * whose own `.prefab.json` already includes a `Meta` component with a real
 * `name` override wins — this only fills in the gap, it never overwrites an
 * explicitly-authored name.
 */
function stampPrefabNameOntoMeta(
  entity: ReturnType<Scene["spawn"]>,
  prefabName: string,
): void {
  const meta = entity.get(Meta);
  if (meta === undefined) {
    entity.add(Meta, { name: prefabName });
  } else if (meta.name === "") {
    meta.name = prefabName;
  }
}

export function loadSceneFile(
  scene: Scene,
  file: SceneFile,
  lookup: ComponentLookup,
  prefabsByName: ReadonlyMap<string, PrefabDef>,
  options?: LoadSceneFileOptions,
): ReturnType<Scene["spawn"]>[] {
  const spawned: ReturnType<Scene["spawn"]>[] = [];

  for (const instance of file.prefabInstances ?? []) {
    const prefab = prefabsByName.get(instance.prefab);
    if (prefab === undefined) {
      throw new Error(
        `Scene "${file.sceneName}": unknown prefab "${instance.prefab}" — parse it first and include it in prefabsByName.`,
      );
    }
    const spawnOptions: SpawnOptions | undefined =
      instance.pool === true ? { pool: true } : undefined;
    const entity = scene.spawn(prefab, instance.props, spawnOptions);
    stampPrefabNameOntoMeta(entity, prefab.prefabName);
    options?.onSpawned?.(entity);
    spawned.push(entity);
  }

  for (const entityFile of file.entities ?? []) {
    const entity = scene.spawn();
    for (const { def, overrides } of resolveComponentEntries(
      entityFile.components,
      lookup,
      `Scene "${file.sceneName}" entity`,
    )) {
      entity.add(def, overrides as never);
    }
    options?.onSpawned?.(entity);
    spawned.push(entity);
  }

  return spawned;
}

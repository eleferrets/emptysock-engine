import type { ComponentDef } from "./Component.js";
import { definePrefab, type PrefabDef } from "./Prefab.js";
import type { Scene, SpawnOptions } from "./Scene.js";
import type { SerializableRecord } from "./Serializable.js";

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

/** On-disk shape of a `.scene.json` file. */
export interface SceneFile {
  readonly sceneName: string;
  /** Module/system names this scene needs enabled (e.g. `["physics"]`) — informational for now. */
  readonly systems?: readonly string[];
  readonly prefabInstances?: readonly SceneFilePrefabInstance[];
  readonly entities?: readonly SceneFileEntity[];
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
export function loadSceneFile(
  scene: Scene,
  file: SceneFile,
  lookup: ComponentLookup,
  prefabsByName: ReadonlyMap<string, PrefabDef>,
): ReturnType<Scene["spawn"]>[] {
  const spawned: ReturnType<Scene["spawn"]>[] = [];

  for (const instance of file.prefabInstances ?? []) {
    const prefab = prefabsByName.get(instance.prefab);
    if (prefab === undefined) {
      throw new Error(
        `Scene "${file.sceneName}": unknown prefab "${instance.prefab}" — parse it first and include it in prefabsByName.`,
      );
    }
    const options: SpawnOptions | undefined =
      instance.pool === true ? { pool: true } : undefined;
    spawned.push(scene.spawn(prefab, instance.props, options));
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
    spawned.push(entity);
  }

  return spawned;
}

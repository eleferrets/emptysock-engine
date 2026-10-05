import type { ComponentDef } from "./Component.js";
import { definePrefab, type PrefabDef } from "./Prefab.js";
import type { Scene, SpawnOptions } from "./Scene.js";
import type { SerializableRecord } from "./Serializable.js";
import { componentRegistry } from "./ComponentRegistry.js";
import { remapRefs } from "./RefRemap.js";
import { Meta } from "./components/Meta.js";
import type {
  SceneComponentEntry,
  SceneDocument,
  SceneEntity,
} from "./SceneDocument.js";
import { parseSceneDocument, type SceneFileV1 } from "./SceneMigrations.js";

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
 * Scene files are `SceneDocument`s (`SceneDocument.ts`, `formatVersion: 2`);
 * older files (no `formatVersion`) are migrated on read by
 * `parseSceneDocument` (`SceneMigrations.ts`). Prefab files are still the
 * name-keyed `components` map (`PrefabFile`); the legacy array shape is migrated on read (`migratePrefabFile`).
 *
 * File naming convention (not enforced by the loader, just what the IDE and
 * toolchain agree on): a prefab template lives at `<Name>.prefab.json` next
 * to the code that references it; a scene lives at `<Name>.scene.json`.
 * Both are plain JSON — no comments, no trailing commas (these are files *this* engine writes,
 * so there's no legacy format to tolerate).
 */

/**
 * On-disk shape of one component entry inside a `.prefab.json` file: the
 * same `{ v?, data }` entry a `SceneDocument` entity uses.
 */
export type PrefabFileComponentEntry = SceneComponentEntry;

/** Legacy (array-shaped) component entry; read-only, migrated on read. */
export interface PrefabFileV1ComponentEntry {
  readonly component: string;
  readonly overrides?: SerializableRecord;
}

/**
 * On-disk shape of a `.prefab.json` file. `components` is a name-keyed map
 * (key = registered component name); application order is JSON key order.
 */
export interface PrefabFile {
  readonly prefabName: string;
  readonly components: Readonly<Record<string, PrefabFileComponentEntry>>;
  /** Names of other prefab files this one extends (§11.2 — prefabs-in-prefabs). */
  readonly extends?: readonly string[];
}

/** Legacy array-shaped prefab file (`[{ component, overrides }]`). */
export interface PrefabFileV1 {
  readonly prefabName: string;
  readonly components: readonly PrefabFileV1ComponentEntry[];
  readonly extends?: readonly string[];
}

/**
 * Migrates a prefab file to the current shape. A name-keyed `components`
 * map is returned as is; the legacy array is converted in order (a
 * duplicated component name: last entry wins, at its first position).
 */
export function migratePrefabFile(file: PrefabFile | PrefabFileV1): PrefabFile {
  if (!Array.isArray(file.components)) return file as PrefabFile;
  const components: Record<string, PrefabFileComponentEntry> = {};
  for (const entry of file.components as readonly PrefabFileV1ComponentEntry[]) {
    components[entry.component] = { data: { ...(entry.overrides ?? {}) } };
  }
  return file.extends === undefined
    ? { prefabName: file.prefabName, components }
    : { prefabName: file.prefabName, components, extends: file.extends };
}

/** Looks up a registered `ComponentDef` by name, throwing with a useful message if missing. */
export type ComponentLookup = (name: string) => ComponentDef | undefined;

function resolveComponentEntries(
  entries: Readonly<Record<string, PrefabFileComponentEntry>>,
  lookup: ComponentLookup,
  context: string,
): { def: ComponentDef; overrides?: SerializableRecord }[] {
  return Object.entries(entries).map(([name, entry]) => {
    const def = lookup(name);
    if (def === undefined) {
      throw new Error(
        `${context}: unknown component "${name}" — it must be registered (via defineComponent + a lookup table) before loading this file.`,
      );
    }
    const data = entry.data as SerializableRecord | undefined;
    return data === undefined || Object.keys(data).length === 0
      ? { def }
      : { def, overrides: data };
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
  rawFile: PrefabFile | PrefabFileV1,
  lookup: ComponentLookup,
  resolvePrefab?: (name: string) => PrefabDef,
): PrefabDef {
  const file = migratePrefabFile(rawFile);
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
  files: readonly (PrefabFile | PrefabFileV1)[],
  lookup: ComponentLookup,
): Map<string, PrefabDef> {
  const byName = new Map<string, PrefabFile>();
  for (const raw of files) {
    const file = migratePrefabFile(raw);
    byName.set(file.prefabName, file);
  }

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
   * integration point behavior systems use to fire a
   * prefab instance's `onCreate`: a room's `.scene.json` is loaded through exactly
   * this function, and `onSpawned` is where a game calling `loadSceneFile()`
   * dispatches per-entity setup that depends on data only available once the
   * entity is live (its final component values), not at prefab-definition
   * time.
   */
  /**
   * Out-parameter: filled with `SceneEntity.id` -> spawned entity for the
   * loaded document, so callers can resolve file ids (e.g. a view's
   * `follow.entity`) after the load.
   */
  idMap?: Map<string, ReturnType<Scene["spawn"]>>;
  onSpawned?: (
    entity: ReturnType<Scene["spawn"]>,
    sceneEntity?: SceneEntity,
  ) => void;
}

/**
 * Stamps a spawned prefab instance's `Meta.name` with the `PrefabDef` it was
 * spawned from, when nothing already gave it a name — this is what lets
 * object-type lookups (anything that
 * wants "which object type is this instance") resolve a scene's prefab
 * instances back to their object name, reusing the
 * one existing "this entity has an editor/tooling-visible name" component
 * (`Meta`, see CLAUDE.md's `QueryChannel`/`Meta.name`/`Meta.tags` note)
 * rather than inventing a second identity concept just for this. A prefab
 * whose own `.prefab.json` already includes a `Meta` component with a real
 * `name` override wins — this only fills in the gap, it never overwrites an
 * explicitly-authored name.
 */
export function stampPrefabNameOntoMeta(
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
  file: SceneDocument | SceneFileV1,
  lookup: ComponentLookup,
  prefabsByName: ReadonlyMap<string, PrefabDef>,
  options?: LoadSceneFileOptions,
): ReturnType<Scene["spawn"]>[] {
  const doc = parseSceneDocument(file);
  const spawned: ReturnType<Scene["spawn"]>[] = [];

  // Phase 1: entities spawn in array order, recording file id -> entity.
  // Phase 2 (after the loop, `remapRefs` + `setParent`) resolves references
  // once every entity exists, so forward refs and children-before-parents
  // both work.
  const byFileId =
    options?.idMap ?? new Map<string, ReturnType<Scene["spawn"]>>();
  for (const sceneEntity of doc.entities) {
    let entity: ReturnType<Scene["spawn"]>;
    const prefabRef = sceneEntity.prefab;
    let prefab: PrefabDef | undefined;
    if (prefabRef !== undefined) {
      prefab = prefabsByName.get(prefabRef.name);
      if (prefab === undefined) {
        throw new Error(
          `Scene "${doc.name}": unknown prefab "${prefabRef.name}" — parse it first and include it in prefabsByName.`,
        );
      }
      const spawnOptions: SpawnOptions | undefined =
        sceneEntity.pool === true ? { pool: true } : undefined;
      entity = scene.spawn(
        prefab,
        prefabRef.props as SerializableRecord | undefined,
        spawnOptions,
      );
    } else {
      entity = scene.spawn();
    }

    // Per-component overrides win over the prefab: an already-present
    // component is patched in place, otherwise it is added.
    for (const [componentName, entry] of Object.entries(
      sceneEntity.components ?? {},
    )) {
      const def = lookup(componentName);
      if (def === undefined) {
        throw new Error(
          `Scene "${doc.name}" entity "${sceneEntity.id}": unknown component "${componentName}" — it must be registered (via defineComponent + a lookup table) before loading this file.`,
        );
      }
      let data: Record<string, unknown> = entry.data;
      if (entry.v !== undefined && entry.v !== def.version) {
        if (def.migrate !== undefined) {
          data = def.migrate(data, entry.v);
        } else {
          console.warn(
            `Scene "${doc.name}" entity "${sceneEntity.id}": component "${componentName}" was written at version ${entry.v} but is version ${def.version}; applying its data as written.`,
          );
        }
      }
      if (entity.has(def)) {
        Object.assign(entity.get(def) as object, data);
      } else {
        entity.add(def, data as never);
      }
    }

    applyEntityMeta(entity, sceneEntity);
    if (prefab !== undefined)
      stampPrefabNameOntoMeta(entity, prefab.prefabName);
    options?.onSpawned?.(entity, sceneEntity);
    spawned.push(entity);
    byFileId.set(sceneEntity.id, entity);
  }

  // Phase 2a: declared `entityRef` fields hold `{ $ref: "<file id>" }`; rewrite
  // them to runtime `{ $ref: <EntityId> }` (unknown ids become NO_REF + warn).
  remapRefs(
    scene,
    spawned,
    byFileId,
    componentRegistry.registeredComponents(scene.world),
  );

  // Phase 2b: hierarchy. `parent` is validated (existing, acyclic) by
  // `parseSceneDocument`; it becomes a `ChildOf` edge, so destroying a parent
  // destroys its children. Generated output does not set `parent`.
  for (const sceneEntity of doc.entities) {
    if (sceneEntity.parent === undefined) continue;
    const child = byFileId.get(sceneEntity.id);
    const parent = byFileId.get(sceneEntity.parent);
    if (child !== undefined && parent !== undefined) {
      scene.setParent(child, parent);
    }
  }

  return spawned;
}

/** Mirrors an entity's `name`/`tags`/`active`/`persistent` fields onto `Meta`, adding it only when one is actually set. */
function applyEntityMeta(
  entity: ReturnType<Scene["spawn"]>,
  e: SceneEntity,
): void {
  if (
    e.name === undefined &&
    e.tags === undefined &&
    e.active === undefined &&
    e.persistent === undefined
  ) {
    return;
  }
  const meta = entity.get(Meta) ?? entity.add(Meta);
  if (e.name !== undefined) meta.name = e.name;
  if (e.tags !== undefined) meta.tags = [...e.tags];
  if (e.active !== undefined) meta.active = e.active;
  if (e.persistent !== undefined) meta.persistent = e.persistent;
}

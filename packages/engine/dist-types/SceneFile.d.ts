import type { ComponentDef } from "./Component.js";
import { type PrefabDef } from "./Prefab.js";
import type { Scene } from "./Scene.js";
import type { SerializableRecord } from "./Serializable.js";
import type { SceneDocument, SceneEntity } from "./SceneDocument.js";
import { type SceneFileV1 } from "./SceneMigrations.js";
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
 * original `PrefabFile` shape (prefab unification is a follow-up).
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
/** Looks up a registered `ComponentDef` by name, throwing with a useful message if missing. */
export type ComponentLookup = (name: string) => ComponentDef | undefined;
/**
 * Parses a `.prefab.json` file's contents into a runtime `PrefabDef`.
 * `resolvePrefab` is only needed when `file.extends` is non-empty — it
 * resolves an extended prefab's *name* back to its already-parsed
 * `PrefabDef` (typically a small map you build by parsing a project's
 * prefab files in dependency order, or a second pass once every file's been
 * parsed once).
 */
export declare function parsePrefabFile(
  file: PrefabFile,
  lookup: ComponentLookup,
  resolvePrefab?: (name: string) => PrefabDef,
): PrefabDef;
/**
 * Parses every prefab file in `files` in one pass, resolving `extends`
 * references between them regardless of array order (a two-pass topological
 * approach: define bare templates first, then re-resolve `extends` — simple
 * because prefab trees in practice are shallow and this only runs at
 * load/codegen time, never per-frame).
 */
export declare function parsePrefabFiles(
  files: readonly PrefabFile[],
  lookup: ComponentLookup,
): Map<string, PrefabDef>;
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
  onSpawned?: (
    entity: ReturnType<Scene["spawn"]>,
    sceneEntity?: SceneEntity,
  ) => void;
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
export declare function stampPrefabNameOntoMeta(
  entity: ReturnType<Scene["spawn"]>,
  prefabName: string,
): void;
export declare function loadSceneFile(
  scene: Scene,
  file: SceneDocument | SceneFileV1,
  lookup: ComponentLookup,
  prefabsByName: ReadonlyMap<string, PrefabDef>,
  options?: LoadSceneFileOptions,
): ReturnType<Scene["spawn"]>[];

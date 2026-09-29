/**
 * Unified scene document (`SceneDocument`, `formatVersion: 2`) - the one
 * on-disk `.scene.json` shape shared by the IDE, the toolchain importer and
 * the runtime loader (docs/research/13-unified-scene-shape.md).
 *
 * The engine is zod-free, so these are structural interfaces mirroring the
 * zod schemas in `@emptysock/types` (`packages/types/src/scene.ts`), which
 * are the validation source of truth for tools that can depend on zod. The
 * engine validates with `parseSceneDocument` (SceneMigrations.ts).
 *
 * Rule: readers accept every older version (via `migrateScene`), writers emit
 * only `SCENE_FORMAT_VERSION`.
 */
export declare const SCENE_FORMAT_VERSION: 2;
/** Unique within one scene: /^[A-Za-z0-9_-]{1,64}$/. Uuids allowed, not required. */
export type SceneEntityId = string;
/** In-file entity reference. The runtime maps it to a live entity handle. */
export interface EntityRefJson {
  readonly $ref: SceneEntityId;
}
export interface SceneComponentEntry {
  /** `ComponentDef.version` this data was written at; omitted = current. */
  readonly v?: number;
  /** Overrides layered over the component's defaults (not full data). */
  readonly data: Readonly<Record<string, unknown>>;
}
export interface ScenePrefabRef {
  /** Resolved via `prefabsByName`. */
  readonly name: string;
  /** Flat overrides passed to `scene.spawn(prefab, props)`. */
  readonly props?: Readonly<Record<string, unknown>>;
}
export interface SceneEntity {
  readonly id: SceneEntityId;
  /** Maps to `Meta.name` (else the prefab name). */
  readonly name?: string;
  /** Maps to `Meta.tags`. */
  readonly tags?: readonly string[];
  /** Maps to `Meta.active`; default true. */
  readonly active?: boolean;
  /** Parent entity id. Validated; not yet acted on by the runtime. */
  readonly parent?: SceneEntityId;
  /** Maps to `Meta.persistent` (object-style carry-over across rooms). */
  readonly persistent?: boolean;
  readonly prefab?: ScenePrefabRef;
  /** Keyed by `ComponentDef.componentName`; applied after the prefab. */
  readonly components?: Readonly<Record<string, SceneComponentEntry>>;
  readonly layer?: string;
  readonly pool?: boolean;
  /** Namespaced tool/compat data, e.g. `ext.gml.vars` (GameMaker instance variable overrides). */
  readonly ext?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}
export interface SceneLayerDef {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly visible?: boolean;
}
export interface SceneRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}
/** One room view (up to 8; index = GameMaker view slot 0-7). */
export interface SceneViewDef {
  readonly id: string;
  readonly visible: boolean;
  readonly world: SceneRect;
  readonly screen: SceneRect;
  readonly border?: ScenePoint;
  readonly speed?: ScenePoint;
  readonly follow?: {
    /** GameMaker object-type name, resolved against `Meta.name` at runtime. */
    readonly object?: string;
    readonly entity?: EntityRefJson;
  };
}
export interface SceneRoom {
  readonly width: number;
  readonly height: number;
  /** GameMaker `view_enabled`. */
  readonly viewsEnabled?: boolean;
  readonly views?: readonly SceneViewDef[];
  readonly layers?: readonly SceneLayerDef[];
}
export interface SceneDocument {
  readonly formatVersion: typeof SCENE_FORMAT_VERSION;
  readonly id?: string;
  readonly name: string;
  /** Room-level state cache flag (GMS `roomSettings.persistent`). */
  readonly persistent?: boolean;
  readonly backgroundColor?: string;
  /** Module/system names this scene needs (informational for now). */
  readonly systems?: readonly string[];
  readonly room?: SceneRoom;
  readonly entities: readonly SceneEntity[];
  readonly metadata?: {
    readonly author?: string;
    readonly createdAt?: number;
    readonly updatedAt?: number;
  };
}

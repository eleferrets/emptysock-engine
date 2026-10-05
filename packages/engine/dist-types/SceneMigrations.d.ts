import { type SceneDocument } from "./SceneDocument.js";
import type { SerializableRecord } from "./Serializable.js";
/**
 * Scene format migrations. Readers accept every older version; writers emit
 * only `SCENE_FORMAT_VERSION`. Chain: v0 (never-produced `SceneSchema`
 * editor shape) -> v1 (the original runtime `SceneFile`, no `formatVersion`)
 * -> v2 (`SceneDocument`). Pure functions, no engine state.
 */
/** v1 component entry (also the `.prefab.json` component entry shape). */
export interface SceneFileV1ComponentEntry {
  readonly component: string;
  readonly overrides?: SerializableRecord;
}
export interface SceneFileV1PrefabInstance {
  readonly prefab: string;
  readonly props?: SerializableRecord;
  readonly gmlVars?: Readonly<Record<string, number | string | boolean>>;
  readonly pool?: boolean;
}
export interface SceneFileV1Entity {
  readonly components: readonly SceneFileV1ComponentEntry[];
}
export interface SceneFileV1View {
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
  readonly followObject?: string;
}
/** The pre-`formatVersion` on-disk scene shape. Read via `migrateScene` only; never written. */
export interface SceneFileV1 {
  readonly sceneName: string;
  readonly systems?: readonly string[];
  readonly prefabInstances?: readonly SceneFileV1PrefabInstance[];
  readonly entities?: readonly SceneFileV1Entity[];
  readonly viewsEnabled?: boolean;
  readonly roomWidth?: number;
  readonly roomHeight?: number;
  readonly views?: readonly SceneFileV1View[];
  readonly persistent?: boolean;
}
/** Migrates a v1 `SceneFile` to a v2 `SceneDocument`. Prefab instances come first, then direct entities (the order v1's `loadSceneFile` spawned). Synthesised ids are `p<i>` / `e<j>`. */
export declare function migrateSceneV1ToV2(file: SceneFileV1): SceneDocument;
/**
 * Migrates any supported raw scene blob to the latest shape (no validation
 * beyond version detection). A newer `formatVersion` than this engine
 * supports is a hard error naming both versions.
 */
export declare function migrateScene(raw: unknown): unknown;
/** `migrateScene` + validation. Throws with a descriptive message on bad input. */
export declare function parseSceneDocument(raw: unknown): SceneDocument;

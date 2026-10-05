import { z } from "zod";

/**
 * Unified scene document (`SceneDocument`, `formatVersion: 2`) shared by the
 * IDE, the toolchain and the runtime loader. See
 * the design notes. The engine keeps a zod-free
 * structural copy (`packages/engine/src/SceneDocument.ts`); this file is the
 * validation source of truth for tools that can depend on zod.
 */

/** Unique within one scene. Uuids are allowed, not required. */
export const EntityIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export type EntityId = z.infer<typeof EntityIdSchema>;

/** In-file entity reference; the runtime maps it to a live EntityRef. */
export const EntityRefJsonSchema = z.object({ $ref: EntityIdSchema }).strict();
export type EntityRefJson = z.infer<typeof EntityRefJsonSchema>;

export const ComponentEntrySchema = z.object({
  /** ComponentDef.version this data was written at; omitted = current. */
  v: z.number().int().positive().optional(),
  /** Overrides over the component's defaults only (not full data). */
  data: z.record(z.string(), z.unknown()),
});
export type ComponentEntry = z.infer<typeof ComponentEntrySchema>;

export const PrefabRefSchema = z.object({
  name: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
});
export type PrefabRef = z.infer<typeof PrefabRefSchema>;

export const SceneEntitySchema = z.object({
  id: EntityIdSchema,
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  /** Maps to Meta.active; default true. */
  active: z.boolean().optional(),
  /** Parent entity id (hierarchy is by id, not nesting). */
  parent: EntityIdSchema.optional(),
  /** Object-style persistence flag; maps to Meta.persistent. */
  persistent: z.boolean().optional(),
  prefab: PrefabRefSchema.optional(),
  components: z.record(z.string(), ComponentEntrySchema).optional(),
  layer: z.string().optional(),
  pool: z.boolean().optional(),
  /** Namespaced tool/compat data, e.g. ext.<namespace>.<key>. */
  ext: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});
export type SceneEntity = z.infer<typeof SceneEntitySchema>;

const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
const PointSchema = z.object({ x: z.number(), y: z.number() });

export const LayerDefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  depth: z.number(),
  visible: z.boolean().optional(),
});
export type LayerDef = z.infer<typeof LayerDefSchema>;

export const ViewDefSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  world: RectSchema,
  screen: RectSchema,
  border: PointSchema.optional(),
  speed: PointSchema.optional(),
  follow: z
    .object({
      /** Object type name (was followObject). */
      object: z.string().optional(),
      entity: EntityRefJsonSchema.optional(),
    })
    .optional(),
});
export type ViewDef = z.infer<typeof ViewDefSchema>;

export const SCENE_FORMAT_VERSION = 2 as const;

const SceneDocumentBaseSchema = z.object({
  formatVersion: z.literal(SCENE_FORMAT_VERSION),
  id: z.string().optional(),
  name: z.string().min(1),
  /** Room-level state cache flag (`roomSettings.persistent). */
  persistent: z.boolean().optional(),
  backgroundColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  systems: z.array(z.string()).optional(),
  room: z
    .object({
      width: z.number(),
      height: z.number(),
      viewsEnabled: z.boolean().optional(),
      views: z.array(ViewDefSchema).optional(),
      layers: z.array(LayerDefSchema).optional(),
    })
    .optional(),
  entities: z.array(SceneEntitySchema),
  metadata: z
    .object({
      author: z.string().optional(),
      createdAt: z.number().optional(),
      updatedAt: z.number().optional(),
    })
    .optional(),
});

/** Cross-entity checks: unique ids, existing + acyclic parents, resolvable structural refs. */
export function checkSceneStructure(
  doc: z.infer<typeof SceneDocumentBaseSchema>,
  ctx: z.RefinementCtx,
): void {
  const ids = new Set<string>();
  doc.entities.forEach((e, i) => {
    if (ids.has(e.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate entity id "${e.id}"`,
        path: ["entities", i, "id"],
      });
    }
    ids.add(e.id);
  });
  const parentOf = new Map<string, string>();
  doc.entities.forEach((e, i) => {
    if (e.parent === undefined) return;
    if (!ids.has(e.parent)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `entity "${e.id}" has unknown parent "${e.parent}"`,
        path: ["entities", i, "parent"],
      });
      return;
    }
    parentOf.set(e.id, e.parent);
  });
  doc.entities.forEach((e, i) => {
    let cur: string | undefined = e.id;
    for (let hops = 0; cur !== undefined; hops++) {
      cur = parentOf.get(cur);
      if (cur === e.id || hops > doc.entities.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `entity "${e.id}" is part of a parent cycle`,
          path: ["entities", i, "parent"],
        });
        return;
      }
    }
  });
  doc.room?.views?.forEach((v, i) => {
    const ref = v.follow?.entity;
    if (ref !== undefined && !ids.has(ref.$ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `view "${v.id}" follows unknown entity "${ref.$ref}"`,
        path: ["room", "views", i, "follow", "entity"],
      });
    }
  });
}

export const SceneDocumentSchema =
  SceneDocumentBaseSchema.superRefine(checkSceneStructure);
export type SceneDocument = z.infer<typeof SceneDocumentBaseSchema>;

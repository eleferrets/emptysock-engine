/**
 * Pure helpers for editing the parts of an imported room's `.scene.json` the
 * Room Editor's canvas does not draw as prefab instances: direct `entities`
 * (e.g. converted background layers) and camera `views`/`viewsEnabled`.
 * Every function returns a new `extra` record; unknown fields are preserved.
 */
export type Extra = Record<string, unknown>;

export interface EditableView {
  visible: boolean;
  worldX: number;
  worldY: number;
  worldWidth: number;
  worldHeight: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  borderX: number;
  borderY: number;
  speedX: number;
  speedY: number;
  followObject?: string;
}

export const VIEW_NUMBER_FIELDS = [
  "worldX",
  "worldY",
  "worldWidth",
  "worldHeight",
  "screenX",
  "screenY",
  "screenWidth",
  "screenHeight",
  "borderX",
  "borderY",
  "speedX",
  "speedY",
] as const;
export type ViewNumberField = (typeof VIEW_NUMBER_FIELDS)[number];

export function getViews(extra: Extra): EditableView[] {
  const v = extra["views"];
  return Array.isArray(v) ? (v as EditableView[]) : [];
}

export function getViewsEnabled(extra: Extra): boolean {
  return extra["viewsEnabled"] === true;
}

export function setViewsEnabled(extra: Extra, enabled: boolean): Extra {
  return { ...extra, viewsEnabled: enabled };
}

export function patchView(
  extra: Extra,
  index: number,
  patch: Partial<EditableView>,
): Extra {
  const views = getViews(extra);
  if (index < 0 || index >= views.length) return extra;
  const next = views.map((v, i) => (i === index ? { ...v, ...patch } : v));
  return { ...extra, views: next };
}

interface EntityLike {
  components?: { component: string; overrides?: Record<string, unknown> }[];
}

export function getEntities(extra: Extra): EntityLike[] {
  const e = extra["entities"];
  return Array.isArray(e) ? (e as EntityLike[]) : [];
}

export function entityPosition(e: EntityLike): { x: number; y: number } {
  const t = e.components?.find((c) => c.component === "Transform");
  const o = t?.overrides ?? {};
  return {
    x: typeof o["x"] === "number" ? o["x"] : 0,
    y: typeof o["y"] === "number" ? o["y"] : 0,
  };
}

/** Sets an entity's Transform x/y, adding the Transform entry if absent. */
export function moveEntity(
  extra: Extra,
  index: number,
  x: number,
  y: number,
): Extra {
  const entities = getEntities(extra);
  if (index < 0 || index >= entities.length) return extra;
  const next = entities.map((e, i) => {
    if (i !== index) return e;
    const comps = [...(e.components ?? [])];
    const ti = comps.findIndex((c) => c.component === "Transform");
    if (ti >= 0) {
      const t = comps[ti];
      if (t) comps[ti] = { ...t, overrides: { ...t.overrides, x, y } };
    } else {
      comps.push({ component: "Transform", overrides: { x, y } });
    }
    return { ...e, components: comps };
  });
  return { ...extra, entities: next };
}

/** Human label for an entity row: its Meta.name, first Sprite path, or "Entity N". */
export function entityLabel(e: EntityLike, index: number): string {
  const name = e.components?.find((c) => c.component === "Meta")?.overrides?.[
    "name"
  ];
  if (typeof name === "string" && name !== "") return name;
  const tex = e.components?.find((c) => c.component === "Sprite")?.overrides?.[
    "texturePath"
  ];
  if (typeof tex === "string" && tex !== "") return tex.split("/").pop() ?? tex;
  return `Entity ${index}`;
}

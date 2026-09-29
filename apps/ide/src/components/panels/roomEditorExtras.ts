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

// ── Canvas geometry for views and direct entities ───────────────────────────

/** Axis-aligned box in room pixels (top-left origin), the same shape as `roomEditorGeometry`'s `Box`. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The world-space rectangle a view's camera looks at. */
export function viewRect(v: EditableView): Rect {
  return { x: v.worldX, y: v.worldY, w: v.worldWidth, h: v.worldHeight };
}

/** The screen (port) rectangle a view draws into, in game-window pixels. */
export function viewPortRect(v: EditableView): Rect {
  return { x: v.screenX, y: v.screenY, w: v.screenWidth, h: v.screenHeight };
}

/** Sets a view's whole screen (port) rectangle, rounded to whole pixels. */
export function setViewPortRect(extra: Extra, index: number, r: Rect): Extra {
  return patchView(extra, index, {
    screenX: Math.round(r.x),
    screenY: Math.round(r.y),
    screenWidth: Math.round(r.w),
    screenHeight: Math.round(r.h),
  });
}

/** Flips a view's `visible` flag (hidden views are still drawn, dimmed, and editable on the canvas). */
export function toggleViewVisible(extra: Extra, index: number): Extra {
  const v = getViews(extra)[index];
  return v === undefined
    ? extra
    : patchView(extra, index, { visible: !v.visible });
}

/** Moves a view's world rectangle, keeping its size. */
export function moveView(
  extra: Extra,
  index: number,
  x: number,
  y: number,
): Extra {
  return patchView(extra, index, { worldX: x, worldY: y });
}

/** Sets a view's whole world rectangle (used by corner/edge resizing). */
export function setViewRect(extra: Extra, index: number, r: Rect): Extra {
  return patchView(extra, index, {
    worldX: r.x,
    worldY: r.y,
    worldWidth: r.w,
    worldHeight: r.h,
  });
}

/** Sets which object type a view follows; an empty name removes the field. */
export function setViewFollowObject(
  extra: Extra,
  index: number,
  name: string,
): Extra {
  const views = getViews(extra);
  if (index < 0 || index >= views.length) return extra;
  const trimmed = name.trim();
  const next = views.map((v, i) => {
    if (i !== index) return v;
    const rest: EditableView = { ...v };
    delete rest.followObject;
    return trimmed === "" ? rest : { ...rest, followObject: trimmed };
  });
  return { ...extra, views: next };
}

function compNumber(
  e: EntityLike,
  component: string,
  field: string,
  fallback: number,
): number {
  const v = e.components?.find((c) => c.component === component)?.overrides?.[
    field
  ];
  return typeof v === "number" ? v : fallback;
}

/**
 * The room-space box an entity is drawn as: its `Sprite` width/height times
 * `Transform` scale (falling back to `defaultSize` when it has no sized
 * sprite), positioned so `Transform` x/y sits at the sprite's anchor
 * (default centre, as `Sprite.anchorX/anchorY`).
 */
export function entityRect(e: EntityLike, defaultSize: number): Rect {
  const { x, y } = entityPosition(e);
  const sw = compNumber(e, "Sprite", "width", 0);
  const sh = compNumber(e, "Sprite", "height", 0);
  const w =
    (sw > 0 ? sw : defaultSize) *
    Math.abs(compNumber(e, "Transform", "scaleX", 1));
  const h =
    (sh > 0 ? sh : defaultSize) *
    Math.abs(compNumber(e, "Transform", "scaleY", 1));
  const ax = compNumber(e, "Sprite", "anchorX", 0.5);
  const ay = compNumber(e, "Sprite", "anchorY", 0.5);
  return { x: x - ax * w, y: y - ay * h, w, h };
}

export interface ExtraHit {
  kind: "entity" | "view";
  index: number;
}

/** Height/width of the label chip drawn at a view's top-left corner, which is also its grab area. */
export const VIEW_CHIP = { w: 48, h: 14 };

/**
 * What a click at (px,py) selects among the room's direct entities and views:
 * entities by body (topmost, i.e. last, first), views only by their border
 * (within `tolerance`) or label chip, so a view rectangle never swallows
 * clicks meant for what is inside it. Invisible views are skipped unless
 * `includeHidden` is set (the canvas draws them dimmed and lets them be
 * selected, moved and resized like any other).
 */
export function hitTestExtras(
  extra: Extra,
  px: number,
  py: number,
  tolerance: number,
  defaultSize: number,
  includeHidden = false,
): ExtraHit | null {
  const entities = getEntities(extra);
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    if (e === undefined) continue;
    const r = entityRect(e, defaultSize);
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
      return { kind: "entity", index: i };
    }
  }
  const views = getViews(extra);
  for (let i = views.length - 1; i >= 0; i--) {
    const v = views[i];
    if (v === undefined || (!v.visible && !includeHidden)) continue;
    const r = viewRect(v);
    const inChip =
      px >= r.x &&
      px <= r.x + VIEW_CHIP.w &&
      py >= r.y - VIEW_CHIP.h &&
      py <= r.y;
    const outer =
      px >= r.x - tolerance &&
      px <= r.x + r.w + tolerance &&
      py >= r.y - tolerance &&
      py <= r.y + r.h + tolerance;
    const inner =
      px > r.x + tolerance &&
      px < r.x + r.w - tolerance &&
      py > r.y + tolerance &&
      py < r.y + r.h - tolerance;
    if (inChip || (outer && !inner)) return { kind: "view", index: i };
  }
  return null;
}

/** Object-type names offered when choosing a view's follow target: every prefab placed in the room. */
export function followCandidates(
  instances: readonly { prefab: string }[],
): string[] {
  return [...new Set(instances.map((i) => i.prefab))].sort();
}

// ── Drawing a brand-new view ─────────────────────────────────────────────────

/** GameMaker has 8 view slots per room. */
export const MAX_VIEWS = 8;

/** Smallest rectangle (room pixels, each side) a drag must cover to create a view. */
export const MIN_NEW_VIEW = 16;

/** Normalises a drag from (x0,y0) to (x1,y1) into a top-left-origin rectangle. */
export function rectFromDrag(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}

/** True for an imported room's untouched placeholder slot (hidden, at the origin, following nothing). */
function isUnusedView(v: EditableView): boolean {
  return (
    !v.visible &&
    v.followObject === undefined &&
    v.worldX === 0 &&
    v.worldY === 0
  );
}

/**
 * Adds a new visible view looking at `rect`. It takes the first unused
 * placeholder slot (imported rooms carry 8 hidden ones) or appends, up to
 * `MAX_VIEWS`; returns the unchanged `extra` and `index: -1` when the room is
 * full or `rect` is smaller than `MIN_NEW_VIEW`. The port starts as the same
 * size at the window origin, the values GameMaker's own editor defaults to;
 * views are switched on because a view that cannot show is no use.
 */
export function addView(
  extra: Extra,
  rect: Rect,
): { extra: Extra; index: number } {
  if (rect.w < MIN_NEW_VIEW || rect.h < MIN_NEW_VIEW)
    return { extra, index: -1 };
  const views = getViews(extra);
  const fresh: EditableView = {
    visible: true,
    worldX: Math.round(rect.x),
    worldY: Math.round(rect.y),
    worldWidth: Math.round(rect.w),
    worldHeight: Math.round(rect.h),
    screenX: 0,
    screenY: 0,
    screenWidth: Math.round(rect.w),
    screenHeight: Math.round(rect.h),
    borderX: 32,
    borderY: 32,
    speedX: -1,
    speedY: -1,
  };
  const slot = views.findIndex(isUnusedView);
  if (slot >= 0) {
    const next = views.map((v, i) => (i === slot ? fresh : v));
    return {
      extra: { ...extra, views: next, viewsEnabled: true },
      index: slot,
    };
  }
  if (views.length >= MAX_VIEWS) return { extra, index: -1 };
  return {
    extra: { ...extra, views: [...views, fresh], viewsEnabled: true },
    index: views.length,
  };
}

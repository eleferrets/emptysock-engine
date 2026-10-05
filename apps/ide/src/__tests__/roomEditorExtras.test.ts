import { describe, it, expect } from "vitest";
import {
  patchView,
  moveEntity,
  entityPosition,
  getViews,
  setViewsEnabled,
  getViewsEnabled,
  entityLabel,
  getEntities,
  entityRect,
  hitTestExtras,
  viewPortRect,
  setViewPortRect,
  toggleViewVisible,
  moveView,
  setViewFollowObject,
  setViewRect,
  followCandidates,
  addView,
  rectFromDrag,
  MAX_VIEWS,
  type EditableView,
} from "../components/panels/roomEditorExtras";

const view = {
  id: "v0",
  visible: true,
  worldX: 0,
  worldY: 0,
  worldWidth: 320,
  worldHeight: 180,
  screenX: 0,
  screenY: 0,
  screenWidth: 640,
  screenHeight: 360,
  borderX: 32,
  borderY: 32,
  speedX: -1,
  speedY: -1,
};

describe("roomEditorExtras", () => {
  it("patches one view and keeps unrelated extra fields", () => {
    const extra = { views: [view, view], keep: 1 };
    const out = patchView(extra, 1, { worldX: 50 });
    expect(getViews(out)[1]?.worldX).toBe(50);
    expect(getViews(out)[0]?.worldX).toBe(0);
    expect(out["keep"]).toBe(1);
    expect(patchView(extra, 9, { worldX: 1 })).toBe(extra);
  });
  it("toggles viewsEnabled", () => {
    expect(getViewsEnabled(setViewsEnabled({}, true))).toBe(true);
  });
  it("moves an entity's Transform, adding it when absent", () => {
    const extra = {
      entities: [
        {
          id: "e0",
          components: { Transform: { data: { x: 1, y: 2, scaleX: 3 } } },
        },
        {
          id: "e1",
          components: { Sprite: { data: { texturePath: "a/bg.png" } } },
        },
      ],
    };
    const a = moveEntity(extra, 0, 10, 20);
    const b = moveEntity(a, 1, 5, 6);
    const ents = getEntities(b);
    expect(ents[0] && entityPosition(ents[0])).toEqual({ x: 10, y: 20 });
    expect(ents[1] && entityPosition(ents[1])).toEqual({ x: 5, y: 6 });
    expect(ents[0]?.components?.["Transform"]?.data["scaleX"]).toBe(3);
    expect(ents[0]?.id).toBe("e0");
    expect(ents[1] && entityLabel(ents[1], 1)).toBe("bg.png");
  });
});

const viewFull: EditableView = {
  id: "v0",
  visible: true,
  worldX: 100,
  worldY: 100,
  worldWidth: 200,
  worldHeight: 100,
  screenX: 0,
  screenY: 0,
  screenWidth: 400,
  screenHeight: 200,
  borderX: 0,
  borderY: 0,
  speedX: -1,
  speedY: -1,
};

describe("roomEditorExtras geometry", () => {
  it("sizes an entity from Sprite width/height, scale and anchor", () => {
    const e = {
      components: {
        Transform: { data: { x: 10, y: 20, scaleX: 2 } },
        Sprite: { data: { width: 20, height: 10, anchorX: 0, anchorY: 1 } },
      },
    };
    expect(entityRect(e, 32)).toEqual({ x: 10, y: 10, w: 40, h: 10 });
    expect(entityRect({}, 32)).toEqual({ x: -16, y: -16, w: 32, h: 32 });
  });

  it("hit-tests entities by body and views by border or chip only", () => {
    const extra = {
      views: [viewFull],
      entities: [{ components: { Transform: { data: { x: 0, y: 0 } } } }],
    };
    expect(hitTestExtras(extra, 0, 0, 6, 32)).toEqual({
      kind: "entity",
      index: 0,
    });
    expect(hitTestExtras(extra, 200, 150, 6, 32)).toBeNull();
    expect(hitTestExtras(extra, 100, 150, 6, 32)).toEqual({
      kind: "view",
      index: 0,
    });
    expect(hitTestExtras(extra, 110, 90, 6, 32)).toEqual({
      kind: "view",
      index: 0,
    });
    expect(
      hitTestExtras(
        { views: [{ ...viewFull, visible: false }] },
        100,
        150,
        6,
        32,
      ),
    ).toBeNull();
  });

  it("moves, resizes and sets followObject, removing it when empty", () => {
    const extra = { views: [viewFull], other: 1 };
    expect(moveView(extra, 0, 5, 6)["views"]).toEqual([
      { ...viewFull, worldX: 5, worldY: 6 },
    ]);
    expect(setViewRect(extra, 0, { x: 1, y: 2, w: 3, h: 4 })["views"]).toEqual([
      { ...viewFull, worldX: 1, worldY: 2, worldWidth: 3, worldHeight: 4 },
    ]);
    const followed = setViewFollowObject(extra, 0, " obj_player ");
    expect((followed["views"] as EditableView[])[0]?.followObject).toBe(
      "obj_player",
    );
    const cleared = setViewFollowObject(followed, 0, "");
    expect(cleared["views"]).toEqual([viewFull]);
    expect(cleared["other"]).toBe(1);
    expect(setViewFollowObject(extra, 9, "x")).toBe(extra);
  });

  it("lists distinct prefab names for the follow datalist", () => {
    expect(
      followCandidates([
        { prefab: { name: "b" } },
        { prefab: { name: "a" } },
        { prefab: { name: "b" } },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("hit-tests hidden views only when asked", () => {
    const hidden = { views: [{ ...viewFull, visible: false }] };
    expect(hitTestExtras(hidden, 100, 150, 6, 32, true)).toEqual({
      kind: "view",
      index: 0,
    });
  });

  it("reads and writes a view's screen (port) rectangle, rounded", () => {
    const extra = { views: [viewFull], other: 1 };
    const r = viewPortRect(viewFull);
    expect(r).toEqual({
      x: viewFull.screenX,
      y: viewFull.screenY,
      w: viewFull.screenWidth,
      h: viewFull.screenHeight,
    });
    const next = setViewPortRect(extra, 0, {
      x: 10.4,
      y: 20.6,
      w: 100.2,
      h: 50,
    });
    expect(next["views"]).toEqual([
      {
        ...viewFull,
        screenX: 10,
        screenY: 21,
        screenWidth: 100,
        screenHeight: 50,
      },
    ]);
    expect(next["other"]).toBe(1);
  });

  it("toggles visibility", () => {
    const next = toggleViewVisible({ views: [viewFull] }, 0);
    expect((next["views"] as { visible: boolean }[])[0]?.visible).toBe(false);
    expect(toggleViewVisible({ views: [viewFull] }, 5)["views"]).toEqual([
      viewFull,
    ]);
  });
});

describe("addView / rectFromDrag", () => {
  let seq = 0;
  const unused = (): EditableView => ({
    id: `u${seq++}`,
    visible: false,
    worldX: 0,
    worldY: 0,
    worldWidth: 1024,
    worldHeight: 768,
    screenX: 0,
    screenY: 0,
    screenWidth: 1024,
    screenHeight: 768,
    borderX: 0,
    borderY: 0,
    speedX: -1,
    speedY: -1,
  });

  it("normalises a drag in any direction", () => {
    expect(rectFromDrag(300, 200, 100, 50)).toEqual({
      x: 100,
      y: 50,
      w: 200,
      h: 150,
    });
  });

  it("appends a visible view and switches views on", () => {
    const r = addView({}, { x: 10.4, y: 20, w: 320, h: 240 });
    expect(r.index).toBe(0);
    expect(getViewsEnabled(r.extra)).toBe(true);
    expect(getViews(r.extra)[0]).toMatchObject({
      visible: true,
      worldX: 10,
      worldY: 20,
      worldWidth: 320,
      worldHeight: 240,
      screenWidth: 320,
      screenHeight: 240,
      speedX: -1,
    });
  });

  it("takes the first unused placeholder slot of an scene", () => {
    const first = { ...unused(), visible: true, worldX: 5 };
    const extra = { views: [first, unused(), unused()] };
    const r = addView(extra, { x: 64, y: 64, w: 128, h: 96 });
    expect(r.index).toBe(1);
    expect(getViews(r.extra)).toHaveLength(3);
    expect(getViews(r.extra)[0]).toBe(first);
    expect(getViews(r.extra)[1]).toMatchObject({ visible: true, worldX: 64 });
  });

  it("refuses a tiny drag and a full room", () => {
    const tiny = addView({}, { x: 0, y: 0, w: 4, h: 200 });
    expect(tiny.index).toBe(-1);
    const full = {
      views: Array.from({ length: MAX_VIEWS }, () => ({
        ...unused(),
        visible: true,
      })),
    };
    const r = addView(full, { x: 0, y: 0, w: 100, h: 100 });
    expect(r.index).toBe(-1);
    expect(r.extra).toBe(full);
  });
});

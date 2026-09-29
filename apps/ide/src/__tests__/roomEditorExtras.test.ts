import { describe, it, expect } from "vitest";
import {
  entityRect,
  hitTestExtras,
  moveView,
  setViewFollowObject,
  setViewRect,
  followCandidates,
  type EditableView,
} from "../components/panels/roomEditorExtras.js";

const view: EditableView = {
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
      components: [
        { component: "Transform", overrides: { x: 10, y: 20, scaleX: 2 } },
        {
          component: "Sprite",
          overrides: { width: 20, height: 10, anchorX: 0, anchorY: 1 },
        },
      ],
    };
    expect(entityRect(e, 32)).toEqual({ x: 10, y: 10, w: 40, h: 10 });
    expect(entityRect({}, 32)).toEqual({ x: -16, y: -16, w: 32, h: 32 });
  });

  it("hit-tests entities by body and views by border or chip only", () => {
    const extra = {
      views: [view],
      entities: [
        { components: [{ component: "Transform", overrides: { x: 0, y: 0 } }] },
      ],
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
      hitTestExtras({ views: [{ ...view, visible: false }] }, 100, 150, 6, 32),
    ).toBeNull();
  });

  it("moves, resizes and sets followObject, removing it when empty", () => {
    const extra = { views: [view], other: 1 };
    expect(moveView(extra, 0, 5, 6)["views"]).toEqual([
      { ...view, worldX: 5, worldY: 6 },
    ]);
    expect(setViewRect(extra, 0, { x: 1, y: 2, w: 3, h: 4 })["views"]).toEqual([
      { ...view, worldX: 1, worldY: 2, worldWidth: 3, worldHeight: 4 },
    ]);
    const followed = setViewFollowObject(extra, 0, " obj_player ");
    expect((followed["views"] as EditableView[])[0]?.followObject).toBe(
      "obj_player",
    );
    const cleared = setViewFollowObject(followed, 0, "");
    expect(cleared["views"]).toEqual([view]);
    expect(cleared["other"]).toBe(1);
    expect(setViewFollowObject(extra, 9, "x")).toBe(extra);
  });

  it("lists distinct prefab names for the follow datalist", () => {
    expect(
      followCandidates([{ prefab: "b" }, { prefab: "a" }, { prefab: "b" }]),
    ).toEqual(["a", "b"]);
  });
});

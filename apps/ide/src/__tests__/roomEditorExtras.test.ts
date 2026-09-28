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
} from "../components/panels/roomEditorExtras";

const view = {
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
          components: [
            { component: "Transform", overrides: { x: 1, y: 2, scaleX: 3 } },
          ],
        },
        {
          components: [
            { component: "Sprite", overrides: { texturePath: "a/bg.png" } },
          ],
        },
      ],
    };
    const a = moveEntity(extra, 0, 10, 20);
    const b = moveEntity(a, 1, 5, 6);
    const ents = getEntities(b);
    expect(ents[0] && entityPosition(ents[0])).toEqual({ x: 10, y: 20 });
    expect(ents[1] && entityPosition(ents[1])).toEqual({ x: 5, y: 6 });
    const t = ents[0]?.components?.find((c) => c.component === "Transform");
    expect(t?.overrides?.["scaleX"]).toBe(3);
    expect(ents[1] && entityLabel(ents[1], 1)).toBe("bg.png");
  });
});

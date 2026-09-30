import { describe, expect, it, vi } from "vitest";
import { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { Sprite } from "../components/Sprite.js";
import { LayerSystem } from "../systems/LayerSystem.js";
import {
  getGmlSpeed,
  setGmlSpeed,
  getGmlDirection,
  setGmlDirection,
  getGmlHspeed,
  setGmlHspeed,
  getGmlVspeed,
  setGmlVspeed,
  exportGmlActionState,
  importGmlActionState,
  clearGmlActionState,
  action_set_relative,
  consumeRelativeFlag,
  room_last,
  previous_room,
  room_speed,
  get_gml_xstart,
  set_gml_xstart,
  get_gml_ystart,
  alarm_set,
  alarm_get,
  action_sound,
  spriteHalfExtents,
  bbox_left,
  bbox_right,
  bbox_top,
  bbox_bottom,
  sprite_width,
  sprite_height,
  action_if_mouse,
  action_if_question,
  type GmlActionContext,
} from "../compat/gmlActions.js";
import {
  view_get_xport,
  view_set_xport,
  view_get_yport,
  view_set_yport,
  view_get_wport,
  view_set_wport,
  view_get_hport,
  view_set_hport,
  view_get_camera,
  room_get_camera,
  room_set_camera,
  room_set_viewport,
  room_set_view_enabled,
  view_get_visible,
  view_get_enabled,
} from "../compat/gmlCamera.js";
import {
  layer_exists,
  layer_x,
  layer_y,
  layer_get_x,
  layer_get_y,
  layer_add_instance,
  layer_force_draw_depth,
  gml_current_layer,
} from "../compat/gmlLayer.js";

function setup(): { scene: Scene; ctx: GmlActionContext } {
  const scene = new Scene();
  return { scene, ctx: { scene } };
}

describe("gmlActions — speed/direction built-ins", () => {
  it("setGmlSpeed follows the remembered direction (y up is negative vy)", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    setGmlDirection(e, ctx, 90);
    setGmlSpeed(e, ctx, 4);
    expect(getGmlSpeed(e, ctx)).toBeCloseTo(4);
    expect(getGmlHspeed(e, ctx)).toBeCloseTo(0);
    expect(getGmlVspeed(e, ctx)).toBeCloseTo(-4);
    expect(getGmlDirection(e, ctx)).toBeCloseTo(90);
  });

  it("direction survives speed = 0", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    setGmlDirection(e, ctx, 135);
    setGmlSpeed(e, ctx, 3);
    setGmlSpeed(e, ctx, 0);
    expect(getGmlSpeed(e, ctx)).toBe(0);
    expect(getGmlDirection(e, ctx)).toBeCloseTo(135);
  });

  it("reads as zero for an entity with no motion", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    expect(getGmlSpeed(e, ctx)).toBe(0);
    expect(getGmlDirection(e, ctx)).toBe(0);
    expect(getGmlHspeed(e, ctx)).toBe(0);
    expect(getGmlVspeed(e, ctx)).toBe(0);
  });

  it("hspeed/vspeed recompute speed and direction (normalised to 0..360)", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    setGmlHspeed(e, ctx, 3);
    setGmlVspeed(e, ctx, 4);
    expect(getGmlSpeed(e, ctx)).toBeCloseTo(5);
    // vspeed +4 is down on screen: direction is in (180, 360)
    const dir = getGmlDirection(e, ctx);
    expect(dir).toBeGreaterThan(270);
    expect(dir).toBeLessThan(360);
  });
});

describe("gmlActions — state snapshot and relative flag", () => {
  it("export/import round-trips motion, alarms and start position", () => {
    const { scene, ctx } = setup();
    const a = scene.spawn();
    a.add(Transform, { x: 7, y: 9 });
    setGmlDirection(a, ctx, 0);
    setGmlSpeed(a, ctx, 2);
    alarm_set(a, ctx, 1, 30);
    get_gml_xstart(a, ctx);
    const snap = exportGmlActionState(a);

    const b = scene.spawn();
    b.add(Transform, { x: 100, y: 100 });
    importGmlActionState(b, snap);
    expect(getGmlSpeed(b, ctx)).toBeCloseTo(2);
    expect(alarm_get(b, ctx, 1)).toBe(30);
    expect(get_gml_xstart(b, ctx)).toBe(7);
    expect(get_gml_ystart(b, ctx)).toBe(9);
    // snapshot is a copy: mutating the source alarm does not leak
    alarm_set(a, ctx, 1, 5);
    expect(alarm_get(b, ctx, 1)).toBe(30);
  });

  it("export of an untouched entity is empty", () => {
    const { scene } = setup();
    const e = scene.spawn();
    const snap = exportGmlActionState(e);
    expect(snap.motion).toBeUndefined();
    expect(snap.start).toBeUndefined();
  });

  it("clearGmlActionState drops motion and start capture", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    e.add(Transform, { x: 3, y: 4 });
    setGmlSpeed(e, ctx, 5);
    get_gml_xstart(e, ctx);
    clearGmlActionState(e.world, e.eid);
    expect(getGmlSpeed(e, ctx)).toBe(0);
    expect(exportGmlActionState(e).start).toBeUndefined();
  });

  it("consumeRelativeFlag reads once then clears", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    expect(consumeRelativeFlag(e)).toBe(false);
    action_set_relative(e, ctx, true);
    expect(consumeRelativeFlag(e)).toBe(true);
    expect(consumeRelativeFlag(e)).toBe(false);
  });
});

describe("gmlActions — rooms, alarms, start pos", () => {
  it("room_last / previous_room / room_speed", () => {
    const { scene } = setup();
    expect(room_last({ scene })).toBe("");
    expect(room_last({ scene, roomOrder: ["a", "b", "c"] })).toBe("c");
    expect(previous_room({ scene })).toBe("");
    expect(previous_room({ scene, previousRoom: "a" })).toBe("a");
    expect(room_speed({ scene })).toBe(60);
  });

  it("alarm_get is -1 until alarm_set arms it", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    expect(alarm_get(e, ctx, 0)).toBe(-1);
    alarm_set(e, ctx, 0, 12);
    expect(alarm_get(e, ctx, 0)).toBe(12);
  });

  it("xstart captures first-access position and is writable", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    e.add(Transform, { x: 10, y: 20 });
    expect(get_gml_xstart(e, ctx)).toBe(10);
    const t = e.get(Transform);
    if (t === undefined) throw new Error("no transform");
    t.x = 99;
    expect(get_gml_xstart(e, ctx)).toBe(10);
    expect(set_gml_xstart(e, ctx, 55)).toBe(55);
    expect(get_gml_xstart(e, ctx)).toBe(55);
    expect(get_gml_ystart(e, ctx)).toBe(20);
  });
});

describe("gmlActions — sound and ask callbacks", () => {
  it("action_sound warns and no-ops without ctx.game", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    action_sound(e, ctx, "snd_x");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("action_sound maps via ctx.sounds, else passes the name through", () => {
    const { scene } = setup();
    const e = scene.spawn();
    const play = vi.fn();
    const game = { audio: { play } } as unknown as NonNullable<
      GmlActionContext["game"]
    >;
    action_sound(e, { scene, game, sounds: { snd_a: "asset-a" } }, "snd_a");
    action_sound(e, { scene, game }, "snd_b");
    expect(play).toHaveBeenNthCalledWith(1, "asset-a");
    expect(play).toHaveBeenNthCalledWith(2, "snd_b");
  });

  it("action_if_mouse / action_if_question delegate to predicates", () => {
    const { scene, ctx } = setup();
    const e = scene.spawn();
    expect(action_if_mouse(e, ctx, 2, (b) => b === 2)).toBe(true);
    expect(action_if_mouse(e, ctx, 1, (b) => b === 2)).toBe(false);
    expect(action_if_question(e, ctx, "sure?", () => true)).toBe(true);
  });
});

describe("gmlActions — bbox and sprite size", () => {
  it("defaults to a 32x32 box centred on the origin with no sprite", () => {
    const { scene } = setup();
    const e = scene.spawn();
    e.add(Transform, { x: 100, y: 50 });
    expect(bbox_left(e)).toBe(84);
    expect(bbox_right(e)).toBe(116);
    expect(bbox_top(e)).toBe(34);
    expect(bbox_bottom(e)).toBe(66);
  });

  it("uses sprite size and anchor when no mask is authored", () => {
    const { scene } = setup();
    const e = scene.spawn();
    e.add(Transform, { x: 100, y: 100 });
    e.add(Sprite, { width: 20, height: 10, anchorX: 0, anchorY: 0 });
    expect(bbox_left(e)).toBe(100);
    expect(bbox_right(e)).toBe(120);
    expect(bbox_top(e)).toBe(100);
    expect(bbox_bottom(e)).toBe(110);
    expect(spriteHalfExtents(e)).toMatchObject({ x: 10, y: 5, ox: 10, oy: 5 });
  });

  it("prefers the collision mask and scales it, including mirroring", () => {
    const { scene } = setup();
    const e = scene.spawn();
    e.add(Transform, { x: 0, y: 0, scaleX: -2, scaleY: 1 });
    e.add(Sprite, {
      width: 32,
      height: 32,
      bboxLeft: 4,
      bboxRight: 12,
      bboxTop: 2,
      bboxBottom: 6,
    });
    // mask x 4..12 scaled by -2 => -8..-24: left -24, right -8
    expect(bbox_left(e)).toBe(-24);
    expect(bbox_right(e)).toBe(-8);
    expect(bbox_top(e)).toBe(2);
    expect(bbox_bottom(e)).toBe(6);
  });

  it("sprite_width/height scale with the transform; 0 without sprite", () => {
    const { scene } = setup();
    const e = scene.spawn();
    e.add(Transform, { scaleX: 2, scaleY: 3 });
    expect(sprite_width(e)).toBe(0);
    e.add(Sprite, { width: 10, height: 4 });
    expect(sprite_width(e)).toBe(20);
    expect(sprite_height(e)).toBe(12);
  });

  it("bbox_* are 0 without a Transform", () => {
    const { scene } = setup();
    const e = scene.spawn();
    expect(bbox_left(e)).toBe(0);
    expect(bbox_bottom(e)).toBe(0);
  });
});

describe("gmlCamera — viewport ports and room_* aliases", () => {
  it("view port getters/setters round-trip per slot and clamp the slot", () => {
    const { ctx } = setup();
    view_set_xport(ctx, 1, 10);
    view_set_yport(ctx, 1, 20);
    view_set_wport(ctx, 1, 640);
    view_set_hport(ctx, 1, 480);
    expect(view_get_xport(ctx, 1)).toBe(10);
    expect(view_get_yport(ctx, 1)).toBe(20);
    expect(view_get_wport(ctx, 1)).toBe(640);
    expect(view_get_hport(ctx, 1)).toBe(480);
    expect(view_get_xport(ctx, 2)).toBe(0);
    // out-of-range slot clamps to 0 / 7
    view_set_xport(ctx, -5, 3);
    expect(view_get_xport(ctx, 0)).toBe(3);
    view_set_xport(ctx, 99, 8);
    expect(view_get_xport(ctx, 7)).toBe(8);
  });

  it("room_set_camera / room_get_camera ignore the room and hit the current views", () => {
    const { ctx } = setup();
    room_set_camera(ctx, 123, 0, 5);
    expect(view_get_camera(ctx, 0)).toBe(5);
    expect(room_get_camera(ctx, 999, 0)).toBe(5);
  });

  it("room_set_viewport sets visibility and all four port values", () => {
    const { ctx } = setup();
    room_set_viewport(ctx, 0, 2, true, 1, 2, 300, 200);
    expect(view_get_visible(ctx, 2)).toBe(true);
    expect(view_get_xport(ctx, 2)).toBe(1);
    expect(view_get_yport(ctx, 2)).toBe(2);
    expect(view_get_wport(ctx, 2)).toBe(300);
    expect(view_get_hport(ctx, 2)).toBe(200);
  });

  it("room_set_view_enabled toggles the room-wide switch", () => {
    const { ctx } = setup();
    room_set_view_enabled(ctx, 0, true);
    expect(view_get_enabled(ctx)).toBe(true);
    room_set_view_enabled(ctx, 0, false);
    expect(view_get_enabled(ctx)).toBe(false);
  });
});

describe("gmlLayer — layer functions", () => {
  function withLayers(): {
    scene: Scene;
    ctx: GmlActionContext;
    layers: LayerSystem;
  } {
    const scene = new Scene();
    const layers = new LayerSystem();
    layers.defineLayer("Fx", 5);
    return { scene, layers, ctx: { scene, layers } };
  }

  it("layer_exists is false without layers, and checks membership with", () => {
    const { scene } = setup();
    expect(layer_exists({ scene }, "Fx")).toBe(false);
    const { ctx } = withLayers();
    expect(layer_exists(ctx, "Fx")).toBe(true);
    expect(layer_exists(ctx, "Nope")).toBe(false);
  });

  it("layer_x / layer_y keep the other axis and read back", () => {
    const { ctx } = withLayers();
    layer_x(ctx, "Fx", 12);
    layer_y(ctx, "Fx", -4);
    expect(layer_get_x(ctx, "Fx")).toBe(12);
    expect(layer_get_y(ctx, "Fx")).toBe(-4);
    layer_x(ctx, "Fx", 1);
    expect(layer_get_y(ctx, "Fx")).toBe(-4);
  });

  it("layer offsets are safe no-ops/zero without layers", () => {
    const { ctx } = setup();
    layer_x(ctx, "Fx", 5);
    layer_y(ctx, "Fx", 5);
    expect(layer_get_x(ctx, "Fx")).toBe(0);
    expect(layer_get_y(ctx, "Fx")).toBe(0);
  });

  it("layer_add_instance moves an entity, keeping its depth", () => {
    const { scene, ctx, layers } = withLayers();
    const e = scene.spawn();
    layers.addEntity(e.rawId, "default", 7);
    layer_add_instance(ctx, "Fx", e);
    expect(layers.getEntityLayer(e.rawId)).toBe("Fx");
    expect(layers.getEntityDepth(e.rawId)).toBe(7);
  });

  it("gml_current_layer reports placement, else default", () => {
    const { scene, ctx, layers } = withLayers();
    const e = scene.spawn();
    expect(gml_current_layer(e, ctx)).toBe("default");
    layers.addEntity(e.rawId, "Fx", 0);
    expect(gml_current_layer(e, ctx)).toBe("Fx");
    expect(gml_current_layer(e, { scene })).toBe("default");
  });

  it("layer_force_draw_depth is an accepted no-op", () => {
    const { ctx } = setup();
    expect(() => layer_force_draw_depth(ctx, true, 0)).not.toThrow();
  });
});

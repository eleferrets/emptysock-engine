import { describe, expect, it, vi } from "vitest";
import { Scene } from "../Scene.js";
import { Game, defineScene } from "../Game.js";
import { Transform } from "../components/Transform.js";
import { Sprite } from "../components/Sprite.js";
import { definePrefab } from "../Prefab.js";
import {
  action_move,
  action_move_to,
  action_snap,
  action_set_friction,
  action_sprite_set,
  action_sprite_color,
  action_kill_object,
  instance_destroy,
  action_create_object,
  instance_create,
  instance_create_layer,
  action_set_alarm,
  action_if_collision,
  action_if_aligned,
  action_if_empty,
  action_another_room,
  room_goto,
  room,
  audio_play_sound,
  gmlActionsStep,
  clearGmlActionState,
  _getGmlMotion,
  type GmlActionContext,
} from "../compat/gmlActions.js";

function makeCtx(scene: Scene): GmlActionContext {
  return { scene };
}

/** Non-null assertions are banned in this codebase — this is the "or throw" helper tests use instead. */
function defined<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) {
    throw new Error("expected a defined value");
  }
  return value;
}

describe("gmlActions — GM8.1 DnD action compat", () => {
  it("action_move sets velocity for a single compass direction and gmlActionsStep applies it", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform);
    const ctx = makeCtx(scene);

    // bit 5 = East (see MOVE_DIRECTION_BITS reading-order layout)
    action_move(entity, ctx, 1 << 5, 4);
    const motion = _getGmlMotion(entity);
    expect(motion?.vx).toBeCloseTo(4);
    expect(motion?.vy).toBeCloseTo(0);

    const before = defined(entity.get(Transform)).x;
    gmlActionsStep(entity);
    expect(defined(entity.get(Transform)).x).toBeCloseTo(before + 4);
  });

  it("action_move averages two adjacent directions for diagonal motion", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform);
    const ctx = makeCtx(scene);

    // East (bit 5) + South (bit 7) -> south-east-ish average, not a naive sum
    action_move(entity, ctx, (1 << 5) | (1 << 7), 10);
    const motion = _getGmlMotion(entity);
    expect(motion).toBeDefined();
    // Magnitude should be close to speed (each unit vector normalized then averaged then scaled)
    const m = defined(motion);
    const mag = Math.hypot(m.vx, m.vy);
    expect(mag).toBeLessThanOrEqual(10 + 1e-6);
    expect(m.vx).toBeGreaterThan(0);
  });

  it("action_move with no direction bits set stops the entity", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform);
    const ctx = makeCtx(scene);
    action_move(entity, ctx, 1 << 5, 4);
    action_move(entity, ctx, 0, 4);
    expect(_getGmlMotion(entity)).toEqual({ vx: 0, vy: 0 });
  });

  it("action_set_friction decays velocity toward zero over successive steps", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform);
    const ctx = makeCtx(scene);
    action_move(entity, ctx, 1 << 5, 10);
    action_set_friction(entity, ctx, 3);
    gmlActionsStep(entity);
    expect(_getGmlMotion(entity)?.vx).toBeCloseTo(7);
    gmlActionsStep(entity);
    expect(_getGmlMotion(entity)?.vx).toBeCloseTo(4);
  });

  it("action_move_to repositions absolutely and relatively", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform, { x: 5, y: 5 });
    const ctx = makeCtx(scene);
    action_move_to(entity, ctx, 100, 200);
    expect(entity.get(Transform)).toMatchObject({ x: 100, y: 200 });
    action_move_to(entity, ctx, 10, -10, true);
    expect(entity.get(Transform)).toMatchObject({ x: 110, y: 190 });
  });

  it("action_snap rounds position down to the grid", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform, { x: 37, y: 53 });
    const ctx = makeCtx(scene);
    action_snap(entity, ctx, 16, 16);
    expect(entity.get(Transform)).toMatchObject({ x: 32, y: 48 });
  });

  it("action_sprite_set writes the Sprite texture path", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite);
    const ctx = makeCtx(scene);
    action_sprite_set(entity, ctx, "./sprites/spr_run/frame_0.png", 0, 1);
    expect(entity.get(Sprite)?.texturePath).toBe(
      "./sprites/spr_run/frame_0.png",
    );
  });

  it("action_sprite_color converts a GML BGR colour value into Sprite's RGB tint", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite);
    const ctx = makeCtx(scene);
    // GML colour 0x0000FF is pure red in BGR order (b=00,g=00,r=FF)
    action_sprite_color(entity, ctx, 0x0000ff, 0.5);
    expect(entity.get(Sprite)?.tint).toBe(0xff0000);
    expect(entity.get(Sprite)?.alpha).toBe(0.5);
  });

  it("action_kill_object destroys the entity via Scene.destroy", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform);
    const ctx = makeCtx(scene);
    action_kill_object(entity, ctx);
    expect(entity.isAlive).toBe(false);
  });

  it("instance_destroy() also destroys the entity — real gap: it used to transpile to an inert comment, not a real call at all", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform);
    const ctx = makeCtx(scene);
    instance_destroy(entity, ctx);
    expect(entity.isAlive).toBe(false);
  });

  it("room_goto() actually loads the named room via ctx.game.loadScene — real gap: it used to transpile to an inert comment, not a real call at all", async () => {
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}));
    const entity = scene.spawn();
    const nextRoomDef = defineScene({});
    const ctx: GmlActionContext = {
      scene,
      game,
      rooms: { rm_next: nextRoomDef },
    };
    const loadScene = vi.spyOn(game, "loadScene");
    room_goto(entity, ctx, "rm_next");
    expect(loadScene).toHaveBeenCalledWith(nextRoomDef);
    await game.unloadScene();
  });

  it("room_goto() is a real alias of action_another_room, not a second implementation", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const loadScene = vi.fn();
    const ctx = {
      scene,
      game: { loadScene } as unknown as GmlActionContext["game"],
      rooms: { rm_x: {} as never },
    } as GmlActionContext;
    room_goto(entity, ctx, "rm_x");
    action_another_room(entity, ctx, "rm_x");
    expect(loadScene).toHaveBeenCalledTimes(2);
  });

  it("audio_play_sound() actually plays the sound via ctx.game.audio.play — real gap: it used to transpile to an inert comment, not a real call at all", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const play = vi.fn();
    const ctx = {
      scene,
      game: { audio: { play } } as unknown as GmlActionContext["game"],
    } as GmlActionContext;
    audio_play_sound(entity, ctx, "snd_Shot", 5, false);
    expect(play).toHaveBeenCalledWith("snd_Shot");
  });

  it("action_create_object/instance_create spawn a registered prefab at a position", () => {
    const scene = new Scene();
    const prefab = definePrefab("obj_bullet", [{ def: Transform }]);
    const entity = scene.spawn();
    const ctx: GmlActionContext = { scene, prefabs: { obj_bullet: prefab } };

    const spawned = action_create_object(entity, ctx, "obj_bullet", 12, 34);
    expect(spawned).toBeDefined();
    expect(defined(spawned).get(Transform)).toMatchObject({ x: 12, y: 34 });

    const spawned2 = instance_create(entity, ctx, 1, 2, "obj_bullet");
    expect(defined(spawned2).get(Transform)).toMatchObject({ x: 1, y: 2 });
  });

  it("instance_create_layer also spawns a registered prefab, ignoring the layer argument — real gap: it used to transpile to an inert comment, not a real call at all", () => {
    const scene = new Scene();
    const prefab = definePrefab("obj_bullet_enemy", [{ def: Transform }]);
    const entity = scene.spawn();
    const ctx: GmlActionContext = {
      scene,
      prefabs: { obj_bullet_enemy: prefab },
    };
    const spawned = instance_create_layer(
      entity,
      ctx,
      12,
      34,
      "Bullets",
      "obj_bullet_enemy",
    );
    expect(defined(spawned).get(Transform)).toMatchObject({ x: 12, y: 34 });
  });

  it("action_create_object warns and returns undefined when the prefab isn't wired", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlActionContext = { scene };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spawned = action_create_object(entity, ctx, "obj_missing", 0, 0);
    expect(spawned).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("action_set_alarm ticks down and fires onAlarm exactly when it reaches zero", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx = makeCtx(scene);
    action_set_alarm(entity, ctx, 0, 2);
    const onAlarm = vi.fn();
    gmlActionsStep(entity, onAlarm);
    expect(onAlarm).not.toHaveBeenCalled();
    gmlActionsStep(entity, onAlarm);
    expect(onAlarm).toHaveBeenCalledWith(0);
    expect(onAlarm).toHaveBeenCalledTimes(1);
    // one-shot: further steps must not refire it
    gmlActionsStep(entity, onAlarm);
    expect(onAlarm).toHaveBeenCalledTimes(1);
  });

  it("action_if_collision is true only when two entities' bounding boxes overlap", () => {
    const scene = new Scene();
    const a = scene.spawn();
    a.add(Transform, { x: 0, y: 0 });
    const b = scene.spawn();
    b.add(Transform, { x: 10, y: 0 });
    const ctx = makeCtx(scene);
    expect(action_if_collision(a, ctx, b)).toBe(true);

    const c = scene.spawn();
    c.add(Transform, { x: 1000, y: 1000 });
    expect(action_if_collision(a, ctx, c)).toBe(false);
  });

  it("action_if_aligned checks grid alignment", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform, { x: 32, y: 48 });
    const ctx = makeCtx(scene);
    expect(action_if_aligned(entity, ctx, 16, 16)).toBe(true);
    defined(entity.get(Transform)).x = 33;
    expect(action_if_aligned(entity, ctx, 16, 16)).toBe(false);
  });

  it("action_if_empty is false when another entity occupies the target point", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform, { x: 0, y: 0 });
    const blocker = scene.spawn();
    blocker.add(Transform, { x: 50, y: 0 });
    const ctx = makeCtx(scene);
    expect(action_if_empty(entity, ctx, 50, 0)).toBe(false);
    expect(action_if_empty(entity, ctx, 500, 500)).toBe(true);
  });

  it("clearGmlActionState removes stored motion/alarm state for a (world, eid) pair", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx = makeCtx(scene);
    action_move(entity, ctx, 1 << 5, 4);
    expect(_getGmlMotion(entity)).toBeDefined();
    clearGmlActionState(scene.world, entity.eid);
    expect(_getGmlMotion(entity)).toBeUndefined();
  });

  it("Scene.destroy() clears gml action state so a pooled entity never inherits stale velocity", () => {
    const scene = new Scene();
    const prefab = definePrefab("obj_pooled", [{ def: Transform }]);
    const entity = scene.spawn(prefab, undefined, { pool: true });
    const ctx: GmlActionContext = { scene, prefabs: { obj_pooled: prefab } };
    action_move(entity, ctx, 1 << 5, 99);
    expect(_getGmlMotion(entity)?.vx).toBeCloseTo(99);

    scene.destroy(entity);
    const respawned = scene.spawn(prefab, undefined, { pool: true });
    expect(_getGmlMotion(respawned)).toBeUndefined();
  });
});

describe("room() — bare GML `room` built-in read", () => {
  it("returns ctx.currentRoom as-is", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene, currentRoom: "rm_menu" };
    expect(room(ctx)).toBe("rm_menu");
  });

  it("returns an honest empty string when nothing wired currentRoom", () => {
    const scene = new Scene();
    const ctx: GmlActionContext = { scene };
    expect(room(ctx)).toBe("");
  });
});

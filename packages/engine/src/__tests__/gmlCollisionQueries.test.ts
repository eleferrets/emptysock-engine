import { describe, expect, it } from "vitest";
import { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { Meta } from "../components/Meta.js";
import {
  place_meeting,
  place_free,
  place_snapped,
  position_meeting,
  position_free,
  instance_place,
  instance_position,
  collision_rectangle,
  collision_circle,
  collision_line,
  collision_point,
  instance_exists,
  instance_number,
} from "../compat/gmlCollisionQueries.js";
import type { GmlActionContext } from "../compat/gmlActions.js";

function makeCtx(scene: Scene): GmlActionContext {
  return { scene };
}

/** Non-null assertions are banned in this codebase. */
function defined<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) {
    throw new Error("expected a defined value");
  }
  return value;
}

function spawnAt(scene: Scene, x: number, y: number, objectName?: string) {
  const entity = scene.spawn();
  entity.add(Transform, { x, y });
  if (objectName !== undefined) {
    entity.add(Meta, { name: objectName });
  }
  return entity;
}

describe("gmlCollisionQueries — GameMaker's hypothetical-position query family", () => {
  it("place_meeting is true at a hypothetical position and never moves the real entity", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0);
    spawnAt(scene, 100, 0, "obj_wall");

    // Far away at the player's real position — no overlap.
    expect(place_meeting(player, ctx, 0, 0, "obj_wall")).toBe(false);
    // But hypothetically moved onto the wall's position — overlap.
    expect(place_meeting(player, ctx, 100, 0, "obj_wall")).toBe(true);
    // The real Transform was never touched.
    expect(defined(player.get(Transform)).x).toBe(0);
    expect(defined(player.get(Transform)).y).toBe(0);
  });

  it("place_meeting never matches the calling instance against itself", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0, "obj_player");
    expect(place_meeting(player, ctx, 0, 0, "obj_player")).toBe(false);
  });

  it("place_meeting 'all' matches any object type, 'noone' matches nothing", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0);
    spawnAt(scene, 0, 0, "obj_anything");
    expect(place_meeting(player, ctx, 0, 0, "all")).toBe(true);
    expect(place_meeting(player, ctx, 0, 0, "noone")).toBe(false);
  });

  it("instance_place returns the actual colliding entity, or undefined for no match", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0);
    const wall = spawnAt(scene, 50, 0, "obj_wall");
    expect(instance_place(player, ctx, 50, 0, "obj_wall")?.eid).toBe(wall.eid);
    expect(instance_place(player, ctx, 500, 500, "obj_wall")).toBeUndefined();
  });

  it("position_meeting checks a single point, distinct from place_meeting's whole-mask check", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0);
    // A wall with a 16px default half-extent, centred at (100, 0).
    spawnAt(scene, 100, 0, "obj_wall");

    // A point just outside the wall's mask (17px away) is not "meeting".
    expect(position_meeting(player, ctx, 117, 0, "obj_wall")).toBe(false);
    // A point inside the wall's mask is.
    expect(position_meeting(player, ctx, 100, 0, "obj_wall")).toBe(true);

    // place_meeting's whole-mask check would report an overlap much
    // further out than position_meeting's single-point check does, because
    // it also inflates by the *caller's* half-extent (16px too).
    expect(place_meeting(player, ctx, 130, 0, "obj_wall")).toBe(true);
    expect(position_meeting(player, ctx, 130, 0, "obj_wall")).toBe(false);
  });

  it("instance_position returns the entity at a point, or undefined", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0);
    const coin = spawnAt(scene, 40, 40, "obj_coin");
    expect(instance_position(player, ctx, 40, 40, "obj_coin")?.eid).toBe(
      coin.eid,
    );
    expect(
      instance_position(player, ctx, 400, 400, "obj_coin"),
    ).toBeUndefined();
  });

  it("place_free/position_free are blocked only by solid-flagged instances", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0);
    const nonSolidWall = spawnAt(scene, 100, 0, "obj_deco");
    expect(place_free(player, ctx, 100, 0)).toBe(true);
    expect(position_free(player, ctx, 100, 0)).toBe(true);

    defined(nonSolidWall.get(Meta)).solid = true;
    expect(place_free(player, ctx, 100, 0)).toBe(false);
    expect(position_free(player, ctx, 100, 0)).toBe(false);
    // Somewhere far from the solid instance is still free.
    expect(place_free(player, ctx, 900, 900)).toBe(true);
  });

  it("place_snapped checks the entity's real current position, not a hypothetical one", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const entity = scene.spawn();
    entity.add(Transform, { x: 32, y: 64 });
    expect(place_snapped(entity, ctx, 16, 16)).toBe(true);
    expect(place_snapped(entity, ctx, 32, 16)).toBe(true);

    defined(entity.get(Transform)).x = 33;
    expect(place_snapped(entity, ctx, 16, 16)).toBe(false);
  });

  it("collision_rectangle/circle/point find the correct instance with a real geometric case", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0);
    const target = spawnAt(scene, 200, 200, "obj_target");

    expect(
      collision_rectangle(player, ctx, 190, 190, 210, 210, "obj_target")?.eid,
    ).toBe(target.eid);
    expect(
      collision_rectangle(player, ctx, 500, 500, 520, 520, "obj_target"),
    ).toBeUndefined();

    expect(collision_circle(player, ctx, 220, 200, 30, "obj_target")?.eid).toBe(
      target.eid,
    );
    expect(
      collision_circle(player, ctx, 600, 600, 5, "obj_target"),
    ).toBeUndefined();

    expect(collision_point(player, ctx, 205, 205, "obj_target")?.eid).toBe(
      target.eid,
    );
    expect(collision_point(player, ctx, 0, 0, "obj_target")).toBeUndefined();
  });

  it("collision_line finds an instance the segment crosses", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0);
    const target = spawnAt(scene, 100, 0, "obj_target");

    // A horizontal line straight through the target's position.
    expect(collision_line(player, ctx, -50, 0, 250, 0, "obj_target")?.eid).toBe(
      target.eid,
    );
    // A line well clear of it.
    expect(
      collision_line(player, ctx, -50, 500, 250, 500, "obj_target"),
    ).toBeUndefined();
  });

  it("notme excludes the caller when true (the default), includes it when false", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const player = spawnAt(scene, 0, 0, "obj_player");

    expect(
      collision_point(player, ctx, 0, 0, "obj_player", false, true),
    ).toBeUndefined();
    expect(
      collision_point(player, ctx, 0, 0, "obj_player", false, false)?.eid,
    ).toBe(player.eid);
  });

  describe("instance_exists / instance_number", () => {
    it("instance_exists finds another instance of the given type, and includes the caller itself when it matches", () => {
      const scene = new Scene();
      const ctx = makeCtx(scene);
      const player = spawnAt(scene, 0, 0, "obj_player");
      spawnAt(scene, 500, 500, "obj_guardboss");

      expect(instance_exists(player, ctx, "obj_guardboss")).toBe(true);
      expect(instance_exists(player, ctx, "obj_missing")).toBe(false);
      expect(instance_exists(player, ctx, "obj_player")).toBe(true);
    });

    it("instance_exists 'noone' always returns false", () => {
      const scene = new Scene();
      const ctx = makeCtx(scene);
      const player = spawnAt(scene, 0, 0, "obj_player");
      expect(instance_exists(player, ctx, "noone")).toBe(false);
    });

    it("instance_number counts every matching instance, including the caller itself", () => {
      const scene = new Scene();
      const ctx = makeCtx(scene);
      const enemy1 = spawnAt(scene, 0, 0, "obj_enemy");
      spawnAt(scene, 10, 10, "obj_enemy");
      spawnAt(scene, 20, 20, "obj_enemy");
      spawnAt(scene, 30, 30, "obj_player");

      expect(instance_number(enemy1, ctx, "obj_enemy")).toBe(3);
      expect(instance_number(enemy1, ctx, "obj_missing")).toBe(0);
    });
  });
});

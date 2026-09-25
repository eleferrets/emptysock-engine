import { describe, expect, it } from "vitest";
import { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { Meta } from "../components/Meta.js";
import { with_each, type GmlActionContext } from "../compat/gmlActions.js";

function makeCtx(scene: Scene): GmlActionContext {
  return { scene };
}

function spawnAt(scene: Scene, x: number, y: number, objectName?: string) {
  const entity = scene.spawn();
  entity.add(Transform, { x, y });
  if (objectName !== undefined) {
    entity.add(Meta, { name: objectName });
  }
  return entity;
}

// ---------------------------------------------------------------------------
// GML's `with (target) { ... }` — genuinely common real GameMaker source
// (Freedom Backup: `with (mywall) instance_destroy();`, `with (obj_player)
// { ... }`, `with (other) instance_destroy();`, `with
// (instance_create_layer(...)) { ... }`) — previously always dead code.
// ---------------------------------------------------------------------------

describe("with_each — GameMaker's with(target) { ... } iteration", () => {
  it("iterates every instance of a named object type (with (obj_wall) { ... })", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    spawnAt(scene, 0, 0, "obj_wall");
    spawnAt(scene, 10, 10, "obj_wall");
    spawnAt(scene, 20, 20, "obj_player");

    const visited: number[] = [];
    with_each(ctx, "obj_wall", (e) => visited.push(e.eid));
    expect(visited.length).toBe(2);
  });

  it("iterates every instance in the scene for the 'all' target", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    spawnAt(scene, 0, 0, "obj_a");
    spawnAt(scene, 10, 10, "obj_b");

    const visited: number[] = [];
    with_each(ctx, "all", (e) => visited.push(e.eid));
    expect(visited.length).toBe(2);
  });

  it("never calls the callback for the 'noone' target", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    spawnAt(scene, 0, 0, "obj_a");

    let called = false;
    with_each(ctx, "noone", () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it("iterates exactly the one entity when target is a real Entity (a variable holding an instance reference)", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const mywall = spawnAt(scene, 0, 0, "obj_wall");
    spawnAt(scene, 10, 10, "obj_wall");

    const visited: number[] = [];
    with_each(ctx, mywall, (e) => visited.push(e.eid));
    expect(visited).toEqual([mywall.eid]);
  });

  it("is a safe no-op for undefined (a spawn that failed) or a destroyed entity", () => {
    const scene = new Scene();
    const ctx = makeCtx(scene);
    const dead = spawnAt(scene, 0, 0, "obj_wall");
    scene.destroy(dead);

    let called = false;
    with_each(ctx, undefined, () => {
      called = true;
    });
    with_each(ctx, dead, () => {
      called = true;
    });
    expect(called).toBe(false);
  });
});

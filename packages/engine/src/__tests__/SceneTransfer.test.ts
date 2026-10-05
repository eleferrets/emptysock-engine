import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../Entity.js";
import { Scene } from "../Scene.js";
import { defineComponent } from "../Component.js";
import { Meta } from "../components/Meta.js";
import { PhysicsBody } from "../components/PhysicsBody.js";
import {
  captureEntities,
  restoreEntities,
  type EntityExtra,
  type TransferPolicy,
} from "../SceneTransfer.js";
import { NO_REF, type EntityRef } from "../EntityRef.js";

const Pos = defineComponent("XferPos", () => ({
  x: 0,
  y: 0,
  tags: [] as string[],
}));
const Link = defineComponent("XferLink", () => ({ to: NO_REF as EntityRef }), {
  schema: { to: { kind: "entityRef" } },
});

// A stand-in side table keyed by (world, eid), like the compat ones.
const table = new Map<string, unknown>();
const worldIds = new WeakMap<object, number>();
let nextWorldId = 1;
const key = (w: object, eid: number): string => {
  let id = worldIds.get(w);
  if (id === undefined) worldIds.set(w, (id = nextWorldId++));
  return `${id}:${eid}`;
};
const noteExtra: EntityExtra<{ target?: unknown; n: number }> = {
  name: "note",
  export: (e) => table.get(key(e.world, e.eid)) as never,
  import: (e, data, ctx) => {
    table.set(key(e.world, e.eid), { ...data, target: ctx.remap(data.target) });
  },
  clear: (w, eid) => void table.delete(key(w, eid)),
};

const policy: TransferPolicy = {
  select: (e) => e.get(Meta)?.persistent === true,
  extras: [noteExtra],
};

/** Spawn with `Meta` (persistent flag) and return the entity, not the component. */
function mk(scene: Scene, persistent: boolean): Entity {
  const e = scene.spawn();
  e.add(Meta, { persistent });
  return e;
}

/** Unwrap a value the test knows exists. */
function need<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("expected a value");
  return v;
}

describe("SceneTransfer", () => {
  it("default selection carries only Meta.persistent entities", () => {
    const a = new Scene();
    mk(a, true).add(Pos, { x: 1 });
    mk(a, false).add(Pos, { x: 2 });
    const snap = captureEntities(a);
    expect(snap.entities).toHaveLength(1);
    const b = new Scene();
    const map = restoreEntities(b, snap);
    expect(b.entityCount).toBe(1);
    const e = need(map.get(need(snap.entities[0]).oldId));
    expect(need(e.get(Pos)).x).toBe(1);
    expect(need(e.get(Meta)).persistent).toBe(true);
  });

  it("copies component fields (arrays too) so the source is not aliased", () => {
    const a = new Scene();
    const src = mk(a, true);
    src.add(Pos, { tags: ["t"] });
    const snap = captureEntities(a);
    need(src.get(Pos)).tags.push("later");
    const b = new Scene();
    const e = need(restoreEntities(b, snap).get(need(snap.entities[0]).oldId));
    expect(need(e.get(Pos)).tags).toEqual(["t"]);
  });

  it("resets PhysicsBody handles through ComponentDef.transfer", () => {
    const a = new Scene();
    mk(a, true).add(PhysicsBody, { bodyHandle: 7, colliderHandle: 9 });
    const snap = captureEntities(a);
    const b = new Scene();
    const e = need(restoreEntities(b, snap).get(need(snap.entities[0]).oldId));
    expect(need(e.get(PhysicsBody)).bodyHandle).toBeNull();
    expect(need(e.get(PhysicsBody)).colliderHandle).toBeNull();
  });

  it("exports extras, clears the old side table, and remaps Entity handles in them", () => {
    const a = new Scene();
    const p1 = mk(a, true);
    const p2 = mk(a, true);
    const gone = mk(a, false);
    table.set(key(a.world, p1.eid), { n: 1, target: p2 });
    table.set(key(a.world, p2.eid), { n: 2, target: [gone] });
    const snap = captureEntities(a, policy);
    expect(table.has(key(a.world, p1.eid))).toBe(false);
    const b = new Scene();
    b.spawn(); // shift eids so a stale handle cannot pass by accident
    const map = restoreEntities(b, snap, policy);
    const n1 = need(map.get(need(snap.entities[0]).oldId));
    const n2 = need(map.get(need(snap.entities[1]).oldId));
    const d1 = table.get(key(b.world, n1.eid)) as { target: { eid: number } };
    const d2 = table.get(key(b.world, n2.eid)) as { target: unknown[] };
    expect(d1.target.eid).toBe(n2.eid);
    expect(d2.target).toEqual([undefined]);
  });

  it("remaps declared entityRef fields between carried entities", () => {
    const a = new Scene();
    const target = mk(a, true);
    const other = mk(a, false);
    mk(a, true).add(Link, { to: a.refTo(target) });
    mk(a, true).add(Link, { to: a.refTo(other) });
    const snap = captureEntities(a);
    const b = new Scene();
    b.spawn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const map = restoreEntities(b, snap);
    const linked = snap.entities.filter((s) =>
      s.components.some((c) => c.def === Link),
    );
    const ok = need(map.get(need(linked[0]).oldId));
    const dangling = need(map.get(need(linked[1]).oldId));
    expect(b.resolve(need(ok.get(Link)).to)?.eid).toBe(
      need(map.get(need(snap.entities[0]).oldId)).eid,
    );
    expect(need(dangling.get(Link)).to).toEqual(NO_REF);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

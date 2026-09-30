import { describe, it, expect } from "vitest";
import {
  Scene,
  defineRelation,
  ChildOf,
  defineComponent,
  type Entity,
} from "../index.js";

const Tag = defineComponent("RelTestTag", () => ({ n: 0 }));

describe("Relations", () => {
  it("setParent is exclusive and childrenOf keeps order", () => {
    const s = new Scene();
    const p1 = s.spawn();
    const p2 = s.spawn();
    const a = s.spawn();
    const b = s.spawn();
    s.setParent(a, p1);
    s.setParent(b, p1);
    expect(s.childrenOf(p1).map((e) => e.eid)).toEqual([a.eid, b.eid]);
    s.setParent(a, p2);
    expect(s.parentOf(a)?.eid).toBe(p2.eid);
    expect(s.childrenOf(p1).map((e) => e.eid)).toEqual([b.eid]);
    s.setParent(a, undefined);
    expect(s.parentOf(a)).toBeUndefined();
  });

  it("rejects cycles and self edges", () => {
    const s = new Scene();
    const a = s.spawn();
    const b = s.spawn();
    s.setParent(b, a);
    expect(() => s.setParent(a, b)).toThrow(/cycle/);
    expect(() => s.setParent(a, a)).toThrow();
  });

  it("destroying a parent cascades to descendants", () => {
    const s = new Scene();
    const p = s.spawn();
    const c = s.spawn();
    const g = s.spawn();
    s.setParent(c, p);
    s.setParent(g, c);
    s.destroy(p);
    expect(c.isAlive).toBe(false);
    expect(g.isAlive).toBe(false);
    expect(s.entityCount).toBe(0);
  });

  it("remove policy drops the edge only; destroying a child unlinks it", () => {
    const Follows = defineRelation("Follows");
    const s = new Scene();
    const leader = s.spawn();
    const f1 = s.spawn();
    const f2 = s.spawn();
    s.relate(f1, Follows, leader);
    s.relate(f2, Follows, leader);
    expect(s.subjectsOf(leader, Follows)).toHaveLength(2);
    s.destroy(f1);
    expect(s.subjectsOf(leader, Follows).map((e) => e.eid)).toEqual([f2.eid]);
    s.destroy(leader);
    expect(f2.isAlive).toBe(true);
    expect(s.targetsOf(f2, Follows)).toEqual([]);
  });

  it("non-exclusive relations hold many targets", () => {
    const Likes = defineRelation("Likes");
    const s = new Scene();
    const a = s.spawn();
    const b = s.spawn();
    const c = s.spawn();
    s.relate(a, Likes, b);
    s.relate(a, Likes, c);
    expect(s.targetsOf(a, Likes)).toHaveLength(2);
    s.unrelate(a, Likes, b);
    expect(s.targetsOf(a, Likes).map((e) => e.eid)).toEqual([c.eid]);
  });

  it("pooled parent destroy still cascades and clears edges", () => {
    const s = new Scene();
    const p = s.spawn();
    const c = s.spawn();
    s.setParent(c, p);
    s.destroy(c);
    expect(s.childrenOf(p)).toEqual([]);
  });

  it("destroy during each is safe when collected first", () => {
    const s = new Scene();
    const p = s.spawn();
    p.add(Tag);
    for (let i = 0; i < 3; i++) {
      const c = s.spawn();
      c.add(Tag);
      s.setParent(c, p);
    }
    const doomed: Entity[] = [];
    s.each(Tag, (_t, e) => {
      if (s.parentOf(e) === undefined) doomed.push(e);
    });
    for (const e of doomed) s.destroy(e);
    expect(s.entityCount).toBe(0);
  });

  it("ChildOf is exported with destroy policy", () => {
    expect(ChildOf.onTargetDestroyed).toBe("destroy");
    expect(ChildOf.exclusive).toBe(true);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  Scene,
  SaveSystem,
  MemoryStorageAdapter,
  defineComponent,
  entityRefLeaf,
  remapValue,
  NO_REF,
  ChildOf,
  type EntityRef,
  type Entity,
} from "../index.js";

const Link = defineComponent(
  "RemapLink",
  () => ({ to: { $ref: 0 } as EntityRef, label: "" }),
  { schema: { to: { kind: "entityRef" } } },
);

afterEach(() => vi.restoreAllMocks());

async function roundTrip(
  build: (s: Scene) => void,
): Promise<{ scene: Scene; ok: boolean }> {
  const adapter = new MemoryStorageAdapter();
  const src = new Scene();
  build(src);
  await new SaveSystem(src, [Link], { adapter }).save("a");
  const dst = new Scene();
  // Burn some ids so old and new ids differ.
  dst.idOf(dst.spawn());
  dst.idOf(dst.spawn());
  const ok = await new SaveSystem(dst, [Link], { adapter }).load("a");
  return { scene: dst, ok };
}

function linked(scene: Scene): Map<string, Entity> {
  const out = new Map<string, Entity>();
  scene.each(Link, (l, e) => {
    out.set(l.label, e);
  });
  return out;
}

describe("SaveSystem v2 remap", () => {
  it("round-trips ref A->B and a parent edge onto fresh entities", async () => {
    const { scene, ok } = await roundTrip((s) => {
      const a = s.spawn();
      const b = s.spawn();
      a.add(Link, { to: b.ref(), label: "a" });
      b.add(Link, { label: "b" });
      s.setParent(a, b);
    });
    expect(ok).toBe(true);
    const m = linked(scene);
    const a = m.get("a") as Entity;
    const b = m.get("b") as Entity;
    expect(scene.resolve(a.get(Link)?.to)?.eid).toBe(b.eid);
    expect(scene.parentOf(a)?.eid).toBe(b.eid);
  });

  it("a ref to an unsaved entity becomes NO_REF and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { scene } = await roundTrip((s) => {
      const outsider = s.spawn(); // has no saved component
      s.spawn().add(Link, { to: outsider.ref(), label: "a" });
    });
    const a = linked(scene).get("a") as Entity;
    expect(a.get(Link)?.to).toEqual(NO_REF);
    expect(warn).toHaveBeenCalled();
  });

  it("still reads a v1 blob (no ids)", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(
      "emptysock_save_v1",
      JSON.stringify({
        formatVersion: 1,
        entities: [
          { components: { RemapLink: { version: 1, data: { label: "old" } } } },
        ],
      }),
    );
    const s = new Scene();
    expect(await new SaveSystem(s, [Link], { adapter }).load("v1")).toBe(true);
    expect(linked(s).has("old")).toBe(true);
  });
});

describe("remapValue", () => {
  it("remaps refs nested in arrays and plain objects, bounded and cycle safe", () => {
    const scene = new Scene();
    const b = scene.spawn();
    const map = { get: (id: number | string) => (id === 42 ? b : undefined) };
    const leaf = entityRefLeaf(scene, map, { onMissing: () => {} });
    const cyc: Record<string, unknown> = { r: { $ref: 42 } };
    cyc["self"] = cyc;
    const v = remapValue(
      { list: [{ $ref: 42 }, [{ $ref: 7 }]], cyc, keep: 3 },
      leaf,
    ) as {
      list: [EntityRef, EntityRef[]];
      cyc: { r: EntityRef };
      keep: number;
    };
    expect(v.list[0]).toEqual(b.ref());
    expect(v.list[1][0]).toEqual(NO_REF);
    expect(v.cyc.r).toEqual(b.ref());
    expect(v.keep).toBe(3);
  });

  it("stops at the depth cap", () => {
    const scene = new Scene();
    const b = scene.spawn();
    const map = { get: () => b };
    let deep: unknown = { $ref: 1 };
    for (let i = 0; i < 12; i++) deep = [deep];
    const out = remapValue(deep, entityRefLeaf(scene, map));
    let cur = out as unknown;
    for (let i = 0; i < 12; i++) cur = (cur as unknown[])[0];
    expect(cur).toEqual({ $ref: 1 });
  });
});

it("ChildOf is saved by default", () => {
  expect(ChildOf.name).toBe("ChildOf");
});

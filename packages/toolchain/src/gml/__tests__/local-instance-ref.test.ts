import { beforeAll, describe, expect, it } from "vitest";
import { setGmlObjectNames, transpileGML } from "./emit-shim.js";

describe("F1: variables holding an instance", () => {
  beforeAll(() => setGmlObjectNames(new Set(["obj_a", "obj_b"])));

  it("a local assigned from an instance query reads and writes through the entity field API", () => {
    const out = transpileGML(
      "var owner = instance_find(obj_b, 0);\nowner.y = 5;\nowner.image_alpha = 0.5;\nx = owner.hp;",
    );
    expect(out).toContain('GmlActions.setGmlEntityField(_ctx, owner, "y", 5)');
    expect(out).toContain(
      'GmlActions.setGmlEntityField(_ctx, owner, "image_alpha", 0.5)',
    );
    expect(out).toContain('GmlActions.getGmlEntityField(_ctx, owner, "hp")');
  });

  it("compound assignment on a component-backed and a custom field of a local instance", () => {
    const out = transpileGML(
      "var o = instance_nearest(x, y, obj_b);\nif (o != noone) { o.image_angle = 10; o.hp -= 1; }",
    );
    expect(out).toContain('setGmlEntityField(_ctx, o, "image_angle", 10)');
    expect(out).toContain('setGmlEntityField(_ctx, o, "hp",');
    expect(out).toContain('getGmlEntityField(_ctx, o, "hp")');
  });

  it("an instance variable holding an instance uses the reference accessors", () => {
    const out = transpileGML(
      "target = instance_find(obj_b, 0);\ntarget.image_xscale = 2;",
    );
    expect(out).toContain(
      'GmlActions.setGmlRefVar(_entity, _ctx, "target", "image_xscale", 2)',
    );
  });

  it("a local that shadows an object name is not treated as that object", () => {
    const out = transpileGML("var obj_b = 3;\nobj_b.x = 2;");
    expect(out).not.toContain("setGmlObjectVar");
  });

  it("a named object's field write goes through setGmlObjectVar", () => {
    const out = transpileGML("obj_b.image_alpha = 0.3;");
    expect(out).toContain(
      'GmlActions.setGmlObjectVar(_entity, _ctx, "obj_b", "image_alpha", 0.3)',
    );
  });
});

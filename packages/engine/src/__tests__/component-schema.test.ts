import { describe, expect, it } from "vitest";
import { defineComponent } from "../Component.js";
import { Transform } from "../components/Transform.js";
import { Sprite } from "../components/Sprite.js";
import { PhysicsBody } from "../components/PhysicsBody.js";

describe("defineComponent schema (ENGINE_DESIGN.md §10.1)", () => {
  it("is undefined when no schema option is passed — not an error", () => {
    const NoSchema = defineComponent("NoSchemaThing", () => ({ hp: 10 }));
    expect(NoSchema.schema).toBeUndefined();
    // Still works everywhere a normal component works.
    expect(NoSchema.createDefaults()).toEqual({ hp: 10 });
    expect(NoSchema.version).toBe(1);
  });

  it("attaches a co-located schema when given, without touching version default", () => {
    const Health = defineComponent(
      "HealthForSchemaTest",
      () => ({ hp: 100, isDead: false }),
      { schema: { hp: { kind: "number" }, isDead: { kind: "boolean" } } },
    );
    expect(Health.schema).toEqual({
      hp: { kind: "number" },
      isDead: { kind: "boolean" },
    });
    expect(Health.version).toBe(1);
  });

  it("composes with an explicit version option", () => {
    const Versioned = defineComponent(
      "VersionedSchemaThing",
      () => ({ x: 0 }),
      { version: 3, schema: { x: { kind: "number" } } },
    );
    expect(Versioned.version).toBe(3);
    expect(Versioned.schema).toEqual({ x: { kind: "number" } });
  });

  it("Transform, Sprite and PhysicsBody carry a real dogfood schema", () => {
    expect(Transform.schema).toEqual({
      x: { kind: "number" },
      y: { kind: "number" },
      rotation: { kind: "number" },
      scaleX: { kind: "number" },
      scaleY: { kind: "number" },
    });

    expect(Sprite.schema?.texturePath).toEqual({ kind: "string" });
    expect(Sprite.schema?.visible).toEqual({ kind: "boolean" });
    expect(Sprite.schema?.tint).toEqual({ kind: "number" });

    expect(PhysicsBody.schema?.type).toEqual({
      kind: "enum",
      options: ["dynamic", "static", "kinematic"],
    });
    expect(PhysicsBody.schema?.shape).toEqual({
      kind: "enum",
      options: ["box", "circle", "capsule"],
    });
    // Engine-managed / nested fields are deliberately left unscheduled.
    expect(PhysicsBody.schema?.bodyHandle).toBeUndefined();
    expect(PhysicsBody.schema?.position).toBeUndefined();
  });
});

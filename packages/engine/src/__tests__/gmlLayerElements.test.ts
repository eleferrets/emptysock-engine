import { describe, it, expect } from "vitest";
import { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { LayerElement } from "../components/LayerElement.js";
import {
  layer_sprite_get_id,
  layer_sprite_destroy,
  layer_sprite_get_x,
  layer_sprite_x,
  layer_sequence_get_instance,
  layer_sequence_destroy,
} from "../compat/gmlLayer.js";
import { loadSceneFile } from "../SceneFile.js";
import { Sprite } from "../components/Sprite.js";
import { GmlSequenceState } from "../components/GmlSequence.js";
import type { GmlActionContext } from "../compat/gmlActions.js";

function setup(): { ctx: GmlActionContext; scene: Scene } {
  const scene = new Scene();
  const add = (
    name: string,
    layer: string,
    kind: "sprite" | "sequence",
    x: number,
  ): void => {
    const e = scene.spawn();
    e.add(Transform, { x, y: 5 });
    e.add(LayerElement, { name, layer, kind });
  };
  add("gGun", "TitleAssets", "sprite", 10);
  add("gGun", "Other", "sprite", 99);
  add("seq1", "Fx", "sequence", 1);
  return { ctx: { scene } as GmlActionContext, scene };
}

describe("room-layer elements (layer_sprite_* / layer_sequence_*)", () => {
  it("finds a sprite element by name, preferring the named layer", () => {
    const { ctx } = setup();
    const onOther = layer_sprite_get_id(ctx, "Other", "gGun");
    expect(layer_sprite_get_x(ctx, onOther)).toBe(99);
    const onTitle = layer_sprite_get_id(ctx, "TitleAssets", "gGun");
    expect(layer_sprite_get_x(ctx, onTitle)).toBe(10);
  });

  it("matches by name alone when layer is not a string (layer_get_id's -1)", () => {
    const { ctx } = setup();
    expect(layer_sprite_get_id(ctx, -1, "gGun")).toBeDefined();
  });

  it("returns undefined for unknown names and for the wrong kind", () => {
    const { ctx } = setup();
    expect(layer_sprite_get_id(ctx, "TitleAssets", "nope")).toBeUndefined();
    expect(layer_sprite_get_id(ctx, "Fx", "seq1")).toBeUndefined();
    expect(layer_sequence_get_instance(ctx, "Fx", "seq1")).toBeDefined();
  });

  it("moves and destroys elements, and ignores non-entities", () => {
    const { ctx, scene } = setup();
    const el = layer_sprite_get_id(ctx, "TitleAssets", "gGun");
    layer_sprite_x(ctx, el, 42);
    expect(layer_sprite_get_x(ctx, el)).toBe(42);
    const before = scene.entityCount;
    layer_sprite_destroy(ctx, el);
    expect(scene.entityCount).toBe(before - 1);
    expect(() => layer_sprite_destroy(ctx, undefined)).not.toThrow();
    expect(() => layer_sprite_destroy(ctx, -1)).not.toThrow();
    const seq = layer_sequence_get_instance(ctx, "Fx", "seq1");
    layer_sequence_destroy(ctx, seq);
    expect(layer_sequence_get_instance(ctx, "Fx", "seq1")).toBeUndefined();
  });
});

describe("room-layer elements loaded from an imported .scene.json", () => {
  it("spawns element entities that layer_sprite_get_id then finds", () => {
    const scene = new Scene();
    const defs = [Transform, Sprite, LayerElement, GmlSequenceState];
    loadSceneFile(
      scene,
      {
        sceneName: "rm",
        entities: [
          {
            components: [
              { component: "Transform", overrides: { x: 7, y: 8 } },
              { component: "Sprite", overrides: { texturePath: "a.png" } },
              {
                component: "LayerElement",
                overrides: {
                  name: "gGun",
                  layer: "TitleAssets",
                  kind: "sprite",
                },
              },
            ],
          },
        ],
      } as never,
      (n) => defs.find((d) => d.componentName === n),
      new Map(),
    );
    const ctx = { scene } as GmlActionContext;
    const el = layer_sprite_get_id(ctx, "TitleAssets", "gGun");
    expect(layer_sprite_get_x(ctx, el)).toBe(7);
    layer_sprite_destroy(ctx, el);
    expect(layer_sprite_get_id(ctx, -1, "gGun")).toBeUndefined();
  });
});

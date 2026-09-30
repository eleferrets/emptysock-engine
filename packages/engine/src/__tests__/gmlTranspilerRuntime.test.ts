import { describe, it, expect, vi } from "vitest";
import { Scene } from "../Scene.js";
import { Meta } from "../components/Meta.js";
import { Sprite } from "../components/Sprite.js";
import { Transform } from "../components/Transform.js";
import { AssetRegistry } from "../systems/AssetRegistry.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import { setGmlVar } from "../compat/gmlInstanceVars.js";
import {
  getGmlEntityField,
  setGmlEntityField,
  getGmlRefVar,
  setGmlRefVar,
  get_gml_instance_alarm,
  set_gml_instance_alarm,
} from "../compat/gmlCrossInstance.js";
import {
  gml_animation_ended,
  set_gml_sprite_index,
  sprite_get_number,
} from "../compat/gmlSprites.js";
import {
  gmlUnknown,
  registerGmlScript,
  script_execute,
} from "../compat/gmlDynamic.js";
import {
  audio_emitter_create,
  audio_emitter_exists,
  audio_emitter_free,
  audio_emitter_gain,
  audio_emitter_get_gain,
} from "../compat/gmlAudioEmitters.js";
import { window_center } from "../compat/gmlInput.js";

/** Runtime helpers the GML emitter targets (toolchain `gml/emit`). */

function sceneCtx(): { scene: Scene; ctx: GmlActionContext } {
  const scene = new Scene();
  return { scene, ctx: { scene } };
}

describe("dynamic field access (getGmlEntityField / setGmlEntityField)", () => {
  it("reads and writes a struct's own field", () => {
    const { ctx } = sceneCtx();
    const s: Record<string, unknown> = { hp: 3 };
    expect(getGmlEntityField(ctx, s, "hp")).toBe(3);
    setGmlEntityField(ctx, s, "hp", 7);
    expect(s["hp"]).toBe(7);
  });

  it("resolves an object name to that object's first live instance", () => {
    const { scene, ctx } = sceneCtx();
    const p = scene.spawn();
    p.add(Meta, { name: "obj_player" });
    p.add(Transform, { x: 12, y: 0 });
    expect(getGmlEntityField(ctx, "obj_player", "x")).toBe(12);
    setGmlEntityField(ctx, "obj_player", "x", 20);
    expect(p.get(Transform)?.x).toBe(20);
  });

  it("returns undefined for noone/numbers/unknown names and ignores writes to them", () => {
    const { ctx } = sceneCtx();
    expect(getGmlEntityField(ctx, undefined, "x")).toBeUndefined();
    expect(getGmlEntityField(ctx, 5, "x")).toBeUndefined();
    expect(getGmlEntityField(ctx, "obj_none", "x")).toBeUndefined();
    expect(setGmlEntityField(ctx, undefined, "x", 1)).toBe(1);
  });

  it("getGmlRefVar/setGmlRefVar reach a struct held by an instance variable", () => {
    const { scene, ctx } = sceneCtx();
    const e = scene.spawn();
    setGmlVar(e, ctx, "menu", { index: 1 });
    expect(getGmlRefVar(e, ctx, "menu", "index")).toBe(1);
    setGmlRefVar(e, ctx, "menu", "index", 2);
    expect(getGmlRefVar(e, ctx, "menu", "index")).toBe(2);
  });
});

describe("alarms of other instances", () => {
  it("sets and reads the alarm of a named object's instance and of an entity", () => {
    const { scene, ctx } = sceneCtx();
    const t = scene.spawn();
    t.add(Meta, { name: "obj_trans" });
    set_gml_instance_alarm(ctx, "obj_trans", 0, 30);
    expect(get_gml_instance_alarm(ctx, "obj_trans", 0)).toBe(30);
    expect(get_gml_instance_alarm(ctx, t, 0)).toBe(30);
    expect(get_gml_instance_alarm(ctx, "obj_none", 0)).toBe(-1);
    expect(() => set_gml_instance_alarm(ctx, undefined, 0, 1)).not.toThrow();
  });
});

describe("sprite assets", () => {
  function registry(): AssetRegistry {
    const r = new AssetRegistry();
    r.load({
      version: 1,
      entries: [
        {
          kind: "sprite",
          name: "spr_walk",
          id: "spr_walk",
          width: 16,
          height: 24,
          frameCount: 4,
        },
        {
          kind: "sprite",
          name: "spr_idle",
          id: "spr_idle",
          width: 8,
          height: 8,
          frameCount: 1,
        },
      ],
    });
    return r;
  }

  it("sprite_index = a multi-frame sprite sets its template path, frame count and size", () => {
    const { scene } = sceneCtx();
    const ctx = { scene, assets: registry() } as unknown as GmlActionContext;
    const e = scene.spawn();
    e.add(Sprite, { texturePath: "./assets/sprites/spr_idle/frame_0.png" });
    set_gml_sprite_index(e, ctx, "./assets/sprites/spr_walk/frame_{n}.png");
    const sp = e.get(Sprite);
    expect(sp?.texturePath).toBe("./assets/sprites/spr_walk/frame_{n}.png");
    expect(sp?.frameCount).toBe(4);
    expect(sp?.width).toBe(16);
    // A frame_0 reference to the same multi-frame sprite normalises to the template.
    set_gml_sprite_index(e, ctx, "./assets/sprites/spr_walk/frame_0.png");
    expect(sp?.texturePath).toBe("./assets/sprites/spr_walk/frame_{n}.png");
    set_gml_sprite_index(e, ctx, "./assets/sprites/spr_idle/frame_0.png");
    expect(sp?.frameCount).toBe(1);
    set_gml_sprite_index(e, ctx, -1);
    expect(sp?.texturePath).toBe("");
  });

  it("sprite_get_number reads the registry's frame count", () => {
    const { scene } = sceneCtx();
    const ctx = { scene, assets: registry() } as unknown as GmlActionContext;
    expect(
      sprite_get_number(ctx, "./assets/sprites/spr_walk/frame_{n}.png"),
    ).toBe(4);
    expect(sprite_get_number(ctx, "spr_idle")).toBe(1);
    expect(sprite_get_number({ scene } as GmlActionContext, "spr_walk")).toBe(
      0,
    );
  });

  it("gml_animation_ended fires once when a looping animation wraps", () => {
    const { scene } = sceneCtx();
    const e = scene.spawn();
    e.add(Sprite, {
      frameCount: 3,
      frameSpeed: 1,
      loop: true,
      currentFrame: 0,
    });
    const sp = e.get(Sprite);
    if (!sp) throw new Error("no sprite");
    const seen: boolean[] = [];
    for (const f of [0, 1, 2, 0, 1]) {
      sp.currentFrame = f;
      seen.push(gml_animation_ended(e));
    }
    expect(seen).toEqual([false, false, false, true, false]);
  });
});

describe("dynamic calls", () => {
  it("script_execute passes the caller's context to a registered script and only the arguments to a method", () => {
    const { scene, ctx } = sceneCtx();
    const e = scene.spawn();
    function scr_add(
      _entity: unknown,
      _ctx: unknown,
      a: unknown,
      b: unknown,
    ): unknown {
      return (a as number) + (b as number) + (_entity === e ? 100 : 0);
    }
    registerGmlScript(scr_add);
    expect(script_execute(e, ctx, scr_add, 1, 2)).toBe(103);
    expect(script_execute(e, ctx, "scr_add", 1, 2)).toBe(103);
    expect(script_execute(e, ctx, (a: number) => a * 2, 4)).toBe(8);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(script_execute(e, ctx, 42)).toBeUndefined();
    warn.mockRestore();
  });

  it("gmlUnknown returns a no-op that warns once per name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(gmlUnknown("not_a_builtin_a")(1, 2)).toBeUndefined();
    gmlUnknown("not_a_builtin_a")();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("audio emitters and window_center", () => {
  it("emitters are handles that remember their gain", () => {
    const id = audio_emitter_create();
    expect(audio_emitter_exists(id)).toBe(true);
    audio_emitter_gain(id, 0.5);
    expect(audio_emitter_get_gain(id)).toBe(0.5);
    audio_emitter_free(id);
    expect(audio_emitter_exists(id)).toBe(false);
  });

  it("window_center without a game does nothing", () => {
    const { ctx } = sceneCtx();
    expect(() => window_center(ctx)).not.toThrow();
  });
});

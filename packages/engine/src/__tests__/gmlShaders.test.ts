import { describe, it, expect, beforeEach, vi } from "vitest";
import { Scene } from "../Scene.js";
import { Sprite } from "../components/Sprite.js";
import {
  shader_set,
  shader_reset,
  shader_get_uniform,
  shader_is_compiled,
  shader_set_uniform_f,
  shader_set_uniform_i,
  shader_set_uniform_f_array,
  getGmlActiveShader,
} from "../compat/gmlShaders.js";
import {
  registerGmlShader,
  clearGmlShaders,
  getGmlShaderUniforms,
} from "../systems/ShaderRegistry.js";
import type { GmlActionContext } from "../compat/gmlActions.js";

describe("gml shader_set / shader_reset / uniforms", () => {
  let scene: Scene;
  const ctxFor = (extra: object = {}): GmlActionContext =>
    ({ scene, ...extra }) as GmlActionContext;

  beforeEach(() => {
    clearGmlShaders();
    registerGmlShader("sh_white", { vertexSrc: "", fragmentSrc: "" });
    scene = new Scene();
  });

  it("outside a Draw event writes Sprite.shader (plain data) and shader_reset clears it", () => {
    const e = scene.spawn();
    e.add(Sprite, { tint: 0x123456 });
    shader_set(e, ctxFor(), "sh_white");
    expect(e.get(Sprite)?.shader).toBe("sh_white");
    expect(e.get(Sprite)?.tint).toBe(0x123456); // no tint approximation any more
    expect(getGmlActiveShader(e)).toBe("sh_white");
    shader_reset(e, ctxFor());
    expect(e.get(Sprite)?.shader).toBe("");
    expect(getGmlActiveShader(e)).toBeUndefined();
  });

  it("inside a Draw event routes to the draw target and leaves Sprite.shader alone", () => {
    const e = scene.spawn();
    e.add(Sprite);
    const setShader = vi.fn();
    const ctx = ctxFor({ drawTarget: { setShader } });
    shader_set(e, ctx, "sh_white");
    shader_reset(e, ctx);
    expect(setShader.mock.calls).toEqual([["sh_white"], [null]]);
    expect(e.get(Sprite)?.shader).toBe("");
  });

  it("warns and no-ops (never throws) for an unregistered shader or an entity with no Sprite", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const e = scene.spawn();
    expect(() => shader_set(e, ctxFor(), "sh_missing")).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("shader_set_uniform_* write into the entity's active shader, shared per shader id", () => {
    const e = scene.spawn();
    e.add(Sprite);
    const h = shader_get_uniform("sh_white", "u_amount");
    expect(h).toBe("u_amount");
    expect(shader_is_compiled("sh_white")).toBe(true);
    shader_set(e, ctxFor(), "sh_white");
    shader_set_uniform_f(e, ctxFor(), h, 0.5);
    shader_set_uniform_i(e, ctxFor(), "u_n", 3.7);
    shader_set_uniform_f_array(e, ctxFor(), "u_tint", [1, 0, 0.5]);
    const u = getGmlShaderUniforms("sh_white");
    expect(u?.get("u_amount")).toEqual({ kind: "f", values: [0.5] });
    expect(u?.get("u_n")).toEqual({ kind: "i", values: [3] });
    expect(u?.get("u_tint")?.values).toEqual([1, 0, 0.5]);
  });

  it("a uniform write with no shader set is a warned no-op", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const e = scene.spawn();
    shader_set_uniform_f(e, ctxFor(), "u_never_set_on_this_entity", 1);
    expect(getGmlShaderUniforms("sh_white")?.size).toBe(0);
    warn.mockRestore();
  });
});

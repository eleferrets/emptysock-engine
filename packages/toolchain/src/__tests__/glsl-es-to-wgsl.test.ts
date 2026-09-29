import { describe, it, expect } from "vitest";
import { WgslReflect } from "wgsl_reflect/wgsl_reflect.module.js";
import {
  convertFragmentToWgsl,
  WgslConversionError,
} from "../glsl-es-to-wgsl.js";

// Synthetic GameMaker-style sources (never real project content).
const VERTEX = `
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;
varying vec2 v_vTexcoord;
varying vec4 v_vColour;
void main() {
  vec4 object_space_pos = vec4( in_Position.x, in_Position.y, in_Position.z, 1.0);
  gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * object_space_pos;
  v_vColour = in_Colour;
  v_vTexcoord = in_TextureCoord;
}
`;

const TINT = `
varying vec2 v_vTexcoord;
varying vec4 v_vColour;
uniform vec3 u_tint;
void main() {
  vec4 base = v_vColour * texture2D( gm_BaseTexture, v_vTexcoord );
  gl_FragColor = vec4(base.rgb * u_tint, base.a);
}
`;

const INVERT_PRECISION = `\r
#ifdef GL_ES\r
precision mediump float;\r
#endif\r
// invert by amount\r
varying vec2 v_vTexcoord;\r
varying vec4 v_vColour;\r
uniform float u_amount;\r
uniform int u_mode;\r
vec3 flip(vec3 c) { return vec3(1.0) - c; }\r
void main() {\r
  vec4 c = v_vColour * texture2D(gm_BaseTexture, v_vTexcoord);\r
  vec3 outc = mix(c.rgb, flip(c.rgb), u_amount);\r
  if (u_mode == 1) { outc = c.rgb; }\r
  gl_FragColor = vec4(outc, c.a);\r
}\r
`;

const TIME_WAVE = `
varying vec2 v_vTexcoord;
uniform float uTime;
uniform vec2 u_offset;
void main() {
  vec2 uv = v_vTexcoord + vec2(sin(uTime + v_vTexcoord.y * 10.0) * 0.01, 0.0) + u_offset;
  gl_FragColor = texture2D(gm_BaseTexture, uv);
}
`;

describe("convertFragmentToWgsl", () => {
  it.each([
    ["tint", TINT],
    ["invert with precision boilerplate and a helper fn", INVERT_PRECISION],
    ["uTime wave, single varying", TIME_WAVE],
  ])("%s converts to WGSL that wgsl_reflect accepts", (_n, frag) => {
    const { wgslFragmentSrc } = convertFragmentToWgsl(frag, VERTEX);
    const reflect = new WgslReflect(wgslFragmentSrc);
    expect(reflect.entry.fragment.map((f) => f.name)).toEqual(["main"]);
    const groups = reflect.getBindGroups();
    // group 0: texture + sampler (pixi supplies gfu in the vertex source)
    expect(
      groups[0]?.filter(Boolean).map((b) => [b.binding, b.type.name]),
    ).toEqual([
      [1, "texture_2d"],
      [2, "sampler"],
    ]);
    // group 1 binding 0: the uniforms block named "uniforms"
    expect(groups[1]?.filter(Boolean)[0]?.name).toBe("uniforms");
    expect(wgslFragmentSrc).toMatch(
      /@group\(1\) @binding\(0\)\s+var<uniform> uniforms: Uniforms;/,
    );
  });

  it("puts uTime first, then user uniforms in declaration order", () => {
    const { wgslFragmentSrc } = convertFragmentToWgsl(INVERT_PRECISION, VERTEX);
    const r = new WgslReflect(wgslFragmentSrc);
    const members = r.structs
      .find((s) => s.name === "Uniforms")
      ?.members.map((m) => `${m.name}:${m.type.name}`);
    expect(members).toEqual(["uTime:f32", "u_amount:f32", "u_mode:i32"]);
  });

  it("uTime declared by the shader is not duplicated", () => {
    const { wgslFragmentSrc } = convertFragmentToWgsl(TIME_WAVE, VERTEX);
    const r = new WgslReflect(wgslFragmentSrc);
    const members = r.structs
      .find((s) => s.name === "Uniforms")
      ?.members.map((m) => m.name);
    expect(members).toEqual(["uTime", "u_offset"]);
  });

  it("numbers fragment inputs by the vertex varying order", () => {
    const swapped = VERTEX.replace(
      "varying vec2 v_vTexcoord;\nvarying vec4 v_vColour;",
      "varying vec4 v_vColour;\nvarying vec2 v_vTexcoord;",
    );
    const { wgslFragmentSrc } = convertFragmentToWgsl(TINT, swapped);
    expect(wgslFragmentSrc).toContain("@location(0) v_vColour: vec4<f32>");
    expect(wgslFragmentSrc).toContain("@location(1) v_vTexcoord: vec2<f32>");
  });

  it("rejects what it cannot map", () => {
    expect(() =>
      convertFragmentToWgsl(
        "varying vec2 v_vTexcoord;\nuniform sampler2D u_extra;\nvoid main(){ gl_FragColor = texture2D(u_extra, v_vTexcoord); }",
        VERTEX,
      ),
    ).toThrow(WgslConversionError);
    expect(() =>
      convertFragmentToWgsl(
        "varying vec2 v_vTexcoord;\nuniform mat4 u_m;\nvoid main(){ gl_FragColor = u_m * vec4(1.0); }",
        VERTEX,
      ),
    ).toThrow(WgslConversionError);
    expect(() =>
      convertFragmentToWgsl(
        "varying vec2 v_unknown;\nvoid main(){ gl_FragColor = vec4(v_unknown, 0.0, 1.0); }",
        VERTEX,
      ),
    ).toThrow(WgslConversionError);
  });

  it("reports naga syntax errors as WgslConversionError", () => {
    expect(() =>
      convertFragmentToWgsl("void main() { gl_FragColor = ; }", VERTEX),
    ).toThrow(WgslConversionError);
  });
});

import { describe, it, expect } from "vitest";
import {
  createCustomShaderFilter,
  CustomShaderFilter,
  DEFAULT_CUSTOM_SHADER_VERTEX,
} from "../systems/CustomShaderFilter.js";

describe("CustomShaderFilter", () => {
  const fragmentSrc = `
    precision mediump float;
    in vec2 vUV;
    out vec4 finalColor;
    uniform sampler2D uTexture;
    uniform float uTime;
    void main() {
      finalColor = texture(uTexture, vUV);
    }
  `;

  it("createCustomShaderFilter builds a real CustomShaderFilter instance", () => {
    const filter = createCustomShaderFilter({ fragmentSrc });
    expect(filter).toBeInstanceOf(CustomShaderFilter);
  });

  it("exposes a uTime uniform, updatable via setTime()", () => {
    const filter = createCustomShaderFilter({ fragmentSrc });
    const res = (
      filter.resources["uniforms"] as { uniforms: Record<string, unknown> }
    ).uniforms;
    expect(res["uTime"]).toBe(0);
    filter.setTime(1.5);
    expect(res["uTime"]).toBe(1.5);
  });

  it("falls back to DEFAULT_CUSTOM_SHADER_VERTEX when no vertexSrc is given", () => {
    const filter = createCustomShaderFilter({ fragmentSrc });
    // Pixi's GlProgram wraps the source with precision/version boilerplate,
    // so check containment rather than exact equality.
    expect(filter.glProgram.vertex).toContain("uOutputFrame");
    expect(filter.glProgram.vertex).not.toContain("aUV");
  });

  it("uses a supplied vertexSrc instead of the default", () => {
    const customVertex = DEFAULT_CUSTOM_SHADER_VERTEX.replace(
      "vUV = aPosition",
      "vUV = 2.0 * aPosition",
    );
    const filter = createCustomShaderFilter({
      fragmentSrc,
      vertexSrc: customVertex,
    });
    expect(filter.glProgram.vertex).toContain("vUV = 2.0 * aPosition");
  });
});

describe("CustomShaderFilter adaptVertex (importer-emitted shaders)", () => {
  const frag = `precision mediump float;
in vec2 v_vTexcoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() { finalColor = texture(uTexture, v_vTexcoord); }
`;
  const importerVertex = `in vec2 aPosition;
out vec2 v_vTexcoord;
out vec4 v_vColour;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  v_vTexcoord = aPosition;
  v_vColour = vec4(1.0);
}
`;

  it("replaces the sprite-MVP vertex with pixi's filter position maths, keeping the varyings", () => {
    const f = createCustomShaderFilter({
      fragmentSrc: frag,
      vertexSrc: importerVertex,
      adaptVertex: true,
    });
    const v = f.glProgram.vertex;
    expect(v).toContain("uOutputFrame");
    expect(v).toContain("out vec2 v_vTexcoord;");
    expect(v).toContain("v_vColour = vec4(1.0);");
    expect(v).not.toContain("uProjectionMatrix");
  });

  it("leaves the vertex stage untouched with adaptVertex: false", () => {
    const f = createCustomShaderFilter({
      fragmentSrc: frag,
      vertexSrc: importerVertex,
      adaptVertex: false,
    });
    expect(f.glProgram.vertex).toContain("uProjectionMatrix");
  });

  it("adapts a sprite-contract vertex stage by default (no aUV/projection uniforms reach the GPU)", () => {
    const f = createCustomShaderFilter({
      fragmentSrc: frag,
      vertexSrc: importerVertex,
    });
    expect(f.glProgram.vertex).toContain("uOutputFrame");
    expect(f.glProgram.vertex).not.toContain("uProjectionMatrix");
  });

  it("buildGmlShaderFilter adapts a registered shader and declares its uniforms; unknown id is undefined", async () => {
    const { registerGmlShader, clearGmlShaders } =
      await import("../systems/ShaderRegistry.js");
    const { buildGmlShaderFilter } =
      await import("../systems/CustomShaderFilter.js");
    clearGmlShaders();
    registerGmlShader("sh_x", {
      vertexSrc: importerVertex,
      fragmentSrc: frag + "uniform float u_amount;\n",
    });
    const built = buildGmlShaderFilter("sh_x");
    expect(built?.filter.glProgram.vertex).toContain("uOutputFrame");
    expect(built?.uniforms.map((u) => u.name)).toEqual(["u_amount"]);
    expect(buildGmlShaderFilter("nope")).toBeUndefined();
    clearGmlShaders();
  });
  describe("WGSL program (WebGPU)", () => {
    const fragmentSrc =
      "in vec2 vUV; out vec4 finalColor; uniform sampler2D uTexture; void main(){ finalColor = texture(uTexture, vUV); }";
    // Shape of an importer/naga-generated fragment (pixi 8.21 filter contract).
    const wgslFragment = `struct Uniforms {
    uTime: f32,
    u_amount: f32,
}
struct FragmentOutput {
    @location(0) finalColor: vec4<f32>,
}
var<private> v_vTexcoord_1: vec2<f32>;
var<private> finalColor: vec4<f32>;
@group(1) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(1)
var uTexture: texture_2d<f32>;
@group(0) @binding(2)
var uSampler: sampler;
fn main_1() {
    let _e1 = v_vTexcoord_1;
    finalColor = textureSample(uTexture, uSampler, _e1);
    return;
}
@fragment
fn main(@location(0) v_vTexcoord: vec2<f32>) -> FragmentOutput {
    v_vTexcoord_1 = v_vTexcoord;
    main_1();
    let _e5 = finalColor;
    return FragmentOutput(_e5);
}
`;

    it("builds only a GlProgram when no WGSL is given", () => {
      const f = createCustomShaderFilter({ fragmentSrc });
      expect(f.glProgram).toBeDefined();
      expect(f.gpuProgram).toBeUndefined();
    });

    it("builds a GpuProgram next to the GlProgram when wgslFragment is given", () => {
      const f = createCustomShaderFilter({
        fragmentSrc,
        wgslFragment,
        uniforms: { u_amount: { value: 0, type: "f32" } },
      });
      expect(f.glProgram).toBeDefined();
      expect(f.gpuProgram).toBeDefined();
      expect(f.gpuProgram.fragment?.entryPoint).toBe("main");
      expect(f.gpuProgram.vertex?.entryPoint).toBe("mainVertex");
      expect(f.gpuProgram.vertex?.source).toContain(
        "@group(0) @binding(0) var<uniform> gfu",
      );
    });

    it("binds the uniforms resource to group 1 binding 0 by WGSL name (not the fallback group 99)", () => {
      const f = createCustomShaderFilter({
        fragmentSrc,
        wgslFragment,
        uniforms: { u_amount: { value: 0, type: "f32" } },
      });
      const groups = f.gpuProgram.structsAndGroups.groups.map(
        (g) => `${g.group}:${g.binding}:${g.name}`,
      );
      expect(groups).toEqual(
        expect.arrayContaining([
          "0:0:gfu",
          "0:1:uTexture",
          "0:2:uSampler",
          "1:0:uniforms",
        ]),
      );
      expect(f.groups[99]).toBeUndefined();
      expect(f.groups[1]).toBeDefined();
    });

    it("pairs the generated vertex with the GLSL vertex varyings by location", async () => {
      const { toFilterWgslVertexSource } =
        await import("../systems/ShaderRegistry.js");
      const v = toFilterWgslVertexSource(
        "out vec4 v_vColour;\nout vec2 v_vTexcoord;\nvoid main(){}",
      );
      expect(v).toContain("@location(0) v_vColour: vec4<f32>");
      expect(v).toContain("@location(1) v_vTexcoord: vec2<f32>");
      expect(v).toContain("vec4<f32>(1.0), uv)");
    });

    it("buildGmlShaderFilter passes a registered wgslFragmentSrc through", async () => {
      const { registerGmlShader, clearGmlShaders } =
        await import("../systems/ShaderRegistry.js");
      const { buildGmlShaderFilter } =
        await import("../systems/CustomShaderFilter.js");
      clearGmlShaders();
      registerGmlShader("sh_w", {
        vertexSrc: "out vec2 v_vTexcoord;\nvoid main(){}",
        fragmentSrc: fragmentSrc + "uniform float u_amount;\n",
        wgslFragmentSrc: wgslFragment,
      });
      registerGmlShader("sh_gl", {
        vertexSrc: "out vec2 v_vTexcoord;\nvoid main(){}",
        fragmentSrc,
      });
      expect(buildGmlShaderFilter("sh_w")?.filter.gpuProgram).toBeDefined();
      expect(buildGmlShaderFilter("sh_gl")?.filter.gpuProgram).toBeUndefined();
      clearGmlShaders();
    });
  });
});

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
    const res = filter.resources["uniforms"] as
      | Record<string, { value: unknown }>
      | undefined;
    expect(res?.["uTime"]?.value).toBe(0);
    filter.setTime(1.5);
    expect(res?.["uTime"]?.value).toBe(1.5);
  });

  it("falls back to DEFAULT_CUSTOM_SHADER_VERTEX when no vertexSrc is given", () => {
    const filter = createCustomShaderFilter({ fragmentSrc });
    // Pixi's GlProgram wraps the source with precision/version boilerplate,
    // so check containment rather than exact equality.
    expect(filter.glProgram.vertex).toContain("uProjectionMatrix");
    expect(filter.glProgram.vertex).toContain("vUV = aUV;");
  });

  it("uses a supplied vertexSrc instead of the default", () => {
    const customVertex = DEFAULT_CUSTOM_SHADER_VERTEX.replace(
      "vUV = aUV;",
      "vUV = aUV * 2.0;",
    );
    const filter = createCustomShaderFilter({
      fragmentSrc,
      vertexSrc: customVertex,
    });
    expect(filter.glProgram.vertex).toContain("vUV = aUV * 2.0;");
    expect(filter.glProgram.vertex).not.toContain("vUV = aUV;\n");
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

  it("leaves the vertex stage untouched without adaptVertex", () => {
    const f = createCustomShaderFilter({
      fragmentSrc: frag,
      vertexSrc: importerVertex,
    });
    expect(f.glProgram.vertex).toContain("uProjectionMatrix");
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
});

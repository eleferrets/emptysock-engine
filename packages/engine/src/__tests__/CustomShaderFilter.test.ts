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

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerShader,
  getShader,
  hasShader,
  unregisterShader,
  clearShaders,
  setShaderUniform,
  getShaderUniforms,
  getShaderVersion,
  parseShaderUniforms,
  toFilterVertexSource,
} from "../systems/ShaderRegistry.js";

describe("ShaderRegistry", () => {
  beforeEach(() => clearShaders());

  it("registers, looks up and unregisters by shader name", () => {
    registerShader("sh_white", { vertexSrc: "v", fragmentSrc: "f" });
    expect(hasShader("sh_white")).toBe(true);
    expect(getShader("sh_white")?.fragmentSrc).toBe("f");
    unregisterShader("sh_white");
    expect(getShader("sh_white")).toBeUndefined();
  });

  it("normalises CR/CRLF line endings so a // comment cannot swallow the next line", () => {
    registerShader("s", {
      vertexSrc: "a\r\nb",
      fragmentSrc: "//\rin vec2 v;",
    });
    expect(getShader("s")?.vertexSrc).toBe("a\nb");
    expect(getShader("s")?.fragmentSrc).toBe("//\nin vec2 v;");
  });

  it("stores per-shader uniforms, truncates ints, bumps the version, rejects unknown shaders", () => {
    registerShader("s", { vertexSrc: "", fragmentSrc: "" });
    const v0 = getShaderVersion("s");
    expect(setShaderUniform("s", "u_n", "i", [2.9])).toBe(true);
    expect(getShaderUniforms("s")?.get("u_n")).toEqual({
      kind: "i",
      values: [2],
    });
    expect(getShaderVersion("s")).toBeGreaterThan(v0);
    expect(setShaderUniform("nope", "u", "f", [1])).toBe(false);
  });

  it("parses scalar/vector uniforms, skipping samplers, matrices and uTime", () => {
    const u = parseShaderUniforms(
      "uniform sampler2D uTexture;\nuniform float uTime;\nuniform float u_a;\nuniform vec3 u_tint;\nuniform int u_n;\nuniform mat3 m;",
    );
    expect(u.map((x) => [x.name, x.type, x.components])).toEqual([
      ["u_a", "f32", 1],
      ["u_tint", "vec3<f32>", 3],
      ["u_n", "i32", 1],
    ]);
  });

  it("builds a pixi-filter vertex stage that keeps the varyings but drops the MVP matrices", () => {
    const v = toFilterVertexSource(
      "in vec2 aPosition;\nuniform mat3 uProjectionMatrix;\n  out vec2 v_vTexcoord;\n  out vec4 v_vColour;\nvoid main(){}",
    );
    expect(v).toContain("out vec2 v_vTexcoord;");
    expect(v).toContain("out vec4 v_vColour;");
    expect(v).toContain(
      "v_vTexcoord = aPosition * (uOutputFrame.zw * uInputSize.zw);",
    );
    expect(v).toContain("v_vColour = vec4(1.0);");
    expect(v).toContain("uniform vec4 uOutputFrame;");
    expect(v).not.toContain("uProjectionMatrix");
  });
});

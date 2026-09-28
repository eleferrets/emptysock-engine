import { describe, it, expect, beforeEach } from "vitest";
import {
  registerGmlShader,
  getGmlShader,
  hasGmlShader,
  unregisterGmlShader,
  clearGmlShaders,
  setGmlShaderUniform,
  getGmlShaderUniforms,
  getGmlShaderVersion,
  parseShaderUniforms,
  toFilterVertexSource,
} from "../systems/ShaderRegistry.js";

describe("ShaderRegistry", () => {
  beforeEach(() => clearGmlShaders());

  it("registers, looks up and unregisters by GameMaker shader name", () => {
    registerGmlShader("sh_white", { vertexSrc: "v", fragmentSrc: "f" });
    expect(hasGmlShader("sh_white")).toBe(true);
    expect(getGmlShader("sh_white")?.fragmentSrc).toBe("f");
    unregisterGmlShader("sh_white");
    expect(getGmlShader("sh_white")).toBeUndefined();
  });

  it("normalises CR/CRLF line endings so a // comment cannot swallow the next line", () => {
    registerGmlShader("s", {
      vertexSrc: "a\r\nb",
      fragmentSrc: "//\rin vec2 v;",
    });
    expect(getGmlShader("s")?.vertexSrc).toBe("a\nb");
    expect(getGmlShader("s")?.fragmentSrc).toBe("//\nin vec2 v;");
  });

  it("stores per-shader uniforms, truncates ints, bumps the version, rejects unknown shaders", () => {
    registerGmlShader("s", { vertexSrc: "", fragmentSrc: "" });
    const v0 = getGmlShaderVersion("s");
    expect(setGmlShaderUniform("s", "u_n", "i", [2.9])).toBe(true);
    expect(getGmlShaderUniforms("s")?.get("u_n")).toEqual({
      kind: "i",
      values: [2],
    });
    expect(getGmlShaderVersion("s")).toBeGreaterThan(v0);
    expect(setGmlShaderUniform("nope", "u", "f", [1])).toBe(false);
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

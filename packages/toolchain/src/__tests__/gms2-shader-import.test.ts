import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  detectShaderLanguage,
  convertGms2Shader,
  translateGms2ShaderToPixi,
  buildShaderAsset,
  ShaderTranslationError,
} from "../gms2-shader-import.js";

// ---------------------------------------------------------------------------
// Fully synthetic — hand-authored .vsh/.fsh source mirroring GameMaker's own
// documented default passthrough shader (see the Guide To Using Shaders
// manual page), never real project content.
// ---------------------------------------------------------------------------

const GM_PASSTHROUGH_VERTEX = `
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main()
{
    vec4 object_space_pos = vec4( in_Position.x, in_Position.y, in_Position.z, 1.0);
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * object_space_pos;
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;

const GM_TINT_FRAGMENT = `
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform vec3 u_tint;

void main()
{
    vec4 base = v_vColour * texture2D( gm_BaseTexture, v_vTexcoord );
    gl_FragColor = vec4(base.rgb * u_tint, base.a);
}
`;

const GM_DISTORTION_VERTEX = `
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform float u_wave;

void main()
{
    vec3 pos = in_Position;
    pos.y += sin(pos.x + u_wave) * 4.0;
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(pos, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;

const HLSL_VERTEX = `
cbuffer cb : register(b0)
{
  float4x4 gm_ModelViewProjMatrix;
};

struct VS_INPUT
{
  float3 pos : POSITION0;
  float4 col : COLOR0;
  float2 uv : TEXCOORD0;
};

struct VS_OUTPUT
{
  float4 pos : SV_POSITION;
  float4 col : COLOR0;
  float2 uv : TEXCOORD0;
};

VS_OUTPUT main(VS_INPUT input)
{
  VS_OUTPUT output;
  output.pos = mul(float4(input.pos, 1.0), gm_ModelViewProjMatrix);
  output.col = input.col;
  output.uv = input.uv;
  return output;
}
`;

const HLSL_FRAGMENT = `
Texture2D gm_BaseTextureObject : register(t0);
SamplerState gm_BaseTexture : register(s0);

float4 main(float4 col : COLOR0, float2 uv : TEXCOORD0) : SV_TARGET
{
  return col * gm_BaseTextureObject.Sample(gm_BaseTexture, uv);
}
`;

describe("detectShaderLanguage", () => {
  it("detects GameMaker's GLSL ES convention", () => {
    expect(detectShaderLanguage(GM_PASSTHROUGH_VERTEX, GM_TINT_FRAGMENT)).toBe(
      "glsl-es",
    );
  });

  it("detects HLSL11", () => {
    expect(detectShaderLanguage(HLSL_VERTEX, HLSL_FRAGMENT)).toBe("hlsl11");
  });

  it("returns unknown for source with no recognisable tokens", () => {
    expect(detectShaderLanguage("", "")).toBe("unknown");
  });
});

describe("translateGms2ShaderToPixi", () => {
  it("translates the standard GameMaker passthrough vertex + a tint fragment", () => {
    const result = translateGms2ShaderToPixi(
      GM_PASSTHROUGH_VERTEX,
      GM_TINT_FRAGMENT,
    );

    // Vertex: pixi's real attribute/uniform contract, no GameMaker built-ins left.
    expect(result.vertexSrc).toContain("in vec2 aPosition;");
    expect(result.vertexSrc).toContain("in vec2 aUV;");
    expect(result.vertexSrc).toContain("uniform mat3 uProjectionMatrix;");
    expect(result.vertexSrc).toContain("uniform mat3 uWorldTransformMatrix;");
    expect(result.vertexSrc).toContain("uniform mat3 uTransformMatrix;");
    expect(result.vertexSrc).toContain("out vec2 v_vTexcoord;");
    expect(result.vertexSrc).toContain("out vec4 v_vColour;");
    expect(result.vertexSrc).toContain("v_vTexcoord = aUV;");
    expect(result.vertexSrc).toContain("v_vColour = vec4(1.0);");
    expect(result.vertexSrc).not.toMatch(/in_Position|gm_Matrices|attribute/);

    // Fragment: varying -> in, texture2D -> texture, gm_BaseTexture -> uTexture,
    // gl_FragColor -> finalColor, custom uniform passed through untouched.
    expect(result.fragmentSrc).toContain("in vec2 v_vTexcoord;");
    expect(result.fragmentSrc).toContain("in vec4 v_vColour;");
    expect(result.fragmentSrc).toContain("uniform sampler2D uTexture;");
    expect(result.fragmentSrc).toContain("out vec4 finalColor;");
    expect(result.fragmentSrc).toContain("texture( uTexture, v_vTexcoord )");
    expect(result.fragmentSrc).toContain(
      "finalColor = vec4(base.rgb * u_tint, base.a);",
    );
    expect(result.fragmentSrc).toContain("uniform vec3 u_tint;");
    expect(result.fragmentSrc).not.toMatch(
      /gl_FragColor|gm_BaseTexture|texture2D|varying/,
    );
    expect(result.fragmentSrc).toContain("precision mediump float;");
  });

  it("rejects a vertex shader with non-passthrough per-vertex position math", () => {
    expect(() =>
      translateGms2ShaderToPixi(GM_DISTORTION_VERTEX, GM_TINT_FRAGMENT),
    ).toThrow(ShaderTranslationError);
  });

  it("rejects a varying whose meaning can't be inferred from its name", () => {
    const weirdVertex = GM_PASSTHROUGH_VERTEX.replace(
      "varying vec4 v_vColour;",
      "varying vec4 v_vColour;\nvarying float v_customData;",
    ).replace(
      "v_vColour = in_Colour;",
      "v_vColour = in_Colour;\n    v_customData = 1.0;",
    );
    expect(() =>
      translateGms2ShaderToPixi(weirdVertex, GM_TINT_FRAGMENT),
    ).toThrow(ShaderTranslationError);
  });
});

describe("convertGms2Shader + buildShaderAsset (synthetic project directory)", () => {
  let shaderDir: string;

  beforeAll(async () => {
    shaderDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-shader-fixture-"),
    );
    await fs.writeFile(
      path.join(shaderDir, "sh_tint.yy"),
      `{"resourceType":"GMShader","name":"sh_tint",}`,
    );
    await fs.writeFile(
      path.join(shaderDir, "sh_tint.vsh"),
      GM_PASSTHROUGH_VERTEX,
    );
    await fs.writeFile(path.join(shaderDir, "sh_tint.fsh"), GM_TINT_FRAGMENT);
  });

  afterAll(async () => {
    await fs.rm(shaderDir, { recursive: true, force: true });
  });

  it("reads the shader pair off disk and detects GLSL ES", async () => {
    const shader = await convertGms2Shader(shaderDir);
    expect(shader.name).toBe("sh_tint");
    expect(shader.language).toBe("glsl-es");
  });

  it("builds a real TS module exporting vertexSrc/fragmentSrc", async () => {
    const shader = await convertGms2Shader(shaderDir);
    const content = buildShaderAsset(shader);
    expect(content).toContain("export const ShTintShader = {");
    expect(content).toContain("vertexSrc:");
    expect(content).toContain("fragmentSrc:");
    expect(content).toContain("createCustomShaderFilter");
    expect(content).toContain("GPU compilation was NOT verified");
  });

  it("throws when the directory has no .vsh/.fsh pair", async () => {
    const emptyDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-shader-empty-"),
    );
    await fs.writeFile(
      path.join(emptyDir, "sh_empty.yy"),
      `{"resourceType":"GMShader","name":"sh_empty",}`,
    );
    await expect(convertGms2Shader(emptyDir)).rejects.toThrow();
    await fs.rm(emptyDir, { recursive: true, force: true });
  });
});

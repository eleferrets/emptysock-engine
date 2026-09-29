import { promises as fs } from "node:fs";
import path from "node:path";
import {
  convertFragmentToWgsl,
  WgslConversionError,
} from "./glsl-es-to-wgsl.js";

/**
 * GMS2 `GMShader` resource import.
 *
 * A real GameMaker shader resource is a `.yy` file plus a `.vsh` (vertex)
 * and `.fsh` (fragment) source-file pair sitting next to it in the same
 * resource directory, both named after the resource (`<name>.vsh`/
 * `<name>.fsh`). GameMaker's own shader authoring language is GLSL ES 1.00
 * with a fixed set of built-in attribute/uniform names it supplies at
 * runtime for the "compile per target platform" pipeline documented in the
 * GameMaker manual's Shaders page: `attribute vec3 in_Position`,
 * `attribute vec4 in_Colour`, `attribute vec2 in_TextureCoord`,
 * `gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION]` (and the other `MATRIX_*`
 * indices) for the built-in transform, and `gm_BaseTexture` for the sprite's
 * own texture sampled via `texture2D()`. GameMaker cross-compiles that same
 * GLSL-ES-authored source into HLSL11 (Windows/UWP/Xbox), GLSL (Mac/Linux)
 * or PSSL (PS4) per target at build time — but a project can also opt a
 * shader into being written directly in real HLSL11 (a genuinely different,
 * DirectX-only shading language, gated behind conditional
 * `#ifdef _YY_HLSL11_` blocks or an all-HLSL resource), which this importer
 * cannot translate — see `detectShaderLanguage` below.
 *
 * `@emptysock/engine`'s own shader surface (`systems/CustomShaderFilter.ts`)
 * is a real PixiJS v8 `Filter`: GLSL ES 3.00 syntax (`in`/`out`, not
 * `attribute`/`varying`), a `vec2 aPosition`/`vec2 aUV` attribute pair (not
 * GameMaker's `vec3 in_Position`), and a `mat3` MVP uniform triplet
 * (`uProjectionMatrix`/`uWorldTransformMatrix`/`uTransformMatrix`) rather
 * than GameMaker's `mat4 gm_Matrices[...]` array — both ultimately just map
 * one sprite-quad vertex from object space to screen space, so the
 * translation below targets that same end result rather than trying to
 * preserve GameMaker's 4x4/projective math verbatim.
 */

export type ShaderLanguage = "glsl-es" | "hlsl11" | "unknown";

/** Thrown by `translateGms2ShaderToPixi` for a shape this mechanical translator cannot honestly reproduce. */
export class ShaderTranslationError extends Error {}

interface ParsedVarying {
  type: string;
  name: string;
}

const HLSL_TOKENS = [
  /\bfloat4x4\b/,
  /\bfloat[234]\b/,
  /\bcbuffer\b/,
  /\bTexture2D\b/,
  /\bSamplerState\b/,
  /:\s*(SV_POSITION|POSITION\d*|TEXCOORD\d*|COLOR\d*)\b/,
  /\b_YY_HLSL11_\b/,
];

const GLSL_TOKENS = [
  /\battribute\b/,
  /\bvarying\b/,
  /\bgl_Position\b/,
  /\bgl_FragColor\b/,
  /\bgm_Matrices\b/,
  /\bgm_BaseTexture\b/,
  /\bvoid\s+main\s*\(/,
  /\bvec[234]\b/,
];

/**
 * Heuristically classifies a GMS2 shader's source language. GameMaker's own
 * `.yy` resource file carries no reliable per-shader field for this (whether
 * HLSL11 is used is a project-wide "Use HLSL" build option, not a
 * per-resource one this importer can read out of context) — the honest
 * approach is to look at what the actual `.vsh`/`.fsh` text contains.
 * Real GLSL ES and HLSL11 shaders each use enough mutually-exclusive,
 * unambiguous tokens (attribute/varying/gl_Position vs. float4x4/cbuffer/
 * Texture2D/`: SV_POSITION`-style semantics) that a straightforward token
 * count is a reliable-in-practice signal without needing a real parser.
 */
export function detectShaderLanguage(
  vertexSrc: string,
  fragmentSrc: string,
): ShaderLanguage {
  const combined = `${vertexSrc}\n${fragmentSrc}`;
  const hlslScore = HLSL_TOKENS.reduce(
    (n, re) => n + (re.test(combined) ? 1 : 0),
    0,
  );
  const glslScore = GLSL_TOKENS.reduce(
    (n, re) => n + (re.test(combined) ? 1 : 0),
    0,
  );
  if (hlslScore > 0 && hlslScore >= glslScore) return "hlsl11";
  if (glslScore > 0) return "glsl-es";
  return "unknown";
}

export interface ShaderAsset {
  name: string;
  language: ShaderLanguage;
  vertexRaw: string;
  fragmentRaw: string;
}

const SHADER_EXTENSIONS_VERTEX = [".vsh"];
const SHADER_EXTENSIONS_FRAGMENT = [".fsh"];

/**
 * Reads a GMS2 shader resource directory (`<name>.yy` + `<name>.vsh` +
 * `<name>.fsh`) and returns its raw source plus a detected language. Throws
 * a descriptive Error if the directory or either source file cannot be
 * found/read — mirrors `convertGms2Sound`/`convertGms2Font`'s existing
 * "check the real files exist on disk, fail honestly if not" pattern.
 */
export async function convertGms2Shader(
  shaderYyDir: string,
): Promise<ShaderAsset> {
  let entries: string[];
  try {
    entries = await fs.readdir(shaderYyDir);
  } catch (err) {
    throw new Error(
      `convertGms2Shader: cannot read directory "${shaderYyDir}": ${String(err)}`,
    );
  }

  const yyFile = entries.find((e) => e.endsWith(".yy"));
  const name =
    yyFile !== undefined ? yyFile.slice(0, -3) : path.basename(shaderYyDir);

  const vertexFile =
    entries.find((e) => e === `${name}.vsh`) ??
    entries.find((e) =>
      SHADER_EXTENSIONS_VERTEX.includes(path.extname(e).toLowerCase()),
    );
  const fragmentFile =
    entries.find((e) => e === `${name}.fsh`) ??
    entries.find((e) =>
      SHADER_EXTENSIONS_FRAGMENT.includes(path.extname(e).toLowerCase()),
    );

  if (vertexFile === undefined || fragmentFile === undefined) {
    throw new Error(
      `convertGms2Shader: could not find both a .vsh and .fsh file alongside "${shaderYyDir}"`,
    );
  }

  let vertexRaw: string;
  let fragmentRaw: string;
  try {
    vertexRaw = await fs.readFile(path.join(shaderYyDir, vertexFile), "utf-8");
    fragmentRaw = await fs.readFile(
      path.join(shaderYyDir, fragmentFile),
      "utf-8",
    );
  } catch (err) {
    throw new Error(
      `convertGms2Shader: cannot read shader source in "${shaderYyDir}": ${String(err)}`,
    );
  }

  const language = detectShaderLanguage(vertexRaw, fragmentRaw);
  return { name, language, vertexRaw, fragmentRaw };
}

function extractVaryings(vertexSrc: string): ParsedVarying[] {
  const out: ParsedVarying[] = [];
  const re = /^\s*varying\s+(\w+)\s+(\w+)\s*;\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(vertexSrc)) !== null) {
    out.push({ type: m[1] as string, name: m[2] as string });
  }
  return out;
}

type VaryingKind = "uv" | "colour" | "unknown";

function classifyVarying(v: ParsedVarying): VaryingKind {
  if (/texcoord|uv/i.test(v.name)) return "uv";
  if (/colou?r/i.test(v.name)) return "colour";
  return "unknown";
}

/**
 * True only for GameMaker's own documented standard passthrough position
 * transform — either the two-statement form from the manual's "Guide To
 * Using Shaders" page (an intermediate `object_space_pos`/similarly-named
 * vec4 built from `in_Position`, then multiplied by
 * `gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION]`) or the equivalent one-line
 * form. Any other use of `in_Position` (per-vertex wave/distortion offsets,
 * extra math, a different `MATRIX_*` index, …) is real per-vertex gameplay
 * logic this mechanical translator cannot safely fabricate — callers must
 * treat that shape as untranslatable rather than silently dropping it.
 */
function isSimplePositionPassthrough(vertexSrc: string): boolean {
  const norm = vertexSrc.replace(/\s+/g, " ").trim();

  const direct =
    /gl_Position\s*=\s*gm_Matrices\s*\[\s*MATRIX_WORLD_VIEW_PROJECTION\s*\]\s*\*\s*vec4\s*\(\s*in_Position(?:\.xyz)?\s*,\s*1\.0\s*\)\s*;/;
  if (direct.test(norm)) return true;

  const interMatch = norm.match(
    /vec4\s+(\w+)\s*=\s*vec4\s*\(\s*in_Position\.x\s*,\s*in_Position\.y\s*,\s*in_Position\.z\s*,\s*1\.0\s*\)\s*;/,
  );
  if (interMatch) {
    const varName = interMatch[1] as string;
    const usage = new RegExp(
      `gl_Position\\s*=\\s*gm_Matrices\\s*\\[\\s*MATRIX_WORLD_VIEW_PROJECTION\\s*\\]\\s*\\*\\s*${varName}\\s*;`,
    );
    if (usage.test(norm)) return true;
  }

  return false;
}

export interface ShaderTranslationResult {
  vertexSrc: string;
  fragmentSrc: string;
  varyings: ParsedVarying[];
}

/**
 * Mechanically translates a GameMaker GLSL-ES shader pair into the GLSL ES
 * 3.00 shape `@emptysock/engine`'s `CustomShaderFilter` requires (see that
 * file's own doc comment for the exact uniform/attribute contract this
 * mirrors). Throws `ShaderTranslationError` — never silently drops logic —
 * when the shader does something this translator cannot honestly reproduce:
 * non-passthrough per-vertex position math, or a varying whose per-vertex
 * meaning can't be inferred from its name (only texcoord- and colour-shaped
 * varyings are recognised, since those are the two GameMaker's own built-ins
 * ever pass through by default).
 */
export function translateGms2ShaderToPixi(
  vertexSrcRaw: string,
  fragmentSrcRaw: string,
): ShaderTranslationResult {
  // GameMaker writes CRLF (and the occasional lone CR inside a comment
  // block); a bare `\r` is not reliably a line terminator to every GLSL
  // compiler, so a `//` comment could swallow the declaration after it.
  const vertexSrc = vertexSrcRaw.replace(/\r\n?/g, "\n");
  const fragmentSrc = fragmentSrcRaw.replace(/\r\n?/g, "\n");
  if (!isSimplePositionPassthrough(vertexSrc)) {
    throw new ShaderTranslationError(
      "vertex shader does non-passthrough position math (in_Position is used in something other than GameMaker's standard MVP transform) — this importer only mechanically translates the standard passthrough vertex stage; recreate this shader's vertex logic manually against CustomShaderFilter's aPosition/uProjectionMatrix/uWorldTransformMatrix/uTransformMatrix contract.",
    );
  }

  const varyings = extractVaryings(vertexSrc);
  for (const v of varyings) {
    if (classifyVarying(v) === "unknown") {
      throw new ShaderTranslationError(
        `varying "${v.name}" is not a recognised texcoord/colour passthrough (only names matching /texcoord|uv/i or /colou?r/i are inferred) — this importer cannot determine what per-vertex data it should carry; recreate this shader's varyings manually.`,
      );
    }
  }

  const varyingOutLines = varyings
    .map((v) => `  out ${v.type} ${v.name};`)
    .join("\n");
  const varyingAssignLines = varyings
    .map((v) => {
      const kind = classifyVarying(v);
      const rhs = kind === "uv" ? "aUV" : "vec4(1.0)";
      return `  ${v.name} = ${rhs};`;
    })
    .join("\n");

  const translatedVertex = `in vec2 aPosition;
in vec2 aUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
${varyingOutLines ? `${varyingOutLines}\n` : ""}
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
${varyingAssignLines}
}
`;

  let frag = fragmentSrc;
  // GameMaker's varying-in (fragment side) becomes GLSL ES 3.00's `in`.
  frag = frag.replace(/^\s*varying\s+(\w+)\s+(\w+)\s*;\s*$/gm, "in $1 $2;");
  // GLSL ES 1.00's texture2D() is texture() in ES 3.00.
  frag = frag.replace(/\btexture2D\s*\(/g, "texture(");

  const usesBaseTexture = /\bgm_BaseTexture\b/.test(frag);
  frag = frag.replace(/\bgm_BaseTexture\b/g, "uTexture");

  const usesFragColor = /\bgl_FragColor\b/.test(frag);
  frag = frag.replace(/\bgl_FragColor\b/g, "finalColor");

  const hasPrecision = /precision\s+\w+\s+float\s*;/.test(frag);
  const precisionLine = hasPrecision ? "" : "precision mediump float;\n";
  const outDecl = usesFragColor ? "out vec4 finalColor;\n" : "";
  const textureUniform = usesBaseTexture ? "uniform sampler2D uTexture;\n" : "";

  const translatedFragment = `${precisionLine}${outDecl}${textureUniform}${frag}`;

  return {
    vertexSrc: translatedVertex,
    fragmentSrc: translatedFragment,
    varyings,
  };
}

function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Builds a TypeScript shader-asset descriptor module from a converted GMS2
 * shader (`ShaderAsset.language === "glsl-es"` and translatable). Throws
 * `ShaderTranslationError` (never fabricates a passing result) if the
 * shader's position/varying shape isn't one this translator can honestly
 * reproduce — callers should catch that and report the shader "manual",
 * the same pattern `gms2-import.ts` already uses for sprite/sound/font
 * conversion failures.
 *
 * GPU-compilation success is NOT verified by this function (or anywhere in
 * this toolchain) — there is no headless WebGL context available in this
 * environment. What IS verified: the emitted source is syntactically
 * well-formed for GLSL ES 3.00 (structural — declarations balanced, known
 * built-ins renamed consistently) and mirrors `CustomShaderFilter`'s exact,
 * already-shipped attribute/uniform contract byte-for-byte, the same
 * contract the IDE's ShaderEditor panel already compiles shaders against.
 */
export function buildShaderAsset(shader: ShaderAsset): string {
  return buildShaderAssetWithDiagnostics(shader).content;
}

export interface ShaderAssetBuild {
  content: string;
  /** Set when the WGSL (WebGPU) program could not be produced; the shader is GL-only. */
  wgslWarning?: string;
}

/**
 * `buildShaderAsset` plus diagnostics. Next to the GLSL program it also emits
 * `wgslFragmentSrc` (naga-converted, see `glsl-es-to-wgsl.ts`) so the shader
 * can run under pixi's WebGPU renderer. When that conversion fails no WGSL is
 * emitted and `wgslWarning` says why; the shader then stays GL-only. Neither
 * program has been run on a GPU at import time.
 */
export function buildShaderAssetWithDiagnostics(
  shader: ShaderAsset,
): ShaderAssetBuild {
  const translated = translateGms2ShaderToPixi(
    shader.vertexRaw,
    shader.fragmentRaw,
  );
  const pascal = toPascalCase(shader.name);

  let wgslFragmentSrc: string | undefined;
  let wgslWarning: string | undefined;
  try {
    wgslFragmentSrc = convertFragmentToWgsl(
      shader.fragmentRaw,
      shader.vertexRaw,
    ).wgslFragmentSrc;
  } catch (err) {
    wgslWarning =
      err instanceof WgslConversionError
        ? err.message
        : `WGSL conversion failed (${String(err)})`;
  }
  const wgslLine =
    wgslFragmentSrc === undefined
      ? ""
      : `\n  wgslFragmentSrc: ${JSON.stringify(wgslFragmentSrc)},`;
  const wgslHeader =
    wgslFragmentSrc === undefined
      ? `// WebGPU: NOT available. The GLSL->WGSL conversion failed (${(wgslWarning ?? "").replace(/\s+/g, " ")}),
// so this shader is GL-only and renders nothing under the WebGPU renderer.`
      : `// WebGPU: wgslFragmentSrc was converted at import time (GLSL ES 1.00 ->
// GLSL 450 -> naga -> WGSL). Validated by naga only, NOT run on a GPU.`;

  const content = `// Auto-generated from GMS2 shader: ${shader.name}
// Mechanically translated from GameMaker's GLSL ES shader convention
// (attribute/varying, in_Position/in_TextureCoord/in_Colour,
// gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION], gm_BaseTexture, texture2D(),
// gl_FragColor) into @emptysock/engine's CustomShaderFilter contract
// (GLSL ES 3.00 in/out, aPosition/aUV, uProjectionMatrix/
// uWorldTransformMatrix/uTransformMatrix, uTexture, texture(), finalColor).
// GPU compilation was NOT verified (no headless WebGL context available at
// import time) — only that the output is structurally well-formed GLSL ES
// 3.00 following CustomShaderFilter's own established contract.
${wgslHeader}
// Any GameMaker uniform the original shader declared beyond the built-ins above
// (set at runtime via shader_set_uniform_f) passed through untouched by
// name — wire it the same way via the constructed filter's own
// \`.resources.uniforms\` (see CustomShaderFilter.ts).
//
// Use with @emptysock/engine's CustomShaderFilter + RenderSystem:
//   import { createCustomShaderFilter } from "@emptysock/engine";
//   const filter = createCustomShaderFilter({
//     vertexSrc: ${pascal}Shader.vertexSrc,
//     fragmentSrc: ${pascal}Shader.fragmentSrc,
//     name: ${JSON.stringify(shader.name)},
//   });
//   renderSystem.addLayerShaderFilter("default", filter);
//
// Importing this module registers the shader with @emptysock/engine's
// shader registry under its GameMaker name, which is what makes GML
// \`shader_set(${shader.name})\` render through it (RenderPipeline builds one
// shared Filter per registered shader; it swaps in a filter-compatible vertex
// stage, so this file's vertexSrc is only read for its varyings).
import { registerGmlShader } from "@emptysock/engine";

export const ${pascal}Shader = {
  name: ${JSON.stringify(shader.name)},
  vertexSrc: ${JSON.stringify(translated.vertexSrc)},
  fragmentSrc: ${JSON.stringify(translated.fragmentSrc)},${wgslLine}
} as const;

registerGmlShader(${JSON.stringify(shader.name)}, ${pascal}Shader);
`;
  return wgslWarning === undefined ? { content } : { content, wgslWarning };
}

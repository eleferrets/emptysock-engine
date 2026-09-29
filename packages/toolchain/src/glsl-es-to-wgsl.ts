import { parseGlsl, validate, writeWgsl } from "naga-wasm";

/**
 * Build-time GLSL ES 1.00 (GameMaker fragment stage) -> WGSL, so an imported
 * shader can also run under pixi's WebGPU renderer.
 *
 * `naga-wasm` only accepts Vulkan-style GLSL 450, so the fragment is first
 * rewritten text-wise into that dialect, laid out to match pixi 8.21's WebGPU
 * filter contract (see docs/research/11-glsl-to-wgsl.md, "Verified against
 * pixi 8.21 source"):
 *   - group 0 binding 1/2: `uTexture` / `uSampler` (the filter input, bound by pixi)
 *   - group 1 binding 0: one uniform block, instance name `uniforms`, members
 *     `uTime` first then every loose scalar/vector uniform in declaration order
 *     (must mirror `CustomShaderFilter`'s JS UniformGroup order)
 *   - varyings at `@location(n)` numbered by the vertex stage's varying order
 *   - fragment entry point `main` (the engine pairs it with a template vertex)
 *
 * Anything outside that supported subset throws `WgslConversionError`; the
 * importer then emits GLSL only and a warning (the shader stays GL-only).
 */
export class WgslConversionError extends Error {}

export interface WgslConversion {
  /** The intermediate Vulkan-style GLSL 450 (kept for diagnostics/tests). */
  glsl450: string;
  wgslFragmentSrc: string;
}

const UNIFORM_RE =
  /^[ \t]*uniform\s+(?:(?:lowp|mediump|highp)\s+)?(float|int|vec[234])\s+(\w+)\s*;[ \t]*$/gm;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "");
}

/** Names of the vertex stage's varyings, in declaration order (ES 1.00 `varying`). */
export function vertexVaryingNames(vertexSrc: string): string[] {
  const out: string[] = [];
  const re = /^[ \t]*varying\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+(\w+)\s*;/gm;
  let m: RegExpExecArray | null;
  const clean = stripComments(vertexSrc);
  while ((m = re.exec(clean)) !== null) out.push(m[1] as string);
  return out;
}

export function rewriteFragmentToGlsl450(
  fragmentRaw: string,
  vertexRaw: string,
): string {
  let src = stripComments(fragmentRaw.replace(/\r\n?/g, "\n"));

  // Precision boilerplate: `#ifdef GL_ES ... #endif` wrapping only precision
  // statements, and bare `precision x float;` lines.
  src = src.replace(
    /^[ \t]*#ifdef\s+GL_ES\s*\n(?:[ \t]*precision[^\n;]*;[ \t]*\n)+[ \t]*#endif[ \t]*$/gm,
    "",
  );
  src = src.replace(/^[ \t]*precision\s+[^\n;]*;[ \t]*$/gm, "");
  src = src.replace(/^[ \t]*#version[^\n]*$/gm, "");
  src = src.replace(/\b(?:lowp|mediump|highp)\b/g, "");

  // Varyings -> located inputs.
  const vNames = vertexVaryingNames(vertexRaw);
  src = src.replace(
    /^[ \t]*varying\s+(\w+)\s+(\w+)\s*;[ \t]*$/gm,
    (_m, type: string, name: string) => {
      const loc = vNames.indexOf(name);
      if (loc < 0) {
        throw new WgslConversionError(
          `fragment varying "${name}" is not written by the vertex stage`,
        );
      }
      return `layout(location=${loc}) in ${type} ${name};`;
    },
  );

  // Loose scalar/vector uniforms -> one block member each.
  const members: string[] = ["float uTime;"];
  const memberNames: string[] = ["uTime"];
  src = src.replace(UNIFORM_RE, (_m, type: string, name: string) => {
    if (name !== "uTime") {
      members.push(`${type} ${name};`);
      memberNames.push(name);
    }
    return "";
  });
  // gm_BaseTexture is the only sampler supported; declared or not.
  src = src.replace(
    /^[ \t]*uniform\s+sampler2D\s+gm_BaseTexture\s*;[ \t]*$/gm,
    "",
  );
  if (/\buniform\b/.test(src)) {
    throw new WgslConversionError(
      "fragment declares a uniform this rewrite cannot map (only float/int/vec2-4 scalars and vectors and gm_BaseTexture are supported; extra samplers, matrices, arrays and bools are not)",
    );
  }

  // Sampling.
  src = src.replace(
    /\btexture2D\s*\(\s*gm_BaseTexture\s*,/g,
    "texture(sampler2D(uTexture, uSampler),",
  );
  if (/\btexture2D\w*\s*\(/.test(src) || /\bgm_BaseTexture\b/.test(src)) {
    throw new WgslConversionError(
      "fragment samples a texture other than as texture2D(gm_BaseTexture, uv)",
    );
  }
  if (/\bgl_FragData\b|\bgm_Matrices\b|\bgl_FragCoord\b/.test(src)) {
    throw new WgslConversionError(
      "fragment uses gl_FragData/gm_Matrices/gl_FragCoord, which this rewrite does not map",
    );
  }

  // Qualify uniform uses with the block instance name.
  for (const n of memberNames) {
    src = src.replace(
      new RegExp(`(?<![\\w.])${n}(?!\\w)`, "g"),
      `uniforms.${n}`,
    );
  }

  src = src.replace(/\bgl_FragColor\b/g, "finalColor");

  const header = [
    "#version 450",
    "layout(location=0) out vec4 finalColor;",
    `layout(set=1, binding=0) uniform Uniforms { ${members.join(" ")} } uniforms;`,
    "layout(set=0, binding=1) uniform texture2D uTexture;",
    "layout(set=0, binding=2) uniform sampler uSampler;",
  ].join("\n");
  return `${header}\n${src}`;
}

/** Converts a GameMaker fragment to a pixi-8.21-compatible WGSL fragment. Throws `WgslConversionError`. */
export function convertFragmentToWgsl(
  fragmentRaw: string,
  vertexRaw: string,
): WgslConversion {
  const glsl450 = rewriteFragmentToGlsl450(fragmentRaw, vertexRaw);
  try {
    const module = parseGlsl(glsl450, { stage: "fragment" });
    const info = validate(module);
    return { glsl450, wgslFragmentSrc: writeWgsl(module, info) };
  } catch (err) {
    const detail =
      err instanceof Error && "formatted" in err
        ? String((err as { formatted: unknown }).formatted)
        : String(err);
    throw new WgslConversionError(`naga rejected the shader: ${detail}`);
  }
}

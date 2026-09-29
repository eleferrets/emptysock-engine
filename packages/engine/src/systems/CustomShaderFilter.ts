// Custom GLSL post-process filter — the runtime counterpart to the IDE's
// ShaderEditor panel. A shader authored and previewed there is compiled
// through this exact class, so there is no separate "preview" shader
// contract that could drift from what the game actually runs.
//
// Uniform/attribute contract (matches PixiJS v8's own filter convention,
// the same one LightingFilter in LightingSystem.ts uses):
//   attributes: aPosition (vec2), aUV (vec2)
//   vertex uniforms: uProjectionMatrix, uWorldTransformMatrix, uTransformMatrix (mat3)
//   fragment: uTexture (sampler2D) — the filtered input, supplied by PixiJS
//   fragment: uTime (float) — seconds since the filter was created/reset,
//     updated every frame by whoever owns the filter (see setTime()).
//
// A "vertex" that a developer omits falls back to DEFAULT_CUSTOM_SHADER_VERTEX,
// which is exactly what the ShaderEditor panel's vertex tab starts from.

import { Filter, GlProgram, UniformGroup } from "pixi.js";
import {
  getGmlShader,
  getGmlShaderUniforms,
  getGmlShaderVersion,
  parseShaderUniforms,
  toFilterVertexSource,
  type ParsedShaderUniform,
} from "./ShaderRegistry.js";

/**
 * The default vertex stage, written against pixi's Filter vertex contract
 * (`aPosition` only, positioned via `uOutputFrame`/`uOutputTexture`, texture
 * coordinate from `uInputSize`) — a filter's quad has no `aUV` attribute and
 * no `uProjectionMatrix`/`uWorldTransformMatrix`, so a sprite-style vertex
 * stage fails pixi's geometry check at draw time ("geometry missing the aUV
 * attribute", found by real-GPU verification). Vertex sources that still use
 * the sprite-quad contract are adapted automatically, see `adaptVertex`.
 */
export const DEFAULT_CUSTOM_SHADER_VERTEX = /* glsl */ `
  in vec2 aPosition;
  out vec2 vUV;
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  void main() {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vUV = aPosition * (uOutputFrame.zw * uInputSize.zw);
  }
`;

export const DEFAULT_CUSTOM_SHADER_FRAGMENT = /* glsl */ `
  precision mediump float;
  in vec2 vUV;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;

  void main() {
    finalColor = texture(uTexture, vUV);
  }
`;

export interface CustomShaderOptions {
  /** Fragment shader source. Required — this is what the shader actually does. */
  fragmentSrc: string;
  /** Vertex shader source. Defaults to DEFAULT_CUSTOM_SHADER_VERTEX. */
  vertexSrc?: string;
  /**
   * Treat `vertexSrc` (or the default) as a sprite-quad MVP passthrough — the
   * shape the GMS2 importer emits, which is not pixi's Filter vertex contract
   * (`uProjectionMatrix`/`uWorldTransformMatrix`/`uTransformMatrix` are never
   * set for a filter, so the quad collapses) — and substitute pixi's own
   * filter position maths via `toFilterVertexSource`, keeping only its `out`
   * varyings. Set for importer-emitted shaders. When unset it is inferred:
   * a vertex source that does not mention `uOutputFrame` (i.e. is not already
   * written against the filter contract) is adapted the same way.
   */
  adaptVertex?: boolean;
  /** GlProgram name, useful for debugging in browser devtools. */
  name?: string;
  /** Extra user uniforms, declared up front (pixi needs each uniform's type when the Filter is built). */
  uniforms?: Record<string, { value: number | number[]; type: string }>;
}

/**
 * A user-authored post-process filter. Construct it from the same GLSL
 * source the ShaderEditor panel previews, attach it to a layer via
 * RenderSystem.addLayerShaderFilter(), and call setTime() once per frame
 * from the game loop if the shader reads uTime.
 */
export class CustomShaderFilter extends Filter {
  constructor(options: CustomShaderOptions) {
    const rawVertex = options.vertexSrc ?? DEFAULT_CUSTOM_SHADER_VERTEX;
    const adapt = options.adaptVertex ?? !rawVertex.includes("uOutputFrame");
    const program = GlProgram.from({
      vertex: adapt ? toFilterVertexSource(rawVertex) : rawVertex,
      fragment: options.fragmentSrc,
      name: options.name ?? "emptysock-custom-shader",
    });
    // The uniform structure must go through the Filter constructor so pixi
    // wraps it in a real UniformGroup; assigning a plain object to
    // `resources` afterwards is never uploaded (found by real-GPU
    // verification: every uniform read as 0 on the GPU).
    const group = new UniformGroup({
      uTime: { value: 0, type: "f32" },
      ...(options.uniforms ?? {}),
    });
    super({ glProgram: program, resources: { uniforms: group } });
    this._group = group;
  }

  private readonly _group: UniformGroup;

  /** Writes a uniform previously declared via `options.uniforms`; undeclared names are ignored. */
  setUniform(name: string, value: number | number[]): void {
    if (name in this._group.uniforms) this._group.uniforms[name] = value;
  }

  /** Updates the uTime uniform. Call once per frame from the game loop. */
  setTime(seconds: number): void {
    this._group.uniforms["uTime"] = seconds;
  }
}

export function createCustomShaderFilter(
  options: CustomShaderOptions,
): CustomShaderFilter {
  return new CustomShaderFilter(options);
}

/**
 * Builds a `CustomShaderFilter` for a shader registered via
 * `registerGmlShader` (what an importer-emitted `assets/<name>.shader.ts`
 * does at import time), with the vertex stage adapted to pixi's filter
 * contract and every fragment-declared scalar/vector uniform declared up
 * front. Used by both the per-entity path (`RenderPipeline.
 * resolveShaderFilter`) and the per-layer path (`RenderSystem.
 * addLayerGmlShader`), so the two can never disagree about how an importer
 * shader becomes a Filter. `undefined` when the id isn't registered.
 */
export function buildGmlShaderFilter(
  id: string,
): { filter: CustomShaderFilter; uniforms: ParsedShaderUniform[] } | undefined {
  const source = getGmlShader(id);
  if (source === undefined) return undefined;
  const uniforms = parseShaderUniforms(source.fragmentSrc);
  const declared: NonNullable<CustomShaderOptions["uniforms"]> = {};
  for (const u of uniforms) {
    declared[u.name] = {
      value: u.components === 1 ? 0 : new Array<number>(u.components).fill(0),
      type: u.type,
    };
  }
  const filter = new CustomShaderFilter({
    vertexSrc: source.vertexSrc,
    adaptVertex: true,
    fragmentSrc: source.fragmentSrc,
    name: id,
    uniforms: declared,
  });
  return { filter, uniforms };
}

/** Copies the registry's current `shader_set_uniform_*` values for `id` into `filter`. Returns the registry version applied. */
export function applyGmlShaderUniforms(
  filter: CustomShaderFilter,
  uniforms: ParsedShaderUniform[],
  id: string,
): number {
  const registration = getGmlShaderUniforms(id);
  if (registration !== undefined) {
    for (const u of uniforms) {
      const v = registration.get(u.name);
      if (v === undefined) continue;
      filter.setUniform(
        u.name,
        u.components === 1
          ? (v.values[0] ?? 0)
          : v.values.slice(0, u.components),
      );
    }
  }
  return getGmlShaderVersion(id);
}

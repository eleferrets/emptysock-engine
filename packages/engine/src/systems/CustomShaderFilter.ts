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

import { Filter, GlProgram } from "pixi.js";
import {
  getGmlShader,
  getGmlShaderUniforms,
  getGmlShaderVersion,
  parseShaderUniforms,
  toFilterVertexSource,
  type ParsedShaderUniform,
} from "./ShaderRegistry.js";

export const DEFAULT_CUSTOM_SHADER_VERTEX = /* glsl */ `
  in vec2 aPosition;
  in vec2 aUV;
  out vec2 vUV;
  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;

  void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
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
   * varyings. Set for importer-emitted shaders; leave unset for a vertex
   * stage already written against the filter contract.
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
    const program = GlProgram.from({
      vertex:
        options.adaptVertex === true
          ? toFilterVertexSource(
              options.vertexSrc ?? DEFAULT_CUSTOM_SHADER_VERTEX,
            )
          : (options.vertexSrc ?? DEFAULT_CUSTOM_SHADER_VERTEX),
      fragment: options.fragmentSrc,
      name: options.name ?? "emptysock-custom-shader",
    });
    super({ glProgram: program, resources: {} });
    this.resources["uniforms"] = {
      uTime: { value: 0, type: "f32" },
      ...(options.uniforms ?? {}),
    };
  }

  /** Writes a uniform previously declared via `options.uniforms`; undeclared names are ignored. */
  setUniform(name: string, value: number | number[]): void {
    const res = this.resources["uniforms"] as
      | Record<string, { value: unknown }>
      | undefined;
    const u = res?.[name];
    if (u) u.value = value;
  }

  /** Updates the uTime uniform. Call once per frame from the game loop. */
  setTime(seconds: number): void {
    const res = this.resources["uniforms"] as
      | Record<string, { value: unknown }>
      | undefined;
    const u = res?.["uTime"];
    if (u) u.value = seconds;
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

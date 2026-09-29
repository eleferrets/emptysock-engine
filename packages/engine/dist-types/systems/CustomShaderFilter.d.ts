import { Filter } from "pixi.js";
import { type ParsedShaderUniform } from "./ShaderRegistry.js";
export declare const DEFAULT_CUSTOM_SHADER_VERTEX =
  "\n  in vec2 aPosition;\n  in vec2 aUV;\n  out vec2 vUV;\n  uniform mat3 uProjectionMatrix;\n  uniform mat3 uWorldTransformMatrix;\n  uniform mat3 uTransformMatrix;\n\n  void main() {\n    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;\n    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);\n    vUV = aUV;\n  }\n";
export declare const DEFAULT_CUSTOM_SHADER_FRAGMENT =
  "\n  precision mediump float;\n  in vec2 vUV;\n  out vec4 finalColor;\n\n  uniform sampler2D uTexture;\n  uniform float uTime;\n\n  void main() {\n    finalColor = texture(uTexture, vUV);\n  }\n";
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
  uniforms?: Record<
    string,
    {
      value: number | number[];
      type: string;
    }
  >;
}
/**
 * A user-authored post-process filter. Construct it from the same GLSL
 * source the ShaderEditor panel previews, attach it to a layer via
 * RenderSystem.addLayerShaderFilter(), and call setTime() once per frame
 * from the game loop if the shader reads uTime.
 */
export declare class CustomShaderFilter extends Filter {
  constructor(options: CustomShaderOptions);
  /** Writes a uniform previously declared via `options.uniforms`; undeclared names are ignored. */
  setUniform(name: string, value: number | number[]): void;
  /** Updates the uTime uniform. Call once per frame from the game loop. */
  setTime(seconds: number): void;
}
export declare function createCustomShaderFilter(
  options: CustomShaderOptions,
): CustomShaderFilter;
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
export declare function buildGmlShaderFilter(id: string):
  | {
      filter: CustomShaderFilter;
      uniforms: ParsedShaderUniform[];
    }
  | undefined;
/** Copies the registry's current `shader_set_uniform_*` values for `id` into `filter`. Returns the registry version applied. */
export declare function applyGmlShaderUniforms(
  filter: CustomShaderFilter,
  uniforms: ParsedShaderUniform[],
  id: string,
): number;

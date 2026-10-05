import { Filter } from "pixi.js";
import { type ParsedShaderUniform } from "./ShaderRegistry.js";
/**
 * The default vertex stage, written against pixi's Filter vertex contract
 * (`aPosition` only, positioned via `uOutputFrame`/`uOutputTexture`, texture
 * coordinate from `uInputSize`) — a filter's quad has no `aUV` attribute and
 * no `uProjectionMatrix`/`uWorldTransformMatrix`, so a sprite-style vertex
 * stage fails pixi's geometry check at draw time ("geometry missing the aUV
 * attribute", found by real-GPU verification). Vertex sources that still use
 * the sprite-quad contract are adapted automatically, see `adaptVertex`.
 */
export declare const DEFAULT_CUSTOM_SHADER_VERTEX =
  "\n  in vec2 aPosition;\n  out vec2 vUV;\n  uniform vec4 uInputSize;\n  uniform vec4 uOutputFrame;\n  uniform vec4 uOutputTexture;\n\n  void main() {\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n    gl_Position = vec4(position, 0.0, 1.0);\n    vUV = aPosition * (uOutputFrame.zw * uInputSize.zw);\n  }\n";
export declare const DEFAULT_CUSTOM_SHADER_FRAGMENT =
  "\n  precision mediump float;\n  in vec2 vUV;\n  out vec4 finalColor;\n\n  uniform sampler2D uTexture;\n  uniform float uTime;\n\n  void main() {\n    finalColor = texture(uTexture, vUV);\n  }\n";
export interface CustomShaderOptions {
  /** Fragment shader source. Required — this is what the shader actually does. */
  fragmentSrc: string;
  /** Vertex shader source. Defaults to DEFAULT_CUSTOM_SHADER_VERTEX. */
  vertexSrc?: string;
  /**
   * Treat `vertexSrc` (or the default) as a sprite-quad MVP passthrough — the
   * shape the asset pipeline emits, which is not pixi's Filter vertex contract
   * (`uProjectionMatrix`/`uWorldTransformMatrix`/`uTransformMatrix` are never
   * set for a filter, so the quad collapses) — and substitute pixi's own
   * filter position maths via `toFilterVertexSource`, keeping only its `out`
   * varyings. Set for generated shaders. When unset it is inferred:
   * a vertex source that does not mention `uOutputFrame` (i.e. is not already
   * written against the filter contract) is adapted the same way.
   */
  adaptVertex?: boolean;
  /**
   * Optional WGSL fragment stage (entry point `main`), which makes the filter
   * usable under the WebGPU renderer. Without it the filter is GL-only and
   * renders nothing under WebGPU (RenderSystem warns once). Must follow the
   * pixi 8.21 filter contract: `@group(0) @binding(1/2)` `uTexture`/`uSampler`,
   * user uniforms as ONE block at `@group(1) @binding(0)` named `uniforms`
   * whose members are `uTime` followed by `options.uniforms` in key order
   * (the JS UniformGroup is laid out from that order), varyings at
   * `@location(n)` in the vertex stage's order. The asset pipeline generates it.
   */
  wgslFragment?: string;
  /** Optional WGSL vertex stage (entry point `mainVertex`). Defaults to `toFilterWgslVertexSource(vertexSrc)`. */
  wgslVertex?: string;
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
  /** The program name (registry id for generated shaders); used in diagnostics. */
  readonly shaderName: string;
  private readonly _group;
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
 * `registerShader` (what an generated `assets/<name>.shader.ts`
 * does at build time), with the vertex stage adapted to pixi's filter
 * contract and every fragment-declared scalar/vector uniform declared up
 * front. Used by both the per-entity path (`RenderPipeline.
 * resolveShaderFilter`) and the per-layer path (`RenderSystem.
 * addLayerShader`), so the two can never disagree about how an asset pipeline
 * shader becomes a Filter. `undefined` when the id isn't registered.
 */
export declare function buildShaderFilter(id: string):
  | {
      filter: CustomShaderFilter;
      uniforms: ParsedShaderUniform[];
    }
  | undefined;
/** Copies the registry's current `shader_set_uniform_*` values for `id` into `filter`. Returns the registry version applied. */
export declare function applyShaderUniforms(
  filter: CustomShaderFilter,
  uniforms: ParsedShaderUniform[],
  id: string,
): number;

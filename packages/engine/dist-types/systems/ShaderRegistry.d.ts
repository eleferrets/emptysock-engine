/**
 * Module-level registry of named GLSL shaders, keyed by the shader
 * resource name (`sh_white`). Same "register once, look up by string id"
 * shape as `FontRegistry`, but module-level rather than
 * a `Game` service because `shader_set(sh_white)` addresses shaders by
 * global asset name with no `Game` in reach of a bare compat call.
 *
 * Plain data only — no pixi import, so this file stays inside the engine
 * environment boundary. The live `Filter` is built lazily by `RenderPipeline`
 * (a pixi-allowlisted file) from the source stored here and cached one per
 * shader id, shared by every entity using that shader.
 *
 * Uniforms are per-shader-id, shared by every entity using that shader —
 * The uniforms are global-until-changed state on the currently
 * bound shader, not per-instance, so this matches it rather than approximating
 * it. A per-entity uniform value would need one Filter per entity.
 */
export interface ShaderSource {
  /** The translated (GLSL ES 3.00) vertex stage the asset pipeline emitted. Only its `out` varyings are read; see `toFilterVertexSource`. */
  vertexSrc: string;
  fragmentSrc: string;
  /**
   * Optional WGSL fragment stage (entry point `main`) the asset pipeline converted
   * from the GLSL one at build time. Present, the shader can also run under
   * the WebGPU renderer; absent, it is GL-only. Its bind layout and locations
   * follow pixi 8.21's filter contract, see `toFilterWgslVertexSource`.
   */
  wgslFragmentSrc?: string;
}
export type ShaderUniformKind = "f" | "i";
export interface ShaderUniformValue {
  kind: ShaderUniformKind;
  values: number[];
}
/** Registers (or replaces) a shader. CR/CRLF line endings are normalised to LF — a lone `\r` inside a `//` comment is not reliably a line end to every GLSL compiler. */
export declare function registerShader(id: string, source: ShaderSource): void;
export declare function unregisterShader(id: string): void;
export declare function hasShader(id: string): boolean;
export declare function getShader(id: string): ShaderSource | undefined;
export declare function shaderIds(): string[];
/** Test isolation. */
export declare function clearShaders(): void;
/** Writes one uniform on a registered shader; `false` (nothing written) for an unregistered id. */
export declare function setShaderUniform(
  id: string,
  name: string,
  kind: ShaderUniformKind,
  values: number[],
): boolean;
export declare function getShaderUniforms(
  id: string,
): ReadonlyMap<string, ShaderUniformValue> | undefined;
export declare function getShaderVersion(id: string): number;
export interface ParsedShaderUniform {
  name: string;
  /** pixi UniformGroup type string. */
  type: "f32" | "i32" | "vec2<f32>" | "vec3<f32>" | "vec4<f32>";
  components: number;
}
/**
 * Scans a fragment shader for user-declared scalar/vector uniforms
 * (`uniform float u_time;`). Samplers, matrices and the engine's own
 * `uTexture`/`uTime` are skipped: pixi needs each uniform's type declared up
 * front when the Filter is constructed, and `shader_set_uniform_f/_i`
 * only ever write scalars/vectors.
 */
export declare function parseShaderUniforms(
  fragmentSrc: string,
): ParsedShaderUniform[];
/**
 * Builds the vertex stage a pixi *Filter* needs from a translated
 * vertex shader. The asset pipeline's vertex stage is a sprite-quad MVP
 * passthrough (`uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix`),
 * which is not pixi's Filter contract (a filter's quad is positioned through
 * `uOutputFrame`/`uOutputTexture`/`uInputSize`, and those MVP matrices are
 * never set for a filter — that vertex would collapse the quad). Since the
 * asset pipeline only accepts the standard passthrough position transform, the
 * position half is safely replaced with pixi's own `filterVertexPosition`
 * maths and only the `out` varyings are carried over: texcoord-named
 * varyings take the filter's texture coordinate, everything else
 * (`v_vColour`) is `vec4(1.0)`, matching what the own vertex stage
 * assigns them.
 */
export declare function toFilterVertexSource(vertexSrc: string): string;
/**
 * The WGSL vertex stage that pairs with an generated WGSL fragment
 *: `gfu` global
 * filter uniforms at group 0 binding 0, `mainVertex(@location(0) aPosition)`,
 * pixi's `filterVertexPosition` maths, and one `@location(n)` output per
 * vertex-stage varying in declaration order (texcoord-named varyings carry
 * the filter texture coordinate, the rest are `vec4(1.0)`), mirroring
 * `toFilterVertexSource` for GLSL. Takes the translated GLSL ES 3.00 vertex
 * (`out` lines) the asset pipeline emits.
 */
export declare function toFilterWgslVertexSource(vertexSrc: string): string;

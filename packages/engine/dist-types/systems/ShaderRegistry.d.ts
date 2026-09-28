/**
 * Module-level registry of named GLSL shaders, keyed by the GameMaker shader
 * resource name (`sh_white`). Same "register once, look up by string id"
 * shape as `registerGmlBehavior`/`FontRegistry`, but module-level rather than
 * a `Game` service because GML's `shader_set(sh_white)` addresses shaders by
 * global asset name with no `Game` in reach of a bare compat call.
 *
 * Plain data only — no pixi import, so this file stays inside the engine
 * environment boundary. The live `Filter` is built lazily by `RenderPipeline`
 * (a pixi-allowlisted file) from the source stored here and cached one per
 * shader id, shared by every entity using that shader.
 *
 * Uniforms are per-shader-id, shared by every entity using that shader —
 * GameMaker's own uniforms are global-until-changed state on the currently
 * bound shader, not per-instance, so this matches it rather than approximating
 * it. A per-entity uniform value would need one Filter per entity.
 */
export interface GmlShaderSource {
  /** The translated (GLSL ES 3.00) vertex stage the importer emitted. Only its `out` varyings are read; see `toFilterVertexSource`. */
  vertexSrc: string;
  fragmentSrc: string;
}
export type GmlShaderUniformKind = "f" | "i";
export interface GmlShaderUniformValue {
  kind: GmlShaderUniformKind;
  values: number[];
}
/** Registers (or replaces) a shader. CR/CRLF line endings are normalised to LF — a lone `\r` inside a `//` comment is not reliably a line end to every GLSL compiler. */
export declare function registerGmlShader(
  id: string,
  source: GmlShaderSource,
): void;
export declare function unregisterGmlShader(id: string): void;
export declare function hasGmlShader(id: string): boolean;
export declare function getGmlShader(id: string): GmlShaderSource | undefined;
export declare function gmlShaderIds(): string[];
/** Test isolation. */
export declare function clearGmlShaders(): void;
/** Writes one uniform on a registered shader; `false` (nothing written) for an unregistered id. */
export declare function setGmlShaderUniform(
  id: string,
  name: string,
  kind: GmlShaderUniformKind,
  values: number[],
): boolean;
export declare function getGmlShaderUniforms(
  id: string,
): ReadonlyMap<string, GmlShaderUniformValue> | undefined;
export declare function getGmlShaderVersion(id: string): number;
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
 * front when the Filter is constructed, and GML's `shader_set_uniform_f/_i`
 * only ever write scalars/vectors.
 */
export declare function parseShaderUniforms(
  fragmentSrc: string,
): ParsedShaderUniform[];
/**
 * Builds the vertex stage a pixi *Filter* needs from a translated GMS2
 * vertex shader. The importer's vertex stage is a sprite-quad MVP
 * passthrough (`uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix`),
 * which is not pixi's Filter contract (a filter's quad is positioned through
 * `uOutputFrame`/`uOutputTexture`/`uInputSize`, and those MVP matrices are
 * never set for a filter — that vertex would collapse the quad). Since the
 * importer only accepts the standard passthrough position transform, the
 * position half is safely replaced with pixi's own `filterVertexPosition`
 * maths and only the `out` varyings are carried over: texcoord-named
 * varyings take the filter's texture coordinate, everything else
 * (`v_vColour`) is `vec4(1.0)`, matching what the importer's own vertex stage
 * assigns them.
 */
export declare function toFilterVertexSource(vertexSrc: string): string;

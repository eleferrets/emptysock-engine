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

interface ShaderEntry {
  source: ShaderSource;
  uniforms: Map<string, ShaderUniformValue>;
  /** Bumped by every uniform write / re-registration; `RenderPipeline` re-applies uniforms to its cached Filter only when this changed. */
  version: number;
}

const shaders = new Map<string, ShaderEntry>();

function normaliseNewlines(src: string): string {
  return src.replace(/\r\n?/g, "\n");
}

/** Registers (or replaces) a shader. CR/CRLF line endings are normalised to LF — a lone `\r` inside a `//` comment is not reliably a line end to every GLSL compiler. */
export function registerShader(id: string, source: ShaderSource): void {
  const prev = shaders.get(id);
  shaders.set(id, {
    source: {
      vertexSrc: normaliseNewlines(source.vertexSrc),
      fragmentSrc: normaliseNewlines(source.fragmentSrc),
      ...(source.wgslFragmentSrc !== undefined
        ? { wgslFragmentSrc: normaliseNewlines(source.wgslFragmentSrc) }
        : {}),
    },
    uniforms: new Map(),
    version: (prev?.version ?? 0) + 1,
  });
}

export function unregisterShader(id: string): void {
  shaders.delete(id);
}

export function hasShader(id: string): boolean {
  return shaders.has(id);
}

export function getShader(id: string): ShaderSource | undefined {
  return shaders.get(id)?.source;
}

export function shaderIds(): string[] {
  return Array.from(shaders.keys());
}

/** Test isolation. */
export function clearShaders(): void {
  shaders.clear();
}

/** Writes one uniform on a registered shader; `false` (nothing written) for an unregistered id. */
export function setShaderUniform(
  id: string,
  name: string,
  kind: ShaderUniformKind,
  values: number[],
): boolean {
  const entry = shaders.get(id);
  if (entry === undefined) return false;
  entry.uniforms.set(name, {
    kind,
    values: kind === "i" ? values.map((v) => Math.trunc(v)) : values.slice(),
  });
  entry.version++;
  return true;
}

export function getShaderUniforms(
  id: string,
): ReadonlyMap<string, ShaderUniformValue> | undefined {
  return shaders.get(id)?.uniforms;
}

export function getShaderVersion(id: string): number {
  return shaders.get(id)?.version ?? 0;
}

export interface ParsedShaderUniform {
  name: string;
  /** pixi UniformGroup type string. */
  type: "f32" | "i32" | "vec2<f32>" | "vec3<f32>" | "vec4<f32>";
  components: number;
}

const UNIFORM_TYPES: Record<string, ParsedShaderUniform["type"]> = {
  float: "f32",
  int: "i32",
  vec2: "vec2<f32>",
  vec3: "vec3<f32>",
  vec4: "vec4<f32>",
};

/**
 * Scans a fragment shader for user-declared scalar/vector uniforms
 * (`uniform float u_time;`). Samplers, matrices and the engine's own
 * `uTexture`/`uTime` are skipped: pixi needs each uniform's type declared up
 * front when the Filter is constructed, and `shader_set_uniform_f/_i`
 * only ever write scalars/vectors.
 */
export function parseShaderUniforms(
  fragmentSrc: string,
): ParsedShaderUniform[] {
  const out: ParsedShaderUniform[] = [];
  const re =
    /^\s*uniform\s+(?:(?:lowp|mediump|highp)\s+)?(float|int|vec[234])\s+(\w+)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragmentSrc)) !== null) {
    const name = m[2] as string;
    if (name === "uTime") continue;
    const glType = m[1] as string;
    out.push({
      name,
      type: UNIFORM_TYPES[glType] as ParsedShaderUniform["type"],
      components:
        glType === "float" || glType === "int" ? 1 : Number(glType.slice(3)),
    });
  }
  return out;
}

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
export function toFilterVertexSource(vertexSrc: string): string {
  const varyings: Array<{ type: string; name: string }> = [];
  const re = /^\s*out\s+(\w+)\s+(\w+)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(vertexSrc)) !== null) {
    varyings.push({ type: m[1] as string, name: m[2] as string });
  }
  const decls = varyings.map((v) => `out ${v.type} ${v.name};`).join("\n");
  const assigns = varyings
    .map((v) =>
      /texcoord|uv/i.test(v.name)
        ? `  ${v.name} = aPosition * (uOutputFrame.zw * uInputSize.zw);`
        : `  ${v.name} = vec4(1.0);`,
    )
    .join("\n");
  return `in vec2 aPosition;
${decls}
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
${assigns}
}
`;
}

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
export function toFilterWgslVertexSource(vertexSrc: string): string {
  const varyings: Array<{ type: string; name: string }> = [];
  const re = /^\s*out\s+(\w+)\s+(\w+)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(vertexSrc)) !== null) {
    varyings.push({ type: m[1] as string, name: m[2] as string });
  }
  const wgslType = (t: string): string =>
    /^vec[234]$/.test(t) ? `${t}<f32>` : "f32";
  const fields = varyings
    .map((v, i) => `  @location(${i}) ${v.name}: ${wgslType(v.type)},`)
    .join("\n");
  const values = varyings
    .map((v) => {
      if (/texcoord|uv/i.test(v.name)) return "uv";
      const t = wgslType(v.type);
      return t === "f32" ? "1.0" : `${t}(1.0)`;
    })
    .join(", ");
  return `struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
${fields}
};

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  let uv = aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
  return VSOutput(vec4<f32>(position, 0.0, 1.0)${values ? `, ${values}` : ""});
}
`;
}

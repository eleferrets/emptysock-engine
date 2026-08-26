import { Filter, GlProgram, type Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Light types
// ---------------------------------------------------------------------------

export type LightType = 'point' | 'directional' | 'spot' | 'ambient';

export interface Light {
  readonly id: string;
  readonly type: LightType;
  colour: number;      // 0xRRGGBB
  intensity: number;   // 0..1+
  radius?: number;     // point/spot: falloff radius in world pixels
  angle?: number;      // spot: cone half-angle in radians
  direction?: { x: number; y: number }; // directional: world-space direction
  castShadows: boolean;
  /** World-space position for point/spot lights (updated each frame) */
  x?: number;
  y?: number;
}

// ---------------------------------------------------------------------------
// GLSL shaders
// ---------------------------------------------------------------------------

// Max lights in a single draw call — matches uniform arrays below
const MAX_POINT_LIGHTS = 16;

const VERT_SRC = /* glsl */`
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

const FRAG_SRC = /* glsl */`
  precision mediump float;
  in vec2 vUV;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform sampler2D uNormalMap;
  uniform int uUseNormalMap;

  // Ambient
  uniform vec3 uAmbientColour;
  uniform float uAmbientIntensity;

  // Directional
  uniform int uDirCount;
  uniform vec3 uDirColour[4];
  uniform float uDirIntensity[4];
  uniform vec2 uDirDirection[4]; // normalised XY

  // Point lights
  uniform int uPointCount;
  uniform vec3 uPointColour[${MAX_POINT_LIGHTS}];
  uniform float uPointIntensity[${MAX_POINT_LIGHTS}];
  uniform vec2 uPointPos[${MAX_POINT_LIGHTS}];   // screen-space 0..1
  uniform float uPointRadius[${MAX_POINT_LIGHTS}];

  // Input texture size for normal map
  uniform vec2 uTextureSize;

  vec3 hexToRGB(vec3 c) { return c; }

  void main() {
    vec4 texel = texture(uTexture, vUV);
    if (texel.a == 0.0) discard;

    // Normal from normal map or flat up
    vec3 normal = vec3(0.0, 0.0, 1.0);
    if (uUseNormalMap == 1) {
      vec4 nm = texture(uNormalMap, vUV);
      normal = normalize(nm.rgb * 2.0 - 1.0);
    }

    // Ambient
    vec3 light = uAmbientColour * uAmbientIntensity;

    // Directional lights
    for (int i = 0; i < 4; i++) {
      if (i >= uDirCount) break;
      vec3 L = normalize(vec3(uDirDirection[i], 1.0));
      float diff = max(dot(normal, L), 0.0);
      light += uDirColour[i] * uDirIntensity[i] * diff;
    }

    // Point lights
    for (int i = 0; i < ${MAX_POINT_LIGHTS}; i++) {
      if (i >= uPointCount) break;
      vec2 delta = uPointPos[i] - vUV;
      delta.x *= uTextureSize.x / uTextureSize.y; // aspect correction
      float dist = length(delta);
      float r = uPointRadius[i];
      if (r <= 0.0) continue;
      float attenuation = clamp(1.0 - (dist / r), 0.0, 1.0);
      attenuation *= attenuation; // quadratic falloff
      vec3 L = normalize(vec3(delta, 0.3));
      float diff = max(dot(normal, L), 0.0);
      light += uPointColour[i] * uPointIntensity[i] * attenuation * (uUseNormalMap == 1 ? diff : 1.0);
    }

    finalColor = vec4(texel.rgb * light, texel.a);
  }
`;

// ---------------------------------------------------------------------------
// LightingFilter — wraps the GLSL as a PixiJS v8 Filter
// ---------------------------------------------------------------------------

export class LightingFilter extends Filter {
  constructor() {
    const program = GlProgram.from({ vertex: VERT_SRC, fragment: FRAG_SRC, name: 'emptysock-lighting' });
    super({ glProgram: program, resources: {} });

    // Set safe defaults
    this.resources['uniforms'] = {
      uAmbientColour: { value: [1, 1, 1], type: 'vec3<f32>' },
      uAmbientIntensity: { value: 0.2, type: 'f32' },
      uDirCount: { value: 0, type: 'i32' },
      uDirColour: { value: new Float32Array(12), type: 'vec3<f32>', size: 4 },
      uDirIntensity: { value: new Float32Array(4), type: 'f32', size: 4 },
      uDirDirection: { value: new Float32Array(8), type: 'vec2<f32>', size: 4 },
      uPointCount: { value: 0, type: 'i32' },
      uPointColour: { value: new Float32Array(MAX_POINT_LIGHTS * 3), type: 'vec3<f32>', size: MAX_POINT_LIGHTS },
      uPointIntensity: { value: new Float32Array(MAX_POINT_LIGHTS), type: 'f32', size: MAX_POINT_LIGHTS },
      uPointPos: { value: new Float32Array(MAX_POINT_LIGHTS * 2), type: 'vec2<f32>', size: MAX_POINT_LIGHTS },
      uPointRadius: { value: new Float32Array(MAX_POINT_LIGHTS), type: 'f32', size: MAX_POINT_LIGHTS },
      uUseNormalMap: { value: 0, type: 'i32' },
      uTextureSize: { value: [1280, 720], type: 'vec2<f32>' },
    };
  }
}

// ---------------------------------------------------------------------------
// LightingSystem
// ---------------------------------------------------------------------------

export class LightingSystem {
  public readonly lights: Map<string, Light> = new Map();
  private _ambientColour: number = 0xffffff;
  private _ambientIntensity: number = 0.2;
  private _filter: LightingFilter | null = null;
  private _stage: Container | null = null;
  private _useNormalMap: boolean = false;

  // ---------------------------------------------------------------------------
  // Light registry
  // ---------------------------------------------------------------------------

  addLight(config: Light): void {
    this.lights.set(config.id, { ...config });
  }

  removeLight(id: string): boolean {
    return this.lights.delete(id);
  }

  setAmbient(colour: number, intensity: number): void {
    this._ambientColour = colour;
    this._ambientIntensity = intensity;
  }

  get ambientColour(): number { return this._ambientColour; }
  get ambientIntensity(): number { return this._ambientIntensity; }

  // ---------------------------------------------------------------------------
  // GPU filter attachment
  // ---------------------------------------------------------------------------

  /**
   * Attach the GPU lighting filter to a PixiJS container (typically the scene stage).
   * This replaces the previous registry-only placeholder with real GPU rendering.
   */
  attachFilter(stage: Container, useNormalMap = false): void {
    this._filter = new LightingFilter();
    this._useNormalMap = useNormalMap;
    this._stage = stage;
    stage.filters = [...(stage.filters ?? []), this._filter];
  }

  detachFilter(): void {
    if (this._stage !== null && this._filter !== null) {
      this._stage.filters = (this._stage.filters ?? []).filter(f => f !== this._filter);
    }
    this._filter = null;
    this._stage = null;
  }

  // ---------------------------------------------------------------------------
  // Per-frame update — uploads light data to GPU uniforms
  // ---------------------------------------------------------------------------

  update(_dt: number): void {
    const f = this._filter;
    if (f === null) return;

    const res = f.resources['uniforms'] as Record<string, { value: unknown }>;
    if (res === undefined) return;

    // Ambient
    res['uAmbientColour']!.value = hexToVec3(this._ambientColour);
    res['uAmbientIntensity']!.value = this._ambientIntensity;
    res['uUseNormalMap']!.value = this._useNormalMap ? 1 : 0;

    // Partition lights
    const pointLights = [...this.lights.values()].filter(l => l.type === 'point');
    const dirLights = [...this.lights.values()].filter(l => l.type === 'directional');

    // Point lights
    const pc = Math.min(pointLights.length, MAX_POINT_LIGHTS);
    res['uPointCount']!.value = pc;
    const pColour = new Float32Array(MAX_POINT_LIGHTS * 3);
    const pIntensity = new Float32Array(MAX_POINT_LIGHTS);
    const pPos = new Float32Array(MAX_POINT_LIGHTS * 2);
    const pRadius = new Float32Array(MAX_POINT_LIGHTS);
    for (let i = 0; i < pc; i++) {
      const l = pointLights[i]!;
      const rgb = hexToVec3(l.colour);
      pColour[i * 3] = rgb[0]!;
      pColour[i * 3 + 1] = rgb[1]!;
      pColour[i * 3 + 2] = rgb[2]!;
      pIntensity[i] = l.intensity;
      // Normalise world position to 0..1 UV space assuming 1280x720
      pPos[i * 2] = (l.x ?? 0) / 1280;
      pPos[i * 2 + 1] = (l.y ?? 0) / 720;
      pRadius[i] = (l.radius ?? 200) / 1280;
    }
    res['uPointColour']!.value = pColour;
    res['uPointIntensity']!.value = pIntensity;
    res['uPointPos']!.value = pPos;
    res['uPointRadius']!.value = pRadius;

    // Directional lights
    const dc = Math.min(dirLights.length, 4);
    res['uDirCount']!.value = dc;
    const dColour = new Float32Array(12);
    const dIntensity = new Float32Array(4);
    const dDir = new Float32Array(8);
    for (let i = 0; i < dc; i++) {
      const l = dirLights[i]!;
      const rgb = hexToVec3(l.colour);
      dColour[i * 3] = rgb[0]!;
      dColour[i * 3 + 1] = rgb[1]!;
      dColour[i * 3 + 2] = rgb[2]!;
      dIntensity[i] = l.intensity;
      const dir = l.direction ?? { x: 0, y: -1 };
      dDir[i * 2] = dir.x;
      dDir[i * 2 + 1] = dir.y;
    }
    res['uDirColour']!.value = dColour;
    res['uDirIntensity']!.value = dIntensity;
    res['uDirDirection']!.value = dDir;
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function hexToVec3(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

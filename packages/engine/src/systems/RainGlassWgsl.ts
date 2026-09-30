// WGSL port of the rain glass fragment shader (RAIN_GLASS_FRAGMENT in
// RainGlassFilter.ts), so the filter also runs under pixi's WebGPU renderer.
// Plain strings only, no pixi import.
//
// Follows pixi 8.21's WebGPU filter contract (docs/research/11-glsl-to-wgsl.md,
// "Verified against pixi 8.21 source"):
//   group 0: binding 0 `gfu` global filter uniforms (declared by the vertex
//            stage), binding 1 `uTexture`, binding 2 `uSampler` (filter input)
//   group 1: binding 0 `uniforms` (RainUniforms), 1 `uDropMap`, 2 `uDropMapSampler`
//            (resource names must equal the keys of the Filter's `resources`)
// `RainUniforms` member order and types MUST match the JS UniformGroup in
// RainGlassFilter's constructor (pixi lays the UBO out from the JS side).
//
// NOT run on a real GPU yet (only validated by naga + wgsl_reflect in the
// toolchain tests); see gpu_followup_real_browser.md.

/** Same vertex maths as pixi's own filters, one `vUV` varying at location 0. */
export const RAIN_GLASS_WGSL_VERTEX = /* wgsl */ `struct GlobalFilterUniforms {
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
  @location(0) vUV: vec2<f32>,
};

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  let vUV = aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
  return VSOutput(vec4<f32>(position, 0.0, 1.0), vUV);
}
`;

export const RAIN_GLASS_WGSL_FRAGMENT = /* wgsl */ `struct RainUniforms {
  uTime: f32,
  uIntensity: f32,
  uDropletSize: f32,
  uDropletSpeed: f32,
  uStreakAmount: f32,
  uResolution: vec2<f32>,
  uFog: f32,
  uBlur: f32,
  uRefract: f32,
  uTaps: f32,
  uChroma: f32,
  uTint: vec3<f32>,
  uLightDir: vec2<f32>,
};

@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;

@group(1) @binding(0) var<uniform> uniforms: RainUniforms;
@group(1) @binding(1) var uDropMap: texture_2d<f32>;
@group(1) @binding(2) var uDropMapSampler: sampler;

const MAX_TAPS: i32 = 8;

fn ign(p: vec2<f32>) -> f32 {
  return fract(52.9829189 * fract(dot(p, vec2<f32>(0.06711056, 0.00583715))));
}

// Golden-angle disc blur, rotated per pixel; uTaps <= MAX_TAPS.
// Level-0 sampling (textureSampleLevel) keeps it legal in non-uniform control flow.
fn fogBlur(uv: vec2<f32>, px: f32, texel: vec2<f32>, fragXY: vec2<f32>) -> vec3<f32> {
  var acc = vec3<f32>(0.0);
  let n = 6.2831853 * ign(fragXY);
  let taps = i32(uniforms.uTaps);
  for (var i: i32 = 0; i < MAX_TAPS; i = i + 1) {
    if (i >= taps) {
      break;
    }
    let a = f32(i) * 2.39996 + n;
    let r = sqrt((f32(i) + 0.5) / f32(taps)) * px;
    acc = acc + textureSampleLevel(uTexture, uSampler, uv + vec2<f32>(cos(a), sin(a)) * r * texel, 0.0).rgb;
  }
  return acc / f32(max(taps, 1));
}

@fragment
fn mainFragment(
  @location(0) vUV: vec2<f32>,
  @builtin(position) fragCoord: vec4<f32>
) -> @location(0) vec4<f32> {
  let zero2 = vec2<f32>(0.0);
  let one2 = vec2<f32>(1.0);
  let m = textureSampleLevel(uDropMap, uDropMapSampler, vUV, 0.0);
  let n = (m.rg * 255.0 - 128.0) / 127.0;
  let h = m.b;
  let wet = m.a;
  let body = smoothstep(0.2, 0.5, h);
  let film = smoothstep(0.02, 0.2, h) * (1.0 - body);
  let rim = smoothstep(0.3, 0.9, length(n)) * body;
  let off = n * uniforms.uRefract * (0.25 + body) + n * film * uniforms.uRefract * 0.5;
  let uv = clamp(vUV - off, zero2, one2);
  let base = textureSampleLevel(uTexture, uSampler, uv, 0.0);
  var col = base.rgb;
  if (uniforms.uChroma > 0.5) {
    col.r = textureSampleLevel(uTexture, uSampler, clamp(uv + off * 0.25, zero2, one2), 0.0).r;
    col.b = textureSampleLevel(uTexture, uSampler, clamp(uv - off * 0.25, zero2, one2), 0.0).b;
  }
  let fogHere = uniforms.uFog * (1.0 - wet);
  if (fogHere > 0.001 && uniforms.uTaps > 0.5) {
    let b = fogBlur(uv, uniforms.uBlur * fogHere, 1.0 / uniforms.uResolution, fragCoord.xy);
    col = mix(col, b, smoothstep(0.0, 0.2, fogHere));
  }
  col = mix(col, uniforms.uTint, fogHere * 0.25);
  let nn = normalize(vec3<f32>(n, 0.6));
  let spec = pow(max(dot(nn, normalize(vec3<f32>(uniforms.uLightDir, 0.7))), 0.0), 20.0);
  let glint = pow(max(dot(nn, normalize(vec3<f32>(-uniforms.uLightDir, 0.5))), 0.0), 40.0);
  col = col * (1.0 - 0.5 * rim - 0.08 * film);
  col = col + (spec * 1.1 + glint * 0.35) * body + rim * 0.10 * uniforms.uTint + body * 0.025 * uniforms.uTint;
  return vec4<f32>(col, base.a);
}
`;

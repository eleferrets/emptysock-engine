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
  /** GlProgram name, useful for debugging in browser devtools. */
  name?: string;
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
      vertex: options.vertexSrc ?? DEFAULT_CUSTOM_SHADER_VERTEX,
      fragment: options.fragmentSrc,
      name: options.name ?? "emptysock-custom-shader",
    });
    super({ glProgram: program, resources: {} });
    this.resources["uniforms"] = {
      uTime: { value: 0, type: "f32" },
    };
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

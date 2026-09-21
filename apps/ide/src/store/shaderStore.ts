import { create } from "zustand";

// ── Initial data ─────────────────────────────────────────────────────────────
// Both shaders use the exact uniform/attribute contract CustomShaderFilter
// (packages/engine/src/systems/CustomShaderFilter.ts) expects at runtime:
// aPosition/aUV attributes, uProjectionMatrix/uWorldTransformMatrix/
// uTransformMatrix, uTexture, uTime. See ShaderEditor.tsx.

export const VERTEX_PLACEHOLDER = `in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

export const FRAGMENT_PLACEHOLDER = `precision mediump float;
in vec2 vUV;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec2 uv = vUV;
  // Example: chromatic aberration
  float offset = 0.003 * sin(uTime * 2.0);
  float r = texture(uTexture, uv + vec2(offset, 0.0)).r;
  float g = texture(uTexture, uv).g;
  float b = texture(uTexture, uv - vec2(offset, 0.0)).b;
  finalColor = vec4(r, g, b, 1.0);
}`;

export interface ShaderState {
  vertSrc: string;
  fragSrc: string;
}

interface ShaderStoreState {
  shader: ShaderState;
  setShader: (shader: ShaderState) => void;
  resetShaderStore: () => void;
}

export const useShaderStore = create<ShaderStoreState>((set) => ({
  shader: { vertSrc: VERTEX_PLACEHOLDER, fragSrc: FRAGMENT_PLACEHOLDER },
  setShader: (shader) => set({ shader }),
  resetShaderStore: () =>
    set({
      shader: { vertSrc: VERTEX_PLACEHOLDER, fragSrc: FRAGMENT_PLACEHOLDER },
    }),
}));

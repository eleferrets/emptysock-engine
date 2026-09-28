import { Filter } from "pixi.js";
export declare const DEFAULT_CUSTOM_SHADER_VERTEX =
  "\n  in vec2 aPosition;\n  in vec2 aUV;\n  out vec2 vUV;\n  uniform mat3 uProjectionMatrix;\n  uniform mat3 uWorldTransformMatrix;\n  uniform mat3 uTransformMatrix;\n\n  void main() {\n    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;\n    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);\n    vUV = aUV;\n  }\n";
export declare const DEFAULT_CUSTOM_SHADER_FRAGMENT =
  "\n  precision mediump float;\n  in vec2 vUV;\n  out vec4 finalColor;\n\n  uniform sampler2D uTexture;\n  uniform float uTime;\n\n  void main() {\n    finalColor = texture(uTexture, vUV);\n  }\n";
export interface CustomShaderOptions {
  /** Fragment shader source. Required — this is what the shader actually does. */
  fragmentSrc: string;
  /** Vertex shader source. Defaults to DEFAULT_CUSTOM_SHADER_VERTEX. */
  vertexSrc?: string;
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
  /** Updates the uTime uniform. Call once per frame from the game loop. */
  setTime(seconds: number): void;
  /** Writes a uniform previously declared via `options.uniforms`; undeclared names are ignored. */
  setUniform(name: string, value: number | number[]): void;
}
export declare function createCustomShaderFilter(
  options: CustomShaderOptions,
): CustomShaderFilter;

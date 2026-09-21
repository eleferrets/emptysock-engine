# CustomShaderFilter

`packages/engine/src/systems/CustomShaderFilter.ts`

A user-authored GLSL post-process filter, and the runtime counterpart to the IDE's **ShaderEditor** panel. A shader written and previewed there compiles through this exact class, so the panel's preview and a game's actual render use one shader-compile path, not two.

## Uniform / attribute contract

- Attributes: `aPosition` (vec2), `aUV` (vec2)
- Vertex uniforms: `uProjectionMatrix`, `uWorldTransformMatrix`, `uTransformMatrix` (mat3) — standard PixiJS v8 filter uniforms, the same ones `LightingFilter` in `LightingSystem.ts` uses
- Fragment: `uTexture` (sampler2D) — the filtered input
- Fragment: `uTime` (float) — seconds; update it yourself via `setTime()`

Shaders are GLSL ES 3.00 style (`in`/`out`, not `attribute`/`varying`; `texture()`, not `texture2D()`).

## API

```typescript
import { createCustomShaderFilter } from "@emptysock/engine";

const filter = createCustomShaderFilter({
  fragmentSrc: `
    precision mediump float;
    in vec2 vUV;
    out vec4 finalColor;
    uniform sampler2D uTexture;
    uniform float uTime;
    void main() {
      finalColor = texture(uTexture, vUV + vec2(sin(uTime) * 0.01, 0.0));
    }
  `,
  // vertexSrc?: string — defaults to DEFAULT_CUSTOM_SHADER_VERTEX
});

// Attach to a layer:
renderSystem.addLayerShaderFilter("default", filter);

// Per frame, if the shader reads uTime:
filter.setTime(elapsedSeconds);

// Detach:
renderSystem.removeLayerShaderFilter("default", filter);
```

`RenderSystem.addLayerShaderFilter()`/`removeLayerShaderFilter()` attach/detach a `Filter` on a layer's PixiJS container (see `RenderSystem.ts`).

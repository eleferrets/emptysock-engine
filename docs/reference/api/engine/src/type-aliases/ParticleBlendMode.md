[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ParticleBlendMode

# Type Alias: ParticleBlendMode

> **ParticleBlendMode** = `"normal"` \| `"add"`

Defined in: engine/src/systems/ParticleSystem.ts:42

Renderer-agnostic blend mode, mirroring `part_type_blend`
(`pt_blend_normal` / `pt_blend_add`, called via `bm_normal`/`bm_add`
equivalents elsewhere). `ParticleEmitter` itself never touches
pixi — this is a plain string tag a render layer (`RenderPipeline`'s
`mountParticles()`) reads and translates into a real pixi `BLEND_MODES`
value on the mounted `ParticleContainer`, the same "engine defines the
shape, the render layer applies it" split every other emitter field
already follows.

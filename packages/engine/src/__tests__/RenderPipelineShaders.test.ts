import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";
import { Texture } from "pixi.js";

vi.mock("pixi.js", async () => {
  const actual = await vi.importActual<typeof PixiJS>("pixi.js");
  return {
    ...actual,
    autoDetectRenderer: vi.fn(() =>
      Promise.resolve({
        canvas: {},
        render: vi.fn(),
        resize: vi.fn(),
        destroy: vi.fn(),
      }),
    ),
  };
});

const { RenderPipeline } = await import("../systems/RenderPipeline.js");
const { Scene } = await import("../Scene.js");
const { Transform } = await import("../components/Transform.js");
const { Sprite } = await import("../components/Sprite.js");
const { GmlBehaviorState, registerGmlBehavior } =
  await import("../components/GmlBehavior.js");
const { GmlBehaviorSystem } = await import("../systems/GmlBehaviorSystem.js");
const { registerGmlShader, clearGmlShaders, setGmlShaderUniform } =
  await import("../systems/ShaderRegistry.js");
const { shader_set, shader_reset, shader_set_uniform_f } =
  await import("../compat/gmlShaders.js");

const FRAG = `precision mediump float;
in vec2 v_vTexcoord;
in vec4 v_vColour;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float u_amount;
void main() { finalColor = texture(uTexture, v_vTexcoord) * u_amount; }
`;
const VERT =
  "in vec2 aPosition;\nout vec2 v_vTexcoord;\nout vec4 v_vColour;\nvoid main(){}\n";

type Tracked = { filters: readonly unknown[] | null | undefined };

describe("RenderPipeline per-entity shader filters", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;

  const sprites = (): Map<number, Tracked> =>
    (
      pipeline as unknown as {
        _tracking: Map<unknown, { sprites: Map<number, Tracked> }>;
      }
    )._tracking.get(scene)?.sprites ?? new Map();

  beforeEach(async () => {
    clearGmlShaders();
    registerGmlShader("sh_white", { vertexSrc: VERT, fragmentSrc: FRAG });
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(Texture.WHITE)),
    });
    await pipeline.init();
    scene = new Scene();
  });

  it("attaches one shared filter to every entity naming the shader, and clears it when unset", () => {
    const a = scene.spawn();
    a.add(Transform);
    a.add(Sprite, { shader: "sh_white" });
    const b = scene.spawn();
    b.add(Transform);
    b.add(Sprite, { shader: "sh_white" });
    const plain = scene.spawn();
    plain.add(Transform);
    plain.add(Sprite);

    pipeline.syncEntities(scene);
    const fa = sprites().get(a.eid)?.filters;
    expect(fa).toHaveLength(1);
    expect(sprites().get(b.eid)?.filters?.[0]).toBe(fa?.[0]); // same instance
    expect(fa?.[0]).toBe(pipeline.resolveShaderFilter("sh_white"));
    expect(sprites().get(plain.eid)?.filters ?? []).toHaveLength(0);

    // steady state: no reallocation of the filters array
    pipeline.syncEntities(scene);
    expect(sprites().get(a.eid)?.filters).toBe(fa);

    const sa = a.get(Sprite);
    if (sa) sa.shader = "";
    pipeline.syncEntities(scene);
    expect(sprites().get(a.eid)?.filters ?? []).toHaveLength(0);
    expect(sprites().get(b.eid)?.filters).toHaveLength(1);
  });

  it("leaves an unregistered shader id unfiltered instead of throwing", () => {
    const e = scene.spawn();
    e.add(Transform);
    e.add(Sprite, { shader: "sh_missing" });
    expect(() => pipeline.syncEntities(scene)).not.toThrow();
    expect(sprites().get(e.eid)?.filters ?? []).toHaveLength(0);
  });

  it("builds the filter with a filter-compatible vertex stage and declared user uniforms", () => {
    const f = pipeline.resolveShaderFilter("sh_white") as unknown as {
      resources: {
        uniforms: {
          uniformStructures: Record<string, { type: string }>;
          uniforms: Record<string, unknown>;
        };
      };
    };
    expect(f.resources.uniforms.uniformStructures["u_amount"]?.type).toBe(
      "f32",
    );
    expect(pipeline.resolveShaderFilter("sh_white")).toBe(
      pipeline.resolveShaderFilter("sh_white"),
    );
  });

  it("copies registry uniform writes into the shared filter only when they change", () => {
    const f = pipeline.resolveShaderFilter("sh_white") as unknown as {
      resources: { uniforms: { uniforms: Record<string, unknown> } };
    };
    setGmlShaderUniform("sh_white", "u_amount", "f", [0.25]);
    pipeline.resolveShaderFilter("sh_white");
    expect(f.resources.uniforms.uniforms["u_amount"]).toBe(0.25);
  });

  it("re-registering a shader rebuilds its filter", () => {
    const first = pipeline.resolveShaderFilter("sh_white");
    registerGmlShader("sh_white", { vertexSrc: VERT, fragmentSrc: FRAG });
    expect(pipeline.resolveShaderFilter("sh_white")).not.toBe(first);
  });

  it("obj_pShootable's shader_set(sh_white); draw_self(); shader_reset() shape filters only the drawn sprite", () => {
    registerGmlBehavior("shootable", {
      onDraw: (entity, ctx) => {
        ctx.drawTarget?.sprite("a.png", 1, 2);
        shader_set(entity, ctx, "sh_white");
        shader_set_uniform_f(entity, ctx, "u_amount", 1);
        ctx.drawTarget?.sprite("b.png", 1, 2);
        shader_reset(entity, ctx);
        ctx.drawTarget?.sprite("c.png", 1, 2);
      },
    });
    const e = scene.spawn();
    e.add(Transform);
    e.add(Sprite);
    e.add(GmlBehaviorState, { behaviorId: "shootable" });
    pipeline.attachGmlBehaviors(new GmlBehaviorSystem(), { scene } as never);
    pipeline.renderFrame(scene);

    const g = (
      pipeline as unknown as {
        _gmlDrawGraphics: Map<number, { children: Tracked[] }>;
      }
    )._gmlDrawGraphics.get(e.eid);
    const kids = g?.children ?? [];
    expect(kids).toHaveLength(3);
    expect(kids[0]?.filters ?? []).toHaveLength(0);
    expect(kids[1]?.filters?.[0]).toBe(
      pipeline.resolveShaderFilter("sh_white"),
    );
    expect(kids[2]?.filters ?? []).toHaveLength(0);
    // the tint-white approximation is gone: nothing touched Sprite.tint/shader
    expect(e.get(Sprite)?.tint).toBe(0xffffff);
    expect(e.get(Sprite)?.shader).toBe("");
  });
});

describe("per-layer importer shader (RenderSystem.addLayerGmlShader)", () => {
  type LayerRender = {
    _render: {
      addLayerGmlShader: (layer: string, id: string) => unknown;
      removeLayerShaderFilter: (layer: string, f: unknown) => void;
      getLayerContainer: (layer: string) => {
        filters: readonly {
          glProgram: { vertex: string };
          resources: { uniforms: Record<string, { value: unknown }> };
        }[];
      };
      syncLayerGmlShaders: () => void;
    };
  };
  let render: LayerRender["_render"];

  beforeEach(async () => {
    clearGmlShaders();
    registerGmlShader("sh_white", {
      vertexSrc:
        "in vec2 aPosition;\nout vec2 v_vTexcoord;\nout vec4 v_vColour;\nuniform mat3 uProjectionMatrix;\nvoid main(){}\n",
      fragmentSrc: FRAG,
    });
    const pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(Texture.WHITE)),
    });
    await pipeline.init();
    render = (pipeline as unknown as LayerRender)._render;
  });

  it("attaches a filter with the filter-compatible vertex stage to the layer container", () => {
    const f = render.addLayerGmlShader("default", "sh_white");
    expect(f).toBeDefined();
    const filters = render.getLayerContainer("default").filters;
    expect(filters).toHaveLength(1);
    expect(filters[0]?.glProgram.vertex).toContain("uOutputFrame");
    expect(filters[0]?.glProgram.vertex).not.toContain("uProjectionMatrix");
  });

  it("returns undefined and attaches nothing for an unregistered id", () => {
    expect(render.addLayerGmlShader("default", "sh_missing")).toBeUndefined();
    expect(
      (render.getLayerContainer("default").filters as
        | readonly unknown[]
        | undefined) ?? [],
    ).toHaveLength(0);
  });

  it("syncs later uniform writes and can be detached", () => {
    const f = render.addLayerGmlShader("default", "sh_white");
    setGmlShaderUniform("sh_white", "u_amount", "f", [0.5]);
    render.syncLayerGmlShaders();
    expect(
      (
        render.getLayerContainer("default").filters[0]?.resources[
          "uniforms"
        ] as unknown as { uniforms: Record<string, unknown> }
      ).uniforms["u_amount"],
    ).toBe(0.5);
    render.removeLayerShaderFilter("default", f);
    expect(render.getLayerContainer("default").filters).toHaveLength(0);
  });
});

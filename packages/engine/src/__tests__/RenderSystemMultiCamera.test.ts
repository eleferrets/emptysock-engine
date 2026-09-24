import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";

// Same mocking strategy as RenderSystem.test.ts / RenderPipelineParticles.test.ts:
// stub autoDetectRenderer so init() never needs a real GPU/canvas, while every
// other pixi.js export (Container, RenderTexture, Sprite, ...) stays real. The
// mocked `render` implementation records, synchronously and per-call, exactly
// what it was asked to draw — either a `{ container, target }` offscreen pass
// or a plain-container pass straight to the (mocked) canvas — so tests can
// assert on real per-pass transform state instead of "did not throw".
interface RecordedPass {
  kind: "offscreen" | "screen";
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  target: unknown;
  container: PixiJS.Container;
}

let recordedPasses: RecordedPass[] = [];

vi.mock("pixi.js", async () => {
  const actual = await vi.importActual<typeof PixiJS>("pixi.js");
  return {
    ...actual,
    autoDetectRenderer: vi.fn(() =>
      Promise.resolve({
        canvas: {},
        render: vi.fn((arg: unknown) => {
          if (arg !== null && typeof arg === "object" && "container" in arg) {
            const { container, target } = arg as {
              container: PixiJS.Container;
              target: unknown;
            };
            recordedPasses.push({
              kind: "offscreen",
              x: container.x,
              y: container.y,
              scaleX: container.scale.x,
              scaleY: container.scale.y,
              rotation: container.rotation,
              target,
              container,
            });
          } else {
            const container = arg as PixiJS.Container;
            recordedPasses.push({
              kind: "screen",
              x: container.x,
              y: container.y,
              scaleX: container.scale.x,
              scaleY: container.scale.y,
              rotation: container.rotation,
              target: undefined,
              container,
            });
          }
        }),
        resize: vi.fn(),
        destroy: vi.fn(),
      }),
    ),
  };
});

const { RenderSystem } = await import("../systems/RenderSystem.js");
const { Sprite } = await import("pixi.js");

function viewport(overrides: Partial<Record<string, number>> = {}) {
  return {
    id: 0,
    x: 0,
    y: 0,
    zoom: 1,
    rotation: 0,
    viewWidth: 100,
    viewHeight: 100,
    screenX: 0,
    screenY: 0,
    screenWidth: 100,
    screenHeight: 100,
    ...overrides,
  };
}

describe("RenderSystem.renderMultiCamera", () => {
  let render: InstanceType<typeof RenderSystem>;

  beforeEach(async () => {
    recordedPasses = [];
    render = new RenderSystem();
    await render.init();
  });

  it("renders one distinct offscreen pass per active viewport, using that viewport's own position/zoom", () => {
    const viewports = [
      viewport({ id: 0, x: 100, y: 50, zoom: 1 }),
      viewport({ id: 1, x: -200, y: 300, zoom: 2 }),
    ];
    render.renderMultiCamera(viewports);

    const offscreen = recordedPasses.filter((p) => p.kind === "offscreen");
    expect(offscreen).toHaveLength(2);
    const [first, second] = offscreen;
    if (first === undefined || second === undefined)
      throw new Error("unreachable");

    // CameraSystem.update()'s own convention: stage.x = -camera.x, etc.
    expect(first).toMatchObject({ x: -100, y: -50, scaleX: 1 });
    expect(second).toMatchObject({ x: 200, y: -300, scaleX: 2 });

    // The two passes are genuinely distinguishable, not the same transform twice.
    expect(first.x).not.toBe(second.x);
    expect(first.scaleX).not.toBe(second.scaleX);

    // Both passes rendered the same real stage container.
    expect(first.container).toBe(render.stage);
    expect(second.container).toBe(render.stage);

    // Both passes targeted distinct offscreen RenderTextures, not the canvas.
    expect(first.target).toBeDefined();
    expect(second.target).toBeDefined();
    expect(first.target).not.toBe(second.target);
  });

  it("applies a viewport's rotation to its own offscreen pass", () => {
    render.renderMultiCamera([viewport({ id: 0, rotation: Math.PI / 4 })]);
    const pass = recordedPasses.find((p) => p.kind === "offscreen");
    if (pass === undefined) throw new Error("expected an offscreen pass");
    expect(pass.rotation).toBeCloseTo(Math.PI / 4, 10);
  });

  it("draws each viewport's texture as a screen-space sprite at its own screen rectangle", () => {
    const viewports = [
      viewport({
        id: 0,
        screenX: 10,
        screenY: 20,
        screenWidth: 320,
        screenHeight: 240,
      }),
      viewport({
        id: 1,
        screenX: 330,
        screenY: 20,
        screenWidth: 320,
        screenHeight: 240,
      }),
    ];
    render.renderMultiCamera(viewports);

    const screenPass = recordedPasses.find((p) => p.kind === "screen");
    expect(screenPass).toBeDefined();
    const sprites = screenPass?.container.children.filter(
      (c): c is InstanceType<typeof Sprite> => c instanceof Sprite,
    );
    expect(sprites).toHaveLength(2);
    expect(sprites?.[0]).toMatchObject({
      x: 10,
      y: 20,
      width: 320,
      height: 240,
    });
    expect(sprites?.[1]).toMatchObject({
      x: 330,
      y: 20,
      width: 320,
      height: 240,
    });
  });

  it("restores the stage's prior transform after compositing, never leaking into the single-camera path", () => {
    // Simulate what CameraSystem.update() would have left on `_stage`.
    render.stage.x = -42;
    render.stage.y = -7;
    render.stage.scale.set(1.5);
    render.stage.rotation = 0.2;

    render.renderMultiCamera([viewport({ id: 0, x: 999, y: 999, zoom: 9 })]);

    expect(render.stage.x).toBe(-42);
    expect(render.stage.y).toBe(-7);
    expect(render.stage.scale.x).toBe(1.5);
    expect(render.stage.rotation).toBeCloseTo(0.2, 10);
  });

  it("does not touch the renderer at all when called with an empty viewport list, other than the final composite pass", () => {
    render.renderMultiCamera([]);
    const offscreen = recordedPasses.filter((p) => p.kind === "offscreen");
    expect(offscreen).toHaveLength(0);
    const screenPass = recordedPasses.find((p) => p.kind === "screen");
    expect(screenPass?.container.children).toHaveLength(0);
  });

  it("reuses the same RenderTexture/Sprite for a viewport id across calls when its size is unchanged", () => {
    render.renderMultiCamera([viewport({ id: 0 })]);
    const firstOffscreen = recordedPasses.find((p) => p.kind === "offscreen");
    const firstScreen = recordedPasses.find((p) => p.kind === "screen");
    const firstSprite = firstScreen?.container.children[0];

    recordedPasses = [];
    render.renderMultiCamera([viewport({ id: 0 })]);
    const secondOffscreen = recordedPasses.find((p) => p.kind === "offscreen");
    const secondScreen = recordedPasses.find((p) => p.kind === "screen");
    const secondSprite = secondScreen?.container.children[0];

    expect(secondOffscreen?.target).toBe(firstOffscreen?.target);
    expect(secondSprite).toBe(firstSprite);
  });

  it("drops a viewport id's cached texture once it stops appearing in the list", () => {
    render.renderMultiCamera([viewport({ id: 0 }), viewport({ id: 1 })]);
    recordedPasses = [];
    render.renderMultiCamera([viewport({ id: 0 })]);
    const screenPass = recordedPasses.find((p) => p.kind === "screen");
    expect(screenPass?.container.children).toHaveLength(1);
  });
});

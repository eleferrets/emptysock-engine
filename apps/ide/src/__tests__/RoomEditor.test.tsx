import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { RoomEditor } from "../components/panels/RoomEditor.js";
import { useIDEStore } from "../store/ideStore.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // Reset to a known, empty openFiles set for each test.
  useIDEStore.setState({ openFiles: {} });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderPanel(): Promise<void> {
  await act(async () => {
    root.render(<RoomEditor />);
    await Promise.resolve();
  });
}

const SCENE_JSON = JSON.stringify({
  sceneName: "rm_test",
  prefabInstances: [
    { prefab: "obj_player", props: { x: 100, y: 100 } },
    { prefab: "obj_camera", props: { x: 200, y: 150 } },
  ],
});

describe("RoomEditor — empty states", () => {
  it("shows a helpful message when no scene files are open", async () => {
    await renderPanel();
    expect(container.textContent).toContain("No room/scene files open");
  });

  it("shows a helpful message for a scene with zero placed instances", async () => {
    act(() => {
      useIDEStore.setState({
        openFiles: {
          "rooms/rm_empty.scene.json": JSON.stringify({
            sceneName: "rm_empty",
            prefabInstances: [],
          }),
        },
      });
    });
    await renderPanel();
    expect(container.textContent).toContain("no placed instances");
  });
});

describe("RoomEditor — loading and editing a real .scene.json", () => {
  it("renders a canvas and a file picker once a scene file is open", async () => {
    act(() => {
      useIDEStore.setState({
        openFiles: { "rooms/rm_test.scene.json": SCENE_JSON },
      });
    });
    await renderPanel();

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    expect(select?.value).toBe("rooms/rm_test.scene.json");
  });

  it("dragging a selected instance updates its position and writes back to openFiles", async () => {
    act(() => {
      useIDEStore.setState({
        openFiles: { "rooms/rm_test.scene.json": SCENE_JSON },
        editorSnapToGrid: false,
      });
    });
    await renderPanel();

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    if (canvas === null) return;

    // jsdom's canvas has no real layout, so getBoundingClientRect() is all
    // zeros — clientX/Y map directly onto canvas-space coordinates.
    const fakeContext = {
      fillRect: () => undefined,
      strokeRect: () => undefined,
      fillText: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      translate: () => undefined,
      rotate: () => undefined,
    };
    canvas.getContext = (() =>
      fakeContext) as unknown as typeof canvas.getContext;

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent("pointerdown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        }),
      );
    });
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 300,
          clientY: 250,
          bubbles: true,
        }),
      );
    });
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent("pointerup", {
          clientX: 300,
          clientY: 250,
          bubbles: true,
        }),
      );
    });

    const saved = useIDEStore.getState().openFiles["rooms/rm_test.scene.json"];
    expect(saved).toBeDefined();
    const parsed = JSON.parse(saved ?? "{}") as {
      prefabInstances: { prefab: string; props: { x: number; y: number } }[];
    };
    const player = parsed.prefabInstances.find(
      (i) => i.prefab === "obj_player",
    );
    expect(player?.props.x).toBe(300);
    expect(player?.props.y).toBe(250);
    // The untouched instance is preserved unchanged.
    const camera = parsed.prefabInstances.find(
      (i) => i.prefab === "obj_camera",
    );
    expect(camera?.props).toEqual({ x: 200, y: 150 });
  });

  it("editing rotation/scale fields via the side panel writes back to openFiles", async () => {
    act(() => {
      useIDEStore.setState({
        openFiles: { "rooms/rm_test.scene.json": SCENE_JSON },
      });
    });
    await renderPanel();

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    if (canvas === null) return;
    canvas.getContext = (() => ({
      fillRect: () => undefined,
      strokeRect: () => undefined,
      fillText: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      translate: () => undefined,
      rotate: () => undefined,
    })) as unknown as typeof canvas.getContext;

    // Select the first instance (obj_player at 100,100).
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent("pointerdown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        }),
      );
    });
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent("pointerup", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        }),
      );
    });

    const labels = Array.from(container.querySelectorAll("label"));
    const rotationInput = labels
      .find((l) => l.textContent.startsWith("Rotation"))
      ?.querySelector("input");
    expect(rotationInput).toBeDefined();
    if (rotationInput === undefined || rotationInput === null) return;

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(rotationInput, "45");
      rotationInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const saved = useIDEStore.getState().openFiles["rooms/rm_test.scene.json"];
    const parsed = JSON.parse(saved ?? "{}") as {
      prefabInstances: { prefab: string; props: { rotation?: number } }[];
    };
    const player = parsed.prefabInstances.find(
      (i) => i.prefab === "obj_player",
    );
    expect(player?.props.rotation).toBe(45);
  });
});

describe("RoomEditor — nine-slice / tiled instances", () => {
  const SLICED = JSON.stringify({
    sceneName: "rm_ui",
    entities: [{ components: [{ component: "Transform" }] }],
    prefabInstances: [
      {
        prefab: "obj_panel",
        props: { x: 200, y: 200, width: 96, height: 64, sliceMode: 1 },
      },
      { prefab: "obj_plain", props: { x: 500, y: 500 } },
    ],
  });
  const PATH = "rooms/rm_ui.scene.json";

  function fakeCtx(): CanvasRenderingContext2D {
    const noop = (): undefined => undefined;
    return {
      fillRect: noop,
      strokeRect: noop,
      fillText: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      rect: noop,
      clip: noop,
      drawImage: noop,
      createPattern: () => null,
    } as unknown as CanvasRenderingContext2D;
  }

  function fire(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    });
  }

  async function setup(snap: boolean): Promise<HTMLCanvasElement> {
    act(() => {
      useIDEStore.setState({
        openFiles: { [PATH]: SLICED },
        editorSnapToGrid: snap,
        editorGridSize: 32,
      });
    });
    await renderPanel();
    const canvas = container.querySelector("canvas");
    if (canvas === null) throw new Error("no canvas");
    canvas.getContext = (() =>
      fakeCtx()) as unknown as typeof canvas.getContext;
    return canvas;
  }

  function saved(): {
    entities?: unknown[];
    prefabInstances: { prefab: string; props: Record<string, number> }[];
  } {
    return JSON.parse(useIDEStore.getState().openFiles[PATH] ?? "{}");
  }

  it("selects a sliced instance by its real width/height, not the 32px placeholder", async () => {
    const canvas = await setup(false);
    // (240,225) is outside a 32px box around (200,200) but inside the 96x64 box.
    fire(canvas, "pointerdown", 240, 225);
    fire(canvas, "pointerup", 240, 225);
    expect(container.textContent).toContain("obj_panel");
    expect(container.textContent).toContain("Width");
  });

  it("dragging the SE handle resizes, writes width/height back, and preserves other file data", async () => {
    const canvas = await setup(false);
    fire(canvas, "pointerdown", 200, 200);
    fire(canvas, "pointerup", 200, 200);
    // Box is x152..248, y168..232 -> SE corner (248,232).
    fire(canvas, "pointerdown", 248, 232);
    fire(canvas, "pointermove", 300, 300);
    fire(canvas, "pointerup", 300, 300);
    const p = saved().prefabInstances.find((i) => i.prefab === "obj_panel");
    expect(p?.props).toMatchObject({ width: 148, height: 132, x: 226, y: 234 });
    expect(saved().entities).toHaveLength(1);
  });

  it("snaps the dragged edge to the grid when snap is on", async () => {
    const canvas = await setup(true);
    fire(canvas, "pointerdown", 200, 200);
    fire(canvas, "pointerup", 200, 200);
    fire(canvas, "pointerdown", 248, 232);
    fire(canvas, "pointermove", 300, 300);
    fire(canvas, "pointerup", 300, 300);
    const p = saved().prefabInstances.find((i) => i.prefab === "obj_panel");
    // right edge 300 -> 288, bottom 300 -> 288
    expect(p?.props).toMatchObject({ width: 136, height: 120 });
  });

  it("undo reverts a resize", async () => {
    const canvas = await setup(false);
    fire(canvas, "pointerdown", 200, 200);
    fire(canvas, "pointerup", 200, 200);
    fire(canvas, "pointerdown", 248, 232);
    fire(canvas, "pointermove", 300, 300);
    fire(canvas, "pointerup", 300, 300);
    const undoBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Undo",
    );
    act(() => undoBtn?.click());
    const widthInput = Array.from(container.querySelectorAll("label"))
      .find((l) => l.textContent.startsWith("Width"))
      ?.querySelector("input");
    expect(widthInput?.value).toBe("96");
  });

  it("marking a plain instance as tiled seeds a width/height to resize from", async () => {
    const canvas = await setup(false);
    fire(canvas, "pointerdown", 500, 500);
    fire(canvas, "pointerup", 500, 500);
    const select = Array.from(container.querySelectorAll("label"))
      .find((l) => l.textContent.startsWith("Slicing"))
      ?.querySelector("select");
    expect(select).not.toBeNull();
    if (select === null || select === undefined) return;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      )?.set;
      setter?.call(select, "2");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const p = saved().prefabInstances.find((i) => i.prefab === "obj_plain");
    expect(p?.props).toMatchObject({ sliceMode: 2, width: 32, height: 32 });
  });
});

describe("RoomEditor — imported room views and entities", () => {
  it("edits a view field and an entity position, preserving other fields", async () => {
    const view = {
      visible: true,
      worldX: 0,
      worldY: 0,
      worldWidth: 320,
      worldHeight: 180,
      screenX: 0,
      screenY: 0,
      screenWidth: 640,
      screenHeight: 360,
      borderX: 0,
      borderY: 0,
      speedX: -1,
      speedY: -1,
    };
    act(() => {
      useIDEStore.setState({
        openFiles: {
          "rooms/rm_v.scene.json": JSON.stringify({
            sceneName: "rm_v",
            prefabInstances: [],
            viewsEnabled: true,
            views: [view],
            entities: [
              {
                components: [
                  { component: "Transform", overrides: { x: 1, y: 2 } },
                ],
              },
            ],
          }),
        },
      });
    });
    await renderPanel();
    const setVal = (label: string, v: string): void => {
      const el = container.querySelector<HTMLInputElement>(
        `input[aria-label="${label}"]`,
      );
      expect(el).not.toBeNull();
      if (el === null) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      act(() => {
        setter?.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    setVal("view 0 worldX", "48");
    setVal("entity 0 x", "77");
    const saved = JSON.parse(
      useIDEStore.getState().openFiles["rooms/rm_v.scene.json"] ?? "{}",
    ) as {
      viewsEnabled: boolean;
      views: { worldX: number; worldWidth: number }[];
      entities: { components: { overrides: { x: number; y: number } }[] }[];
    };
    expect(saved.viewsEnabled).toBe(true);
    expect(saved.views[0]?.worldX).toBe(48);
    expect(saved.views[0]?.worldWidth).toBe(320);
    expect(saved.entities[0]?.components[0]?.overrides).toEqual({
      x: 77,
      y: 2,
    });
  });
});

describe("RoomEditor — canvas editing of views and entities", () => {
  const PATH = "rooms/rm_c.scene.json";
  const view = {
    visible: true,
    worldX: 320,
    worldY: 160,
    worldWidth: 320,
    worldHeight: 192,
    screenX: 0,
    screenY: 0,
    screenWidth: 640,
    screenHeight: 384,
    borderX: 0,
    borderY: 0,
    speedX: -1,
    speedY: -1,
  };
  const FILE = JSON.stringify({
    sceneName: "rm_c",
    prefabInstances: [{ prefab: "obj_player", props: { x: 50, y: 50 } }],
    viewsEnabled: true,
    views: [view, { ...view, visible: false, worldX: 0, worldY: 0 }],
    entities: [
      {
        components: [
          { component: "Transform", overrides: { x: 600, y: 400 } },
          { component: "Meta", overrides: { name: "gGun" } },
        ],
      },
    ],
  });

  const strokes: [number, number, number, number][] = [];
  function fakeCtx(): CanvasRenderingContext2D {
    const noop = (): undefined => undefined;
    return {
      fillRect: noop,
      strokeRect: (x: number, y: number, w: number, h: number) => {
        strokes.push([x, y, w, h]);
      },
      fillText: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      setLineDash: noop,
    } as unknown as CanvasRenderingContext2D;
  }
  function fire(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    });
  }
  async function setup(snap: boolean): Promise<HTMLCanvasElement> {
    strokes.length = 0;
    act(() => {
      useIDEStore.setState({
        openFiles: { [PATH]: FILE },
        editorSnapToGrid: snap,
        editorGridSize: 32,
      });
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (() => fakeCtx()) as never,
    );
    await act(async () => {
      root.render(<RoomEditor />);
      await Promise.resolve();
    });
    const canvas = container.querySelector("canvas");
    if (canvas === null) throw new Error("no canvas");
    return canvas;
  }
  const saved = (): {
    views: Record<string, unknown>[];
    entities: { components: { overrides: Record<string, number> }[] }[];
  } => JSON.parse(useIDEStore.getState().openFiles[PATH] ?? "{}");
  const clickUndo = (): void => {
    const b = Array.from(container.querySelectorAll("button")).find(
      (x) => x.textContent === "Undo",
    );
    act(() => b?.click());
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("undoes and redoes a canvas drag with Ctrl+Z / Ctrl+Shift+Z", async () => {
    const canvas = await setup(false);
    fire(canvas, "pointerdown", 600, 400);
    fire(canvas, "pointermove", 650, 450);
    fire(canvas, "pointerup", 650, 450);
    expect(saved().entities[0]?.components[0]?.overrides).toMatchObject({
      x: 650,
    });
    const key = (init: KeyboardEventInit): void => {
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { ctrlKey: true, ...init }),
        );
      });
    };
    key({ key: "z" });
    expect(saved().entities[0]?.components[0]?.overrides).toMatchObject({
      x: 600,
    });
    key({ key: "z", shiftKey: true });
    expect(saved().entities[0]?.components[0]?.overrides).toMatchObject({
      x: 650,
    });
  });

  it("shows the canvas for a room with only views and entities", async () => {
    const canvas = await setup(false);
    expect(canvas).not.toBeNull();
    expect(container.textContent).not.toContain("no placed instances");
  });

  it("drags a direct entity, snapping to the grid, as one undoable step", async () => {
    const canvas = await setup(true);
    fire(canvas, "pointerdown", 600, 400);
    fire(canvas, "pointermove", 691, 470);
    fire(canvas, "pointerup", 691, 470);
    // 691 -> 704, 470 -> 480 (grid 32).
    expect(saved().entities[0]?.components[0]?.overrides).toMatchObject({
      x: 704,
      y: 480,
    });
    clickUndo();
    expect(saved().entities[0]?.components[0]?.overrides).toMatchObject({
      x: 600,
      y: 400,
    });
  });

  it("drags a visible view by its border and ignores clicks inside it", async () => {
    const canvas = await setup(false);
    // Inside the view (not near an edge, not on an entity): selects nothing, saves nothing.
    const before = useIDEStore.getState().openFiles[PATH];
    fire(canvas, "pointerdown", 480, 250);
    fire(canvas, "pointerup", 480, 250);
    expect(useIDEStore.getState().openFiles[PATH]).toBe(before);
    // Top border at y=160.
    fire(canvas, "pointerdown", 400, 160);
    fire(canvas, "pointermove", 430, 200);
    fire(canvas, "pointerup", 430, 200);
    expect(saved().views[0]).toMatchObject({
      worldX: 350,
      worldY: 200,
      worldWidth: 320,
    });
    expect(saved().views[1]).toMatchObject({ worldX: 0, worldY: 0 });
    clickUndo();
    expect(saved().views[0]).toMatchObject({ worldX: 320, worldY: 160 });
  });

  it("resizes the selected view from its south-east handle with snapping", async () => {
    const canvas = await setup(true);
    // Select via the label chip (x 320..368, y 146..160).
    fire(canvas, "pointerdown", 330, 152);
    fire(canvas, "pointerup", 330, 152);
    // SE corner is (640, 352).
    fire(canvas, "pointerdown", 640, 352);
    fire(canvas, "pointermove", 700, 400);
    fire(canvas, "pointerup", 700, 400);
    // right 700 -> 704, bottom 400 -> 416.
    expect(saved().views[0]).toMatchObject({
      worldX: 320,
      worldY: 160,
      worldWidth: 384,
      worldHeight: 256,
    });
  });

  it("draws hidden views too (dimmed), so they can be edited", async () => {
    await setup(false);
    expect(strokes).toContainEqual([320, 160, 320, 192]);
    expect(strokes).toContainEqual([0, 0, 320, 192]);
  });

  it("drags a hidden view by its border on the canvas", async () => {
    const canvas = await setup(false);
    // Hidden view 1 sits at world (0,0) 320x192: top border at y=0.
    fire(canvas, "pointerdown", 100, 0);
    fire(canvas, "pointermove", 130, 20);
    fire(canvas, "pointerup", 130, 20);
    expect(saved().views[1]).toMatchObject({
      worldX: 30,
      worldY: 20,
      visible: false,
    });
    expect(saved().views[0]).toMatchObject({ worldX: 320, worldY: 160 });
  });

  it("double-clicking a view toggles its visibility", async () => {
    const canvas = await setup(false);
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent("dblclick", { clientX: 100, clientY: 0, bubbles: true }),
      );
    });
    expect(saved().views[1]).toMatchObject({ visible: true });
  });

  it("drags a view by its screen (port) rectangle in the game-window overlay", async () => {
    const canvas = await setup(false);
    // Two 640x384 ports -> overlay scale 0.375, frame at (710,486) 240x144.
    // Both ports coincide, so the topmost (view 1) is grabbed at the overlay centre at the overlay centre and move it 40px right.
    fire(canvas, "pointerdown", 830, 558);
    fire(canvas, "pointermove", 870, 558);
    fire(canvas, "pointerup", 870, 558);
    const v0 = saved().views[1] as {
      screenX: number;
      screenY: number;
      worldX: number;
    };
    expect(v0.screenX).toBe(107);
    expect(v0.screenY).toBe(0);
    expect(v0.worldX).toBe(0); // world rectangle untouched
    clickUndo();
    expect((saved().views[1] as { screenX: number }).screenX).toBe(0);
  });

  it("pans by dragging empty background and edits at the panned position", async () => {
    const canvas = await setup(false);
    const level = (): string =>
      container.querySelector("[data-testid=room-zoom-level]")?.textContent ??
      "";
    expect(level()).toBe("100%");
    fire(canvas, "pointerdown", 900, 100);
    fire(canvas, "pointermove", 850, 130);
    fire(canvas, "pointerup", 850, 130);
    // The file is untouched by a pan.
    expect(saved().views[0]).toMatchObject({ worldX: 320, worldY: 160 });
    // View 0's top border (world 400,160) is now at screen (350,190).
    fire(canvas, "pointerdown", 350, 190);
    fire(canvas, "pointermove", 380, 230);
    fire(canvas, "pointerup", 380, 230);
    expect(saved().views[0]).toMatchObject({ worldX: 350, worldY: 200 });
  });

  it("zooms with the wheel about the cursor, and the zoom buttons reset and fit", async () => {
    const canvas = await setup(false);
    const level = (): string =>
      container.querySelector("[data-testid=room-zoom-level]")?.textContent ??
      "";
    act(() => {
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -500,
          clientX: 0,
          clientY: 0,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(level()).toBe("212%");
    const btn = (t: string): HTMLButtonElement | undefined =>
      Array.from(container.querySelectorAll("button")).find(
        (b) => b.title === t,
      );
    act(() => btn("Reset zoom and pan")?.click());
    expect(level()).toBe("100%");
    act(() => btn("Fit the whole room in view")?.click());
    expect(level()).not.toBe("100%");
    act(() => btn("Zoom in")?.click());
    expect(Number.parseInt(level(), 10)).toBeGreaterThan(0);
  });

  it("picks the right thing at a zoomed position", async () => {
    const canvas = await setup(false);
    // Zoom 2x about the origin via two wheel notches is fuzzy; use the buttons: 1.25^n.
    const zin = Array.from(container.querySelectorAll("button")).find(
      (b) => b.title === "Zoom in",
    );
    act(() => zin?.click()); // zoom 1.25 about canvas centre (480,320)
    // World point (400,160) -> screen = (400-480)*1.25+480, (160-320)*1.25+320 = (380,120).
    fire(canvas, "pointerdown", 380, 120);
    fire(canvas, "pointermove", 405, 145);
    fire(canvas, "pointerup", 405, 145);
    // +25 screen px = +20 world px at 1.25x.
    expect(saved().views[0]).toMatchObject({ worldX: 340, worldY: 180 });
  });

  it("edits followObject from the side panel on blur, and clears it when emptied", async () => {
    await setup(false);
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="view 0 followObject"]',
    );
    if (input === null) throw new Error("no followObject input");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      setter?.call(input, "obj_player");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(saved().views[0]?.["followObject"]).toBe("obj_player");
    expect(
      Array.from(container.querySelectorAll("#room-follow-objects option")).map(
        (o) => (o as HTMLOptionElement).value,
      ),
    ).toEqual(["obj_player"]);
    clickUndo();
    expect(saved().views[0]).not.toHaveProperty("followObject");
  });
});

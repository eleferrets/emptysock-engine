import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

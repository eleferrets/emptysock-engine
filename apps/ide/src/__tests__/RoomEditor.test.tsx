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
});

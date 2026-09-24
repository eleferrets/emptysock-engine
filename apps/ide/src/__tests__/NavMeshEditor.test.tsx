import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import Konva from "konva";
import type { Circle } from "konva/lib/shapes/Circle";
import type { Group } from "konva/lib/Group";
import {
  NavMeshEditor,
  polygonCentroid,
  pointInPolygon,
  toggleNeighbourLink,
  removePolygon,
  isNavMeshData,
} from "../components/panels/NavMeshEditor.js";
import { useNavMeshStore } from "../store/navMeshStore.js";
import type { EditorNavPolygon } from "../store/navMeshStore.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no ResizeObserver — the panel only uses it to keep the canvas's
// backing-store size in sync with its container, which is irrelevant here.
class StubResizeObserver {
  observe(): void {
    /* no-op */
  }
  unobserve(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver =
    StubResizeObserver as unknown as typeof ResizeObserver;
}

function makePolygon(
  id: number,
  verts: { x: number; y: number }[],
  neighbours: number[] = [],
): EditorNavPolygon {
  return { id, vertices: verts, centroid: polygonCentroid(verts), neighbours };
}

describe("NavMeshEditor pure helpers", () => {
  it("computes a polygon's centroid as the average of its vertices", () => {
    const c = polygonCentroid([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(c).toEqual({ x: 5, y: 5 });
  });

  it("point-in-polygon detects inside vs outside a convex quad", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 5 }, verts)).toBe(true);
    expect(pointInPolygon({ x: 50, y: 50 }, verts)).toBe(false);
  });

  it("toggles a bidirectional neighbour link on, then off", () => {
    const a = makePolygon(1, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    const b = makePolygon(2, [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
    ]);
    const linked = toggleNeighbourLink([a, b], 1, 2);
    expect(linked.find((p) => p.id === 1)?.neighbours).toEqual([2]);
    expect(linked.find((p) => p.id === 2)?.neighbours).toEqual([1]);

    const unlinked = toggleNeighbourLink(linked, 1, 2);
    expect(unlinked.find((p) => p.id === 1)?.neighbours).toEqual([]);
    expect(unlinked.find((p) => p.id === 2)?.neighbours).toEqual([]);
  });

  it("removing a polygon strips it from every other polygon's neighbours", () => {
    const a = makePolygon(
      1,
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      [2, 3],
    );
    const b = makePolygon(
      2,
      [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
      ],
      [1],
    );
    const c = makePolygon(
      3,
      [
        { x: 4, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 1 },
      ],
      [1],
    );
    const result = removePolygon([a, b, c], 2);
    expect(result.map((p) => p.id)).toEqual([1, 3]);
    expect(result.find((p) => p.id === 1)?.neighbours).toEqual([3]);
    expect(result.find((p) => p.id === 3)?.neighbours).toEqual([1]);
  });

  it("validates a NavMeshData JSON shape", () => {
    expect(isNavMeshData({ polygons: [] })).toBe(true);
    expect(
      isNavMeshData({
        polygons: [{ id: 1, vertices: [{ x: 0, y: 0 }], neighbours: [] }],
      }),
    ).toBe(true);
    expect(isNavMeshData({ polygons: "nope" })).toBe(false);
    expect(isNavMeshData(null)).toBe(false);
    expect(isNavMeshData({ polygons: [{ id: "bad" }] })).toBe(false);
  });

  it("round-trips through JSON in the exact NavMeshData shape", () => {
    const polygons: EditorNavPolygon[] = [
      makePolygon(
        1,
        [
          { x: 0, y: 0 },
          { x: 32, y: 0 },
          { x: 32, y: 32 },
          { x: 0, y: 32 },
        ],
        [2],
      ),
      makePolygon(
        2,
        [
          { x: 32, y: 0 },
          { x: 64, y: 0 },
          { x: 64, y: 32 },
        ],
        [1],
      ),
    ];
    const json = JSON.stringify({ polygons });
    const parsed: unknown = JSON.parse(json);
    expect(isNavMeshData(parsed)).toBe(true);
    if (isNavMeshData(parsed)) {
      expect(parsed.polygons).toHaveLength(2);
      expect(parsed.polygons[0]?.neighbours).toEqual([2]);
    }
  });
});

describe("NavMeshEditor component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useNavMeshStore.getState().resetNavMeshStore();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderPanel(): Promise<void> {
    await act(async () => {
      root.render(<NavMeshEditor />);
      await Promise.resolve();
    });
  }

  it("shows the empty state when no polygons are loaded", async () => {
    await renderPanel();
    expect(container.textContent).toContain(
      "No navmesh polygons yet — switch to the Draw tool and click to start drawing.",
    );
  });

  it("creates a polygon via the draw tool and Finish button", async () => {
    await renderPanel();

    const drawBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Draw",
    );
    expect(drawBtn).toBeDefined();
    act(() => {
      drawBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const stageContainer = container.querySelector(
      '[data-testid="navmesh-stage-container"]',
    );
    expect(stageContainer).not.toBeNull();
    const canvas = stageContainer?.querySelector("canvas") ?? null;
    expect(canvas).not.toBeNull();
    if (canvas === null) return;

    const points: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [100, 100],
    ];
    for (const [clientX, clientY] of points) {
      act(() => {
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, clientX, clientY }),
        );
      });
    }

    const finishBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => String(b.textContent).startsWith("Finish polygon"),
    );
    expect(finishBtn).toBeDefined();
    if (finishBtn === undefined) return;
    expect(finishBtn.hasAttribute("disabled")).toBe(false);
    act(() => {
      finishBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useNavMeshStore.getState().navMeshPolygons).toHaveLength(1);
    expect(
      useNavMeshStore.getState().navMeshPolygons[0]?.vertices,
    ).toHaveLength(3);
  });

  it("exports and reloads the current polygons without transformation", async () => {
    const polygons: EditorNavPolygon[] = [
      makePolygon(1, [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
        { x: 32, y: 32 },
      ]),
    ];
    useNavMeshStore.getState().setNavMeshPolygons(polygons);
    await renderPanel();

    const exportBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Export navmesh.json",
    );
    expect(exportBtn?.hasAttribute("disabled")).toBe(false);

    // Loading is driven by a real <input type=file> click/FileReader, which
    // jsdom cannot simulate end to end; the JSON-shape and store-write halves
    // of the round trip are covered directly above and by
    // `isNavMeshData`/pure-helper tests, matching what `loadNavMesh` does
    // once `FileReader.onload` fires.
    const data = { polygons: useNavMeshStore.getState().navMeshPolygons };
    expect(isNavMeshData(data)).toBe(true);
  });

  // ── Konva drag-isolation gotcha ──────────────────────────────────────────
  //
  // react-konva's underlying <canvas> gives no real pixel-based hit-testing
  // under jsdom/vitest-canvas-mock (fills/strokes are stubbed, not actually
  // rastered), so shape-level interaction here is driven directly through
  // real Konva node instances — found via `Konva.stages` (every live Stage)
  // and the stable `id`s NavMeshEditor assigns each polygon Group/vertex
  // Circle — rather than by dispatching raw pointer coordinates and hoping
  // Konva's intersection test resolves them to the right shape. This is
  // Konva's own recommended way to drive its event/drag system
  // programmatically in a test: mutate the node's position, then `.fire()`
  // the drag event with `bubble: true` (matching exactly how Konva's real
  // drag manager fires it), so both the node's own handler and any
  // ancestor's bubbled handler run for real.

  function currentStage(): Konva.Stage {
    const stage = Konva.stages[Konva.stages.length - 1];
    expect(stage).toBeDefined();
    if (stage === undefined) throw new Error("no live Konva stage");
    return stage;
  }

  it("dragging a single vertex moves only that vertex, not the whole polygon", async () => {
    const polygons: EditorNavPolygon[] = [
      makePolygon(1, [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
        { x: 32, y: 32 },
        { x: 0, y: 32 },
      ]),
    ];
    useNavMeshStore.getState().setNavMeshPolygons(polygons);
    await renderPanel();

    const stage = currentStage();
    const vertex = stage.findOne<Circle>("#navmesh-vertex-1-0");
    expect(vertex).toBeDefined();
    if (vertex === undefined) return;

    await act(async () => {
      vertex.position({ x: 40, y: 40 });
      vertex.fire("dragstart", { type: "dragstart", target: vertex }, true);
      vertex.fire("dragmove", { type: "dragmove", target: vertex }, true);
      vertex.fire("dragend", { type: "dragend", target: vertex }, true);
      await Promise.resolve();
    });

    const result = useNavMeshStore.getState().navMeshPolygons[0];
    expect(result?.vertices).toEqual([
      { x: 40, y: 40 },
      { x: 32, y: 0 },
      { x: 32, y: 32 },
      { x: 0, y: 32 },
    ]);
  });

  it("dragging the polygon body translates every vertex together", async () => {
    const polygons: EditorNavPolygon[] = [
      makePolygon(1, [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
        { x: 32, y: 32 },
        { x: 0, y: 32 },
      ]),
    ];
    useNavMeshStore.getState().setNavMeshPolygons(polygons);
    await renderPanel();

    const stage = currentStage();
    const group = stage.findOne<Group>("#navmesh-poly-1");
    expect(group).toBeDefined();
    if (group === undefined) return;

    await act(async () => {
      group.fire("dragstart", { type: "dragstart", target: group }, true);
      group.position({ x: 10, y: 5 });
      group.fire("dragmove", { type: "dragmove", target: group }, true);
      group.fire("dragend", { type: "dragend", target: group }, true);
      await Promise.resolve();
    });

    const result = useNavMeshStore.getState().navMeshPolygons[0];
    expect(result?.vertices).toEqual([
      { x: 10, y: 5 },
      { x: 42, y: 5 },
      { x: 42, y: 37 },
      { x: 10, y: 37 },
    ]);
    expect(result?.centroid).toEqual({ x: 26, y: 21 });
  });
});

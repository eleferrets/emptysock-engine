import { describe, it, expect } from "vitest";
import { NavMeshSystem } from "../systems/NavMeshSystem.js";
import type { NavMeshData } from "../systems/NavMeshSystem.js";

// Three squares in a row, each 1x1, sharing edges: [0,0]-[1,1], [1,0]-[2,1], [2,0]-[3,1].
const THREE_SQUARES: NavMeshData = {
  polygons: [
    {
      id: 0,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      centroid: { x: 0.5, y: 0.5 },
      neighbours: [1],
    },
    {
      id: 1,
      vertices: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
      ],
      centroid: { x: 1.5, y: 0.5 },
      neighbours: [0, 2],
    },
    {
      id: 2,
      vertices: [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2, y: 1 },
      ],
      centroid: { x: 2.5, y: 0.5 },
      neighbours: [1],
    },
  ],
};

// Same three squares but poly 0 and poly 2 have no connecting neighbour path
// (poly 1 removed from both neighbour lists) to exercise the unreachable case.
const DISCONNECTED: NavMeshData = {
  polygons: [
    {
      id: 0,
      vertices: THREE_SQUARES.polygons[0]?.vertices ?? [],
      centroid: { x: 0.5, y: 0.5 },
      neighbours: [],
    },
    {
      id: 2,
      vertices: THREE_SQUARES.polygons[2]?.vertices ?? [],
      centroid: { x: 2.5, y: 0.5 },
      neighbours: [],
    },
  ],
};

describe("NavMeshSystem", () => {
  it("finds a path across multiple polygons", () => {
    const nav = new NavMeshSystem();
    nav.load(THREE_SQUARES);
    const path = nav.findPath({ x: 0.2, y: 0.5 }, { x: 2.8, y: 0.5 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 0.2, y: 0.5 });
    expect(path[path.length - 1]).toEqual({ x: 2.8, y: 0.5 });
    // Passes through the middle polygon's centroid as a waypoint.
    expect(path).toContainEqual({ x: 1.5, y: 0.5 });
  });

  it("returns [from, to] directly when both points are in the same polygon", () => {
    const nav = new NavMeshSystem();
    nav.load(THREE_SQUARES);
    const path = nav.findPath({ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 });
    expect(path).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]);
  });

  it("returns an empty path when no polygon connects start and goal", () => {
    const nav = new NavMeshSystem();
    nav.load(DISCONNECTED);
    const path = nav.findPath({ x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 });
    expect(path).toEqual([]);
  });

  it("returns an empty path when the mesh has no polygons", () => {
    const nav = new NavMeshSystem();
    nav.load({ polygons: [] });
    const path = nav.findPath({ x: 0, y: 0 }, { x: 1, y: 1 });
    expect(path).toEqual([]);
  });
});

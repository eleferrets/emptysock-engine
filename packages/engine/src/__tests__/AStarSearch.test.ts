import { describe, it, expect } from "vitest";
import { AStarSearch } from "../core/AStarSearch.js";

interface GridNode {
  x: number;
  y: number;
}

function gridNeighbours(
  walkable: (x: number, y: number) => boolean,
): (node: GridNode) => Array<{ node: GridNode; cost: number }> {
  return (node) => {
    const dirs: Array<[number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    const out: Array<{ node: GridNode; cost: number }> = [];
    for (const [dx, dy] of dirs) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      if (walkable(nx, ny)) out.push({ node: { x: nx, y: ny }, cost: 1 });
    }
    return out;
  };
}

describe("AStarSearch", () => {
  it("finds the shortest path on a simple open grid", () => {
    const result = AStarSearch<GridNode>({
      start: { x: 0, y: 0 },
      isGoal: (n) => n.x === 3 && n.y === 0,
      heuristic: (n) => Math.abs(n.x - 3) + Math.abs(n.y - 0),
      key: (n) => `${n.x},${n.y}`,
      neighbours: gridNeighbours((x, y) => x >= 0 && x < 4 && y >= 0 && y < 1),
    });

    expect(result.found).toBe(true);
    expect(result.path.map((n) => `${n.x},${n.y}`)).toEqual([
      "0,0",
      "1,0",
      "2,0",
      "3,0",
    ]);
  });

  it("returns not-found for an unreachable goal", () => {
    // Two disconnected 1-cell islands: (0,0) and (5,5), no edges between them.
    const result = AStarSearch<GridNode>({
      start: { x: 0, y: 0 },
      isGoal: (n) => n.x === 5 && n.y === 5,
      heuristic: (n) => Math.abs(n.x - 5) + Math.abs(n.y - 5),
      key: (n) => `${n.x},${n.y}`,
      neighbours: gridNeighbours(
        (x, y) => (x === 0 && y === 0) || (x === 5 && y === 5),
      ),
    });

    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
  });

  it("returns a single-node path when start already satisfies isGoal", () => {
    const result = AStarSearch<GridNode>({
      start: { x: 2, y: 2 },
      isGoal: (n) => n.x === 2 && n.y === 2,
      heuristic: () => 0,
      key: (n) => `${n.x},${n.y}`,
      neighbours: gridNeighbours(() => true),
    });

    expect(result.found).toBe(true);
    expect(result.path).toEqual([{ x: 2, y: 2 }]);
  });

  it("picks the lower-cost route through a weighted graph over a shorter-hop route", () => {
    // Graph:
    //   A -> B (cost 1) -> D (cost 1)   total 2, but B->D is blocked below
    //   A -> C (cost 1) -> D (cost 1)   total 2
    // Make the direct A->D edge expensive so the two-hop route wins.
    type Node = "A" | "B" | "C" | "D";
    const edges: Record<Node, Array<{ node: Node; cost: number }>> = {
      A: [
        { node: "B", cost: 1 },
        { node: "C", cost: 1 },
        { node: "D", cost: 10 },
      ],
      B: [{ node: "D", cost: 5 }],
      C: [{ node: "D", cost: 1 }],
      D: [],
    };

    const result = AStarSearch<Node>({
      start: "A",
      isGoal: (n) => n === "D",
      heuristic: () => 0,
      key: (n) => n,
      neighbours: (n) => edges[n],
    });

    expect(result.found).toBe(true);
    expect(result.path).toEqual(["A", "C", "D"]);
  });

  it("breaks ties deterministically without oscillating or infinite-looping on cycles", () => {
    // A small cyclic graph: A <-> B <-> C <-> A, all edges cost 1.
    type Node = "A" | "B" | "C";
    const edges: Record<Node, Array<{ node: Node; cost: number }>> = {
      A: [
        { node: "B", cost: 1 },
        { node: "C", cost: 1 },
      ],
      B: [
        { node: "A", cost: 1 },
        { node: "C", cost: 1 },
      ],
      C: [
        { node: "A", cost: 1 },
        { node: "B", cost: 1 },
      ],
    };

    const result = AStarSearch<Node>({
      start: "A",
      isGoal: (n) => n === "C",
      heuristic: () => 0,
      key: (n) => n,
      neighbours: (n) => edges[n],
    });

    expect(result.found).toBe(true);
    expect(result.path[0]).toBe("A");
    expect(result.path[result.path.length - 1]).toBe("C");
    expect(result.path.length).toBe(2);
  });

  it("prefers the lower-weight cell on a weighted grid over the shorter unweighted path", () => {
    // 2x3 grid where the direct row has high weight, forcing a detour.
    const weight = (x: number, y: number): number => {
      if (y === 0 && (x === 1 || x === 2)) return 10;
      return 1;
    };
    const walkable = (x: number, y: number): boolean =>
      x >= 0 && x < 4 && y >= 0 && y < 2;

    const result = AStarSearch<GridNode>({
      start: { x: 0, y: 0 },
      isGoal: (n) => n.x === 3 && n.y === 0,
      heuristic: (n) => Math.abs(n.x - 3) + Math.abs(n.y - 0),
      key: (n) => `${n.x},${n.y}`,
      neighbours: (n) => {
        const dirs: Array<[number, number]> = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        const out: Array<{ node: GridNode; cost: number }> = [];
        for (const [dx, dy] of dirs) {
          const nx = n.x + dx;
          const ny = n.y + dy;
          if (!walkable(nx, ny)) continue;
          out.push({ node: { x: nx, y: ny }, cost: weight(nx, ny) });
        }
        return out;
      },
    });

    expect(result.found).toBe(true);
    // Should detour via row y=1 to avoid the expensive (1,0) and (2,0) cells.
    expect(result.path.some((n) => n.y === 1)).toBe(true);
  });
});

import type {
  EditorNavPolygon,
  EditorNavMeshData,
  NavMeshVec2,
} from "../store/navMeshStore";

/**
 * Pure geometry/data helpers for the NavMesh editor panel
 * (`components/panels/NavMeshEditor.tsx`). Kept here, separate from the
 * panel component, so this logic is plain, dependency-free and directly
 * unit-testable without mounting Konva/React — the same "extract a pure
 * helper" shape `editorGrid.ts` already uses for the tilemap/room editors.
 */

export function polygonCentroid(vertices: NavMeshVec2[]): NavMeshVec2 {
  if (vertices.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const v of vertices) {
    sx += v.x;
    sy += v.y;
  }
  return { x: sx / vertices.length, y: sy / vertices.length };
}

export function pointInPolygon(p: NavMeshVec2, verts: NavMeshVec2[]): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const vi = verts[i];
    const vj = verts[j];
    if (vi === undefined || vj === undefined) continue;
    if (
      vi.y > p.y !== vj.y > p.y &&
      p.x < ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Toggle a bidirectional neighbour link between two polygons in place. */
export function toggleNeighbourLink(
  polygons: EditorNavPolygon[],
  idA: number,
  idB: number,
): EditorNavPolygon[] {
  const a = polygons.find((p) => p.id === idA);
  const linked = a !== undefined && a.neighbours.includes(idB);
  return polygons.map((p) => {
    if (p.id === idA) {
      return {
        ...p,
        neighbours: linked
          ? p.neighbours.filter((n) => n !== idB)
          : [...p.neighbours, idB],
      };
    }
    if (p.id === idB) {
      return {
        ...p,
        neighbours: linked
          ? p.neighbours.filter((n) => n !== idA)
          : [...p.neighbours, idA],
      };
    }
    return p;
  });
}

/** Remove a polygon and strip its id from every other polygon's neighbours. */
export function removePolygon(
  polygons: EditorNavPolygon[],
  id: number,
): EditorNavPolygon[] {
  return polygons
    .filter((p) => p.id !== id)
    .map((p) => ({
      ...p,
      neighbours: p.neighbours.filter((n) => n !== id),
    }));
}

export function isNavMeshData(value: unknown): value is EditorNavMeshData {
  if (typeof value !== "object" || value === null) return false;
  const polys = (value as { polygons?: unknown }).polygons;
  if (!Array.isArray(polys)) return false;
  return polys.every((p) => {
    if (typeof p !== "object" || p === null) return false;
    const poly = p as Record<string, unknown>;
    return (
      typeof poly["id"] === "number" &&
      Array.isArray(poly["vertices"]) &&
      Array.isArray(poly["neighbours"])
    );
  });
}

export function flattenPoints(vertices: NavMeshVec2[]): number[] {
  const out: number[] = [];
  for (const v of vertices) {
    out.push(v.x, v.y);
  }
  return out;
}

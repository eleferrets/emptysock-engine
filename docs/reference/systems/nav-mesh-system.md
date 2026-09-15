# NavMeshSystem

`NavMeshSystem` provides polygon-based 2D pathfinding using A\* on a convex polygon graph. NavMesh data must be built offline — there is no runtime generation API.

For a task-oriented introduction, see the [Navigation guide](../../guides/navigation.md).

Import: `import { NavMeshSystem, type NavMeshData } from '@emptysock/engine';`

---

## Why offline-only

Building a polygon graph from raw tile data requires Delaunay triangulation and polygon merging, which is O(n log n) and would block the main thread for hundreds of milliseconds on a large level. Build the NavMesh in the Tilemap Editor or a preprocessing step and ship the polygon data as a JSON asset.

---

## Constructor

```typescript
const navMesh = new NavMeshSystem();
```

---

## `navMesh.load(data: NavMeshData): void`

Load a pre-built polygon graph. Call this in `onLoad` before any path queries.

### NavMeshData

```typescript
interface NavMeshData {
  polygons: NavMeshPolygon[];
}

interface NavMeshPolygon {
  id: number;
  vertices: { x: number; y: number }[];
  centroid: { x: number; y: number };
  neighbours: number[]; // ids of adjacent polygons
}
```

```typescript
const data: NavMeshData = {
  polygons: [
    {
      id: 0,
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      centroid: { x: 50, y: 50 },
      neighbours: [1],
    },
    {
      id: 1,
      vertices: [
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 100, y: 100 },
      ],
      centroid: { x: 150, y: 50 },
      neighbours: [0],
    },
  ],
};

navMesh.load(data);
```

---

## `navMesh.findPath(from, to): { x: number; y: number }[]`

Find a path between two world-space points. Returns an array of centroid waypoints through the polygon graph, or an empty array if no path exists.

```typescript
const path = navMesh.findPath({ x: 10, y: 10 }, { x: 190, y: 90 });
// → [{ x: 50, y: 50 }, { x: 150, y: 50 }]
```

**Point resolution:** `findPath` uses ray-cast point-in-polygon containment first, then centroid-distance fallback for points that fall outside all polygons.

---

## `navMesh.update(dt: number): void`

Step the system each frame. Currently reserved for future dynamic-obstacle support. Call it in `onUpdate` to keep the API forward-compatible:

```typescript
override onUpdate(dt: number): void {
  navMesh.update(dt);
}
```

---

## Full example

```typescript
import { NavMeshSystem, type NavMeshData } from "@emptysock/engine";

export class LevelScene extends Scene {
  private _navMesh!: NavMeshSystem;

  override async onLoad(): Promise<void> {
    const response = await fetch("assets/levels/level1-navmesh.json");
    const data = (await response.json()) as NavMeshData;

    this._navMesh = new NavMeshSystem();
    this._navMesh.load(data);
  }

  override onUpdate(dt: number): void {
    this._navMesh.update(dt);

    // Find a path from enemy to player:
    const path = this._navMesh.findPath(enemy.position, player.position);
    if (path.length > 0) {
      const next = path[0];
      // move enemy toward next waypoint...
    }
  }
}
```

---

## Tips

- Export NavMesh JSON from the Tilemap Editor. Place it under `apps/ide/public/assets/` so it is served as a static asset.
- Paths return polygon centroids, not fine-grained world positions. Smooth the path or steer directly toward waypoints depending on your needs.
- If `findPath` returns an empty array for positions that look reachable, the start or end point may lie outside all polygons. Use centroid-distance fallback to snap to the nearest polygon first.

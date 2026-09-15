# Navigation

EmptySock's `NavMeshSystem` provides polygon-based 2D pathfinding using A\* on a convex polygon graph.

For the complete API, see [NavMeshSystem reference](../reference/systems/nav-mesh-system.md).

---

## How it works

`NavMeshSystem` accepts a pre-built polygon graph — a `NavMeshData` object describing convex polygons and their neighbours. It finds the shortest walkable path between two points by traversing this graph.

The NavMesh data must be built offline (in the Tilemap Editor or a preprocessing step). There is no API to generate a NavMesh from a Tilemap at runtime. Building a polygon graph from raw tile data requires triangulation and polygon merging, which would block the main thread for hundreds of milliseconds on a large level.

---

## Setup

```typescript
import { NavMeshSystem, type NavMeshData } from "@emptysock/engine";

export class GameScene extends Scene {
  private _nav!: NavMeshSystem;

  override async onLoad(): Promise<void> {
    this._nav = new NavMeshSystem();

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

    this._nav.load(data);
  }

  override onUpdate(dt: number): void {
    this._nav.update(dt); // call each frame (reserved for dynamic obstacle support)
  }
}
```

---

## Finding a path

```typescript
const path = this._nav.findPath(
  { x: 10, y: 10 }, // start
  { x: 190, y: 90 }, // end
);
// path = [{ x: 50, y: 50 }, { x: 150, y: 50 }]
```

The returned path is an array of waypoint positions (polygon centroids) from start to end. If no path exists, returns an empty array.

**Point resolution:** `findPath` uses ray-cast point-in-polygon containment first, then centroid distance fallback for points that fall outside all polygons.

---

## Following a path

There is no built-in path-following component. Implement movement along waypoints in your entity's update logic or a coroutine:

```typescript
entity.startCoroutine(function* followPath(
  path: Array<{ x: number; y: number }>,
) {
  for (const waypoint of path) {
    yield waitUntil(() => {
      const dx = waypoint.x - entity.position.x;
      const dy = waypoint.y - entity.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) return true; // close enough to waypoint

      const speed = 120;
      entity.position = {
        x: entity.position.x + (dx / dist) * speed * 0.016,
        y: entity.position.y + (dy / dist) * speed * 0.016,
      };
      return false;
    });
  }
});
```

---

## Building NavMesh data offline

The recommended workflow:

1. Design the level in the Tilemap Editor.
2. Export the Tilemap as `.esmap`.
3. Run an offline preprocessing tool (your own script or a build step) that reads the Tilemap and produces `NavMeshData` JSON.
4. Load the JSON at runtime with `navMesh.load(parsedData)`.

The Tilemap Editor's **NavMesh** layer export button produces a polygon graph in `NavMeshData` format — check the editor toolbar when a level is open.

---

## Tips

- Recompute the path only when the target position changes significantly, not every frame.
- Smooth the path by interpolating between centroids rather than snapping directly to them.
- Use `NavMeshSystem.update(dt)` in `onUpdate` to support future dynamic obstacle APIs — calling it is a no-op today but costs almost nothing.

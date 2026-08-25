import { describe, it, expect } from 'vitest';
import { PathfindingSystem } from '../systems/PathfindingSystem.js';
import type { GridCell } from '../systems/PathfindingSystem.js';

const W: GridCell = { walkable: true, weight: 1 };
const B: GridCell = { walkable: false, weight: 1 };

describe('PathfindingSystem', () => {
  const pf = new PathfindingSystem();

  it('finds path in simple 3x1 grid (from x=0 to x=2)', () => {
    const grid = [[W, W, W]];
    const result = pf.findPath({ from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, grid, allowDiagonal: false });
    expect(result.found).toBe(true);
    expect(result.path[0]).toEqual({ x: 0, y: 0 });
    expect(result.path[result.path.length - 1]).toEqual({ x: 2, y: 0 });
  });

  it('returns found=false when path is blocked', () => {
    const grid = [[W, B, W]];
    const result = pf.findPath({ from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, grid, allowDiagonal: false });
    expect(result.found).toBe(false);
    expect(result.path.length).toBe(0);
  });

  it('allowDiagonal=false forces straight path', () => {
    const grid = [
      [W, W, W],
      [W, W, W],
      [W, W, W],
    ];
    const result = pf.findPath({ from: { x: 0, y: 0 }, to: { x: 2, y: 2 }, grid, allowDiagonal: false });
    expect(result.found).toBe(true);
    // No diagonal step should appear
    for (let i = 1; i < result.path.length; i++) {
      const curr = result.path[i];
      const prev = result.path[i - 1];
      if (curr === undefined || prev === undefined) continue;
      const dx = Math.abs(curr.x - prev.x);
      const dy = Math.abs(curr.y - prev.y);
      expect(dx + dy).toBe(1);
    }
  });

  it('allowDiagonal=true can take diagonal step', () => {
    const grid = [
      [W, W],
      [W, W],
    ];
    const result = pf.findPath({ from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, grid, allowDiagonal: true });
    expect(result.found).toBe(true);
    expect(result.path.length).toBe(2); // direct diagonal
  });

  it('finds detour around wall', () => {
    const grid = [
      [W, B, W],
      [W, W, W],
    ];
    const result = pf.findPath({ from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, grid, allowDiagonal: false });
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(3);
  });
});

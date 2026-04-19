import { describe, it, expect } from 'vitest';
import { astar } from './astar.js';
import { CELL } from './config.js';

// New map "The Ring" open cells:
// Row 6, cols 8-11 — interior ground, MAP=0, no walls between them (straight corridor)
// Row 2, col 2 — north ring floor, MAP=0
// Row 2, col 5 — tower wall in new map; use interior cells instead
const open = (col, row) => [col * CELL + CELL / 2, row * CELL + CELL / 2];

describe('astar', () => {
  it('returns empty array when start equals destination cell', () => {
    const [sx, sz] = open(8, 6);
    expect(astar(sx, sz, sx + 0.1, sz + 0.1)).toEqual([]);
  });

  it('finds a path between two open cells', () => {
    // col 8→11, row 6 — straight interior corridor, all MAP=0 HMAP=0
    const [sx, sz] = open(8, 6);
    const [ex, ez] = open(11, 6);
    const path = astar(sx, sz, ex, ez);
    expect(path.length).toBeGreaterThan(0);
    const [lx, lz] = path[path.length - 1];
    expect(lx).toBeCloseTo(ex, 0);
    expect(lz).toBeCloseTo(ez, 0);
  });

  it('returns empty array when destination is inside a wall', () => {
    // (0,0) is a border wall cell in every map
    const [sx, sz] = open(8, 6);
    const path = astar(sx, sz, 0 * CELL + CELL / 2, 0 * CELL + CELL / 2);
    expect(path).toEqual([]);
  });

  it('path waypoints are in world-space (multiples of CELL + half)', () => {
    const [sx, sz] = open(8, 6);
    const [ex, ez] = open(8, 11);
    const path = astar(sx, sz, ex, ez);
    expect(path.length).toBeGreaterThan(0);
    for (const [wx, wz] of path) {
      expect(wx % CELL).toBeCloseTo(CELL / 2, 5);
      expect(wz % CELL).toBeCloseTo(CELL / 2, 5);
    }
  });

  it('path length is Manhattan-distance optimal for a straight corridor', () => {
    // Moving 3 cells right along row 6 interior (cols 8→11, all open)
    const [sx, sz] = open(8, 6);
    const [ex, ez] = open(11, 6);
    const path = astar(sx, sz, ex, ez);
    expect(path.length).toBeLessThanOrEqual(4);
  });
});

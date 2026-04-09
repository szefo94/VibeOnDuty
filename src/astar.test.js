import { describe, it, expect } from 'vitest';
import { astar } from './astar.js';
import { CELL } from './config.js';

// Map has open floor at (1,1)–(22,22). Walls on the border (row/col 0 and 23).
// Two known open cells for path testing: (1,1) and (3,1) (row 1, cols 1 and 3 are open).
const open = (col, row) => [col * CELL + CELL / 2, row * CELL + CELL / 2];

describe('astar', () => {
  it('returns empty array when start equals destination cell', () => {
    const [sx, sz] = open(2, 2);
    expect(astar(sx, sz, sx + 0.1, sz + 0.1)).toEqual([]);
  });

  it('finds a path between two open cells', () => {
    const [sx, sz] = open(2, 2);
    const [ex, ez] = open(5, 2);
    const path = astar(sx, sz, ex, ez);
    expect(path.length).toBeGreaterThan(0);
    // Last waypoint should be near the destination cell centre
    const [lx, lz] = path[path.length - 1];
    expect(lx).toBeCloseTo(ex, 0);
    expect(lz).toBeCloseTo(ez, 0);
  });

  it('returns empty array when destination is inside a wall', () => {
    // (0,0) is a border wall cell
    const [sx, sz] = open(2, 2);
    const path = astar(sx, sz, 0 * CELL + CELL / 2, 0 * CELL + CELL / 2);
    expect(path).toEqual([]);
  });

  it('path waypoints are in world-space (multiples of CELL + half)', () => {
    const [sx, sz] = open(2, 2);
    const [ex, ez] = open(2, 5);
    const path = astar(sx, sz, ex, ez);
    expect(path.length).toBeGreaterThan(0);
    for (const [wx, wz] of path) {
      // Each waypoint should be a cell centre: n*CELL + CELL/2
      expect(wx % CELL).toBeCloseTo(CELL / 2, 5);
      expect(wz % CELL).toBeCloseTo(CELL / 2, 5);
    }
  });

  it('path length is Manhattan-distance optimal for a straight corridor', () => {
    // Moving 3 cells right along row 2 (all open)
    const [sx, sz] = open(2, 2);
    const [ex, ez] = open(5, 2);
    const path = astar(sx, sz, ex, ez);
    // Straight line = 3 steps, so path should have at most 4 waypoints (including start)
    expect(path.length).toBeLessThanOrEqual(4);
  });
});

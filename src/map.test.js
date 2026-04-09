import { describe, it, expect } from 'vitest';
import { groundElevation, canMoveTo, hAt } from './map.js';
import { CELL, PLAYER_H } from './config.js';
import { H1, H2 } from './map.js';

// Cell (9,4) in the MAP is a ramp-N (value 4): low at -Z edge, high at +Z edge.
// Cell (2,2) is open floor with HMAP elevation H1.
// Cell (0,0) is a border wall.

describe('groundElevation', () => {
  it('returns 0 for a flat open floor cell with no elevation', () => {
    // Row 1, col 7 — all four bilinear corners (cols 7-8, rows 1-2) are HMAP=0
    const wx = 7 * CELL + CELL / 2;
    const wz = 1 * CELL + CELL / 2;
    expect(groundElevation(wx, wz)).toBeCloseTo(0);
  });

  it('interpolates ramp-N (cell 4) from 0 at low edge to H2 at high edge', () => {
    // Cell col=9, row=4 is ramp-N: low at z=row*CELL, high at z=(row+1)*CELL
    const col = 9, row = 4;
    const lowZ  = row * CELL;        // south edge of cell → elevation 0
    const highZ = (row + 1) * CELL;  // north edge → elevation H2
    const midZ  = row * CELL + CELL / 2;

    const wx = col * CELL + CELL / 2;
    expect(groundElevation(wx, lowZ + 0.01)).toBeCloseTo(0, 1);
    expect(groundElevation(wx, highZ - 0.01)).toBeCloseTo(H2, 1);
    expect(groundElevation(wx, midZ)).toBeCloseTo(H2 / 2, 1);
  });

  it('returns H1 at centre of an H1-elevated flat cell', () => {
    // Row 2, col 2 has HMAP H1
    const wx = 2 * CELL + CELL / 2;
    const wz = 2 * CELL + CELL / 2;
    expect(groundElevation(wx, wz)).toBeCloseTo(H1);
  });
});

describe('canMoveTo', () => {
  it('blocks movement into a solid wall cell', () => {
    // Border wall at col=0, row=0
    expect(canMoveTo(CELL / 2, CELL / 2, 0)).toBe(false);
  });

  it('allows movement into an open floor cell at ground level', () => {
    const wx = 2 * CELL + CELL / 2;
    const wz = 2 * CELL + CELL / 2;
    expect(canMoveTo(wx, wz, 0)).toBe(true);
  });

  it('blocks stepping onto an elevated slab that exceeds MAX_STEP from ground', () => {
    // H2 = 1.4 which is > MAX_STEP (0.8), so stepping from y=0 onto an H2 cell is blocked
    const wx = 2 * CELL + CELL / 2; // col 2, row 2 has H1 elevation
    const wz = 2 * CELL + CELL / 2;
    // currentGroundY far below the cell height
    expect(canMoveTo(wx, wz, -2)).toBe(false);
  });

  it('allows movement when airborne regardless of step height', () => {
    const wx = 2 * CELL + CELL / 2;
    const wz = 2 * CELL + CELL / 2;
    expect(canMoveTo(wx, wz, -2, true)).toBe(true);
  });
});

describe('hAt', () => {
  it('returns 0 for out-of-bounds coordinates', () => {
    expect(hAt(-1, 0)).toBe(0);
    expect(hAt(0, -1)).toBe(0);
    expect(hAt(999, 0)).toBe(0);
  });

  it('returns H1 for known elevated flat cells', () => {
    // HMAP[2][2] = H1
    expect(hAt(2, 2)).toBe(H1);
  });
});

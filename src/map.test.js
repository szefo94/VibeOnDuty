import { describe, it, expect } from 'vitest';
import { groundElevation, canMoveTo, hAt } from './map.js';
import { CELL } from './config.js';
import { H1, H2 } from './map.js';

// New map "The Ring" reference cells:
// Cell (col=8, row=6)  — interior ground floor, MAP=0, HMAP=0
// Cell (col=7, row=19) — ramp-N (value 4): low at north edge, high at south edge
// Cell (col=11, row=10) — interior raised floor, MAP=0, HMAP=H1

describe('groundElevation', () => {
  it('returns 0 for a flat open floor cell with no elevation', () => {
    // Row 6, col 8 — interior ground, all four bilinear corners at HMAP=0
    const wx = 8 * CELL + CELL / 2;
    const wz = 6 * CELL + CELL / 2;
    expect(groundElevation(wx, wz)).toBeCloseTo(0);
  });

  it('interpolates ramp-N (cell 4) from 0 at low edge to H2 at high edge', () => {
    // Cell col=7, row=19 is ramp-N (4): tz=0 at north edge → 0, tz=1 at south edge → H2
    const col = 7, row = 19;
    const lowZ  = row * CELL;           // north edge → elevation 0
    const highZ = (row + 1) * CELL;     // south edge → elevation H2
    const midZ  = row * CELL + CELL / 2;

    const wx = col * CELL + CELL / 2;
    expect(groundElevation(wx, lowZ  + 0.01)).toBeCloseTo(0,   1);
    expect(groundElevation(wx, highZ - 0.01)).toBeCloseTo(H2,  1);
    expect(groundElevation(wx, midZ       )).toBeCloseTo(H2 / 2, 1);
  });

  it('returns H1 at centre of an H1-elevated flat cell', () => {
    // Row 10, col 11 — central room interior floor, HMAP=H1
    const wx = 11 * CELL + CELL / 2;
    const wz = 10 * CELL + CELL / 2;
    expect(groundElevation(wx, wz)).toBeCloseTo(H1);
  });
});

describe('canMoveTo', () => {
  it('blocks movement into a solid wall cell', () => {
    // Border wall at col=0, row=0
    expect(canMoveTo(CELL / 2, CELL / 2, 0)).toBe(false);
  });

  it('allows movement into an open floor cell at ground level', () => {
    // Row 6, col 8 — interior ground, HMAP=0; step from y=0 is 0
    const wx = 8 * CELL + CELL / 2;
    const wz = 6 * CELL + CELL / 2;
    expect(canMoveTo(wx, wz, 0)).toBe(true);
  });

  it('blocks stepping onto an elevated slab that exceeds MAX_STEP from ground', () => {
    // H2 = 1.4 > MAX_STEP (0.8); ring cell col=2, row=2 is at H2
    const wx = 2 * CELL + CELL / 2;
    const wz = 2 * CELL + CELL / 2;
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
    // HMAP[10][11] = H1 (central room interior)
    expect(hAt(11, 10)).toBe(H1);
  });
});

import { describe, it, expect } from 'vitest';
import { rampOf, isRamp, isCrack, isColumn, isSideWall, navCell, rampId, rampSurface } from './tiles.js';
import { revolvedFrac, diagFrac, RAMP_PROFILE } from './rampMath.js';

// Reference implementation: the exact arithmetic that lived inline in map.js's
// _floorSurface() before tiles.js existed. The refactor must not move a single
// surface by any amount, so the new decoder is checked against this for every tile
// id at every sample point.
function legacySurface(cell, tx, tz, H2) {
  if (cell >= 129 && cell <= 152) {
    const type = Math.floor((cell - 129) / 6), grp = (cell - 129) % 6;
    const [loY, hiYRaw] = RAMP_PROFILE[grp];
    const hiY = hiYRaw ?? H2;
    const f = [tx*(1-tz), (1-tx)*(1-tz), tx*tz, (1-tx)*tz][type];
    return loY + (hiY - loY) * f;
  }
  if (cell >= 81 && cell <= 128) {
    const type = Math.floor((cell - 81) / 6), grp = (cell - 81) % 6;
    const [loY, hiYRaw] = RAMP_PROFILE[grp];
    return loY + ((hiYRaw ?? H2) - loY) * revolvedFrac(type, tx, tz);
  }
  if (cell >= 33 && cell <= 80) {
    const diagType = Math.floor((cell - 33) / 6), grp = (cell - 33) % 6;
    const [loY, hiYRaw] = RAMP_PROFILE[grp];
    return loY + ((hiYRaw ?? H2) - loY) * diagFrac(diagType, tx, tz);
  }
  if (cell >= 4 && cell <= 27) {
    const dir = (cell - 4) % 4, grp = Math.floor((cell - 4) / 4);
    const [loY, hiYRaw] = RAMP_PROFILE[grp];
    const hiY = hiYRaw ?? H2;
    const frac = dir === 0 ? tz : dir === 1 ? (1 - tz) : dir === 2 ? tx : (1 - tx);
    return loY + (hiY - loY) * frac;
  }
  return null; // not a ramp
}

describe('tiles — tile ID decoding', () => {
  it('classifies every id in the space exactly once', () => {
    for (let id = 0; id <= 152; id++) {
      const kinds = [isRamp(id), isCrack(id), isColumn(id), isSideWall(id)].filter(Boolean);
      expect(kinds.length, `id ${id} matched ${kinds.length} kinds`).toBeLessThanOrEqual(1);
    }
  });

  it('matches the documented family ranges', () => {
    expect(rampOf(3)).toBeNull();
    expect(rampOf(4).family).toBe('straight');
    expect(rampOf(27).family).toBe('straight');
    expect(rampOf(28)).toBeNull();          // column sits inside the ramp span
    expect(rampOf(32)).toBeNull();          // side walls too
    expect(rampOf(33).family).toBe('diagonal');
    expect(rampOf(80).family).toBe('diagonal');
    expect(rampOf(81).family).toBe('revolved');
    expect(rampOf(128).family).toBe('revolved');
    expect(rampOf(129).family).toBe('corner');
    expect(rampOf(152).family).toBe('corner');
    expect(rampOf(153)).toBeNull();
  });

  it('round-trips every ramp id through decode and encode', () => {
    for (let id = 0; id <= 152; id++) {
      const r = rampOf(id);
      if (r) expect(rampId(r.family, r.shape, r.band), `id ${id}`).toBe(id);
    }
  });

  it('navCell folds columns to solid and side walls to floor', () => {
    expect(navCell(28)).toBe(1);
    for (let id = 29; id <= 32; id++) expect(navCell(id)).toBe(0);
    expect(navCell(0)).toBe(0);
    expect(navCell(1)).toBe(1);
    expect(navCell(7)).toBe(7);   // ramps pass through untouched
  });

  it('reproduces the pre-refactor surface height for every id and sample point', () => {
    const H2 = 1.4;
    let checked = 0;
    for (let id = 0; id <= 160; id++) {
      for (let i = 0; i <= 4; i++) {
        for (let j = 0; j <= 4; j++) {
          const tx = i / 4, tz = j / 4;
          const legacy = legacySurface(id, tx, tz, H2);
          const now = rampSurface(id, tx, tz, H2);
          if (legacy === null) { expect(now, `id ${id} should not be a ramp`).toBeNull(); continue; }
          expect(now, `id ${id} at ${tx},${tz}`).toBeCloseTo(legacy, 10);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(3000);   // all 144 ramp ids x 25 points
  });
});

import { describe, it, expect } from 'vitest';
import { normA, slerp } from './math.js';

describe('normA', () => {
  it('leaves values in (-π, π] unchanged', () => {
    expect(normA(0)).toBeCloseTo(0);
    expect(normA(1)).toBeCloseTo(1);
    expect(normA(-1)).toBeCloseTo(-1);
  });

  it('wraps values above π back into range', () => {
    expect(normA(Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1);
    expect(normA(3 * Math.PI)).toBeCloseTo(Math.PI);
  });

  it('wraps values below -π back into range', () => {
    expect(normA(-Math.PI - 0.1)).toBeCloseTo(Math.PI - 0.1);
    expect(normA(-3 * Math.PI)).toBeCloseTo(-Math.PI);
  });

  it('handles full rotations (2π multiples)', () => {
    expect(normA(2 * Math.PI)).toBeCloseTo(0);
    expect(normA(-2 * Math.PI)).toBeCloseTo(0);
  });
});

describe('slerp', () => {
  it('returns target when within one step', () => {
    expect(slerp(0, 0.1, 5, 1)).toBeCloseTo(0.1);
  });

  it('steps toward target by spd*dt', () => {
    expect(slerp(0, 1, 0.5, 1)).toBeCloseTo(0.5);
  });

  it('steps in the negative direction', () => {
    expect(slerp(0, -1, 0.5, 1)).toBeCloseTo(-0.5);
  });

  it('takes the short arc across the π boundary', () => {
    // cur = π-0.1, tgt = -π+0.1 — they are only 0.2 apart through the boundary
    // step = 0.05 (too small to reach target), so it steps in the positive direction
    const cur = Math.PI - 0.1;
    const tgt = -Math.PI + 0.1;
    const result = slerp(cur, tgt, 0.05, 1);
    // Short arc goes positive (toward π), so result > cur
    expect(result).toBeGreaterThan(cur);
    expect(result).toBeCloseTo(Math.PI - 0.05);
  });
});

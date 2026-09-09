import { describe, it, expect } from 'vitest';
import { normA, slerp, segPointDist2 } from './math.js';

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

describe('segPointDist2 — swept projectile hit test', () => {
  const V = (x, y, z) => ({ x, y, z });
  const HIT_R = 0.75;                 // enemy hit sphere radius in shoot.js
  const d = (a, b, p) => Math.sqrt(segPointDist2(a, b, p));

  it('measures against the whole travel segment, not the end point', () => {
    // Target sits halfway along the step: a hit the old point test could not see.
    expect(d(V(0, 0, 0), V(4, 0, 0), V(2, 0, 0))).toBeCloseTo(0);
  });

  it('clamps to the segment ends instead of extending the line', () => {
    expect(d(V(0, 0, 0), V(1, 0, 0), V(-3, 0, 0))).toBeCloseTo(3);
    expect(d(V(0, 0, 0), V(1, 0, 0), V(5, 0, 0))).toBeCloseTo(4);
  });

  it('handles a zero-length step without NaN', () => {
    expect(d(V(1, 2, 3), V(1, 2, 3), V(1, 2, 5))).toBeCloseTo(2);
  });

  it('registers the hit at the dt clamp, where a point test tunnels through', () => {
    // loop.js clamps dt to 0.05 s and BULLET_SPEED is 65, so one frame can advance
    // 3.25 m while the hit sphere is only 1.5 m across.
    const step = 65 * 0.05;
    expect(step).toBeGreaterThan(HIT_R * 2);            // tunnelling condition holds
    const a = V(0, 0, 0), b = V(step, 0, 0), enemy = V(step / 2, 0, 0);
    expect(d(a, b, enemy)).toBeLessThan(HIT_R);         // swept  -> hit
    const endDist = Math.hypot(b.x - enemy.x, b.y - enemy.y, b.z - enemy.z);
    expect(endDist).toBeGreaterThan(HIT_R);             // point  -> miss
  });

  it('still misses shots that genuinely pass wide', () => {
    expect(d(V(0, 0, 0), V(4, 0, 0), V(2, 0, 1.2))).toBeGreaterThan(HIT_R);
  });
});

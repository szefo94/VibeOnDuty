import { describe, it, expect } from 'vitest';
import { groundElevation, hAt, isRamp, MAP, MAP_W, MAP_H, H2 } from '../map.js';
import { CELL } from '../config.js';

// Entities (mesh placement) and combat (hitbox placement) must derive their ground
// height from the same function. They used to disagree: entities called hAt(), combat
// called groundElevation(), so on ramps the hit sphere floated above the visible body.
describe('entity ground height matches hitbox ground height', () => {
  const rampCells = [];
  for (let r = 0; r < MAP_H; r++)
    for (let c = 0; c < MAP_W; c++)
      if (isRamp(MAP[r][c])) rampCells.push([c, r]);

  it('the test map actually contains ramps', () => {
    expect(rampCells.length).toBeGreaterThan(0);
  });

  it('hAt() is flat across a ramp cell while the real surface rises', () => {
    const [c, r] = rampCells[0];
    const flat = hAt(c, r);
    let maxSurface = -Infinity;
    for (let i = 0; i <= 10; i++) {
      const wx = (c + i / 10) * CELL, wz = (r + i / 10) * CELL;
      maxSurface = Math.max(maxSurface, groundElevation(wx, wz));
    }
    // This gap is exactly the desync that put enemy meshes below their hitboxes.
    expect(maxSurface - flat).toBeGreaterThan(H2 * 0.5);
  });

  it('groundElevation is continuous across a ramp (no snapping)', () => {
    const [c, r] = rampCells[0];
    let prev = null, maxJump = 0;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const y = groundElevation((c + t) * CELL, (r + t) * CELL);
      if (prev !== null) maxJump = Math.max(maxJump, Math.abs(y - prev));
      prev = y;
    }
    expect(maxJump).toBeLessThan(H2 * 0.5);
  });
});

import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import { PLAYER_H, PLAYER_R } from '../config.js';

function fixture(tiles, heightmap = tiles.map((row) => row.map(() => 0))) {
  return {
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    heightmap,
    H2: 1.4,
    spawnAttacker: { x: 2, z: 2 },
    spawnDefender: { x: 2, z: 2 },
  };
}

describe('room-owned world', () => {
  it('allows exactly tangent wall contact but blocks inward penetration', () => {
    // Adjacent wall cells deliberately render as a wall rather than an isolated pillar.
    const world = createSimulation(fixture([[0, 1], [0, 1]])).world;
    expect(world.canOccupy({ x: 4 - PLAYER_R, y: PLAYER_H, z: 2 })).toBe(true);
    expect(world.canOccupy({ x: 4 - PLAYER_R + 0.001, y: PLAYER_H, z: 2 })).toBe(false);
  });
});

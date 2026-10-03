import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import { PLAYER_H, PLAYER_R } from '../config.js';
import { createWorld, bodiesOverlap } from './world.js';
import { bunkerData } from './maps/bunker.js';
import { bunkerMapDef } from '../maps/bunker.js';
import { groundElevation as renderedGround, setActiveMap } from '../map.js';
import { rampId, rampSurface } from '../tiles.js';
import { execFileSync } from 'node:child_process';

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
    const world = createSimulation(
      fixture([
        [0, 1],
        [0, 1],
      ])
    ).world;
    expect(world.canOccupy({ x: 4 - PLAYER_R, y: PLAYER_H, z: 2 })).toBe(true);
    expect(world.canOccupy({ x: 4 - PLAYER_R + 0.001, y: PLAYER_H, z: 2 })).toBe(false);
  });

  it('allows tangent body separation and blocks penetrating bodies on the same floor', () => {
    const a = { x: 2, y: PLAYER_H, z: 2 };
    expect(bodiesOverlap(a, { ...a, x: a.x + PLAYER_R * 2 })).toBe(false);
    expect(bodiesOverlap(a, { ...a, x: a.x + PLAYER_R * 2 - 0.001 })).toBe(true);
    expect(bodiesOverlap(a, { ...a, y: a.y + 4 })).toBe(false);
    const sim = createSimulation(fixture([[0, 0]]));
    const first = sim.addPlayer('a'),
      second = sim.addPlayer('b');
    // Deterministic fallback separates identical team spawn locations.
    expect(bodiesOverlap(first, second)).toBe(false);
    expect(second.x).toBe(6);
  });

  it('keeps admission pending when every valid position is occupied, then retries', () => {
    const sim = createSimulation(fixture([[0]]));
    sim.addPlayer('a');
    expect(sim.addPlayer('b').alive).toBe(false);
    sim.removePlayer('a');
    sim.stepSimulation(1 / 30);
    expect(sim.snapshot().players[0].alive).toBe(true);
    expect(sim.world.canOccupy(sim.snapshot().players[0])).toBe(true);
  });

  it('owns caller data and independent simulation state', () => {
    const source = fixture([[0, 0]]);
    const a = createSimulation(source),
      b = createSimulation(source);
    source.tiles[0][0] = 1;
    source.heightmap[0][0] = 9;
    source.spawnAttacker.x = 999;
    expect(a.world.groundElevation(2, 2)).toBe(0);
    expect(a.addPlayer('a').x).toBe(2);
    expect(b.snapshot().players).toEqual([]);
    expect(b.addPlayer('b').x).toBe(2);
    a.stepSimulation(0.1);
    expect(b.snapshot().timeRemaining).toBe(600);
  });

  it('imports the canonical room in Node with no DOM, WebGL, or Three dependency', () => {
    const source =
      "import {TdmRoom} from './server/tdmRoom.js'; if(globalThis.document || globalThis.window || !TdmRoom) process.exit(1); console.log('headless');";
    expect(
      execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' })
    ).toContain('headless');
  });

  it('shares canonical renderer arrays and matches every bunker surface sample', () => {
    for (const key of ['tiles', 'heightmap', 'spawnPlayer', 'spawnAttacker', 'spawnDefender'])
      expect(bunkerMapDef[key]).toEqual(bunkerData[key]);
    expect(Object.isFrozen(bunkerData.tiles[0])).toBe(true);
    const world = createWorld(bunkerData);
    setActiveMap(bunkerMapDef);
    for (let r = 0; r < 24; r++)
      for (let c = 0; c < 24; c++)
        for (const t of [0.05, 0.5, 0.95]) {
          const x = (c + t) * 4,
            z = (r + t) * 4;
          expect(world.groundElevation(x, z)).toBeCloseTo(renderedGround(x, z), 9);
        }
    expect(world.worldToCell(9, 13)).toEqual([2, 3]);
  });

  it('selects absolute stacked floor surfaces using eye height', () => {
    const data = fixture([[0, 0]], [[0, 0]]);
    data.floors = [
      { base: 0, tiles: [[0, 0]], heightmap: [[0, 0]] },
      { base: 4, tiles: [[0, 0]], heightmap: [[4, 4]] },
    ];
    const world = createWorld(data);
    expect(world.groundElevation(2, 2, PLAYER_H)).toBe(0);
    expect(world.groundElevation(2, 2, 4 + PLAYER_H)).toBe(4);
    expect(world.groundElevation(2, 2)).toBe(4);
    expect(world.canOccupy({ x: 2, y: PLAYER_H, z: 2 })).toBe(true);
    expect(world.canOccupy({ x: 2, y: 4 + PLAYER_H, z: 2 })).toBe(true);
    expect(world.sweepObstruction({ x: 2, y: 5, z: 2 }, { x: 2, y: 3, z: 2 })).toBeCloseTo(0.5);
  });

  it('matches codec ramp surfaces, blocks earliest sloped/flat surfaces, and forbids a high step', () => {
    for (const family of ['straight', 'diagonal', 'corner', 'revolved']) {
      const tile = rampId(family, 0, 0);
      const world = createWorld(fixture([[tile]]));
      expect(world.groundElevation(1, 3)).toBeCloseTo(rampSurface(tile, 0.25, 0.75, 1.4));
      expect(world.sweepObstruction({ x: 2, y: 3, z: 2 }, { x: 2, y: 0.1, z: 2 })).not.toBeNull();
    }
    const world = createWorld(fixture([[0, 0]], [[0, 1.4]]));
    expect(world.canOccupy({ x: 6, y: PLAYER_H, z: 2 })).toBe(false);
    expect(world.sweepObstruction({ x: 6, y: 2, z: 2 }, { x: 6, y: 0.5, z: 2 })).toBeCloseTo(0.4);
  });

  it('blocks thin crack panels while passing their visible eye-height slot', () => {
    const world = createWorld(fixture([[2]]));
    expect(world.canOccupy({ x: 2, y: PLAYER_H, z: 2 })).toBe(false);
    expect(
      world.sweepObstruction({ x: 2, y: PLAYER_H, z: 0.5 }, { x: 2, y: PLAYER_H, z: 3.5 })
    ).toBeNull();
    expect(world.sweepObstruction({ x: 2, y: 0.5, z: 0.5 }, { x: 2, y: 0.5, z: 3.5 })).toBeCloseTo(
      (1.825 - 0.5) / 3
    );
  });

  it('uses circular column collision and earliest obstruction when crossing multiple cells', () => {
    const world = createWorld(fixture([[0, 28, 0, 1, 1]]));
    expect(world.canOccupy({ x: 6 - 0.62 - PLAYER_R, y: PLAYER_H, z: 2 })).toBe(true);
    expect(world.canOccupy({ x: 6 - 0.62 - PLAYER_R + 0.001, y: PLAYER_H, z: 2 })).toBe(false);
    expect(world.sweepObstruction({ x: 2, y: 1, z: 2 }, { x: 18, y: 1, z: 2 })).toBeCloseTo(
      (6 - 0.62 - 2) / 16
    );
  });
});

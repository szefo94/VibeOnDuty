import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import { bunkerData } from './maps/bunker.js';
import { stepMovement } from './movement.js';
import { createWorld } from './world.js';

const flat = {
  ...bunkerData,
  width: 8,
  height: 8,
  tiles: Array.from({ length: 8 }, () => Array(8).fill(0)),
  heightmap: Array.from({ length: 8 }, () => Array(8).fill(0)),
  spawnAttacker: { x: 10, z: 10 },
  spawnDefender: { x: 22, z: 22 },
};
function command(seq, changes = {}) {
  return { protocolVersion: 1, seq, ackTick: seq - 1, matchGeneration: 1, lifeGeneration: 1,
    moveX: 0, moveZ: 0, yaw: 0, pitch: 0, fire: false, reload: false,
    sprint: false, jump: false, crouch: false, aiming: false, neutral: false, ...changes };
}
function move(changes, ticks = 10, map = flat) {
  const sim = createSimulation(map);
  const body = sim.addPlayer('a');
  for (let i = 1; i <= ticks; i++) {
    sim.queueInput('a', command(i, changes));
    sim.stepSimulation(1 / 30);
  }
  return { sim, body };
}

describe('authoritative minimum movement', () => {
  it('walks at 6m/s and sprints at 9.9m/s using only the server step', () => {
    expect(move({ moveX: 1 }).body.x).toBeCloseTo(12);
    expect(move({ moveX: 1, sprint: true }).body.x).toBeCloseTo(13.3);
  });
  it('normalizes diagonals and derives forward/right from yaw', () => {
    const b = move({ moveX: 1, moveZ: 1 }).body;
    expect(Math.hypot(b.x - 10, b.z - 10)).toBeCloseTo(2);
    expect(move({ moveZ: 1, yaw: Math.PI / 2 }).body.x).toBeCloseTo(8);
  });
  it('preserves crouched speed 6 * 0.72 = 4.32 and feet when stance changes', () => {
    const { sim, body } = move({ moveX: 1, sprint: true, crouch: true });
    expect(body.x).toBeCloseTo(11.44);
    expect(body.y).toBeCloseTo(0.85);
    expect(body.crouching).toBe(true);
    sim.queueInput('a', command(11));
    sim.stepSimulation(1 / 30);
    expect(body.y).toBeCloseTo(1.65);
  });
  it('uses jump force 7.5 and gravity 18, lands and never repeats a held jump', () => {
    const { sim, body } = move({ jump: true }, 1);
    expect(body.verticalVelocity).toBeCloseTo(6.9);
    expect(body.y).toBeCloseTo(1.88);
    expect(body.onGround).toBe(false);
    for (let i = 2; i <= 60; i++) {
      sim.queueInput('a', command(i, { jump: true }));
      sim.stepSimulation(1 / 30);
    }
    expect(body.y).toBeCloseTo(1.65);
    expect(body.onGround).toBe(true);
  });
  it('replicates aiming and stops dead bodies, including a jump already in flight', () => {
    const { sim, body } = move({ aiming: true, jump: true }, 1);
    expect(body.aiming).toBe(true);
    body.alive = false;
    body.health = 0;
    const before = { x: body.x, y: body.y, z: body.z };
    sim.queueInput('a', command(2, { moveX: 1, sprint: true }));
    sim.stepSimulation(1 / 30);
    expect({ x: body.x, y: body.y, z: body.z }).toEqual(before);
  });
  it('rejects invalid timesteps and freezes movement after the match timer', () => {
    const { sim, body } = move({}, 1);
    const before = { ...body };
    for (const dt of [0, -1, NaN, Infinity, 0.101]) stepMovement(body, command(2, { moveX: 1 }), sim.world, dt);
    expect(body).toEqual(before);
    const ended = createSimulation(flat, { matchSeconds: 1 });
    const frozen = ended.addPlayer('a');
    for (let i = 0; i < 30; i++) ended.stepSimulation(1 / 30);
    expect(ended.snapshot().phase).toBe('results');
    expect(ended.queueInput('a', command(1, { ackTick: ended.snapshot().currentTick, moveX: 1 }))).toBe(false);
    ended.stepSimulation(1 / 30);
    expect(frozen.x).toBe(10);
  });
  it('blocks radius penetration and steps exactly 0.8m but never higher', () => {
    const map = { ...flat, tiles: flat.tiles.map((row) => [...row]), heightmap: flat.heightmap.map((row) => [...row]) };
    for (let r = 0; r < 8; r++) map.tiles[r][3] = 1;
    const { body } = move({ moveX: 1, sprint: true }, 30, map);
    expect(body.x).toBeLessThanOrEqual(12 - 0.35);
    for (const height of [0.8, 0.801]) {
      const raised = { ...flat, heightmap: flat.heightmap.map((row) => row.map((_h, c) => c >= 3 ? height : 0)) };
      const b = move({ moveX: 1 }, 20, raised).body;
      if (height === 0.8) expect(b.y).toBeCloseTo(2.45);
      else expect(b.x).toBeLessThan(12);
    }
  });
  it('keeps crouch on the same multi-floor surface and requires clearance to stand/jump', () => {
    const map = { ...flat, floors: [
      { base: 0, tiles: flat.tiles, heightmap: flat.heightmap },
      { base: 1.5, tiles: flat.tiles, heightmap: flat.heightmap.map((row) => row.map(() => 1.5)) },
    ] };
    const world = createWorld(map);
    const { body } = move({ crouch: true }, 1);
    stepMovement(body, command(2), world, 1 / 30);
    expect(body.crouching).toBe(true);
    expect(body.y).toBeCloseTo(0.85);
    stepMovement(body, command(3, { crouch: true, jump: true }), world, 1 / 30);
    for (let i = 0; i < 40; i++) stepMovement(body, command(4, { crouch: true }), world, 1 / 30);
    expect(body.onGround).toBe(true);
    expect(body.y).toBeCloseTo(0.85);
    body.y = 1.5 + 0.85;
    stepMovement(body, command(5, { crouch: true }), world, 1 / 30);
    expect(body.y).toBeCloseTo(2.35);
  });
});

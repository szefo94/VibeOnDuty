import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';

const map = (height = 0) => ({
  width: 40, height: 8, H2: 1.4, style: 'rooftop',
  tiles: Array.from({ length: 8 }, () => Array(40).fill(0)),
  heightmap: Array.from({ length: 8 }, () => Array(40).fill(height)),
  spawnAttacker: { x: 10, z: 10 }, spawnDefender: { x: 84, z: 10 },
});
const command = (sim, body, changes = {}) => ({
  protocolVersion: 1, seq: body.lastSeq + 1, ackTick: sim.snapshot().currentTick,
  matchGeneration: sim.snapshot().matchGeneration, lifeGeneration: body.lifeGeneration,
  moveX: 0, moveZ: 0, yaw: -Math.PI / 2, pitch: 0.05,
  fire: false, reload: false, sprint: false, jump: false,
  crouch: false, aiming: false, neutral: false, ...changes,
});

describe('authoritative M4 travel', () => {
  it('clips the final fractional step and cannot hit beyond exact lifetime exhaustion', () => {
    const sim = createSimulation(map(10));
    const shooter = sim.addPlayer('a');
    const target = sim.addPlayer('b');
    expect(sim.queueInput('a', command(sim, shooter, { fire: true }))).toBe(true);
    for (let i = 0; i < 12; i++) sim.stepSimulation(0.1);
    expect(target.health).toBe(100);
    expect(sim.snapshot().projectileCount).toBe(0);
  });
});

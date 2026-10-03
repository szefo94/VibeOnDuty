import { expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import { bunkerData } from './maps/bunker.js';

it('rejects sequence one above the safe session range before state changes', () => {
  const sim = createSimulation(bunkerData);
  sim.addPlayer('a');
  expect(sim.queueInput('a', { protocolVersion: 1, seq: 2147483648, ackTick: 0,
    matchGeneration: 1, lifeGeneration: 1, moveX: 1, moveZ: 0, yaw: 0, pitch: 0,
    fire: false, reload: false, sprint: false, jump: false, crouch: false, aiming: false, neutral: false })).toBe(false);
});

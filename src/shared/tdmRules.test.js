import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import { bunkerData } from './maps/bunker.js';

describe('authoritative TDM teams', () => {
  it('starts one human immediately as blue with locked defaults', () => {
    const sim = createSimulation(bunkerData);
    sim.addPlayer('guest');
    expect(sim.snapshot().phase).toBe('active');
    expect(sim.snapshot().players[0].team).toBe('blue');
    expect(sim.snapshot().settings).toEqual({ killLimit: 50, matchSeconds: 600, respawnSeconds: 3, friendlyFire: 0.25, resultsSeconds: 15 });
  });
});

import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import { bunkerData } from './maps/bunker.js';
import { createTdmRules, guestName, onJoin, requestTeamSwitch } from './tdmRules.js';

describe('authoritative TDM teams', () => {
  it('starts one human immediately as blue with locked defaults', () => {
    const sim = createSimulation(bunkerData);
    sim.addPlayer('guest');
    expect(sim.snapshot().phase).toBe('active');
    expect(sim.snapshot().players[0].team).toBe('blue');
    expect(sim.snapshot().settings).toEqual({
      killLimit: 50,
      matchSeconds: 600,
      respawnSeconds: 3,
      friendlyFire: 0.25,
      resultsSeconds: 15,
    });
  });
  it('validates every operator endpoint and rejects immediately outside each bound', () => {
    for (const [key, min, max] of [
      ['killLimit', 1, 1000],
      ['matchSeconds', 1, 3600],
      ['respawnSeconds', 0, 30],
      ['friendlyFire', 0, 1],
    ]) {
      for (const value of [min, max])
        expect(createTdmRules({ [key]: value }).settings[key]).toBe(value);
      for (const value of [min - 0.01, max + 0.01, NaN, Infinity, '1', null])
        expect(() => createTdmRules({ [key]: value })).toThrow();
    }
    expect(() => createTdmRules({ killLimit: 1.5 })).toThrow();
    expect(() => createTdmRules({ resultsSeconds: 14.99 })).toThrow();
    expect(() => createTdmRules({ resultsSeconds: 15.01 })).toThrow();
    for (const bad of [null, [], 'rules', { extra: 0 }])
      expect(() => createTdmRules(bad)).toThrow();
    expect(Object.isFrozen(createTdmRules().settings)).toBe(true);
  });
  it('joins in stable ordinal order, ties blue, and late joins do not restart time or score', () => {
    const rules = createTdmRules();
    const join = (id, now = 0) => {
      const p = { sessionId: id, alive: true, lifeGeneration: 1 };
      onJoin(rules, p, now);
      return p;
    };
    expect(join('z')).toMatchObject({ team: 'blue', joinOrdinal: 1, nickname: 'Guest-1' });
    rules.scoreBlue = 3;
    expect(join('a', 50)).toMatchObject({ team: 'red', joinOrdinal: 2 });
    expect(join('m', 100)).toMatchObject({ team: 'blue', joinOrdinal: 3 });
    expect(rules).toMatchObject({
      phase: 'active',
      startedAtMs: 0,
      endsAtMs: 600000,
      scoreBlue: 3,
    });
  });
  it('switches only dead/results members with current bindings and post-switch balance', () => {
    const rules = createTdmRules();
    const a = { sessionId: 'a', alive: true, lifeGeneration: 1 },
      b = { sessionId: 'b', alive: true, lifeGeneration: 1 };
    onJoin(rules, a, 0);
    onJoin(rules, b, 0);
    const c = { protocolVersion: 1, matchGeneration: 1, lifeGeneration: 1, team: 'red' };
    expect(requestTeamSwitch(rules, 'a', c)).toBe('alive');
    a.alive = false;
    expect(requestTeamSwitch(rules, 'a', c)).toBe('team_balance');
    rules.members.delete('b');
    for (const bad of [null, [], { ...c, score: 1 }])
      expect(requestTeamSwitch(rules, 'a', bad)).toBe('invalid_shape');
    expect(requestTeamSwitch(rules, 'a', { ...c, lifeGeneration: 0 })).toBe('wrong_generation');
    expect(requestTeamSwitch(rules, 'a', { ...c, matchGeneration: 0 })).toBe('wrong_generation');
    expect(requestTeamSwitch(rules, 'missing', c)).toBe('not_member');
    expect(requestTeamSwitch(rules, 'a', c)).toBeNull();
    expect(a).toMatchObject({ team: 'red', alive: false, lifeGeneration: 1 });
    expect(requestTeamSwitch(rules, 'a', c)).toBe('invalid_team');
    a.alive = true;
    rules.phase = 'results';
    expect(requestTeamSwitch(rules, 'a', { ...c, team: 'blue' })).toBeNull();
    expect(rules.scoreBlue).toBe(0);
  });
  it('bounds printable cosmetic names and never trusts join settings', () => {
    for (const raw of [null, undefined, {}, { nickname: '' }])
      expect(guestName(raw, 8)).toBe('Guest-8');
    expect(guestName({ nickname: '\u0000\u202E <script>hi</script> ' }, 1)).toBe(
      '<script>hi</script>'
    );
    expect(guestName({ nickname: 'x'.repeat(100) }, 1)).toHaveLength(24);
    for (const raw of [[], 5, 'name', { nickname: {} }, { nickname: 'x'.repeat(257) }])
      expect(() => guestName(raw, 1)).toThrow();
    const sim = createSimulation(bunkerData);
    sim.addPlayer('a', { settings: { killLimit: 999 }, team: 'red', nickname: 'Joe' });
    expect(sim.snapshot().settings.killLimit).toBe(50);
    expect(sim.snapshot().players[0]).toMatchObject({ team: 'blue', nickname: 'Joe' });
  });
  it('operator friendly damage is applied to real same-team projectiles', () => {
    for (const multiplier of [0, 0.25, 0.5, 1]) {
      const sim = createSimulation(bunkerData, { friendlyDamage: multiplier }, { randomSeed: 7 });
      const a = sim.addPlayer('a'),
        b = sim.addPlayer('b');
      Object.assign(a, { x: 30, z: 22 });
      Object.assign(b, { x: 34, z: 22, team: 'blue' });
      sim.queueInput('a', {
        protocolVersion: 1,
        seq: 1,
        ackTick: 0,
        matchGeneration: 1,
        lifeGeneration: 1,
        moveX: 0,
        moveZ: 0,
        yaw: -Math.PI / 2,
        pitch: 0,
        fire: true,
        reload: false,
        sprint: false,
        jump: false,
        crouch: false,
        aiming: false,
        neutral: false,
      });
      sim.stepSimulation(0.1);
      expect(b.health).toBe(100 - 28 * multiplier);
    }
  });
});

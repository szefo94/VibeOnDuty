import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import { bunkerData } from './maps/bunker.js';
import {
  createTdmRules,
  guestName,
  onJoin,
  requestTeamSwitch,
  onDeath,
  tickRules,
  onLeave,
} from './tdmRules.js';

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

describe('authoritative TDM lifecycle', () => {
  function fixture(settings = {}) {
    const sim = createSimulation(bunkerData, settings, { randomSeed: 7 });
    const a = sim.addPlayer('a'),
      b = sim.addPlayer('b');
    Object.assign(a, { x: 30, z: 22 });
    Object.assign(b, { x: 34, z: 22, health: 20 });
    const command = (id = 'a', changes = {}) => {
      const s = sim.snapshot(),
        p = s.players.find((p) => p.sessionId === id);
      return {
        protocolVersion: 1,
        seq: p.lastSeq + 1,
        ackTick: s.currentTick,
        matchGeneration: s.matchGeneration,
        lifeGeneration: p.lifeGeneration,
        moveX: 0,
        moveZ: 0,
        yaw: -Math.PI / 2,
        pitch: 0,
        fire: false,
        reload: false,
        sprint: false,
        jump: false,
        crouch: false,
        aiming: false,
        neutral: false,
        ...changes,
      };
    };
    const advance = (ms) => {
      while (ms > 0.00001) {
        const step = Math.min(ms, 100);
        sim.stepSimulation(step / 1000);
        ms -= step;
      }
    };
    return { sim, a, b, command, advance };
  }
  it('ends a real score-limit kill and publishes the fixed15-second result deadline', () => {
    const sim = createSimulation(bunkerData, { killLimit: 1 }, { randomSeed: 7 });
    const a = sim.addPlayer('a'),
      b = sim.addPlayer('b');
    Object.assign(a, { x: 30, z: 22 });
    Object.assign(b, { x: 34, z: 22, health: 20 });
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
    expect(b.alive).toBe(false);
    expect(sim.snapshot().phase).toBe('results');
    expect(sim.snapshot()).toMatchObject({
      scoreBlue: 1,
      scoreRed: 0,
      winner: 'blue',
      resultsEndsAtMs: 15100,
    });
  });
  it('default death retires input once and resets the full inventory at exactly3 seconds', () => {
    const { sim, b, command, advance } = fixture();
    Object.assign(b, {
      ammo: 2,
      reserve: 4,
      reloadEndsAtMs: 99999,
      spread: 1,
      crouching: true,
      y: 0.85,
      verticalVelocity: -1,
    });
    // Restore standing for the actual shot; weapon/action pollution remains.
    b.crouching = false;
    b.y = 1.65;
    const old = command('b', { fire: true, moveX: 1 });
    sim.queueInput('a', command('a', { fire: true }));
    advance(100);
    expect(b).toMatchObject({ alive: false, respawnAtMs: 3100, lifeGeneration: 1 });
    expect(sim.snapshot().scoreBlue).toBe(1);
    expect(sim.queueInput('b', old)).toBe(false);
    advance(2999);
    expect(b.alive).toBe(false);
    advance(1);
    expect(b).toMatchObject({
      alive: true,
      lifeGeneration: 2,
      health: 100,
      ammo: 30,
      reserve: 90,
      reloadEndsAtMs: 0,
      nextFireAtMs: 0,
      spread: 0,
      crouching: false,
      verticalVelocity: 0,
      input: null,
      lastSeq: -1,
      lastConsumedSeq: -1,
      respawnAtMs: -1,
      deaths: 1,
    });
    expect(sim.queueInput('b', { ...old, ackTick: sim.snapshot().currentTick })).toBe(false);
    expect(sim.snapshot().scoreBlue).toBe(1);
  });
  it('default50 kills and600 seconds use exact boundaries and once-per-life scoring', () => {
    const rules = createTdmRules();
    const a = { sessionId: 'a', alive: true, lifeGeneration: 1 },
      b = { sessionId: 'b', alive: false, lifeGeneration: 1 };
    onJoin(rules, a, 0);
    onJoin(rules, b, 0);
    const shot = {
      shooterSessionId: 'a',
      shooterTeam: 'blue',
      lifeGeneration: 1,
      matchGeneration: 1,
    };
    for (let i = 1; i <= 49; i++) {
      b.lifeGeneration = i;
      expect(onDeath(rules, b, shot, i)).toBe(true);
      expect(onDeath(rules, b, shot, i)).toBe(false);
    }
    expect(tickRules(rules, 599999)).toBe('none');
    b.lifeGeneration = 50;
    onDeath(rules, b, shot, 600000);
    expect(tickRules(rules, 600000)).toBe('results');
    expect(rules).toMatchObject({ winner: 'blue', scoreBlue: 50, resultsEndsAtMs: 615000 });
    expect(onDeath(rules, b, shot, 600001)).toBe(false);
    const draw = createTdmRules();
    onJoin(draw, { sessionId: 'solo', alive: true, lifeGeneration: 1 }, 0);
    expect(tickRules(draw, 599999)).toBe('none');
    expect(tickRules(draw, 600000)).toBe('results');
    expect(draw.winner).toBe('draw');
  });
  it('eligible projectiles score first on the exact time-expiry step', () => {
    const { sim, command, advance } = fixture({ matchSeconds: 1, killLimit: 1 });
    advance(900);
    sim.queueInput('a', command('a', { fire: true }));
    advance(100);
    expect(sim.snapshot()).toMatchObject({
      phase: 'results',
      winner: 'blue',
      scoreBlue: 1,
      scoreRed: 0,
      resultsEndsAtMs: 16000,
    });
  });
  it('freeze lasts exactly15 seconds then same-settings rematch retires all transients', () => {
    const { sim, command, advance, a, b } = fixture({ killLimit: 1, respawnSeconds: 0 });
    const old = command('a', { fire: true, reload: true, moveX: 1 });
    sim.queueInput('a', { ...old, reload: false, moveX: 0 });
    advance(100);
    expect(sim.snapshot().phase).toBe('results');
    const settings = sim.snapshot().settings;
    expect(sim.queueInput('a', old)).toBe(false);
    advance(14999);
    expect(sim.snapshot()).toMatchObject({ phase: 'results', matchGeneration: 1, scoreBlue: 1 });
    expect(b.alive).toBe(false);
    expect(sim.snapshot().projectileCount).toBe(0);
    advance(1);
    expect(sim.snapshot()).toMatchObject({
      phase: 'active',
      matchGeneration: 2,
      scoreBlue: 0,
      scoreRed: 0,
      winner: '',
      resultsRemaining: 0,
      resultsEndsAtMs: 0,
      currentTick: 0,
      projectileCount: 0,
    });
    expect(sim.snapshot().settings).toBe(settings);
    expect(sim.events).toEqual([]);
    for (const p of [a, b])
      expect(p).toMatchObject({
        alive: true,
        health: 100,
        ammo: 30,
        reserve: 90,
        lifeGeneration: 2,
        kills: 0,
        deaths: 0,
        lastSeq: -1,
        lastConsumedSeq: -1,
        input: null,
        reloadEndsAtMs: 0,
        nextFireAtMs: 0,
        respawnAtMs: -1,
      });
    expect([a.team, b.team]).toEqual(['blue', 'red']);
    expect(sim.queueInput('a', { ...old, ackTick: 0 })).toBe(false);
    const fresh = command('a', { fire: true });
    expect(sim.queueInput('a', fresh)).toBe(true);
    advance(100);
    expect(a.ammo).toBe(29);
  });
  it('last leave suspends timers and clears pending bodies, bullets and scores; fresh join starts a new match', () => {
    const { sim, command, advance } = fixture({ matchSeconds: 1 });
    sim.queueInput('a', command('a', { fire: true, yaw: 0 }));
    advance(10);
    expect(sim.snapshot().projectileCount).toBe(1);
    sim.removePlayer('a');
    sim.removePlayer('b');
    const generation = sim.snapshot().matchGeneration;
    advance(32000);
    expect(sim.snapshot()).toMatchObject({
      phase: 'waiting',
      matchGeneration: generation,
      players: [],
      projectileCount: 0,
      scoreBlue: 0,
      scoreRed: 0,
      resultsEndsAtMs: 0,
      startedAtMs: 0,
      endsAtMs: 0,
    });
    expect(sim.events).toEqual([]);
    expect(sim.lifecycle.retiredLives.size).toBe(0);
    const joined = sim.addPlayer('replacement');
    expect(joined).toMatchObject({ team: 'blue', lifeGeneration: 1, health: 100, ammo: 30 });
    expect(sim.snapshot()).toMatchObject({
      phase: 'active',
      timeRemaining: 1,
      matchGeneration: generation,
    });
    expect(sim.queueInput('a', command('replacement'))).toBe(false);
  });
  it('spawn exhaustion stays safely dead until a valid unoccupied candidate becomes free', () => {
    const data = {
      width: 1,
      height: 1,
      H2: 1.4,
      style: 'rooftop',
      tiles: [[0]],
      heightmap: [[0]],
      spawnAttacker: { x: 2, z: 2 },
      spawnDefender: { x: 2, z: 2 },
    };
    const sim = createSimulation(data);
    const a = sim.addPlayer('a'),
      b = sim.addPlayer('b');
    expect(a.alive).toBe(true);
    expect(b.alive).toBe(false);
    for (let i = 0; i < 10; i++) sim.stepSimulation(0.1);
    expect(b).toMatchObject({ alive: false, lifeGeneration: 1, health: 100 });
    sim.removePlayer('a');
    sim.stepSimulation(0.1);
    expect(b).toMatchObject({ alive: true, lifeGeneration: 1, x: 2, z: 2 });
  });
  it('friendly deaths award none and disconnected shooters cannot credit replacement memberships', () => {
    const rules = createTdmRules();
    const a = { sessionId: 'a', alive: true, lifeGeneration: 1 },
      b = { sessionId: 'b', alive: false, lifeGeneration: 1 };
    onJoin(rules, a, 0);
    onJoin(rules, b, 0);
    b.team = a.team;
    const shot = {
      shooterSessionId: 'a',
      shooterTeam: 'blue',
      lifeGeneration: 1,
      matchGeneration: 1,
    };
    expect(onDeath(rules, b, shot, 10)).toBe(true);
    expect(rules.scoreBlue).toBe(0);
    onLeave(rules, 'a', 11);
    onJoin(rules, { sessionId: 'new-a', alive: true, lifeGeneration: 1 }, 12);
    b.team = 'red';
    b.lifeGeneration++;
    expect(onDeath(rules, b, shot, 13)).toBe(true);
    expect(rules.scoreBlue).toBe(0);
    b.lifeGeneration++;
    expect(onDeath(rules, b, { ...shot, matchGeneration: 0 }, 14)).toBe(false);
  });
});

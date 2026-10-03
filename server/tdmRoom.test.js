import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMpFixture } from '../tests/helpers/mpServer.js';
import { createHostileClient, waitFor } from './testHelpers/hostileClient.js';
import { createInputGate } from '../src/shared/protocol.js';
import { TdmRoom } from './tdmRoom.js';
import { createSimulation } from '../src/shared/tdmSimulation.js';

let server, url;
beforeAll(async () => {
  server = await startMpFixture({ env: { VOD_COMBAT_SEED: '7' } });
  url = server.url;
}, 30000);
afterAll(async () => {
  await server?.stop();
}, 15000);

describe('real room input boundary', () => {
  it('binds guest identity and team requests to membership, life and operator rules', async () => {
    const a = await createHostileClient(url, { create: true, joinOptions: { protocolVersion: 1, nickname: '\u0000<script>guest</script>', team: 'red', settings: { killLimit: 999, matchSeconds: 9999 } } });
    const b = await createHostileClient(url, { roomId: a.roomId });
    try {
      await waitFor(() => Object.keys(a.snapshot().players).length === 2);
      expect(a.snapshot().settings).toMatchObject({ killLimit: 50, matchSeconds: 600, resultsSeconds: 15 });
      expect(a.snapshot().players[a.sessionId]).toMatchObject({ team: 'blue', joinOrdinal: 1, nickname: '<script>guest</script>' });
      expect(b.snapshot().players[b.sessionId]).toMatchObject({ team: 'red', joinOrdinal: 2 });
      const command = { protocolVersion: 1, matchGeneration: 1, lifeGeneration: 1, team: 'red' };
      for (const [raw, reason] of [[command, 'alive'], [{ ...command, lifeGeneration: 0 }, 'wrong_generation'], [{ ...command, matchGeneration: 0 }, 'wrong_generation'], [{ ...command, sessionId: b.sessionId }, 'invalid_shape']]) {
        const count = a.teamRejections.length; a.sendMessage('switch-team', raw);
        await waitFor(() => a.teamRejections.length > count);
        expect(a.teamRejections.at(-1)).toBe(reason);
      }
      expect(a.snapshot().players[a.sessionId].team).toBe('blue');
      expect(b.snapshot().players[a.sessionId].team).toBe('blue');
    } finally { await Promise.all([a.close(), b.close()]); }
  });
  it('explicitly rejects outcome messages without awarding damage, ammo or score', async () => {
    const a = await createHostileClient(url, { create: true });
    const b = await createHostileClient(url, { roomId: a.roomId });
    try {
      await waitFor(() => Object.keys(a.snapshot().players).length === 2);
      const before = a.snapshot();
      for (const type of ['damage', 'hit', 'hit-confirmed', 'kill', 'death', 'score', 'ammo', 'weapon', 'muzzle', 'cadence']) {
        const count = a.rejections.length;
        a.sendMessage(type, { targetSessionId: b.sessionId, damage: 100, score: 999 });
        await waitFor(() => a.rejections.length > count);
        expect(a.rejections.at(-1)).toBe('unknown_message');
      }
      for (const field of ['damage', 'hit', 'kill', 'death', 'score', 'ammo', 'reserve', 'weapon', 'muzzle', 'origin', 'velocity', 'range', 'spread', 'fireRate', 'nextFireAtMs', 'reloadEndsAtMs', 'shotId', 'eventId', 'targetLifeGeneration']) {
        const count = a.rejections.length;
        a.send({ ...a.command({ fire: true }), [field]: 999 });
        await waitFor(() => a.rejections.length > count);
        expect(a.rejections.at(-1)).toBe('invalid_shape');
      }
      expect(a.snapshot().players).toEqual(before.players);
      expect([a.snapshot().scoreAlpha, a.snapshot().scoreBravo]).toEqual([0, 0]);
      expect(a.confirmations).toEqual([]);
      expect(b.confirmations).toEqual([]);
      const shot = a.command({ fire: true });
      a.send(shot);
      await waitFor(() => a.snapshot().players[a.sessionId].ammo === 29);
      expect(a.snapshot().players[a.sessionId].ammo).toBe(29);
      a.send(shot);
      await waitFor(() => a.rejections.at(-1) === 'duplicate_seq');
      expect(a.rejections.at(-1)).toBe('duplicate_seq');
      expect(a.snapshot().players[a.sessionId].ammo).toBe(29);
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });
  it('delivers a real eligible hit only to its firing session and replicates damage to both', async () => {
    const a = await createHostileClient(url, { create: true });
    const b = await createHostileClient(url, { roomId: a.roomId });
    try {
      async function route(x, z) {
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) {
          const me = a.snapshot().players[a.sessionId];
          const dx = x - me.x, dz = z - me.z;
          if (Math.hypot(dx, dz) < 0.3) { a.send(a.command({ neutral: true })); return; }
          a.send(a.command({ moveX: Math.abs(dx) > 0.2 ? Math.sign(dx) : 0, moveZ: Math.abs(dz) > 0.2 ? -Math.sign(dz) : 0 }));
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        throw new Error(`SDK route did not reach (${x},${z})`);
      }
      await route(62, 46); await route(62, 22); await route(34, 22); await route(34, 46);
      const me = a.snapshot().players[a.sessionId], target = b.snapshot().players[b.sessionId];
      a.send(a.command({ fire: true, yaw: Math.atan2(me.x - target.x, me.z - target.z), pitch: Math.atan2(target.y - me.y - 0.1, Math.hypot(target.x - me.x, target.z - me.z)) }));
      await waitFor(() => a.confirmations.length === 1 && b.snapshot().players[b.sessionId].health === 72);
      expect(a.confirmations, JSON.stringify({ state: a.snapshot(), rejections: a.rejections })).toHaveLength(1);
      expect(a.confirmations[0]).toMatchObject({ shooterSessionId: a.sessionId, targetSessionId: b.sessionId, damage: 28, shotId: 1, eventId: 1, targetLifeGeneration: 1 });
      expect(a.snapshot().players[b.sessionId].health).toBe(72);
      expect(b.snapshot().players[b.sessionId].health).toBe(72);
      expect(b.confirmations).toEqual([]);
    } finally { await Promise.all([a.close(), b.close()]); }
  }, 30000);
  it('reports raw nonfinite rejection without mutation over the real SDK transport', async () => {
    const client = await createHostileClient(url, { create: true });
    try {
      expect(client.origin).toBe(new URL(url).origin);
      const initial = client.snapshot().players[client.sessionId];
      client.send(client.command({ moveX: NaN }));
      await waitFor(() => client.rejections.includes('invalid_number'));
      expect(client.rejections).toContain('invalid_number');
      const body = client.snapshot().players[client.sessionId];
      expect([body.x, body.y, body.z, body.ammo]).toEqual([
        initial.x,
        initial.y,
        initial.z,
        initial.ammo,
      ]);
    } finally {
      await client.close();
    }
  });
  it('rejects forged identity, replay, stale/future ticks and generations; valid traffic still moves only its own room', async () => {
    const a = await createHostileClient(url, { create: true });
    const b = await createHostileClient(url, { roomId: a.roomId });
    const isolated = await createHostileClient(url, { create: true });
    try {
      expect(a.roomId).not.toBe(isolated.roomId);
      const other = b.snapshot().players[b.sessionId];
      const differentRoom = isolated.snapshot().players[isolated.sessionId];
      for (const [changes, reason] of [
        [{ sessionId: b.sessionId, moveX: 1 }, 'invalid_shape'],
        [{ origin: { x: 1, y: 9, z: 1 }, damage: 999, score: 999 }, 'invalid_shape'],
        [{ moveX: Infinity }, 'invalid_number'],
        [{ pitch: -Infinity }, 'invalid_number'],
        [{ moveZ: '1' }, 'invalid_number'],
        [{ moveX: 1.000001 }, 'invalid_number'],
        [{ fire: 1 }, 'invalid_action'],
        [{ lifeGeneration: 0 }, 'wrong_generation'],
        [{ matchGeneration: 0 }, 'wrong_generation'],
        [{ ackTick: a.snapshot().currentTick + 100 }, 'future_tick'],
        [{ padding: 'x'.repeat(1100) }, 'invalid_shape'],
      ]) {
        const count = a.rejections.length;
        a.send({ ...a.command(), ...changes });
        await waitFor(() => a.rejections.length > count);
        expect(a.rejections.at(-1)).toBe(reason);
      }
      const delayed = a.command();
      await waitFor(() => a.snapshot().currentTick > delayed.ackTick + 15);
      a.send(delayed);
      await waitFor(() => a.rejections.includes('stale_input'));
      expect(a.rejections).toContain('stale_input');
      const valid = a.command({ moveX: 1 });
      a.send(valid);
      await waitFor(() => a.snapshot().players[a.sessionId].lastConsumedSeq === valid.seq);
      expect(a.snapshot().players[a.sessionId].lastConsumedSeq).toBe(valid.seq);
      a.send(valid);
      a.send({ ...valid, seq: valid.seq - 1 });
      await waitFor(() => a.rejections.filter((r) => r === 'duplicate_seq').length === 2);
      expect(a.rejections.filter((r) => r === 'duplicate_seq')).toHaveLength(2);
      const neutral = a.command({ neutral: true });
      a.send(neutral);
      await waitFor(() => a.snapshot().players[a.sessionId].lastConsumedSeq === neutral.seq);
      expect(a.snapshot().players[a.sessionId].x).toBeGreaterThan(66);
      expect(b.snapshot().players[b.sessionId]).toEqual(other);
      expect(isolated.snapshot().players[isolated.sessionId]).toEqual(differentRoom);
      expect(a.snapshot().scoreAlpha).toBe(0);
      expect(a.snapshot().scoreBravo).toBe(0);
      expect(a.snapshot().matchGeneration).toBe(1);
    } finally {
      await Promise.all([a.close(), b.close(), isolated.close()]);
    }
  }, 10000);
  it('hundreds of real commands overflow bounded queues/rates but never accelerate fixed-tick movement', async () => {
    const a = await createHostileClient(url, { create: true });
    const b = await createHostileClient(url, { roomId: a.roomId });
    try {
      const start = a.snapshot();
      for (let i = 0; i < 300; i++) a.send(a.command({ moveX: 1, sprint: true }));
      await waitFor(
        () => a.rejections.includes('queue_limit') && a.rejections.includes('rate_limit')
      );
      expect(a.rejections).toContain('queue_limit');
      expect(a.rejections).toContain('rate_limit');
      const after = a.snapshot();
      const delta = after.players[a.sessionId].x - start.players[a.sessionId].x;
      expect(delta).toBeLessThanOrEqual(
        ((after.currentTick - start.currentTick) * 9.9) / 30 + 0.0001
      );
      // Network delivery can span fixed ticks; only the controlled-clock test
      // may assume all300 commands arrive between two ticks.
      expect(after.players[a.sessionId].lastConsumedSeq).toBeLessThanOrEqual(299);
      expect(b.snapshot().players[b.sessionId].x).toBe(30);
      expect(a.closedCode).toBe(0);
      // Existing accepted movement ages out even if the peer stops talking.
      const tick = after.currentTick;
      await waitFor(() => a.snapshot().currentTick > tick + 18);
      expect(a.snapshot().players[a.sessionId].moving).toBe(false);
      a.send(a.command({ moveX: -1 }));
      const x = a.snapshot().players[a.sessionId].x;
      await waitFor(() => a.snapshot().players[a.sessionId].x < x);
      expect(a.snapshot().players[a.sessionId].x).toBeLessThan(x);
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  }, 10000);
  it('retires exhausted sequence sessions rather than allowing wrap reuse', async () => {
    const client = await createHostileClient(url, { create: true });
    try {
      client.send(client.command({ seq: 2147483647 }));
      await waitFor(
        () => client.snapshot().players[client.sessionId].lastConsumedSeq === 2147483647
      );
      client.send(client.command({ seq: 0, moveX: 1 }));
      await waitFor(() => client.closedCode !== 0);
      expect(client.closedCode).toBe(4002);
      expect(client.rejections).toContain('duplicate_seq');
    } finally {
      await client.close();
    }
  });
  it('disconnects a sustained real transport flood after three exceeded windows', async () => {
    const client = await createHostileClient(url, { create: true });
    const peer = await createHostileClient(url, { roomId: client.roomId });
    try {
      const tick = peer.snapshot().currentTick;
      for (let window = 0; window < 3; window++) {
        for (let i = 0; i < 300; i++) client.send(client.command());
        if (window < 2) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await waitFor(() => client.closedCode !== 0);
      expect(client.closedCode).toBe(4008);
      expect(client.rejections).toContain('rate_limit');
      expect(peer.closedCode).toBe(0);
      expect(peer.snapshot().currentTick).toBeGreaterThan(tick);
      expect(peer.snapshot().players[peer.sessionId].x).toBe(30);
    } finally {
      await Promise.all([client.close(), peer.close()]);
    }
  }, 10000);
});

describe('room boundary with controlled server clock', () => {
  function fixture() {
    const room = new TdmRoom();
    room.simulation.addPlayer('a');
    room.simulation.addPlayer('b');
    room.syncState();
    const gate = createInputGate();
    room.inputGates.set('a', gate);
    const context = () => room.inputContext(room.state.players.get('a'), gate.lastSeq);
    const command = (seq, changes = {}) => ({
      protocolVersion: 1,
      seq,
      ackTick: room.state.currentTick,
      matchGeneration: room.state.matchGeneration,
      lifeGeneration: room.state.players.get('a').lifeGeneration,
      moveX: 0,
      moveZ: 0,
      yaw: 0,
      pitch: 0,
      fire: false,
      reload: false,
      sprint: false,
      jump: false,
      crouch: false,
      aiming: false,
      neutral: false,
      ...changes,
    });
    return { room, gate, context, command };
  }
  it('never applies a queued command after500ms or a death/generation/results transition', () => {
    for (const change of ['late', 'death', 'life', 'match', 'results']) {
      const { room, gate, context, command } = fixture();
      gate.receive(command(0, { moveX: 1, fire: true, reload: true }), context(), 0);
      const before = room.simulation.snapshot().players[0];
      if (change === 'death') room.state.players.get('a').alive = false;
      if (change === 'life') room.state.players.get('a').lifeGeneration++;
      if (change === 'match') room.state.matchGeneration++;
      if (change === 'results') room.state.phase = 'results';
      room.consumeInputs(change === 'late' ? 500.001 : 0);
      room.simulation.stepSimulation(1 / 30);
      const after = room.simulation.snapshot().players[0];
      expect(after.x).toBe(before.x);
      expect(after.ammo).toBe(before.ammo);
      expect(after.reloadRemaining).toBe(0);
      expect(room.simulation.snapshot().projectileCount).toBe(0);
      expect(gate.pendingCount).toBe(0);
    }
  });
  function combatFixture(friendly = false) {
    const { room, gate, context, command } = fixture();
    const shooter = room.simulation.addPlayer('a'), target = room.simulation.addPlayer('b');
    Object.assign(shooter, { x: 30, z: 22 });
    Object.assign(target, { x: 34, z: 22, health: friendly ? 5.125 : 20 });
    if (friendly) target.team = shooter.team;
    const sent = { a: [], b: [] };
    room.clients.push(...Object.entries(sent).map(([sessionId, messages]) => ({ sessionId, send: (type, event) => messages.push({ type, event }) })));
    room.syncState();
    return { room, gate, context, command, shooter, target, sent };
  }
  it('one real projectile retires one life and duplicate delivery cannot repeat its private confirmation or score', () => {
    const { room, gate, context, command, target, sent } = combatFixture();
    gate.receive(command(0, { fire: true, yaw: -Math.PI / 2 }), context(), 0);
    room.consumeInputs(0);
    room.simulation.stepSimulation(0.1);
    room.syncState();
    expect(target).toMatchObject({ health: 0, alive: false });
    expect(room.state.scoreAlpha).toBe(1);
    expect(room.simulation.events).toHaveLength(1);
    room.deliverCombatEvents(); room.deliverCombatEvents();
    expect(sent.a).toHaveLength(1);
    expect(sent.a[0]).toMatchObject({ type: 'hit-confirmed', event: { damage: 20, killed: true, shotId: 1, eventId: 1 } });
    expect(sent.b).toEqual([]);
    gate.receive(command(1, { fire: true, yaw: -Math.PI / 2 }), context(), 100);
    room.consumeInputs(100);
    room.simulation.stepSimulation(0.1); room.syncState(); room.deliverCombatEvents();
    expect(room.state.scoreAlpha).toBe(1);
    expect(sent.a).toHaveLength(1);
  });
  it('friendly lethal damage clamps the exact fractional amount and never awards a team kill', () => {
    const { room, gate, context, command, target, sent } = combatFixture(true);
    gate.receive(command(0, { fire: true, yaw: -Math.PI / 2 }), context(), 0);
    room.consumeInputs(0); room.simulation.stepSimulation(0.1); room.syncState(); room.deliverCombatEvents();
    expect(target).toMatchObject({ health: 0, alive: false });
    expect([room.state.scoreAlpha, room.state.scoreBravo]).toEqual([0, 0]);
    expect(sent.a[0].event.damage).toBe(5.125);
    expect(sent.b).toEqual([]);
  });
  it('old shooter/target lives and match generations cannot deliver a delayed confirmation', () => {
    for (const transition of ['shooter', 'target', 'match', 'reconnect']) {
      const { room, gate, context, command, sent } = combatFixture();
      gate.receive(command(0, { fire: true, yaw: -Math.PI / 2 }), context(), 0);
      room.consumeInputs(0); room.simulation.stepSimulation(0.1); room.syncState();
      if (transition === 'shooter') room.state.players.get('a').lifeGeneration++;
      if (transition === 'target') room.state.players.get('b').lifeGeneration++;
      if (transition === 'match') room.state.matchGeneration++;
      if (transition === 'reconnect') { room.state.players.delete('a'); room.simulation.removePlayer('a'); room.simulation.addPlayer('new-a'); }
      room.deliverCombatEvents();
      expect(sent.a).toEqual([]); expect(sent.b).toEqual([]);
    }
  });
  it('a launched shot after disconnect can damage the current target but credits no replacement session', () => {
    const data = { width: 40, height: 8, H2: 1.4, style: 'rooftop', tiles: Array.from({ length: 8 }, () => Array(40).fill(0)), heightmap: Array.from({ length: 8 }, () => Array(40).fill(0)), spawnAttacker: { x: 10, z: 10 }, spawnDefender: { x: 24, z: 10 } };
    const sim = createSimulation(data, {}, { randomSeed: 7 });
    const shooter = sim.addPlayer('old-a'), target = sim.addPlayer('b'); target.health = 20;
    const { command } = fixture();
    sim.queueInput(shooter.sessionId, { ...command(0, { fire: true, yaw: -Math.PI / 2 }), ackTick: 0 });
    sim.stepSimulation(0.1); expect(target.health).toBe(20);
    sim.removePlayer('old-a'); sim.addPlayer('new-a');
    for (let i = 0; i < 4; i++) sim.stepSimulation(0.1);
    expect(target).toMatchObject({ health: 0, alive: false });
    expect(sim.snapshot().score).toEqual({ alpha: 0, bravo: 0 });
  });
  it('three exceeded receipt windows disconnect, while sixty-per-second traffic remains admissible', () => {
    const { gate, context, command } = fixture();
    let seq = 0;
    for (let window = 0; window < 3; window++) {
      for (let i = 0; i < (window === 0 ? 120 : 60); i++) {
        gate.receive(command(seq++), context(), window * 1000);
        gate.consume(context(), window * 1000);
      }
      expect(gate.receive(command(seq++), context(), window * 1000)).toMatchObject({
        reason: 'rate_limit',
        disconnect: window === 2,
      });
    }
  });
  it('clears already consumed held input when generation changes without another message', () => {
    for (const change of ['life', 'match']) {
      const { room, gate, context, command } = fixture();
      gate.receive(command(0, { moveX: 1 }), context(), 0);
      room.consumeInputs(0);
      room.simulation.stepSimulation(1 / 30);
      room.syncState();
      const x = room.simulation.snapshot().players[0].x;
      if (change === 'life') room.state.players.get('a').lifeGeneration++;
      else room.state.matchGeneration++;
      room.consumeInputs(1);
      room.simulation.stepSimulation(1 / 30);
      expect(room.simulation.snapshot().players[0].x).toBe(x);
    }
  });
  it('interleaved sessions and room instances cannot move each other or multiply per-step displacement', () => {
    const first = fixture(),
      second = fixture();
    const before = first.room.simulation.snapshot();
    for (let seq = 0; seq < 400; seq++)
      first.gate.receive(first.command(seq, { moveX: 1, sprint: true }), first.context(), 0);
    first.room.consumeInputs(0);
    first.room.simulation.stepSimulation(1 / 30);
    const after = first.room.simulation.snapshot();
    expect(after.players[0].x - before.players[0].x).toBeCloseTo(9.9 / 30);
    expect(after.players[1].x).toBe(before.players[1].x);
    expect(second.room.simulation.snapshot().players[0].x).toBe(66);
    expect(first.gate.pendingCount).toBe(0);
    expect(after.players[0].lastConsumedSeq).toBe(7);
  });
});

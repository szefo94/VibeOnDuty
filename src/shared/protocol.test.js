import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import { bunkerData } from './maps/bunker.js';
import { validateInput, createInputGate, inputPayloadBytes } from './protocol.js';

const context = { currentTick: 15, lastSeq: -1, matchGeneration: 1, lifeGeneration: 1 };
const command = (changes = {}) => ({
  protocolVersion: 1,
  seq: 0,
  ackTick: 0,
  matchGeneration: 1,
  lifeGeneration: 1,
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

it('rejects sequence one above the safe session range before state changes', () => {
  const sim = createSimulation(bunkerData);
  sim.addPlayer('a');
  expect(
    sim.queueInput('a', {
      protocolVersion: 1,
      seq: 2147483648,
      ackTick: 0,
      matchGeneration: 1,
      lifeGeneration: 1,
      moveX: 1,
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
    })
  ).toBe(false);
});

describe('exact raw protocol', () => {
  it.each(['moveX', 'moveZ', 'yaw', 'pitch'])(
    'rejects nonfinite, strings and null for %s',
    (key) => {
      for (const value of [NaN, Infinity, -Infinity, '0', null, undefined, {}, true])
        expect(validateInput(command({ [key]: value }), context)).toMatchObject({
          ok: false,
          reason: 'invalid_number',
        });
    }
  );
  it.each([
    ['moveX', 1],
    ['moveZ', 1],
    ['yaw', Math.PI],
    ['pitch', 1.38],
  ])('accepts exactly both %s bounds, rejects one step beyond', (key, bound) => {
    for (const sign of [-1, 1]) {
      expect(validateInput(command({ [key]: sign * bound }), context).ok).toBe(true);
      expect(validateInput(command({ [key]: sign * (bound + 0.000001) }), context)).toMatchObject({
        reason: 'invalid_number',
      });
    }
  });
  it('accepts sequence endpoints, never wraps, and rejects fractional/unsafe sequences', () => {
    for (const seq of [0, 2147483647])
      expect(validateInput(command({ seq }), context).ok).toBe(true);
    for (const seq of [-1, 2147483648, 0.1, Number.MAX_SAFE_INTEGER + 1, NaN, '1'])
      expect(validateInput(command({ seq }), context)).toMatchObject({ reason: 'invalid_number' });
    expect(validateInput(command(), { ...context, lastSeq: 2147483647 })).toMatchObject({
      reason: 'duplicate_seq',
    });
    expect(validateInput(command({ seq: 8 }), { ...context, lastSeq: 8 })).toMatchObject({
      reason: 'duplicate_seq',
    });
    expect(validateInput(command({ seq: 7 }), { ...context, lastSeq: 8 })).toMatchObject({
      reason: 'duplicate_seq',
    });
  });
  it('requires every exact field and rejects all claimed authority fields and malformed shapes', () => {
    for (const key of Object.keys(command())) {
      const c = command();
      delete c[key];
      expect(validateInput(c, context)).toMatchObject({ reason: 'invalid_shape' });
    }
    for (const key of [
      'sessionId',
      'x',
      'position',
      'speed',
      'delta',
      'origin',
      'hit',
      'damage',
      'score',
      'timestamp',
    ])
      expect(validateInput(command({ [key]: 1 }), context)).toMatchObject({
        reason: 'invalid_shape',
      });
    for (const shape of [null, false, 1, 'input', [], [command()], {}])
      expect(validateInput(shape, context)).toMatchObject({ reason: 'invalid_shape' });
    expect(validateInput(command({ protocolVersion: 2 }), context)).toMatchObject({
      reason: 'invalid_shape',
    });
  });
  it('requires booleans and prohibits actions or movement in an explicit neutral input', () => {
    for (const key of ['fire', 'reload', 'sprint', 'jump', 'crouch', 'aiming', 'neutral']) {
      expect(validateInput(command({ [key]: true }), context).ok).toBe(true);
      for (const value of [0, 1, null, 'true'])
        expect(validateInput(command({ [key]: value }), context)).toMatchObject({
          reason: 'invalid_action',
        });
    }
    for (const change of [{ moveX: 1 }, { moveZ: -1 }, { fire: true }, { aiming: true }])
      expect(validateInput(command({ ...change, neutral: true }), context)).toMatchObject({
        reason: 'invalid_action',
      });
  });
  it('binds both generations and acknowledged tick age without accepting client clock values', () => {
    for (const key of ['lifeGeneration', 'matchGeneration'])
      for (const value of [0, 2, '1', NaN])
        expect(validateInput(command({ [key]: value }), context)).toMatchObject({
          reason: 'wrong_generation',
        });
    expect(validateInput(command({ ackTick: 15 }), context).ok).toBe(true);
    expect(validateInput(command(), context).ok).toBe(true);
    expect(validateInput(command(), { ...context, currentTick: 16 })).toMatchObject({
      reason: 'stale_input',
    });
    expect(validateInput(command({ ackTick: 16 }), context)).toMatchObject({
      reason: 'future_tick',
    });
    for (const ackTick of [-1, 0.1, NaN, Infinity, '1'])
      expect(validateInput(command({ ackTick }), context)).toMatchObject({
        reason: 'invalid_number',
      });
  });
  it('bounds application payload at1024 bytes before coercion or schema checks', () => {
    expect(validateInput(command(), { ...context, payloadBytes: 1024 }).ok).toBe(true);
    expect(validateInput(command(), { ...context, payloadBytes: 1025 })).toMatchObject({
      reason: 'invalid_shape',
    });
    const oversized = command({ padding: 'x'.repeat(1025) });
    expect(inputPayloadBytes(oversized)).toBeGreaterThan(1024);
    expect(validateInput(oversized, context)).toMatchObject({ reason: 'invalid_shape' });
    expect(inputPayloadBytes('é')).toBe(4);
  });
});

describe('bounded server receipt queue and clock', () => {
  it('admits8 pending commands, rejects9th, consumes latest once and neutral clears edges', () => {
    const gate = createInputGate();
    for (let seq = 0; seq < 8; seq++)
      expect(gate.receive(command({ seq, moveX: 1, fire: seq === 0 }), context, 0).ok).toBe(true);
    expect(gate.pendingCount).toBe(8);
    expect(gate.receive(command({ seq: 8 }), context, 0)).toMatchObject({ reason: 'queue_limit' });
    const consumed = gate.consume(context, 0);
    expect(consumed.command).toMatchObject({ seq: 7, fire: true, moveX: 1 });
    expect(gate.pendingCount).toBe(0);
    expect(gate.consume(context, 0).command).toBeNull();
    gate.receive(command({ seq: 8, fire: true, jump: true }), context, 0);
    gate.receive(command({ seq: 9, neutral: true }), context, 0);
    expect(gate.pendingCount).toBe(1);
    expect(gate.consume(context, 0).command).toMatchObject({
      neutral: true,
      fire: false,
      jump: false,
    });
  });
  it('admits exactly500ms receipt age and15 ticks; rejects each next step and old generations', () => {
    for (const [now, currentTick, lifeGeneration, reason] of [
      [500, 15, 1, null],
      [500.001, 15, 1, 'stale_input'],
      [500, 16, 1, 'stale_input'],
      [0, 15, 2, 'wrong_generation'],
    ]) {
      const gate = createInputGate();
      gate.receive(command(), context, 0);
      const result = gate.consume({ ...context, currentTick, lifeGeneration }, now);
      if (!reason) expect(result.command).toMatchObject({ seq: 0 });
      else {
        expect(result.command).toBeNull();
        expect(result.rejections).toContain(reason);
      }
    }
  });
  it('allows burst120 and replenishes60/s; disconnects only after three exceeded consecutive windows', () => {
    const gate = createInputGate();
    let seq = 0;
    for (let window = 0; window < 3; window++) {
      for (let i = 0; i < (window === 0 ? 120 : 60); i++) {
        expect(gate.receive(command({ seq: seq++ }), context, window * 1000).ok).toBe(true);
        gate.consume(context, window * 1000);
      }
      expect(gate.receive(command({ seq: seq++ }), context, window * 1000)).toMatchObject({
        reason: 'rate_limit',
        disconnect: window === 2,
      });
    }
    const steady = createInputGate();
    for (let i = 0; i < 600; i++) {
      expect(steady.receive(command({ seq: i }), context, i * (1000 / 60)).ok).toBe(true);
      steady.consume(context, i * (1000 / 60));
    }
  });
  it('isolated rejection leaves the last accepted sequence and valid later traffic usable', () => {
    const gate = createInputGate();
    expect(gate.receive(command({ moveX: Infinity }), context, 0)).toMatchObject({
      reason: 'invalid_number',
    });
    expect(gate.lastSeq).toBe(-1);
    expect(gate.receive(command({ moveX: 1 }), context, 1).ok).toBe(true);
    expect(gate.consume(context, 1).command.moveX).toBe(1);
  });
});

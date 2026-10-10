import assert from 'node:assert/strict';
import test from 'node:test';
import { classify, normaliseError } from './multiplayer-ab.mjs';

const mk = (arm, passes, err = 'Error: expect(received).toBe(expected)') =>
  passes.map((p) => ({ arm, passed: p, firstError: p ? null : err }));
const ok = { passed: true };

test('no reference runs gives no-reference', () => {
  assert.equal(classify(mk('candidate', [false, false, false]), ok), 'no-reference');
});

test('missing or failed control gives harness-invalid even when every reference run fails', () => {
  const runs = [...mk('candidate', [false, false, false]), ...mk('reference', [false, false, false])];
  assert.equal(classify(runs, null), 'harness-invalid');
  assert.equal(classify(runs, { passed: false }), 'harness-invalid');
});

test('candidate passing at least ceil(2n/3) gives not-reproduced', () => {
  const runs = [...mk('candidate', [true, true, false]), ...mk('reference', [true, true, true])];
  assert.equal(classify(runs, ok), 'not-reproduced');
});

test('reference passes and candidate fails gives source', () => {
  const runs = [...mk('candidate', [false, false, true]), ...mk('reference', [true, true, false])];
  assert.equal(classify(runs, ok), 'source');
});

test('both arms failing with the same normalised first error gives host', () => {
  const runs = [
    ...mk('candidate', [false, false, false], 'Error: Route did not reach (62, 46) within 45s: {"sessionId":"abc","currentTick":556}'),
    ...mk('reference', [false, false, true], 'Error: Route did not reach (34, 22) within 90s: {"sessionId":"zzz","currentTick":12}'),
  ];
  assert.equal(classify(runs, ok), 'host');
});

test('both arms failing with different first errors gives inconclusive', () => {
  const runs = [
    ...mk('candidate', [false, false, false], 'Error: timeout waiting for results'),
    ...mk('reference', [false, false, false], 'Error: ECONNRESET'),
  ];
  assert.equal(classify(runs, ok), 'inconclusive');
});

test('mixed results give inconclusive', () => {
  const runs = [...mk('candidate', [true, true, true, false, false, false]), ...mk('reference', [true, true, false, false, true, false])];
  assert.equal(classify(runs, ok), 'inconclusive');
});

test('a failed control gives harness-invalid, not host, for identical errors', () => {
  const runs = [...mk('candidate', [false, false, false]), ...mk('reference', [false, false, false])];
  assert.notEqual(classify(runs, { passed: false }), 'host');
});

test('unequal arm counts are rejected', () => {
  const runs = [...mk('candidate', [true, true, true]), ...mk('reference', [true, true, true, true])];
  assert.throws(() => classify(runs, ok), assert.AssertionError);
});

test('n of 2 is rejected', () => {
  const runs = [...mk('candidate', [true, true]), ...mk('reference', [true, true])];
  assert.throws(() => classify(runs, ok), assert.AssertionError);
});

test('an unknown arm is rejected', () => {
  assert.throws(() => classify([{ arm: 'other', passed: true }], ok), assert.AssertionError);
});

test('normaliseError removes ANSI codes, ids, ticks and numbers', () => {
  const a = normaliseError('\u001b[31mError\u001b[39m: x sessionId":"AbC12" tick 55 at 7');
  const b = normaliseError('Error: x sessionId":"ZZZ99" tick 99 at 8');
  assert.equal(a, b);
});

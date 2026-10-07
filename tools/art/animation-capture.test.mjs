import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePlan09, REQUIRED_ASSERTIONS, requireStableGates, REQUIRED_STABLE_GATES } from './animation-capture.mjs';
const identities = { 'src/main.js': 'a'.repeat(64) };
const good = () => ({ complete: true, identities, applicableBudgetPass: true,
  assertions: REQUIRED_ASSERTIONS.map(id => ({ id, status: 'pass', executed: true,
    exitCode: 0, logSha256: 'b'.repeat(64) })) });
test('capture accepts only current complete09 with both executed browser qualifications', () => {
  assert.equal(requirePlan09(identities, 'status: complete\n', good()), true);
});
for (const status of ['halted', 'partial', 'missing']) test('successful collection/recovery cannot bypass ' + status + '09', () => {
  assert.throws(() => requirePlan09(identities, `status: ${status}\n`, good()), /halted|unqualified/);
});
for (const [name, mutate] of Object.entries({ missing: q => { q.complete = false; },
  stale: q => { q.identities = {}; }, numeric: q => { q.applicableBudgetPass = false; },
  assertion: q => { q.assertions[0].status = 'setup-timeout'; },
  unrun: q => { q.assertions[1].executed = false; },
  logs: q => { delete q.assertions[1].logSha256; } })) test('capture rejects ' + name + ' qualification even with collection/recovery success', () => {
  const q = good(); mutate(q);
  assert.throws(() => requirePlan09(identities, 'status: complete\n', q));
});
for (const id of REQUIRED_ASSERTIONS) {
  for (const [name, mutate] of Object.entries({
    missing: q => { q.assertions = q.assertions.filter(a => a.id !== id); },
    unrun: q => { q.assertions.find(a => a.id === id).executed = false; },
    failed: q => { q.assertions.find(a => a.id === id).status = 'fail'; },
    exit: q => { q.assertions.find(a => a.id === id).exitCode = 1; },
    log: q => { q.assertions.find(a => a.id === id).logSha256 = ''; },
  })) test(`${id} cannot bypass qualification when ${name}`, () => {
    const qualification = good(); mutate(qualification);
    assert.throws(() => requirePlan09(identities, 'status: complete\n', qualification));
  });
}
test('all stable gates require actual full passing current-source logs', () => {
  const evidence = { identities, checks: REQUIRED_STABLE_GATES.map(id => ({ id,
    executed: true, exitCode: 0, scope: 'full', logSha256: 'c'.repeat(64) })) };
  assert.equal(requireStableGates(identities, evidence), true);
  for (const id of REQUIRED_STABLE_GATES) {
    for (const [field, value] of [['executed', false], ['exitCode', 1], ['scope', 'focused'], ['logSha256', '']]) {
      const bad = structuredClone(evidence);
      bad.checks.find(check => check.id === id)[field] = value;
      assert.throws(() => requireStableGates(identities, bad));
    }
  }
  assert.throws(() => requireStableGates({}, evidence));
  assert.throws(() => requireStableGates(identities, null));
});

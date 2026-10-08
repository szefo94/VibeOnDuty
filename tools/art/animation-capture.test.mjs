import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requirePlan09, REQUIRED_ASSERTIONS, requireStableGates, REQUIRED_STABLE_GATES } from './animation-capture.mjs';
const identities = { 'src/main.js': 'a'.repeat(64) };
const completeSummary = '---\nstatus: complete\n---\n';
const good = () => ({ complete: true, identities, applicableBudgetPass: true,
  assertions: REQUIRED_ASSERTIONS.map(id => ({ id, status: 'pass', executed: true,
    exitCode: 0, logSha256: 'b'.repeat(64) })) });
test('capture accepts only current complete09 with both executed browser qualifications', () => {
  assert.equal(requirePlan09(identities, completeSummary, good()), true);
});
for (const status of ['halted', 'partial', 'missing']) test('successful collection/recovery cannot bypass ' + status + '09', () => {
  assert.throws(() => requirePlan09(identities, `---\nstatus: ${status}\n---\n`, good()), /halted|unqualified/);
});
for (const [name, mutate] of Object.entries({ missing: q => { q.complete = false; },
  stale: q => { q.identities = {}; }, numeric: q => { q.applicableBudgetPass = false; },
  assertion: q => { q.assertions[0].status = 'setup-timeout'; },
  unrun: q => { q.assertions[1].executed = false; },
  logs: q => { delete q.assertions[1].logSha256; } })) test('capture rejects ' + name + ' qualification even with collection/recovery success', () => {
  const q = good(); mutate(q);
  assert.throws(() => requirePlan09(identities, completeSummary, q));
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
    assert.throws(() => requirePlan09(identities, completeSummary, qualification));
  });
}
for (const [name, summary] of Object.entries({
  historical: '---\nstatus: halted\n---\nHistorical example:\nstatus: complete\n',
  fenced: '---\nstatus: halted\n---\n```yaml\nstatus: complete\n```\n',
  trailing: '---\nstatus: halted\n---\n---\nstatus: complete\n---\n',
  duplicate: '---\nstatus: complete\nstatus: halted\n---\n',
  duplicateComplete: '---\nstatus: complete\nstatus: complete\n---\n',
  quotedDuplicate: '---\nstatus: complete\n"status": halted\n---\n',
  malformed: '---\nstatus: complete\nstatus complete\n---\n',
  invalid: '---\nstatus: [complete]\n---\nstatus: complete\n',
  unterminated: '---\nstatus: complete\n',
  absent: 'status: complete\n',
  nestedOnly: '---\nhistory:\n  status: complete\n---\nstatus: complete\n',
  merged: '---\n<<: *history\nstatus: complete\n---\n',
})) test('only unambiguous leading frontmatter can qualify09: ' + name, () => {
  assert.throws(() => requirePlan09(identities, summary, good()), /halted|unqualified/);
});
test('current real halted summary plus historical completion remains unqualified', async () => {
  const summary = await readFile(new URL('../../.planning/phases/07-movement-matched-and-action-safe-animation/07-09-SUMMARY.md', import.meta.url), 'utf8');
  assert.throws(() => requirePlan09(identities, summary + '\n```yaml\nstatus: complete\n```\n', good()));
});
test('canonical complete frontmatter permits nested historical status and irrelevant body', () => {
  assert.equal(requirePlan09(identities, '---\r\nstatus: complete\r\nhistory:\r\n  status: halted\r\n---\r\nstatus: halted\r\n', good()), true);
});
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

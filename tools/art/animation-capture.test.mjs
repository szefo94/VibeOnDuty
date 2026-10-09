import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runtimeDependencyIdentities } from './runtime-dependencies.mjs';
import { requirePlan09, REQUIRED_ASSERTIONS, requireStableGates, REQUIRED_STABLE_GATES, simulationBudget,
  NATURAL_DEATH_WALL_GUARD_MS, NATURAL_RESPAWN_WALL_GUARD_MS, COLLECTION_LIFETIME_MS,
  COLLECTION_LIFETIME_PROJECTION, NATURAL_DEATH_SIM_SECONDS, NATURAL_RESPAWN_SIM_SECONDS,
  independentTracerComplete } from './animation-capture.mjs';
const identities = { 'src/main.js': 'a'.repeat(64),
  ...runtimeDependencyIdentities() };
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
  escapedDuplicate: '---\nstatus: complete\n"sta\\u0074us": halted\n---\n',
  explicitDuplicate: '---\nstatus: complete\n? status\n: halted\n---\n',
  malformedStatusChild: '---\nstatus: complete\n  child: halted\n---\n',
  malformed: '---\nstatus: complete\nstatus complete\n---\n',
  invalid: '---\nstatus: [complete]\n---\nstatus: complete\n',
  unterminated: '---\nstatus: complete\n',
  absent: 'status: complete\n',
  nestedOnly: '---\nhistory:\n  status: complete\n---\nstatus: complete\n',
  merged: '---\n<<: *history\nstatus: complete\n---\n',
})) test('only unambiguous leading frontmatter can qualify09: ' + name, () => {
  assert.throws(() => requirePlan09(identities, summary, good()), /halted|unqualified/);
});
test('real summary held at halted plus historical completion remains unqualified', async () => {
  const summary = await readFile(new URL('../../.planning/phases/07-movement-matched-and-action-safe-animation/07-09-SUMMARY.md', import.meta.url), 'utf8');
  // Pin the root status so this control survives the plan legitimately completing.
  const halted = summary.replace(/^status:.*$/m, 'status: halted');
  assert.match(halted, /^status: halted$/m);
  assert.throws(() => requirePlan09(identities, halted + '\n```yaml\nstatus: complete\n```\n', good()));
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

const dead = sample => sample.dead === true;
const run = (rows) => rows.map(([wallMs, simSeconds, isDead = false]) => ({ wallMs, simSeconds, dead: isDead }));
test('simulation budget is met when a satisfying sample exists at or before the limit', () => {
  const result = simulationBudget(run([[0, 0], [5000, 40], [9000, 120, true]]), 120, dead);
  assert.equal(result.outcome, 'met');
  assert.equal(result.simSeconds, 120);
  assert.equal(result.wallMs, 9000);
});
test('simulation budget expires when the limit passes with no satisfying sample', () => {
  const result = simulationBudget(run([[0, 0], [5000, 60], [11000, 121]]), 120, dead);
  assert.equal(result.outcome, 'sim-expired');
});
test('simulation budget does not accept a satisfying sample after the limit', () => {
  const result = simulationBudget(run([[0, 0], [5000, 60], [11000, 121, true]]), 120, dead);
  assert.equal(result.outcome, 'sim-expired');
});
test('simulation budget stays pending while neither the predicate nor the limit is reached', () => {
  const result = simulationBudget(run([[0, 0], [5000, 30]]), 120, dead);
  assert.equal(result.outcome, 'pending');
  assert.equal(result.simSeconds, 30);
  assert.equal(result.wallMs, 5000);
});
test('simulation budget is pending for empty or single-sample input and never met', () => {
  assert.equal(simulationBudget([], 120, dead).outcome, 'pending');
  assert.equal(simulationBudget(run([[0, 0, true]]), 120, dead).outcome, 'pending');
});
test('simulation budget rejects non-finite or decreasing simulation seconds', () => {
  assert.throws(() => simulationBudget(run([[0, 0], [1, Number.NaN]]), 120, dead), assert.AssertionError);
  assert.throws(() => simulationBudget(run([[0, 0], [1, Infinity]]), 120, dead), assert.AssertionError);
  assert.throws(() => simulationBudget(run([[0, 5], [1, 4]]), 120, dead), assert.AssertionError);
});
test('simulation budget constants keep the planned bounds', () => {
  assert.equal(NATURAL_DEATH_SIM_SECONDS, 120);
  assert.equal(NATURAL_RESPAWN_SIM_SECONDS, 20);
});
test('collection lifetime admits the full strict capture projection', () => {
  const p = COLLECTION_LIFETIME_PROJECTION;
  const sum = p.recordedMatrix + p.fallbackRows + p.combatUnions + p.energyAndThrow + p.onlineUnions;
  assert.equal(Object.keys(p).length, 5);
  assert.ok(COLLECTION_LIFETIME_MS >= sum);
  assert.ok(sum >= p.recordedMatrix + p.fallbackRows
    + 3 * (NATURAL_DEATH_WALL_GUARD_MS + NATURAL_RESPAWN_WALL_GUARD_MS));
  assert.equal(p.combatUnions, 3 * (NATURAL_DEATH_WALL_GUARD_MS + NATURAL_RESPAWN_WALL_GUARD_MS));
  assert.equal(sum, 10862931);
  assert.equal(COLLECTION_LIFETIME_MS, 11400000);
});
test('independent tracer stays incomplete when the combat entry lacks natural-respawn', () => {
  const full = ['accepted-aim', 'earned-resource', 'throw-canceled-reload', 'natural-death', 'natural-respawn'];
  const report = stages => ({ tracer: true, canceled: false, protectedBytesUnchanged: true, collectionErrors: [],
    matrix: [{ completed: true, media: { bytes: 1 } }],
    offlineMovement: [{ complete: true }], sharedMovement: [{ complete: true }],
    previews: [{ completed: true, media: { bytes: 1 } }],
    offlineCombat: [{ complete: stages.length === full.length, media: { bytes: 1 },
      stages: stages.map(name => ({ name })) }] });
  assert.equal(independentTracerComplete(report(full)), true);
  assert.equal(independentTracerComplete(report(full.slice(0, 4))), false);
});

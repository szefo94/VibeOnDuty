import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runtimeDependencyIdentities } from './runtime-dependencies.mjs';
import * as capture from './animation-capture.mjs';
import { requirePlan09, REQUIRED_ASSERTIONS, requireStableGates, REQUIRED_STABLE_GATES, simulationBudget,
  NATURAL_DEATH_WALL_GUARD_MS, NATURAL_RESPAWN_WALL_GUARD_MS, COLLECTION_LIFETIME_MS,
  COLLECTION_LIFETIME_PROJECTION, NATURAL_DEATH_SIM_SECONDS, NATURAL_RESPAWN_SIM_SECONDS,
  independentTracerComplete, diagnoseAcquisition } from './animation-capture.mjs';
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
  const sum = p.recordedMatrix + p.fallbackRows + p.combatUnions + p.acquisitionWaits + p.onlineUnions;
  const acquisition = capture.AIM_PROOF_WALL_GUARD_MS + capture.ENERGY_WALL_GUARD_MS + capture.THROW_WALL_GUARD_MS;
  const natural = NATURAL_DEATH_WALL_GUARD_MS + NATURAL_RESPAWN_WALL_GUARD_MS;
  assert.equal(Object.keys(p).length, 5);
  assert.equal(p.energyAndThrow, undefined);
  assert.ok(COLLECTION_LIFETIME_MS >= sum);
  assert.ok(sum >= p.recordedMatrix + p.fallbackRows + 3 * natural + 3 * acquisition);
  assert.equal(p.combatUnions, 3 * natural);
  assert.equal(p.acquisitionWaits, 3 * acquisition);
  assert.equal(p.acquisitionWaits, 5040000);
  assert.equal(acquisition + natural, 3180000);
  assert.equal(sum, 15452931);
  assert.equal(COLLECTION_LIFETIME_MS, 15600000);
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

// Synthetic progress samples: one per 0.05 s frame; the eye moves along x at `speed` m per sample.
const progressRun = (count, { route = () => 0, speed = 0.1, visible = false, walking = true, aimAt = -1, simStart = 1.8 } = {}) =>
  Array.from({ length: count }, (_, i) => ({ wallMs: 1000 + i * 290, simSeconds: simStart + i * 0.05,
    eye: [60 + i * speed, 1.65, 40], route: route(i), input: { walking }, target: { visible },
    aimProof: i === aimAt ? { dot: 1 } : null }));
test('acquisition diagnosis reports acquired when any sample has a visible target', () => {
  const rows = progressRun(20); rows[7].target.visible = true;
  assert.equal(diagnoseAcquisition(rows).classification, 'acquired');
});
test('acquisition diagnosis reports acquired when any sample carries an aim proof', () => {
  assert.equal(diagnoseAcquisition(progressRun(20, { aimAt: 12 })).classification, 'acquired');
});
test('acquisition diagnosis reports still-searching for a moving driver below one loop', () => {
  const result = diagnoseAcquisition(progressRun(106, { route: i => (i < 40 ? 0 : i < 80 ? 1 : 2) }));
  assert.equal(result.classification, 'still-searching');
  assert.equal(result.routeCount, 2);
  assert.equal(result.loopsWalked, 0.5);
  assert.equal(result.samples, 106);
  assert.ok(Math.abs(result.simSpanSeconds - 5.25) < 1e-9);
  assert.ok(result.finalThirdDisplacementM >= 1);
  assert.ok(result.wallSpanMs > 0);
});
test('acquisition diagnosis reports driver-stalled when the final third barely moves while walking', () => {
  const rows = progressRun(60, { route: () => 1, speed: 0.001 });
  assert.equal(diagnoseAcquisition(rows).classification, 'driver-stalled');
});
test('acquisition diagnosis reports driver-stalled after a whole loop with nothing visible', () => {
  const result = diagnoseAcquisition(progressRun(60, { route: i => 3 + (i > 30 ? 1 : 0) }));
  assert.equal(result.classification, 'driver-stalled');
  assert.equal(result.routeCount, 4);
  assert.equal(result.loopsWalked, 1);
});
test('acquisition diagnosis uses the absolute route counter over a 256-sample retained window', () => {
  const stalled = diagnoseAcquisition(progressRun(256, { route: i => (i < 128 ? 12 : 13) }));
  assert.equal(stalled.classification, 'driver-stalled');
  assert.equal(stalled.routeCount, 13);
  assert.equal(stalled.loopsWalked, 3.25);
  const searching = diagnoseAcquisition(progressRun(256, { route: i => (i < 128 ? 1 : 2) }));
  assert.equal(searching.classification, 'still-searching');
});
test('acquisition diagnosis is undetermined for too few or malformed samples', () => {
  assert.equal(diagnoseAcquisition(progressRun(2)).classification, 'undetermined');
  assert.equal(diagnoseAcquisition([]).classification, 'undetermined');
  const noEye = progressRun(10); delete noEye[4].eye;
  assert.equal(diagnoseAcquisition(noEye).classification, 'undetermined');
  const noRoute = progressRun(10); delete noRoute[9].route;
  assert.equal(diagnoseAcquisition(noRoute).classification, 'undetermined');
  const noSim = progressRun(10); delete noSim[0].simSeconds;
  assert.equal(diagnoseAcquisition(noSim).classification, 'undetermined');
});

test('simulation bounds and wall guards for the combat path and rows keep the planned values', () => {
  assert.equal(capture.AIM_PROOF_SIM_SECONDS, 60);
  assert.equal(capture.AIM_PROOF_WALL_GUARD_MS, 600000);
  assert.equal(capture.ENERGY_SIM_SECONDS, 90);
  assert.equal(capture.ENERGY_WALL_GUARD_MS, 900000);
  assert.equal(capture.THROW_SIM_SECONDS, 10);
  assert.equal(capture.THROW_WALL_GUARD_MS, 180000);
  assert.equal(capture.ROW_ACTION_SIM_SECONDS, 10);
  assert.equal(capture.ROW_ACTION_WALL_GUARD_MS, 180000);
});
// A scripted page: each evaluate() returns the next scripted observer sample.
const scriptedPage = rows => { let i = 0; return { evaluate: async () => rows[Math.min(i++, rows.length - 1)] }; };
const sampleSpec = { argument: null, read: () => null, predicate: s => s.met === true };
test('waitSimulation returns met when the condition holds within the simulation limit', async () => {
  const page = scriptedPage([{ wallMs: 0, simSeconds: 0, met: false }, { wallMs: 900, simSeconds: 2, met: true }]);
  assert.equal(typeof capture.waitSimulation, 'function');
  const result = await capture.waitSimulation(page, { what: 'x', label: 'Reload', limitSimSeconds: 10, wallGuardMs: 60000, sample: sampleSpec });
  assert.equal(result.outcome, 'met');
  assert.equal(result.simSeconds, 2);
});
test('waitSimulation names the stage and the limit when the simulation bound passes first', async () => {
  const page = scriptedPage([{ wallMs: 0, simSeconds: 0, met: false }, { wallMs: 50000, simSeconds: 11, met: false }]);
  await assert.rejects(capture.waitSimulation(page, { what: 'x', label: 'Reload completion', limitSimSeconds: 10, wallGuardMs: 600000, sample: sampleSpec }),
    /^Error: Reload completion did not occur within 10 simulation seconds \(observed 11\.0 simulation seconds, 50000 wall ms\)$/);
});
test('waitSimulation reports wall-guard expiry as its own outcome, distinct from simulation expiry', async () => {
  const page = scriptedPage([{ wallMs: 0, simSeconds: 0, met: false }, { wallMs: 10, simSeconds: 0.2, met: false }]);
  await assert.rejects(capture.waitSimulation(page, { what: 'x', label: 'Reload completion', limitSimSeconds: 10, wallGuardMs: 0, sample: sampleSpec }),
    /^Error: Wall guard expired before the simulation bound \(Reload completion\)/);
});
test('waitSimulation keeps the plan 07-12 natural death and respawn messages byte for byte', async () => {
  const page = scriptedPage([{ wallMs: 0, simSeconds: 0, met: false }, { wallMs: 1000, simSeconds: 121, met: false }]);
  await assert.rejects(capture.waitSimulation(page, { what: 'death', limitSimSeconds: 120, wallGuardMs: 600000, sample: sampleSpec }),
    /^Error: Natural death did not occur within 120 simulation seconds \(observed 121\.0 simulation seconds, 1000 wall ms\)$/);
  const page2 = scriptedPage([{ wallMs: 0, simSeconds: 0, met: false }, { wallMs: 10, simSeconds: 0.2, met: false }]);
  await assert.rejects(capture.waitSimulation(page2, { what: 'respawn', limitSimSeconds: 20, wallGuardMs: 0, sample: sampleSpec }),
    /^Error: Wall guard expired before the simulation bound \(respawn\): observed 0.0 simulation seconds in \d+ wall ms, guard 0 ms$/);
});
test('aim-proof expiry message carries the classification, absolute route count, loops and whole-wait simulation seconds', () => {
  const tail = Array.from({ length: 256 }, (_, i) => ({ wallMs: i * 290, simSeconds: 100 + i * 0.05, eye: [60 + i * 0.1, 1.65, 40],
    route: i < 128 ? 12 : 13, input: { walking: true }, target: { visible: false }, aimProof: null }));
  assert.equal(typeof capture.describeAimProofExpiry, 'function');
  const message = capture.describeAimProofExpiry(tail, { simSeconds: 60.2, wallMs: 350000 });
  assert.match(message, /driver-stalled/);
  assert.match(message, /route count 13/);
  assert.match(message, /3 whole loops/);
  assert.match(message, /60\.2 simulation seconds/);
});
function functionBody(source, name) {
  const start = source.indexOf('async function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  const next = source.indexOf('\nasync function ', start + 10);
  return source.slice(start, next < 0 ? undefined : next);
}
test('combat-union and row waits no longer use wall-only waitForFunction', async () => {
  const source = (await readFile(new URL('./animation-capture.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const combat = functionBody(source, 'earnedCombatUnion');
  assert.doesNotMatch(combat, /waitForFunction/);
  assert.equal((combat.match(/waitSimulation\(/g) ?? []).length, 5);
  for (const name of ['weaponSegment', 'sharedMovementUnion', 'blockedWalkUnion'])
    assert.doesNotMatch(functionBody(source, name), /waitForFunction/, name + ' has a wall-only game-event wait');
});

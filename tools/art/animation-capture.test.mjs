import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runtimeDependencyIdentities } from './runtime-dependencies.mjs';
import * as capture from './animation-capture.mjs';
import { requirePlan09, REQUIRED_ASSERTIONS, requireStableGates, REQUIRED_STABLE_GATES, simulationBudget,
  NATURAL_DEATH_WALL_GUARD_MS, NATURAL_RESPAWN_WALL_GUARD_MS, COLLECTION_LIFETIME_MS,
  COLLECTION_LIFETIME_PROJECTION, NATURAL_DEATH_SIM_SECONDS, NATURAL_RESPAWN_SIM_SECONDS,
  independentTracerComplete, diagnoseAcquisition } from './animation-capture.mjs';
import { MANIFEST_PATH, PROVENANCE_PATH } from './runtime-dependencies.mjs';
import { ACCEPTANCE_PATH } from './motion-acceptance.mjs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as paired from './animation-budget-paired.mjs';
import { canonical } from './animation-budget-v2.mjs';
const identities = { 'src/main.js': 'a'.repeat(64),
  ...runtimeDependencyIdentities() };
const completeSummary = '---\nstatus: complete\n---\n';
// ---- Plan 07-16 task 4: synthetic readers for the fourth argument of the plan 09 predicate ----------
// A frozen-route record now also needs the list of frozen evaluations and the owner's recorded
// acceptance; a paired record needs the registry, its history and its reports. The predicate reads
// them through reader functions that default to the files on disk. Controls supply these synthetic
// ones instead: nothing here is read from the gitignored cache.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const repoFile = name => readFileSync(new URL('../../' + name, import.meta.url));
const PHASE = '.planning/phases/07-movement-matched-and-action-safe-animation/';
const DECISION_PATH = PHASE + '07-18-FROZEN-PASS-DECISION.md';
const PLAN13_RESULT_PATH = paired.EVIDENCE_DIR + '07-13-v2-requalification.json';
const PLAN13_CANDIDATE_PATH = paired.EVIDENCE_DIR + '07-13-cost-candidate.json';
const RECORDED_CANDIDATE_PATH = paired.EVIDENCE_DIR + '07-18-cost-candidate.json';
const frontmatterOf = fields => '---\n' + Object.entries(fields).filter(([, value]) => value !== undefined)
  .map(([key, value]) => `${key}: ${value}`).join('\n') + '\n---\n';
// The owner decision record plan 07-18 writes after a blocking owner checkpoint; synthetic here.
const decisionRecord = (fields = {}) => Buffer.from(frontmatterOf({ decision: 'accept-frozen-pass', decided: '2026-10-12',
  decided_by: 'owner', evaluation: 2, evaluations: 2, ...fields }) + '\nOwner reply, verbatim: accept-frozen-pass\n');
const DECISION = decisionRecord();
const PLAN13_AT = '2026-10-10T07:22:59.763Z', EXIT0_AT = '2026-10-12T09:00:00.000Z', EXIT0_REPORT = '7'.repeat(64);
const plan13Candidate = (ids = { 'src/main.js': '9'.repeat(64), captureSampler: 'e'.repeat(64) }) =>
  jsonBytes({ schemaVersion: 1, complete: true, capturedAt: PLAN13_AT, identities: ids });
const plan13Result = candidate => jsonBytes({ schemaVersion: 1, plan: '07-13', exitCode: 1,
  candidate: { path: PLAN13_CANDIDATE_PATH, sha256: sha(candidate), capturedAt: PLAN13_AT },
  stdout: JSON.stringify({ candidateReportSha256: sha(candidate), applicableBudgetPass: false,
    overruns: Array.from({ length: 40 }, () => ({})) }) });
const PLAN13_CANDIDATE = plan13Candidate();
// One entry of what the scan returns: a complete candidate report at this source identity with the
// result of the unchanged frozen command for it (the shape of `frozenEvaluationList`).
const scannedEntry = (reportSha256, capturedAt, overruns, paths = [RECORDED_CANDIDATE_PATH]) => ({ evaluation: 1, of: 1, reportSha256, paths,
  capturedAt, resultPrinted: true, exitCode: overruns === 0 ? 0 : 1, overrunCount: overruns, applicableBudgetPass: overruns === 0,
  exitZeroObserved: overruns === 0 });
// The list a frozen-route record carries: the plan 07-13 evaluation, then the exit 0 put forward as evaluation 2 of 2.
const FROZEN_EVALUATIONS = [
  { evaluation: 1, of: 2, reportSha256: sha(PLAN13_CANDIDATE), capturedAt: PLAN13_AT, exitCode: 1, overrunCount: 40, sameIdentity: false },
  { evaluation: 2, of: 2, reportSha256: EXIT0_REPORT, capturedAt: EXIT0_AT, exitCode: 0, overrunCount: 0, putForward: true }];
function frozenWorld(edit) {
  const world = { files: { [DECISION_PATH]: DECISION, [paired.REGISTRY_PATH]: jsonBytes(paired.emptyRegistry()),
    [PLAN13_RESULT_PATH]: plan13Result(PLAN13_CANDIDATE), [PLAN13_CANDIDATE_PATH]: PLAN13_CANDIDATE },
    scanned: [scannedEntry(EXIT0_REPORT, EXIT0_AT, 0)], committed: null, versions: [], disk: [], frozen: null, calls: [] };
  edit?.(world);
  return world;
}
// The reader functions over one synthetic world. Every call is recorded in `world.calls`.
function readersOf(world) {
  const seen = (name, value) => { world.calls.push(name); return value; };
  return {
    file: name => {
      seen('file:' + name);
      if (Object.hasOwn(world.files, name)) return world.files[name];
      if (world.disk.includes(name)) return repoFile(name);
      throw Error('no such synthetic file');
    },
    evidenceFiles: () => seen('evidenceFiles', Object.keys(world.files).filter(name =>
      name.startsWith(paired.EVIDENCE_DIR) && name.endsWith('.json')).sort()),
    committedRegistry: () => seen('committedRegistry', world.committed),
    registryHistory: () => seen('registryHistory', typeof world.versions === 'function' ? world.versions() : world.versions),
    frozenEvaluations: () => seen('frozenEvaluations', structuredClone(world.scanned)),
    frozen: name => seen('frozen:' + name, world.frozen(name)),
  };
}
const frozenReaders = edit => readersOf(frozenWorld(edit));
const good = () => ({ complete: true, identities, applicableBudgetPass: true,
  frozenEvaluations: structuredClone(FROZEN_EVALUATIONS), frozenDecision: { path: DECISION_PATH, sha256: sha(DECISION) },
  assertions: REQUIRED_ASSERTIONS.map(id => ({ id, status: 'pass', executed: true,
    exitCode: 0, logSha256: 'b'.repeat(64) })) });
test('capture accepts only current complete09 with both executed browser qualifications', () => {
  assert.equal(requirePlan09(identities, completeSummary, good(), frozenReaders()), true);
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
  assert.equal(requirePlan09(identities, '---\r\nstatus: complete\r\nhistory:\r\n  status: halted\r\n---\r\nstatus: halted\r\n', good(), frozenReaders()), true);
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

test('combat page journal stores page errors, rejections and error or warning console lines', () => {
  const j = capture.combatPageJournal();
  j.onPageError(new Error('boom'));
  j.onConsole({ type: () => 'error', text: () => 'bad thing' });
  j.onConsole({ type: () => 'warning', text: () => 'careful' });
  j.onConsole({ type: () => 'log', text: () => 'ordinary' });
  j.onConsole({ type: () => 'error', text: () => '[moving-combat] already forwarded' });
  assert.deepEqual(j.entries.map(e => [e.kind, e.text]),
    [['pageerror', 'boom'], ['console', 'bad thing'], ['console', 'careful']]);
  for (const e of j.entries) assert.ok(Number.isFinite(e.wallMs));
  assert.equal(j.dropped, 0);
});
test('combat page journal keeps at most 200 entries and counts the rest as dropped', () => {
  const j = capture.combatPageJournal();
  for (let i = 0; i < 250; i++) j.onPageError(new Error('e' + i));
  assert.equal(j.entries.length, 200);
  assert.equal(j.dropped, 50);
  assert.equal(j.entries[0].text, 'e0');
});
test('combat page journal stores unhandled rejections that are not Error objects', () => {
  const j = capture.combatPageJournal();
  j.onPageError('plain rejection');
  assert.equal(j.entries[0].kind, 'pageerror');
  assert.equal(j.entries[0].text, 'plain rejection');
});
for (const [name, state] of [
  ['re-locked', { pointerLocked: true, pauseVisible: false, overlayVisible: false, mode: 'tdm', gameRunning: true }],
  ['handler-not-run', { pointerLocked: false, pauseVisible: true, overlayVisible: false, mode: 'tdm', gameRunning: true }],
  ['returned', { pointerLocked: false, pauseVisible: false, overlayVisible: true, mode: null, gameRunning: false }],
  ['unknown', { pointerLocked: false, pauseVisible: false, overlayVisible: false, mode: 'tdm', gameRunning: false }]])
  test('menu return diagnostics classifies ' + name, () => {
    const d = capture.menuReturnDiagnostics(state);
    assert.equal(d.reason, name);
    for (const key of Object.keys(state)) assert.equal(d[key], state[key]);
  });
// Plan 07-23: early approach stall and approach failure diagnostics.
const trace = (count, stepKind, step = 0) => Array.from({ length: count }, (_, i) => ({ simSeconds: i * 0.5,
  x: 36 + step * i, z: 31.93, walking: true, alive: true, approaching: true, stepKind }));
test('approach stalled: the abort ends the wait at once with the observed simulation seconds and wall milliseconds', async () => {
  const page = scriptedPage([{ wallMs: 0, simSeconds: 0, met: false }, { wallMs: 4000, simSeconds: 6, met: false, stalled: true }]);
  await assert.rejects(capture.waitSimulation(page, { what: 'death', limitSimSeconds: 120, wallGuardMs: 600000,
    sample: { argument: null, read: () => null, predicate: s => s.met === true, abort: s => (s.stalled ? 'player held W without moving' : null) } }),
    error => {
      assert.match(error.message, /^Approach stalled/);
      assert.match(error.message, /player held W without moving/);
      assert.match(error.message, /6\.0 simulation seconds/);
      assert.match(error.message, /4000 wall ms/);
      assert.equal(error.wait.simSeconds, 6);
      return true;
    });
});
test('approach stalled: a null abort reason leaves the wait unchanged and a met condition still wins', async () => {
  const page = scriptedPage([{ wallMs: 0, simSeconds: 0, met: false }, { wallMs: 900, simSeconds: 2, met: true }]);
  const result = await capture.waitSimulation(page, { what: 'death', limitSimSeconds: 120, wallGuardMs: 60000,
    sample: { argument: null, read: () => null, predicate: s => s.met === true, abort: () => null } });
  assert.equal(result.outcome, 'met');
});
test('approach stalled: the natural-death abort fires only for a stalled route step', () => {
  assert.equal(typeof capture.approachStallReason, 'function');
  assert.match(capture.approachStallReason(trace(14, 'route', 0.001)), /route step/);
  assert.equal(capture.approachStallReason(trace(14, 'route', 0.2)), null);
  assert.equal(capture.approachStallReason(trace(14, 'fallback', 0)), null);
  assert.equal(capture.approachStallReason(trace(14, 'unreachable', 0)), null);
  assert.equal(capture.approachStallReason(trace(14, 'arrived', 0)), null);
  assert.equal(capture.approachStallReason(trace(4, 'route', 0)), null);
  assert.equal(capture.approachStallReason([]), null);
});
const progressFrom = (count, kind, step = 0) => Array.from({ length: count }, (_, i) => ({ simSeconds: i * 0.5, wallMs: i * 700,
  eye: [36 + step * i, 1.65, 31.93], dead: false, input: { walking: true }, approaching: true,
  step: { kind, waypoint: [34, 30], targetCell: [8, 12], pathLength: 6 } }));
test('approach failure: describes the classification, figures, last step and at most eight hostiles', () => {
  assert.equal(typeof capture.describeApproachFailure, 'function');
  const hostiles = Array.from({ length: 12 }, (_, i) => ({ x: i, z: 50, state: 'patrol', distance: 18 + i, visible: false, alive: true }));
  const failure = capture.describeApproachFailure({ progress: progressFrom(16, 'route', 0), hostiles,
    wait: { simSeconds: 7.5, wallMs: 5250 } });
  assert.equal(failure.classification, 'stalled');
  assert.equal(failure.simSeconds, 7.5);
  assert.equal(failure.wallMs, 5250);
  assert.equal(failure.lastStep.kind, 'route');
  assert.equal(failure.hostiles.length, 8);
  assert.deepEqual(Object.keys(failure.hostiles[0]).sort(), ['alive', 'distance', 'state', 'visible', 'x', 'z']);
});
test('approach failure: moving, missing wait and empty inputs stay well formed', () => {
  assert.equal(typeof capture.describeApproachFailure, 'function');
  const moving = capture.describeApproachFailure({ progress: progressFrom(16, 'route', 0.3), hostiles: [], wait: null });
  assert.equal(moving.classification, 'moving');
  assert.equal(moving.simSeconds, null);
  assert.equal(moving.wallMs, null);
  const empty = capture.describeApproachFailure({ progress: [], hostiles: undefined, wait: undefined });
  assert.equal(empty.classification, 'undetermined');
  assert.equal(empty.lastStep, null);
  assert.deepEqual(empty.hostiles, []);
});
test('approach failure: the driver is exported and sends only W and mouse movement while approaching', async () => {
  assert.equal(typeof capture.installCombatDriver, 'function');
  const source = (await readFile(new URL('./animation-capture.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const start = source.indexOf('export async function installCombatDriver(');
  assert.ok(start >= 0, 'installCombatDriver must be exported');
  const body = source.slice(start, source.indexOf('\nasync function earnedCombatUnion', start));
  assert.match(body, /\/tools\/art\/approach-route\.mjs/);
  for (const forbidden of [/player\.hp\s*=[^=]/, /player\.energy\s*=[^=]/, /player\.dead\s*=[^=]/,
    /camera\.position\.(set|copy|x\s*=|y\s*=|z\s*=)/, /\.state\s*=[^=]/, /\.dead\s*=[^=]/, /mixer\w*\s*=[^=]/i, /\.time\s*=[^=]/])
    assert.doesNotMatch(body, forbidden);
  const keys = [...body.matchAll(/code:'(\w+)'/g)].map(m => m[1]);
  assert.deepEqual([...new Set(keys)], ['KeyW']);
});

// ---- Plan 07-16 task 4: the plan 09 predicate ---------------------------------------------------
// Re-review note N-01: the runtime dependency binding (CR-03) inside the two predicates. Both sides
// of each comparison carry the same identities, so only verifyRuntimeDependencies can reject, and
// each case asserts that check's own message.
// A rejection by one named check: an AssertionError whose first line is exactly that check's message
// (node appends the compared values on later lines).
const rejectedWith = message => error => {
  assert.ok(error instanceof assert.AssertionError, 'not an assertion rejection: ' + error);
  assert.equal(error.message.split('\n')[0], message);
  return true;
};
const stableEvidence = ids => ({ identities: ids, checks: REQUIRED_STABLE_GATES.map(id => ({ id,
  executed: true, exitCode: 0, scope: 'full', logSha256: 'c'.repeat(64) })) });
const DEPENDENCY_CASES = {
  'manifest identity absent': [ids => { delete ids[MANIFEST_PATH]; }, 'Missing/stale runtime manifest identity'],
  'manifest identity stale': [ids => { ids[MANIFEST_PATH] = 'f'.repeat(64); }, 'Missing/stale runtime manifest identity'],
  'provenance identity changed': [ids => { ids[PROVENANCE_PATH] = 'f'.repeat(64); }, 'Missing/changed protected provenance identity'],
  'acceptance registry identity absent': [ids => { delete ids[ACCEPTANCE_PATH]; }, 'Missing/stale acceptance registry identity'],
};
for (const [name, [mutate, message]] of Object.entries(DEPENDENCY_CASES)) {
  test('runtime dependency binding in the stable gate predicate: ' + name, () => {
    assert.ok(ACCEPTANCE_PATH in identities && MANIFEST_PATH in identities && PROVENANCE_PATH in identities);
    assert.equal(requireStableGates(identities, stableEvidence(identities)), true);
    const ids = structuredClone(identities); mutate(ids);
    assert.throws(() => requireStableGates(ids, stableEvidence(ids)), rejectedWith(message));
  });
  test('runtime dependency binding in the plan 09 predicate, frozen route: ' + name, () => {
    const ids = structuredClone(identities); mutate(ids);
    assert.throws(() => requirePlan09(ids, completeSummary, { ...good(), identities: ids }), rejectedWith(message));
  });
}

// ---- Plan 07-16 task 4, continued: both routes of the plan 09 predicate ---------------------------
// A rejection by a check of the paired tool, which throws plain errors: the first line matches.
const rejectedLike = pattern => error => {
  assert.ok(error instanceof Error, 'not an error: ' + error);
  assert.match(String(error.message).split('\n')[0], pattern);
  return true;
};
const CONTRACT_FILES = [paired.PAIRED_CONTRACT.v2Path, paired.PAIRED_CONTRACT.decisionPath, paired.PAIRED_CONTRACT.v2ReviewPath];
// The identities of a paired record carry the sampler identity, as every real identity set does.
const pairedIdentities = { ...identities, captureSampler: '5'.repeat(64) };
const frozenIdentity = sha(canonical(identities));
const TOOL_HASHES = Object.fromEntries(paired.TOOL_PATHS.map(name => [name, 'd'.repeat(64)]));
const BROWSER = 'synthetic-browser 1.0', SAMPLER = 'e'.repeat(64);
const passingAssertions = () => REQUIRED_ASSERTIONS.map(id => ({ id, status: 'pass', executed: true, exitCode: 0, logSha256: 'b'.repeat(64) }));
// What the unchanged frozen command prints for a report: a result line at exit 0, or at exit 1 with numeric overruns only.
const frozenRunOf = (reportSha256, overruns, exitCode = overruns === 0 ? 0 : 1) => ({ exitCode, stderr: '',
  stdout: JSON.stringify({ candidateReportSha256: reportSha256, applicableBudgetPass: overruns === 0,
    overruns: Array.from({ length: overruns }, () => ({})), certification: false }) + '\n' });
const STDERR_ONLY = { exitCode: 1, stdout: '', stderr: 'Missing/stale runtime manifest identity\n' };

// Sessions driven through a registry with the tool's own pure functions. Each group is one source
// identity: a passed calibration, then one qualifying session per listed result ('pass', 'fail',
// 'invalid', or 'started' and 'registered' for a session that never closed).
function sessionsOf(groups) {
  const files = {}, candidates = {};
  let time = Date.parse('2026-10-12T10:00:00.000Z'), registry = paired.emptyRegistry(), count = 0;
  const now = () => new Date(time += 1000).toISOString();
  const drive = (kind, result, group) => {
    const nonce = String(++count).padStart(32, '0');
    registry = paired.registerSession(registry, { kind, nonce, commit: 'c'.repeat(40), identity: group.identity, host: { note: 'synthetic' },
      toolHashes: { ...TOOL_HASHES }, samplerIdentity: SAMPLER }, now);
    if (result === 'registered') return;
    registry = paired.appendEvent(registry, { type: 'started', kind, nonce, registrationHash: paired.eventHash(registry.events.at(-1)) }, now);
    if (result === 'started') return;
    const valid = result !== 'invalid', outcome = !valid ? 'invalid' : result === 'pass' ? 'passed' : 'failed';
    const report = jsonBytes({ schemaVersion: 1, kind, nonce, outcome, certification: false });
    const candidate = jsonBytes({ schemaVersion: 1, complete: true, capturedAt: now(), identities: group.candidateIds ?? group.ids,
      samples: Array.from({ length: 12 }, () => ({})), paired: { nonce, kind, arm: 'candidate' } });
    registry = paired.closeSession(registry, nonce, { valid, pass: valid ? outcome === 'passed' : null,
      settings: structuredClone(paired.SESSION_SETTINGS), browserVersion: BROWSER,
      reportHashes: { session: sha(report), reference: sha('reference arm of ' + nonce), candidate: sha(candidate) },
      ...(kind === 'qualifying' ? { frozenExitCode: group.frozenOverruns === 0 ? 0 : 1, frozenOverrunCount: group.frozenOverruns ?? 3 } : {}) }, now);
    if (kind === 'qualifying') { files[`${paired.EVIDENCE_DIR}07-18-paired-session-${count}.json`] = report; candidates[nonce] = candidate; }
  };
  for (const group of groups) {
    drive('calibration', 'pass', group);
    for (const result of group.results) drive('qualifying', result, group);
  }
  return { registry, files, candidates };
}
// Commits a world's registry (one committed version equal to the working one) and, the first time,
// writes the record a builder would write from it. A later call with a registry edited by hand keeps
// the record and updates only its registry hash, so that the edit is the one thing wrong.
function publish(world, registry) {
  world.registry = registry;
  world.versions = [{ commit: 'a'.repeat(40), onHead: true, registry: structuredClone(registry) }];
  world.committed = structuredClone(registry);
  world.files[paired.REGISTRY_PATH] = jsonBytes(registry);
  if (world.record) { world.record.paired.registry.sha256 = sha(world.files[paired.REGISTRY_PATH]); return world; }
  const registrationCommits = paired.registrationCommitsOf(registry, world.versions);
  const verdict = paired.registryVerdict(registry, world.identity, { registrationCommits });
  const passed = verdict.sessions.filter(session => session.outcome === 'passed').at(-1);
  if (passed) world.files[RECORDED_CANDIDATE_PATH] = world.candidates[passed.nonce];
  world.frozen = name => frozenRunOf(sha(world.files[name]), world.frozenOverruns);
  world.record = { complete: true, identities: world.ids, applicableBudgetPass: world.frozenOverruns === 0,
    timingGate: 'paired-same-session', candidate: RECORDED_CANDIDATE_PATH, assertions: passingAssertions(),
    paired: { v2Sha256: paired.PAIRED_CONTRACT.v2Sha256, decisionSha256: paired.PAIRED_CONTRACT.decisionSha256,
      v2ReviewSha256: paired.PAIRED_CONTRACT.v2ReviewSha256,
      registry: { path: paired.REGISTRY_PATH, sha256: sha(world.files[paired.REGISTRY_PATH]) },
      identity: world.identity, verdict: verdict.verdict, passed: verdict.passed, failed: verdict.failed, invalid: verdict.invalid,
      started: verdict.started, allQualifying: structuredClone(verdict.allQualifying),
      registrationCommits: structuredClone(registrationCommits), structuralV2Pass: true } };
  return world;
}
function pairedWorld({ results = ['pass'], ids = pairedIdentities, candidateIds, earlier = [], frozenOverruns = 3 } = {}) {
  const identity = paired.identityHash(ids);
  const groups = [...earlier.map((list, index) => {
    const other = { ...ids, 'src/main.js': String(index + 1).repeat(64) };
    return { identity: paired.identityHash(other), ids: other, results: list, frozenOverruns };
  }), { identity, ids, candidateIds, results, frozenOverruns }];
  const built = sessionsOf(groups);
  return publish({ ids, identity, files: { ...built.files }, candidates: built.candidates, disk: [...CONTRACT_FILES], scanned: [],
    frozenOverruns, frozen: null, calls: [] }, built.registry);
}
const sessionReports = world => Object.keys(world.files).filter(name => /07-18-paired-session-\d+\.json$/.test(name)).sort();
// A registry rebuilt from events edited by hand, with a valid chain and matching registration hashes,
// so that a rule of the registry is the one thing the edit breaks.
function rechained(events) {
  let registry = paired.emptyRegistry();
  const registrations = new Map();
  for (const event of events) {
    const next = Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'seq' && key !== 'prevHash'));
    if (next.type === 'started') next.registrationHash = registrations.get(next.nonce);
    registry = paired.appendEvent(registry, next);
    if (next.type === 'registered') registrations.set(next.nonce, paired.eventHash(registry.events.at(-1)));
  }
  return registry;
}
function handEdited(world, find, change) {
  const events = structuredClone(world.registry.events);
  change(events.find(find));
  return publish(world, rechained(events));
}
// One fully valid input per route: what the predicate accepts before a control changes one thing.
function routeOf(route, ids) {
  if (route === 'frozen') return { ids: ids ?? identities, record: { ...good(), identities: ids ?? identities }, world: frozenWorld() };
  const world = pairedWorld({ ids: ids ?? pairedIdentities });
  return { ids: world.ids, record: world.record, world };
}
const judged = (input, summary = completeSummary) => requirePlan09(input.ids, summary, input.record, readersOf(input.world));
const ROUTES = ['frozen', 'paired'];

// ---- the frozen route, tightened ------------------------------------------------------------------
// Each control starts from the record that was enough before plan 07-16 (no timingGate,
// applicableBudgetPass true, both assertions, a complete summary) and changes one thing.
function frozenInput(editRecord, editWorld) {
  const record = good();
  editRecord?.(record);
  return { ids: identities, record, world: frozenWorld(editWorld) };
}
function withDecision(bytes) {
  const input = frozenInput();
  input.world.files[DECISION_PATH] = bytes;
  input.record.frozenDecision = { path: DECISION_PATH, sha256: sha(bytes) };
  return input;
}
// A frozen-route world whose registry shows one closed qualifying session of this source identity.
function withRegistrySession(frozenOverruns) {
  const input = frozenInput();
  const built = sessionsOf([{ identity: frozenIdentity, ids: identities, results: ['fail'], frozenOverruns }]);
  const closed = built.registry.events.findLast(event => event.type === 'closed' && event.kind === 'qualifying');
  Object.assign(input.world, { committed: structuredClone(built.registry),
    versions: [{ commit: 'a'.repeat(40), onHead: true, registry: structuredClone(built.registry) }] });
  input.world.files[paired.REGISTRY_PATH] = jsonBytes(built.registry);
  return { input, closed };
}
test('tightened frozen route: a complete and consistent record is accepted, with no timingGate or with frozen-v2 named', () => {
  assert.equal(judged(frozenInput()), true);
  assert.equal(judged(frozenInput(record => { record.timingGate = 'frozen-v2'; })), true);
  assert.equal(judged(frozenInput(record => { record.candidate = RECORDED_CANDIDATE_PATH; })), true);
});
test('tightened frozen route: the record that was enough before plan 07-16, with neither new field, is rejected', () => {
  assert.throws(() => judged(frozenInput(record => { delete record.frozenDecision; delete record.frozenEvaluations; })),
    rejectedWith('Frozen-route plan09 qualification names no owner decision record'));
});
test('tightened frozen route: a record without frozenDecision is rejected', () => {
  for (const value of [undefined, null, {}, { path: DECISION_PATH }, { sha256: sha(DECISION) }, { path: DECISION_PATH, sha256: 'not a hash' }])
    assert.throws(() => judged(frozenInput(record => { if (value === undefined) delete record.frozenDecision; else record.frozenDecision = value; })),
      rejectedWith('Frozen-route plan09 qualification names no owner decision record'), JSON.stringify(value));
});
test('tightened frozen route: a record without frozenEvaluations is rejected', () => {
  for (const value of [undefined, null, [], { 0: FROZEN_EVALUATIONS[0] }])
    assert.throws(() => judged(frozenInput(record => { if (value === undefined) delete record.frozenEvaluations; else record.frozenEvaluations = value; })),
      rejectedWith('Frozen-route plan09 qualification has no frozen evaluation list'), JSON.stringify(value));
});
for (const decision of ['information-only', 'neither', 'approved', 'Accept-Frozen-Pass'])
  test('owner decision: a decision record that says ' + decision + ' is rejected', () => {
    assert.throws(() => judged(withDecision(decisionRecord({ decision }))), rejectedWith('Owner decision is not accept-frozen-pass'));
  });
test('owner decision: a decision record without decided_by: owner is rejected', () => {
  for (const decided_by of [undefined, 'agent', 'reviewer', 'owner-delegate', 'Owner'])
    assert.throws(() => judged(withDecision(decisionRecord({ decided_by }))), rejectedWith('Decision record is not decided by the owner'), String(decided_by));
});
test('owner decision: a decision hash that does not match the record the reader supplies is rejected', () => {
  // The supplied record still says accept-frozen-pass, decided by the owner: the hash is what binds it.
  assert.throws(() => judged(frozenInput(null, world => { world.files[DECISION_PATH] = Buffer.concat([DECISION, Buffer.from('\n')]); })),
    rejectedWith('Owner decision record differs from the hash in the qualification'));
  assert.throws(() => judged(frozenInput(record => { record.frozenDecision.sha256 = 'f'.repeat(64); })),
    rejectedWith('Owner decision record differs from the hash in the qualification'));
});
test('owner decision: a decision record that is missing, or lies outside the phase directory, is rejected', () => {
  assert.throws(() => judged(frozenInput(null, world => { delete world.files[DECISION_PATH]; })),
    rejectedWith('The owner decision record is missing or cannot be read'));
  for (const name of ['tools/art/decision.md', PHASE + 'evidence/decision.md', PHASE + '../decision.md', PHASE + 'decision.json', '/' + DECISION_PATH])
    assert.throws(() => judged(frozenInput(record => { record.frozenDecision.path = name; }, world => { world.files[name] = DECISION; })),
      rejectedWith('Owner decision record is not a record of this phase'), name);
});
// Only one plain root scalar counts, read by the rules the summary status is read by: body text, a
// nested or quoted or repeated key, a quoted value and a hidden line cannot stand for the owner's answer.
const rawDecision = (frontmatter, body = '') => Buffer.from('---\n' + frontmatter + '\n---\n' + body);
const REST = 'decided_by: owner\nevaluation: 2\nevaluations: 2';
for (const [name, bytes, message] of [
  ['the answer is only in the body', rawDecision('decision: information-only\n' + REST, 'decision: accept-frozen-pass\n'), 'Owner decision is not accept-frozen-pass'],
  ['there is no frontmatter', Buffer.from('decision: accept-frozen-pass\n' + REST + '\n'), 'Owner decision is not accept-frozen-pass'],
  ['the frontmatter is not closed', Buffer.from('---\ndecision: accept-frozen-pass\n' + REST + '\n'), 'Owner decision is not accept-frozen-pass'],
  ['the answer is in a later block', rawDecision('decision: neither\n' + REST, '---\ndecision: accept-frozen-pass\n---\n'), 'Owner decision is not accept-frozen-pass'],
  ['the key is repeated', rawDecision('decision: accept-frozen-pass\ndecision: information-only\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['the key is repeated in another case', rawDecision('decision: accept-frozen-pass\nDecision: information-only\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['a quoted key repeats it', rawDecision('decision: accept-frozen-pass\n"decision": information-only\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['an explicit key repeats it', rawDecision('decision: accept-frozen-pass\n? decision\n: information-only\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['the key is only nested', rawDecision('history:\n  decision: accept-frozen-pass\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['the value is quoted', rawDecision('decision: "accept-frozen-pass"\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['the value carries a comment', rawDecision('decision: accept-frozen-pass # for now\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['the value is a list', rawDecision('decision: [accept-frozen-pass]\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['the scalar has an indented child', rawDecision('decision: accept-frozen-pass\n  child: information-only\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['a lone carriage return hides a second key', rawDecision('decision: accept-frozen-pass\nnote: x\rdecision: information-only\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['the key is a continuation line of a quoted scalar', rawDecision('note: "a\ndecision: accept-frozen-pass\nb"\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['the mapping is indented', rawDecision(' decision: neither\nnote: "a\ndecision: accept-frozen-pass\n' + REST + '\nb"'), 'Owner decision is not accept-frozen-pass'],
  ['a line is indented with a tab', rawDecision('decision: accept-frozen-pass\n\tnote: x\n' + REST), 'Owner decision is not accept-frozen-pass'],
  ['decided_by is quoted, so the record is not in the plain form at all', rawDecision('decision: accept-frozen-pass\ndecided_by: "owner"\nevaluation: 2\nevaluations: 2'), 'Owner decision is not accept-frozen-pass'],
  ['decided_by carries a comment', rawDecision('decision: accept-frozen-pass\ndecided_by: owner # by proxy\nevaluation: 2\nevaluations: 2'), 'Decision record is not decided by the owner'],
  ['decided_by is repeated', rawDecision('decision: accept-frozen-pass\ndecided_by: owner\ndecided_by: agent\nevaluation: 2\nevaluations: 2'), 'Decision record is not decided by the owner'],
  ['decided_by is only in the body', rawDecision('decision: accept-frozen-pass\nevaluation: 2\nevaluations: 2', 'decided_by: owner\n'), 'Decision record is not decided by the owner'],
]) test('owner decision: only a plain root scalar counts, not when ' + name, () => {
  assert.throws(() => judged(withDecision(bytes)), rejectedWith(message));
});
test('owner decision: the plain form is accepted with CRLF line endings, comments and other keys', () => {
  assert.equal(judged(withDecision(Buffer.from('---\r\n# recorded after the checkpoint\r\ndecision: accept-frozen-pass  \r\ndecided: 2026-10-12\r\n' +
    'decided_by: owner\r\nevaluation: 2\r\nevaluations: 2\r\nreply: |\r\n  accept-frozen-pass\r\ntiming_result_sha256: ' + 'a'.repeat(64) + '\r\n---\r\n\r\nbody\r\n'))), true);
});
test('owner decision: a decision for another evaluation, or made on another count of evaluations, is rejected', () => {
  for (const evaluation of [1, 3, undefined, '02', '2nd'])
    assert.throws(() => judged(withDecision(decisionRecord({ evaluation }))), rejectedWith('Owner decision is for another evaluation'), String(evaluation));
  for (const evaluations of [1, 3, undefined])
    assert.throws(() => judged(withDecision(decisionRecord({ evaluations }))),
      rejectedWith('Owner decision was made on another count of evaluations'), String(evaluations));
});
test('tightened frozen route: a list that omits the plan 07-13 evaluation is rejected', () => {
  assert.throws(() => judged(frozenInput(record => {
    record.frozenEvaluations = [{ ...FROZEN_EVALUATIONS[1], evaluation: 1, of: 1 }];
  })), rejectedLike(/^Frozen evaluation list omits an evaluation that the scan, the registry or the plan 07-13 evidence shows: [a-f0-9]{64}$/));
});
test('tightened frozen route: a list that omits an evaluation the scan shows is rejected', () => {
  // A second complete candidate report at this identity, captured later and over its limits.
  assert.throws(() => judged(frozenInput(null, world => { world.scanned.push(scannedEntry('8'.repeat(64), '2026-10-12T11:00:00.000Z', 5)); })),
    rejectedLike(/^Frozen evaluation list omits an evaluation that the scan, the registry or the plan 07-13 evidence shows: 8{64}$/));
});
test('tightened frozen route: a list that omits a session the registry reader shows is rejected', () => {
  const { input, closed } = withRegistrySession(3);
  assert.throws(() => judged(input), rejectedLike(new RegExp('^Frozen evaluation list omits an evaluation that the scan, the registry or the ' +
    'plan 07-13 evidence shows: ' + closed.reportHashes.candidate + '$')));
  // With that session's candidate arm listed as evaluation 3 of 3, and the owner's answer made on that count, it is accepted.
  input.record.frozenEvaluations = [...FROZEN_EVALUATIONS.map(entry => ({ ...entry, of: 3 })), { evaluation: 3, of: 3,
    reportSha256: closed.reportHashes.candidate, capturedAt: closed.at, exitCode: 1, overrunCount: 3 }];
  const decision = decisionRecord({ evaluations: 3 });
  input.world.files[DECISION_PATH] = decision;
  input.record.frozenDecision = { path: DECISION_PATH, sha256: sha(decision) };
  assert.equal(judged(input), true);
});
test('tightened frozen route: an entry that no scan, registry event or plan 07-13 record shows is rejected', () => {
  assert.throws(() => judged(frozenInput(record => {
    record.frozenEvaluations = [...FROZEN_EVALUATIONS.map(entry => ({ ...entry, of: 3 })),
      { evaluation: 3, of: 3, reportSha256: '6'.repeat(64), capturedAt: '2026-10-12T12:00:00.000Z', exitCode: 0, overrunCount: 0 }];
  })), rejectedWith('Frozen evaluation list holds an entry that no scan, registry event or plan 07-13 record shows'));
});
test('tightened frozen route: every entry is evaluation k of n in time order, with the exit code, overrun count and capture time found', () => {
  const changed = (index, field, value) => frozenInput(record => { record.frozenEvaluations[index][field] = value; });
  assert.throws(() => judged(frozenInput(record => { record.frozenEvaluations.reverse(); })),
    rejectedWith('Frozen evaluation 1 of 2 differs from what was found: evaluation'));
  assert.throws(() => judged(changed(1, 'evaluation', 1)), rejectedWith('Frozen evaluation 2 of 2 differs from what was found: evaluation'));
  assert.throws(() => judged(changed(0, 'of', 1)), rejectedWith('Frozen evaluation 1 of 2 differs from what was found: of'));
  assert.throws(() => judged(changed(0, 'exitCode', 0)), rejectedWith('Frozen evaluation 1 of 2 differs from what was found: exitCode'));
  assert.throws(() => judged(changed(0, 'overrunCount', 0)), rejectedWith('Frozen evaluation 1 of 2 differs from what was found: overrunCount'));
  assert.throws(() => judged(changed(1, 'capturedAt', PLAN13_AT)), rejectedWith('Frozen evaluation 2 of 2 differs from what was found: capturedAt'));
  assert.throws(() => judged(changed(1, 'overrunCount', undefined)), rejectedWith('Frozen evaluation 2 of 2 differs from what was found: overrunCount'));
});
test('tightened frozen route: the list says whether the plan 07-13 evaluation was made at this source identity', () => {
  const message = 'Frozen evaluation list does not say whether the plan 07-13 evaluation was made at this source identity';
  assert.throws(() => judged(frozenInput(record => { delete record.frozenEvaluations[0].sameIdentity; })), rejectedWith(message));
  assert.throws(() => judged(frozenInput(record => { record.frozenEvaluations[0].sameIdentity = true; })), rejectedWith(message));
  // Made at this identity, the scan finds the plan 07-13 candidate and the record must say so.
  const same = plan13Candidate(identities);
  const atThisIdentity = sameIdentity => frozenInput(record => {
    Object.assign(record.frozenEvaluations[0], { reportSha256: sha(same), sameIdentity });
  }, world => {
    Object.assign(world.files, { [PLAN13_CANDIDATE_PATH]: same, [PLAN13_RESULT_PATH]: plan13Result(same) });
    world.scanned.unshift(scannedEntry(sha(same), PLAN13_AT, 40, [PLAN13_CANDIDATE_PATH]));
  });
  assert.equal(judged(atThisIdentity(true)), true);
  assert.throws(() => judged(atThisIdentity(false)), rejectedWith(message));
});
test('tightened frozen route: exactly one evaluation is put forward', () => {
  const message = 'Frozen-route plan09 qualification must put forward exactly one evaluation';
  assert.throws(() => judged(frozenInput(record => { delete record.frozenEvaluations[1].putForward; })), rejectedWith(message));
  assert.throws(() => judged(frozenInput(record => { record.frozenEvaluations[1].putForward = 'yes'; })), rejectedWith(message));
  assert.throws(() => judged(frozenInput(record => { record.frozenEvaluations[0].putForward = true; })), rejectedWith(message));
});
test('tightened frozen route: a frozen exit 0 on a report the scan does not find cannot be put forward', () => {
  // The registry shows a qualifying session whose candidate arm made the frozen command exit 0, but no
  // report with that hash is found by the scan: it is listed, and it cannot be the one put forward.
  const { input, closed } = withRegistrySession(0);
  assert.equal(closed.frozenExitCode, 0);
  input.world.scanned = [];
  input.record.frozenEvaluations = [FROZEN_EVALUATIONS[0], { evaluation: 2, of: 2, reportSha256: closed.reportHashes.candidate,
    capturedAt: closed.at, exitCode: 0, overrunCount: 0, putForward: true }];
  assert.throws(() => judged(input), rejectedWith('A frozen exit 0 on a report the scan does not find cannot be put forward'));
  // The plan 07-13 evaluation, shown by its evidence and not by the scan, cannot be put forward either.
  assert.throws(() => judged(frozenInput(record => {
    delete record.frozenEvaluations[1].putForward; record.frozenEvaluations[0].putForward = true;
  })), rejectedWith('A frozen exit 0 on a report the scan does not find cannot be put forward'));
});
test('tightened frozen route: the evaluation put forward must be a frozen exit 0 with a printed result', () => {
  const message = 'The evaluation put forward is not a frozen exit 0';
  const scanned = (edit, entry = {}) => frozenInput(record => { Object.assign(record.frozenEvaluations[1], entry); },
    world => { Object.assign(world.scanned[0], edit); });
  assert.throws(() => judged(scanned({ exitCode: 1, overrunCount: 3, applicableBudgetPass: false, exitZeroObserved: false },
    { exitCode: 1, overrunCount: 3 })), rejectedWith(message));
  assert.throws(() => judged(scanned({ resultPrinted: false, applicableBudgetPass: null, overrunCount: null }, { overrunCount: null })),
    rejectedWith(message));
  assert.throws(() => judged(scanned({ applicableBudgetPass: false })), rejectedWith(message));
});
test('tightened frozen route: a named candidate must be the report of the evaluation put forward', () => {
  assert.throws(() => judged(frozenInput(record => { record.candidate = PLAN13_CANDIDATE_PATH; })),
    rejectedWith('The recorded candidate is not the report of the evaluation put forward'));
  assert.throws(() => judged(frozenInput(record => { record.candidate = null; })),
    rejectedWith('The recorded candidate is not the report of the evaluation put forward'));
});
test('tightened frozen route: the registry must be readable and whole, so that no session it shows can be hidden', () => {
  assert.throws(() => judged(frozenInput(null, world => { delete world.files[paired.REGISTRY_PATH]; })),
    rejectedWith('The paired session registry is missing or cannot be read'));
  assert.throws(() => judged(frozenInput(null, world => { world.files[paired.REGISTRY_PATH] = Buffer.from('not json'); })),
    rejectedWith('The paired session registry is missing or cannot be read'));
  const { input } = withRegistrySession(3);
  const broken = JSON.parse(input.world.files[paired.REGISTRY_PATH].toString('utf8'));
  broken.events.splice(3, 3);
  input.world.files[paired.REGISTRY_PATH] = jsonBytes(broken);
  assert.throws(() => judged(input), rejectedLike(/^The committed registry holds more events than the registry in the working tree$/));
  const edited = withRegistrySession(3).input, registry = JSON.parse(edited.world.files[paired.REGISTRY_PATH].toString('utf8'));
  registry.events[1].at = '2026-10-12T10:00:02.500Z';
  edited.world.files[paired.REGISTRY_PATH] = jsonBytes(registry);
  assert.throws(() => judged(edited), rejectedLike(/^Registry chain broken at sequence 3: /));
});
test('tightened frozen route: the plan 07-13 evidence must be readable and agree with itself', () => {
  assert.throws(() => judged(frozenInput(null, world => { delete world.files[PLAN13_RESULT_PATH]; })),
    rejectedWith('The plan 07-13 frozen evaluation record is missing or cannot be read'));
  assert.throws(() => judged(frozenInput(null, world => { delete world.files[PLAN13_CANDIDATE_PATH]; })),
    rejectedWith('The plan 07-13 candidate report is missing or cannot be read'));
  assert.throws(() => judged(frozenInput(null, world => { world.files[PLAN13_CANDIDATE_PATH] = plan13Candidate({ captureSampler: 'e'.repeat(64) }); })),
    rejectedWith('The plan 07-13 candidate differs from its recorded evaluation'));
  assert.throws(() => judged(frozenInput(null, world => {
    world.files[PLAN13_RESULT_PATH] = jsonBytes({ ...JSON.parse(world.files[PLAN13_RESULT_PATH].toString('utf8')), stdout: '' });
  })), rejectedWith('The plan 07-13 frozen evaluation record holds no result'));
});
test('tightened frozen route: a scan that gives no usable list is rejected', () => {
  for (const scanned of [null, [{ reportSha256: 'short' }], [scannedEntry(EXIT0_REPORT, EXIT0_AT, 0), scannedEntry(EXIT0_REPORT, EXIT0_AT, 0)]])
    assert.throws(() => judged(frozenInput(null, world => { world.scanned = scanned; })),
      rejectedWith('The frozen evaluation scan gave no usable list'));
});

// ---- the timing gate ----------------------------------------------------------------------------------
for (const [label, gate] of [['an unknown string', 'paired'], ['another known word', 'frozen'], ['null', null], ['the empty string', ''],
  ['a number', 0], ['a list', ['paired-same-session']], ['undefined as an own property', undefined]])
  test('timingGate: ' + label + ' is rejected on a record that is otherwise complete, on the frozen and on the paired shape', () => {
    const frozen = frozenInput(record => { record.timingGate = gate; });
    assert.throws(() => judged(frozen), rejectedWith('Unknown plan09 timing gate'));
    assert.deepEqual(frozen.world.calls, []);
    const world = pairedWorld({ frozenOverruns: 0 });
    assert.equal(world.record.applicableBudgetPass, true);
    assert.equal(requirePlan09(world.ids, completeSummary, world.record, readersOf(world)), true);
    world.calls.length = 0;
    world.record.timingGate = gate;
    assert.throws(() => requirePlan09(world.ids, completeSummary, world.record, readersOf(world)), rejectedWith('Unknown plan09 timing gate'));
    assert.deepEqual(world.calls, []);
  });

// ---- the paired route ---------------------------------------------------------------------------------
test('paired route: a pass verdict under the pinned contract qualifies, with the frozen result recorded as reported and not required to pass', () => {
  const world = pairedWorld();
  assert.equal(world.record.applicableBudgetPass, false);
  assert.deepEqual([world.record.paired.verdict, world.record.paired.passed, world.record.paired.failed, world.record.paired.invalid,
    world.record.paired.started], ['pass', 1, 0, 0, 1]);
  assert.equal(world.record.frozenDecision, undefined);
  assert.equal(requirePlan09(world.ids, completeSummary, world.record, readersOf(world)), true);
});
test('paired route: a frozen exit 0 on the recorded candidate is recorded as reported and changes nothing else', () => {
  const world = pairedWorld({ frozenOverruns: 0 });
  assert.equal(world.record.applicableBudgetPass, true);
  assert.equal(requirePlan09(world.ids, completeSummary, world.record, readersOf(world)), true);
  const other = pairedWorld();
  assert.deepEqual({ ...world.record.paired, registry: null, allQualifying: null }, { ...other.record.paired, registry: null, allQualifying: null });
});
test('paired route: fail, pass, pass qualifies with every session listed, sessions of an earlier identity included; invalid then pass qualifies', () => {
  const world = pairedWorld({ results: ['fail', 'pass', 'pass'], earlier: [['fail', 'fail'], ['invalid', 'started', 'registered']] });
  assert.deepEqual([world.record.paired.verdict, world.record.paired.passed, world.record.paired.failed, world.record.paired.invalid,
    world.record.paired.started], ['pass', 2, 1, 0, 3]);
  assert.deepEqual(world.record.paired.allQualifying.map(group => [group.started, group.invalid, group.verdict]),
    [[2, 0, 'failed'], [3, 3, 'failed'], [3, 0, 'pass']]);
  assert.equal(requirePlan09(world.ids, completeSummary, world.record, readersOf(world)), true);
  const second = pairedWorld({ results: ['invalid', 'pass'] });
  assert.deepEqual([second.record.paired.passed, second.record.paired.invalid, second.record.paired.started], [1, 1, 2]);
  assert.equal(requirePlan09(second.ids, completeSummary, second.record, readersOf(second)), true);
});
const anotherReport = world => jsonBytes({ schemaVersion: 1, complete: true, capturedAt: '2026-10-10T07:22:59.763Z', identities: world.ids,
  samples: Array.from({ length: 12 }, () => ({})) });
const PAIRED_REJECTIONS = [
  ['the record has no paired block', {}, world => { delete world.record.paired; }, 'Paired plan09 qualification has no paired block'],
  ['applicableBudgetPass is not recorded as the frozen command reported it', {}, world => { delete world.record.applicableBudgetPass; },
    'Paired plan09 qualification must carry the frozen result as reported'],
  ['a contract hash in the record differs from the pinned one', {}, world => { world.record.paired.decisionSha256 = 'f'.repeat(64); },
    'Paired plan09 qualification names another contract: decisionSha256'],
  ['the contract hashes are absent from the record', {}, world => { delete world.record.paired.v2Sha256; },
    'Paired plan09 qualification names another contract: v2Sha256'],
  ['a pinned contract record no longer matches its file', {}, world => {
    world.files[paired.PAIRED_CONTRACT.v2Path] = Buffer.concat([repoFile(paired.PAIRED_CONTRACT.v2Path), Buffer.from('\n')]);
  }, /^Paired contract record changed: /],
  ['a pinned contract record cannot be read', {}, world => { world.disk = []; }, 'A paired contract record is missing or cannot be read'],
  ['the record is for another source identity', {}, world => { world.record.paired.identity = 'f'.repeat(64); },
    'Paired plan09 qualification is for another source identity'],
  ['the registry is missing', {}, world => { delete world.files[paired.REGISTRY_PATH]; }, 'The paired session registry is missing or cannot be read'],
  ['the registry hash differs', {}, world => { world.record.paired.registry.sha256 = 'f'.repeat(64); },
    'Paired plan09 qualification registry hash differs from the registry file'],
  ['the record names another registry file', {}, world => { world.record.paired.registry.path = paired.EVIDENCE_DIR + 'another-registry.json'; },
    'Paired plan09 qualification registry hash differs from the registry file'],
  ['the chain is broken by an edited event', {}, world => {
    const registry = structuredClone(world.registry);
    registry.events[1].at = '2026-10-12T10:00:02.500Z';
    publish(world, registry);
  }, /^Registry chain broken at sequence 3: /],
  ['an event is not in the committed registry', {}, world => { world.committed = { ...world.committed, events: world.committed.events.slice(0, -1) }; },
    /^Registry holds an event that is not in the committed registry: sequence 6$/],
  ['a committed version holds events the current list dropped', {}, world => {
    world.versions.push({ commit: 'b'.repeat(40), onHead: false, registry: paired.appendEvent(world.registry,
      { type: 'registered', kind: 'smoke', nonce: '9'.repeat(32), commit: 'c'.repeat(40), identity: world.identity }) });
  }, /^Registry history check failed: the version committed at b{40} holds 7 events and the current list 6; events were dropped$/],
  ['the registry history is shallow', {}, world => { world.versions = () => paired.registryHistory({ isShallow: () => 'true' }); },
    /^Registry history is shallow/],
  ['the verdict is undecided after one pass and one fail', { results: ['pass', 'fail'] }, null,
    /^Paired registry verdict is not pass: undecided, 2 of at most 3 sessions started; 1 valid sessions passed; 1 valid sessions failed; 0 invalid$/],
  ['the verdict is undecided with no qualifying session', { results: [] }, null, /^Paired registry verdict is not pass: undecided, 0 of at most 3 /],
  ['the verdict is undecided after an invalid session', { results: ['invalid'] }, null, /^Paired registry verdict is not pass: undecided, 1 of at most 3 /],
  ['the verdict is undecided while a session is registered and never closed', { results: ['started'] }, null,
    /^Paired registry verdict is not pass: undecided, 1 of at most 3 /],
  ['the verdict is failed after two valid fails', { results: ['fail', 'fail'] }, null, /^Paired registry verdict is not pass: failed, 2 of at most 3 /],
  ['the verdict is failed after pass, fail, invalid', { results: ['pass', 'fail', 'invalid'] }, null, /^Paired registry verdict is not pass: failed, 3 of at most 3 /],
  ['the record claims a pass the registry does not give', { results: ['pass', 'fail'] }, world => {
    Object.assign(world.record.paired, { verdict: 'pass', passed: 1, failed: 0, invalid: 0, started: 1 });
    world.record.paired.allQualifying[0].sessions.pop();
  }, /^Paired registry verdict is not pass: undecided, /],
  ['the record does not carry the verdict', {}, world => { world.record.paired.verdict = 'undecided'; },
    'Paired plan09 qualification does not record the verdict as pass'],
  ...['passed', 'failed', 'invalid', 'started'].map(field => [`the record's ${field} differs from the registry's`, { results: ['fail', 'pass', 'pass'] },
    world => { world.record.paired[field] += 1; }, 'Paired plan09 qualification denominators differ from the registry: ' + field]),
  ['a denominator is absent from the record', {}, world => { delete world.record.paired.invalid; },
    'Paired plan09 qualification denominators differ from the registry: invalid'],
  ['a registry session is omitted from the record', { results: ['fail', 'pass', 'pass'] }, world => { world.record.paired.allQualifying[0].sessions.shift(); },
    'Paired plan09 qualification does not list every qualifying session in the registry'],
  ['a session of an earlier identity is omitted from allQualifying', { earlier: [['fail', 'fail']] }, world => {
    world.record.paired.allQualifying = world.record.paired.allQualifying.filter(group => group.identity === world.identity);
  }, 'Paired plan09 qualification does not list every qualifying session in the registry'],
  ['allQualifying is absent from the record', {}, world => { delete world.record.paired.allQualifying; },
    'Paired plan09 qualification does not list every qualifying session in the registry'],
  ['the commit of a registration is not named', {}, world => { world.record.paired.registrationCommits.pop(); },
    'Paired plan09 qualification does not name the commit of every registration'],
  ['a registration is named with another commit', {}, world => { world.record.paired.registrationCommits[0].commit = 'b'.repeat(40); },
    'Paired plan09 qualification does not name the commit of every registration'],
  ['registrationCommits is absent from the record', {}, world => { delete world.record.paired.registrationCommits; },
    'Paired plan09 qualification does not name the commit of every registration'],
  ['a session report is missing', { results: ['fail', 'pass', 'pass'] }, world => { delete world.files[sessionReports(world)[0]]; },
    /^The session report of a qualifying session is not present with the hash in its closed event: 0{31}2$/],
  ['the report of a session of an earlier identity is missing', { earlier: [['fail', 'fail']] }, world => { delete world.files[sessionReports(world)[0]]; },
    /^The session report of a qualifying session is not present with the hash in its closed event: 0{31}2$/],
  ['a report hashes differently from the one in the registry closed event', {}, world => {
    const name = sessionReports(world)[0];
    world.files[name] = Buffer.concat([world.files[name], Buffer.from(' ')]);
  }, /^The session report of a qualifying session is not present with the hash in its closed event: 0{31}2$/],
  ['paired.structuralV2Pass is false', {}, world => { world.record.paired.structuralV2Pass = false; }, 'Paired plan09 qualification has no structural V2 pass'],
  ['paired.structuralV2Pass is absent', {}, world => { delete world.record.paired.structuralV2Pass; }, 'Paired plan09 qualification has no structural V2 pass'],
  ['the record names no candidate in the evidence directory', {}, world => {
    world.files['tools/art/candidate.json'] = world.files[RECORDED_CANDIDATE_PATH];
    world.record.candidate = 'tools/art/candidate.json';
  }, 'Paired plan09 qualification names no candidate in the evidence directory'],
  ['the recorded candidate path leaves the evidence directory', {}, world => { world.record.candidate = paired.EVIDENCE_DIR + '../07-09-SUMMARY.md'; },
    'Paired plan09 qualification names no candidate in the evidence directory'],
  ['the recorded candidate is missing', {}, world => { delete world.files[RECORDED_CANDIDATE_PATH]; }, 'The recorded candidate is missing or cannot be read'],
  ['the recorded candidate is an existing single-arm report and not the candidate arm of a passed session', {},
    world => { world.files[RECORDED_CANDIDATE_PATH] = anotherReport(world); },
    'The recorded candidate is not the candidate arm of a valid passed session of this source identity'],
  ['the recorded candidate is the candidate arm of a failed session', { results: ['fail', 'pass', 'pass'] },
    world => { world.files[RECORDED_CANDIDATE_PATH] = world.candidates['0'.repeat(31) + '2']; },
    'The recorded candidate is not the candidate arm of a valid passed session of this source identity'],
  ['the recorded candidate makes the frozen tool fail structurally', {}, world => { world.frozen = () => STDERR_ONLY; },
    'The frozen command printed no result line for the recorded candidate'],
  ['the frozen command exits 1 with a line that claims every limit met', {}, world => { world.frozen = name => frozenRunOf(sha(world.files[name]), 0, 1); },
    'The frozen command printed no result line for the recorded candidate'],
  ['the frozen result is for another report', {}, world => { world.frozen = () => frozenRunOf('f'.repeat(64), 3); },
    'The frozen command printed no result line for the recorded candidate'],
  ['the candidate arm is of another source identity than the record', { candidateIds: { ...pairedIdentities, 'src/main.js': '4'.repeat(64) } }, null,
    'The recorded candidate is of another source identity'],
  ['the recorded applicableBudgetPass is not what the frozen command reports', {}, world => { world.record.applicableBudgetPass = true; },
    'Recorded applicableBudgetPass differs from what the frozen command reports for the recorded candidate'],
  // What registration refuses, written into a registry by hand: the verdict is refused, so nothing qualifies.
  ['the calibration is invalid', {}, world => handEdited(world, event => event.type === 'closed' && event.kind === 'calibration',
    event => Object.assign(event, { valid: false, pass: null, outcome: 'invalid' })),
    /^Registry rule broken at sequence 4: a qualifying session without a closed, valid and passed calibration/],
  ['the calibration failed', {}, world => handEdited(world, event => event.type === 'closed' && event.kind === 'calibration',
    event => Object.assign(event, { pass: false, outcome: 'failed' })),
    /^Registry rule broken at sequence 4: a qualifying session without a closed, valid and passed calibration/],
  ['a counted session was registered with other tool bytes than its calibration', {},
    world => handEdited(world, event => event.type === 'registered' && event.kind === 'qualifying',
      event => { event.toolHashes = { ...event.toolHashes, [paired.TOOL_PATHS[2]]: '1'.repeat(64) }; }),
    /^Registry rule broken at sequence 4: a qualifying session not covered by its calibration: tools\/art\/animation-capture\.mjs differs/],
  ['a counted session was registered with another sampler identity than its calibration', {},
    world => handEdited(world, event => event.type === 'registered' && event.kind === 'qualifying', event => { event.samplerIdentity = '1'.repeat(64); }),
    /^Registry rule broken at sequence 4: a qualifying session not covered by its calibration: the sampler identity differs/],
  ['a counted session closed with another browser version than its calibration', {},
    world => handEdited(world, event => event.type === 'closed' && event.kind === 'qualifying', event => { event.browserVersion = 'another browser 2.0'; }),
    /^Registry rule broken at sequence 4: a qualifying session closed with another browser version than its calibration$/],
];
for (const [name, options, edit, message] of PAIRED_REJECTIONS) test('paired route rejects when ' + name, () => {
  const world = pairedWorld(options);
  edit?.(world);
  assert.throws(() => requirePlan09(world.ids, completeSummary, world.record, readersOf(world)),
    typeof message === 'string' ? rejectedWith(message) : rejectedLike(message));
});
test('paired route: the identity must be the current one, in the record, in its paired block and in the registry', () => {
  // A whole and valid qualification of an earlier source identity, judged against the current identities.
  const earlier = pairedWorld({ ids: { ...pairedIdentities, 'src/main.js': '3'.repeat(64) } });
  assert.equal(requirePlan09(earlier.ids, completeSummary, earlier.record, readersOf(earlier)), true);
  assert.throws(() => requirePlan09(pairedIdentities, completeSummary, earlier.record, readersOf(earlier)), rejectedWith('Stale plan09 qualification'));
  // The same record relabelled with the current identities still names the earlier identity and its sessions.
  earlier.record.identities = pairedIdentities;
  assert.throws(() => requirePlan09(pairedIdentities, completeSummary, earlier.record, readersOf(earlier)),
    rejectedWith('Paired plan09 qualification is for another source identity'));
  earlier.record.paired.identity = paired.identityHash(pairedIdentities);
  assert.throws(() => requirePlan09(pairedIdentities, completeSummary, earlier.record, readersOf(earlier)),
    rejectedLike(/^Paired registry verdict is not pass: undecided, 0 of at most 3 /));
  // An identity set without the sampler identity has no source identity.
  const bare = pairedWorld();
  const { captureSampler, ...withoutSampler } = pairedIdentities;
  assert.equal(typeof captureSampler, 'string');
  bare.record.identities = withoutSampler;
  assert.throws(() => requirePlan09(withoutSampler, completeSummary, bare.record, readersOf(bare)), rejectedWith('Identity set has no sampler identity'));
});

// ---- both routes: every check the predicate made before plan 07-16 --------------------------------------
// Re-review note N-02: the earlier rejection controls call with three arguments, and several accept any
// exception, so a final rejection of every three-argument call would satisfy them whatever was checked.
// These controls pass the synthetic readers, start from an input the route accepts, and assert the message
// of the one check they name; no reader may be consulted before that check rejects.
function rejectsBeforeAnyReader(route, change, message, summary) {
  const input = routeOf(route);
  assert.equal(judged(input), true);
  change?.(input);
  input.world.calls.length = 0;
  assert.throws(() => judged(input, summary), rejectedWith(message));
  assert.deepEqual(input.world.calls, []);
}
const UNQUALIFIED_SUMMARIES = {
  halted: '---\nstatus: halted\n---\n',
  partial: '---\nstatus: partial\n---\n',
  missing: '---\nstatus: missing\n---\n',
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
};
for (const route of ROUTES) {
  for (const [name, summary] of Object.entries(UNQUALIFIED_SUMMARIES))
    test(`summary status on the ${route} route, every later requirement met: ${name}`, () => {
      rejectsBeforeAnyReader(route, null, 'Plan09 is missing, halted or unqualified', summary);
    });
  test(`summary status on the ${route} route, every later requirement met: the real summary held at halted plus a fenced completion`, async () => {
    const summary = await readFile(new URL('../../.planning/phases/07-movement-matched-and-action-safe-animation/07-09-SUMMARY.md', import.meta.url), 'utf8');
    const halted = summary.replace(/^status:.*$/m, 'status: halted');
    assert.match(halted, /^status: halted$/m);
    rejectsBeforeAnyReader(route, null, 'Plan09 is missing, halted or unqualified', halted + '\n```yaml\nstatus: complete\n```\n');
  });
  for (const [name, [mutate, message]] of Object.entries(DEPENDENCY_CASES))
    test(`runtime dependency binding in the plan 09 predicate on the ${route} route, every later requirement met: ${name}`, () => {
      assert.equal(judged(routeOf(route)), true);
      const ids = structuredClone(route === 'frozen' ? identities : pairedIdentities);
      mutate(ids);
      // The record is rebuilt for the changed identities, so both sides are equal and nothing later can reject.
      const input = routeOf(route, ids);
      assert.throws(() => judged(input), rejectedWith(message));
      assert.deepEqual(input.world.calls, []);
    });
  const EARLIER_CHECKS = {
    'the qualification is not complete': [record => { record.complete = false; }, 'Missing complete plan09 qualification'],
    'the qualification identities are stale': [record => { record.identities = { ...record.identities, 'src/main.js': 'f'.repeat(64) }; },
      'Stale plan09 qualification'],
    'the qualification identities are empty': [record => { record.identities = {}; }, 'Stale plan09 qualification'],
  };
  // Titles name an assertion by its part after the #, which a TAP report would otherwise escape.
  for (const id of REQUIRED_ASSERTIONS) { const label = id.split('#')[1]; Object.assign(EARLIER_CHECKS, {
    [label + ' is missing']: [record => { record.assertions = record.assertions.filter(a => a.id !== id); }, 'Unrun required browser assertion: ' + id],
    [label + ' did not run']: [record => { record.assertions.find(a => a.id === id).executed = false; }, 'Unrun required browser assertion: ' + id],
    [label + ' ended in a setup timeout']: [record => { record.assertions.find(a => a.id === id).status = 'setup-timeout'; },
      'Unqualified required browser assertion: ' + id],
    [label + ' failed']: [record => { record.assertions.find(a => a.id === id).status = 'fail'; }, 'Unqualified required browser assertion: ' + id],
    [label + ' exited 1']: [record => { record.assertions.find(a => a.id === id).exitCode = 1; }, 'Nonpassing required browser assertion: ' + id],
    [label + ' has no log identity']: [record => { delete record.assertions.find(a => a.id === id).logSha256; }, 'Missing assertion log identity'],
    [label + ' has an empty log identity']: [record => { record.assertions.find(a => a.id === id).logSha256 = ''; }, 'Missing assertion log identity'],
  }); }
  if (route === 'frozen') EARLIER_CHECKS['the frozen command reported an overrun'] =
    [record => { record.applicableBudgetPass = false; }, 'Plan09 fixed-V2 acceptance is unqualified'];
  for (const [name, [mutate, message]] of Object.entries(EARLIER_CHECKS))
    test(`earlier check on the ${route} route keeps its own message, every later requirement met: ${name}`, () => {
      rejectsBeforeAnyReader(route, input => mutate(input.record), message);
    });
}
test('order: each check the predicate made before plan 07-16 rejects before every later one, and before any reader is consulted', () => {
  const [first, second] = REQUIRED_ASSERTIONS;
  for (const route of ROUTES) {
    // Everything wrong at once; then one earlier defect is repaired at a time and the next message appears.
    const broken = () => {
      const input = routeOf(route);
      const { [MANIFEST_PATH]: manifest, ...withoutManifest } = input.ids;
      assert.equal(typeof manifest, 'string');
      Object.assign(input.record, { complete: false, identities: {}, applicableBudgetPass: 'yes',
        assertions: [{ id: first, executed: false, status: 'fail', exitCode: 1 }, { id: second, executed: true, status: 'fail', exitCode: 1 }] });
      delete input.record.frozenDecision; delete input.record.frozenEvaluations; delete input.record.paired;
      return { input, whole: input.ids, withoutManifest };
    };
    const steps = [
      [({ input, withoutManifest }) => { input.ids = withoutManifest; return UNQUALIFIED_SUMMARIES.halted; }, 'Plan09 is missing, halted or unqualified'],
      [({ input, withoutManifest }) => { input.ids = withoutManifest; }, 'Missing/stale runtime manifest identity'],
      [() => {}, 'Missing complete plan09 qualification'],
      [({ input }) => { input.record.complete = true; }, 'Stale plan09 qualification'],
      [({ input, whole }) => { input.record.complete = true; input.record.identities = whole; },
        route === 'frozen' ? 'Plan09 fixed-V2 acceptance is unqualified' : 'Unrun required browser assertion: ' + first],
      [({ input, whole }) => { Object.assign(input.record, { complete: true, identities: whole, applicableBudgetPass: true }); },
        'Unrun required browser assertion: ' + first],
      [({ input, whole }) => {
        Object.assign(input.record, { complete: true, identities: whole, applicableBudgetPass: true });
        input.record.assertions[0] = passingAssertions()[0];
      }, 'Unqualified required browser assertion: ' + second],
    ];
    for (const [repair, message] of steps) {
      const state = broken(), summary = repair(state) ?? completeSummary;
      assert.throws(() => judged(state.input, summary), rejectedWith(message), `${route}: ${message}`);
      assert.deepEqual(state.input.world.calls, [], `${route}: ${message}`);
    }
    // With every earlier check satisfied, the first new requirement of the route is what rejects.
    const last = broken();
    Object.assign(last.input.record, { complete: true, identities: last.whole, applicableBudgetPass: true, assertions: passingAssertions() });
    assert.throws(() => judged(last.input), rejectedWith(route === 'frozen'
      ? 'Frozen-route plan09 qualification names no owner decision record' : 'Paired plan09 qualification has no paired block'));
  }
});
test('injected readers: only the named readers are consulted, and never for the summary, the identities or the qualification', () => {
  const expected = {
    frozen: [['committedRegistry', 'file', 'frozenEvaluations', 'registryHistory'],
      [DECISION_PATH, paired.REGISTRY_PATH, PLAN13_RESULT_PATH, PLAN13_CANDIDATE_PATH].sort()],
    paired: [['committedRegistry', 'evidenceFiles', 'file', 'frozen', 'registryHistory'],
      [...CONTRACT_FILES, paired.REGISTRY_PATH, RECORDED_CANDIDATE_PATH, paired.EVIDENCE_DIR + '07-18-paired-session-2.json'].sort()],
  };
  for (const route of ROUTES) {
    const input = routeOf(route), asked = new Set();
    const readers = new Proxy(readersOf(input.world), { get: (target, key) => { asked.add(key); return target[key]; } });
    assert.equal(requirePlan09(input.ids, completeSummary, input.record, readers), true);
    assert.deepEqual([...asked].sort(), expected[route][0], route);
    const files = [...new Set(input.world.calls.filter(call => call.startsWith('file:')).map(call => call.slice(5)))].sort();
    assert.deepEqual(files, expected[route][1], route);
    for (const name of files) assert.doesNotMatch(name, /SUMMARY|07-09-qualification/);
  }
});

// ---- the applicable timing gate for the recorded candidate (what executeV2 reports) ----------------------
// On the paired route the unchanged frozen command must first print a result line for the recorded candidate;
// only then is the paired verdict asked, and `passed` needs both.
const verdictRunOf = (verdict, identity, exitCode = verdict === 'pass' ? 0 : 1) => ({ exitCode, stderr: '',
  stdout: JSON.stringify({ contractVersion: 'paired-same-session-v2', identity, verdict, passed: verdict === 'pass' ? 1 : 0, failed: 0, invalid: 0,
    started: 1, wording: verdict === 'pass' ? 'passed, session 1 of 1; 0 valid sessions failed; 0 invalid' : verdict + ', 1 of at most 3 sessions started' }) + '\n' });
async function pairedOutcome(change = {}) {
  const world = pairedWorld(), candidate = world.files[RECORDED_CANDIDATE_PATH], asked = [];
  const input = { qualification: world.record, frozenRun: frozenRunOf(sha(candidate), 3), readCandidate: async () => candidate,
    runVerdict: async identity => { asked.push(identity); return verdictRunOf('pass', identity); } };
  Object.assign(input, typeof change === 'function' ? change(world, input) : change);
  assert.equal(typeof capture.actualV2Outcome, 'function');
  return { outcome: await capture.actualV2Outcome(input), asked, world };
}
test('paired actual V2: a numeric-only frozen failure with a pass verdict passes, and the frozen result is recorded as reported', async () => {
  const { outcome, asked, world } = await pairedOutcome();
  assert.equal(outcome.passed, true);
  assert.deepEqual([outcome.timingGate, outcome.structuralV2Pass, outcome.frozenApplicableBudgetPass, outcome.frozenOverrunCount,
    outcome.pairedVerdict, outcome.certification], ['paired-same-session', true, false, 3, 'pass', false]);
  assert.equal(outcome.result.applicableBudgetPass, false);
  assert.equal(outcome.pairedWording, 'passed, session 1 of 1; 0 valid sessions failed; 0 invalid');
  assert.deepEqual(asked, [world.identity]);
  // Wording stays inside section 10 of the contract: never the original limits, a frame rate, a device or a human acceptance.
  assert.match(outcome.meaning, /never means the original absolute limits were met/);
  assert.doesNotMatch(JSON.stringify({ ...outcome, meaning: null, result: null }), /limits (were )?met|budget met|within budget/i);
});
test('paired actual V2: a stderr-only failure of the frozen tool makes passed false whatever the registry says', async () => {
  const { outcome, asked } = await pairedOutcome({ frozenRun: STDERR_ONLY });
  assert.equal(outcome.passed, false);
  assert.equal(outcome.structuralV2Pass, false);
  assert.equal(outcome.blocker, 'The frozen command printed no result line for the recorded candidate');
  // The verdict runner here would have answered pass; it is not asked at all.
  assert.deepEqual(asked, []);
  for (const frozenRun of [{ exitCode: 0, stdout: '', stderr: '' }, { exitCode: null, stdout: '', stderr: 'timeout' },
    frozenRunOf('f'.repeat(64), 3), { exitCode: 2, stderr: '', stdout: frozenRunOf('0'.repeat(64), 3).stdout }]) {
    const other = await pairedOutcome({ frozenRun });
    assert.equal(other.outcome.passed, false);
    assert.deepEqual(other.asked, []);
  }
});
test('paired actual V2: the real frozen command prints no result line for a candidate without the manifest identity, and nothing qualifies', async () => {
  // Re-review risk 6: the runtime dependency binding (CR-03) reaches the paired route through the unchanged
  // frozen command, which fails on stderr only for a report whose identities lack the runtime manifest.
  const { [MANIFEST_PATH]: manifest, ...candidateIds } = pairedIdentities;
  assert.equal(typeof manifest, 'string');
  const world = pairedWorld({ candidateIds }), candidate = world.files[RECORDED_CANDIDATE_PATH];
  assert.equal(JSON.parse(candidate.toString('utf8')).identities[MANIFEST_PATH], undefined);
  const root = fileURLToPath(new URL('../../', import.meta.url)), directory = mkdtempSync(path.join(tmpdir(), 'vod-plan09-paired-'));
  let run;
  try {
    const file = path.join(directory, 'candidate.json');
    writeFileSync(file, candidate);
    const result = spawnSync(process.execPath, ['tools/art/animation-budget-v2.mjs', 'verify', '--budget',
      path.join(root, paired.FROZEN_BUDGET_PATH), '--candidate', file], { cwd: root, encoding: 'utf8' });
    run = { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally { rmSync(directory, { recursive: true, force: true }); }
  assert.equal(run.exitCode, 1);
  assert.equal(run.stdout.trim(), '');
  assert.match(run.stderr, /runtime manifest identity/);
  const asked = [];
  assert.equal(typeof capture.actualV2Outcome, 'function');
  const outcome = await capture.actualV2Outcome({ qualification: world.record, frozenRun: run, readCandidate: async () => candidate,
    runVerdict: async identity => { asked.push(identity); return verdictRunOf('pass', identity); } });
  assert.equal(outcome.passed, false);
  assert.equal(outcome.structuralV2Pass, false);
  assert.deepEqual(asked, []);
  world.frozen = () => run;
  assert.throws(() => requirePlan09(world.ids, completeSummary, world.record, readersOf(world)),
    rejectedWith('The frozen command printed no result line for the recorded candidate'));
});
test('paired actual V2: an undecided, failed or refused verdict, or a verdict for another identity, does not pass', async () => {
  for (const runVerdict of [
    async identity => verdictRunOf('undecided', identity), async identity => verdictRunOf('failed', identity),
    async () => ({ exitCode: 2, stdout: '', stderr: 'Verdict refused: Registry chain broken at sequence 3\n' }),
    async () => verdictRunOf('pass', 'f'.repeat(64)), async identity => verdictRunOf('undecided', identity, 0),
    async identity => verdictRunOf('pass', identity, 1), async () => ({ exitCode: 0, stdout: 'pass', stderr: '' })]) {
    const { outcome } = await pairedOutcome({ runVerdict });
    assert.equal(outcome.passed, false);
    assert.equal(outcome.structuralV2Pass, true);
    assert.equal(outcome.blocker, 'The paired registry verdict is not pass');
  }
});
test('paired actual V2: the verdict is asked for the source identity of the recorded candidate, which the record must name', async () => {
  const { outcome, asked } = await pairedOutcome((world, input) => ({ qualification: { ...input.qualification,
    paired: { ...input.qualification.paired, identity: 'f'.repeat(64) } } }));
  assert.equal(outcome.passed, false);
  assert.deepEqual(asked, []);
  assert.equal(outcome.blocker, 'The paired qualification is for another source identity than the recorded candidate');
  const unreadable = await pairedOutcome({ readCandidate: async () => { throw Error('ENOENT'); } });
  assert.equal(unreadable.outcome.passed, false);
  assert.deepEqual(unreadable.asked, []);
});
test('paired actual V2: a frozen exit 0 on the recorded candidate is recorded as reported and changes nothing else', async () => {
  const { outcome: plain } = await pairedOutcome();
  const { outcome } = await pairedOutcome((world, input) => ({ frozenRun: frozenRunOf(sha(world.files[RECORDED_CANDIDATE_PATH]), 0) }));
  assert.deepEqual([outcome.passed, outcome.structuralV2Pass, outcome.frozenApplicableBudgetPass, outcome.frozenOverrunCount, outcome.pairedVerdict],
    [true, true, true, 0, 'pass']);
  assert.deepEqual([outcome.passed, outcome.pairedVerdict, outcome.pairedWording], [plain.passed, plain.pairedVerdict, plain.pairedWording]);
  // And with an undecided verdict the frozen exit 0 is still not a pass.
  const undecided = await pairedOutcome((world, input) => ({ frozenRun: frozenRunOf(sha(world.files[RECORDED_CANDIDATE_PATH]), 0),
    runVerdict: async identity => verdictRunOf('undecided', identity) }));
  assert.equal(undecided.outcome.passed, false);
  assert.equal(undecided.outcome.frozenApplicableBudgetPass, true);
});
test('frozen actual V2: unchanged, an exit 0 with every limit met passes and nothing else does, and no paired effect is used', async () => {
  assert.equal(typeof capture.actualV2Outcome, 'function');
  const never = async () => { throw Error('not used on the frozen route'); };
  const outcomeOf = (qualification, frozenRun) => capture.actualV2Outcome({ qualification, frozenRun, readCandidate: never, runVerdict: never });
  for (const qualification of [null, good(), { ...good(), timingGate: 'frozen-v2' }]) {
    assert.deepEqual(await outcomeOf(qualification, frozenRunOf(EXIT0_REPORT, 0)), { result: JSON.parse(frozenRunOf(EXIT0_REPORT, 0).stdout), passed: true });
    assert.equal((await outcomeOf(qualification, frozenRunOf(EXIT0_REPORT, 2))).passed, false);
    assert.equal((await outcomeOf(qualification, frozenRunOf(EXIT0_REPORT, 0, 1))).passed, false);
    assert.deepEqual(await outcomeOf(qualification, STDERR_ONLY), { result: null, passed: false });
  }
});
test('actual V2: an unknown timing gate never passes', async () => {
  assert.equal(typeof capture.actualV2Outcome, 'function');
  const never = async () => { throw Error('not used'); };
  for (const timingGate of ['paired', null, '', 0]) {
    const outcome = await capture.actualV2Outcome({ qualification: { ...good(), timingGate }, frozenRun: frozenRunOf(EXIT0_REPORT, 0),
      readCandidate: never, runVerdict: never });
    assert.equal(outcome.passed, false);
    assert.equal(outcome.blocker, 'Unknown plan09 timing gate');
  }
});

// ---- production call sites ------------------------------------------------------------------------------
// The arguments of the call that starts at `open` (the index of its opening parenthesis), read with a small
// scanner that skips strings, template literals and comments and tracks bracket depth, so the result does
// not depend on line breaks, spacing or a trailing comma.
function argumentsAt(source, open) {
  assert.equal(source[open], '(');
  const parts = [];
  let depth = 0, start = open + 1, i = open;
  const skipString = quote => { for (i++; i < source.length && source[i] !== quote; i++) if (source[i] === '\\') i++; };
  const skipTemplate = () => {
    for (i++; i < source.length && source[i] !== '`'; i++) {
      if (source[i] === '\\') i++;
      else if (source[i] === '$' && source[i + 1] === '{') { i++; skipCode('}'); }
    }
  };
  // Scans code up to the bracket that closes the one at `i`; at depth 1 of the call, commas split arguments.
  function skipCode(close) {
    const outer = close === ')' && depth === 0;
    if (outer) depth = 1;
    for (i++; i < source.length; i++) {
      const c = source[i];
      if (c === '\'' || c === '"') skipString(c);
      else if (c === '`') skipTemplate();
      else if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i++; }
      else if (c === '/' && source[i + 1] === '*') { i = source.indexOf('*/', i + 2) + 1; }
      else if (c === '(') { const saved = depth; depth = 2; skipCode(')'); depth = saved; }
      else if (c === '[') { const saved = depth; depth = 2; skipCode(']'); depth = saved; }
      else if (c === '{') { const saved = depth; depth = 2; skipCode('}'); depth = saved; }
      else if (c === close) { if (outer) parts.push(source.slice(start, i)); return; }
      else if (c === ',' && outer) { parts.push(source.slice(start, i)); start = i + 1; }
    }
    assert.fail('unbalanced call');
  }
  skipCode(')');
  const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
  const list = parts.map(strip);
  if (list.at(-1) === '') list.pop();
  return list;
}
// Every place a name occurs in a source text, with the arguments where it is called.
function occurrencesOf(source, name) {
  return [...source.matchAll(new RegExp('(?<![\\w$.])' + name + '(?![\\w$])', 'g'))].map(match => {
    const after = source.slice(match.index + name.length).match(/^\s*\(/);
    return { index: match.index, called: !!after, declared: /function\s+$/.test(source.slice(0, match.index)),
      args: after ? argumentsAt(source, match.index + name.length + after[0].length - 1) : null };
  });
}
test('production call site: the scanner counts arguments, not formatting', () => {
  const args = text => occurrencesOf(text, 'requirePlan09')[0].args;
  assert.deepEqual(args('requirePlan09(identities, summary, qualification);'), ['identities', 'summary', 'qualification']);
  assert.deepEqual(args('requirePlan09(\n  identities, // current\n  summary,\n  qualification, /* record */\n);'), ['identities', 'summary', 'qualification']);
  assert.deepEqual(args('requirePlan09 (identities,summary,qualification)'), ['identities', 'summary', 'qualification']);
  assert.deepEqual(args('requirePlan09(identities, summary, qualification, readers)'), ['identities', 'summary', 'qualification', 'readers']);
  assert.deepEqual(args('requirePlan09(identities, summary, qualification, { file: () => "a,b)" })'),
    ['identities', 'summary', 'qualification', '{ file: () => "a,b)" }']);
  assert.deepEqual(args('requirePlan09(...parts)'), ['...parts']);
  assert.deepEqual(args('requirePlan09(f(a, b), `x${g(1, [2, 3])},)`, { a: 1, b: [2, 3] })'), ['f(a, b)', '`x${g(1, [2, 3])},)`', '{ a: 1, b: [2, 3] }']);
  assert.deepEqual(args("requirePlan09(a, ')', b)"), ['a', "')'", 'b']);
  assert.deepEqual(args('requirePlan09()'), []);
  assert.deepEqual(occurrencesOf('const check = requirePlan09; check(a, b, c, readers);', 'requirePlan09').map(found => found.called), [false]);
  assert.deepEqual(occurrencesOf('this.requirePlan09(a); xrequirePlan09(b); requirePlan09x(c)', 'requirePlan09'), []);
});
test('production call site: captureAnimationReview calls the plan 09 predicate with exactly three arguments, and nothing else can reach it with readers', async () => {
  const source = (await readFile(new URL('./animation-capture.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const review = source.indexOf('export async function captureAnimationReview(');
  assert.ok(review > 0);
  assert.equal(source.indexOf('\nexport ', review + 1), -1, 'captureAnimationReview must stay the last export, so its body runs to the end of the file');
  const found = occurrencesOf(source, 'requirePlan09');
  // The declaration and one call: no alias, no .call or .apply, no other caller in the file.
  assert.equal(found.length, 2);
  assert.ok(found.every(entry => entry.called));
  assert.deepEqual(found.map(entry => entry.declared), [true, false]);
  assert.ok(found[1].index > review, 'the one call is inside captureAnimationReview');
  assert.deepEqual(found[1].args, ['identities', 'summary', 'qualification']);
  assert.ok(!found[1].args.some(argument => argument.startsWith('...')));
  // The declaration takes the readers as an optional fourth parameter that defaults to the files on disk.
  assert.equal(requirePlan09.length, 3);
  assert.equal(found[0].args.length, 4);
  assert.match(found[0].args[3], /^readers = [A-Z0-9_]+$/);
  // executeV2 takes the capture directory and nothing that could stand in for the frozen command or the verdict.
  const executed = occurrencesOf(source, 'executeV2');
  assert.equal(capture.executeV2.length, 1);
  assert.deepEqual(executed.map(entry => [entry.declared, entry.args]), [[true, ['directory']], [false, ['directory']]]);
  assert.ok(executed[1].index > review);
});

// Plan 07-17: the stable-gate record is written by this tool from real exit codes and hashed logs, and
// judged by the predicates of the capture tool. Nothing here decides that a gate passed.
//
//   node tools/art/stable-gates.mjs run --gates <comma-separated ids | all>
//   node tools/art/stable-gates.mjs check [--only stable]
//   node tools/art/stable-gates.mjs plan09 --timing <timing result> --registry <registry> --offline-report <Playwright JSON report>
//
// `run` executes the named gates one after another, never in parallel, each with its complete output in
// a log below the gitignored cache, and rewrites the record. A gate that was not run in this invocation
// keeps its earlier result only while the source identity is unchanged and its log still has the
// recorded hash. `check` is read-only.
//
// `plan09` (plan 07-18) builds the plan 09 qualification record from the paired timing result, the registry
// verdict recomputed from the registry, and the two required cases of the offline gate's own report. It
// decides nothing either: `check` judges the record it writes with the predicate of the capture tool, which
// re-verifies every session from the files on disk.
//
// This file only imports from review.mjs, animation-capture.mjs and animation-budget-paired.mjs. Those
// three are final and hash-pinned by the plan 07-16 implementation review.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeSync, constants, openSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, hash, iterationPath } from './pipeline.mjs';
import { ownedReviewPort } from './owned-review-port.mjs';
import { animationIdentities } from './review.mjs';
import { requirePlan09, requireStableGates } from './animation-capture.mjs';
import { PAIRED_CONTRACT, REGISTRY_PATH, checkedRegistry, identityHash, registryVerdict } from './animation-budget-paired.mjs';

const PHASE = '.planning/phases/07-movement-matched-and-action-safe-animation';
const EVIDENCE = PHASE + '/evidence';
const RECORD = EVIDENCE + '/07-10-stable-gates.json';
const ARCHIVE = EVIDENCE + '/07-10-stable-gates-halted-2026-10-07.json';
const QUALIFICATION = EVIDENCE + '/07-09-qualification.json';
const QUALIFICATION_ARCHIVE = EVIDENCE + '/07-09-qualification-halted-2026-10-07.json';
const FROZEN_DECISION = PHASE + '/07-18-FROZEN-PASS-DECISION.md';
const CACHE_ROOT = '.planning/research/.cache';
const GATE_CACHE = CACHE_ROOT + '/07-17-gates';
const QUALIFIED = CACHE_ROOT + '/07-10-qualified';
const LISTENER_PORT = QUALIFIED + '/listener-port.json';
// Where the two qualified Playwright configurations write their own JSON reports.
const BROWSER_REPORTS = Object.freeze({ offline: QUALIFIED + '/offline-results.json',
  multiplayer: QUALIFIED + '/multiplayer-results.json' });
const COUNT_KEYS = Object.freeze({ unit: 'units', offline: 'offline', multiplayer: 'multiplayer' });
const GENERATED_BY = 'tools/art/stable-gates.mjs';
const SHA256 = /^[a-f0-9]{64}$/;

// The seven gates, in the order they run, with the commands the superseded record shows were actually
// run. Only the build output directory is new. Nothing narrows a command: a run of one is a full run.
export const GATES = Object.freeze([
  { id: 'lint', command: 'npm run lint' },
  { id: 'typecheck', command: 'npm run typecheck' },
  { id: 'typecheck:mp', command: 'npm run typecheck:mp' },
  { id: 'build', command: 'npm run build -- --outDir .planning/research/.cache/07-17-gates/build' },
  { id: 'unit', command: 'node node_modules/vitest/vitest.mjs run --maxWorkers=1' },
  { id: 'offline', command: 'node node_modules/@playwright/test/cli.js test --config tools/art/offline-qualified.config.mjs' },
  { id: 'multiplayer', command: 'node node_modules/@playwright/test/cli.js test --config tools/art/multiplayer-qualified.config.mjs --workers=1' },
].map(Object.freeze));
const GATE_IDS = GATES.map(gate => gate.id);
export const RECORD_RULE = 'Actual failed full command results remain nonpassing regardless of separate focused successes';

// A gate id is not a file name on every host: on NTFS the colon of typecheck:mp would name a stream.
export function logName(id) {
  return id.replace(/[^A-Za-z0-9-]/g, '-') + '.log';
}

const RESULT_FIELDS = ['exitCode', 'log', 'logSha256', 'startedAt', 'durationMs', 'environment', 'counts'];
const runFacts = source => ({
  ...(typeof source.startedAt === 'string' ? { startedAt: source.startedAt } : {}),
  ...(Number.isFinite(source.durationMs) ? { durationMs: source.durationMs } : {}),
  ...(source.environment && typeof source.environment === 'object' ? { environment: source.environment } : {}),
});
const usable = source => Number.isInteger(source?.exitCode) && typeof source.log === 'string' && source.log !== ''
  && SHA256.test(source.logSha256 ?? '');

// Pure. `results` maps a gate id to what one full run of that gate's command gave in this invocation:
// { exitCode, log, logSha256 } and optionally startedAt, durationMs, environment and counts. A gate with
// a result is executed in full; `executed` and `scope` are never taken from the caller. A gate without a
// result keeps its previous check only when `previous.identities` deep-equals `identities` and that check
// was itself a full executed run of the same command with a log identity; otherwise it is unrun.
// `complete` is true only when all seven are executed with exit code 0.
export function buildRecord(identities, results = {}, previous = null) {
  assert.ok(identities && typeof identities === 'object' && !Array.isArray(identities), 'Missing identities of the stable gate record');
  for (const id of Object.keys(results)) assert.ok(GATE_IDS.includes(id), 'Unknown stable gate: ' + id);
  const sameSource = isDeepStrictEqual(previous?.identities, identities) && Array.isArray(previous.checks);
  const counts = { units: null, offline: null, multiplayer: null };
  const checks = GATES.map(({ id, command }) => {
    const unrun = { id, command, log: null, logSha256: null, executed: false, scope: null, exitCode: null };
    if (Object.hasOwn(results, id)) {
      const fresh = results[id];
      assert.ok(fresh && typeof fresh === 'object', 'Invalid stable gate result: ' + id);
      for (const field of Object.keys(fresh))
        assert.ok(RESULT_FIELDS.includes(field), 'Unexpected field of a stable gate result: ' + field);
      assert.ok(usable(fresh), 'Invalid stable gate result: ' + id);
      if (COUNT_KEYS[id]) counts[COUNT_KEYS[id]] = fresh.counts ?? null;
      return { id, command, log: fresh.log, logSha256: fresh.logSha256, executed: true, scope: 'full',
        exitCode: fresh.exitCode, ...runFacts(fresh) };
    }
    const kept = sameSource ? previous.checks.find(entry => entry?.id === id) : null;
    if (!kept || kept.executed !== true || kept.scope !== 'full' || kept.command !== command || !usable(kept)) return unrun;
    if (COUNT_KEYS[id]) counts[COUNT_KEYS[id]] = previous[COUNT_KEYS[id]] ?? null;
    return { id, command, log: kept.log, logSha256: kept.logSha256, executed: true, scope: 'full',
      exitCode: kept.exitCode, ...runFacts(kept) };
  });
  return { complete: checks.every(entry => entry.executed && entry.exitCode === 0), identities, checks, ...counts,
    rule: RECORD_RULE, generatedBy: GENERATED_BY };
}

// The summary block vitest prints at the end of a run. The fixed unit command writes no JSON report, so
// these counts are read from the hashed log; they are information, the exit code is what is judged.
export function vitestCounts(text) {
  const plain = String(text).replace(/\u001b\[[0-9;]*m/g, '');
  const line = label => plain.match(new RegExp('^[ \\t]*' + label + '[ \\t]+(\\S.*)$', 'm'))?.[1].trim() ?? null;
  const tests = line('Tests'), files = line('Test Files');
  const total = source => source?.match(/\((\d+)\)$/)?.[1] ?? null;
  if (total(tests) === null || total(files) === null) return null;
  const count = word => Number(tests.match(new RegExp('(\\d+) ' + word + '\\b'))?.[1] ?? 0);
  const seconds = line('Duration')?.match(/^([0-9.]+)s\b/)?.[1] ?? null;
  return { passed: count('passed'), failed: count('failed'), skipped: count('skipped'), files: Number(total(files)),
    durationSeconds: seconds === null ? null : Number(seconds) };
}

// The `stats` block of a Playwright JSON report.
export function playwrightCounts(report) {
  const stats = report?.stats, whole = value => Number.isInteger(value) && value >= 0;
  if (!stats || ![stats.expected, stats.unexpected, stats.skipped, stats.flaky].every(whole) || !Number.isFinite(stats.duration))
    return null;
  return { passed: stats.expected, failed: stats.unexpected, skipped: stats.skipped, flaky: stats.flaky, durationMs: stats.duration };
}

// ---- plan 09 qualification record (plan 07-18) ----------------------------------------------------------

// The two required browser assertions and the title of the case each one names in the offline gate.
export const ASSERTION_TITLES = Object.freeze({
  'tests/action-lifecycle.spec.js#throw1ms': 'throw: cancels reload before award with 1ms remaining',
  'tests/animation-regressions.spec.js#repeated-removal-keeper':
    'repeated character removal frees instance GPU allocations and preserves live shared geometry',
});
const PLAN09_GENERATED_BY = GENERATED_BY + ' plan09';
const PAIRED_GATE = 'paired-same-session', FROZEN_GATE = 'frozen-v2';
const CONTRACT_PINS = ['v2Sha256', 'decisionSha256', 'v2ReviewSha256'];
const DENOMINATORS = ['passed', 'failed', 'invalid', 'started'];
const FILE_NAME = /^[A-Za-z0-9._-]+$/;
const inEvidence = name => typeof name === 'string' && name.startsWith(EVIDENCE + '/') && name.endsWith('.json')
  && FILE_NAME.test(name.slice(EVIDENCE.length + 1));
const inPhase = name => typeof name === 'string' && name.startsWith(PHASE + '/') && name.endsWith('.md')
  && FILE_NAME.test(name.slice(PHASE.length + 1));

// One root scalar of the owner decision record, read no more leniently than the predicate reads it: the
// record starts with a closed frontmatter in which every line is a plain `key: value` with a bare value (no
// quote, list, indentation, tab, carriage return or byte order mark), and the key occurs exactly once.
// Anything else reads as absent.
function plainRootScalar(text, key) {
  if (typeof text !== 'string' || !text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 3);
  if (end === -1) return null;
  const lines = text.slice(4, end).split('\n');
  if (!lines.every(line => /^[A-Za-z][A-Za-z0-9_-]*: [A-Za-z0-9][A-Za-z0-9._-]*$/.test(line))) return null;
  const found = lines.filter(line => line.slice(0, line.indexOf(':')).toLowerCase() === key);
  return found.length === 1 ? found[0].slice(found[0].indexOf(': ') + 2) : null;
}

// Every case of a Playwright JSON report with the file it belongs to; suites nest.
function reportCases(report) {
  const cases = [];
  const walk = (suite, file) => {
    if (!suite || typeof suite !== 'object') return;
    const own = typeof suite.file === 'string' ? suite.file : file;
    for (const spec of Array.isArray(suite.specs) ? suite.specs : [])
      cases.push({ file: typeof spec?.file === 'string' ? spec.file : own, spec });
    for (const child of Array.isArray(suite.suites) ? suite.suites : []) walk(child, own);
  };
  for (const suite of Array.isArray(report?.suites) ? report.suites : []) walk(suite, null);
  return cases;
}

// One required assertion, read from the offline gate's own report: the one case with that title in that
// file, run once and passed. Its log and exit code are the offline gate's, whatever the title says.
function assertionOf(id, cases, offlineCheck) {
  const file = id.slice('tests/'.length, id.indexOf('#')), title = ASSERTION_TITLES[id];
  const found = cases.filter(entry => entry.spec?.title === title
    && [file, 'tests/' + file].includes(String(entry.file).replaceAll('\\', '/')));
  const tests = found.length === 1 && Array.isArray(found[0].spec.tests) ? found[0].spec.tests : [];
  const results = tests.flatMap(entry => (Array.isArray(entry?.results) ? entry.results : []));
  const passed = found.length === 1 && found[0].spec.ok === true && tests.length > 0 && tests.every(entry => entry?.status === 'expected'
    && entry.expectedStatus === 'passed' && Array.isArray(entry.results) && entry.results.length === 1 && entry.results[0]?.status === 'passed');
  return { id, title, executed: found.length === 1 && results.some(result => typeof result?.status === 'string' && result.status !== 'skipped'),
    status: found.length === 0 ? 'missing' : found.length > 1 ? 'ambiguous' : passed ? 'pass' : 'fail',
    exitCode: Number.isInteger(offlineCheck?.exitCode) ? offlineCheck.exitCode : null,
    log: typeof offlineCheck?.log === 'string' && offlineCheck.log !== '' ? offlineCheck.log : null,
    logSha256: SHA256.test(offlineCheck?.logSha256 ?? '') ? offlineCheck.logSha256 : null };
}

// Pure. Builds the plan 09 qualification record; `complete` is true only when nothing below refuses.
//
//   identities     the current identity set; a timing result of another source identity is an assertion error
//   timing         the paired timing result (evidence/07-18-timing-result.json)
//   registry       the paired session registry, from which the verdict is recomputed here
//   offlineReport  the Playwright JSON report of the offline gate
//   offlineCheck   the offline check of the stable gate record (exit code, log, log hash)
//   facts          what only the command line can know: `problems` (files that differ from a recorded hash),
//                  `timingResult` (path and hash of the timing result file) and `frozenDecision` (path, hash
//                  and text of the owner decision record, when one exists)
//
// Paired route: the registry verdict is `pass`, the timing result states exactly what the registry gives
// (verdict, the four counts, every qualifying session of every identity, the commit of every registration)
// and the frozen structural checks passed on the recorded candidate. Frozen route: only when the paired
// route does not hold and the owner decision record says `accept-frozen-pass`, decided by the owner, for
// the evaluation k of n that is the recorded candidate, on this very timing result, with the frozen command
// at exit 0 on that candidate. A frozen exit 0 without that record never completes anything, and on the
// paired route it changes nothing. `applicableBudgetPass` is what the frozen command reported for the
// recorded candidate on both routes and is never rewritten.
export function buildPlan09(identities, timing, registry, offlineReport, offlineCheck, facts = {}) {
  assert.ok(identities && typeof identities === 'object' && !Array.isArray(identities), 'Missing identities of the plan09 qualification');
  const identity = identityHash(identities);
  assert.equal(timing?.identitiesSha256, identity, 'Timing result is for another source identity');
  const problems = Array.isArray(facts?.problems) ? facts.problems.map(String) : [];
  const timingResult = facts?.timingResult ?? null, decision = facts?.frozenDecision ?? null;

  // The offline gate and the two titled cases of its report.
  const cases = reportCases(offlineReport);
  const assertions = Object.keys(ASSERTION_TITLES).map(id => assertionOf(id, cases, offlineCheck));
  const offline = [];
  if (!(offlineCheck?.id === 'offline' && offlineCheck.executed === true && offlineCheck.scope === 'full' && offlineCheck.exitCode === 0
    && typeof offlineCheck.log === 'string' && offlineCheck.log !== '' && SHA256.test(offlineCheck.logSha256 ?? '')))
    offline.push('The offline gate is not one full executed run with exit code 0 and a log identity');
  for (const entry of assertions) if (!(entry.executed && entry.status === 'pass'))
    offline.push('A required browser assertion did not pass in the offline gate report: ' + entry.id + ' (' + entry.status + ')');

  // The registry verdict, recomputed. A broken chain or session order, a registry that holds what registration
  // refuses, or a registration whose commit the timing result does not name, gives no verdict.
  const consistency = [], notPassed = [];
  let verdict = null;
  try {
    assert.ok(registry && Array.isArray(registry.events), 'Registry has no event list');
    verdict = registryVerdict(registry, identity, { registrationCommits: timing.registrationCommits ?? null });
  } catch (error) { consistency.push('Registry verdict refused: ' + String(error?.message ?? error).split('\n')[0]); }
  if (timing.timingGate !== PAIRED_GATE) consistency.push('Timing result is not a result of the paired gate');
  for (const name of CONTRACT_PINS)
    if (timing.contract?.[name] !== PAIRED_CONTRACT[name]) consistency.push('Timing result names another contract: ' + name);
  if (!(timing.registry?.path === REGISTRY_PATH && SHA256.test(timing.registry.sha256 ?? '')))
    consistency.push('Timing result names no registry file and hash');
  if (verdict) {
    if (timing.verdict !== verdict.verdict) consistency.push('Timing result verdict differs from the registry');
    for (const name of DENOMINATORS)
      if (timing[name] !== verdict[name]) consistency.push('Timing result denominators differ from the registry: ' + name);
    if (!isDeepStrictEqual(timing.allQualifying, verdict.allQualifying))
      consistency.push('Timing result does not list every qualifying session in the registry');
    if (verdict.verdict !== 'pass') notPassed.push('Paired registry verdict is not pass: ' + verdict.wording);
  }
  if (timing.structuralV2Pass !== true) notPassed.push('Timing result has no structural V2 pass');
  if (timing.pass !== true) notPassed.push('Timing result does not record a pass');

  // The recorded candidate and the list of frozen evaluations, needed on both routes.
  const shared = [];
  const candidate = inEvidence(timing.candidate?.path) && SHA256.test(timing.candidate.sha256 ?? '')
    ? { path: timing.candidate.path, sha256: timing.candidate.sha256 } : null;
  if (!candidate) shared.push('Timing result names no candidate in the evidence directory');
  if (typeof timing.frozenApplicableBudgetPass !== 'boolean')
    shared.push('Timing result does not carry the frozen result as reported for the recorded candidate');
  const list = Array.isArray(timing.frozenEvaluations) ? timing.frozenEvaluations : null;
  const whole = list !== null && list.length > 0 && list.every((entry, index) => entry && typeof entry === 'object'
    && entry.evaluation === index + 1 && entry.of === list.length && SHA256.test(entry.reportSha256 ?? '')
    && Number.isInteger(entry.exitCode) && Number.isInteger(entry.overrunCount))
    && new Set(list.map(entry => entry.reportSha256)).size === list.length;
  const own = whole && candidate ? list.find(entry => entry.reportSha256 === candidate.sha256) ?? null : null;
  if (!whole) shared.push('Frozen evaluation list is missing, or is not numbered 1 to n with an exit code and an overrun count on every entry');
  else if (candidate && !own) shared.push('Frozen evaluation list does not hold the recorded candidate');
  if (whole && list.filter(entry => typeof entry.sameIdentity === 'boolean').length !== 1)
    shared.push('Frozen evaluation list does not say whether the plan 07-13 evaluation was made at this source identity');
  if (verdict && candidate && !verdict.sessions.some(session => session.outcome === 'passed' && session.reportHashes?.candidate === candidate.sha256))
    notPassed.push('The recorded candidate is not the candidate arm of a valid passed session of this source identity');

  // The frozen route is judged only when the owner decision record exists. No tool gives that answer.
  const frozen = [];
  if (decision) {
    const text = typeof decision.text === 'string' ? decision.text : '';
    if (!(inPhase(decision.path) && SHA256.test(decision.sha256 ?? ''))) frozen.push('Owner decision record is not named with its path and hash');
    if (plainRootScalar(text, 'decision') !== 'accept-frozen-pass') frozen.push('Owner decision is not accept-frozen-pass');
    if (plainRootScalar(text, 'decided_by') !== 'owner') frozen.push('Decision record is not decided by the owner');
    if (!(timing.frozenApplicableBudgetPass === true && timing.frozenExitZeroObserved === true && own && own.exitCode === 0 && own.overrunCount === 0))
      frozen.push('The frozen command did not exit 0 on the recorded candidate');
    else if (own.scanned !== true) frozen.push('A frozen exit 0 on a report the scan does not find cannot be put forward');
    if (own) {
      if (plainRootScalar(text, 'evaluation') !== String(own.evaluation)) frozen.push('Owner decision is for another evaluation');
      if (plainRootScalar(text, 'evaluations') !== String(own.of)) frozen.push('Owner decision was made on another count of evaluations');
    }
    if (!SHA256.test(timingResult?.sha256 ?? '') || plainRootScalar(text, 'timing_result_sha256') !== timingResult.sha256)
      frozen.push('Owner decision was made on another timing result');
  }

  const pairedHolds = consistency.length === 0 && notPassed.length === 0;
  const frozenHolds = !pairedHolds && consistency.length === 0 && decision !== null && frozen.length === 0;
  const reasons = [...problems, ...offline, ...shared, ...(pairedHolds || frozenHolds ? [] : [...consistency, ...notPassed, ...frozen])];
  const complete = reasons.length === 0;
  const reported = { verdict: verdict?.verdict ?? null, passed: verdict?.passed ?? null, failed: verdict?.failed ?? null,
    invalid: verdict?.invalid ?? null, started: verdict?.started ?? null, wording: verdict?.wording ?? null,
    registry: { path: REGISTRY_PATH, sha256: SHA256.test(timing.registry?.sha256 ?? '') ? timing.registry.sha256 : null },
    allQualifying: verdict ? structuredClone(verdict.allQualifying) : null };
  const route = frozenHolds
    ? { timingGate: FROZEN_GATE, frozenDecision: { path: decision.path, sha256: decision.sha256 }, pairedReported: reported }
    : { timingGate: PAIRED_GATE, paired: { ...Object.fromEntries(CONTRACT_PINS.map(name => [name, PAIRED_CONTRACT[name]])),
      registry: reported.registry, identity, verdict: reported.verdict, passed: reported.passed, failed: reported.failed,
      invalid: reported.invalid, started: reported.started, wording: reported.wording, allQualifying: reported.allQualifying,
      registrationCommits: Array.isArray(timing.registrationCommits) ? structuredClone(timing.registrationCommits) : null,
      structuralV2Pass: timing.structuralV2Pass === true } };
  const meaning = !complete ? 'Plan 09 is not qualified by this record; see reasons. Nothing here is a pass.'
    : frozenHolds ? 'Plan 09 is qualified on the frozen route only through the owner decision record named here: the unchanged frozen command '
      + 'exited 0 on evaluation ' + own.evaluation + ' of ' + own.of + ', on a prepared host, against a contract that allowed one evaluation. '
      + 'The paired sessions are listed as they ended. No frame rate, device or human acceptance follows.'
      : 'Plan 09 is qualified by the paired same-session gate under 07-09-PAIRED-AMENDMENT-V2.md: ' + reported.wording + '. It covers what '
      + 'section 10 of that contract states and nothing wider: edits to the five owner files after c973458 added no cost within the approved '
      + 'tolerances, in the offline Training Range capture, under software rendering, on this host. applicableBudgetPass is the result of the '
      + 'unchanged frozen command for the recorded candidate, as reported; a paired pass never means the original absolute limits were met, '
      + 'a frame rate, a device or a human acceptance.';
  return { complete, generatedBy: PLAN09_GENERATED_BY, identities, ...route,
    applicableBudgetPass: typeof timing.frozenApplicableBudgetPass === 'boolean' ? timing.frozenApplicableBudgetPass : null,
    candidate: candidate?.path ?? null, candidateSha256: candidate?.sha256 ?? null,
    frozenEvaluations: list === null ? null : list.map(entry => (frozenHolds && entry === own ? { ...structuredClone(entry), putForward: true }
      : structuredClone(entry))),
    frozenExitZeroObserved: timing.frozenExitZeroObserved === true, timingResult, assertions, reasons, certification: false, meaning };
}

const USAGE = 'Usage: node tools/art/stable-gates.mjs run --gates <comma-separated ids | all> | check [--only stable]'
  + ' | plan09 --timing <timing result> --registry <registry> --offline-report <Playwright JSON report>';
export function parseArguments(args) {
  if (Array.isArray(args) && args[0] === 'run' && args.length === 3 && args[1] === '--gates' && typeof args[2] === 'string') {
    const named = args[2] === 'all' ? GATE_IDS : args[2].split(',');
    if (new Set(named).size === named.length && named.every(id => GATE_IDS.includes(id)))
      return { command: 'run', gates: GATE_IDS.filter(id => named.includes(id)) };
  }
  if (Array.isArray(args) && args[0] === 'plan09' && args.length === 7 && args[1] === '--timing' && args[3] === '--registry'
    && args[5] === '--offline-report' && [args[2], args[4], args[6]].every(name => typeof name === 'string' && name !== ''))
    return { command: 'plan09', timing: args[2], registry: args[4], offlineReport: args[6] };
  if (Array.isArray(args) && args[0] === 'check') {
    if (args.length === 1) return { command: 'check', onlyStable: false };
    if (args.length === 3 && args[1] === '--only' && args[2] === 'stable') return { command: 'check', onlyStable: true };
  }
  throw Error(USAGE);
}

// Byte-for-byte copy with exclusive create: an existing archive is never overwritten.
export async function archiveOnce(source, target) {
  try { await fs.copyFile(source, target, constants.COPYFILE_EXCL); return 'created'; }
  catch (error) { if (error.code === 'EEXIST') return 'kept'; throw error; }
}

const absolute = name => path.join(ROOT, name);
async function readJson(name) {
  try { return JSON.parse(await fs.readFile(absolute(name), 'utf8')); }
  catch { return null; }
}
// A recorded log must be below the gitignored cache, reached through no link, and have its recorded hash.
async function assertLog(entry, message) {
  const filename = await iterationPath([absolute(CACHE_ROOT)], path.resolve(ROOT, String(entry.log)));
  let bytes;
  try { bytes = await fs.readFile(filename); } catch { assert.fail(message); }
  assert.equal(hash(bytes), entry.logSha256, message);
}

// The record on disk with every executed check whose log is gone or changed removed, so that such a
// result is never carried into a new record.
async function previousRecord() {
  const previous = await readJson(RECORD);
  if (!Array.isArray(previous?.checks)) return null;
  const checks = [];
  for (const entry of previous.checks) {
    try { if (entry?.executed === true) await assertLog(entry, 'changed'); checks.push(entry); }
    catch { /* dropped: buildRecord then records the gate as unrun */ }
  }
  return { ...previous, checks };
}

// Before the first record of this tool replaces the superseded one, keep that one byte for byte.
async function archiveSuperseded() {
  try { await fs.access(absolute(ARCHIVE)); return 'kept'; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let bytes;
  try { bytes = await fs.readFile(absolute(RECORD)); }
  catch (error) { if (error.code === 'ENOENT') return 'absent'; throw error; }
  let superseded = null;
  try { superseded = JSON.parse(bytes.toString('utf8')); } catch { /* archived as it is */ }
  assert.notEqual(superseded?.generatedBy, GENERATED_BY, 'Missing archive of the superseded stable gate record');
  const outcome = await archiveOnce(absolute(RECORD), absolute(ARCHIVE));
  assert.equal(hash(await fs.readFile(absolute(ARCHIVE))), hash(bytes), 'Archive differs from the superseded stable gate record');
  return outcome;
}

async function writeAtomic(name, text) {
  const target = absolute(name), temporary = target + '.' + process.pid + '.tmp';
  try {
    await fs.writeFile(temporary, text, { flag: 'wx' });
    await fs.rename(temporary, target);
  } catch (error) { await fs.rm(temporary, { force: true }); throw error; }
}

// One gate: the command as written, through the platform shell, with stdout and stderr in one log file.
function runCommand(command, logFile) {
  return new Promise((resolve, reject) => {
    const out = openSync(logFile, 'w');
    const child = spawn(command, { cwd: ROOT, shell: true, stdio: ['ignore', out, out], windowsHide: true });
    child.once('error', error => { closeSync(out); reject(error); });
    child.once('close', (exitCode, signal) => { closeSync(out); resolve({ exitCode, signal }); });
  });
}

async function gateCounts(id, logBytes, startedMs) {
  if (id === 'unit') return vitestCounts(logBytes.toString('utf8'));
  if (!BROWSER_REPORTS[id]) return null;
  // Only a report this run wrote: one left by an earlier run is older than the start of this gate.
  let bytes;
  try {
    if ((await fs.stat(absolute(BROWSER_REPORTS[id]))).mtimeMs < startedMs) return null;
    bytes = await fs.readFile(absolute(BROWSER_REPORTS[id]));
  } catch { return null; }
  let counts = null;
  try { counts = playwrightCounts(JSON.parse(bytes.toString('utf8'))); } catch { /* no counts */ }
  if (!counts) return null;
  // The qualified configurations overwrite their report on the next run; keep this run's copy.
  const report = GATE_CACHE + '/' + id + '-report.json';
  await fs.writeFile(absolute(report), bytes);
  return { ...counts, report, reportSha256: hash(bytes) };
}

async function run(gates) {
  const identities = await animationIdentities();
  await fs.mkdir(absolute(GATE_CACHE), { recursive: true });
  const results = {};
  let stopped = null;
  for (const gate of GATES.filter(entry => gates.includes(entry.id))) {
    if (gate.id === 'offline') {
      // The offline configuration reads its owned listener port from this file and refuses 5173.
      await fs.mkdir(absolute(QUALIFIED), { recursive: true });
      await fs.writeFile(absolute(LISTENER_PORT), JSON.stringify({ port: await ownedReviewPort() }) + '\n');
    }
    const log = GATE_CACHE + '/' + logName(gate.id), startedMs = Date.now();
    const { exitCode, signal } = await runCommand(gate.command, absolute(log));
    const durationMs = Date.now() - startedMs;
    if (!Number.isInteger(exitCode)) { stopped = 'Stable gate ended without an exit code: ' + gate.id + ' (' + signal + ')'; break; }
    const bytes = await fs.readFile(absolute(log)), counts = await gateCounts(gate.id, bytes, startedMs);
    results[gate.id] = { exitCode, log, logSha256: hash(bytes), startedAt: new Date(startedMs).toISOString(), durationMs,
      environment: { CI: process.env.CI ?? null, node: process.version, platform: process.platform }, ...(counts ? { counts } : {}) };
    console.log(JSON.stringify({ gate: gate.id, exitCode, durationMs, counts }));
  }
  assert.ok(isDeepStrictEqual(await animationIdentities(), identities), 'Source changed during gates');
  const record = buildRecord(identities, results, await previousRecord());
  const archive = await archiveSuperseded();
  await writeAtomic(RECORD, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ record: RECORD, archive, complete: record.complete,
    executed: record.checks.filter(entry => entry.executed).map(entry => entry.id),
    nonZero: record.checks.filter(entry => entry.executed && entry.exitCode !== 0).map(entry => entry.id) }));
  if (stopped) throw Error(stopped);
  return gates.every(id => results[id]?.exitCode === 0);
}

// The predicate's own message: Node appends the compared values after a blank line, which for an
// identity set is hundreds of lines.
const firstLine = error => String(error?.message ?? error).split('\n')[0];

async function check(onlyStable) {
  const output = { stableGatesPass: false, stableGateBlocker: null, plan09Qualified: null, plan09Blocker: null,
    identitySha256: null, recordIdentitiesCurrent: null };
  try {
    const current = await animationIdentities(), record = await readJson(RECORD);
    output.identitySha256 = identityHash(current);
    output.recordIdentitiesCurrent = isDeepStrictEqual(record?.identities, current);
    requireStableGates(current, record);
    for (const entry of record.checks) await assertLog(entry, 'Changed or missing stable gate log: ' + entry.id);
    output.stableGatesPass = true;
  } catch (error) { output.stableGateBlocker = firstLine(error); }
  if (!onlyStable) {
    // Three arguments, always: the predicate then reads plan 09 through its own default readers, from
    // the files on disk and nowhere else. Once a paired record exists this re-verifies every session
    // through a verify subprocess and takes minutes.
    try {
      const summary = await fs.readFile(absolute(PHASE + '/07-09-SUMMARY.md'), 'utf8');
      const qualification = JSON.parse(await fs.readFile(absolute(EVIDENCE + '/07-09-qualification.json'), 'utf8'));
      requirePlan09(await animationIdentities(), summary, qualification);
      for (const entry of qualification.assertions) await assertLog(entry, 'Changed or missing assertion log: ' + entry.id);
      output.plan09Qualified = true;
    } catch (error) { output.plan09Qualified = false; output.plan09Blocker = firstLine(error); }
  }
  console.log(JSON.stringify(output));
  return output.stableGatesPass && (onlyStable || output.plan09Qualified === true);
}

// Before the first record of the plan09 command replaces the halted one, keep that one byte for byte.
async function archiveHaltedQualification() {
  try { await fs.access(absolute(QUALIFICATION_ARCHIVE)); return 'kept'; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const bytes = await fs.readFile(absolute(QUALIFICATION));
  let halted = null;
  try { halted = JSON.parse(bytes.toString('utf8')); } catch { /* archived as it is */ }
  assert.notEqual(halted?.generatedBy, PLAN09_GENERATED_BY, 'Missing archive of the halted plan09 qualification');
  const outcome = await archiveOnce(absolute(QUALIFICATION), absolute(QUALIFICATION_ARCHIVE));
  assert.equal(hash(await fs.readFile(absolute(QUALIFICATION_ARCHIVE))), hash(bytes), 'Archive differs from the halted plan09 qualification');
  return outcome;
}

// Builds and writes the plan 09 qualification record. What the pure builder cannot see is checked here and
// handed to it as `problems`: the stable gates of the current source, the offline gate's log and report, the
// registry against git and against the hash in the timing result, and the recorded candidate's bytes. Exit
// code 0 only for a complete record; an input that does not qualify gives `complete: false` and exit code 1.
async function plan09({ timing: timingName, registry: registryName, offlineReport: reportName }) {
  const current = await animationIdentities(), stable = await readJson(RECORD), problems = [];
  try { requireStableGates(current, stable); }
  catch (error) { problems.push('Stable gates are not qualified for the current source: ' + firstLine(error)); }
  const offlineCheck = Array.isArray(stable?.checks) ? stable.checks.find(entry => entry?.id === 'offline') ?? null : null;
  try { await assertLog(offlineCheck ?? {}, 'Changed or missing offline gate log'); }
  catch (error) { problems.push(firstLine(error)); }

  const timingFile = await iterationPath([absolute(EVIDENCE)], path.resolve(ROOT, timingName));
  const timingBytes = await fs.readFile(timingFile), timing = JSON.parse(timingBytes.toString('utf8'));
  const reportFile = await iterationPath([absolute(CACHE_ROOT)], path.resolve(ROOT, reportName));
  const reportBytes = await fs.readFile(reportFile), offlineReport = JSON.parse(reportBytes.toString('utf8'));
  if (hash(reportBytes) !== stable?.offline?.reportSha256) problems.push('The offline report is not the report of the recorded offline gate run');

  // The tracked registry, whole: chain, session order, every event committed, every committed version a prefix.
  let registry = null;
  try {
    const checked = checkedRegistry(path.resolve(ROOT, registryName));
    registry = checked.registry;
    if (!isDeepStrictEqual(checked.registrationCommits, timing?.registrationCommits))
      problems.push('Timing result does not name the commit of every registration as the history of the registry shows them');
    if (hash(await fs.readFile(absolute(REGISTRY_PATH))) !== timing?.registry?.sha256)
      problems.push('The registry file differs from the hash in the timing result');
  } catch (error) { problems.push('The paired session registry is not whole: ' + firstLine(error)); }

  if (typeof timing?.candidate?.path === 'string') {
    try {
      const file = await iterationPath([absolute(EVIDENCE)], path.resolve(ROOT, timing.candidate.path));
      if (hash(await fs.readFile(file)) !== timing.candidate.sha256) problems.push('The recorded candidate differs from the hash in the timing result');
    } catch (error) { problems.push('The recorded candidate cannot be read from the evidence directory: ' + firstLine(error)); }
  }
  // Only the owner writes this record, after a blocking checkpoint; it is read here when it exists.
  let frozenDecision = null;
  try {
    const bytes = await fs.readFile(absolute(FROZEN_DECISION));
    frozenDecision = { path: FROZEN_DECISION, sha256: hash(bytes), text: bytes.toString('utf8') };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  const record = buildPlan09(current, timing, registry, offlineReport, offlineCheck, { problems, frozenDecision,
    timingResult: { path: path.relative(ROOT, timingFile).replaceAll('\\', '/'), sha256: hash(timingBytes) } });
  assert.ok(isDeepStrictEqual(await animationIdentities(), current), 'Source changed while the plan09 record was built');
  const archive = await archiveHaltedQualification();
  await writeAtomic(QUALIFICATION, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ record: QUALIFICATION, archive, complete: record.complete, timingGate: record.timingGate,
    applicableBudgetPass: record.applicableBudgetPass, assertions: record.assertions.map(entry => entry.id + ' ' + entry.status),
    reasons: record.reasons }));
  return record.complete;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let request;
  try { request = parseArguments(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exit(2); }
  const commands = { run: () => run(request.gates), check: () => check(request.onlyStable), plan09: () => plan09(request) };
  try { process.exit(await commands[request.command]() ? 0 : 1); }
  catch (error) { console.error(error.message); process.exit(1); }
}

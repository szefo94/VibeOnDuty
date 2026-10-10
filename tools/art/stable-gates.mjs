// Plan 07-17: the stable-gate record is written by this tool from real exit codes and hashed logs, and
// judged by the predicates of the capture tool. Nothing here decides that a gate passed.
//
//   node tools/art/stable-gates.mjs run --gates <comma-separated ids | all>
//   node tools/art/stable-gates.mjs check [--only stable]
//
// `run` executes the named gates one after another, never in parallel, each with its complete output in
// a log below the gitignored cache, and rewrites the record. A gate that was not run in this invocation
// keeps its earlier result only while the source identity is unchanged and its log still has the
// recorded hash. `check` is read-only.
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
import { identityHash } from './animation-budget-paired.mjs';

const PHASE = '.planning/phases/07-movement-matched-and-action-safe-animation';
const EVIDENCE = PHASE + '/evidence';
const RECORD = EVIDENCE + '/07-10-stable-gates.json';
const ARCHIVE = EVIDENCE + '/07-10-stable-gates-halted-2026-10-07.json';
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

const USAGE = 'Usage: node tools/art/stable-gates.mjs run --gates <comma-separated ids | all> | check [--only stable]';
export function parseArguments(args) {
  if (Array.isArray(args) && args[0] === 'run' && args.length === 3 && args[1] === '--gates' && typeof args[2] === 'string') {
    const named = args[2] === 'all' ? GATE_IDS : args[2].split(',');
    if (new Set(named).size === named.length && named.every(id => GATE_IDS.includes(id)))
      return { command: 'run', gates: GATE_IDS.filter(id => named.includes(id)) };
  }
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let request;
  try { request = parseArguments(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exit(2); }
  try { process.exit(await (request.command === 'run' ? run(request.gates) : check(request.onlyStable)) ? 0 : 1); }
  catch (error) { console.error(error.message); process.exit(1); }
}

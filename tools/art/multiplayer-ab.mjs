// Plan 07-14: same-session, interleaved two-arm runner for the production multiplayer
// cases. Arm `candidate` is this working tree; arm `reference` is a scratch copy of an
// earlier commit extracted with `git archive` into an owned cache directory. Nothing in
// this working tree is checked out, restored, stashed or reset; nothing is installed.
//
//   node tools/art/multiplayer-ab.mjs control --reference <commit>
//   node tools/art/multiplayer-ab.mjs run --reference <commit> --grep <title> --repeats <n>
//
// The exit code is 0 whenever every run completed and a verdict was computed.
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedPath } from './motion-acceptance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE_REL = '.planning/research/.cache/07-14-mp-ab';
export const EVIDENCE_REL =
  '.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-14-mp-ab.json';
export const CONTROL_TITLE = 'teams: solo start and smaller-team assignments are visible in both browsers';
export const VERDICTS = Object.freeze(['source', 'host', 'not-reproduced', 'inconclusive', 'no-reference', 'harness-invalid']);
const RUN_TIMEOUT_MS = 25 * 60 * 1000;

// ---------------------------------------------------------------- pure rule ----

/** Normalise one first-error line so two arms can be compared. Removes ANSI codes,
 *  session and room ids, tick counters, numbers and any trailing JSON state dump. */
export function normaliseError(line) {
  let s = String(line ?? '');
  s = s.replace(/\u001b\[[0-9;]*m/g, '');
  s = s.replace(/(session|room)(Id)?["']?\s*[:=]\s*["']?[\w-]+["']?/gi, '$1Id=#');
  s = s.replace(/\b(tick|currentTick|inputSeq)["']?\s*[:=]\s*\d+/gi, '$1=#');
  s = s.replace(/\{.*$/, '{…}');
  s = s.replace(/\d+(\.\d+)?/g, '#');
  return s.replace(/\s+/g, ' ').trim();
}

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

/** Pure verdict rule. `runs`: [{ arm, passed, firstError }]; `control`: { passed } | null. */
export function classify(runs, control) {
  assert.ok(Array.isArray(runs), 'runs must be an array');
  for (const r of runs) assert.ok(r.arm === 'candidate' || r.arm === 'reference', `unknown arm: ${r.arm}`);
  const cand = runs.filter((r) => r.arm === 'candidate');
  const ref = runs.filter((r) => r.arm === 'reference');
  if (ref.length === 0) return 'no-reference';
  assert.equal(cand.length, ref.length, 'arms must hold the same number of runs');
  const n = ref.length;
  assert.ok(n >= 3, 'at least 3 runs per arm are required');
  if (!control || control.passed !== true) return 'harness-invalid';
  const passes = (arr) => arr.filter((r) => r.passed === true).length;
  const cp = passes(cand);
  const rp = passes(ref);
  const hi = Math.ceil((2 * n) / 3);
  const lo = Math.floor(n / 3);
  if (cp >= hi) return 'not-reproduced';
  if (rp >= hi && cp <= lo) return 'source';
  if (rp <= lo && cp <= lo) {
    const first = (arr) => mostCommon(arr.filter((r) => r.passed !== true).map((r) => normaliseError(r.firstError)));
    if (first(ref) === first(cand)) return 'host';
  }
  return 'inconclusive';
}

// -------------------------------------------------------------- scratch tree ----

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, ...opts }).trim();
}

/** Extract `reference` (an ancestor of HEAD) with git archive into the owned cache.
 *  Returns { dir, commit, nodeModules }. Creates no branch, worktree or checkout. */
export function materialize(reference) {
  const commit = git(['rev-parse', '--verify', `${reference}^{commit}`]);
  const anc = spawnSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { cwd: ROOT });
  assert.equal(anc.status, 0, `${commit} is not an ancestor of HEAD`);
  const cacheRoot = path.join(ROOT, CACHE_REL);
  mkdirSync(cacheRoot, { recursive: true });
  const rel = `reference-${commit.slice(0, 12)}`;
  const dir = boundedPath(cacheRoot, rel);
  const marker = path.join(dir, '.vod-reference-commit');
  if (existsSync(dir)) {
    assert.ok(existsSync(marker) && readFileSync(marker, 'utf8').trim() === commit, 'Existing scratch directory lacks a matching commit marker');
  } else {
    mkdirSync(dir);
    const tar = path.join(cacheRoot, `${rel}.tar`);
    execFileSync('git', ['archive', '--format=tar', '-o', tar, commit], { cwd: ROOT });
    const x = spawnSync('tar', ['-xf', path.join('..', path.basename(tar))], { cwd: dir });
    rmSync(tar, { force: true });
    if (x.status !== 0) { rmSync(dir, { recursive: true, force: true }); assert.fail(`tar extraction failed: ${x.stderr}`); }
    writeFileSync(marker, commit + '\n');
  }
  // The fixture resolves its build tool through a fixed path under its own root, so a
  // parent-directory lookup is not enough; give the scratch copy an owned junction.
  const vite = path.join(dir, 'node_modules/vite/bin/vite.js');
  let nodeModules = 'parent-lookup';
  if (!existsSync(vite)) {
    const link = path.join(dir, 'node_modules');
    if (!existsSync(link)) symlinkSync(path.join(ROOT, 'node_modules'), link, 'junction');
    assert.ok(existsSync(vite), 'junction did not provide the build tool');
    nodeModules = 'junction';
  }
  return { dir, commit, nodeModules };
}

/** Remove the owned junction (the link only, never its target). */
export function dropJunction(dir) {
  const link = path.join(dir, 'node_modules');
  try { unlinkSync(link); } catch { try { rmSync(link, { force: true }); } catch { /* keep */ } }
}

// -------------------------------------------------------------------- runs ----

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const stripAnsi = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

function walkSpecs(report) {
  const out = [];
  (function visit(suite) {
    for (const s of suite.suites ?? []) visit(s);
    for (const sp of suite.specs ?? []) out.push(sp);
  })({ suites: report.suites ?? [] });
  return out;
}

function summariseReport(reportPath) {
  const buf = readFileSync(reportPath);
  const report = JSON.parse(buf.toString('utf8'));
  const specs = walkSpecs(report);
  let firstError = null;
  for (const sp of specs) for (const t of sp.tests) for (const r of t.results) {
    const msg = r.error?.message ?? r.errors?.[0]?.message;
    if (!firstError && msg) firstError = stripAnsi(msg).split('\n').find((l) => l.trim()) ?? null;
  }
  if (!firstError && report.errors?.length) firstError = stripAnsi(report.errors[0].message).split('\n').find((l) => l.trim()) ?? null;
  return {
    sha256: sha256(buf), specCount: specs.length, stats: report.stats,
    file: specs[0]?.file ?? null, line: specs[0]?.line ?? null,
    firstError: firstError ? firstError.slice(0, 300) : null,
  };
}

function killTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
  else try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ }
}

function runArm({ armRoot, arm, grep, tag }) {
  const runDir = path.join(ROOT, CACHE_REL, 'runs', tag);
  mkdirSync(runDir, { recursive: true });
  const reportPath = path.join(runDir, 'report.json');
  rmSync(reportPath, { force: true });
  const logPath = path.join(runDir, 'output.log');
  const escaped = grep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const args = [
    path.join('node_modules', '@playwright', 'test', 'cli.js'), 'test',
    '--config', path.join(armRoot, 'playwright.multiplayer.config.js'),
    '--workers=1', '--reporter=json', '--output', path.join(runDir, 'artifacts'), '--grep', escaped,
  ];
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: armRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath, FORCE_COLOR: '0' },
    });
    let log = '';
    const take = (c) => { log = (log + c.toString()).slice(-200000); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, RUN_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      writeFileSync(logPath, log);
      resolve({ arm, exitCode: timedOut ? null : code, timedOut, durationMs: Date.now() - started, reportPath, logPath, log, arm_root: armRoot });
    });
    child.on('error', (e) => { clearTimeout(timer); resolve({ arm, exitCode: null, timedOut: false, durationMs: Date.now() - started, reportPath, logPath, log: String(e), runError: String(e) }); });
  });
}

function hostFacts() {
  const cpus = os.cpus();
  const t0 = cpus.map((c) => ({ ...c.times }));
  const until = Date.now() + 1000;
  while (Date.now() < until) { /* 1 s sample window */ }
  const t1 = os.cpus();
  let busy = 0; let total = 0;
  t1.forEach((c, i) => {
    const d = (k) => c.times[k] - t0[i][k];
    const idle = d('idle'); const sum = d('user') + d('nice') + d('sys') + d('irq') + idle;
    busy += sum - idle; total += sum;
  });
  let power = null;
  if (process.platform === 'win32') {
    const r = spawnSync('powercfg', ['/getactivescheme'], { encoding: 'utf8' });
    power = (r.stdout || '').trim() || null;
  }
  return { cpuModel: cpus[0]?.model ?? null, logicalCpus: cpus.length, powerPlan: power,
    sampledBusyFraction: total ? Number((busy / total).toFixed(3)) : null,
    freeMemMiB: Math.round(os.freemem() / 1048576), at: new Date().toISOString() };
}

function caseSegment(file, line) {
  if (!file || !line || !existsSync(file)) return null;
  const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  let end = lines.length;
  for (let i = line; i < lines.length; i++) if (/^(test|for \(|test\.|\/\/ )/.test(lines[i]) && i > line) { end = i; break; }
  return sha256(lines.slice(line - 1, end).join('\n'));
}

// ------------------------------------------------------------------ evidence ----

function loadEvidence() {
  const p = path.join(ROOT, EVIDENCE_REL);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  return { schemaVersion: 1, plan: '07-14', controls: [], cases: [], superseded: [] };
}
function saveEvidence(ev) {
  const p = path.join(ROOT, EVIDENCE_REL);
  mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(ev, null, 2) + '\n');
  renameSync(tmp, p);
}

function assertCleanTree() {
  const dirty = git(['status', '--short', '--', 'src', 'server', 'tests']);
  assert.equal(dirty, '', `Refusing to start: src/server/tests are not clean:\n${dirty}`);
}

function runRecord(res, arm, repeat, order) {
  const base = { arm, repeat, order, exitCode: res.exitCode, timedOut: res.timedOut, durationMs: res.durationMs };
  if (!existsSync(res.reportPath)) {
    return { ...base, passed: false, passedCount: 0, failedCount: 0, specCount: 0, firstError: stripAnsi(res.log).split('\n').find((l) => l.trim()) ?? 'no report written', reportPath: null, reportSha256: null };
  }
  const s = summariseReport(res.reportPath);
  const st = s.stats ?? {};
  return { ...base, passed: res.exitCode === 0 && st.expected === 1 && !st.unexpected && !st.flaky && s.specCount === 1,
    passedCount: st.expected ?? 0, failedCount: (st.unexpected ?? 0) + (st.flaky ?? 0), specCount: s.specCount,
    firstError: s.firstError, reportPath: path.relative(ROOT, res.reportPath).replace(/\\/g, '/'), reportSha256: s.sha256,
    specFile: s.file, specLine: s.line };
}

// ------------------------------------------------------------------ commands ----

async function cmdControl(reference) {
  assertCleanTree();
  const m = materialize(reference);
  const tag = `control-${m.commit.slice(0, 12)}-${Date.now()}`;
  const res = await runArm({ armRoot: m.dir, arm: 'reference', grep: CONTROL_TITLE, tag });
  const rec = runRecord(res, 'reference', 1, 1);
  const ev = loadEvidence();
  ev.controls = (ev.controls ?? []).filter((c) => c.referenceFull !== m.commit);
  ev.controls.push({ reference, referenceFull: m.commit, title: CONTROL_TITLE, passed: rec.passed, exitCode: rec.exitCode,
    firstError: rec.firstError, reportPath: rec.reportPath, reportSha256: rec.reportSha256, durationMs: rec.durationMs,
    nodeModules: m.nodeModules, recordedAt: new Date().toISOString() });
  saveEvidence(ev);
  console.log(`control ${reference}: passed=${rec.passed} exit=${rec.exitCode}`);
  return 0;
}

async function cmdRun(reference, grep, repeats) {
  assert.ok(Number.isInteger(repeats) && repeats >= 3, '--repeats must be an integer of at least 3');
  assertCleanTree();
  const m = materialize(reference);
  const ev = loadEvidence();
  const control = (ev.controls ?? []).find((c) => c.referenceFull === m.commit) ?? null;
  const facts = hostFacts();
  const runs = [];
  const started = Date.now();
  for (let i = 1; i <= repeats; i++) {
    const order = i % 2 === 1 ? ['reference', 'candidate'] : ['candidate', 'reference'];
    for (let k = 0; k < order.length; k++) {
      const arm = order[k];
      const tag = `${m.commit.slice(0, 12)}-${Date.now()}-${arm}-${i}`;
      const res = await runArm({ armRoot: arm === 'reference' ? m.dir : ROOT, arm, grep, tag });
      const rec = runRecord(res, arm, i, k + 1);
      runs.push(rec);
      console.log(`repeat ${i} ${arm}(${k + 1}): exit=${rec.exitCode} passed=${rec.passed} specs=${rec.specCount} ${rec.durationMs}ms ${rec.firstError ?? ''}`);
    }
  }
  const refRuns = runs.filter((r) => r.arm === 'reference');
  const candRuns = runs.filter((r) => r.arm === 'candidate');
  const noMatch = refRuns.every((r) => r.specCount !== 1);
  const ambiguous = runs.some((r) => r.specCount > 1);
  let verdict; let note = null;
  if (noMatch || ambiguous) {
    verdict = 'no-reference';
    note = ambiguous ? 'grep selected more than one case in an arm' : 'grep selected no case in the reference arm';
  } else {
    verdict = classify(runs.map((r) => ({ arm: r.arm, passed: r.passed, firstError: r.firstError })), control);
  }
  const ref = refRuns[0], cand = candRuns[0];
  const entry = {
    title: grep, reference, referenceFull: m.commit, n: repeats, verdict, note, control: control ? { passed: control.passed, referenceFull: control.referenceFull } : null,
    sameCaseSource: {
      candidate: caseSegment(path.join(ROOT, 'tests', path.basename(cand?.specFile ?? '')), cand?.specLine),
      reference: caseSegment(path.join(m.dir, 'tests', path.basename(ref?.specFile ?? '')), ref?.specLine),
    },
    helperSource: {
      candidate: sha256(readFileSync(path.join(ROOT, 'tests/helpers/mpServer.js'))),
      reference: sha256(readFileSync(path.join(m.dir, 'tests/helpers/mpServer.js'))),
    },
    nodeModules: m.nodeModules, host: facts, wallMs: Date.now() - started, runs, recordedAt: new Date().toISOString(),
  };
  entry.sameCaseSource.identical = entry.sameCaseSource.candidate !== null && entry.sameCaseSource.candidate === entry.sameCaseSource.reference;
  const latest = loadEvidence();
  const old = latest.cases.filter((c) => c.title === grep && c.referenceFull === m.commit);
  latest.superseded = [...(latest.superseded ?? []), ...old];
  latest.cases = latest.cases.filter((c) => !(c.title === grep && c.referenceFull === m.commit));
  latest.cases.push(entry);
  saveEvidence(latest);
  console.log(`VERDICT ${verdict} for "${grep}" vs ${reference}`);
  return 0;
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
  return o;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const o = parseArgs(rest);
  try {
    assert.ok(o.reference, '--reference is required');
    if (cmd === 'control') process.exitCode = await cmdControl(o.reference);
    else if (cmd === 'run') {
      assert.ok(o.grep, '--grep is required');
      process.exitCode = await cmdRun(o.reference, o.grep, Number(o.repeats));
    } else throw new Error('Use: control --reference <commit> | run --reference <commit> --grep <title> --repeats <n>');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

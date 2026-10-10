import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeDependencyIdentities } from './runtime-dependencies.mjs';
import { REQUIRED_ASSERTIONS, REQUIRED_STABLE_GATES, requirePlan09, requireStableGates } from './animation-capture.mjs';
import { GATES, RECORD_RULE, archiveOnce, buildRecord, logName, parseArguments, playwrightCounts,
  vitestCounts } from './stable-gates.mjs';
// The plan 09 builder is reached through the namespace, so that a control fails on its own assertion.
import * as gates from './stable-gates.mjs';
import * as paired from './animation-budget-paired.mjs';

// Synthetic inputs only: nothing here reads the gitignored cache. The identities are the registered
// motion tuple, provenance and acceptance registry of the checkout (tracked files), which the real
// predicate re-reads, plus one made-up source hash.
const identities = { 'src/main.js': 'a'.repeat(64), ...runtimeDependencyIdentities() };
const otherIdentities = { ...identities, 'src/main.js': 'b'.repeat(64) };
const sha = text => createHash('sha256').update(text).digest('hex');
const result = (id, exitCode = 0) => ({ exitCode, log: `.planning/research/.cache/07-17-gates/${logName(id)}`,
  logSha256: sha(id + ':' + exitCode), durationMs: 1000 });
const resultsFor = (ids, exitCodes = {}) => Object.fromEntries(ids.map(id => [id, result(id, exitCodes[id] ?? 0)]));
const ALL = GATES.map(gate => gate.id);
const FAST = ['lint', 'typecheck', 'typecheck:mp', 'build', 'unit'];
const check = (record, id) => record.checks.find(entry => entry.id === id);
// The predicate's own message, whole: Node appends the compared values after a blank line.
const rejectedWith = text => error => error.message === text || error.message.startsWith(text + '\n');

test('the gate list is the seven required gates, in order, with the commands that were actually run', () => {
  assert.deepEqual(ALL, REQUIRED_STABLE_GATES);
  assert.deepEqual(GATES.map(gate => gate.command), [
    'npm run lint',
    'npm run typecheck',
    'npm run typecheck:mp',
    'npm run build -- --outDir .planning/research/.cache/07-17-gates/build',
    'node node_modules/vitest/vitest.mjs run --maxWorkers=1',
    'node node_modules/@playwright/test/cli.js test --config tools/art/offline-qualified.config.mjs',
    'node node_modules/@playwright/test/cli.js test --config tools/art/multiplayer-qualified.config.mjs --workers=1',
  ]);
  assert.ok(Object.isFrozen(GATES) && GATES.every(Object.isFrozen));
  // A gate id is not a file name on every host: the colon of typecheck:mp names a stream on NTFS.
  assert.deepEqual(ALL.map(logName), ['lint.log', 'typecheck.log', 'typecheck-mp.log', 'build.log', 'unit.log',
    'offline.log', 'multiplayer.log']);
});

test('all seven gates with exit 0 give a complete record of full executed checks', () => {
  const record = buildRecord(identities, resultsFor(ALL));
  assert.equal(record.complete, true);
  assert.deepEqual(record.identities, identities);
  assert.deepEqual(record.checks.map(entry => entry.id), ALL);
  for (const gate of GATES) {
    const entry = check(record, gate.id);
    assert.deepEqual(Object.keys(entry).slice(0, 7), ['id', 'command', 'log', 'logSha256', 'executed', 'scope', 'exitCode']);
    assert.deepEqual([entry.command, entry.executed, entry.scope, entry.exitCode], [gate.command, true, 'full', 0]);
    assert.equal(entry.logSha256, sha(gate.id + ':0'));
  }
  assert.equal(record.rule, RECORD_RULE);
});

test('one non-zero exit gives an incomplete record that keeps the real exit code', () => {
  for (const id of ALL) {
    const record = buildRecord(identities, resultsFor(ALL, { [id]: 1 }));
    assert.equal(record.complete, false, id);
    assert.deepEqual([check(record, id).executed, check(record, id).scope, check(record, id).exitCode], [true, 'full', 1]);
    assert.throws(() => requireStableGates(identities, record), rejectedWith('Nonpassing stable gate: ' + id));
  }
});

test('a gate without a result is recorded as not executed and the record is incomplete', () => {
  const record = buildRecord(identities, resultsFor(FAST));
  assert.equal(record.complete, false);
  for (const id of FAST) assert.equal(check(record, id).executed, true);
  for (const id of ['offline', 'multiplayer'])
    assert.deepEqual(check(record, id), { id, command: GATES.find(gate => gate.id === id).command, log: null, logSha256: null,
      executed: false, scope: null, exitCode: null });
  assert.deepEqual([record.offline, record.multiplayer], [null, null]);
  assert.equal(buildRecord(identities, {}).complete, false);
  assert.ok(buildRecord(identities, {}).checks.every(entry => entry.executed === false));
});

test('a previous result under different identities is dropped', () => {
  const previous = buildRecord(otherIdentities, resultsFor(ALL));
  assert.equal(previous.complete, true);
  const record = buildRecord(identities, resultsFor(['offline', 'multiplayer']), previous);
  assert.equal(record.complete, false);
  assert.deepEqual(record.identities, identities);
  for (const id of FAST) assert.equal(check(record, id).executed, false, id);
  for (const id of ['offline', 'multiplayer']) assert.equal(check(record, id).executed, true, id);
  assert.equal(record.units, null);
  // An identity set that only lacks or adds one key is a different identity too.
  const { 'src/main.js': removed, ...fewer } = identities;
  assert.ok(removed);
  assert.equal(buildRecord(fewer, {}, buildRecord(identities, resultsFor(ALL))).checks.some(entry => entry.executed), false);
});

test('a previous result under equal identities is kept, and a fresh result replaces it', () => {
  const counts = { passed: 323, failed: 0, skipped: 0, files: 31, durationSeconds: 140 };
  const first = buildRecord(identities, { ...resultsFor(FAST), unit: { ...result('unit'), counts } });
  assert.deepEqual(first.units, counts);
  // Same values under another key order is the same identity.
  const reordered = Object.fromEntries(Object.entries(identities).reverse());
  const merged = buildRecord(reordered, resultsFor(['offline', 'multiplayer']), first);
  assert.equal(merged.complete, true);
  for (const id of FAST) assert.deepEqual(check(merged, id), check(first, id), id);
  assert.deepEqual(merged.units, counts);
  const again = buildRecord(identities, { lint: result('lint', 2) }, merged);
  assert.equal(check(again, 'lint').exitCode, 2);
  assert.equal(again.complete, false);
  assert.equal(check(again, 'offline').exitCode, 0);
});

test('a previous check is kept only when it was a full executed run of the same command with a log identity', () => {
  const good = buildRecord(identities, resultsFor(ALL));
  for (const [field, value] of [['executed', false], ['executed', 'true'], ['scope', 'focused'], ['scope', undefined],
    ['command', 'npm run lint -- src/main.js'], ['exitCode', '0'], ['exitCode', null], ['logSha256', ''], ['log', null]]) {
    const previous = structuredClone(good);
    check(previous, 'lint')[field] = value;
    const record = buildRecord(identities, {}, previous);
    assert.equal(check(record, 'lint').executed, false, field + ' ' + value);
    assert.equal(record.complete, false);
    assert.equal(check(record, 'unit').executed, true);
  }
  assert.equal(buildRecord(identities, {}, null).complete, false);
  assert.equal(buildRecord(identities, {}, { identities }).complete, false);
  assert.equal(buildRecord(identities, {}, { identities, checks: 'x' }).complete, false);
});

test('a caller cannot supply scope or executed, an unknown gate or an incomplete result', () => {
  for (const extra of [{ scope: 'full' }, { executed: true }, { scope: 'focused' }, { executed: false }, { command: 'true' }, { id: 'lint' }])
    assert.throws(() => buildRecord(identities, { lint: { ...result('lint'), ...extra } }), /Unexpected field of a stable gate result/);
  assert.throws(() => buildRecord(identities, { deploy: result('deploy') }), /Unknown stable gate: deploy/);
  for (const bad of [{ ...result('lint'), exitCode: null }, { ...result('lint'), exitCode: '0' }, { ...result('lint'), exitCode: 0.5 },
    { ...result('lint'), logSha256: 'c'.repeat(63) }, { ...result('lint'), log: '' }, null, 0])
    assert.throws(() => buildRecord(identities, { lint: bad }), /stable gate result/);
  assert.throws(() => buildRecord(null, {}), /identities/);
  assert.throws(() => buildRecord([], {}), /identities/);
});

test('the real predicate accepts the seven-zero record and rejects the six-gate record as unrun', () => {
  assert.equal(requireStableGates(identities, buildRecord(identities, resultsFor(ALL))), true);
  for (const missing of ALL) {
    const record = buildRecord(identities, resultsFor(ALL.filter(id => id !== missing)));
    assert.throws(() => requireStableGates(identities, record), rejectedWith('Unrun stable gate: ' + missing));
  }
  // The record of the five fast gates is what task 1 writes: refused at the first unrun gate.
  assert.throws(() => requireStableGates(identities, buildRecord(identities, resultsFor(FAST))), rejectedWith('Unrun stable gate: offline'));
  // A record built under other identities is stale for the real predicate whatever its gates say.
  assert.throws(() => requireStableGates(identities, buildRecord(otherIdentities, resultsFor(ALL))),
    rejectedWith('Stale or missing stable gate identities'));
});

test('counts come from what the tools themselves report', () => {
  const report = { config: {}, suites: [], errors: [],
    stats: { startTime: '2026-10-07T12:18:28.188Z', duration: 1902085.853, expected: 125, skipped: 0, unexpected: 2, flaky: 0 } };
  assert.deepEqual(playwrightCounts(report), { passed: 125, failed: 2, skipped: 0, flaky: 0, durationMs: 1902085.853 });
  for (const bad of [null, {}, { stats: {} }, { stats: { ...report.stats, expected: '125' } }, { stats: { ...report.stats, flaky: -1 } }])
    assert.equal(playwrightCounts(bad), null);
  const log = '\r\n RUN  v4.1.3 C:/x\r\n\r\n Test Files  31 passed (31)\r\n      Tests  323 passed (323)\r\n   Start at  14:15:20\r\n'
    + '   Duration  143.62s (transform 1.30s, setup 0ms)\r\n';
  assert.deepEqual(vitestCounts(log), { passed: 323, failed: 0, skipped: 0, files: 31, durationSeconds: 143.62 });
  const failing = ' Test Files  1 failed | 30 passed (31)\n      Tests  2 failed | 320 passed | 1 skipped (323)\n   Duration  9.50s\n';
  assert.deepEqual(vitestCounts(failing), { passed: 320, failed: 2, skipped: 1, files: 31, durationSeconds: 9.5 });
  assert.deepEqual(vitestCounts('\u001b[2m Test Files \u001b[22m \u001b[1m\u001b[32m2 passed\u001b[39m\u001b[22m\u001b[90m (2)\u001b[39m\n'
    + '\u001b[2m      Tests \u001b[22m \u001b[1m\u001b[32m7 passed\u001b[39m\u001b[22m\u001b[90m (7)\u001b[39m\n'),
  { passed: 7, failed: 0, skipped: 0, files: 2, durationSeconds: null });
  assert.equal(vitestCounts('npm error code 1\n'), null);
});

test('the command line accepts only the two commands of the plan', () => {
  assert.deepEqual(parseArguments(['run', '--gates', 'all']), { command: 'run', gates: ALL });
  assert.deepEqual(parseArguments(['run', '--gates', 'lint,typecheck,typecheck:mp,build,unit']), { command: 'run', gates: FAST });
  // Gates always run in the fixed order, offline before multiplayer, whatever order they were named in.
  assert.deepEqual(parseArguments(['run', '--gates', 'multiplayer,offline']), { command: 'run', gates: ['offline', 'multiplayer'] });
  assert.deepEqual(parseArguments(['check']), { command: 'check', onlyStable: false });
  assert.deepEqual(parseArguments(['check', '--only', 'stable']), { command: 'check', onlyStable: true });
  for (const bad of [[], ['run'], ['run', '--gates'], ['run', '--gates', ''], ['run', '--gates', 'lint,lint'], ['run', '--gates', 'lint,deploy'],
    ['run', '--gates', 'all', '--scope', 'focused'], ['run', '--gates', 'all,lint'], ['check', '--only'], ['check', '--only', 'plan09'],
    ['check', '--readers', 'x'], ['check', '--only', 'stable', 'x'], ['verify']])
    assert.throws(() => parseArguments(bad), /Usage/, JSON.stringify(bad));
});

test('the archive of a superseded record is created once and never overwritten', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'vod-stable-gates-'));
  try {
    const record = path.join(directory, 'record.json'), archive = path.join(directory, 'record-halted.json');
    writeFileSync(record, '{\n  "complete": false\n}\n');
    assert.equal(await archiveOnce(record, archive), 'created');
    assert.deepEqual(readFileSync(archive), readFileSync(record));
    writeFileSync(record, '{\n  "complete": true\n}\n');
    assert.equal(await archiveOnce(record, archive), 'kept');
    assert.equal(readFileSync(archive, 'utf8'), '{\n  "complete": false\n}\n');
    await assert.rejects(archiveOnce(path.join(directory, 'absent.json'), path.join(directory, 'other.json')), { code: 'ENOENT' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

// ---- the one place this tool reaches the plan 09 predicate (plan 07-16 implementation review, question 15) ----
//
// The predicate takes its readers as an optional fourth argument that defaults to the files on disk. A
// caller that passes a fourth argument could qualify plan 09 from something other than those files, so
// this tool must call it exactly once, with exactly three arguments, the first being the result of
// animationIdentities() of review.mjs. The arguments are split by a scanner that skips strings, template
// literals and comments and tracks bracket depth, so the result does not depend on formatting.
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
// Code without its comments. String literals are kept, because import paths are strings: the tool must
// therefore not spell either name inside a string, and the exact-count checks below fail if it does.
function codeOf(source) {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i++; out += '\n'; }
    else if (c === '/' && source[i + 1] === '*') { i = source.indexOf('*/', i + 2) + 1; out += ' '; }
    else if (c === '\'' || c === '"') {
      const start = i;
      for (i++; i < source.length && source[i] !== c; i++) if (source[i] === '\\') i++;
      out += source.slice(start, i + 1);
    } else out += c;
  }
  return out;
}
function occurrencesOf(source, name) {
  return [...source.matchAll(new RegExp('(?<![\\w$])' + name + '(?![\\w$])', 'g'))].map(match => {
    const after = source.slice(match.index + name.length).match(/^\s*\(/);
    return { index: match.index, called: !!after, member: source[match.index - 1] === '.',
      args: after ? argumentsAt(source, match.index + name.length + after[0].length - 1) : null };
  });
}
// Throws unless `file` holds exactly one call of requirePlan09, with exactly three arguments, the first
// being the result of animationIdentities() as imported from review.mjs.
function assertPlan09CallSite(file) {
  const source = codeOf(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  const imports = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)]
    .map(match => ({ names: match[1].split(',').map(name => name.trim()).filter(Boolean), from: match[2], index: match.index }));
  const importing = name => imports.filter(entry => entry.names.includes(name));
  assert.deepEqual(importing('requirePlan09').map(entry => entry.from), ['./animation-capture.mjs'], 'requirePlan09 is imported once, from the capture tool');
  assert.deepEqual(importing('animationIdentities').map(entry => entry.from), ['./review.mjs'], 'animationIdentities is imported once, from review.mjs');
  assert.ok(!/\bas\b/.test(imports.map(entry => entry.names.join(',')).join(',')), 'no import is renamed');
  assert.ok(!/import\s*\*|import\s*\(/.test(source), 'no namespace or dynamic import');
  const found = occurrencesOf(source, 'requirePlan09');
  // The import and one call: no alias, no member access, no .call or .apply, no second caller.
  assert.equal(found.length, 2, 'requirePlan09 occurs as its import and as one call');
  assert.deepEqual(found.map(entry => entry.called), [false, true], 'exactly one call of requirePlan09');
  assert.ok(found.every(entry => !entry.member), 'requirePlan09 is not reached through an object');
  assert.equal(found[1].args.length, 3, 'requirePlan09 is called with exactly three arguments');
  assert.ok(!found[1].args.some(argument => argument.startsWith('...')), 'no spread argument');
  assert.equal(found[1].args[0], 'await animationIdentities()', 'the identities are the result of animationIdentities()');
  // The name cannot be given another meaning in this file.
  for (const name of ['requirePlan09', 'animationIdentities'])
    assert.ok(!new RegExp('(?:function|const|let|var|class)\\s+' + name + '(?![\\w$])|(?<![\\w$.])' + name + '\\s*=(?!=)').test(source),
      name + ' is not declared or assigned here');
  assert.ok(occurrencesOf(source, 'animationIdentities').every(entry => entry.called || imports.some(item =>
    entry.index > item.index && entry.index < item.index + source.slice(item.index).indexOf('}'))),
  'animationIdentities is only imported and called');
  // animationIdentities takes an optional reader of file bytes; no call here may pass one.
  assert.ok(occurrencesOf(source, 'animationIdentities').filter(entry => entry.called).every(entry => entry.args.length === 0),
    'animationIdentities is always called without a reader');
  assert.ok(!/PLAN09_DISK_READERS/.test(source), 'the readers are never named here');
  return found[1].args;
}
const TOOL = fileURLToPath(new URL('./stable-gates.mjs', import.meta.url));
const CALL = 'requirePlan09(await animationIdentities(), summary, qualification)';

test('plan 09 call site: this tool calls the predicate once, with three arguments, on the identities of animationIdentities()', () => {
  assert.deepEqual(assertPlan09CallSite(TOOL), ['await animationIdentities()', 'summary', 'qualification']);
});

test('plan 09 call site: the control fails on a copy with a fourth argument, a second call, other identities or an alias', () => {
  const original = readFileSync(TOOL, 'utf8');
  assert.equal(original.split(CALL).length, 2, 'the call is written once, in the form the mutations replace');
  const directory = mkdtempSync(path.join(tmpdir(), 'vod-stable-gates-call-'));
  const copy = path.join(directory, 'stable-gates.mjs');
  try {
    // An unchanged copy passes, so every rejection below is caused by its one mutation.
    writeFileSync(copy, original);
    assert.deepEqual(assertPlan09CallSite(copy), ['await animationIdentities()', 'summary', 'qualification']);
    const mutations = {
      'a fourth argument': [CALL, 'requirePlan09(await animationIdentities(), summary, qualification, readers)', /exactly three arguments/],
      'an inline fourth argument': [CALL, 'requirePlan09(await animationIdentities(), summary, qualification, { file: () => "a,b)" })', /exactly three arguments/],
      'a fourth argument across lines': [CALL, 'requirePlan09(\n  await animationIdentities(), // current\n  summary,\n  qualification,\n  readers,\n)', /exactly three arguments/],
      'a spread': [CALL, 'requirePlan09(...[await animationIdentities(), summary, qualification, readers])', /exactly three arguments/],
      'two arguments': [CALL, 'requirePlan09(await animationIdentities(), summary)', /exactly three arguments/],
      'identities of the record': [CALL, 'requirePlan09(qualification.identities, summary, qualification)', /result of animationIdentities/],
      'identities with a reader': [CALL, 'requirePlan09(await animationIdentities(read), summary, qualification)', /result of animationIdentities/],
      'a second call': [CALL, CALL + '; requirePlan09(await animationIdentities(), summary, qualification, readers)', /occurs as its import and as one call/],
      'an alias': [CALL, 'const check = requirePlan09; check(await animationIdentities(), summary, qualification, readers)', /exactly one call|occurs as its import/],
      'a call through apply': [CALL, 'requirePlan09.apply(null, [await animationIdentities(), summary, qualification, readers])', /exactly one call/],
      'a renamed import': ['requirePlan09,', 'requirePlan09 as check,', /imported once|renamed/],
      'a local animationIdentities': [CALL, 'const animationIdentities = async () => qualification.identities; ' + CALL, /not declared or assigned/],
      'the readers named': [CALL, 'void PLAN09_DISK_READERS; ' + CALL, /readers are never named/],
      'gate identities read through a substituted reader': ['const identities = await animationIdentities();',
        'const identities = await animationIdentities(read);', /always called without a reader/],
    };
    for (const [name, [from, to, message]] of Object.entries(mutations)) {
      const mutated = original.replace(from, () => to);
      assert.notEqual(mutated, original, name + ': the mutation changes the copy');
      writeFileSync(copy, mutated);
      assert.throws(() => assertPlan09CallSite(copy), message, name);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
  // The working file was only read.
  assert.equal(readFileSync(TOOL, 'utf8'), original);
});

// ---- plan 09 qualification record (plan 07-18 task 3) -------------------------------------------------
//
// Synthetic inputs only. Registries are driven through the paired tool's own pure functions, reports are
// made-up bytes, and the three contract records are the tracked files. The real predicate is given
// synthetic readers as its fourth argument here, in the test file, and nowhere else.
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const repoFile = name => readFileSync(new URL('../../' + name, import.meta.url));
const PHASE_DIR = '.planning/phases/07-movement-matched-and-action-safe-animation/';
const CANDIDATE_PATH = paired.EVIDENCE_DIR + '07-18-cost-candidate.json';
const TIMING_PATH = paired.EVIDENCE_DIR + '07-18-timing-result.json';
const DECISION_PATH = PHASE_DIR + '07-18-FROZEN-PASS-DECISION.md';
const PLAN13_RESULT = paired.EVIDENCE_DIR + '07-13-v2-requalification.json';
const PLAN13_CANDIDATE = paired.EVIDENCE_DIR + '07-13-cost-candidate.json';
const PLAN13_AT = '2026-10-10T07:22:59.763Z';
const CONTRACT_FILES = [paired.PAIRED_CONTRACT.v2Path, paired.PAIRED_CONTRACT.decisionPath, paired.PAIRED_CONTRACT.v2ReviewPath];
const CONTRACT_HASHES = { v2Sha256: paired.PAIRED_CONTRACT.v2Sha256, decisionSha256: paired.PAIRED_CONTRACT.decisionSha256,
  v2ReviewSha256: paired.PAIRED_CONTRACT.v2ReviewSha256 };
// The identities of a paired record carry the sampler identity, as every real identity set does.
const ids09 = { ...identities, captureSampler: '5'.repeat(64) };
const COMPLETE_SUMMARY = '---\nstatus: complete\n---\n', HALTED_SUMMARY = '---\nstatus: halted\n---\n';
const THROW_ID = 'tests/action-lifecycle.spec.js#throw1ms', KEEPER_ID = 'tests/animation-regressions.spec.js#repeated-removal-keeper';
const TITLES = { [THROW_ID]: 'throw: cancels reload before award with 1ms remaining',
  [KEEPER_ID]: 'repeated character removal frees instance GPU allocations and preserves live shared geometry' };
const build = (...inputs) => {
  assert.equal(typeof gates.buildPlan09, 'function', 'buildPlan09 is exported by the stable gate tool');
  return gates.buildPlan09(...inputs);
};
const hasReason = (record, pattern) => assert.ok(Array.isArray(record.reasons) && record.reasons.some(reason => pattern.test(reason)),
  `${pattern} is not among ${JSON.stringify(record.reasons)}`);

// A Playwright JSON report with the two titled cases, each with the given result. One file is nested in
// a describe block, as Playwright nests suites, and another file holds a case with the same title.
function offlineReportOf(statuses = {}) {
  const spec = (title, file, status = 'passed') => ({ title, ok: ['passed', 'flaky', 'retried'].includes(status), file, line: 1,
    tests: [{ expectedStatus: 'passed',
      status: status === 'passed' || status === 'retried' ? 'expected' : status === 'flaky' ? 'flaky' : status === 'skipped' ? 'skipped' : 'unexpected',
      results: status === 'skipped' ? [] : status === 'flaky' ? [{ status: 'failed', retry: 0 }, { status: 'passed', retry: 1 }]
        // Reported as expected, yet with a second result that failed: the case did not run once and pass.
        : status === 'retried' ? [{ status: 'passed', retry: 0 }, { status: 'failed', retry: 1 }] : [{ status, retry: 0 }] }] });
  const byFile = { 'smoke.spec.js': [spec('menu shows', 'smoke.spec.js'), spec(TITLES[THROW_ID], 'smoke.spec.js', statuses.decoy)] };
  for (const [id, title] of Object.entries(TITLES)) {
    const file = id.slice('tests/'.length, id.indexOf('#')), status = statuses[id];
    byFile[file] ??= [];
    if (status === 'absent') continue;
    byFile[file].push(spec(title, file, status === 'twice' ? 'passed' : status));
    if (status === 'twice') byFile[file].push(spec(title, file));
  }
  return { config: {}, errors: [], stats: { expected: 4, unexpected: 0, skipped: 0, flaky: 0, duration: 1 },
    suites: Object.entries(byFile).map(([file, specs]) => (file === 'animation-regressions.spec.js'
      ? { title: file, file, specs: [], suites: [{ title: 'regressions', file, specs, suites: [] }] } : { title: file, file, specs, suites: [] })) };
}
// The offline check of a stable gate record: one full executed run with exit 0 and a log identity.
const offlineCheckOf = (change = {}) => ({ id: 'offline', command: GATES.find(gate => gate.id === 'offline').command,
  log: '.planning/research/.cache/07-17-gates/offline.log', logSha256: sha('offline log'), executed: true, scope: 'full', exitCode: 0, ...change });
const TOOL_HASHES = Object.fromEntries(paired.TOOL_PATHS.map(name => [name, 'd'.repeat(64)]));
// What the unchanged frozen command prints for a report: a result line at exit 0, or at exit 1 with numeric overruns only.
const frozenRunOf = (reportSha256, overruns) => ({ exitCode: overruns === 0 ? 0 : 1, stderr: '',
  stdout: JSON.stringify({ candidateReportSha256: reportSha256, applicableBudgetPass: overruns === 0,
    overruns: Array.from({ length: overruns }, () => ({})), certification: false }) + '\n' });

// One synthetic state of the phase. For each source identity: a passed calibration, then one qualifying
// session per listed result ('pass', 'fail' or 'invalid'); `overruns[i]` is what the frozen command gives
// for the candidate arm of session i of the current identity. Returns the builder's inputs and readers
// for the predicate over the same files.
function world09({ results = ['pass'], overruns = results.map(() => 21), earlier = [], ids = ids09 } = {}) {
  const files = {}, arms = [];
  let time = Date.parse('2026-10-12T10:00:00.000Z'), registry = paired.emptyRegistry(), count = 0;
  const now = () => new Date(time += 1000).toISOString();
  const drive = (kind, result, groupIds, frozenOverruns) => {
    const nonce = String(++count).padStart(32, '0');
    registry = paired.registerSession(registry, { kind, nonce, commit: 'c'.repeat(40), identity: paired.identityHash(groupIds),
      host: { note: 'synthetic' }, toolHashes: { ...TOOL_HASHES }, samplerIdentity: 'e'.repeat(64) }, now);
    registry = paired.appendEvent(registry, { type: 'started', kind, nonce, registrationHash: paired.eventHash(registry.events.at(-1)) }, now);
    const valid = result !== 'invalid', outcome = !valid ? 'invalid' : result === 'pass' ? 'passed' : 'failed';
    const armBytes = arm => jsonBytes({ schemaVersion: 1, complete: true, capturedAt: now(), identities: groupIds,
      samples: Array.from({ length: 12 }, () => ({})), paired: { nonce, kind, arm } });
    const reference = armBytes('reference'), candidate = armBytes('candidate');
    const paths = { reference: `${paired.PAIRED_CACHE}/session-${nonce}/arm-reference.json`,
      candidate: `${paired.PAIRED_CACHE}/session-${nonce}/arm-candidate.json` };
    const report = jsonBytes({ schemaVersion: 1, kind, nonce, outcome, certification: false,
      arms: { reference: { path: paths.reference, sha256: sha(reference) }, candidate: { path: paths.candidate, sha256: sha(candidate) } } });
    registry = paired.closeSession(registry, nonce, { valid, pass: valid ? outcome === 'passed' : null,
      settings: structuredClone(paired.SESSION_SETTINGS), browserVersion: 'synthetic-browser 1.0',
      reportHashes: { session: sha(report), reference: sha(reference), candidate: sha(candidate) },
      ...(kind === 'qualifying' ? { frozenExitCode: frozenOverruns === 0 ? 0 : 1, frozenOverrunCount: frozenOverruns } : {}) }, now);
    Object.assign(files, { [paths.reference]: reference, [paths.candidate]: candidate,
      [`${paired.EVIDENCE_DIR}07-18-paired-${kind === 'calibration' ? 'calibration' : 'session'}-${count}.json`]: report });
    if (kind === 'qualifying' && groupIds === ids) arms.push({ nonce, outcome, bytes: candidate, sha256: sha(candidate), path: paths.candidate,
      capturedAt: JSON.parse(candidate.toString('utf8')).capturedAt, overruns: frozenOverruns });
  };
  for (const [index, list] of earlier.entries()) {
    const other = { ...ids, 'src/main.js': String(index + 1).repeat(64) };
    drive('calibration', 'pass', other);
    for (const result of list) drive('qualifying', result, other, 21);
  }
  drive('calibration', 'pass', ids);
  for (const [index, result] of results.entries()) drive('qualifying', result, ids, overruns[index]);
  const identity = paired.identityHash(ids), versions = [{ commit: 'a'.repeat(40), onHead: true, registry: structuredClone(registry) }];
  files[paired.REGISTRY_PATH] = jsonBytes(registry);
  const registrationCommits = paired.registrationCommitsOf(registry, versions);
  const verdict = paired.registryVerdict(registry, identity, { registrationCommits });
  // The recorded candidate: the candidate arm of the last passed session, else of a session whose frozen command exited 0.
  const recorded = arms.filter(arm => arm.outcome === 'passed').at(-1) ?? arms.find(arm => arm.overruns === 0) ?? arms.at(-1);
  files[CANDIDATE_PATH] = recorded.bytes;
  const plan13 = jsonBytes({ schemaVersion: 1, complete: true, capturedAt: PLAN13_AT,
    identities: { 'src/main.js': '9'.repeat(64), captureSampler: 'e'.repeat(64) } });
  files[PLAN13_CANDIDATE] = plan13;
  files[PLAN13_RESULT] = jsonBytes({ schemaVersion: 1, plan: '07-13', exitCode: 1,
    candidate: { path: PLAN13_CANDIDATE, sha256: sha(plan13), capturedAt: PLAN13_AT },
    stdout: JSON.stringify({ candidateReportSha256: sha(plan13), applicableBudgetPass: false, overruns: Array.from({ length: 40 }, () => ({})) }) });
  // What the scan finds at this identity, and the list numbered as the predicate numbers it: the plan
  // 07-13 evaluation first (it is the oldest), then every candidate arm in time order.
  const scanned = arms.map((arm, index) => ({ evaluation: index + 1, of: arms.length, reportSha256: arm.sha256,
    paths: arm === recorded ? [CANDIDATE_PATH, arm.path] : [arm.path], capturedAt: arm.capturedAt, resultPrinted: true,
    exitCode: arm.overruns === 0 ? 0 : 1, overrunCount: arm.overruns, applicableBudgetPass: arm.overruns === 0, exitZeroObserved: arm.overruns === 0 }));
  const frozenEvaluations = [{ reportSha256: sha(plan13), capturedAt: PLAN13_AT, exitCode: 1, overrunCount: 40, scanned: false,
    exitZeroObserved: false, paths: [PLAN13_CANDIDATE], sameIdentity: false },
  ...scanned.map(entry => ({ reportSha256: entry.reportSha256, capturedAt: entry.capturedAt, exitCode: entry.exitCode,
    overrunCount: entry.overrunCount, scanned: true, exitZeroObserved: entry.exitZeroObserved, paths: entry.paths }))]
    .map((entry, index, list) => ({ evaluation: index + 1, of: list.length, ...entry }));
  const timing = { schemaVersion: 1, timingGate: 'paired-same-session', identitiesSha256: identity, contract: { ...CONTRACT_HASHES },
    registrationCommits: structuredClone(registrationCommits), allQualifying: structuredClone(verdict.allQualifying),
    identitiesTried: verdict.identitiesTried, registry: { path: paired.REGISTRY_PATH, sha256: sha(files[paired.REGISTRY_PATH]) },
    verdict: verdict.verdict, passed: verdict.passed, failed: verdict.failed, invalid: verdict.invalid, started: verdict.started,
    wording: verdict.wording, structuralV2Pass: true, frozenEvaluations, frozenExitZeroObserved: arms.some(arm => arm.overruns === 0),
    frozenApplicableBudgetPass: recorded.overruns === 0, frozenDecision: null, pass: verdict.verdict === 'pass',
    candidate: { path: CANDIDATE_PATH, sha256: recorded.sha256 }, certification: false };
  const readers = {
    file: name => {
      if (Object.hasOwn(files, name)) return files[name];
      if (CONTRACT_FILES.includes(name)) return repoFile(name);
      throw Error('no such synthetic file');
    },
    evidenceFiles: () => Object.keys(files).filter(name => name.startsWith(paired.EVIDENCE_DIR) && name.endsWith('.json')).sort(),
    committedRegistry: () => structuredClone(registry),
    registryHistory: () => versions,
    frozenEvaluations: () => structuredClone(scanned),
    frozen: name => frozenRunOf(sha(files[name]), recorded.overruns),
    // The verify command, answered for a session whose reports are whole: the outcome its session report holds.
    verifySession: name => {
      const report = JSON.parse(files[name].toString('utf8')), valid = report.outcome !== 'invalid';
      const line = { kind: report.kind, nonce: report.nonce, valid, pairedBudgetPass: valid ? report.outcome === 'passed' : null,
        structuralV2Pass: report.kind === 'calibration' ? null : valid, certification: false };
      return { exitCode: valid && line.pairedBudgetPass === true ? 0 : 1, stderr: '', stdout: JSON.stringify(line) + '\n' };
    },
  };
  return { ids, identity, registry, verdict, files, timing, timingResult: { path: TIMING_PATH, sha256: sha(jsonBytes(timing)) }, recorded, readers,
    offlineReport: offlineReportOf(), offlineCheck: offlineCheckOf() };
}
const recordOf = (world, timing = world.timing, facts = { timingResult: world.timingResult }) =>
  build(world.ids, timing, world.registry, world.offlineReport, world.offlineCheck, facts);

test('plan09: the two assertion titles are the cases the required assertions name', () => {
  assert.deepEqual(gates.ASSERTION_TITLES, TITLES);
  assert.deepEqual(Object.keys(TITLES), REQUIRED_ASSERTIONS);
  assert.ok(Object.isFrozen(gates.ASSERTION_TITLES));
});

test('plan09: a paired pass with a passing offline gate gives a complete paired record', () => {
  const world = world09(), record = recordOf(world);
  assert.equal(record.complete, true, JSON.stringify(record.reasons));
  assert.deepEqual(record.reasons, []);
  assert.equal(record.timingGate, 'paired-same-session');
  assert.deepEqual(record.identities, world.ids);
  // The frozen result is carried as the frozen command reported it for the recorded candidate, never rewritten.
  assert.equal(record.applicableBudgetPass, false);
  assert.equal(record.candidate, CANDIDATE_PATH);
  assert.deepEqual(record.paired, { ...CONTRACT_HASHES, registry: world.timing.registry, identity: world.identity, verdict: 'pass',
    passed: 1, failed: 0, invalid: 0, started: 1, wording: 'passed, session 1 of 1; 0 valid sessions failed; 0 invalid',
    allQualifying: world.verdict.allQualifying, registrationCommits: world.timing.registrationCommits, structuralV2Pass: true });
  // The count of frozen evaluations exists on the paired route too.
  assert.deepEqual(record.frozenEvaluations, world.timing.frozenEvaluations);
  assert.equal(record.frozenExitZeroObserved, false);
  assert.ok(!Object.hasOwn(record, 'frozenDecision') && !Object.hasOwn(record, 'pairedReported'));
  assert.deepEqual(record.timingResult, world.timingResult);
  assert.deepEqual(record.assertions, REQUIRED_ASSERTIONS.map(id => ({ id, title: TITLES[id], executed: true, status: 'pass', exitCode: 0,
    log: world.offlineCheck.log, logSha256: world.offlineCheck.logSha256 })));
  assert.equal(record.certification, false);
  // The five-argument form: the same record without the facts only the command line can add.
  const plain = build(world.ids, world.timing, world.registry, world.offlineReport, world.offlineCheck);
  assert.equal(plain.complete, true);
  assert.equal(plain.timingResult, null);
  // The builder changes none of its inputs.
  assert.deepEqual(world.timing, world09().timing);
});

test('plan09: the paired record is accepted by the real predicate with a complete summary and rejected with a halted one', () => {
  for (const options of [{}, { results: ['fail', 'pass', 'pass'], overruns: [21, 21, 0] }, { earlier: [['fail', 'fail']] }]) {
    const world = world09(options), record = recordOf(world);
    assert.equal(record.complete, true, JSON.stringify(record.reasons));
    // A frozen exit 0 on a candidate arm changes nothing on the paired route: the record stays paired.
    assert.equal(record.timingGate, 'paired-same-session');
    assert.equal(record.applicableBudgetPass, world.recorded.overruns === 0);
    assert.equal(requirePlan09(world.ids, COMPLETE_SUMMARY, record, world.readers), true);
    assert.throws(() => requirePlan09(world.ids, HALTED_SUMMARY, record, world.readers), rejectedWith('Plan09 is missing, halted or unqualified'));
  }
});

test('plan09: a timing result that disagrees with the registry, or a verdict that is not pass, gives an incomplete record', () => {
  const incomplete = (world, change, pattern) => {
    const timing = structuredClone(world.timing);
    change?.(timing);
    const record = recordOf(world, timing);
    assert.equal(record.complete, false, String(pattern));
    hasReason(record, pattern);
    assert.throws(() => requirePlan09(world.ids, COMPLETE_SUMMARY, record, world.readers), rejectedWith('Missing complete plan09 qualification'));
    return record;
  };
  for (const name of ['passed', 'failed', 'invalid', 'started'])
    incomplete(world09(), timing => { timing[name] += 1; }, /denominators differ from the registry/);
  incomplete(world09(), timing => { timing.verdict = 'undecided'; }, /verdict differs from the registry/);
  incomplete(world09(), timing => { timing.structuralV2Pass = false; }, /no structural V2 pass/);
  incomplete(world09(), timing => { timing.structuralV2Pass = null; }, /no structural V2 pass/);
  incomplete(world09(), timing => { timing.pass = false; }, /does not record a pass/);
  incomplete(world09(), timing => { timing.timingGate = 'frozen-v2'; }, /not a result of the paired gate/);
  incomplete(world09(), timing => { timing.contract.v2Sha256 = 'f'.repeat(64); }, /names another contract/);
  incomplete(world09(), timing => { timing.registry.path = paired.EVIDENCE_DIR + 'other.json'; }, /names no registry file and hash/);
  incomplete(world09(), timing => { delete timing.registrationCommits; }, /commit of every registration/);
  incomplete(world09(), timing => { timing.registrationCommits.pop(); }, /commit of every registration/);
  incomplete(world09(), timing => { timing.candidate.path = paired.PAIRED_CACHE + '/session-x/arm-candidate.json'; }, /no candidate in the evidence directory/);
  incomplete(world09(), timing => { timing.candidate.sha256 = 'f'.repeat(64); }, /not the candidate arm of a valid passed session/);
  incomplete(world09(), timing => { timing.frozenApplicableBudgetPass = null; }, /does not carry the frozen result/);
  incomplete(world09(), timing => { timing.frozenEvaluations.pop(); }, /not numbered 1 to n/);
  incomplete(world09(), timing => { timing.frozenEvaluations[0].exitCode = null; }, /not numbered 1 to n/);
  incomplete(world09(), timing => { timing.frozenEvaluations[1].overrunCount = '21'; }, /not numbered 1 to n/);
  incomplete(world09(), timing => { timing.frozenEvaluations[1].reportSha256 = timing.frozenEvaluations[0].reportSha256; }, /not numbered 1 to n/);
  incomplete(world09(), timing => { delete timing.frozenEvaluations; }, /Frozen evaluation list is missing/);
  // A real verdict that is not pass: the timing result says so truthfully, and nothing completes.
  for (const [results, verdict] of [[['fail'], 'undecided'], [['invalid'], 'undecided'], [['fail', 'fail'], 'failed'], [['pass', 'fail'], 'undecided'],
    [['pass', 'fail', 'invalid'], 'failed']]) {
    const world = world09({ results });
    assert.equal(world.timing.verdict, verdict);
    assert.equal(incomplete(world, null, /Paired registry verdict is not pass/).timingGate, 'paired-same-session');
  }
  // A timing result that claims a pass the registry does not give.
  incomplete(world09({ results: ['fail'] }), timing => Object.assign(timing, { verdict: 'pass', pass: true, passed: 1, failed: 0 }),
    /differs? from the registry/);
});

test('plan09: a missing title, a title that did not pass or a non-zero offline exit gives an incomplete record', () => {
  const world = world09();
  const judged = (report, check) => build(world.ids, world.timing, world.registry, report, check, { timingResult: world.timingResult });
  const entryOf = (record, id) => record.assertions.find(entry => entry.id === id);
  for (const id of REQUIRED_ASSERTIONS) {
    for (const [status, executed, recorded] of [['absent', false, 'missing'], ['failed', true, 'fail'], ['timedOut', true, 'fail'],
      ['skipped', false, 'fail'], ['flaky', true, 'fail'], ['retried', true, 'fail'], ['twice', false, 'ambiguous']]) {
      const record = judged(offlineReportOf({ [id]: status }), world.offlineCheck);
      assert.equal(record.complete, false, id + ' ' + status);
      assert.deepEqual([entryOf(record, id).executed, entryOf(record, id).status], [executed, recorded], id + ' ' + status);
      assert.equal(entryOf(record, REQUIRED_ASSERTIONS.find(name => name !== id)).status, 'pass');
      hasReason(record, /required browser assertion/);
      assert.throws(() => requirePlan09(world.ids, COMPLETE_SUMMARY, record, world.readers), rejectedWith('Missing complete plan09 qualification'));
    }
  }
  // The same title in another file neither stands in for the required case nor fails it.
  assert.equal(judged(offlineReportOf({ decoy: 'failed' }), world.offlineCheck).complete, true);
  for (const bad of [null, {}, { suites: 'x' }]) assert.equal(judged(bad, world.offlineCheck).complete, false);
  for (const change of [{ exitCode: 1 }, { exitCode: null }, { executed: false }, { scope: 'focused' }, { logSha256: 'x' }, { log: '' }, { id: 'unit' }]) {
    const record = judged(world.offlineReport, offlineCheckOf(change));
    assert.equal(record.complete, false, JSON.stringify(change));
    hasReason(record, /offline gate/);
  }
  assert.equal(judged(world.offlineReport, null).complete, false);
  // The exit code of an assertion is the exit code of the gate it was read from, whatever the title says.
  assert.deepEqual(judged(world.offlineReport, offlineCheckOf({ exitCode: 1 })).assertions.map(entry => [entry.status, entry.exitCode]),
    [['pass', 1], ['pass', 1]]);
});

test('plan09: timing identities that differ from the current identities are rejected with an assertion error', () => {
  const world = world09(), refused = { name: 'AssertionError', message: /Timing result is for another source identity/ };
  const other = { ...world.ids, 'src/main.js': 'b'.repeat(64) };
  assert.throws(() => build(other, world.timing, world.registry, world.offlineReport, world.offlineCheck), refused);
  assert.throws(() => build(world.ids, { ...world.timing, identitiesSha256: undefined }, world.registry, world.offlineReport, world.offlineCheck), refused);
  assert.throws(() => build(world.ids, null, world.registry, world.offlineReport, world.offlineCheck), refused);
});

test('plan09: a record that omits a qualifying session of an earlier identity is not complete', () => {
  const world = world09({ earlier: [['fail', 'fail'], ['invalid']] });
  assert.equal(world.timing.allQualifying.length, 3);
  const full = recordOf(world);
  assert.equal(full.complete, true, JSON.stringify(full.reasons));
  assert.deepEqual(full.paired.allQualifying.map(group => group.sessions.length), [2, 1, 1]);
  for (const change of [timing => { timing.allQualifying.shift(); }, timing => { timing.allQualifying[0].sessions.pop(); },
    timing => { timing.allQualifying = timing.allQualifying.filter(group => group.identity === timing.identitiesSha256); },
    timing => { timing.allQualifying[0].sessions[0].outcome = 'passed'; }, timing => { delete timing.allQualifying; }]) {
    const timing = structuredClone(world.timing);
    change(timing);
    const record = recordOf(world, timing);
    assert.equal(record.complete, false);
    hasReason(record, /every qualifying session in the registry/);
  }
});

test('plan09: a registry with a broken chain, another registry or a problem of the files gives an incomplete record', () => {
  const world = world09();
  const edited = structuredClone(world.registry);
  edited.events.find(event => event.type === 'closed' && event.kind === 'calibration').browserVersion = 'another browser';
  const broken = build(world.ids, world.timing, edited, world.offlineReport, world.offlineCheck);
  assert.equal(broken.complete, false);
  hasReason(broken, /Registry chain broken at sequence 4/);
  // A registry with a valid chain that the timing result was not made from.
  const other = build(world.ids, world.timing, world09({ results: ['pass', 'pass'] }).registry, world.offlineReport, world.offlineCheck);
  assert.equal(other.complete, false);
  for (const bad of [null, {}, { events: 'x' }])
    assert.equal(build(world.ids, world.timing, bad, world.offlineReport, world.offlineCheck).complete, false);
  // What only the command line can see (a file that differs from a recorded hash) refuses too.
  const problem = 'The registry file differs from the hash in the timing result';
  const refused = recordOf(world, world.timing, { timingResult: world.timingResult, problems: [problem] });
  assert.equal(refused.complete, false);
  assert.deepEqual(refused.reasons, [problem]);
});

// The owner decision record in the plain form the plan gives; synthetic here.
const decisionOf = (world, fields = {}) => Buffer.from('---\n' + Object.entries({ decision: 'accept-frozen-pass', decided_by: 'owner',
  evaluation: 3, evaluations: 3, decided: '2026-10-12', timing_result_sha256: world.timingResult.sha256, ...fields })
  .filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`).join('\n')
  + '\n---\n\n# Plan 07-18: owner decision on a frozen exit 0\n\n> accept-frozen-pass\n');
const factsOf = (world, decision) => ({ timingResult: world.timingResult,
  frozenDecision: decision ? { path: DECISION_PATH, sha256: sha(decision), text: decision.toString('utf8') } : null });

test('plan09: a frozen exit 0 completes a record only with the owner decision record, and then on the frozen route', () => {
  const world = world09({ results: ['fail', 'fail'], overruns: [21, 0] });
  assert.deepEqual([world.timing.verdict, world.timing.pass, world.timing.frozenExitZeroObserved, world.timing.frozenApplicableBudgetPass],
    ['failed', false, true, true]);
  const judged = (decision, change) => {
    const timing = structuredClone(world.timing);
    change?.(timing);
    return recordOf(world, timing, factsOf(world, decision));
  };
  // Without the decision record a frozen exit 0 never completes a record.
  const without = judged(null);
  assert.equal(without.complete, false);
  assert.equal(without.timingGate, 'paired-same-session');
  hasReason(without, /Paired registry verdict is not pass/);
  assert.ok(!Object.hasOwn(without, 'frozenDecision'));
  assert.equal(without.applicableBudgetPass, true);
  assert.equal(build(world.ids, world.timing, world.registry, world.offlineReport, world.offlineCheck).complete, false);
  // With the owner's recorded acceptance of evaluation 3 of 3: the frozen route.
  const decision = decisionOf(world), record = judged(decision);
  assert.equal(record.complete, true, JSON.stringify(record.reasons));
  assert.equal(record.timingGate, 'frozen-v2');
  assert.equal(record.applicableBudgetPass, true);
  assert.equal(record.candidate, CANDIDATE_PATH);
  assert.deepEqual(record.frozenDecision, { path: DECISION_PATH, sha256: sha(decision) });
  assert.deepEqual(record.frozenEvaluations.map(entry => [entry.evaluation, entry.of, entry.exitCode, entry.putForward === true]),
    [[1, 3, 1, false], [2, 3, 1, false], [3, 3, 0, true]]);
  assert.deepEqual(record.frozenEvaluations.map(entry => Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'putForward'))),
    world.timing.frozenEvaluations);
  assert.deepEqual(record.pairedReported, { verdict: 'failed', passed: 0, failed: 2, invalid: 0, started: 2, wording: world.timing.wording,
    registry: world.timing.registry, allQualifying: world.verdict.allQualifying });
  assert.ok(!Object.hasOwn(record, 'paired'));
  world.files[DECISION_PATH] = decision;
  assert.equal(requirePlan09(world.ids, COMPLETE_SUMMARY, record, world.readers), true);
  assert.throws(() => requirePlan09(world.ids, HALTED_SUMMARY, record, world.readers), rejectedWith('Plan09 is missing, halted or unqualified'));
  // Any other answer, another evaluation or count, or a decision made on another timing result completes nothing.
  for (const [fields, pattern] of [[{ decision: 'information-only' }, /not accept-frozen-pass/], [{ decision: 'neither' }, /not accept-frozen-pass/],
    [{ decided_by: 'agent' }, /not decided by the owner/], [{ evaluation: 2 }, /another evaluation/], [{ evaluations: 4 }, /another count of evaluations/],
    [{ timing_result_sha256: 'f'.repeat(64) }, /another timing result/], [{ timing_result_sha256: undefined }, /another timing result/],
    [{ decision: '"accept-frozen-pass"' }, /not accept-frozen-pass/]]) {
    const refused = judged(decisionOf(world, fields));
    assert.equal(refused.complete, false, JSON.stringify(fields));
    assert.equal(refused.timingGate, 'paired-same-session');
    hasReason(refused, pattern);
  }
  // A quoted root scalar anywhere in the frontmatter makes every key read as absent (implementation review I-07).
  assert.equal(judged(Buffer.from(decision.toString('utf8').replace('---\n', '---\nplan: "18"\n'))).complete, false);
  // The decision is not enough when the frozen command did not exit 0 on the recorded candidate or the list is not whole.
  for (const [change, pattern] of [[timing => { timing.frozenApplicableBudgetPass = false; }, /did not exit 0 on the recorded candidate/],
    [timing => { timing.frozenEvaluations[2].exitCode = 1; }, /did not exit 0 on the recorded candidate/],
    [timing => { timing.frozenEvaluations[2].scanned = false; }, /scan does not find/],
    [timing => { timing.frozenEvaluations.shift(); }, /not numbered 1 to n/],
    [timing => { delete timing.frozenEvaluations[0].sameIdentity; }, /plan 07-13 evaluation/],
    [timing => { timing.frozenEvaluations[1].of = 4; }, /not numbered 1 to n/]]) {
    const refused = judged(decision, change);
    assert.equal(refused.complete, false, String(pattern));
    hasReason(refused, pattern);
  }
});

test('plan09: the command line takes the timing result, the registry and the offline report, in that order', () => {
  const args = ['plan09', '--timing', 'a.json', '--registry', 'b.json', '--offline-report', 'c.json'];
  let parsed;
  assert.doesNotThrow(() => { parsed = parseArguments(args); });
  assert.deepEqual(parsed, { command: 'plan09', timing: 'a.json', registry: 'b.json', offlineReport: 'c.json' });
  for (const bad of [['plan09'], args.slice(0, 5), [...args, '--readers', 'x'], ['plan09', '--registry', 'b.json', '--timing', 'a.json', '--offline-report', 'c.json'],
    [...args.slice(0, 6), ''], [...args.slice(0, 6), 7]])
    assert.throws(() => parseArguments(bad), /Usage/, JSON.stringify(bad));
});

test('plan09: the tool takes from the three pinned files only what it calls without a reader', () => {
  const source = codeOf(readFileSync(TOOL, 'utf8').replace(/\r\n/g, '\n'));
  const imported = from => [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)].filter(match => match[2] === from)
    .flatMap(match => match[1].split(',').map(name => name.trim()).filter(Boolean)).sort();
  assert.deepEqual(imported('./review.mjs'), ['animationIdentities']);
  assert.deepEqual(imported('./animation-capture.mjs'), ['requirePlan09', 'requireStableGates']);
  assert.deepEqual(imported('./animation-budget-paired.mjs'), ['PAIRED_CONTRACT', 'REGISTRY_PATH', 'checkedRegistry', 'identityHash', 'registryVerdict']);
  // Neither takes a reader: the verdict is recomputed from a registry object, and the registry file is
  // checked against git by the paired tool's own default effects.
  const calls = name => occurrencesOf(source, name).filter(entry => entry.called);
  assert.deepEqual(calls('registryVerdict').map(entry => entry.args.length), [3]);
  assert.match(calls('registryVerdict')[0].args[2], /^\{ registrationCommits: [^,}]+\}$/);
  assert.deepEqual(calls('checkedRegistry').map(entry => entry.args.length), [1]);
});

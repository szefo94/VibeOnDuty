import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeDependencyIdentities } from './runtime-dependencies.mjs';
import { REQUIRED_STABLE_GATES, requireStableGates } from './animation-capture.mjs';
import { GATES, RECORD_RULE, archiveOnce, buildRecord, logName, parseArguments, playwrightCounts,
  vitestCounts } from './stable-gates.mjs';

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

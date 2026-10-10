// Controls for the paired same-session timing gate (plan 07-16; the contract is
// 07-09-PAIRED-AMENDMENT-V2.md). Synthetic inputs only: no gitignored cache, no browser,
// no git object and no check that depends on checkout line endings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as paired from './animation-budget-paired.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HEX = (character, length = 64) => character.repeat(length);
const NONCE = number => String(number).padStart(32, '0');
const IDENTITY = HEX('a'), OTHER_IDENTITY = HEX('b'), COMMIT = HEX('c', 40);
const TIERS = ['low', 'medium', 'high'], ACTORS = [1, 8];
const COMPONENTS = ['frameIntervalMs', 'mixerMs', 'inertiaMs', 'correctionMs', 'renderMs',
  'selectionMs', 'coreCorrectionMs', 'viewMs'];
const clock = () => { let time = Date.parse('2026-10-10T12:00:00.000Z');
  return () => new Date(time += 1000).toISOString(); };
const smokeEntry = (nonce, overrides = {}) => ({ kind: 'smoke', nonce, commit: COMMIT, identity: IDENTITY,
  host: { note: 'synthetic' }, toolHashes: Object.fromEntries(paired.TOOL_PATHS.map(name => [name, HEX('d')])),
  samplerIdentity: HEX('e'), ...overrides });

// ---- order -------------------------------------------------------------------------

test('order is balanced: every cell is once reference-first and once candidate-first, inside every tier and actor count', () => {
  const firsts = [];
  for (const run of [1, 2]) for (const tier of [0, 1, 2]) for (const actor of [0, 1])
    firsts.push({ run, tier, actor, first: paired.orderFor(run, tier, actor) });
  for (const entry of firsts) assert.ok(['reference-first', 'candidate-first'].includes(entry.first), JSON.stringify(entry));
  for (const tier of [0, 1, 2]) for (const actor of [0, 1]) {
    const cell = firsts.filter(entry => entry.tier === tier && entry.actor === actor).map(entry => entry.first).sort();
    assert.deepEqual(cell, ['candidate-first', 'reference-first'], `cell ${tier}/${actor}`);
  }
  for (const tier of [0, 1, 2])
    assert.equal(firsts.filter(entry => entry.tier === tier && entry.first === 'reference-first').length, 2, `tier ${tier}`);
  for (const actor of [0, 1])
    assert.equal(firsts.filter(entry => entry.actor === actor && entry.first === 'reference-first').length, 3, `actor ${actor}`);
  // The table of section 3, run 1: Low/1, Low/8, Medium/1, Medium/8, High/1, High/8.
  assert.deepEqual([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]].map(([tier, actor]) => paired.orderFor(1, tier, actor)),
    ['reference-first', 'candidate-first', 'candidate-first', 'reference-first', 'reference-first', 'candidate-first']);
  assert.throws(() => paired.orderFor(3, 0, 0), /run/i);
  assert.throws(() => paired.orderFor(1, 3, 0), /tier/i);
  assert.throws(() => paired.orderFor(1, 0, 2), /actor/i);
});

// ---- rule 1 ------------------------------------------------------------------------

const BASE = { frameIntervalMs: [250, 262], mixerMs: [0.1, 0.1], inertiaMs: [0, 0], correctionMs: [1.6, 2],
  renderMs: [1.8, 2.6], selectionMs: [0.2, 0.3], coreCorrectionMs: [1, 1.3], viewMs: [0.4, 0.5] };
function plainArm() {
  const samples = [];
  for (const run of [1, 2]) for (const tier of TIERS) for (const actorCount of ACTORS)
    samples.push({ run, tier, actorCount, timings: Object.fromEntries(COMPONENTS.map(name =>
      [name, { median: BASE[name][0], p95: BASE[name][1] }])) });
  return { samples };
}
function plainSession(mutate) {
  const session = { kind: 'qualifying', nonce: NONCE(1), validity: { valid: true, reasons: [] },
    arms: { reference: { report: plainArm() }, candidate: { report: plainArm() } } };
  mutate?.(session);
  return session;
}
const sampleOf = (session, arm, run, tier, actorCount) => session.arms[arm].report.samples.find(sample =>
  sample.run === run && sample.tier === tier && sample.actorCount === actorCount);

test('rule 1: a passing pair passes, and a value exactly at the bound is not a violation', () => {
  const equal = paired.evaluatePaired(plainSession(), paired.PAIRED_CONTRACT);
  assert.equal(equal.rule1.comparisons, 192);
  assert.deepEqual(equal.rule1.violations, []);
  assert.equal(equal.pairedBudgetPass, true);
  const atBound = paired.evaluatePaired(plainSession(session => {
    sampleOf(session, 'candidate', 2, 'high', 8).timings.frameIntervalMs.median = 250 * 1.25 + 0.1;
  }), paired.PAIRED_CONTRACT);
  assert.equal(atBound.rule1.comparisons, 192);
  assert.deepEqual(atBound.rule1.violations, []);
});

test('rule 1: a single-statistic overrun fails and names its profile, component and statistic', () => {
  const result = paired.evaluatePaired(plainSession(session => {
    sampleOf(session, 'candidate', 2, 'high', 8).timings.renderMs.p95 = 2.6 * 1.25 + 0.1 + 0.01;
  }), paired.PAIRED_CONTRACT);
  assert.equal(result.rule1.comparisons, 192);
  assert.equal(result.rule1.violations.length, 1);
  const [violation] = result.rule1.violations;
  assert.deepEqual([violation.run, violation.tier, violation.actorCount, violation.component, violation.stat],
    [2, 'high', 8, 'renderMs', 'p95']);
  assert.equal(result.pairedBudgetPass, false);
});

// ---- registry: events and chain ----------------------------------------------------

function chainOfFour() {
  const now = clock();
  let registry = paired.emptyRegistry();
  registry = paired.appendEvent(registry, { type: 'registered', kind: 'smoke', nonce: NONCE(1), identity: IDENTITY }, now);
  const registration = paired.eventHash(registry.events.at(-1));
  registry = paired.appendEvent(registry, { type: 'started', kind: 'smoke', nonce: NONCE(1), registrationHash: registration }, now);
  registry = paired.appendEvent(registry, { type: 'closed', kind: 'smoke', nonce: NONCE(1), structuralFailure: true }, now);
  registry = paired.appendEvent(registry, { type: 'registered', kind: 'smoke', nonce: NONCE(2), identity: IDENTITY }, now);
  return registry;
}

test('appendEvent chains events by the hash of the previous one and never edits an earlier event', () => {
  const now = clock(), first = paired.appendEvent(paired.emptyRegistry(),
    { type: 'registered', kind: 'smoke', nonce: NONCE(1), identity: IDENTITY }, now);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].seq, 1);
  assert.equal(first.events[0].prevHash, paired.GENESIS);
  assert.match(first.events[0].at, /^2026-10-10T12:00:0\d\.000Z$/);
  const before = JSON.stringify(first);
  const second = paired.appendEvent(first, { type: 'started', kind: 'smoke', nonce: NONCE(1) }, now);
  assert.equal(JSON.stringify(first), before, 'the earlier registry object is not modified');
  assert.equal(second.events.length, 2);
  assert.equal(second.events[1].seq, 2);
  assert.equal(second.events[1].prevHash, paired.eventHash(first.events[0]));
  assert.match(second.events[1].prevHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(second.events[0], first.events[0]);
  assert.throws(() => paired.appendEvent(second, { type: 'deleted', nonce: NONCE(1) }, now), /type/i);
  assert.throws(() => paired.appendEvent(second, { type: 'closed', nonce: NONCE(1), seq: 1 }, now), /seq|prevHash/);
});

test('verifyChain accepts an untouched chain and rejects a removed event', () => {
  const registry = chainOfFour();
  assert.equal(paired.verifyChain(registry).events, 4);
  const removed = structuredClone(registry); removed.events.splice(1, 1);
  assert.throws(() => paired.verifyChain(removed), /sequence 2/);
  // Removing an event and renumbering the rest still breaks the hash link.
  const renumbered = structuredClone(removed); renumbered.events.forEach((event, index) => { event.seq = index + 1; });
  assert.throws(() => paired.verifyChain(renumbered), /sequence [23]/);
});

test('verifyChain rejects two swapped events', () => {
  const swapped = chainOfFour();
  [swapped.events[1], swapped.events[2]] = [swapped.events[2], swapped.events[1]];
  assert.throws(() => paired.verifyChain(swapped), /sequence 2/);
});

test('verifyChain rejects an edited event', () => {
  const edited = chainOfFour();
  edited.events[2].structuralFailure = false;
  assert.throws(() => paired.verifyChain(edited), /sequence 4/);
});

test('verifyChain rejects a wrong prevHash', () => {
  const wrong = chainOfFour();
  wrong.events[2].prevHash = HEX('f');
  assert.throws(() => paired.verifyChain(wrong), /sequence 3/);
  const genesis = chainOfFour();
  genesis.events[0].prevHash = HEX('f');
  assert.throws(() => paired.verifyChain(genesis), /sequence 1/);
});

// ---- registry: smoke registration ----------------------------------------------------

test('a smoke registration records commit, source identity, host facts, the three tool hashes and the sampler identity', () => {
  assert.deepEqual([...paired.TOOL_PATHS], ['tools/art/animation-budget-paired.mjs', 'tools/art/review.mjs',
    'tools/art/animation-capture.mjs']);
  const registry = paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1)), clock());
  assert.equal(registry.events.length, 1);
  const event = registry.events[0];
  assert.deepEqual([event.type, event.kind, event.nonce, event.commit, event.identity, event.samplerIdentity],
    ['registered', 'smoke', NONCE(1), COMMIT, IDENTITY, HEX('e')]);
  assert.deepEqual(Object.keys(event.toolHashes).sort(), [...paired.TOOL_PATHS].sort());
  assert.deepEqual(event.host, { note: 'synthetic' });
  assert.throws(() => paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1), { toolHashes: {} })), /tool hash/i);
  assert.throws(() => paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1), { identity: 'short' })), /identity/i);
  assert.throws(() => paired.registerSession(paired.emptyRegistry(), smokeEntry('not-a-nonce')), /nonce/i);
  assert.throws(() => paired.registerSession(registry, smokeEntry(NONCE(1), { identity: OTHER_IDENTITY })), /nonce/i);
});

test('a smoke entry is not countable', () => {
  const registry = paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1)), clock());
  assert.equal(registry.events[0].countable, false);
  assert.deepEqual(paired.countableSessions(registry, IDENTITY), []);
  const withQualifying = paired.appendEvent(registry,
    { type: 'registered', kind: 'qualifying', nonce: NONCE(2), identity: IDENTITY }, clock());
  assert.deepEqual(paired.countableSessions(withQualifying, IDENTITY).map(event => event.nonce), [NONCE(2)]);
});

test('a second smoke for an identity is refused unless the first failed structurally', () => {
  const now = clock();
  const first = paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1)), now);
  // Registered and never closed: not shown to have failed structurally.
  assert.throws(() => paired.registerSession(first, smokeEntry(NONCE(2)), now), /smoke already exists/i);
  const started = paired.appendEvent(first, { type: 'started', kind: 'smoke', nonce: NONCE(1) }, now);
  const loaded = paired.appendEvent(started, { type: 'closed', kind: 'smoke', nonce: NONCE(1), structuralFailure: false }, now);
  assert.throws(() => paired.registerSession(loaded, smokeEntry(NONCE(2)), now), /smoke already exists/i);
  const failed = paired.appendEvent(started, { type: 'closed', kind: 'smoke', nonce: NONCE(1), structuralFailure: true }, now);
  const second = paired.registerSession(failed, smokeEntry(NONCE(2)), now);
  assert.equal(second.events.length, 4);
  assert.equal(second.events[3].nonce, NONCE(2));
  // Another source identity has its own smoke.
  const other = paired.registerSession(loaded, smokeEntry(NONCE(3), { identity: OTHER_IDENTITY }), now);
  assert.equal(other.events.at(-1).identity, OTHER_IDENTITY);
});

test('a smoke is refused once a calibration event exists for the identity, and once a qualifying one does', () => {
  for (const kind of ['calibration', 'qualifying']) {
    const now = clock();
    const registry = paired.appendEvent(paired.emptyRegistry(),
      { type: 'registered', kind, nonce: NONCE(7), identity: IDENTITY }, now);
    assert.throws(() => paired.registerSession(registry, smokeEntry(NONCE(1)), now),
      /calibration or qualifying/i, kind);
    // The same event for another identity does not block this one.
    const elsewhere = paired.registerSession(registry, smokeEntry(NONCE(1), { identity: OTHER_IDENTITY }), now);
    assert.equal(elsewhere.events.length, 2, kind);
  }
});

// ---- registry: committed before run, one run per nonce ---------------------------------

test('a run whose registration is absent from the committed registry is refused', () => {
  const working = paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1)), clock());
  assert.throws(() => paired.assertRunnable({ nonce: NONCE(1), working, committed: null }), /Registration is not committed/);
  assert.throws(() => paired.assertRunnable({ nonce: NONCE(1), working, committed: paired.emptyRegistry() }),
    /Registration is not committed/);
  // A committed event with the same nonce and other content is not this registration.
  const other = paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1), { identity: OTHER_IDENTITY }), clock());
  assert.throws(() => paired.assertRunnable({ nonce: NONCE(1), working, committed: other }), /Registration is not committed/);
  const registration = paired.assertRunnable({ nonce: NONCE(1), working, committed: structuredClone(working) });
  assert.equal(registration.nonce, NONCE(1));
  assert.equal(registration.type, 'registered');
});

test('a second run of a nonce that has a started event is refused, in the working registry and in the committed one', () => {
  const now = clock();
  const registered = paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1)), now);
  const started = paired.appendEvent(registered, { type: 'started', kind: 'smoke', nonce: NONCE(1) }, now);
  const closed = paired.appendEvent(started, { type: 'closed', kind: 'smoke', nonce: NONCE(1), structuralFailure: false }, now);
  assert.throws(() => paired.assertRunnable({ nonce: NONCE(1), working: started, committed: registered }), /Session already started/);
  assert.throws(() => paired.assertRunnable({ nonce: NONCE(1), working: registered, committed: started }), /Session already started/);
  assert.throws(() => paired.assertRunnable({ nonce: NONCE(1), working: closed, committed: closed }), /Session already started/);
  assert.equal(paired.assertRunnable({ nonce: NONCE(1), working: registered, committed: registered }).seq, 1);
});

test('the chain check reports an event that is not in the committed registry', () => {
  const now = clock();
  const registered = paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1)), now);
  const started = paired.appendEvent(registered, { type: 'started', kind: 'smoke', nonce: NONCE(1) }, now);
  assert.deepEqual(paired.uncommittedEvents(started, started), []);
  assert.deepEqual(paired.uncommittedEvents(started, registered), [2]);
  assert.deepEqual(paired.uncommittedEvents(started, null), [1, 2]);
  const edited = structuredClone(started); edited.events[0].identity = OTHER_IDENTITY;
  assert.deepEqual(paired.uncommittedEvents(started, edited), [1]);
});

// ---- line-ending pins ------------------------------------------------------------------

const attributes = () => readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');

test('.gitattributes holds each required pin line exactly once', () => {
  const text = attributes(), lines = text.split(/\r?\n/);
  assert.equal(paired.PINNED_PATHS.length, 11);
  assert.ok(paired.PINNED_PATHS.includes(paired.REGISTRY_PATH) && paired.REGISTRY_PATH.length > 0);
  for (const name of paired.PINNED_PATHS)
    assert.equal(lines.filter(line => line === `${name} text eol=lf`).length, 1, name);
  assert.deepEqual(paired.assertPins(() => text), [...paired.PINNED_PATHS]);
  // The file has no attribute of its own: a checkout may hold it with either line ending.
  assert.deepEqual(paired.assertPins(() => text.replace(/\r?\n/g, '\r\n')), [...paired.PINNED_PATHS]);
});

test('a registration is refused when a pin line is missing from the committed .gitattributes', () => {
  const text = attributes();
  assert.ok(paired.PINNED_PATHS.length > 0);
  for (const name of paired.PINNED_PATHS) {
    const without = text.split(/\r?\n/).filter(line => line !== `${name} text eol=lf`).join('\n');
    assert.throws(() => paired.assertPins(() => without),
      error => error.message.startsWith('Line-ending pin is not committed') && error.message.includes(name), name);
  }
  assert.throws(() => paired.assertPins(() => ''), /Line-ending pin is not committed/);
  // A wildcard, another attribute or a commented line is not the exact-path pin.
  const [first] = paired.PINNED_PATHS;
  const replace = replacement => text.split(/\r?\n/).map(line => line === `${first} text eol=lf` ? replacement : line).join('\n');
  for (const replacement of [`# ${first} text eol=lf`, `${first} text`, `${first} -text`, '*.json text eol=lf'])
    assert.throws(() => paired.assertPins(() => replace(replacement)), /Line-ending pin is not committed/, replacement);
});

test('a registration is refused when a pin line appears twice in the committed .gitattributes', () => {
  const text = attributes();
  assert.ok(paired.PINNED_PATHS.length > 0);
  const name = paired.PINNED_PATHS.at(-1);
  assert.throws(() => paired.assertPins(() => text + `${name} text eol=lf\n`),
    error => error.message.startsWith('Line-ending pin is not committed') && error.message.includes(name));
});

// ---- run guard ---------------------------------------------------------------------------

const registeredEvent = () => paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1)), clock()).events[0];
const LATER = HEX('9', 40);

test('allowedSinceRegistration admits only the registry file and the phase evidence directory', () => {
  assert.equal(paired.allowedSinceRegistration([]), true);
  assert.equal(paired.allowedSinceRegistration([paired.REGISTRY_PATH]), true);
  assert.equal(paired.allowedSinceRegistration([paired.EVIDENCE_DIR + '07-16-paired-smoke.json', paired.REGISTRY_PATH]), true);
  for (const refused of ['src/main.js', 'public/models/enemy.glb', 'tools/art/review.mjs', 'tests/menu.spec.js',
    'server/index.js', 'index.html', 'style.css', '.gitattributes', '.planning/STATE.md',
    '.planning/phases/07-movement-matched-and-action-safe-animation/07-14-MP-ROUTE-DECISION.md',
    paired.EVIDENCE_DIR, paired.EVIDENCE_DIR + '../07-16-PLAN.md', paired.EVIDENCE_DIR.replaceAll('/', '\\') + 'x.json'])
    assert.equal(paired.allowedSinceRegistration([paired.REGISTRY_PATH, refused]), false, refused);
});

test('runGuard allows HEAD moved by a registry-only commit', () => {
  const registered = registeredEvent();
  assert.equal(paired.runGuard({ registered, headCommit: COMMIT, isDescendant: true, changedPaths: [], identityNow: IDENTITY }), true);
  assert.equal(paired.runGuard({ registered, headCommit: LATER, isDescendant: true,
    changedPaths: [paired.REGISTRY_PATH], identityNow: IDENTITY }), true);
  assert.equal(paired.runGuard({ registered, headCommit: LATER, isDescendant: true,
    changedPaths: [paired.REGISTRY_PATH, paired.EVIDENCE_DIR + '07-16-paired-smoke.json'], identityNow: IDENTITY }), true);
});

test('runGuard refuses HEAD moved by a commit that touches src/main.js or another served or hashed file', () => {
  const registered = registeredEvent();
  for (const touched of ['src/main.js', 'public/models/enemy.glb', 'tools/art/motion-manifest.json', 'index.html',
    'tools/art/review.mjs', '.planning/phases/07-movement-matched-and-action-safe-animation/07-14-MP-ROUTE-DECISION.md'])
    assert.throws(() => paired.runGuard({ registered, headCommit: LATER, isDescendant: true,
      changedPaths: [paired.REGISTRY_PATH, touched], identityNow: IDENTITY }),
    error => error.message.includes(touched), touched);
});

test('runGuard refuses an unchanged HEAD with a changed identity', () => {
  const registered = registeredEvent();
  assert.throws(() => paired.runGuard({ registered, headCommit: COMMIT, isDescendant: true, changedPaths: [],
    identityNow: OTHER_IDENTITY }), /identity changed/i);
  assert.throws(() => paired.runGuard({ registered, headCommit: LATER, isDescendant: true,
    changedPaths: [paired.REGISTRY_PATH], identityNow: OTHER_IDENTITY }), /identity changed/i);
});

test('runGuard refuses a HEAD that is not a descendant of the registered commit', () => {
  const registered = registeredEvent();
  assert.throws(() => paired.runGuard({ registered, headCommit: LATER, isDescendant: false,
    changedPaths: [paired.REGISTRY_PATH], identityNow: IDENTITY }), /descendant/i);
  assert.throws(() => paired.runGuard({ registered, headCommit: LATER, changedPaths: [], identityNow: IDENTITY }), /descendant/i);
});

// ---- arms --------------------------------------------------------------------------------

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const blobId = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const OWNERS = ['src/builders/characterResources.js', 'src/builders/enemyGLTF.js', 'src/builders/firstPersonRig.js',
  'src/builders/enemyAnimations.js', 'src/builders/weaponHandling.js'];

function armFixture() {
  const base = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'vod-paired-')));
  const root = path.join(base, 'tree'), cacheRoot = path.join(base, 'cache');
  const files = ['index.html', 'style.css', 'public/models/enemy.glb', 'src/main.js', 'tools/art/motion-manifest.json', ...OWNERS].sort();
  for (const name of files) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), `candidate bytes of ${name}\r\nsecond line\n`);
  }
  mkdirSync(cacheRoot);
  const blobs = Object.fromEntries(OWNERS.map(name => [name, Buffer.from(`reference bytes of ${name}\n`)]));
  const contract = { ...paired.PAIRED_CONTRACT, referenceOwners: Object.fromEntries(OWNERS.map(name =>
    [name, { blob: blobId(blobs[name]), sha256: sha256(blobs[name]) }])) };
  const registered = { type: 'registered', kind: 'smoke', nonce: NONCE(5), identity: IDENTITY };
  return { base, root, cacheRoot, files, blobs, contract, registered,
    options: extra => ({ root, cacheRoot, files, contract, readOwnerBlob: name => blobs[name], ...extra }),
    remove: () => rmSync(base, { recursive: true, force: true }) };
}

test('gitBlobId is the git object id of the bytes, so an owner is checked against its pinned blob id', () => {
  assert.equal(paired.gitBlobId(Buffer.from('')), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  assert.equal(paired.gitBlobId(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
});

test('materializeArms copies both arms byte for byte, replaces exactly the five owners and reports five differing files', () => {
  const fixture = armFixture();
  try {
    const result = paired.materializeArms(fixture.registered, fixture.options());
    assert.equal(result.difference.comparedFiles, fixture.files.length);
    assert.equal(result.difference.count, 5);
    assert.deepEqual(result.difference.differingFiles, [...OWNERS].sort());
    assert.equal(result.difference.onlyOwnersDiffer, true);
    for (const directory of [result.sessionDirectory, result.arms.reference, result.arms.candidate]) {
      const relative = path.relative(fixture.cacheRoot, directory);
      assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), directory);
    }
    for (const name of fixture.files) {
      const source = readFileSync(path.join(fixture.root, name));
      assert.deepEqual(readFileSync(path.join(result.arms.candidate, name)), source, name);
      assert.deepEqual(readFileSync(path.join(result.arms.reference, name)),
        OWNERS.includes(name) ? fixture.blobs[name] : source, name);
    }
    // One registration owns one session directory: a second materialisation is refused.
    assert.throws(() => paired.materializeArms(fixture.registered, fixture.options()), /already exists/i);
  } finally { fixture.remove(); }
});

test('materializeArms refuses a wrong owner blob, any other difference between the arms, fewer than five differing owners and a path outside the cache', () => {
  for (const [label, extra, pattern, mutate] of [
    ['owner bytes that do not match the pinned SHA-256 and blob id', { readOwnerBlob: name => Buffer.from('other ' + name) },
      /src\/builders\/characterResources\.js/],
    ['a copy that differs outside the owners', { copy: (from, to) => writeFileSync(to,
      to.includes('reference') && from.endsWith('main.js') ? 'altered' : readFileSync(from)) }, /src\/main\.js/],
    ['an owner that does not differ', {}, /five owner files/i, fixture => {
      writeFileSync(path.join(fixture.root, OWNERS[0]), fixture.blobs[OWNERS[0]]); }],
    ['a file path that leaves the tree', {}, /escapes|outside/i, fixture => { fixture.files.push('../outside.js'); }],
    ['an owner missing from the file list', {}, /owner/i, fixture => {
      fixture.files.splice(fixture.files.indexOf(OWNERS[4]), 1); }],
  ]) {
    const fixture = armFixture();
    try {
      mutate?.(fixture);
      assert.throws(() => paired.materializeArms(fixture.registered, fixture.options(extra)), pattern, label);
      // A refused materialisation leaves no arm behind.
      assert.equal(existsSync(path.join(fixture.cacheRoot, 'session-' + NONCE(5))), false, label);
    } finally { fixture.remove(); }
  }
});

// ---- smoke: load and structure facts only ---------------------------------------------------

function viewEvidence(actorCount = 1) {
  return { attached: true, allocatedBoneTextures: 2, draws: { arms: 4, body: 4, weapon: 2 }, selectedVisibleMeshes: [3, 2],
    sourceActorCount: actorCount, proxyEntityCount: 1, cameraColocatedXZ: true, fov: 75, cameraPitch: -1.3, cameraYaw: Math.PI,
    sourceScale: [1, 1, 1], cameraEye: [4, 1.65, 6], sourceRoot: [4, 0, 6], eyeHeight: 1.65, drawCalls: 40 };
}
const MARK = 7654.321987;
function smokeSample(identities, actorCount = 1) {
  const resources = { geometries: 140, textures: 12, programs: 9 };
  return { run: 1, tier: 'low', actorCount, browser: '147.0.0.0', sourceIdentitySha256: sha256(JSON.stringify(identities)),
    renderScope: 'source-eye-down-view-replaces-source-0', gpu: 'SwiftShader', renderer: 'WebKit WebGL',
    transitions: ['idle', 'walk', 'idle'], viewport: [1280, 960], dpr: 1, frameCount: 214, warmupFrames: 12,
    simulationStepSeconds: 1 / 20, human: true, packedMaps: 2, keeperIntact: true, restored: true, sharedDisposals: 0,
    movingPoseCount: 60, durationMs: MARK, resourceSamples: Array.from({ length: 8 }, () => ({ ...resources })),
    afterRetirement: { listeners: 0, callbacks: 0, props: 0, actors: 0, activeBindings: 0, resources: { ...resources } },
    ownership: { sharedGeometries: 3 },
    timings: Object.fromEntries(COMPONENTS.map(name => [name, { median: MARK, p95: MARK + 1, min: MARK - 1, max: MARK + 2 }])),
    viewEvidence: viewEvidence(actorCount),
    sequence: [0, 100, 180].map(frame => ({ frame, clip: 'idle', simulationTime: frame / 20, viewEvidence: viewEvidence(actorCount),
      image: 'data:image/png;base64,AAAA', sha256: HEX('7') })) };
}
function smokeInput(mutate) {
  const candidateIdentities = { 'src/main.js': HEX('1'), captureSampler: paired.FROZEN_SAMPLER };
  for (const [index, name] of OWNERS.entries()) candidateIdentities[name] = HEX(String(index + 2));
  const referenceIdentities = { ...candidateIdentities };
  for (const name of OWNERS) referenceIdentities[name] = paired.PAIRED_CONTRACT.referenceOwners?.[name]?.sha256;
  const input = { nonce: NONCE(1), identity: IDENTITY, commit: COMMIT, registrationEventHash: HEX('3'), startedEventHash: HEX('4'),
    browserVersion: '147.0.0.0', host: { before: { note: 'before' }, after: { note: 'after' } }, error: null,
    difference: { comparedFiles: 139, differingFiles: [...OWNERS].sort(), count: 5, onlyOwnersDiffer: true },
    arms: { reference: { identities: referenceIdentities, pageErrors: [], sample: smokeSample(referenceIdentities) },
      candidate: { identities: candidateIdentities, pageErrors: [], sample: smokeSample(candidateIdentities) } } };
  mutate?.(input);
  return input;
}

test('requiredSampleFields names what a sample lacks of the fields qualify requires', () => {
  const identities = { captureSampler: HEX('5') };
  assert.deepEqual(paired.requiredSampleFields(smokeSample(identities)), []);
  for (const [label, mutate] of [
    ['timings.viewMs.p95', sample => { delete sample.timings.viewMs.p95; }],
    ['frameCount', sample => { sample.frameCount = 213; }],
    ['renderScope', sample => { sample.renderScope = 'external-third-person-core'; }],
    ['viewEvidence', sample => { sample.viewEvidence = null; }],
    ['sequence', sample => { sample.sequence.pop(); }],
    ['afterRetirement.listeners', sample => { sample.afterRetirement.listeners = 1; }],
    ['resourceSamples', sample => { sample.resourceSamples[6].textures += 1; }],
    ['failure', sample => { sample.failure = 'Injected animation capture failure'; }],
    ['sharedDisposals', sample => { sample.sharedDisposals = 1; }],
  ]) {
    const sample = smokeSample(identities); mutate(sample);
    const problems = paired.requiredSampleFields(sample);
    assert.ok(Array.isArray(problems) && problems.some(problem => problem.includes(label)), `${label}: ${JSON.stringify(problems)}`);
  }
  assert.ok(paired.requiredSampleFields(undefined).length > 0);
});

test('a smoke report holds load and structure facts only: no timing value, no comparison and never complete', () => {
  const report = paired.smokeReport(smokeInput());
  const text = JSON.stringify(report);
  assert.equal(report.kind, 'smoke');
  assert.equal(report.complete, false);
  assert.equal(report.contractVersion, 'paired-same-session-v2');
  assert.equal(report.nonce, NONCE(1));
  assert.deepEqual([report.registrationEventHash, report.startedEventHash], [HEX('3'), HEX('4')]);
  assert.deepEqual(report.contract, { v2Sha256: paired.PAIRED_CONTRACT.v2Sha256,
    decisionSha256: paired.PAIRED_CONTRACT.decisionSha256, v2ReviewSha256: paired.PAIRED_CONTRACT.v2ReviewSha256 });
  assert.equal(report.referencePageErrors, 0);
  assert.equal(report.candidatePageErrors, 0);
  assert.equal(report.structuralFailure, false);
  assert.deepEqual(report.captureSampler, { reference: paired.FROZEN_SAMPLER, candidate: paired.FROZEN_SAMPLER,
    frozen: paired.FROZEN_SAMPLER, equal: true });
  assert.deepEqual(report.frameCounts.reference, { timedFrames: 214, pixelFrames: 3 });
  assert.equal(report.armDifference.count, 5);
  assert.deepEqual(report.settings, paired.SESSION_SETTINGS);
  assert.ok(report.settings.contextAndPageLifetime && report.settings.launch && report.settings.samplerArguments);
  assert.equal(report.browserVersion, '147.0.0.0');
  assert.equal(report.certification, false);
  // No timing value of either arm, no timing block, no duration and no comparison reaches the report.
  for (const forbidden of ['"timings"', '"ratio"', '"durationMs"', '"median"', '"p95"', '7654', '7655', '7653', '7656'])
    assert.equal(text.includes(forbidden), false, forbidden);
});

test('a smoke report marks a reference-arm page error, a sampler mismatch, a missing sample field or an arm difference as a structural failure', () => {
  for (const [label, mutate] of [
    ['reference page error', input => { input.arms.reference.pageErrors.push('SyntaxError: no export named x'); }],
    ['candidate page error', input => { input.arms.candidate.pageErrors.push('TypeError'); }],
    ['sampler mismatch', input => { input.arms.reference.identities.captureSampler = HEX('8'); }],
    ['sampler not the frozen one', input => { for (const arm of ['reference', 'candidate']) input.arms[arm].identities.captureSampler = HEX('8'); }],
    ['missing reference sample', input => { delete input.arms.reference.sample; }],
    ['reference sample lacks a field', input => { delete input.arms.reference.sample.viewEvidence; }],
    ['arm difference outside the owners', input => { input.difference = { comparedFiles: 139, differingFiles: ['src/main.js'], count: 1, onlyOwnersDiffer: false }; }],
    ['reference owner identity not pinned', input => { input.arms.reference.identities[OWNERS[2]] = HEX('6'); }],
    ['identity differs outside the owners', input => { input.arms.reference.identities['src/main.js'] = HEX('6'); }],
    ['capture error', input => { input.error = 'Animation sample exceeded 180 seconds'; }],
  ]) {
    const report = paired.smokeReport(smokeInput(mutate));
    assert.equal(report.structuralFailure, true, label);
    assert.equal(report.complete, false, label);
    assert.equal(JSON.stringify(report).includes('7654'), false, label);
  }
  assert.equal(paired.smokeReport(smokeInput(input => { input.arms.reference.pageErrors.push('a', 'b'); })).referencePageErrors, 2);
  assert.equal(paired.smokeReport(smokeInput(input => { input.error = 'load failed'; })).error, 'load failed');
});

// =============================================================================================
// Task 07-16-02: the approved predicate, validity, binding and the verify command
// =============================================================================================

const Q = 0.1, EPS = 1e-7;
const PROFILES = [];
for (const run of [1, 2]) for (const tier of TIERS) for (const actorCount of ACTORS) PROFILES.push({ run, tier, actorCount });
const sameProfile = profile => sample => sample.run === profile.run && sample.tier === profile.tier && sample.actorCount === profile.actorCount;
const firstArm = profile => paired.orderFor(profile.run, TIERS.indexOf(profile.tier), ACTORS.indexOf(profile.actorCount)) === 'reference-first'
  ? 'reference' : 'candidate';
function scale(session, arm, predicate, factor, components = COMPONENTS) {
  for (const sample of session.arms[arm].report.samples) if (predicate(sample))
    for (const name of components) for (const stat of ['median', 'p95']) sample.timings[name][stat] *= factor;
}
function setValue(session, arm, profile, component, stat, value) {
  session.arms[arm].report.samples.find(sameProfile(profile)).timings[component][stat] = value;
}
function groupOf(result, group, component, stat) {
  const found = result.rule2?.groups?.find(entry => entry.group === group && entry.component === component && entry.stat === stat);
  assert.ok(found, `no rule 2 result for ${group} ${component} ${stat}`);
  return found;
}
function failedGroups(result, component = 'frameIntervalMs', stat = 'median') {
  assert.ok(Array.isArray(result.rule2?.violations), 'no rule 2 violation list');
  return result.rule2?.violations.filter(entry => entry.component === component && entry.stat === stat).map(entry => entry.group).sort();
}
const evaluate = mutate => paired.evaluatePaired(plainSession(mutate), paired.PAIRED_CONTRACT);
const upperMedian = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const GROUPS = { all: () => true, 'actors-1': profile => profile.actorCount === 1, 'actors-8': profile => profile.actorCount === 8,
  'tier-low': profile => profile.tier === 'low', 'tier-medium': profile => profile.tier === 'medium', 'tier-high': profile => profile.tier === 'high' };

// ---- rule 2 ------------------------------------------------------------------------------------

test('rule 2, cell form: six groups, each judged by sorted[floor(n/2)] over its cell ratios (4th of 6, 2nd of 3, larger of 2)', () => {
  const factor = { 'low/1': 1, 'low/8': 1.01, 'medium/1': 1.02, 'medium/8': 1.03, 'high/1': 1.04, 'high/8': 1.045 };
  const result = evaluate(session => {
    for (const sample of session.arms.candidate.report.samples)
      sample.timings.frameIntervalMs.median = 250 * factor[`${sample.tier}/${sample.actorCount}`];
  });
  const ratio = key => (250 * factor[key] - Q - EPS) / 250;
  assert.equal(result.rule2?.groups.length, 6 * 8 * 2);
  for (const [group, key, cells] of [['all', 'medium/8', 6], ['actors-1', 'medium/1', 3], ['actors-8', 'medium/8', 3],
    ['tier-low', 'low/8', 2], ['tier-medium', 'medium/8', 2], ['tier-high', 'high/8', 2]]) {
    const entry = groupOf(result, group, 'frameIntervalMs', 'median');
    assert.equal(entry.aggregate, ratio(key), group);
    assert.equal(entry.cells.length, cells, group);
    assert.equal(entry.status, 'pass', group);
    assert.equal(entry.usableProfiles, cells * 2, group);
  }
  const cell = groupOf(result, 'all', 'frameIntervalMs', 'median').cells.find(entry => entry.tier === 'high' && entry.actorCount === 1);
  assert.deepEqual([cell.ratio, cell.usableProfiles], [ratio('high/1'), 2]);
  assert.deepEqual(result.rule2?.violations, []);
  assert.equal(result.pairedBudgetPass, true);
});

test('a second-capture slowdown of 8% with no code difference passes rule 2', () => {
  const session = plainSession(mutated => {
    for (const profile of PROFILES) scale(mutated, firstArm(profile) === 'reference' ? 'candidate' : 'reference', sameProfile(profile), 1.08);
  });
  const result = paired.evaluatePaired(session, paired.PAIRED_CONTRACT);
  assert.deepEqual(result.rule1.violations, []);
  assert.deepEqual(result.rule2?.violations, []);
  assert.equal(result.pairedBudgetPass, true);
  for (const group of Object.keys(GROUPS)) {
    const entry = groupOf(result, group, 'frameIntervalMs', 'median');
    assert.ok(entry.aggregate > 1 && entry.aggregate < 1.004, `${group}: ${entry.aggregate}`);
  }
  // The same median over the 12 profile ratios would sit near 1.08 and fail the session.
  const profileRatios = PROFILES.map(profile => (sampleOf(session, 'candidate', profile.run, profile.tier, profile.actorCount)
    .timings.frameIntervalMs.median - Q - EPS) / sampleOf(session, 'reference', profile.run, profile.tier, profile.actorCount)
    .timings.frameIntervalMs.median);
  assert.ok(upperMedian(profileRatios) > 1.05);
});

test('with no order effect rule 2 equals the profile median: the same median over the 12 profile ratios, for every pattern tried', () => {
  let seed = 20261010, compared = 0, failing = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let pattern = 0; pattern < 250; pattern++) {
    const base = {}, factor = {};
    for (const tier of TIERS) for (const actorCount of ACTORS) {
      base[`${tier}/${actorCount}`] = 200 + 150 * random(); factor[`${tier}/${actorCount}`] = 0.85 + 0.5 * random();
    }
    const session = plainSession(mutated => {
      for (const arm of ['reference', 'candidate']) for (const sample of mutated.arms[arm].report.samples) {
        const key = `${sample.tier}/${sample.actorCount}`;
        sample.timings.frameIntervalMs.median = arm === 'reference' ? base[key] : base[key] * factor[key];
      }
    });
    const result = paired.evaluatePaired(session, paired.PAIRED_CONTRACT);
    for (const [group, belongs] of Object.entries(GROUPS)) {
      const ratios = PROFILES.filter(belongs).map(profile => {
        const key = `${profile.tier}/${profile.actorCount}`;
        return (base[key] * factor[key] - Q - EPS) / base[key];
      });
      const entry = groupOf(result, group, 'frameIntervalMs', 'median');
      assert.equal(entry.aggregate, upperMedian(ratios), `pattern ${pattern} ${group}`);
      assert.equal(entry.status, upperMedian(ratios) > 1.05 ? 'fail' : 'pass', `pattern ${pattern} ${group}`);
      compared++; if (entry.status === 'fail') failing++;
    }
  }
  assert.equal(compared, 1500);
  assert.ok(failing > 100 && failing < 1400, `both outcomes occur: ${failing}`);
});

test('a 20% increase in the six one-actor profiles fails: one actor count regression fails rule 2', () => {
  const result = evaluate(session => scale(session, 'candidate', sample => sample.actorCount === 1, 1.2, ['frameIntervalMs']));
  assert.deepEqual(result.rule1.violations, []);
  assert.deepEqual(failedGroups(result), ['actors-1', 'all', 'tier-high', 'tier-low', 'tier-medium']);
  assert.equal(groupOf(result, 'actors-8', 'frameIntervalMs', 'median').status, 'pass');
  assert.equal(result.pairedBudgetPass, false);
});

test('a 20% increase in the four profiles of one tier fails: one tier regression fails rule 2 and no other group excuses it', () => {
  const result = evaluate(session => scale(session, 'candidate', sample => sample.tier === 'high', 1.2, ['frameIntervalMs']));
  assert.deepEqual(result.rule1.violations, []);
  assert.deepEqual(failedGroups(result), ['tier-high']);
  assert.deepEqual(failedGroups(result, 'frameIntervalMs', 'p95'), ['tier-high']);
  for (const group of ['all', 'actors-1', 'actors-8']) assert.equal(groupOf(result, group, 'frameIntervalMs', 'median').status, 'pass', group);
  assert.equal(result.pairedBudgetPass, false);
});

test('a 20% increase in both runs of one cell fails in its tier group: one cell regression fails rule 2', () => {
  const result = evaluate(session => scale(session, 'candidate', sample => sample.tier === 'medium' && sample.actorCount === 8, 1.2,
    ['frameIntervalMs']));
  assert.deepEqual(result.rule1.violations, []);
  assert.deepEqual(failedGroups(result), ['tier-medium']);
  assert.equal(groupOf(result, 'tier-medium', 'frameIntervalMs', 'median').aggregate, (250 * 1.2 - Q - EPS) / 250);
  assert.equal(result.pairedBudgetPass, false);
});

test('an 8% eight-actor improvement beside an 8% one-actor regression fails: improvement beside regression fails rule 2', () => {
  const result = evaluate(session => {
    scale(session, 'candidate', sample => sample.actorCount === 8, 0.92, ['frameIntervalMs']);
    scale(session, 'candidate', sample => sample.actorCount === 1, 1.08, ['frameIntervalMs']);
  });
  assert.deepEqual(result.rule1.violations, []);
  assert.ok(failedGroups(result).includes('actors-1'));
  assert.equal(groupOf(result, 'actors-8', 'frameIntervalMs', 'median').status, 'pass');
  assert.equal(result.pairedBudgetPass, false);
});

test('a uniform 3% increase passes rule 2 and a uniform 8% increase on the frame interval fails it in every group', () => {
  const three = evaluate(session => scale(session, 'candidate', () => true, 1.03));
  assert.deepEqual(three.rule2?.violations, []);
  assert.equal(three.pairedBudgetPass, true);
  const eight = evaluate(session => scale(session, 'candidate', () => true, 1.08, ['frameIntervalMs']));
  assert.deepEqual(eight.rule1.violations, []);
  assert.deepEqual(failedGroups(eight), Object.keys(GROUPS).sort());
  assert.deepEqual(failedGroups(eight, 'frameIntervalMs', 'p95'), Object.keys(GROUPS).sort());
  assert.equal(eight.pairedBudgetPass, false);
});

test('a cell with one usable profile uses that profile\'s ratio', () => {
  const low1 = run => ({ run, tier: 'low', actorCount: 1 });
  const result = evaluate(session => {
    setValue(session, 'reference', low1(1), 'mixerMs', 'median', 0);
    setValue(session, 'candidate', low1(1), 'mixerMs', 'median', 0.1);
    setValue(session, 'reference', low1(2), 'mixerMs', 'median', 0.3);
    setValue(session, 'candidate', low1(2), 'mixerMs', 'median', 0.45);
  });
  const group = groupOf(result, 'tier-low', 'mixerMs', 'median');
  const cell = group.cells.find(entry => entry.tier === 'low' && entry.actorCount === 1);
  assert.equal(cell.usableProfiles, 1);
  assert.equal(cell.ratio, (0.45 - Q - EPS) / 0.3);
  assert.equal(group.usableProfiles, 3);
  assert.equal(group.aggregate, (0.45 - Q - EPS) / 0.3);
  assert.equal(group.status, 'fail');
  assert.deepEqual(result.rule1.violations, []);
});

test('a group with fewer than 3 usable profiles is rule-1-only: it neither passes nor fails rule 2', () => {
  // The inertia median is 0 in every reference profile: no group has an aggregate for it.
  const zero = evaluate();
  for (const group of Object.keys(GROUPS)) {
    const entry = groupOf(zero, group, 'inertiaMs', 'median');
    assert.deepEqual([entry.status, entry.aggregate, entry.usableProfiles], ['rule-1-only', null, 0], group);
  }
  // Two usable profiles in one tier: its one cell ratio (1.225) is above the limit, and is not judged.
  const result = evaluate(session => {
    for (const run of [1, 2]) {
      setValue(session, 'reference', { run, tier: 'low', actorCount: 8 }, 'mixerMs', 'median', 0);
      setValue(session, 'candidate', { run, tier: 'low', actorCount: 8 }, 'mixerMs', 'median', 0);
      setValue(session, 'reference', { run, tier: 'low', actorCount: 1 }, 'mixerMs', 'median', 0.4);
      setValue(session, 'candidate', { run, tier: 'low', actorCount: 1 }, 'mixerMs', 'median', 0.59);
    }
  });
  const low = groupOf(result, 'tier-low', 'mixerMs', 'median');
  assert.deepEqual([low.status, low.aggregate, low.usableProfiles], ['rule-1-only', null, 2]);
  assert.equal(low.cells.find(entry => entry.actorCount === 1).ratio, (0.59 - Q - EPS) / 0.4);
  assert.deepEqual(result.rule2?.violations, []);
  assert.deepEqual(result.rule1.violations, []);
  assert.equal(groupOf(result, 'all', 'mixerMs', 'median').status, 'pass');
  assert.equal(result.pairedBudgetPass, true);
  // Rule 1 alone still applies there.
  const over = evaluate(session => {
    for (const run of [1, 2]) setValue(session, 'reference', { run, tier: 'low', actorCount: 8 }, 'mixerMs', 'median', 0);
    setValue(session, 'candidate', { run: 1, tier: 'low', actorCount: 8 }, 'mixerMs', 'median', 0.2);
  });
  assert.equal(over.rule1.violations.length, 1);
  assert.equal(over.pairedBudgetPass, false);
});

test('zero and one-step behaviour with the allowance: one timer step over a zero passes and two fail, and a step stored just above or below 0.1 is treated alike', () => {
  const ABOVE = 0.10000000894069672, BELOW = 0.09999999962747097, profile = { run: 1, tier: 'low', actorCount: 1 };
  const rule1 = (r, c) => evaluate(session => {
    setValue(session, 'reference', profile, 'inertiaMs', 'median', r);
    setValue(session, 'candidate', profile, 'inertiaMs', 'median', c);
  }).rule1.violations.length;
  for (const step of [ABOVE, BELOW, 0.1]) {
    assert.equal(rule1(0, step), 0, `r 0, c ${step}`);
    assert.equal(rule1(0, 2 * step), 1, `r 0, c ${2 * step}`);
    assert.equal(rule1(step, 2 * step), 0, `r ${step}, c two steps`);
    assert.equal(rule1(step, 3 * step), 1, `r ${step}, c three steps`);
  }
  // Rule 2: a reference value at or below the allowance counts as 0 and is left out.
  for (const reference of [0, 5e-8, EPS]) {
    const result = evaluate(session => setValue(session, 'reference', profile, 'mixerMs', 'median', reference));
    const cell = groupOf(result, 'tier-low', 'mixerMs', 'median').cells.find(entry => entry.actorCount === 1);
    assert.equal(cell.usableProfiles, 1, `r ${reference}`);
  }
  const statuses = [ABOVE, BELOW].map(step => {
    const result = evaluate(session => {
      for (const sample of session.arms.reference.report.samples) sample.timings.mixerMs.median = step;
      for (const sample of session.arms.candidate.report.samples) sample.timings.mixerMs.median = 2 * step;
    });
    const entry = groupOf(result, 'all', 'mixerMs', 'median');
    assert.ok(entry.aggregate > 0.99 && entry.aggregate < 1.01, String(entry.aggregate));
    return [entry.status, result.rule1.violations.length];
  });
  assert.deepEqual(statuses, [['pass', 0], ['pass', 0]]);
});

test('the evaluation reports the tolerance actually applied to each component: 25% and 5% only for the frame interval', () => {
  const applied = evaluate().tolerances?.applied;
  assert.ok(applied, 'no applied tolerances');
  assert.deepEqual(Object.keys(applied).sort(), [...COMPONENTS].sort());
  const frame = applied.frameIntervalMs.median, view = applied.viewMs.median, inertia = applied.inertiaMs.median;
  assert.deepEqual([frame.referenceMinMs, frame.referenceMaxMs], [250, 250]);
  assert.ok(Math.abs(frame.rule1.effectiveToleranceAtMin - (0.25 + 0.1 / 250)) < 1e-12);
  assert.ok(Math.abs(frame.rule2.effectiveToleranceAtMin - (0.05 + 0.1 / 250)) < 1e-12);
  assert.ok(Math.abs(view.rule1.effectiveToleranceAtMin - 0.5) < 1e-12);
  assert.ok(Math.abs(view.rule2.effectiveToleranceAtMin - 0.3) < 1e-12);
  assert.deepEqual([inertia.rule1.allowedAtMinMs, inertia.rule1.effectiveToleranceAtMin, inertia.rule2.effectiveToleranceAtMin], [0.1, null, null]);
});

// ---- sessions: fixtures ----------------------------------------------------------------------------

const EVIDENCE = '.planning/phases/07-movement-matched-and-action-safe-animation/evidence/';
// A complete report the frozen tool's `qualify` accepts. Read as JSON, so its checkout line endings do not matter.
const frozenReference = JSON.parse(readFileSync(path.join(ROOT, EVIDENCE, '07-09-view-reference-v2.json'), 'utf8'));
const SESSION_NONCE = NONCE(21), CALIBRATION_NONCE = NONCE(20), T0 = Date.parse('2026-10-11T08:00:00.000Z');
const baseTimings = () => Object.fromEntries(COMPONENTS.map(name =>
  [name, { median: BASE[name][0], p95: BASE[name][1], min: 0, max: BASE[name][1] * 2 }]));
const bytesOf = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const settings = () => structuredClone(paired.SESSION_SETTINGS);

function armReport(arm, kind) {
  const report = structuredClone(frozenReference), referenceTree = arm === 'reference' || kind === 'calibration';
  for (const [index, name] of OWNERS.entries())
    report.identities[name] = referenceTree ? paired.PAIRED_CONTRACT.referenceOwners?.[name]?.sha256 ?? HEX('0') : HEX(String(index + 1));
  const identity = sha256(JSON.stringify(report.identities));
  for (const sample of report.samples) { sample.sourceIdentitySha256 = identity; sample.timings = baseTimings(); }
  report.capturedAt = new Date(T0 + 600000).toISOString();
  report.paired = { contractVersion: 'paired-same-session-v2', nonce: SESSION_NONCE, arm, kind, captures: [],
    warmup: { warmup: true, run: 1, tier: 'low', actorCount: 1, timings: baseTimings() } };
  return report;
}

// A session as the runner holds it in memory just before it computes validity.
function fixture(kind = 'qualifying', mutate) {
  let time = T0;
  const now = () => new Date(time += 1000).toISOString();
  let registry = paired.emptyRegistry();
  if (kind === 'qualifying') {
    registry = paired.appendEvent(registry, { type: 'registered', kind: 'calibration', nonce: CALIBRATION_NONCE, identity: IDENTITY }, now);
    registry = paired.appendEvent(registry, { type: 'started', kind: 'calibration', nonce: CALIBRATION_NONCE }, now);
    registry = paired.appendEvent(registry, { type: 'closed', kind: 'calibration', nonce: CALIBRATION_NONCE, valid: true, pass: true,
      settings: settings(), browserVersion: '147.0.0.0', reportHashes: { session: HEX('1'), reference: HEX('2'), candidate: HEX('3') } }, now);
  }
  registry = paired.appendEvent(registry, { type: 'registered', kind, nonce: SESSION_NONCE, identity: IDENTITY, commit: COMMIT }, now);
  const registrationEventHash = paired.eventHash(registry.events.at(-1));
  registry = paired.appendEvent(registry, { type: 'started', kind, nonce: SESSION_NONCE, registrationHash: registrationEventHash }, now);
  const startedEventHash = paired.eventHash(registry.events.at(-1));
  const reports = { reference: armReport('reference', kind), candidate: armReport('candidate', kind) };
  time += 5000;
  for (const entry of paired.sessionScheme())
    for (const arm of entry.first === 'reference-first' ? ['reference', 'candidate'] : ['candidate', 'reference']) {
      reports[arm].paired.captures.push({ warmup: entry.warmup, run: entry.run, tier: entry.tier, actorCount: entry.actorCount,
        startedAt: new Date(time).toISOString(), endedAt: new Date(time + 9000).toISOString() });
      time += 10000;
    }
  const session = { kind, nonce: SESSION_NONCE, identity: IDENTITY, order: paired.sessionScheme(), settings: settings(),
    browserVersion: '147.0.0.0', arms: { reference: { report: reports.reference }, candidate: { report: reports.candidate } },
    structural: { frameImages: { reference: { ok: true }, candidate: { ok: true } },
      ...(kind === 'qualifying' ? { frozen: { resultPrinted: true, exitCode: 1, overrunCount: 40, applicableBudgetPass: false } } : {}) } };
  const built = { kind, session, registry, registrationEventHash, startedEventHash, closedAt: new Date(time + 30000).toISOString() };
  mutate?.(built);
  return built;
}
// Hashes, binding and validity, in the order the tool computes them.
function seal(built, known = []) {
  for (const arm of ['reference', 'candidate']) built.session.arms[arm].sha256 = sha256(bytesOf(built.session.arms[arm].report));
  built.session.binding = paired.bindingCheck(built.session, known, built.registry);
  built.session.validity = paired.sessionValidity(built.session, paired.PAIRED_CONTRACT, paired.calibrationFor(built.registry, IDENTITY));
  return built;
}
const validityOf = (kind, mutate) => seal(fixture(kind, mutate)).session.validity;
const reasonsOf = validity => (validity.reasons ?? []).join(' | ');
const captureOf = (built, arm, index) => built.session.arms[arm].report.paired.captures[index];

// ---- validity and binding -----------------------------------------------------------------------------

test('a complete session in the scheme order is valid: every validity check holds for a qualifying session and for a calibration', () => {
  assert.equal(paired.sessionScheme().length, 13);
  assert.deepEqual(paired.sessionScheme()[0], { warmup: true, run: 1, tier: 'low', actorCount: 1, first: 'reference-first' });
  assert.deepEqual(paired.sessionScheme().slice(1).map(entry => `${entry.run}/${entry.tier}/${entry.actorCount}`),
    PROFILES.map(profile => `${profile.run}/${profile.tier}/${profile.actorCount}`));
  for (const kind of ['qualifying', 'calibration']) {
    const built = seal(fixture(kind));
    assert.deepEqual(built.session.binding, { ok: true, reasons: [] }, kind);
    assert.equal(built.session.validity.valid, true, kind + ': ' + reasonsOf(built.session.validity));
    assert.deepEqual(Object.keys(built.session.validity.checks).sort(),
      ['binding', 'complete', 'grossInstability', 'order', 'ratioAgreement', 'settings', 'structure'], kind);
    for (const [name, check] of Object.entries(built.session.validity.checks)) assert.equal(check.ok, true, `${kind} ${name}`);
  }
});

test('order mismatch invalid: a session whose recorded per-profile order differs from orderFor in any cell is invalid', () => {
  for (const index of [0, 1, 6, 12]) {
    const validity = validityOf('qualifying', built => {
      const entry = built.session.order[index];
      entry.first = entry.first === 'reference-first' ? 'candidate-first' : 'reference-first';
    });
    assert.equal(validity.valid, false, `pair ${index}`);
    assert.equal(validity.checks.order.ok, false, `pair ${index}`);
  }
  const swapped = validityOf('qualifying', built => {
    [built.session.order[3], built.session.order[4]] = [built.session.order[4], built.session.order[3]];
  });
  assert.equal(swapped.checks.order.ok, false);
  assert.equal(swapped.valid, false);
});

test('missing nonce: an arm report with no nonce is rejected and the session is invalid', () => {
  for (const arm of ['reference', 'candidate']) {
    const built = seal(fixture('qualifying', made => { delete made.session.arms[arm].report.paired.nonce; }));
    assert.equal(built.session.binding.ok, false, arm);
    assert.match(built.session.binding.reasons.join(' | '), /no nonce/, arm);
    assert.equal(built.session.validity.checks.binding.ok, false, arm);
    assert.equal(built.session.validity.valid, false, arm);
  }
  const noBlock = seal(fixture('qualifying', made => { delete made.session.arms.candidate.report.paired; }));
  assert.match(noBlock.session.binding.reasons.join(' | '), /no nonce/);
});

test('foreign nonce: an arm report with a nonce other than the session\'s is rejected', () => {
  const built = seal(fixture('qualifying', made => { made.session.arms.reference.report.paired.nonce = NONCE(99); }));
  assert.equal(built.session.binding.ok, false);
  assert.match(built.session.binding.reasons.join(' | '), /another nonce/);
  assert.equal(built.session.validity.valid, false);
});

test('non-interleaved times: capture times that do not interleave with the other arm\'s as the scheme requires are rejected', () => {
  // One pair captured in the opposite arm order.
  const reversed = seal(fixture('qualifying', made => {
    const a = captureOf(made, 'reference', 4), b = captureOf(made, 'candidate', 4);
    [a.startedAt, a.endedAt, b.startedAt, b.endedAt] = [b.startedAt, b.endedAt, a.startedAt, a.endedAt];
  }));
  assert.equal(reversed.session.binding.ok, false);
  assert.match(reversed.session.binding.reasons.join(' | '), /interleave/);
  assert.equal(reversed.session.validity.valid, false);
  // One arm captured completely before the other: two single-arm runs, not a paired session.
  const sequential = seal(fixture('qualifying', made => {
    let time = Date.parse(captureOf(made, 'reference', 0).startedAt);
    for (const arm of ['reference', 'candidate']) for (const capture of made.session.arms[arm].report.paired.captures) {
      capture.startedAt = new Date(time).toISOString(); capture.endedAt = new Date(time + 9000).toISOString(); time += 10000;
    }
  }));
  assert.match(sequential.session.binding.reasons.join(' | '), /interleave/);
  // A capture with no time at all.
  const missing = seal(fixture('qualifying', made => { delete captureOf(made, 'candidate', 7).endedAt; }));
  assert.equal(missing.session.binding.ok, false);
});

test('overlapping captures: two captures that overlap in time are rejected', () => {
  const built = seal(fixture('qualifying', made => {
    const scheme = paired.sessionScheme()[5], second = scheme.first === 'reference-first' ? 'candidate' : 'reference';
    const first = second === 'candidate' ? 'reference' : 'candidate';
    captureOf(made, second, 5).startedAt = new Date(Date.parse(captureOf(made, first, 5).endedAt) - 1000).toISOString();
  }));
  assert.equal(built.session.binding.ok, false);
  assert.match(built.session.binding.reasons.join(' | '), /overlap/);
  assert.equal(built.session.validity.valid, false);
});

test('a capture time outside started and closed: before the session\'s started event or after its closed event is rejected', () => {
  const early = seal(fixture('qualifying', made => {
    const started = made.registry.events.at(-1);
    captureOf(made, 'reference', 0).startedAt = new Date(Date.parse(started.at) - 1000).toISOString();
  }));
  assert.equal(early.session.binding.ok, false);
  assert.match(early.session.binding.reasons.join(' | '), /before the started event/);
  assert.equal(early.session.validity.valid, false);
  // After close: the registry holds the session's closed event.
  const built = seal(fixture('qualifying'));
  const closed = paired.appendEvent(built.registry, { type: 'closed', kind: 'qualifying', nonce: SESSION_NONCE, at: built.closedAt });
  assert.equal(paired.bindingCheck(built.session, [], closed).ok, true);
  const last = paired.sessionScheme().at(-1).first === 'reference-first' ? 'candidate' : 'reference';
  captureOf(built, last, 12).endedAt = new Date(Date.parse(built.closedAt) + 1000).toISOString();
  const late = paired.bindingCheck(built.session, [], closed);
  assert.equal(late.ok, false);
  assert.match(late.reasons.join(' | '), /after the closed event/);
  // A session with no started event in the registry has nothing to bind to.
  const unstarted = fixture('qualifying');
  unstarted.registry = { ...unstarted.registry, events: unstarted.registry.events.slice(0, -1) };
  assert.match(seal(unstarted).session.binding.reasons.join(' | '), /no started event/);
});

test('an arm report equal in hash to the frozen reference report, to an earlier session\'s arm or to the other arm is rejected', () => {
  const known = seal(fixture('qualifying'));
  const hash = known.session.arms.candidate.sha256;
  const listed = paired.bindingCheck(known.session, [HEX('5'), hash], known.registry);
  assert.equal(listed.ok, false);
  assert.match(listed.reasons.join(' | '), /existing report/);
  const sameArm = seal(fixture('qualifying'));
  sameArm.session.arms.candidate.sha256 = sameArm.session.arms.reference.sha256;
  assert.match(paired.bindingCheck(sameArm.session, [], sameArm.registry).reasons.join(' | '), /other arm/);
  // The calibration closed earlier in this registry: reusing one of its arm reports is refused.
  const earlier = seal(fixture('qualifying'));
  earlier.session.arms.reference.sha256 = HEX('2');
  const reused = paired.bindingCheck(earlier.session, [], earlier.registry);
  assert.equal(reused.ok, false);
  assert.match(reused.reasons.join(' | '), /earlier session/);
  assert.equal(paired.bindingCheck(seal(fixture('qualifying')).session, [HEX('5')], known.registry).ok, true);
});

test('existing single-arm candidate rejected: evidence/07-13-cost-candidate.json cannot be an arm, by its hash and by its missing nonce', () => {
  const bytes = readFileSync(path.join(ROOT, EVIDENCE, '07-13-cost-candidate.json'));
  const report = JSON.parse(bytes.toString('utf8'));
  assert.equal(report.complete, true);
  assert.equal(report.samples.length, 12);
  const built = fixture('qualifying', made => { made.session.arms.candidate.report = report; });
  seal(built, [sha256(bytes)]);
  built.session.arms.candidate.sha256 = sha256(bytes);
  const byHash = paired.bindingCheck(built.session, [sha256(bytes)], built.registry);
  assert.equal(byHash.ok, false);
  assert.match(byHash.reasons.join(' | '), /existing report/);
  assert.match(byHash.reasons.join(' | '), /no nonce/);
  // Unknown to the hash list, it is still not an arm: it carries no nonce and no interleaved capture times.
  const byNonce = paired.bindingCheck(built.session, [], built.registry);
  assert.equal(byNonce.ok, false);
  assert.match(byNonce.reasons.join(' | '), /no nonce/);
  assert.equal(built.session.validity.valid, false);
  assert.equal(built.session.validity.checks.binding.ok, false);
});

test('missing warm-up pair: a session without the warm-up pair is invalid', () => {
  const validity = validityOf('qualifying', built => {
    built.session.order.shift();
    for (const arm of ['reference', 'candidate']) {
      built.session.arms[arm].report.paired.captures.shift();
      delete built.session.arms[arm].report.paired.warmup;
    }
  });
  assert.equal(validity.checks.complete.ok, false);
  assert.match(validity.checks.complete.reasons.join(' | '), /warm-up/);
  assert.equal(validity.valid, false);
  const oneArm = validityOf('qualifying', built => { delete built.session.arms.candidate.report.paired.warmup; });
  assert.equal(oneArm.checks.complete.ok, false);
});

test('missing profile: an arm that lacks one of the 12 profiles makes the session invalid', () => {
  const validity = validityOf('qualifying', built => {
    built.session.arms.candidate.report.samples.splice(7, 1);
    built.session.arms.candidate.report.paired.captures.splice(8, 1);
  });
  assert.equal(validity.checks.complete.ok, false);
  assert.match(validity.checks.complete.reasons.join(' | '), /candidate/);
  assert.equal(validity.valid, false);
  const capturesOnly = validityOf('qualifying', built => { built.session.arms.reference.report.paired.captures.splice(8, 1); });
  assert.equal(capturesOnly.checks.complete.ok, false);
});

test('duplicated profile: an arm that holds a profile twice makes the session invalid', () => {
  const validity = validityOf('qualifying', built => {
    const samples = built.session.arms.reference.report.samples;
    samples[5] = structuredClone(samples[4]);
    const captures = built.session.arms.reference.report.paired.captures;
    Object.assign(captures[6], { run: captures[5].run, tier: captures[5].tier, actorCount: captures[5].actorCount });
  });
  assert.equal(validity.checks.complete.ok, false);
  assert.match(validity.checks.complete.reasons.join(' | '), /reference/);
  assert.equal(validity.valid, false);
  const extra = validityOf('qualifying', built => {
    built.session.arms.candidate.report.samples.push(structuredClone(built.session.arms.candidate.report.samples[0]));
  });
  assert.equal(extra.checks.complete.ok, false);
});

test('an arm report that is not complete makes the session invalid', () => {
  const validity = validityOf('calibration', built => { built.session.arms.candidate.report.complete = false; });
  assert.equal(validity.checks.complete.ok, false);
  assert.equal(validity.valid, false);
});

test('failed structural check: an arm that fails qualify, a frame image that does not hash, unequal producer contract, sampler or identities make the session invalid', () => {
  for (const [label, kind, mutate] of [
    ['reference arm fails qualify', 'qualifying', built => { built.session.arms.reference.report.samples[3].renderScope = 'external-third-person-core'; }],
    ['candidate frame image does not hash', 'qualifying', built => { built.session.structural.frameImages.candidate = { ok: false, error: 'Stale pixel hash' }; }],
    ['frame image facts missing', 'calibration', built => { delete built.session.structural.frameImages; }],
    ['structural facts missing', 'qualifying', built => { delete built.session.structural; }],
    ['producer contract differs', 'qualifying', built => {
      for (const sample of built.session.arms.candidate.report.samples) sample.transitions = [...sample.transitions, 'idle']; }],
    ['sampler identity differs', 'calibration', built => {
      const report = built.session.arms.candidate.report;
      report.identities.captureSampler = HEX('9');
      for (const sample of report.samples) sample.sourceIdentitySha256 = sha256(JSON.stringify(report.identities)); }],
    ['an identity outside the owners differs', 'qualifying', built => {
      const report = built.session.arms.reference.report;
      report.identities['src/main.js'] = HEX('9');
      for (const sample of report.samples) sample.sourceIdentitySha256 = sha256(JSON.stringify(report.identities)); }],
    ['calibration arms with unequal identities', 'calibration', built => {
      const report = built.session.arms.candidate.report;
      report.identities['style.css'] = HEX('9');
      for (const sample of report.samples) sample.sourceIdentitySha256 = sha256(JSON.stringify(report.identities)); }],
  ]) {
    const validity = validityOf(kind, mutate);
    assert.equal(validity.checks.structure.ok, false, label);
    assert.equal(validity.valid, false, label);
  }
});

test('wrong owner identity on a reference arm: a reference arm whose five owner identities do not equal referenceOwners is rejected in every session kind', () => {
  const wrongOwner = arm => built => {
    const report = built.session.arms[arm].report;
    report.identities[OWNERS[1]] = HEX('9');
    for (const sample of report.samples) sample.sourceIdentitySha256 = sha256(JSON.stringify(report.identities));
  };
  for (const [kind, arm] of [['qualifying', 'reference'], ['calibration', 'reference'], ['calibration', 'candidate']]) {
    const validity = validityOf(kind, wrongOwner(arm));
    assert.equal(validity.checks.structure.ok, false, `${kind} ${arm}`);
    assert.ok(validity.checks.structure.reasons.join(' | ').includes(OWNERS[1]), `${kind} ${arm}`);
    assert.equal(validity.valid, false, `${kind} ${arm}`);
  }
  // The candidate arm of a qualifying session holds the candidate's own owner files.
  assert.equal(validityOf('qualifying').checks.structure.ok, true);
});

test('a qualifying session whose candidate arm makes the frozen command print no result line is structurally invalid', () => {
  const validity = validityOf('qualifying', built => {
    built.session.structural.frozen = { resultPrinted: false, exitCode: 1, overrunCount: null, applicableBudgetPass: null };
  });
  assert.equal(validity.checks.structure.ok, false);
  assert.match(validity.checks.structure.reasons.join(' | '), /frozen command/);
  assert.equal(validity.valid, false);
  const missing = validityOf('qualifying', built => { delete built.session.structural.frozen; });
  assert.equal(missing.checks.structure.ok, false);
  // A calibration has no frozen result and needs none.
  assert.equal(validityOf('calibration').checks.structure.ok, true);
});

test('gross instability: a reference-arm frame-interval median differing between run 1 and run 2 by more than tSingle in a cell is invalid', () => {
  const cell = run => ({ run, tier: 'high', actorCount: 8 });
  const both = factor => built => {
    for (const arm of ['reference', 'candidate']) setValue(built.session, arm, cell(2), 'frameIntervalMs', 'median', 250 * factor);
  };
  const over = validityOf('qualifying', both(1.26));
  assert.equal(over.checks.grossInstability.ok, false);
  assert.equal(over.checks.ratioAgreement.ok, true);
  assert.equal(over.valid, false);
  const atLimit = validityOf('qualifying', both(1.25));
  assert.equal(atLimit.checks.grossInstability.ok, true);
  assert.equal(atLimit.valid, true, reasonsOf(atLimit));
  const slower = validityOf('calibration', built => {
    for (const arm of ['reference', 'candidate']) setValue(built.session, arm, cell(1), 'frameIntervalMs', 'median', 250 * 1.3);
  });
  assert.equal(slower.checks.grossInstability.ok, false);
});

test('ratio agreement: a candidate-to-reference frame-interval ratio differing between run 1 and run 2 by more than tSingle in a cell is invalid', () => {
  const cell = run => ({ run, tier: 'medium', actorCount: 1 });
  const over = validityOf('qualifying', built => setValue(built.session, 'candidate', cell(2), 'frameIntervalMs', 'median', 250 * 1.26));
  assert.equal(over.checks.ratioAgreement.ok, false);
  assert.equal(over.checks.grossInstability.ok, true);
  assert.equal(over.valid, false);
  const atLimit = validityOf('qualifying', built => setValue(built.session, 'candidate', cell(2), 'frameIntervalMs', 'median', 250 * 1.25));
  assert.equal(atLimit.checks.ratioAgreement.ok, true);
  // Opposite capture order: the check sees the square of a second-capture slowdown.
  const slowdown = factor => validityOf('calibration', built => {
    for (const profile of PROFILES) scale(built.session, firstArm(profile) === 'reference' ? 'candidate' : 'reference',
      sameProfile(profile), factor, ['frameIntervalMs']);
  });
  assert.equal(slowdown(1.08).checks.ratioAgreement.ok, true);
  assert.equal(slowdown(1.12).checks.ratioAgreement.ok, false);
});

test('a frame-interval median that is not a finite number above 0 makes the session invalid', () => {
  for (const value of [0, -1, null]) {
    const validity = validityOf('qualifying', built =>
      setValue(built.session, 'reference', { run: 1, tier: 'low', actorCount: 8 }, 'frameIntervalMs', 'median', value));
    assert.equal(validity.checks.ratioAgreement.ok, false, String(value));
    assert.equal(validity.valid, false, String(value));
  }
});

test('mismatched session settings: a qualifying session whose context and page lifetime, launch flags or sampler arguments differ from its calibration\'s is invalid', () => {
  for (const [label, change] of [
    ['context and page lifetime', value => { value.contextAndPageLifetime = 'one page for the whole session'; }],
    ['launch flags', value => { value.launch.args.push('--disable-gpu-vsync'); }],
    ['sampler arguments', value => { value.samplerArguments.captureFrames = true; }],
  ]) {
    const built = fixture('qualifying', made => change(made.session.settings));
    seal(built);
    assert.equal(built.session.validity.checks.settings.ok, false, label);
    assert.equal(built.session.validity.valid, false, label);
  }
  // No calibration on record to compare with.
  const none = fixture('qualifying');
  for (const arm of ['reference', 'candidate']) none.session.arms[arm].sha256 = sha256(bytesOf(none.session.arms[arm].report));
  none.session.binding = paired.bindingCheck(none.session, [], none.registry);
  const validity = paired.sessionValidity(none.session, paired.PAIRED_CONTRACT, null);
  assert.equal(validity.checks.settings.ok, false);
  assert.equal(validity.valid, false);
  // A calibration is its own reference: it has nothing earlier to match.
  assert.equal(validityOf('calibration', made => { made.session.settings.launch.args.push('--other'); }).checks.settings.ok, true);
});

test('validity before timing: the evaluation refuses a record with no validity block, and the validity block is identical whether the candidate timings pass or fail rule 1', () => {
  const passing = seal(fixture('qualifying'));
  const failing = seal(fixture('qualifying', built =>
    setValue(built.session, 'candidate', { run: 2, tier: 'low', actorCount: 1 }, 'renderMs', 'p95', 2.6 * 3)));
  assert.equal(passing.session.validity.valid, true, reasonsOf(passing.session.validity));
  assert.deepEqual(failing.session.validity, passing.session.validity);
  assert.equal(paired.evaluatePaired(passing.session, paired.PAIRED_CONTRACT).pairedBudgetPass, true);
  assert.equal(paired.evaluatePaired(failing.session, paired.PAIRED_CONTRACT).pairedBudgetPass, false);
  const unjudged = fixture('qualifying');
  assert.throws(() => paired.evaluatePaired(unjudged.session, paired.PAIRED_CONTRACT), /validity block/);
  assert.throws(() => paired.evaluatePaired(plainSession(session => { delete session.validity; }), paired.PAIRED_CONTRACT), /validity block/);
  const invalid = seal(fixture('qualifying', built => { built.session.order[2].first = 'reference-first'; }));
  assert.equal(invalid.session.validity.valid, false);
  assert.throws(() => paired.evaluatePaired(invalid.session, paired.PAIRED_CONTRACT), /invalid session/i);
});

// ---- verify ------------------------------------------------------------------------------------------

const frozenOutput = (exitCode, overruns) => ({ exitCode, stderr: '',
  stdout: JSON.stringify({ applicableBudgetPass: overruns === 0, overruns: Array.from({ length: overruns }, () => ({})), certification: false }) + '\n' });

// Close the session the way the runner does: validity, then the rules, then the report bytes and their hashes.
function close(built, editReport) {
  seal(built);
  const { session } = built;
  const evaluation = session.validity.valid ? paired.evaluatePaired(session, paired.PAIRED_CONTRACT) : null;
  const report = paired.sessionReport({ session, evaluation, registrationEventHash: built.registrationEventHash,
    startedEventHash: built.startedEventHash, host: { before: { note: 'before' }, after: { note: 'after' } },
    armPaths: { reference: 'arm-reference.json', candidate: 'arm-candidate.json' } });
  editReport?.(report);
  built.report = report;
  built.sessionBytes = bytesOf(report);
  built.registry = paired.appendEvent(built.registry, { type: 'closed', kind: built.kind, nonce: SESSION_NONCE, at: built.closedAt,
    valid: session.validity.valid, pass: evaluation ? evaluation.pairedBudgetPass : null, settings: session.settings,
    browserVersion: session.browserVersion, reportHashes: { session: sha256(built.sessionBytes),
      reference: session.arms.reference.sha256, candidate: session.arms.candidate.sha256 },
    ...(built.kind === 'qualifying' ? { frozenExitCode: 1, frozenOverrunCount: 40 } : {}) });
  return built;
}
function verify(built, overrides = {}) {
  const calls = { frozen: [], arms: [] };
  const promise = paired.verifySession({ sessionBytes: built.sessionBytes, registry: built.registry,
    readArm: async arm => { calls.arms.push(arm); return bytesOf(built.session.arms[arm].report); },
    hashFrameImages: async () => ({ ok: true }),
    runFrozen: async candidatePath => { calls.frozen.push(candidatePath); return frozenOutput(1, 40); },
    knownReportHashes: [], readContract: undefined, ...overrides });
  return promise.then(outcome => ({ ...outcome, calls }));
}

test('the session report carries its kind, nonce, both event hashes, the contract hashes, the arm hashes, the settings and the validity block', () => {
  const built = close(fixture('calibration'));
  const { report } = built;
  assert.deepEqual([report.kind, report.nonce, report.complete, report.contractVersion, report.identity],
    ['calibration', SESSION_NONCE, true, 'paired-same-session-v2', IDENTITY]);
  assert.deepEqual([report.registrationEventHash, report.startedEventHash], [built.registrationEventHash, built.startedEventHash]);
  assert.deepEqual(report.contract, { v2Sha256: paired.PAIRED_CONTRACT.v2Sha256,
    decisionSha256: paired.PAIRED_CONTRACT.decisionSha256, v2ReviewSha256: paired.PAIRED_CONTRACT.v2ReviewSha256 });
  assert.deepEqual(report.arms, { reference: { path: 'arm-reference.json', sha256: built.session.arms.reference.sha256 },
    candidate: { path: 'arm-candidate.json', sha256: built.session.arms.candidate.sha256 } });
  assert.deepEqual(report.settings, paired.SESSION_SETTINGS);
  assert.deepEqual(report.order, paired.sessionScheme());
  assert.deepEqual(report.validity, built.session.validity);
  assert.equal(report.outcome, 'passed');
  assert.equal(report.certification, false);
  assert.equal(Object.keys(report).some(key => key.startsWith('frozen')), false);
  assert.equal(close(fixture('qualifying')).report.frozen.exitCode, 1);
  const invalid = close(fixture('calibration', made => { made.session.order[2].first = 'reference-first'; })).report;
  assert.deepEqual([invalid.outcome, invalid.evaluation], ['invalid', null]);
  const failed = close(fixture('calibration', made => scale(made.session, 'candidate', () => true, 1.08, ['frameIntervalMs']))).report;
  assert.equal(failed.outcome, 'failed');
});

test('calibration verify without a frozen command: both arms are checked, no frozen command runs, structuralV2Pass is null and a valid passing calibration exits 0', async () => {
  const outcome = await verify(close(fixture('calibration')));
  assert.deepEqual(outcome.calls.frozen, []);
  assert.deepEqual([...outcome.calls.arms].sort(), ['candidate', 'reference']);
  assert.deepEqual([outcome.result.kind, outcome.result.valid, outcome.result.pairedBudgetPass, outcome.result.structuralV2Pass,
    outcome.result.certification], ['calibration', true, true, null, false]);
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.result.groups.length, 96);
  assert.ok(outcome.result.groups.every(group => Array.isArray(group.cells)));
  // A valid calibration that fails rule 2 is reported and exits non-zero.
  const failed = await verify(close(fixture('calibration', made => scale(made.session, 'candidate', () => true, 1.08, ['frameIntervalMs']))));
  assert.deepEqual([failed.result.valid, failed.result.pairedBudgetPass, failed.exitCode], [true, false, 1]);
  // An invalid calibration is not evaluated.
  const invalid = await verify(close(fixture('calibration', made => { made.session.order[2].first = 'reference-first'; })));
  assert.deepEqual([invalid.result.valid, invalid.result.pairedBudgetPass, invalid.exitCode], [false, null, 1]);
});

test('frozen fields only on qualifying sessions: a qualifying verify reports the frozen exit code and overrun count, a calibration reports no frozen field', async () => {
  const qualifying = await verify(close(fixture('qualifying')));
  assert.equal(qualifying.calls.frozen.length, 1);
  assert.equal(qualifying.calls.frozen[0], 'arm-candidate.json');
  assert.deepEqual([qualifying.result.kind, qualifying.result.valid, qualifying.result.pairedBudgetPass, qualifying.result.structuralV2Pass],
    ['qualifying', true, true, true]);
  assert.deepEqual([qualifying.result.frozenExitCode, qualifying.result.frozenOverrunCount, qualifying.result.frozenApplicableBudgetPass,
    qualifying.result.frozenExitZeroObserved], [1, 40, false, false]);
  assert.equal(qualifying.exitCode, 0);
  const calibration = await verify(close(fixture('calibration')));
  assert.deepEqual(Object.keys(calibration.result).filter(key => key.startsWith('frozen')), []);
});

test('a qualifying verify whose frozen command prints only an error is a structural failure: structuralV2Pass false and a non-zero exit', async () => {
  const built = close(fixture('qualifying', made => {
    made.session.structural.frozen = { resultPrinted: false, exitCode: 1, overrunCount: null, applicableBudgetPass: null };
  }));
  const outcome = await verify(built, { runFrozen: async () => ({ exitCode: 1, stdout: '', stderr: 'Protected source changed: src/scene.js\n' }) });
  assert.deepEqual([outcome.result.valid, outcome.result.pairedBudgetPass, outcome.result.structuralV2Pass, outcome.exitCode],
    [false, null, false, 1]);
  assert.deepEqual([outcome.result.frozenExitCode, outcome.result.frozenOverrunCount, outcome.result.frozenApplicableBudgetPass], [1, null, null]);
});

test('frozen exit 0 changes no paired result: it sets frozenExitZeroObserved and leaves validity, pairedBudgetPass and the exit code as they are', async () => {
  for (const mutate of [undefined, made => scale(made.session, 'candidate', () => true, 1.08, ['frameIntervalMs'])]) {
    const withOverruns = await verify(close(fixture('qualifying', mutate)));
    const exitZero = await verify(close(fixture('qualifying', mutate)), { runFrozen: async () => frozenOutput(0, 0) });
    assert.deepEqual([exitZero.result.frozenExitCode, exitZero.result.frozenOverrunCount, exitZero.result.frozenApplicableBudgetPass,
      exitZero.result.frozenExitZeroObserved], [0, 0, true, true]);
    assert.equal(withOverruns.result.frozenExitZeroObserved, false);
    const paredDown = result => Object.fromEntries(Object.entries(result).filter(([key]) => !key.startsWith('frozen')));
    assert.deepEqual(paredDown(exitZero.result), paredDown(withOverruns.result));
    assert.equal(exitZero.exitCode, withOverruns.exitCode);
    assert.equal(exitZero.result.pairedBudgetPass, mutate === undefined);
  }
});

test('a report with no validity block is refused by verify', async () => {
  const built = close(fixture('calibration'), report => { delete report.validity; });
  await assert.rejects(verify(built), /no validity block/);
});

test('verify refuses a report whose validity block or evaluation differs from its recomputation', async () => {
  const relabelled = close(fixture('calibration', made => { made.session.order[2].first = 'reference-first'; }),
    report => { report.validity = { valid: true, reasons: [], checks: {} }; });
  await assert.rejects(verify(relabelled), /validity block differs/i);
  const rewritten = close(fixture('calibration', made => scale(made.session, 'candidate', () => true, 1.08, ['frameIntervalMs'])),
    report => { report.evaluation.pairedBudgetPass = true; report.evaluation.rule2.violations = []; });
  await assert.rejects(verify(rewritten), /evaluation differs/i);
});

test('verify refuses a session or arm report whose hash differs from its closed event', async () => {
  const built = close(fixture('calibration'));
  const padded = Buffer.concat([built.sessionBytes, Buffer.from('\n')]);
  await assert.rejects(verify(built, { sessionBytes: padded }), /closed event/);
  await assert.rejects(verify(built, { sessionBytes: Buffer.from(built.sessionBytes.toString('utf8').replaceAll('\n', '\r\n')) }), /closed event/);
  for (const changed of ['reference', 'candidate'])
    await assert.rejects(verify(built, { readArm: async arm => arm === changed
      ? Buffer.concat([bytesOf(built.session.arms[arm].report), Buffer.from(' ')]) : bytesOf(built.session.arms[arm].report) }),
    error => /closed event/.test(error.message) && error.message.includes(changed), changed);
  // A session that was never closed has nothing to verify against.
  const open = close(fixture('calibration'));
  open.registry = { ...open.registry, events: open.registry.events.slice(0, -1) };
  await assert.rejects(verify(open), /no closed event/);
  await assert.rejects(verify(built, { registry: paired.emptyRegistry() }), /not in the registry/);
});

test('verify writes nothing to the report: the session report and both arm reports are byte-identical afterwards', async () => {
  const base = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'vod-paired-verify-')));
  try {
    const built = close(fixture('qualifying'));
    const files = { session: path.join(base, 'session.json'), reference: path.join(base, 'arm-reference.json'),
      candidate: path.join(base, 'arm-candidate.json') };
    writeFileSync(files.session, built.sessionBytes);
    for (const arm of ['reference', 'candidate']) writeFileSync(files[arm], bytesOf(built.session.arms[arm].report));
    const before = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, sha256(readFileSync(file))]));
    const listing = () => readdirSync(base).sort();
    const names = listing();
    const outcome = await verify(built, { sessionBytes: readFileSync(files.session),
      readArm: async (arm, name) => readFileSync(path.join(base, name)) });
    assert.equal(outcome.exitCode, 0);
    assert.deepEqual(Object.fromEntries(Object.entries(files).map(([name, file]) => [name, sha256(readFileSync(file))])), before);
    assert.deepEqual(listing(), names);
    assert.equal(sha256(built.sessionBytes), before.session);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('a smoke is never evaluated: verify refuses a smoke session', async () => {
  const now = clock();
  let registry = paired.registerSession(paired.emptyRegistry(), smokeEntry(NONCE(1)), now);
  registry = paired.appendEvent(registry, { type: 'started', kind: 'smoke', nonce: NONCE(1) }, now);
  const bytes = bytesOf(paired.smokeReport(smokeInput()));
  registry = paired.appendEvent(registry, { type: 'closed', kind: 'smoke', nonce: NONCE(1), structuralFailure: false,
    reportHashes: { session: sha256(bytes) } }, now);
  await assert.rejects(paired.verifySession({ sessionBytes: bytes, registry, readArm: async () => Buffer.from(''),
    hashFrameImages: async () => ({ ok: true }), runFrozen: async () => frozenOutput(0, 0) }), /smoke is never evaluated/);
});

test('changed contract: a pinned hash that does not match its file, or a decision that is not approved, is rejected by assertContract and by verify', async () => {
  const real = name => readFileSync(path.join(ROOT, name));
  assert.equal(paired.assertContract(real).version, 'paired-same-session-v2');
  for (const key of ['v2Path', 'decisionPath', 'v2ReviewPath']) {
    const changed = name => name === paired.PAIRED_CONTRACT[key] ? Buffer.concat([real(name), Buffer.from('\n')]) : real(name);
    assert.throws(() => paired.assertContract(changed), error => error.message.includes(paired.PAIRED_CONTRACT[key]), key);
    assert.throws(() => paired.assertContract(name => name === paired.PAIRED_CONTRACT[key]
      ? Buffer.from(real(name).toString('utf8').replaceAll('\n', '\r\n')) : real(name)), /changed/, key + ' with CR LF');
  }
  // A decision record that no longer says approved is rejected even when its hash is the pinned one.
  const rejected = Buffer.from(real(paired.PAIRED_CONTRACT.decisionPath).toString('utf8').replace('decision: approved', 'decision: rejected'));
  const repinned = { ...paired.PAIRED_CONTRACT, decisionSha256: sha256(rejected) };
  assert.throws(() => paired.assertContract(name => name === repinned.decisionPath ? rejected : real(name), repinned), /not approved/);
  // The verify path makes the same check before it reads a report.
  const built = close(fixture('calibration'));
  await assert.rejects(verify(built, { readContract: name => name === paired.PAIRED_CONTRACT.v2Path
    ? Buffer.concat([real(name), Buffer.from(' ')]) : real(name) }), /Paired contract record changed/);
  assert.equal((await verify(built, { readContract: real })).exitCode, 0);
});

test('the verify command line refuses the recorded smoke session: a smoke is never evaluated and the exit code is non-zero', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'tools/art/animation-budget-paired.mjs'), 'verify',
    '--budget', path.join(ROOT, EVIDENCE, '07-budget-view-v2.json'), '--session', path.join(ROOT, EVIDENCE, '07-16-paired-smoke.json'),
    '--registry', path.join(ROOT, paired.REGISTRY_PATH)], { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /smoke is never evaluated/);
  assert.equal(run.stdout.trim(), '');
});

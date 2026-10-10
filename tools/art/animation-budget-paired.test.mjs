// Controls for the paired same-session timing gate (plan 07-16; the contract is
// 07-09-PAIRED-AMENDMENT-V2.md). Synthetic inputs only: no gitignored cache, no browser,
// no git object and no check that depends on checkout line endings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

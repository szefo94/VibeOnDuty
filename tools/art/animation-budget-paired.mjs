// Paired same-session timing gate (plan 07-16).
//
// The contract is `07-09-PAIRED-AMENDMENT-V2.md`; this file implements it and decides
// nothing. It replaces only the timing predicate of the frozen V2 gate: every structural
// predicate stays with the unchanged `animation-budget-v2.mjs`, which this file imports
// from and never edits.
//
// What a paired pass can mean is stated in section 10 of the contract and nowhere wider:
// the effect of edits to the five owner files after the freeze, in the offline Training
// Range capture, under software rendering, on this host. It is never the original absolute
// limits, a frame rate, a device or a human acceptance.
//
//   node tools/art/animation-budget-paired.mjs chain --registry <registry>
//   node tools/art/animation-budget-paired.mjs verify --budget <frozen V2 budget> --session <session report> --registry <registry>
//   node tools/art/animation-budget-paired.mjs verdict --registry <registry> --identity <source identity hash>
//   node tools/art/animation-budget-paired.mjs frozen-evaluations --identity <source identity hash>
//
// Sessions are registered and run through `node tools/art/review.mjs --animation-paired`.
// A pass comes from the registry verdict, never from one report. Nothing here merges sessions
// or selects profiles across sessions.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENTS, candidateLineage, canonical, producerContract, qualify, sha256 } from './animation-budget-v2.mjs';
import { ROOT, boundedPath } from './motion-acceptance.mjs';

const PHASE = '.planning/phases/07-movement-matched-and-action-safe-animation/';
export const EVIDENCE_DIR = PHASE + 'evidence/';
export const REGISTRY_PATH = EVIDENCE_DIR + '07-paired-session-registry.json';
export const PAIRED_CACHE = '.planning/research/.cache/06-art/animation-paired';
// The identity of the archived sampler function the frozen reference was captured with.
export const FROZEN_SAMPLER = '2720e51eed272c40fe9e12ff561e4d63072f9b7548b5c270a71ec0ae527ab83f';
export const TIERS = Object.freeze(['low', 'medium', 'high']);
export const ACTOR_COUNTS = Object.freeze([1, 8]);
export const STATS = Object.freeze(['median', 'p95']);
const RESOURCES = ['geometries', 'textures', 'programs'];
const RENDER_SCOPE = 'source-eye-down-view-replaces-source-0';
const HEX64 = /^[a-f0-9]{64}$/, HEX40 = /^[a-f0-9]{40}$/, NONCE = /^[a-f0-9]{32}$/;

// ---- the pinned contract ---------------------------------------------------------------

// The three hashes are of the files as they were on disk when this module was written
// (LF bytes; the paths are pinned to LF in the root .gitattributes). The numbers are
// copied from the owner's decision record; none is chosen here.
export const PAIRED_CONTRACT = Object.freeze({
  version: 'paired-same-session-v2',
  v2Path: PHASE + '07-09-PAIRED-AMENDMENT-V2.md',
  v2Sha256: '8f3f6c72835ad7a37122dfa58109b25119ab14a1b7c71e91c45e28c927fd1aa3',
  decisionPath: PHASE + '07-09-PAIRED-AMENDMENT-DECISION.md',
  decisionSha256: 'c1af5d9bf5e904dcf6c40506dbcaee781ddc4deca31412e6548bdd4176387f69',
  v2ReviewPath: PHASE + '07-09-PAIRED-AMENDMENT-V2-REVIEW.md',
  v2ReviewSha256: 'f61edef1eeeaf35d6ff07226592151a79b7f506a2d77cb7fbe010d8c5afd6689',
  tSingle: 0.25,
  tAggregate: 0.05,
  timerQuantumMs: 0.1,
  // The frozen contract's own comparison allowance (animation-budget-v2.mjs, comparisonEpsilonMs).
  comparisonEpsilonMs: 1e-7,
  sessionCap: 3,
  referenceCommit: 'c973458',
  referenceOwners: Object.freeze({
    'src/builders/characterResources.js': Object.freeze({ blob: '37b3399325545d894e2a3578f3970fb58f9c1a3f',
      sha256: '98e99511c87bb24e59ec52a53c4a4aa9c59271dc356eef4c9f251fe982b985f1' }),
    'src/builders/enemyGLTF.js': Object.freeze({ blob: 'a45770f1db9b49af1254e29aadcad8d299f9662d',
      sha256: '3a32d3eeba136e0a50389ddf65353d4e1ee402a22a34b41ac090a6f47f626d79' }),
    'src/builders/firstPersonRig.js': Object.freeze({ blob: '3835cc290d54ddeceeb2e3d65a3cf861aed1880a',
      sha256: 'd98f324330ec98ff0bce4902b5b35814cc5b8070e21bb983be086929e46d8405' }),
    'src/builders/enemyAnimations.js': Object.freeze({ blob: '56eecc0a3a455747ae8881b7827cfa28f8f11281',
      sha256: '8217f32ff2c4a65613aadcf62442c092a3e0d604f8ff5f7c5dc361b730d4aee0' }),
    'src/builders/weaponHandling.js': Object.freeze({ blob: 'a949f7cc8b4697c8063dc5659245686c6cb9dc4f',
      sha256: '15a060eeb4ea2ce4054293ea6737afe3c346e5bb01be6ef3cd7db90257c217ea' }),
  }),
});

const frontmatter = text => text.replaceAll('\r\n', '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1].split('\n') ?? [];
const rootScalar = (lines, key) => {
  const found = lines.filter(line => line.startsWith(key + ':'));
  return found.length === 1 ? found[0].slice(key.length + 1).trim() : null;
};

/** Throws unless the three pinned records equal the files on disk and the decision is still `approved`. */
export function assertContract(read = name => readFileSync(path.join(ROOT, name)), contract = PAIRED_CONTRACT) {
  const records = [['v2Path', 'v2Sha256'], ['decisionPath', 'decisionSha256'], ['v2ReviewPath', 'v2ReviewSha256']];
  const bytes = {};
  for (const [file, pin] of records) {
    bytes[file] = Buffer.from(read(contract[file]));
    assert.equal(sha256(bytes[file]), contract[pin], `Paired contract record changed: ${contract[file]}`);
  }
  assert.equal(rootScalar(frontmatter(bytes.decisionPath.toString('utf8')), 'decision'), 'approved',
    'Paired contract decision is not approved');
  const review = frontmatter(bytes.v2ReviewPath.toString('utf8'));
  assert.ok(['pass', 'pass-with-notes'].includes(rootScalar(review, 'status')), 'Paired contract review has no passing status');
  assert.equal(rootScalar(review, 'v2_sha256'), contract.v2Sha256, 'Paired contract review covers other bytes');
  return { version: contract.version, v2Sha256: contract.v2Sha256, decisionSha256: contract.decisionSha256,
    v2ReviewSha256: contract.v2ReviewSha256 };
}

// ---- line-ending pins (contract review E8) ---------------------------------------------------

// Every path whose raw bytes a hash in the contract, the registry or a `closed` event binds.
export const PINNED_PATHS = Object.freeze([
  PAIRED_CONTRACT.v2Path, PAIRED_CONTRACT.decisionPath, PAIRED_CONTRACT.v2ReviewPath, REGISTRY_PATH,
  EVIDENCE_DIR + '07-16-paired-smoke.json',
  EVIDENCE_DIR + '07-18-paired-calibration.json',
  EVIDENCE_DIR + '07-18-paired-session-1.json',
  EVIDENCE_DIR + '07-18-paired-session-2.json',
  EVIDENCE_DIR + '07-18-paired-session-3.json',
  EVIDENCE_DIR + '07-18-cost-candidate.json',
  EVIDENCE_DIR + '07-18-timing-result.json',
]);

const git = args => execFileSync('git', args, { cwd: ROOT, windowsHide: true, maxBuffer: 1 << 28 });
const committedAttributes = () => git(['show', 'HEAD:.gitattributes']).toString('utf8');

/** Throws `Line-ending pin is not committed` unless the committed .gitattributes holds exactly
 *  one exact-path `text eol=lf` line for every pinned path. That file has no attribute of its
 *  own, so lines are split on a line feed with an optional carriage return before it. */
export function assertPins(readCommittedAttributes = committedAttributes) {
  const lines = String(readCommittedAttributes()).split(/\r?\n/);
  for (const name of PINNED_PATHS) {
    const count = lines.filter(line => line === `${name} text eol=lf`).length;
    if (count !== 1) throw Error(`Line-ending pin is not committed: ${name} (${count} exact-path lines, 1 required)`);
  }
  return [...PINNED_PATHS];
}

// ---- order (contract section 3) --------------------------------------------------------------

/** Which arm is captured first in a pair. Run 1: reference first when the two indices sum to
 *  an even number; run 2: the opposite for every cell. */
export function orderFor(run, tierIndex, actorIndex) {
  assert.ok(run === 1 || run === 2, 'Unknown run');
  assert.ok([0, 1, 2].includes(tierIndex), 'Unknown tier index');
  assert.ok([0, 1].includes(actorIndex), 'Unknown actor index');
  const even = (tierIndex + actorIndex) % 2 === 0;
  return (run === 1) === even ? 'reference-first' : 'candidate-first';
}

// ---- source identity and the run guard ---------------------------------------------------------

/** The source identity: SHA-256 of the canonical (key-sorted) identity set. */
export function identityHash(identities) {
  assert.ok(identities && typeof identities === 'object' && HEX64.test(identities.captureSampler ?? ''),
    'Identity set has no sampler identity');
  return sha256(canonical(identities));
}

/** The current source identity of the working tree, the value the cap is keyed to. */
export async function sourceIdentity() {
  const { animationIdentities } = await import('./review.mjs');
  return identityHash(await animationIdentities());
}

/** True only when every path is the registry file or lies under the phase evidence directory. */
export function allowedSinceRegistration(paths) {
  assert.ok(Array.isArray(paths), 'Changed paths must be a list');
  return paths.every(name => typeof name === 'string' && !name.includes('\\') &&
    !name.split('/').some(part => part === '..' || part === '.' || part === '') &&
    (name === REGISTRY_PATH || (name.startsWith(EVIDENCE_DIR) && name.length > EVIDENCE_DIR.length)));
}

/** Passes only while the source is still the registered one: the identity is unchanged, and
 *  HEAD is the registered commit or a descendant whose intervening commits touched nothing but
 *  the registry and the phase evidence directory. */
export function runGuard({ registered, headCommit, isDescendant, changedPaths, identityNow }) {
  assert.equal(registered?.type, 'registered', 'runGuard needs the registration event');
  assert.ok(HEX40.test(headCommit ?? ''), 'runGuard needs the current commit');
  assert.ok(Array.isArray(changedPaths), 'runGuard needs the paths changed since registration');
  if (headCommit !== registered.commit) {
    if (isDescendant !== true) throw Error('Run refused: HEAD is not a descendant of the registered commit');
    const refused = changedPaths.filter(name => !allowedSinceRegistration([name]));
    if (refused.length) throw Error('Run refused: a commit since registration touches ' + refused[0] +
      ' (only the registry and the phase evidence directory may be committed between a registration and its run)');
  }
  if (identityNow !== registered.identity) throw Error('Run refused: source identity changed since registration');
  return true;
}

// ---- arms (contract section 2) -----------------------------------------------------------------

/** The git object id of a blob with these bytes. */
export const gitBlobId = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

function referenceOwnerBlob(name, contract) {
  const id = git(['rev-parse', '--verify', `${contract.referenceCommit}:${name}`]).toString('utf8').trim();
  assert.equal(id, contract.referenceOwners[name].blob, `Reference owner blob id differs from the pinned id: ${name}`);
  return git(['cat-file', 'blob', id]);
}

function listFiles(directory, prefix = '') {
  const names = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) names.push(...listFiles(path.join(directory, entry.name), name + '/'));
    else names.push(name);
  }
  return names;
}

/** Re-hash both arms. Exactly the owner files may differ, and all of them must. In a calibration
 *  (`identical`) the second directory is a second copy of the reference arm: no file may differ. */
export function compareArms(arms, names, owners, { identical = false } = {}) {
  const expected = [...names].sort();
  for (const arm of ['reference', 'candidate']) {
    const present = listFiles(arms[arm]).sort();
    const extra = present.find(name => !expected.includes(name)), missing = expected.find(name => !present.includes(name));
    if (extra || missing) throw Error(`Arm ${arm} does not hold exactly the listed files: ${extra ?? missing}`);
  }
  const differing = expected.filter(name => sha256(readFileSync(path.join(arms.reference, name))) !==
    sha256(readFileSync(path.join(arms.candidate, name))));
  if (identical) {
    if (differing.length) throw Error('The two arms of a calibration must be identical copies of the reference arm; ' +
      `${differing.length} files differ, the first is ${differing[0]}`);
    return { comparedFiles: expected.length, differingFiles: [], count: 0, identical: true };
  }
  const outside = differing.filter(name => !owners.includes(name));
  if (outside.length) throw Error(`Arms differ outside the five owner files: ${outside[0]}`);
  if (differing.length !== owners.length) throw Error('Arms must differ in exactly the five owner files; ' +
    `${differing.length} differ (${differing.join(', ') || 'none'})`);
  return { comparedFiles: expected.length, differingFiles: differing, count: differing.length, onlyOwnersDiffer: true };
}

/** Copy the served and hashed working-tree files byte for byte into two owned directories
 *  below the cache, then replace exactly the five owner files of the reference directory with
 *  their pinned blobs. No archive, branch, worktree, checkout or install. Any other difference
 *  between the two directories is refused, naming the path. For a calibration the second
 *  directory is built by the same steps as the reference arm, and no file may differ. */
export function materializeArms(registered, { root = ROOT, cacheRoot = path.join(ROOT, PAIRED_CACHE), files,
  contract = PAIRED_CONTRACT, readOwnerBlob = name => referenceOwnerBlob(name, contract), copy = copyFileSync } = {}) {
  assert.ok(registered?.type === 'registered' && NONCE.test(registered.nonce ?? ''), 'materializeArms needs a registration event');
  assert.ok(Array.isArray(files) && files.length > 0, 'materializeArms needs the served and hashed files');
  const owners = Object.keys(contract.referenceOwners), names = [...new Set(files)].sort();
  assert.equal(names.length, files.length, 'Duplicate path in the arm file list');
  for (const owner of owners) assert.ok(names.includes(owner), `Reference owner is not in the arm file list: ${owner}`);
  mkdirSync(cacheRoot, { recursive: true });
  const session = 'session-' + registered.nonce, sessionDirectory = boundedPath(cacheRoot, session);
  assert.equal(existsSync(sessionDirectory), false, `Session directory already exists: ${session}`);
  const arms = { reference: path.join(sessionDirectory, 'reference'), candidate: path.join(sessionDirectory, 'candidate') };
  try {
    mkdirSync(sessionDirectory);
    for (const arm of ['reference', 'candidate']) {
      mkdirSync(boundedPath(cacheRoot, `${session}/${arm}`));
      for (const name of names) {
        const source = boundedPath(root, name);
        assert.ok(lstatSync(source).isFile(), `Not a regular file: ${name}`);
        const target = boundedPath(arms[arm], name);
        mkdirSync(path.dirname(target), { recursive: true });
        copy(source, target);
      }
    }
    const ownersVerified = [], calibration = registered.kind === 'calibration';
    for (const arm of calibration ? ['reference', 'candidate'] : ['reference']) for (const name of owners) {
      const bytes = readOwnerBlob(name), pinned = contract.referenceOwners[name];
      assert.ok(Buffer.isBuffer(bytes), `No reference owner bytes: ${name}`);
      assert.equal(gitBlobId(bytes), pinned.blob, `Reference owner bytes are not the pinned blob: ${name}`);
      assert.equal(sha256(bytes), pinned.sha256, `Reference owner bytes differ from the pinned SHA-256: ${name}`);
      writeFileSync(boundedPath(arms[arm], name), bytes);
      // Read back from the arm: what is served is what was pinned.
      assert.equal(sha256(readFileSync(path.join(arms[arm], name))), pinned.sha256, `Arm ${arm} does not hold the pinned owner: ${name}`);
      ownersVerified.push({ ...(calibration ? { arm } : {}), path: name, blob: pinned.blob, sha256: pinned.sha256 });
    }
    return { sessionDirectory, arms, names,
      difference: { ...compareArms(arms, names, owners, { identical: calibration }), ownersVerified } };
  } catch (error) {
    rmSync(sessionDirectory, { recursive: true, force: true });
    throw error;
  }
}

/** The files an arm serves and the gate hashes: every identity file plus `public/` as a whole. */
export function armFiles(identities, root = ROOT) {
  const names = Object.keys(identities).filter(name => name !== 'captureSampler');
  return [...new Set([...names, ...listFiles(path.join(root, 'public'), 'public/')])].sort();
}

/** The identity set of one materialised arm, hashed from the arm's own bytes. */
export function armIdentities(directory, identities) {
  const result = {};
  for (const name of Object.keys(identities))
    result[name] = name === 'captureSampler' ? identities.captureSampler : sha256(readFileSync(path.join(directory, name)));
  return result;
}

/** Refuses when the working tree has an uncommitted change in a file the arms serve or the gate
 *  hashes. Tracked planning state and the milestone lock are outside this check on purpose. */
export function assertServedTreeClean(identities) {
  const names = Object.keys(identities).filter(name => name !== 'captureSampler' && !name.startsWith('public/'));
  const dirty = git(['status', '--short', '--', 'public', ...names]).toString('utf8').trimEnd();
  if (dirty) throw Error('Run refused: uncommitted change in a served or hashed file:\n' + dirty);
  return true;
}

// ---- registry: an append-only, hash-chained event log (contract section 8) ---------------------

export const EVENT_TYPES = Object.freeze(['registered', 'started', 'closed']);
export const SESSION_KINDS = Object.freeze(['smoke', 'calibration', 'qualifying']);
export const GENESIS = 'paired-same-session-v2:first-event';
export const TOOL_PATHS = Object.freeze(['tools/art/animation-budget-paired.mjs', 'tools/art/review.mjs',
  'tools/art/animation-capture.mjs']);

export const eventHash = event => sha256(canonical(event));
export const emptyRegistry = () => ({ schemaVersion: 1, contractVersion: PAIRED_CONTRACT.version, events: [] });
export const newNonce = () => randomBytes(16).toString('hex');

/** Returns a new registry with one more event. Earlier events are never edited. */
export function appendEvent(registry, event, now = () => new Date().toISOString()) {
  assert.ok(registry && Array.isArray(registry.events), 'Registry has no event list');
  assert.ok(EVENT_TYPES.includes(event?.type), 'Unknown registry event type');
  assert.ok(NONCE.test(event.nonce ?? ''), 'Registry event needs a session nonce');
  assert.ok(!('seq' in event) && !('prevHash' in event), 'seq and prevHash are set by the registry');
  const events = structuredClone(registry.events), previous = events.at(-1);
  // A JSON round trip first, so that the stored event and the hashed event are the same value.
  const next = { ...JSON.parse(JSON.stringify(event)), seq: previous ? previous.seq + 1 : 1,
    at: event.at ?? now(), prevHash: previous ? eventHash(previous) : GENESIS };
  assert.ok(Number.isFinite(Date.parse(next.at)), 'Registry event needs a timestamp');
  return { ...registry, events: [...events, next] };
}

/** Throws, naming the sequence number, for a gap, a reorder, an edited event or a wrong prevHash. */
export function verifyChain(registry) {
  assert.ok(registry && Array.isArray(registry.events), 'Registry has no event list');
  assert.equal(registry.schemaVersion, 1, 'Unknown registry schema');
  assert.equal(registry.contractVersion, PAIRED_CONTRACT.version, 'Registry is for another contract version');
  let previous = null;
  for (const [index, event] of registry.events.entries()) {
    const seq = index + 1, broken = reason => Error(`Registry chain broken at sequence ${seq}: ${reason}`);
    if (event?.seq !== seq) throw broken(`found seq ${event?.seq}`);
    if (!EVENT_TYPES.includes(event.type)) throw broken('unknown event type');
    if (!NONCE.test(event.nonce ?? '')) throw broken('no session nonce');
    if (!Number.isFinite(Date.parse(event.at))) throw broken('no timestamp');
    if (event.prevHash !== (previous ? eventHash(previous) : GENESIS)) throw broken('prevHash does not match the previous event');
    previous = event;
  }
  return { events: registry.events.length, head: previous ? eventHash(previous) : GENESIS };
}

/** The sessions that count toward the cap for a source identity: qualifying ones only. */
export function countableSessions(registry, identity) {
  return registry.events.filter(event => event.type === 'registered' && event.kind === 'qualifying' && event.identity === identity);
}

const eventOf = (registry, nonce, type) => registry.events.find(event => event.nonce === nonce && event.type === type) ?? null;

// The one calibration of a source identity and where it stands. Qualifying sessions are gated by
// it: none until it is closed, valid and passed (contract section 6).
function calibrationState(registry, identity) {
  const registered = registry.events.find(event => event.type === 'registered' && event.kind === 'calibration' &&
    event.identity === identity) ?? null;
  const closed = registered && eventOf(registry, registered.nonce, 'closed');
  const state = !registered ? 'no calibration is registered' : !closed ? 'the calibration was registered and never closed'
    : closed.valid !== true ? 'the calibration is invalid' : closed.pass !== true ? 'the calibration failed' : 'passed';
  return { registered, closed, state };
}

// A calibration applies only to what it ran with: the bytes of the three tool files and the
// sampler identity in its `registered` event (contract section 6; the browser version is checked
// when the capture starts). A difference ends the paired route for the identity.
function calibrationCovers(calibration, toolHashes, samplerIdentity) {
  for (const name of TOOL_PATHS) if (!HEX64.test(toolHashes?.[name] ?? '') || toolHashes[name] !== calibration.registered.toolHashes?.[name])
    return `${name} differs from the bytes the calibration ran with`;
  if (!HEX64.test(samplerIdentity ?? '') || samplerIdentity !== calibration.registered.samplerIdentity)
    return 'the sampler identity differs from the calibration\'s';
  return null;
}
const ROUTE_ENDED = '; a calibration applies only to what it ran with, and the paired route for this source identity has ended';

/** Appends a `registered` event or throws. A smoke never counts and is refused once a calibration
 *  or qualifying event exists for the identity; there is exactly one calibration per identity,
 *  whatever ends it; a qualifying session needs that calibration closed, valid and passed, the
 *  same tool bytes and sampler, and is refused as the fourth for its identity. */
export function registerSession(registry, entry, now, contract = PAIRED_CONTRACT) {
  verifyChain(registry);
  assert.ok(SESSION_KINDS.includes(entry?.kind), 'Unknown session kind');
  assert.ok(NONCE.test(entry.nonce ?? ''), 'Registration needs a session nonce');
  assert.ok(!registry.events.some(event => event.nonce === entry.nonce), 'Session nonce is already in the registry');
  assert.ok(HEX64.test(entry.identity ?? ''), 'Registration needs the source identity hash');
  assert.ok(HEX40.test(entry.commit ?? ''), 'Registration needs the commit');
  assert.ok(entry.host && typeof entry.host === 'object', 'Registration needs host facts');
  assert.deepEqual(Object.keys(entry.toolHashes ?? {}).sort(), [...TOOL_PATHS].sort(), 'Registration needs the tool hash of each paired tool file');
  for (const name of TOOL_PATHS) assert.ok(HEX64.test(entry.toolHashes[name]), `Registration needs the tool hash of ${name}`);
  assert.ok(HEX64.test(entry.samplerIdentity ?? ''), 'Registration needs the sampler identity');
  const nonces = new Set(registry.events.filter(event => event.type === 'registered' && event.identity === entry.identity)
    .map(event => event.nonce));
  const ofIdentity = registry.events.filter(event => nonces.has(event.nonce));
  if (entry.kind === 'smoke') {
    if (ofIdentity.some(event => event.kind !== 'smoke'))
      throw Error('Smoke refused: a calibration or qualifying event exists for this source identity');
    for (const nonce of nonces) {
      const closed = ofIdentity.find(event => event.nonce === nonce && event.type === 'closed');
      if (closed?.structuralFailure !== true)
        throw Error('Smoke refused: a smoke already exists for this source identity and did not fail structurally');
    }
  } else if (entry.kind === 'calibration') {
    if (ofIdentity.some(event => event.type === 'registered' && event.kind === 'calibration'))
      throw Error('Calibration refused: there is exactly one calibration per source identity, whatever ended it; ' +
        'recovery needs an owner decision and a tooling change in a new plan');
  } else {
    const calibration = calibrationState(registry, entry.identity);
    if (calibration.state !== 'passed') throw Error(`Qualifying session refused: ${calibration.state} for this source identity; ` +
      'a qualifying session needs that identity\'s calibration closed, valid and passed');
    const uncovered = calibrationCovers(calibration, entry.toolHashes, entry.samplerIdentity);
    if (uncovered) throw Error(`Qualifying session refused: ${uncovered}${ROUTE_ENDED}`);
    if (countableSessions(registry, entry.identity).length >= contract.sessionCap)
      throw Error(`Qualifying session refused: ${contract.sessionCap} qualifying sessions are registered for this source identity ` +
        'and a fourth is refused');
  }
  // Only a qualifying session counts toward the cap; every registered one does, whatever follows.
  return appendEvent(registry, { type: 'registered', kind: entry.kind, countable: entry.kind === 'qualifying', nonce: entry.nonce,
    commit: entry.commit, identity: entry.identity, host: entry.host, toolHashes: entry.toolHashes,
    samplerIdentity: entry.samplerIdentity }, now);
}

/** A capture starts only with what its registration, and for a qualifying session its calibration,
 *  recorded: the three tool hashes and the sampler identity, and for a qualifying session the
 *  browser version in the calibration's `closed` event. A difference refuses the capture. */
export function assertRunScope({ registry, registered, toolHashes, samplerIdentity, browserVersion }) {
  assert.equal(registered?.type, 'registered', 'assertRunScope needs the registration event');
  if (registered.kind === 'smoke') return true;
  for (const name of TOOL_PATHS) if (!HEX64.test(toolHashes?.[name] ?? '') || toolHashes[name] !== registered.toolHashes?.[name])
    throw Error(`Run refused: ${name} changed since the session was registered`);
  if (!HEX64.test(samplerIdentity ?? '') || samplerIdentity !== registered.samplerIdentity)
    throw Error('Run refused: the sampler identity changed since the session was registered');
  if (registered.kind === 'qualifying') {
    const calibration = calibrationState(registry, registered.identity);
    if (calibration.state !== 'passed') throw Error(`Run refused: ${calibration.state} for this source identity`);
    const uncovered = calibrationCovers(calibration, toolHashes, samplerIdentity);
    if (uncovered) throw Error(`Run refused: ${uncovered}${ROUTE_ENDED}`);
    if (typeof browserVersion !== 'string' || !browserVersion || browserVersion !== calibration.closed.browserVersion)
      throw Error(`Run refused: the browser version (${browserVersion ?? 'unknown'}) differs from the one the calibration ran with ` +
        `(${calibration.closed.browserVersion ?? 'unknown'})${ROUTE_ENDED}`);
  }
  return true;
}

/** The `closed` event of a session, from the mechanical outcome the tool set. A qualifying close
 *  records the frozen command's exit code and overrun count; a calibration's and a smoke's record
 *  neither. `pass` follows from validity: a boolean for a valid session, null for an invalid one. */
export function closedEvent(kind, nonce, outcome) {
  assert.ok(SESSION_KINDS.includes(kind), 'Unknown session kind');
  assert.ok(NONCE.test(nonce ?? ''), 'Close needs a session nonce');
  assert.ok(outcome && typeof outcome === 'object', 'Close needs the session outcome');
  const hasFrozen = 'frozenExitCode' in outcome || 'frozenOverrunCount' in outcome;
  const hash = name => { assert.ok(HEX64.test(outcome.reportHashes?.[name] ?? ''), `Close needs the ${name} report hash`); return outcome.reportHashes[name]; };
  assert.ok(typeof outcome.browserVersion === 'string' || outcome.browserVersion === null, 'Close needs the browser version');
  if (kind === 'smoke') {
    if (hasFrozen) throw Error('A smoke has no frozen result: its closed event records no frozen field');
    assert.equal(typeof outcome.structuralFailure, 'boolean', 'A smoke close records whether it failed structurally');
    return { type: 'closed', kind, nonce, outcome: outcome.structuralFailure ? 'structural-failure' : 'loaded',
      structuralFailure: outcome.structuralFailure, valid: null, pass: null, reportHashes: { session: hash('session') },
      browserVersion: outcome.browserVersion };
  }
  assert.equal(typeof outcome.valid, 'boolean', 'Close needs the validity the tool computed');
  if (outcome.valid ? typeof outcome.pass !== 'boolean' : outcome.pass !== null)
    throw Error('Close refused: pass is true or false for a valid session and null for an invalid one');
  assert.ok(outcome.settings && typeof outcome.settings === 'object', 'Close needs the session settings');
  const event = { type: 'closed', kind, nonce, outcome: !outcome.valid ? 'invalid' : outcome.pass ? 'passed' : 'failed',
    valid: outcome.valid, pass: outcome.pass, settings: outcome.settings, browserVersion: outcome.browserVersion,
    reportHashes: { session: hash('session'), reference: hash('reference'), candidate: hash('candidate') } };
  if (kind === 'calibration') {
    if (hasFrozen) throw Error('A calibration has no frozen result: its closed event records no frozen field');
    return event;
  }
  for (const name of ['frozenExitCode', 'frozenOverrunCount']) {
    if (!(name in outcome)) throw Error(`A qualifying close records the frozen command's result: ${name} is missing`);
    assert.ok(outcome[name] === null || Number.isInteger(outcome[name]), `${name} is an integer, or null when the frozen command gave none`);
  }
  return { ...event, frozenExitCode: outcome.frozenExitCode, frozenOverrunCount: outcome.frozenOverrunCount };
}

/** Appends the `closed` event of a session that is registered, started and not yet closed. */
export function closeSession(registry, nonce, outcome, now) {
  verifyChain(registry);
  const registered = eventOf(registry, nonce, 'registered');
  if (!registered) throw Error('Close refused: the session is not in the registry');
  if (!eventOf(registry, nonce, 'started')) throw Error('Close refused: no started event precedes the close for this nonce');
  if (eventOf(registry, nonce, 'closed')) throw Error('Close refused: the session is already closed');
  return appendEvent(registry, closedEvent(registered.kind, nonce, outcome), now);
}

/** The order of every session's events: one registration, then at most one `started` event that
 *  carries the hash of that registration, then at most one `closed` event. Throws naming the
 *  sequence number. With a nonce, only that session is read. */
export function verifyLifecycle(registry, nonce = null) {
  assert.ok(registry && Array.isArray(registry.events), 'Registry has no event list');
  const sessions = new Map();
  for (const event of registry.events) {
    if (nonce !== null && event?.nonce !== nonce) continue;
    const broken = reason => Error(`Registry session order broken at sequence ${event?.seq}: ${reason}`);
    const session = sessions.get(event.nonce);
    if (event.type === 'registered') {
      if (session) throw broken('a second registration of one nonce');
      if (!SESSION_KINDS.includes(event.kind)) throw broken('a registration of an unknown session kind');
      sessions.set(event.nonce, { registered: event, started: null, closed: null });
    } else if (!session) throw broken(`a ${event.type} event for a nonce that has no registration`);
    else if (event.kind !== session.registered.kind) throw broken('an event whose kind differs from its registration');
    else if (event.type === 'started') {
      if (session.started) throw broken('a second started event for one nonce');
      if (event.registrationHash !== eventHash(session.registered))
        throw broken('a started event that does not carry the hash of its registration event');
      session.started = event;
    } else {
      if (!session.started) throw broken('a closed event without a preceding started event for the nonce');
      if (session.closed) throw broken('a second closed event for one nonce');
      session.closed = event;
    }
  }
  return sessions;
}

// What `registerSession` and the capture refuse, read back from a registry: a registry that holds
// it was not written by this tool, and no verdict is computed from it.
function verifyRegistryRules(registry, sessions, contract) {
  const perIdentity = new Map();
  for (const { registered, closed } of sessions.values()) {
    if (registered.kind === 'smoke') continue;
    const broken = reason => Error(`Registry rule broken at sequence ${registered.seq}: ${reason}`);
    const seen = perIdentity.get(registered.identity) ?? { calibration: null, qualifying: 0 };
    perIdentity.set(registered.identity, seen);
    if (registered.kind === 'calibration') {
      if (seen.calibration) throw broken('a second calibration for one source identity');
      seen.calibration = sessions.get(registered.nonce);
      continue;
    }
    const calibration = seen.calibration;
    if (!calibration?.closed || calibration.closed.seq > registered.seq || calibration.closed.valid !== true || calibration.closed.pass !== true)
      throw broken('a qualifying session without a closed, valid and passed calibration for its source identity before it');
    const uncovered = calibrationCovers(calibration, registered.toolHashes, registered.samplerIdentity);
    if (uncovered) throw broken(`a qualifying session not covered by its calibration: ${uncovered}`);
    if (closed && closed.browserVersion !== calibration.closed.browserVersion)
      throw broken('a qualifying session closed with another browser version than its calibration');
    if (++seen.qualifying > contract.sessionCap) throw broken(`more than ${contract.sessionCap} qualifying sessions for one source identity`);
  }
}

/** Sequence numbers of working events that the committed registry does not hold. */
export function uncommittedEvents(working, committed) {
  return working.events.filter((event, index) => !committed?.events?.[index] ||
    eventHash(committed.events[index]) !== eventHash(event)).map(event => event.seq);
}

/** A capture may start only for a registration that is committed and has never been started. */
export function assertRunnable({ nonce, working, committed }) {
  assert.ok(NONCE.test(nonce ?? ''), 'Run needs a session nonce');
  const find = registry => registry?.events?.find(event => event.type === 'registered' && event.nonce === nonce);
  const registration = find(working), stored = find(committed);
  if (!registration || !stored || eventHash(registration) !== eventHash(stored)) throw Error('Registration is not committed');
  for (const [where, registry] of [['working tree', working], ['committed', committed]])
    if (registry.events.some(event => event.nonce === nonce && event.type !== 'registered'))
      throw Error(`Session already started (${where} registry holds a started or closed event for this nonce)`);
  return registration;
}

// ---- registry: files and git (impure, read-only on git) --------------------------------------------

export function readRegistry(file = path.join(ROOT, REGISTRY_PATH)) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : emptyRegistry();
}
export function writeRegistry(registry, file = path.join(ROOT, REGISTRY_PATH)) {
  verifyChain(registry);
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(registry, null, 2) + '\n');
  renameSync(temporary, file);
}
/** The registry as stored at HEAD, or null when HEAD has none. */
export function committedRegistry(name = REGISTRY_PATH) {
  if (spawnSync('git', ['cat-file', '-e', `HEAD:${name}`], { cwd: ROOT, windowsHide: true }).status !== 0) return null;
  return JSON.parse(git(['show', `HEAD:${name}`]).toString('utf8'));
}
/** HEAD, and what the commits since `commit` touched (every path of every intervening commit). */
export function headState(commit) {
  const head = git(['rev-parse', 'HEAD']).toString('utf8').trim();
  if (head === commit) return { headCommit: head, isDescendant: true, changedPaths: [] };
  const isDescendant = spawnSync('git', ['merge-base', '--is-ancestor', commit, head], { cwd: ROOT, windowsHide: true }).status === 0;
  const lines = text => text.toString('utf8').split(/\r?\n/).filter(Boolean);
  const changedPaths = !isDescendant ? [] : [...new Set([
    ...lines(git(['log', '--no-renames', '--name-only', '--format=', `${commit}..${head}`])),
    ...lines(git(['diff', '--no-renames', '--name-only', `${commit}..${head}`]))])].sort();
  return { headCommit: head, isDescendant, changedPaths };
}
export const toolHashes = () => Object.fromEntries(TOOL_PATHS.map(name => [name, sha256(readFileSync(path.join(ROOT, name)))]));

/** Power plan, load and the heaviest applications, recorded before and after every session. */
export async function hostFacts() {
  const before = os.cpus().map(cpu => ({ ...cpu.times }));
  await new Promise(resolve => setTimeout(resolve, 1000));
  let busy = 0, total = 0;
  for (const [index, cpu] of os.cpus().entries()) {
    const delta = name => cpu.times[name] - (before[index]?.[name] ?? 0);
    const idle = delta('idle'), sum = delta('user') + delta('nice') + delta('sys') + delta('irq') + idle;
    busy += sum - idle; total += sum;
  }
  let powerPlan = null, powerPlanGuid = null, heaviestProcesses = null;
  if (process.platform === 'win32') {
    // The scheme name is printed in the console code page; the GUID is the stable fact.
    const plan = spawnSync('powercfg', ['/getactivescheme'], { encoding: 'utf8', windowsHide: true });
    powerPlanGuid = (plan.stdout || '').match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i)?.[0].toLowerCase() ?? null;
    powerPlan = { '381b4222-f694-41f0-9685-ff5bb260df2e': 'Balanced', '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c': 'High performance',
      'a1841308-3541-4fab-bc81-f71556f20b4a': 'Power saver' }[powerPlanGuid] ?? ((plan.stdout || '').trim() || null);
    const list = spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 24 });
    const byName = new Map();
    for (const line of (list.stdout || '').split(/\r?\n/)) {
      const cells = line.match(/"([^"]*)"/g)?.map(cell => cell.slice(1, -1));
      if (!cells || cells.length < 5) continue;
      const entry = byName.get(cells[0]) ?? { name: cells[0], processes: 0, workingSetKiB: 0 };
      entry.processes++; entry.workingSetKiB += Number(cells[4].replace(/\D/g, '')) || 0;
      byName.set(cells[0], entry);
    }
    heaviestProcesses = [...byName.values()].sort((a, b) => b.workingSetKiB - a.workingSetKiB).slice(0, 12)
      .map(entry => ({ name: entry.name, processes: entry.processes, workingSetMiB: Math.round(entry.workingSetKiB / 1024) }));
  }
  return { at: new Date().toISOString(), hostname: os.hostname(), platform: process.platform, release: os.release(),
    cpuModel: os.cpus()[0]?.model?.trim() ?? null, logicalCpus: os.cpus().length, powerPlan, powerPlanGuid,
    sampledBusyFraction: total ? Number((busy / total).toFixed(3)) : null,
    freeMemMiB: Math.round(os.freemem() / 1048576), totalMemMiB: Math.round(os.totalmem() / 1048576), heaviestProcesses };
}

// ---- session settings (contract section 2 item 5, section 11 item 19) ---------------------------

// One set of capture conditions for every session kind. Every session report records it.
export const SESSION_SETTINGS = Object.freeze({
  contextAndPageLifetime: 'One browser process per session. For each run, one fresh browser context and one page per arm, ' +
    'opened immediately before that arm\'s first capture of the run and kept until the last pair of the run is captured, ' +
    'then closed. The warm-up pair has its own fresh context and page per arm, closed before run 1 begins. ' +
    'A smoke captures one pair under the same rule.',
  launch: Object.freeze({ headless: true, args: Object.freeze(['--use-gl=swiftshader']) }),
  context: Object.freeze({ viewport: Object.freeze({ width: 1280, height: 960 }), deviceScaleFactor: 1 }),
  samplerArguments: Object.freeze({ candidate: true, renderedView: true, captureFrames: false, failAt: null }),
  server: Object.freeze({ host: '127.0.0.1', strictPort: true, base: '/', configFile: false, hmr: false,
    viteCache: 'one per arm, outside the served directory' }),
});

// ---- host device (review finding I-02) ---------------------------------------------------------------

/** Refuses a host that is not the frozen device. Every arm report carries the host's device block,
 *  and both things an arm is qualified against compare that block whole: the comparison stored in
 *  the arm report (`compareAnimationCandidate`, against the device of 07-budget.json) and the
 *  unchanged frozen command (against the device of the frozen V2 budget). On another OS release,
 *  Node version, CPU string or browser build every arm would fail them and the session would close
 *  invalid. `frozen` maps the name of each of those sources to its device block. `rendererClass` is
 *  read from the samples and exists only after a capture, so it is the one field left out.
 *  A refusal comes before the `started` event: nothing is appended or written, and the registration
 *  can still be run once the host is the frozen device again. */
export function assertHostDevice(device, frozen) {
  const sources = Object.entries(frozen && typeof frozen === 'object' ? frozen : {});
  if (!sources.length) throw Error('Run refused: no frozen device to compare this host with; nothing was started or written');
  for (const [source, expected] of sources) {
    if (!expected || typeof expected !== 'object') throw Error(`Run refused: ${source} holds no frozen device; nothing was started or written`);
    const names = [...new Set([...Object.keys(expected), ...Object.keys(device ?? {})])].filter(name => name !== 'rendererClass').sort();
    const differing = names.filter(name => device?.[name] !== expected[name]);
    if (differing.length) throw Error(`Run refused: this host is not the frozen device its arm reports would be compared with (${source}): ` +
      differing.map(name => `${name} is ${JSON.stringify(device?.[name])} here and ${JSON.stringify(expected[name])} there`).join('; ') +
      '. Nothing was started or written, and the registration stays as it is');
  }
  return true;
}

// ---- smoke: load and structure facts only (contract section 8) ----------------------------------

const count = value => Number.isFinite(value) && value >= 0;
function viewProblems(view, actorCount) {
  if (!view || typeof view !== 'object') return ['missing'];
  const problems = [], need = (ok, label) => { if (!ok) problems.push(label); };
  need(view.attached === true, 'attached');
  need(view.allocatedBoneTextures === 2, 'allocatedBoneTextures');
  need(['arms', 'body', 'weapon'].every(name => view.draws?.[name] > 0), 'draws');
  need(Array.isArray(view.selectedVisibleMeshes) && view.selectedVisibleMeshes.length === 2 &&
    view.selectedVisibleMeshes.every(n => Number.isInteger(n) && n > 0), 'selectedVisibleMeshes');
  need(view.sourceActorCount === actorCount, 'sourceActorCount');
  need(view.proxyEntityCount === 1, 'proxyEntityCount');
  need(view.cameraColocatedXZ === true, 'cameraColocatedXZ');
  need(view.fov === 75, 'fov');
  need(view.cameraPitch === -1.3, 'cameraPitch');
  need(view.cameraYaw === Math.PI, 'cameraYaw');
  need(Array.isArray(view.sourceScale) && view.sourceScale.length === 3 && view.sourceScale.every(n => n === 1), 'sourceScale');
  const eye = view.cameraEye, root = view.sourceRoot;
  need(Array.isArray(eye) && Array.isArray(root) && eye[0] === root[0] && eye[2] === root[2] &&
    [1.65, 0.85].some(n => Math.abs(n - view.eyeHeight) < 1e-12) && Math.abs(eye[1] - root[1] - view.eyeHeight) < 1e-12, 'cameraEye');
  return problems;
}

/** What one sample lacks of the fields the frozen tool's `qualify` requires of a sample. This is
 *  the smoke's presence check only; a complete report is still judged by `qualify` itself. */
export function requiredSampleFields(sample) {
  if (!sample || typeof sample !== 'object') return ['sample'];
  const problems = [], need = (ok, label) => { if (!ok) problems.push(label); };
  need([1, 2].includes(sample.run), 'run');
  need(TIERS.includes(sample.tier), 'tier');
  need(ACTOR_COUNTS.includes(sample.actorCount), 'actorCount');
  need(sample.renderScope === RENDER_SCOPE, 'renderScope');
  need(HEX64.test(sample.sourceIdentitySha256 ?? ''), 'sourceIdentitySha256');
  for (const name of ['gpu', 'renderer', 'browser']) need(typeof sample[name] === 'string' && sample[name].length > 0, name);
  need(Array.isArray(sample.transitions) && sample.transitions.length > 0, 'transitions');
  need(Array.isArray(sample.viewport) && sample.viewport[0] === 1280 && sample.viewport[1] === 960, 'viewport');
  need(sample.dpr === 1, 'dpr');
  need(sample.frameCount === 214, 'frameCount');
  need(sample.warmupFrames === 12, 'warmupFrames');
  need(sample.simulationStepSeconds === 1 / 20, 'simulationStepSeconds');
  need(!!sample.human, 'human');
  need(sample.packedMaps > 0, 'packedMaps');
  need(!!sample.keeperIntact, 'keeperIntact');
  need(!!sample.restored, 'restored');
  need(sample.sharedDisposals === 0, 'sharedDisposals');
  need(!sample.failure, 'failure');
  need(sample.movingPoseCount > 10, 'movingPoseCount');
  const resources = sample.resourceSamples;
  need(Array.isArray(resources) && resources.length === 8 && resources.every(entry => RESOURCES.every(name => count(entry?.[name]))) &&
    resources.slice(4).every(entry => RESOURCES.every(name => entry[name] === resources[3][name])), 'resourceSamples');
  for (const name of ['listeners', 'callbacks', 'props', 'actors', 'activeBindings'])
    need(sample.afterRetirement?.[name] === 0, `afterRetirement.${name}`);
  need(RESOURCES.every(name => count(sample.afterRetirement?.resources?.[name])), 'afterRetirement.resources');
  for (const name of COMPONENTS) for (const stat of STATS) need(count(sample.timings?.[name]?.[stat]), `timings.${name}.${stat}`);
  const view = viewProblems(sample.viewEvidence, sample.actorCount);
  need(view.length === 0, `viewEvidence (${view.join(', ')})`);
  const frames = sample.sequence;
  need(Array.isArray(frames) && frames.length === 3 && frames.every((frame, index) => frame.frame === [0, 100, 180][index] &&
    viewProblems(frame.viewEvidence, sample.actorCount).length === 0 && frame.simulationTime === frame.frame / 20 &&
    !!frame.image && HEX64.test(frame.sha256 ?? '')), 'sequence');
  return problems;
}

/** The smoke session report. It is built from both samples and keeps none of their timing
 *  values, durations or capture times: no ratio and no rule is computed for a smoke. */
export function smokeReport({ nonce, identity, commit, registrationEventHash, startedEventHash, arms, difference,
  browserVersion = null, host = null, error = null, diagnostics = null, armDataKept = false }, contract = PAIRED_CONTRACT) {
  const owners = Object.keys(contract.referenceOwners);
  const side = name => {
    const arm = arms?.[name] ?? {};
    return { pageErrors: [...(arm.pageErrors ?? [])], sampler: arm.identities?.captureSampler ?? null,
      structure: { captured: !!arm.sample, problems: arm.sample ? requiredSampleFields(arm.sample) : ['sample'] },
      frames: arm.sample ? { timedFrames: arm.sample.frameCount ?? null, pixelFrames: arm.sample.sequence?.length ?? 0 } : null };
  };
  const reference = side('reference'), candidate = side('candidate');
  const samplerEqual = reference.sampler !== null && reference.sampler === candidate.sampler && reference.sampler === FROZEN_SAMPLER;
  const ownerIdentities = Object.fromEntries(owners.map(name => [name, arms?.reference?.identities?.[name] ?? null]));
  const ownersPinned = owners.every(name => ownerIdentities[name] === contract.referenceOwners[name].sha256);
  const names = new Set([...Object.keys(arms?.reference?.identities ?? {}), ...Object.keys(arms?.candidate?.identities ?? {})]);
  const unequalOutsideOwners = [...names].filter(name => !owners.includes(name) &&
    arms?.reference?.identities?.[name] !== arms?.candidate?.identities?.[name]).sort();
  const differenceHolds = difference?.onlyOwnersDiffer === true && difference.count === owners.length;
  const structuralFailure = !!error || reference.pageErrors.length > 0 || candidate.pageErrors.length > 0 || !samplerEqual ||
    reference.structure.problems.length > 0 || candidate.structure.problems.length > 0 || !ownersPinned ||
    unequalOutsideOwners.length > 0 || !differenceHolds;
  return { schemaVersion: 1, kind: 'smoke', complete: false, contractVersion: contract.version, nonce, identity, commit,
    contract: { v2Sha256: contract.v2Sha256, decisionSha256: contract.decisionSha256, v2ReviewSha256: contract.v2ReviewSha256 },
    registrationEventHash, startedEventHash,
    profile: { run: 1, tier: 'low', actorCount: 1 }, order: orderFor(1, 0, 0),
    referencePageErrors: reference.pageErrors.length, candidatePageErrors: candidate.pageErrors.length,
    pageErrorMessages: { reference: reference.pageErrors, candidate: candidate.pageErrors },
    captureSampler: { reference: reference.sampler, candidate: candidate.sampler, frozen: FROZEN_SAMPLER, equal: samplerEqual },
    frameCounts: { reference: reference.frames, candidate: candidate.frames },
    sampleStructure: { reference: reference.structure, candidate: candidate.structure },
    referenceOwnerIdentities: { owners: ownerIdentities, equalPinned: ownersPinned },
    identitiesOutsideOwners: { equal: unequalOutsideOwners.length === 0, unequal: unequalOutsideOwners },
    armDifference: difference ? { comparedFiles: difference.comparedFiles, differingFiles: difference.differingFiles,
      count: difference.count, expectedCount: owners.length, onlyOwnersDiffer: difference.onlyOwnersDiffer === true } : null,
    settings: structuredClone(SESSION_SETTINGS), browserVersion, host, diagnostics,
    structuralFailure, error,
    timingValuesRecorded: false, comparisonComputed: false, armDataKept: armDataKept === true, certification: false,
    meaning: 'Load and structure facts of one profile pair (run 1, Low, one actor). Not a timing judgement, not a ' +
      'calibration, not a qualification and not a pass of any gate.' };
}

// ---- session shape (contract section 3) --------------------------------------------------------------

const ARMS = Object.freeze(['reference', 'candidate']);
const profileKey = entry => `${entry?.run}/${entry?.tier}/${entry?.actorCount}`;

/** The warm-up pair and the 12 pairs in capture order, each with the arm that is captured first. */
export function sessionScheme() {
  const scheme = [{ warmup: true, run: 1, tier: 'low', actorCount: 1, first: 'reference-first' }];
  for (const run of [1, 2]) for (const [tierIndex, tier] of TIERS.entries()) for (const [actorIndex, actorCount] of ACTOR_COUNTS.entries())
    scheme.push({ warmup: false, run, tier, actorCount, first: orderFor(run, tierIndex, actorIndex) });
  return scheme;
}
const PROFILE_KEYS = Object.freeze(sessionScheme().slice(1).map(profileKey));

// ---- single-invocation binding (contract section 7) --------------------------------------------------

/** Rejects an arm report that was not made by this session's one capture invocation. The result
 *  goes into the session record; `sessionValidity` reads it from there. `knownReportHashes` are
 *  the hashes of reports that exist outside any session (the frozen reference, single-arm
 *  candidates); arm reports of earlier sessions are read from the registry's closed events. */
export function bindingCheck(session, knownReportHashes = [], registry = emptyRegistry()) {
  const reasons = [], known = new Set(knownReportHashes), nonce = session?.nonce, events = registry?.events ?? [];
  const started = events.find(event => event.nonce === nonce && event.type === 'started');
  const closed = events.find(event => event.nonce === nonce && event.type === 'closed');
  if (!started) reasons.push('the registry holds no started event for this session');
  const earlier = new Set(events.filter(event => event.type === 'closed' && event.nonce !== nonce)
    .flatMap(event => Object.values(event.reportHashes ?? {})));
  const captures = [];
  for (const arm of ARMS) {
    const entry = session?.arms?.[arm], block = entry?.report?.paired;
    if (!block?.nonce) reasons.push(`the ${arm} arm report has no nonce`);
    else if (block.nonce !== nonce) reasons.push(`the ${arm} arm report carries another nonce`);
    if (!HEX64.test(entry?.sha256 ?? '')) reasons.push(`the ${arm} arm report has no hash`);
    else {
      if (known.has(entry.sha256)) reasons.push(`the ${arm} arm report is equal in hash to an existing report`);
      if (earlier.has(entry.sha256)) reasons.push(`the ${arm} arm report is equal in hash to a report of an earlier session`);
    }
    for (const capture of Array.isArray(block?.captures) ? block.captures : [])
      captures.push({ arm, key: `${arm}:${capture?.warmup === true ? 'warm-up' : 'pair'}:${profileKey(capture)}`,
        start: Date.parse(capture?.startedAt), end: Date.parse(capture?.endedAt) });
  }
  if (HEX64.test(session?.arms?.reference?.sha256 ?? '') && session.arms.reference.sha256 === session.arms.candidate?.sha256)
    reasons.push('the two arm reports are one report: each is equal in hash to the other arm');
  const expected = sessionScheme().flatMap(entry => (entry.first === 'reference-first' ? ARMS : [...ARMS].reverse())
    .map(arm => `${arm}:${entry.warmup ? 'warm-up' : 'pair'}:${profileKey(entry)}`));
  if (captures.length !== expected.length || !captures.every(capture => Number.isFinite(capture.start) &&
    Number.isFinite(capture.end) && capture.end > capture.start))
    reasons.push('capture times do not interleave with the other arm\'s as section 3 requires: a capture or its start and end time is missing');
  else {
    const ordered = [...captures].sort((a, b) => a.start - b.start);
    if (ordered.some((capture, index) => capture.key !== expected[index]))
      reasons.push('capture times do not interleave with the other arm\'s as section 3 requires');
    if (ordered.some((capture, index) => index > 0 && capture.start < ordered[index - 1].end)) reasons.push('captures overlap in time');
    if (started && ordered.some(capture => capture.start < Date.parse(started.at))) reasons.push('a capture time lies before the started event');
    if (closed && ordered.some(capture => capture.end > Date.parse(closed.at))) reasons.push('a capture time lies after the closed event');
  }
  return { ok: reasons.length === 0, reasons };
}

// ---- validity (contract section 5) ---------------------------------------------------------------------

function completeness(session) {
  const reasons = [];
  if (!Array.isArray(session?.order) || session.order.length !== 13 || session.order.filter(entry => entry?.warmup === true).length !== 1)
    reasons.push('the session does not record exactly the warm-up pair and the 12 pairs');
  for (const arm of ARMS) {
    const report = session?.arms?.[arm]?.report;
    if (report?.complete !== true) reasons.push(`the ${arm} arm report is not complete`);
    const samples = Array.isArray(report?.samples) ? report.samples.map(profileKey) : [];
    const captures = Array.isArray(report?.paired?.captures) ? report.paired.captures : [];
    const measured = captures.filter(capture => capture?.warmup !== true).map(profileKey);
    const warm = captures.filter(capture => capture?.warmup === true);
    if (warm.length !== 1 || profileKey(warm[0]) !== '1/low/1' || report?.paired?.warmup?.warmup !== true ||
      profileKey(report.paired.warmup) !== '1/low/1')
      reasons.push(`the ${arm} arm does not hold exactly one warm-up pair capture (run 1, Low, one actor)`);
    for (const [what, keys] of [['sample', samples], ['capture', measured]]) {
      if (keys.length !== 12) reasons.push(`the ${arm} arm holds ${keys.length} profile ${what}s, not 12`);
      for (const key of PROFILE_KEYS) {
        const times = keys.filter(candidate => candidate === key).length;
        if (times !== 1) reasons.push(`the ${arm} arm holds the ${what} of profile ${key} ${times} times`);
      }
    }
  }
  return { ok: reasons.length === 0, reasons };
}

function recordedOrder(session) {
  const scheme = sessionScheme(), order = session?.order, reasons = [];
  if (!Array.isArray(order) || order.length !== scheme.length)
    return { ok: false, reasons: ['the recorded order does not list the warm-up pair and the 12 pairs'] };
  for (const [index, expected] of scheme.entries()) {
    const entry = order[index];
    if (entry?.warmup !== expected.warmup || profileKey(entry) !== profileKey(expected))
      reasons.push(`pair ${index} is ${profileKey(entry)}, the scheme has ${profileKey(expected)} there`);
    else if (entry.first !== expected.first)
      reasons.push(`pair ${index} (${profileKey(entry)}) was captured ${entry.first}, the scheme requires ${expected.first}`);
  }
  return { ok: reasons.length === 0, reasons };
}

// Structural checks of both arms. Reading frame images and running the frozen command are done
// by the caller, which records their results in `session.structural`; a missing result fails.
function structure(session, contract) {
  const reasons = [], owners = Object.keys(contract.referenceOwners), producers = {}, calibration = session?.kind === 'calibration';
  if (!['calibration', 'qualifying'].includes(session?.kind)) reasons.push('the session kind is not calibration or qualifying');
  for (const arm of ARMS) {
    try { producers[arm] = qualify(session?.arms?.[arm]?.report); } catch (error) { reasons.push(`the ${arm} arm fails qualify: ${error.message}`); }
    const frames = session?.structural?.frameImages?.[arm];
    if (frames?.ok !== true) reasons.push(`the ${arm} arm frame images do not hash to their recorded values` + (frames?.error ? `: ${frames.error}` : ''));
  }
  if (producers.reference && producers.candidate && canonical(producers.reference) !== canonical(producers.candidate))
    reasons.push('the arms have different producer contracts');
  const reference = session?.arms?.reference?.report?.identities ?? {}, candidate = session?.arms?.candidate?.report?.identities ?? {};
  if (!HEX64.test(reference.captureSampler ?? '') || reference.captureSampler !== candidate.captureSampler)
    reasons.push('the arms have different sampler identities');
  const unequal = [...new Set([...Object.keys(reference), ...Object.keys(candidate)])].sort()
    .filter(name => (calibration || !owners.includes(name)) && reference[name] !== candidate[name]);
  for (const name of unequal.slice(0, 8)) reasons.push(`identity differs between the arms: ${name}`);
  if (unequal.length > 8) reasons.push(`${unequal.length - 8} more identities differ between the arms`);
  for (const arm of calibration ? ARMS : ['reference']) for (const name of owners)
    if (session?.arms?.[arm]?.report?.identities?.[name] !== contract.referenceOwners[name].sha256)
      reasons.push(`the ${arm} arm owner identity is not the pinned reference owner: ${name}`);
  if (session?.kind === 'qualifying' && session?.structural?.frozen?.resultPrinted !== true)
    reasons.push('the frozen command printed no result line for the candidate arm');
  return { ok: reasons.length === 0, reasons };
}

// Checks 5 and 6: gross instability of the reference arm and agreement of the candidate-to-reference
// ratio between the two runs of a cell, both on the frame-interval median, both at tSingle.
function frameIntervalChecks(session, { tSingle, comparisonEpsilonMs: eps }) {
  const grossInstability = { ok: true, reasons: [], largest: null }, ratioAgreement = { ok: true, reasons: [], largest: null };
  const exceeds = (a, b) => Math.max(a, b) - Math.min(a, b) * (1 + tSingle) > eps;
  for (const tier of TIERS) for (const actorCount of ACTOR_COUNTS) {
    const median = (arm, run) => (session?.arms?.[arm]?.report?.samples ?? []).find(sample =>
      sample?.run === run && sample.tier === tier && sample.actorCount === actorCount)?.timings?.frameIntervalMs?.median;
    const r1 = median('reference', 1), r2 = median('reference', 2), c1 = median('candidate', 1), c2 = median('candidate', 2);
    if (![r1, r2, c1, c2].every(value => Number.isFinite(value) && value > 0)) {
      ratioAgreement.ok = false;
      ratioAgreement.reasons.push(`a frame-interval median is not a finite number greater than 0 in cell ${tier}/${actorCount}`);
      continue;
    }
    const spread = Math.max(r1, r2) / Math.min(r1, r2), k1 = c1 / r1, k2 = c2 / r2, disagreement = Math.max(k1, k2) / Math.min(k1, k2);
    grossInstability.largest = Math.max(grossInstability.largest ?? 0, spread);
    ratioAgreement.largest = Math.max(ratioAgreement.largest ?? 0, disagreement);
    if (exceeds(r1, r2)) {
      grossInstability.ok = false;
      grossInstability.reasons.push(`the reference frame-interval median differs between run 1 and run 2 by more than tSingle in cell ${tier}/${actorCount}`);
    }
    if (exceeds(k1, k2)) {
      ratioAgreement.ok = false;
      ratioAgreement.reasons.push(`the candidate-to-reference frame-interval ratio differs between run 1 and run 2 by more than tSingle in cell ${tier}/${actorCount}`);
    }
  }
  return { grossInstability, ratioAgreement };
}

// A calibration applies to what it ran with: a qualifying session captured under other settings is
// not covered by it and is not judged (plan 07-16's reading of section 2 item 5, accepted and
// binding through the contract review's second pass).
function sameSettings(session, calibration) {
  if (session?.kind !== 'qualifying') return { ok: true, reasons: [] };
  if (!calibration?.settings || !session.settings) return { ok: false, reasons: ['no calibration settings are on record to compare with'] };
  return canonical(session.settings) === canonical(calibration.settings) ? { ok: true, reasons: [] }
    : { ok: false, reasons: ['context and page lifetime, launch flags or sampler arguments differ from those the calibration recorded'] };
}

/** The validity block of a session, from fixed criteria only. It is computed, and written into
 *  the session record, before any rule is evaluated; nothing here reads a rule result. */
export function sessionValidity(session, contract = PAIRED_CONTRACT, calibration = null) {
  const binding = session?.binding && typeof session.binding.ok === 'boolean'
    ? { ok: session.binding.ok, reasons: [...(session.binding.reasons ?? [])] } : { ok: false, reasons: ['the binding was not checked'] };
  const checks = { complete: completeness(session), order: recordedOrder(session), structure: structure(session, contract), binding,
    ...frameIntervalChecks(session, contract), settings: sameSettings(session, calibration) };
  return { valid: Object.values(checks).every(check => check.ok === true),
    reasons: Object.entries(checks).flatMap(([name, check]) => check.reasons.map(reason => `${name}: ${reason}`)), checks };
}

/** The closed calibration of a source identity, with the settings it recorded, or null. */
export function calibrationFor(registry, identity) {
  const registered = (registry?.events ?? []).find(event => event.type === 'registered' && event.kind === 'calibration' && event.identity === identity);
  const closed = registered && registry.events.find(event => event.type === 'closed' && event.nonce === registered.nonce);
  return closed ? { nonce: registered.nonce, valid: closed.valid ?? null, pass: closed.pass ?? null,
    settings: closed.settings ?? null, browserVersion: closed.browserVersion ?? null } : null;
}

// ---- timing predicate (contract section 4) -------------------------------------------------------------

const GROUPS = Object.freeze([['all', () => true], ['actors-1', cell => cell.actorCount === 1], ['actors-8', cell => cell.actorCount === 8],
  ['tier-low', cell => cell.tier === 'low'], ['tier-medium', cell => cell.tier === 'medium'], ['tier-high', cell => cell.tier === 'high']]);

function pairedProfiles(session) {
  const pairs = [];
  for (const run of [1, 2]) for (const tier of TIERS) for (const actorCount of ACTOR_COUNTS) {
    const find = arm => {
      const found = (session.arms?.[arm]?.report?.samples ?? []).filter(sample =>
        sample.run === run && sample.tier === tier && sample.actorCount === actorCount);
      assert.equal(found.length, 1, `Arm ${arm} does not hold profile ${run}/${tier}/${actorCount} exactly once`);
      return found[0];
    };
    pairs.push({ profile: { run, tier, actorCount }, reference: find('reference'), candidate: find('candidate') });
  }
  return pairs;
}

// What the two tolerances really allow for one component and statistic (contract section 4, R8):
// the timer step `q` is added to every bound, so 25% and 5% are effective only for large values.
function appliedTolerance(references, { tSingle, tAggregate, timerQuantumMs: q, comparisonEpsilonMs: eps }) {
  const min = Math.min(...references), max = Math.max(...references);
  const rule = tolerance => ({ allowedAtMinMs: min * (1 + tolerance) + q, allowedAtMaxMs: max * (1 + tolerance) + q,
    effectiveToleranceAtMin: min > eps ? tolerance + q / min : null, effectiveToleranceAtMax: max > eps ? tolerance + q / max : null });
  return { referenceMinMs: min, referenceMaxMs: max, rule1: rule(tSingle), rule2: rule(tAggregate) };
}

/** Rules 1 and 2 over the 12 measured pairs. Refuses a record with no validity block and an
 *  invalid session: validity is decided first and nobody reclassifies afterwards.
 *
 *  Rule 1, per value: `c <= r * (1 + tSingle) + q`.
 *  Rule 2, per group: a profile is usable when `r > eps`; its ratio is `(c - q - eps) / r`; a cell's
 *  ratio is the mean of the ratios of its usable profiles; a group's aggregate is the frozen
 *  contract's own `sorted[floor(n/2)]` over the ratios of its cells that have one, and must be at
 *  most `1 + tAggregate`. A group with fewer than 3 usable profiles is `rule-1-only`. The form uses
 *  only the design (which runs share a cell): no order effect is measured or subtracted. */
export function evaluatePaired(session, contract = PAIRED_CONTRACT) {
  assert.ok(session?.validity && typeof session.validity.valid === 'boolean',
    'Session record has no validity block: validity is decided before any rule is evaluated');
  assert.equal(session.validity.valid, true, 'An invalid session is not evaluated');
  const { tSingle, tAggregate, timerQuantumMs: q, comparisonEpsilonMs: eps } = contract;
  const pairs = pairedProfiles(session), limit = 1 + tAggregate;
  const rule1 = { comparisons: 0, violations: [] }, rule2 = { groups: [], violations: [] }, applied = {};
  for (const component of COMPONENTS) {
    applied[component] = {};
    for (const stat of STATS) {
      const values = pairs.map(({ profile, reference, candidate }) =>
        ({ ...profile, r: reference.timings?.[component]?.[stat], c: candidate.timings?.[component]?.[stat] }));
      for (const { run, tier, actorCount, r, c } of values) {
        assert.ok(count(r) && count(c), `Nonfinite timing: ${run}/${tier}/${actorCount} ${component} ${stat}`);
        rule1.comparisons++;
        const boundMs = r * (1 + tSingle) + q;
        if (c > boundMs + eps) rule1.violations.push({ run, tier, actorCount, component, stat, referenceMs: r, candidateMs: c, boundMs });
      }
      const cells = [];
      for (const tier of TIERS) for (const actorCount of ACTOR_COUNTS) {
        const ratios = values.filter(value => value.tier === tier && value.actorCount === actorCount && value.r > eps)
          .map(value => (value.c - q - eps) / value.r);
        cells.push({ tier, actorCount, usableProfiles: ratios.length,
          ratio: ratios.length ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : null });
      }
      for (const [group, belongs] of GROUPS) {
        const members = cells.filter(belongs), usableProfiles = members.reduce((sum, cell) => sum + cell.usableProfiles, 0);
        const sorted = members.filter(cell => cell.ratio !== null).map(cell => cell.ratio).sort((a, b) => a - b);
        const aggregate = usableProfiles >= 3 ? sorted[Math.floor(sorted.length / 2)] : null;
        const status = aggregate === null ? 'rule-1-only' : aggregate > limit ? 'fail' : 'pass';
        rule2.groups.push({ group, component, stat, status, aggregate, limit, usableProfiles, cells: members.map(cell => ({ ...cell })) });
        if (status === 'fail') rule2.violations.push({ group, component, stat, aggregate, limit });
      }
      applied[component][stat] = appliedTolerance(values.map(value => value.r), contract);
    }
  }
  return { rule1, rule2, tolerances: { tSingle, tAggregate, timerQuantumMs: q, comparisonEpsilonMs: eps, applied },
    pairedBudgetPass: rule1.violations.length === 0 && rule2.violations.length === 0 };
}

// ---- session report and verify ---------------------------------------------------------------------------

/** The session report, built once from the in-memory session after validity (and, for a valid
 *  session only, the rules) is known. Its bytes are hashed into the `closed` event. */
export function sessionReport({ session, evaluation = null, registrationEventHash, startedEventHash, host = null, armPaths },
  contract = PAIRED_CONTRACT) {
  assert.ok(session?.validity && typeof session.validity.valid === 'boolean', 'Session record has no validity block');
  assert.equal(evaluation !== null, session.validity.valid, 'The rules are evaluated for a valid session, and only for one');
  const frozen = session.structural?.frozen;
  return { schemaVersion: 1, kind: session.kind, complete: session.validity.checks?.complete?.ok === true,
    contractVersion: contract.version, nonce: session.nonce, identity: session.identity ?? null,
    contract: { v2Sha256: contract.v2Sha256, decisionSha256: contract.decisionSha256, v2ReviewSha256: contract.v2ReviewSha256 },
    registrationEventHash, startedEventHash,
    arms: Object.fromEntries(ARMS.map(arm => [arm, { path: armPaths[arm], sha256: session.arms[arm].sha256 }])),
    order: structuredClone(session.order), settings: structuredClone(session.settings), browserVersion: session.browserVersion ?? null, host,
    // Recorded and marked as warm-up; used by no rule, no validity check and no verdict.
    warmup: Object.fromEntries(ARMS.map(arm => [arm, session.arms[arm].report?.paired?.warmup?.timings ?? null])),
    frameImages: session.structural?.frameImages ?? null, binding: session.binding ?? null,
    validity: structuredClone(session.validity),
    outcome: !session.validity.valid ? 'invalid' : evaluation.pairedBudgetPass ? 'passed' : 'failed',
    evaluation,
    ...(session.kind === 'qualifying' ? { frozen: { resultPrinted: frozen?.resultPrinted === true, exitCode: frozen?.exitCode ?? null,
      overrunCount: frozen?.overrunCount ?? null, applicableBudgetPass: frozen?.applicableBudgetPass ?? null,
      exitZeroObserved: frozen?.exitCode === 0 } } : {}),
    certification: false,
    meaning: 'One paired session under paired-same-session-v2. A session outcome is not a verdict: the verdict is computed ' +
      'from the registry over every qualifying session and is always worded with its denominator. A calibration has no ' +
      'candidate arm and qualifies nothing. No outcome here means the original absolute limits were met, a frame rate, ' +
      'a device or a human acceptance; see section 10 of the contract.' };
}

/** Verify one closed calibration or qualifying session. A reader: it writes nothing. Every effect
 *  is injected (`readArm`, `hashFrameImages`, `runFrozen`), so the order and the refusals are
 *  testable. It refuses unless the given bytes are the bytes the runner hashed into the `closed`
 *  event and the report carries the hashes of its own registration and `started` events,
 *  recomputes validity and, for a valid session only, the rules, and refuses when either differs
 *  from the report or from the outcome in the `closed` event. Returns the result line and the
 *  exit code. */
export async function verifySession({ sessionBytes, registry, readArm, hashFrameImages, runFrozen, knownReportHashes = [],
  readContract, contract = PAIRED_CONTRACT }) {
  assertContract(readContract, contract);
  verifyChain(registry);
  const bytes = Buffer.from(sessionBytes), report = JSON.parse(bytes.toString('utf8'));
  const events = registry.events.filter(event => event.nonce === report.nonce);
  const registered = events.find(event => event.type === 'registered'), closed = events.find(event => event.type === 'closed');
  if (!registered) throw Error('Session is not in the registry');
  if (registered.kind === 'smoke' || report.kind === 'smoke') throw Error('A smoke is never evaluated');
  if (!closed) throw Error('Session has no closed event in the registry');
  assert.equal(report.kind, registered.kind, 'Session report kind differs from its registration');
  // The order of this session's own events: registered, started with the registration's hash, closed.
  const started = verifyLifecycle(registry, report.nonce).get(report.nonce)?.started ?? null;
  if (sha256(bytes) !== closed.reportHashes?.session) throw Error('Session report differs from the bytes hashed in its closed event');
  if (report.registrationEventHash !== eventHash(registered))
    throw Error('Session report registration event hash does not match its registry event');
  if (!started || report.startedEventHash !== eventHash(started))
    throw Error('Session report started event hash does not match its registry event');
  const arms = {};
  for (const arm of ARMS) {
    const armBytes = Buffer.from(await readArm(arm, report.arms?.[arm]?.path));
    if (sha256(armBytes) !== closed.reportHashes?.[arm] || sha256(armBytes) !== report.arms?.[arm]?.sha256)
      throw Error(`The ${arm} arm report differs from the bytes hashed in its closed event`);
    arms[arm] = { report: JSON.parse(armBytes.toString('utf8')), sha256: sha256(armBytes) };
  }
  if (!report.validity || typeof report.validity.valid !== 'boolean') throw Error('Session report has no validity block');
  const session = { kind: registered.kind, nonce: report.nonce, identity: registered.identity, order: report.order,
    settings: report.settings, browserVersion: report.browserVersion, arms, structural: { frameImages: {} } };
  for (const arm of ARMS) session.structural.frameImages[arm] = await hashFrameImages(arms[arm].report, arm);
  let frozen = null;
  if (session.kind === 'qualifying') {
    // The frozen file, current-source and pixel checks are private to the frozen tool; they are
    // obtained by running it, unchanged, on the candidate arm. A calibration runs it on neither arm.
    frozen = session.structural.frozen = frozenFacts(await runFrozen(report.arms.candidate.path), arms.candidate.sha256);
  }
  session.binding = bindingCheck(session, knownReportHashes, registry);
  session.validity = sessionValidity(session, contract, calibrationFor(registry, registered.identity));
  if (canonical(session.validity) !== canonical(report.validity)) throw Error('Validity block differs from its recomputation');
  const evaluation = session.validity.valid ? JSON.parse(JSON.stringify(evaluatePaired(session, contract))) : null;
  if (canonical(evaluation) !== canonical(report.evaluation ?? null)) throw Error('Evaluation differs from its recomputation');
  const pairedBudgetPass = evaluation ? evaluation.pairedBudgetPass : null;
  // The outcome was set once, by the runner, with these same two functions. A report or a
  // `closed` event that says otherwise is not verified.
  const outcome = !session.validity.valid ? 'invalid' : pairedBudgetPass ? 'passed' : 'failed';
  if (report.outcome !== outcome) throw Error(`Outcome in the session report (${report.outcome}) differs from its recomputation (${outcome})`);
  const differs = [closed.valid !== session.validity.valid && 'valid', (closed.pass ?? null) !== pairedBudgetPass && 'pass',
    closed.outcome !== undefined && closed.outcome !== outcome && 'outcome'].filter(Boolean);
  if (differs.length) throw Error(`Recomputed outcome (${outcome}) differs from the closed event of the session: ${differs.join(', ')}`);
  const structuralV2Pass = session.kind === 'calibration' ? null : frozen.resultPrinted;
  const result = { kind: session.kind, nonce: session.nonce, valid: session.validity.valid, pairedBudgetPass, structuralV2Pass,
    certification: false, validity: session.validity, rule1: evaluation?.rule1 ?? null, groups: evaluation?.rule2.groups ?? [],
    rule2Violations: evaluation?.rule2.violations ?? [], tolerances: evaluation?.tolerances ?? null,
    // The frozen gate's own result is reported as it is, whichever it is. An exit 0 is recorded and
    // changes nothing else: it is never a pass by this tool and is the owner's to judge.
    ...(session.kind === 'qualifying' ? { frozenApplicableBudgetPass: frozen.applicableBudgetPass, frozenExitCode: frozen.exitCode,
      frozenOverrunCount: frozen.overrunCount, frozenExitZeroObserved: frozen.exitCode === 0,
      // Reported, and changes nothing: whether this run of the frozen command gave what the runner recorded.
      frozenFieldsMatchClosed: closed.frozenExitCode === frozen.exitCode && closed.frozenOverrunCount === frozen.overrunCount } : {}) };
  const passed = session.validity.valid && pairedBudgetPass === true && (session.kind === 'calibration' || structuralV2Pass === true);
  return { result, exitCode: passed ? 0 : 1 };
}

/** What the `verify` command prints and exits with for one session: the result line on stdout with
 *  the exit code `verifySession` gives, or the refusal on stderr with exit 1. Every effect stays
 *  injected. The command line and whatever stands in for it share this one function. */
export async function verifyOutput(input) {
  try {
    const { result, exitCode } = await verifySession(input);
    return { exitCode, stdout: JSON.stringify(result) + '\n', stderr: '' };
  } catch (error) { return { exitCode: 1, stdout: '', stderr: `${error?.message ?? error}\n` }; }
}

/** What a captured run of the `verify` command says of one session, or null when it gives no usable
 *  result: only a refusal, a line of another session or kind, or a line and an exit code that do
 *  not agree. The command exits 0 only for a valid session that passes rules 1 and 2 and, when it
 *  has a candidate arm, the frozen tool's structural checks; it exits 1 for every other result. */
export function verifyFacts(run, { kind, nonce }) {
  const line = String(run?.stdout ?? '').split(/\r?\n/).filter(text => text.trim()).at(-1);
  let parsed;
  try { parsed = JSON.parse(line); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || !['calibration', 'qualifying'].includes(kind) || parsed.kind !== kind ||
    parsed.nonce !== nonce || typeof parsed.valid !== 'boolean') return null;
  const pass = parsed.pairedBudgetPass ?? null, structuralV2Pass = parsed.structuralV2Pass ?? null;
  if (parsed.valid ? typeof pass !== 'boolean' : pass !== null) return null;
  if (kind === 'calibration' ? structuralV2Pass !== null : typeof structuralV2Pass !== 'boolean') return null;
  const passed = parsed.valid && pass === true && (kind === 'calibration' || structuralV2Pass === true);
  return run.exitCode === (passed ? 0 : 1) ? { valid: parsed.valid, pass, structuralV2Pass, passed, exitCode: run.exitCode } : null;
}

// ---- registry history (contract section 8) ---------------------------------------------------------------

/** Passes only when the events of every committed version of the registry equal, event hash by
 *  event hash, the first events of the current list. A version that holds more events than the
 *  current list, or one that differs anywhere, is refused, naming its commit. */
export function historyPrefixCheck(current, committedVersions) {
  assert.ok(current && Array.isArray(current.events), 'Registry has no event list');
  if (!Array.isArray(committedVersions)) throw Error('Registry history cannot be read: no list of committed versions');
  const hashes = current.events.map(eventHash);
  for (const version of committedVersions) {
    const events = version?.registry?.events, commit = version?.commit ?? 'an unknown commit';
    if (!Array.isArray(events) || events.some(event => !event || typeof event !== 'object'))
      throw Error(`Registry history cannot be read: the version committed at ${commit} holds no event list`);
    if (events.length > hashes.length) throw Error(`Registry history check failed: the version committed at ${commit} holds ` +
      `${events.length} events and the current list ${hashes.length}; events were dropped`);
    const differs = events.findIndex((event, index) => eventHash(event) !== hashes[index]);
    if (differs !== -1) throw Error(`Registry history check failed: the version committed at ${commit} is not a prefix of the ` +
      `current event list; it differs at sequence ${differs + 1}`);
  }
  return { versions: committedVersions.length, everyVersionIsPrefix: true };
}

// Read-only git, with its error output captured. `head` is the history of HEAD, oldest first; `all`
// adds every version any other ref holds, so a session run on a side branch cannot go unseen.
const gitText = args => execFileSync('git', args, { cwd: ROOT, windowsHide: true, maxBuffer: 1 << 28,
  stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
const gitLines = args => gitText(args).split(/\r?\n/).filter(Boolean);
const gitHistoryReader = () => ({
  isShallow: () => gitText(['rev-parse', '--is-shallow-repository']).trim(),
  listCommits: name => ({ head: gitLines(['log', '--full-history', '--reverse', '--format=%H', 'HEAD', '--', name]),
    all: gitLines(['log', '--all', '--full-history', '--format=%H', '--', name]) }),
  showVersion: (commit, name) => gitText(['show', `${commit}:${name}`]),
});

/** Every committed version of the registry file, the history of HEAD first and oldest first.
 *  Refuses a shallow repository and any version that cannot be read in full. */
export function registryHistory(reader = gitHistoryReader(), name = REGISTRY_PATH) {
  const unreadable = (what, error) => Error(`Registry history cannot be read: ${what}${error ? ` (${String(error.message).trim()})` : ''}`);
  let shallow, commits;
  try { shallow = reader.isShallow(); } catch (error) { throw unreadable('whether the repository is shallow', error); }
  if (shallow !== 'false') throw Error('Registry history is shallow: every committed version of the registry must be readable, ' +
    'and a shallow repository does not hold them');
  try { commits = reader.listCommits(name); } catch (error) { throw unreadable('the commits that touch the registry', error); }
  if (!Array.isArray(commits?.head) || !Array.isArray(commits.all)) throw unreadable('the commits that touch the registry');
  const ordered = [...commits.head, ...commits.all.filter(commit => !commits.head.includes(commit))];
  return [...new Set(ordered)].map(commit => {
    if (!HEX40.test(commit ?? '')) throw unreadable(`a commit id (${commit})`);
    let registry;
    try { registry = JSON.parse(reader.showVersion(commit, name)); } catch (error) { throw unreadable(`the version committed at ${commit}`, error); }
    if (!registry || !Array.isArray(registry.events)) throw unreadable(`the version committed at ${commit} holds no event list`);
    return { commit, onHead: commits.head.includes(commit), registry };
  });
}

/** What a verdict needs of the registry file: a valid chain, the order of every session, every
 *  event present in the committed registry, and every committed version a prefix of the current
 *  list. Throws on the first that does not hold. */
export function assertRegistryIntegrity({ working, committed, versions }) {
  const chain = verifyChain(working);
  verifyLifecycle(working);
  const uncommitted = uncommittedEvents(working, committed), committedEvents = committed?.events?.length ?? 0;
  if (uncommitted.length) throw Error(`Registry holds an event that is not in the committed registry: sequence ${uncommitted.join(', ')}`);
  if (committedEvents !== working.events.length) throw Error('The committed registry holds more events than the registry in the working tree');
  const history = historyPrefixCheck(working, versions);
  if (working.events.length && !history.versions) throw Error('Registry history cannot be read: no committed version of the registry was found');
  return { chain: 'valid', events: chain.events, head: chain.head, committedEvents, uncommittedSequences: [], everyEventCommitted: true,
    committedVersions: history.versions, everyCommittedVersionIsPrefix: true };
}

/** The commit that first contains each `registered` event, from the history of HEAD. A commit
 *  that holds a registration is never amended, squashed or rebased; the tool cannot see rewritten
 *  history, so every final record names these. */
export function registrationCommitsOf(registry, versions) {
  assert.ok(Array.isArray(versions), 'registrationCommitsOf needs the committed versions');
  const onHead = versions.filter(version => version.onHead === true);
  return registry.events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'registered').map(({ event, index }) => {
    const hash = eventHash(event);
    const first = onHead.find(version => version.registry.events[index] && eventHash(version.registry.events[index]) === hash);
    if (!first) throw Error(`Registry holds a registration that no commit on HEAD holds: sequence ${event.seq}`);
    return { nonce: event.nonce, kind: event.kind, seq: event.seq, commit: first.commit };
  });
}

/** The registry in the working tree, checked against the committed file and its whole history
 *  (read-only git). Used by the `verdict` command and by whatever relies on a paired verdict. */
export function checkedRegistry(file = path.join(ROOT, REGISTRY_PATH)) {
  assert.equal(path.relative(ROOT, path.resolve(file)).split(path.sep).join('/'), REGISTRY_PATH, 'Only the tracked paired session registry is read');
  assert.ok(existsSync(file), 'No paired session registry');
  const registry = readRegistry(file), versions = registryHistory();
  const summary = assertRegistryIntegrity({ working: registry, committed: committedRegistry(), versions });
  return { registry, summary, registrationCommits: registrationCommitsOf(registry, versions) };
}

// ---- verdict (contract section 8) ---------------------------------------------------------------------------

const tally = sessions => ({ started: sessions.length, passed: sessions.filter(session => session.outcome === 'passed').length,
  failed: sessions.filter(session => session.outcome === 'failed').length,
  invalid: sessions.filter(session => session.outcome === 'invalid').length });
// `pass` when valid passes exceed valid fails; `failed` when a pass has become arithmetically
// impossible within the cap; `undecided` otherwise.
const verdictFor = ({ started, passed, failed }, cap) => passed > failed ? 'pass' : passed + (cap - started) <= failed ? 'failed' : 'undecided';
// Only a closed event with `valid` true and a boolean `pass` is a valid session; every other
// qualifying session, closed or not, is invalid: it decides nothing and still uses one of the three.
const outcomeOfSession = closed => closed?.valid === true && closed.pass === true ? 'passed'
  : closed?.valid === true && closed.pass === false ? 'failed' : 'invalid';

// The position of the session whose close made the verdict `pass` and kept it so to the end.
function decidingSession(registry, identity, sessions) {
  const order = [], outcomes = new Map();
  let deciding = null;
  for (const event of registry.events) {
    const session = sessions.get(event.nonce);
    if (session?.registered.kind !== 'qualifying' || session.registered.identity !== identity) continue;
    if (event.type === 'registered') order.push(event.nonce);
    if (event.type === 'closed') outcomes.set(event.nonce, outcomeOfSession(event));
    const values = [...outcomes.values()];
    const passing = values.filter(value => value === 'passed').length > values.filter(value => value === 'failed').length;
    if (!passing) deciding = null;
    else if (deciding === null) deciding = event.nonce;
  }
  return deciding === null ? null : order.indexOf(deciding) + 1;
}

/** The result for a source identity over every qualifying session registered for it, always
 *  computed from the whole registry and always worded with its denominator. Refuses a broken
 *  chain, a broken session order and a registry that holds what registration refuses. The
 *  returned object lists the qualifying sessions of every identity in the registry. */
export function registryVerdict(registry, identity, { registrationCommits, contract = PAIRED_CONTRACT } = {}) {
  verifyChain(registry);
  const sessions = verifyLifecycle(registry);
  verifyRegistryRules(registry, sessions, contract);
  assert.ok(HEX64.test(identity ?? ''), 'registryVerdict needs the source identity hash');
  const cap = contract.sessionCap, groups = new Map();
  for (const { registered, started, closed } of sessions.values()) {
    if (registered.kind !== 'qualifying') continue;
    const group = groups.get(registered.identity) ?? [];
    groups.set(registered.identity, group);
    group.push({ position: group.length + 1, nonce: registered.nonce, commit: registered.commit, registeredSeq: registered.seq,
      registeredAt: registered.at, started: started !== null, closed: closed !== null, closedSeq: closed?.seq ?? null,
      closedAt: closed?.at ?? null, outcome: outcomeOfSession(closed), valid: closed?.valid ?? null, pass: closed?.pass ?? null,
      reportHashes: closed?.reportHashes ?? null, browserVersion: closed?.browserVersion ?? null,
      frozenExitCode: closed?.frozenExitCode ?? null, frozenOverrunCount: closed?.frozenOverrunCount ?? null });
  }
  const allQualifying = [...groups].map(([groupIdentity, list]) => ({ identity: groupIdentity, ...tally(list),
    verdict: verdictFor(tally(list), cap), sessions: list }));
  const own = groups.get(identity) ?? [], numbers = tally(own), verdict = verdictFor(numbers, cap);
  const deciding = verdict === 'pass' ? decidingSession(registry, identity, sessions) : null;
  const calibration = calibrationState(registry, identity);
  const wording = verdict === 'pass'
    ? `passed, session ${deciding} of ${numbers.started}; ${numbers.failed} valid sessions failed; ${numbers.invalid} invalid`
    : `${verdict}, ${numbers.started} of at most ${cap} sessions started; ${numbers.passed} valid sessions passed; ` +
      `${numbers.failed} valid sessions failed; ${numbers.invalid} invalid`;
  if (registrationCommits !== undefined) {
    const registrations = registry.events.filter(event => event.type === 'registered');
    const named = Array.isArray(registrationCommits) && registrationCommits.length === registrations.length &&
      registrations.every((event, index) => registrationCommits[index]?.nonce === event.nonce && registrationCommits[index].seq === event.seq &&
        HEX40.test(registrationCommits[index].commit ?? ''));
    if (!named) throw Error('registryVerdict needs the commit of every registration in the registry, in order');
  }
  return { contractVersion: contract.version, identity, verdict, passed: numbers.passed, failed: numbers.failed, invalid: numbers.invalid,
    started: numbers.started, cap, decidingSession: deciding, wording, sessions: own,
    calibration: calibration.registered ? { nonce: calibration.registered.nonce, closed: calibration.closed !== null,
      valid: calibration.closed?.valid ?? null, pass: calibration.closed?.pass ?? null, toolHashes: calibration.registered.toolHashes ?? null,
      samplerIdentity: calibration.registered.samplerIdentity ?? null, browserVersion: calibration.closed?.browserVersion ?? null } : null,
    identitiesTried: allQualifying.length, allQualifying,
    ...(registrationCommits !== undefined ? { registrationCommits } : {}),
    certification: false,
    meaning: 'A verdict of the paired same-session gate for one source identity, over every qualifying session registered for it. ' +
      'It is not the frozen gate\'s result and never means the original absolute limits were met, a frame rate, a device or a ' +
      'human acceptance; see section 10 of the contract.' };
}

// ---- frozen evaluations (contract section 9) -----------------------------------------------------------------

export const FROZEN_BUDGET_PATH = EVIDENCE_DIR + '07-budget-view-v2.json';
// Where a complete candidate report can lie: the phase evidence directory and the capture cache,
// which holds `animation-candidate/` (single-arm captures) and `animation-paired/` (arm reports).
export const FROZEN_EVALUATION_ROOTS = Object.freeze([EVIDENCE_DIR.slice(0, -1), '.planning/research/.cache/06-art']);

const diskLister = directory => {
  const absolute = path.join(ROOT, directory);
  return !existsSync(absolute) ? [] : readdirSync(absolute, { withFileTypes: true })
    .map(entry => ({ name: entry.name, directory: entry.isDirectory(), file: entry.isFile() }));
};
const isCompleteReport = report => !!report && typeof report === 'object' && report.complete === true && Array.isArray(report.samples) &&
  report.samples.length === 12 && !!report.identities && typeof report.identities === 'object' && HEX64.test(report.identities.captureSampler ?? '');

/** Every complete 12-profile report below the roots, recursively, with the hash of its bytes.
 *  The directory lister and the reader are injectable. A reader of existing files: it captures nothing. */
export function scanReports({ roots = FROZEN_EVALUATION_ROOTS, list = diskLister, read = name => readFileSync(path.join(ROOT, name)) } = {}) {
  const found = [];
  const walk = directory => {
    for (const entry of [...list(directory)].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const name = `${directory}/${entry.name}`;
      if (entry.directory) walk(name);
      else if (entry.file && entry.name.endsWith('.json')) {
        const bytes = Buffer.from(read(name));
        let report;
        try { report = JSON.parse(bytes.toString('utf8')); } catch { continue; }
        if (isCompleteReport(report)) found.push({ path: name, sha256: sha256(bytes), report });
      }
    }
  };
  for (const root of roots) walk(root);
  return found;
}

/** The result line of the unchanged frozen command, or null when it printed only an error. */
function frozenResult(run, reportSha256) {
  const line = String(run?.stdout ?? '').split(/\r?\n/).filter(text => text.trim()).at(-1);
  let parsed;
  try { parsed = JSON.parse(line); } catch { return null; }
  if (!parsed || typeof parsed.applicableBudgetPass !== 'boolean' || !Array.isArray(parsed.overruns)) return null;
  // The result is of the report that was named, when the tool says which it read.
  if (reportSha256 !== undefined && parsed.candidateReportSha256 !== undefined && parsed.candidateReportSha256 !== reportSha256) return null;
  // It prints a result at exit 0, and at exit 1 when the only failures are numeric overruns.
  return (run.exitCode === 0 && parsed.applicableBudgetPass) || (run.exitCode === 1 && !parsed.applicableBudgetPass) ? parsed : null;
}
const frozenFacts = (run, reportSha256) => {
  const parsed = frozenResult(run, reportSha256);
  return { resultPrinted: parsed !== null, exitCode: Number.isInteger(run?.exitCode) ? run.exitCode : null,
    overrunCount: parsed ? parsed.overruns.length : null, applicableBudgetPass: parsed ? parsed.applicableBudgetPass : null };
};

/** Every complete candidate report whose source identity equals the given one, once per report
 *  hash, in time order, each with the frozen command's result for it, whether or not it belongs
 *  to a session. `results` maps a report hash to the captured run of the unchanged frozen command.
 *  An exit 0 here is never a pass by this tool: it is recorded with its count and is the owner's
 *  to judge. */
export function frozenEvaluationList(reports, identity, results) {
  assert.ok(Array.isArray(reports), 'frozenEvaluationList needs the scanned reports');
  assert.ok(HEX64.test(identity ?? ''), 'frozenEvaluationList needs the source identity hash');
  const byHash = new Map();
  for (const entry of reports) {
    if (!isCompleteReport(entry?.report) || identityHash(entry.report.identities) !== identity) continue;
    assert.ok(HEX64.test(entry.sha256 ?? '') && typeof entry.path === 'string', 'A scanned report needs its path and hash');
    const known = byHash.get(entry.sha256) ?? { report: entry.report, paths: [] };
    known.paths.push(entry.path);
    byHash.set(entry.sha256, known);
  }
  const time = report => Date.parse(report.capturedAt) || 0;
  const ordered = [...byHash].sort(([hashA, a], [hashB, b]) => time(a.report) - time(b.report) || (hashA < hashB ? -1 : 1));
  return ordered.map(([hash, { report, paths }], index) => {
    const run = results?.[hash];
    if (!run) throw Error(`No frozen command result for the listed report ${hash}`);
    const facts = frozenFacts(run, hash);
    return { evaluation: index + 1, of: ordered.length, reportSha256: hash, paths: [...new Set(paths)].sort(),
      capturedAt: report.capturedAt ?? null, revision: report.revision ?? null,
      session: report.paired ? { nonce: report.paired.nonce ?? null, kind: report.paired.kind ?? null, arm: report.paired.arm ?? null } : null,
      device: report.device ?? null, ...facts, exitZeroObserved: facts.resultPrinted && facts.exitCode === 0 };
  });
}

/** The unchanged frozen command on one candidate report, with its output captured, never inherited. */
export function runFrozenCommand(candidate, budget = FROZEN_BUDGET_PATH) {
  const run = spawnSync(process.execPath, ['tools/art/animation-budget-v2.mjs', 'verify', '--budget', path.resolve(ROOT, budget),
    '--candidate', boundedPath(ROOT, candidate)], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'] });
  return { exitCode: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
}

/** The `verify` command of this tool on one session report, with its output captured, never
 *  inherited: the whole session verification from the files on disk (the session report, both arm
 *  reports it names, their frame images and, for a qualifying session, the unchanged frozen command
 *  on the candidate arm). It needs the session directory in the gitignored cache as the runner left it. */
export function runVerifyCommand(session, { budget = FROZEN_BUDGET_PATH, registry = REGISTRY_PATH } = {}) {
  const run = spawnSync(process.execPath, ['tools/art/animation-budget-paired.mjs', 'verify', '--budget', path.resolve(ROOT, budget),
    '--session', boundedPath(ROOT, session), '--registry', path.resolve(ROOT, registry)],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 600000, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
  return { exitCode: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
}

// ---- the session runner (contract sections 3, 7 and 8) -------------------------------------------------------

export const SMOKE_PAIR = Object.freeze({ warmup: false, run: 1, tier: 'low', actorCount: 1, first: orderFor(1, 0, 0) });

/** The `capturePair` of a session under the context and page lifetime SESSION_SETTINGS records:
 *  for the warm-up and for each run, one fresh view (a context and its page) per arm, opened
 *  immediately before that arm's first capture in it and closed when its last pair is captured.
 *  The arm that `pair.first` names is captured first, one capture at a time. Opening, sampling
 *  and closing are injected; the start and end time of each capture are taken here on the host
 *  clock, around the sample alone. `finish` completes a sample after its end time is taken. */
export function pairCapturer({ pairs, openView, sample, finish = async taken => taken, closeView, now = () => new Date().toISOString() }) {
  assert.ok(Array.isArray(pairs) && pairs.length > 0, 'pairCapturer needs the pairs to capture');
  for (const [name, effect] of Object.entries({ openView, sample, finish, closeView }))
    assert.equal(typeof effect, 'function', `pairCapturer needs the injected ${name}`);
  const segmentOf = pair => (pair.warmup === true ? 'warm-up' : `run-${pair.run}`);
  let open = null;
  const closeAll = async () => {
    const views = Object.values(open?.views ?? {});
    open = null;
    for (const view of views) await closeView(view);
  };
  const capturePair = async (pair, index) => {
    const segment = segmentOf(pair);
    if (open && open.segment !== segment) await closeAll();
    open ??= { segment, views: {} };
    const views = open.views, captured = {};
    for (const arm of pair.first === 'reference-first' ? ARMS : [...ARMS].reverse()) {
      views[arm] ??= await openView(arm, pair);
      const startedAt = now(), taken = await sample(views[arm], arm, pair), endedAt = now();
      captured[arm] = { startedAt, endedAt, sample: await finish(taken, arm, pair) };
    }
    if (!pairs[index + 1] || segmentOf(pairs[index + 1]) !== segment) await closeAll();
    return captured;
  };
  return { capturePair, closeAll };
}
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const ARM_LIMITS = 'One arm of a paired same-session capture (paired-same-session-v2): the controlled Training Range workload of the ' +
  'frozen V2 candidate capture, with the archived sampler unchanged, 214 measured frames per profile, software rendering. An arm ' +
  'report alone decides nothing: the session report holds validity and the rules, and the registry verdict holds the result. No ' +
  'input, network or whole-game frame rate, no device certification and no human motion acceptance.';

/** One arm's report: the standard candidate-format report the frozen tool's `qualify` reads, plus
 *  the `paired` block that binds it to its session (nonce, arm, the start and end time of each of
 *  its 13 captures, and the warm-up values, which are recorded and used by nothing). */
export function buildArmReport({ arm, kind, nonce, identities, samples, captures, warmup, pageErrors = [], captureError = null, capturedAt,
  revision, device, cleanup, runtimeDependencies = null, baselineSha256, compare, v2Budget, v2BudgetBytes, contract = PAIRED_CONTRACT }) {
  const times = captures.flatMap(capture => [Date.parse(capture.startedAt), Date.parse(capture.endedAt)]).filter(Number.isFinite);
  // Complete only when the capture finished cleanly: 12 profiles, no page error, browser and listeners closed.
  const complete = samples.length === 12 && pageErrors.length === 0 && captureError === null &&
    cleanup?.browserClosed === true && cleanup?.serverClosed === true;
  const report = { schemaVersion: 1, complete, capturedAt, revision, identities, runtimeDependencies, samples, cleanup,
    durationMs: times.length ? Math.max(...times) - Math.min(...times) : null,
    device: { ...device, rendererClass: samples.length > 0 && samples.every(sample => /swiftshader|software/i.test(sample?.gpu ?? ''))
      ? 'software' : 'physical-or-unidentified' },
    certification: false, humanMotionAcceptance: 'pending', limits: ARM_LIMITS, baselineSha256 };
  // The outer fields of a candidate report. A report they cannot be built for does not satisfy
  // `qualify`, and its session is then invalid; nothing is thrown away.
  try { report.comparison = compare(report); } catch (error) { report.comparison = { error: error.message }; }
  try {
    report.producerContract = producerContract(report);
    report.v2Lineage = candidateLineage(v2Budget, v2BudgetBytes, report);
  } catch (error) { report.producerError = error.message; }
  report.paired = { contractVersion: contract.version, nonce, arm, kind, captures, warmup, pageErrors: [...pageErrors], captureError };
  return report;
}

/** The one runner every session kind shares. Every effect is an injected function, so the order
 *  below is the order that happens:
 *
 *   1. append `started`; capture the pairs with every sample held in memory; print, log and
 *      write nothing that carries timing;
 *   2. build both arm reports as bytes in memory and hash them;
 *   3. qualifying only: write the candidate arm report, the one file the frozen command must
 *      read, and run the unchanged frozen command on it through `runFrozen`, output captured;
 *   4. compute validity and put the validity block into the session record;
 *   5. only for a valid session, evaluate the rules;
 *   6. build the session report bytes, hash them, and append `closed` with the outcome;
 *   7. write the reference arm report (for a calibration both arm reports) and the session
 *      report; only then show anything that carries timing, the frozen output included.
 *
 *  A calibration skips step 3. A smoke uses steps 1, 6 and 7 with a report that holds no timing.
 *  Before step 1 a calibration or qualifying session is refused on a host that is not the frozen
 *  device (`assertHostDevice`): nothing is appended, and the registration can be run later.
 *  A calibration or qualifying capture that does not complete is not closed: the session stays
 *  in the registry as it stands, counts, and cannot be run again. */
export async function runSession({ kind, registered, pairs, capturePair, endCapture, hashFrameImages, appendEvent: append, write, log,
  runFrozen, context = {}, now = () => new Date().toISOString(), contract = PAIRED_CONTRACT }) {
  assert.ok(SESSION_KINDS.includes(kind), 'Unknown session kind');
  assert.equal(registered?.type, 'registered', 'runSession needs the registration event');
  assert.equal(registered.kind, kind, `The nonce is registered as a ${registered.kind} session`);
  assert.ok(Array.isArray(pairs) && pairs.length > 0, 'runSession needs the pairs to capture');
  for (const [name, effect] of Object.entries({ capturePair, endCapture, appendEvent: append, write, log,
    ...(kind === 'smoke' ? {} : { hashFrameImages }), ...(kind === 'qualifying' ? { runFrozen } : {}) }))
    assert.equal(typeof effect, 'function', `runSession needs the injected ${name}`);
  for (const name of ['session', ...(kind === 'smoke' ? [] : ARMS)])
    assert.ok(typeof context.paths?.[name] === 'string' && context.paths[name], `runSession needs the ${name} report path`);
  // Review finding I-02: a calibration or qualifying session is not started on a host whose arm reports
  // the frozen comparisons would refuse. A smoke builds no arm report and is not compared with a device.
  if (kind !== 'smoke') assertHostDevice(context.device, context.frozenDevices);
  const nonce = registered.nonce, registrationEventHash = eventHash(registered);

  // 1. Started, then the captures, held in memory.
  let registry = await append({ type: 'started', kind, nonce, registrationHash: registrationEventHash });
  const started = registry?.events?.at(-1);
  assert.ok(started?.type === 'started' && started.nonce === nonce, 'The started event was not appended');
  const startedEventHash = eventHash(started), held = [];
  let captureError = null, facts;
  try {
    for (const [index, pair] of pairs.entries()) {
      held.push({ pair, captured: await capturePair(pair, index) });
      log(`Paired ${kind} session ${nonce}: pair ${index + 1} of ${pairs.length} captured`);
    }
  } catch (error) { captureError = error; }
  try { facts = await endCapture({ interrupted: captureError !== null }) ?? {}; }
  catch (error) { captureError ??= error; facts = {}; }

  if (kind === 'smoke') {
    // A capture that failed is a structural failure of the smoke, and the smoke is still closed.
    const arms = Object.fromEntries(ARMS.map(arm => [arm, { identities: context.armIdentities?.[arm],
      pageErrors: facts.pageErrors?.[arm] ?? [], sample: held[0]?.captured?.[arm]?.sample }]));
    const report = smokeReport({ nonce, identity: registered.identity, commit: context.revision, registrationEventHash, startedEventHash,
      arms, difference: facts.difference ?? context.difference ?? null, browserVersion: context.browserVersion ?? null,
      host: { before: context.hostBefore ?? null, after: facts.hostAfter ?? null },
      error: captureError ? captureError.message ?? String(captureError) : facts.error ?? null,
      diagnostics: facts.diagnostics ?? null, armDataKept: facts.armDataKept === true }, contract);
    const bytes = jsonBytes(report), reportHashes = { session: sha256(bytes) };
    registry = await append(closedEvent('smoke', nonce, { structuralFailure: report.structuralFailure, reportHashes,
      browserVersion: context.browserVersion ?? null }));
    const closed = registry.events.at(-1);
    await write(context.paths.session, bytes);
    log(JSON.stringify({ kind, nonce, closedSeq: closed.seq, structuralFailure: report.structuralFailure,
      referencePageErrors: report.referencePageErrors, armDataKept: report.armDataKept, report: context.paths.session, sha256: reportHashes.session }));
    return { registry, closed, report, sessionBytes: bytes, reportHashes, outcome: closed.outcome };
  }

  if (captureError) {
    log(`Paired ${kind} session ${nonce}: the capture did not complete. The session stays in the registry as it stands, ` +
      'counts, and is not run again; nothing was written.');
    throw new Error(`Paired ${kind} session ${nonce} was interrupted before its last pair: ${captureError.message ?? captureError}`,
      { cause: captureError });
  }

  // 2. Both arm reports, as bytes in memory. The order recorded is the one the captures show.
  const order = held.map(({ pair, captured }) => ({ warmup: pair.warmup === true, run: pair.run, tier: pair.tier, actorCount: pair.actorCount,
    first: Date.parse(captured?.reference?.startedAt) <= Date.parse(captured?.candidate?.startedAt) ? 'reference-first' : 'candidate-first' }));
  const capturedAt = now(), bytes = {}, hashes = {};
  for (const arm of ARMS) {
    const warm = held.find(({ pair }) => pair.warmup === true);
    bytes[arm] = jsonBytes(buildArmReport({ arm, kind, nonce, identities: context.armIdentities?.[arm],
      samples: held.filter(({ pair }) => pair.warmup !== true).map(({ captured }) => captured?.[arm]?.sample).filter(Boolean),
      captures: held.map(({ pair, captured }) => ({ warmup: pair.warmup === true, run: pair.run, tier: pair.tier, actorCount: pair.actorCount,
        startedAt: captured?.[arm]?.startedAt ?? null, endedAt: captured?.[arm]?.endedAt ?? null })),
      warmup: warm ? { warmup: true, run: warm.pair.run, tier: warm.pair.tier, actorCount: warm.pair.actorCount,
        frameCount: warm.captured?.[arm]?.sample?.frameCount ?? null, timings: warm.captured?.[arm]?.sample?.timings ?? null } : null,
      pageErrors: facts.pageErrors?.[arm] ?? [], captureError: facts.error ?? null, capturedAt, revision: context.revision,
      device: context.device, cleanup: facts.cleanup ?? null, runtimeDependencies: context.runtimeDependencies?.[arm] ?? null,
      baselineSha256: context.baselineSha256, compare: context.compare, v2Budget: context.v2Budget, v2BudgetBytes: context.v2BudgetBytes,
      contract }));
    hashes[arm] = sha256(bytes[arm]);
  }

  // 3. Qualifying only: the candidate arm report is the one file written before `closed`, once.
  let frozenRun = null;
  if (kind === 'qualifying') {
    await write(context.paths.candidate, bytes.candidate);
    frozenRun = await runFrozen(context.paths.candidate);
  }

  // 4. Validity, from the bytes that were hashed: what `verify` will read back.
  const session = { kind, nonce, identity: registered.identity, order, settings: structuredClone(SESSION_SETTINGS),
    browserVersion: context.browserVersion ?? null,
    arms: Object.fromEntries(ARMS.map(arm => [arm, { report: JSON.parse(bytes[arm].toString('utf8')), sha256: hashes[arm] }])),
    structural: { frameImages: {} } };
  for (const arm of ARMS) session.structural.frameImages[arm] = await hashFrameImages(session.arms[arm].report, arm);
  const frozen = kind === 'qualifying' ? session.structural.frozen = frozenFacts(frozenRun, hashes.candidate) : null;
  session.binding = bindingCheck(session, context.knownReportHashes ?? [], registry);
  session.validity = sessionValidity(session, contract, calibrationFor(registry, registered.identity));

  // 5. The rules, only for a valid session.
  const evaluation = session.validity.valid ? JSON.parse(JSON.stringify(evaluatePaired(session, contract))) : null;

  // 6. The session report bytes, with validity and outcome inside, then `closed`.
  const report = sessionReport({ session, evaluation, registrationEventHash, startedEventHash,
    host: { before: context.hostBefore ?? null, after: facts.hostAfter ?? null },
    armPaths: { reference: context.paths.reference, candidate: context.paths.candidate } }, contract);
  const sessionBytes = jsonBytes(report), reportHashes = { session: sha256(sessionBytes), reference: hashes.reference, candidate: hashes.candidate };
  registry = await append(closedEvent(kind, nonce, { valid: session.validity.valid, pass: evaluation ? evaluation.pairedBudgetPass : null,
    settings: session.settings, browserVersion: session.browserVersion, reportHashes,
    ...(frozen ? { frozenExitCode: frozen.exitCode, frozenOverrunCount: frozen.overrunCount } : {}) }));
  const closed = registry.events.at(-1);

  // 7. The remaining reports, and only then anything that carries timing.
  if (kind === 'calibration') await write(context.paths.candidate, bytes.candidate);
  await write(context.paths.reference, bytes.reference);
  await write(context.paths.session, sessionBytes);
  log(JSON.stringify({ kind, nonce, closedSeq: closed.seq, valid: closed.valid, outcome: closed.outcome,
    pairedBudgetPass: evaluation ? evaluation.pairedBudgetPass : null, invalidReasons: session.validity.valid ? [] : session.validity.reasons,
    ...(frozen ? { frozenExitCode: frozen.exitCode, frozenOverrunCount: frozen.overrunCount, frozenExitZeroObserved: frozen.exitCode === 0 } : {}),
    reports: { session: context.paths.session, ...Object.fromEntries(ARMS.map(arm => [arm, context.paths[arm]])) }, reportHashes,
    certification: false }));
  if (frozenRun) log(`Captured output of the unchanged frozen command on the candidate arm (exit ${frozenRun.exitCode}):\n` +
    `${frozenRun.stdout ?? ''}${frozenRun.stderr ?? ''}`);
  return { registry, closed, report, sessionBytes, reportHashes, outcome: closed.outcome };
}

/// ---- command line ----------------------------------------------------------------------------------------

/** Every listed frame image must hash to its recorded value (contract section 5, criterion 3).
 *  Reads the image files; the result goes into the session record as `structural.frameImages`. */
export function frameImageCheck(report) {
  try {
    const cache = path.join(ROOT, '.planning/research/.cache');
    for (const sample of report.samples) for (const frame of sample.sequence) {
      const file = boundedPath(cache, path.relative(cache, path.resolve(ROOT, frame.image)));
      assert.equal(sha256(readFileSync(file)), frame.sha256, `Stale frame image hash: ${frame.image}`);
    }
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
}

/** Reports that exist outside any session: the frozen reference and every complete single-arm
 *  report in the phase evidence directory and the candidate capture cache. A report that carries a
 *  `paired` block is an arm report and is bound by its nonce and the registry instead. */
export function existingReportHashes(budget) {
  const hashes = [budget.referenceReportSha256];
  for (const directory of [path.join(ROOT, EVIDENCE_DIR), path.join(ROOT, '.planning/research/.cache/06-art/animation-candidate')]) {
    if (!existsSync(directory)) continue;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const bytes = readFileSync(path.join(directory, entry.name));
      let report;
      try { report = JSON.parse(bytes.toString('utf8')); } catch { continue; }
      if (Array.isArray(report?.samples) && report.samples.length === 12 && report.identities && !report.paired) hashes.push(sha256(bytes));
    }
  }
  return hashes;
}

async function verifyCommand(values) {
  for (const flag of ['--budget', '--session', '--registry']) assert.ok(values[flag], 'Use verify --budget <frozen V2 budget> --session <session report> --registry <registry>');
  const budgetFile = path.resolve(values['--budget']);
  const run = await verifyOutput({ sessionBytes: readFileSync(path.resolve(values['--session'])),
    registry: JSON.parse(readFileSync(path.resolve(values['--registry']), 'utf8')),
    readArm: async (arm, name) => {
      assert.ok(typeof name === 'string' && name, `Session report names no ${arm} arm report`);
      return readFileSync(boundedPath(ROOT, name));
    },
    hashFrameImages: async report => frameImageCheck(report),
    runFrozen: async name => runFrozenCommand(name, budgetFile),
    knownReportHashes: existingReportHashes(JSON.parse(readFileSync(budgetFile, 'utf8'))) });
  // The result line, or the refusal: the same two streams and exit code that `runVerifyCommand` captures.
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  process.exitCode = run.exitCode;
}

const trackedRegistry = (values, use) => {
  assert.ok(values['--registry'], use);
  const file = path.resolve(values['--registry']);
  assert.equal(path.relative(ROOT, file).split(path.sep).join('/'), REGISTRY_PATH, 'Only the tracked paired session registry is read');
  assert.ok(existsSync(file), 'No paired session registry');
  return file;
};

// Exit 0 only when the chain is valid, every event is in the committed registry and every
// committed version of the file is a prefix of the current event list.
function chainCommand(values) {
  const file = trackedRegistry(values, 'Use chain --registry <registry>');
  const working = readRegistry(file), summary = verifyChain(working);
  verifyLifecycle(working);
  const committed = committedRegistry(), uncommitted = uncommittedEvents(working, committed), committedEvents = committed?.events?.length ?? 0;
  const history = { versions: null, ok: false, error: null };
  try {
    history.versions = historyPrefixCheck(working, registryHistory()).versions;
    if (working.events.length && !history.versions) throw Error('Registry history cannot be read: no committed version of the registry was found');
    history.ok = true;
  } catch (error) { history.error = error.message; }
  const result = { chain: 'valid', events: summary.events, head: summary.head, committedEvents, uncommittedSequences: uncommitted,
    everyEventCommitted: uncommitted.length === 0 && committedEvents === summary.events,
    committedVersions: history.versions, everyCommittedVersionIsPrefix: history.ok, ...(history.error ? { historyError: history.error } : {}) };
  console.log(JSON.stringify(result));
  if (!result.everyEventCommitted || !result.everyCommittedVersionIsPrefix) process.exitCode = 1;
}

// Exit 0 only for `pass`; 1 for `undecided` or `failed`, with the result printed; 2 when the
// verdict is refused (changed contract, broken chain or order, an uncommitted event, a committed
// version that is not a prefix, a history that cannot be read in full).
function verdictCommand(values) {
  const use = 'Use verdict --registry <registry> --identity <source identity hash>';
  assert.ok(HEX64.test(values['--identity'] ?? ''), use);
  let result;
  try {
    assertContract();
    const checked = checkedRegistry(trackedRegistry(values, use));
    result = { ...registryVerdict(checked.registry, values['--identity'], { registrationCommits: checked.registrationCommits }),
      registry: { path: REGISTRY_PATH, sha256: sha256(readFileSync(path.join(ROOT, REGISTRY_PATH))), ...checked.summary } };
  } catch (error) {
    console.error('Verdict refused: ' + error.message);
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.verdict === 'pass' ? 0 : 1;
}

// A reader of existing reports: it captures nothing and writes nothing. The unchanged frozen
// command is run once per distinct report hash. An exit 0 in this list is not a pass by any tool.
function frozenEvaluationsCommand(values) {
  assert.ok(HEX64.test(values['--identity'] ?? ''), 'Use frozen-evaluations --identity <source identity hash>');
  assertContract();
  const identity = values['--identity'], scanned = scanReports();
  const atIdentity = scanned.filter(entry => identityHash(entry.report.identities) === identity), results = {};
  for (const entry of atIdentity) results[entry.sha256] ??= runFrozenCommand(entry.path);
  const evaluations = frozenEvaluationList(atIdentity, identity, results);
  console.log(JSON.stringify({ contractVersion: PAIRED_CONTRACT.version, identity, budget: FROZEN_BUDGET_PATH,
    roots: [...FROZEN_EVALUATION_ROOTS], completeReportsScanned: scanned.length, count: evaluations.length, evaluations,
    frozenExitZeroObserved: evaluations.some(entry => entry.exitZeroObserved), certification: false,
    meaning: 'Every complete candidate report at this source identity that the scan finds, with the result of the unchanged frozen ' +
      'command for it. A frozen exit 0 on a later evaluation is recorded with its count and is for the owner to judge; it is never ' +
      'a pass by this tool. Evaluations made on other source are not in this list.' }));
}

async function cli() {
  const [operation, ...flags] = process.argv.slice(2), values = {};
  for (let i = 0; i < flags.length; i += 2) {
    assert.ok(['--registry', '--budget', '--session', '--identity'].includes(flags[i]) && flags[i + 1] && !values[flags[i]], 'Invalid arguments');
    values[flags[i]] = flags[i + 1];
  }
  if (operation === 'chain') chainCommand(values);
  else if (operation === 'verify') await verifyCommand(values);
  else if (operation === 'verdict') verdictCommand(values);
  else if (operation === 'frozen-evaluations') frozenEvaluationsCommand(values);
  else throw Error('Use chain --registry <registry>, verify --budget <frozen V2 budget> --session <session report> --registry <registry>, ' +
    'verdict --registry <registry> --identity <hash>, or frozen-evaluations --identity <hash>');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error => { console.error(error.message); process.exitCode = 1; });
}

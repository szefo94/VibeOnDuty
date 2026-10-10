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
//
// Sessions are registered and run through `node tools/art/review.mjs --animation-paired`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENTS, canonical, sha256 } from './animation-budget-v2.mjs';
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

/** Re-hash both arms. Exactly the owner files may differ, and all of them must. */
export function compareArms(arms, names, owners) {
  const expected = [...names].sort();
  for (const arm of ['reference', 'candidate']) {
    const present = listFiles(arms[arm]).sort();
    const extra = present.find(name => !expected.includes(name)), missing = expected.find(name => !present.includes(name));
    if (extra || missing) throw Error(`Arm ${arm} does not hold exactly the listed files: ${extra ?? missing}`);
  }
  const differing = expected.filter(name => sha256(readFileSync(path.join(arms.reference, name))) !==
    sha256(readFileSync(path.join(arms.candidate, name))));
  const outside = differing.filter(name => !owners.includes(name));
  if (outside.length) throw Error(`Arms differ outside the five owner files: ${outside[0]}`);
  if (differing.length !== owners.length) throw Error('Arms must differ in exactly the five owner files; ' +
    `${differing.length} differ (${differing.join(', ') || 'none'})`);
  return { comparedFiles: expected.length, differingFiles: differing, count: differing.length, onlyOwnersDiffer: true };
}

/** Copy the served and hashed working-tree files byte for byte into two owned directories
 *  below the cache, then replace exactly the five owner files of the reference directory with
 *  their pinned blobs. No archive, branch, worktree, checkout or install. Any other difference
 *  between the two directories is refused, naming the path. */
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
    const ownersVerified = [];
    for (const name of owners) {
      const bytes = readOwnerBlob(name), pinned = contract.referenceOwners[name];
      assert.ok(Buffer.isBuffer(bytes), `No reference owner bytes: ${name}`);
      assert.equal(gitBlobId(bytes), pinned.blob, `Reference owner bytes are not the pinned blob: ${name}`);
      assert.equal(sha256(bytes), pinned.sha256, `Reference owner bytes differ from the pinned SHA-256: ${name}`);
      writeFileSync(boundedPath(arms.reference, name), bytes);
      ownersVerified.push({ path: name, blob: pinned.blob, sha256: pinned.sha256 });
    }
    return { sessionDirectory, arms, names, difference: { ...compareArms(arms, names, owners), ownersVerified } };
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

/** Appends a `registered` event or throws. Smoke only for now; the other kinds follow. */
export function registerSession(registry, entry, now) {
  verifyChain(registry);
  assert.ok(SESSION_KINDS.includes(entry?.kind), 'Unknown session kind');
  if (entry.kind !== 'smoke') throw Error(`Registration of a ${entry.kind} session is not implemented yet (plan 07-16 task 3)`);
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
  if (ofIdentity.some(event => event.kind !== 'smoke'))
    throw Error('Smoke refused: a calibration or qualifying event exists for this source identity');
  for (const nonce of nonces) {
    const closed = ofIdentity.find(event => event.nonce === nonce && event.type === 'closed');
    if (closed?.structuralFailure !== true)
      throw Error('Smoke refused: a smoke already exists for this source identity and did not fail structurally');
  }
  return appendEvent(registry, { type: 'registered', kind: 'smoke', countable: false, nonce: entry.nonce, commit: entry.commit,
    identity: entry.identity, host: entry.host, toolHashes: entry.toolHashes, samplerIdentity: entry.samplerIdentity }, now);
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

// ---- timing predicate (contract section 4): rule 1 ------------------------------------------------

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

/** Rule 1, per value: `c <= r * (1 + tSingle) + q`, with the frozen comparison allowance. */
export function evaluatePaired(session, contract = PAIRED_CONTRACT) {
  const { tSingle, timerQuantumMs: q, comparisonEpsilonMs: eps } = contract;
  const violations = [];
  let comparisons = 0;
  for (const { profile, reference, candidate } of pairedProfiles(session))
    for (const component of COMPONENTS) for (const stat of STATS) {
      const r = reference.timings?.[component]?.[stat], c = candidate.timings?.[component]?.[stat];
      assert.ok(count(r) && count(c), `Nonfinite timing: ${profile.run}/${profile.tier}/${profile.actorCount} ${component} ${stat}`);
      comparisons++;
      const boundMs = r * (1 + tSingle) + q;
      if (c > boundMs + eps) violations.push({ ...profile, component, stat, referenceMs: r, candidateMs: c, boundMs });
    }
  return { rule1: { comparisons, violations }, pairedBudgetPass: violations.length === 0 };
}

// ---- command line -----------------------------------------------------------------------------------

async function cli() {
  const [operation, ...flags] = process.argv.slice(2), values = {};
  for (let i = 0; i < flags.length; i += 2) {
    assert.ok(['--registry'].includes(flags[i]) && flags[i + 1] && !values[flags[i]], 'Invalid arguments');
    values[flags[i]] = flags[i + 1];
  }
  assert.equal(operation, 'chain', 'Use chain --registry <registry>');
  assert.ok(values['--registry'], 'Use chain --registry <registry>');
  const file = path.resolve(values['--registry']);
  assert.equal(path.relative(ROOT, file).split(path.sep).join('/'), REGISTRY_PATH, 'chain reads the tracked paired session registry');
  assert.ok(existsSync(file), 'No paired session registry');
  const working = readRegistry(file), summary = verifyChain(working), committed = committedRegistry();
  const uncommitted = uncommittedEvents(working, committed), committedEvents = committed?.events?.length ?? 0;
  const result = { chain: 'valid', events: summary.events, head: summary.head, committedEvents, uncommittedSequences: uncommitted,
    everyEventCommitted: uncommitted.length === 0 && committedEvents === summary.events };
  console.log(JSON.stringify(result));
  if (!result.everyEventCommitted) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error => { console.error(error.message); process.exitCode = 1; });
}

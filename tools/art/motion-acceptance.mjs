import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ACCEPTANCE_PATH = 'tools/art/motion-acceptance.json';
export const LOCK_PATH = 'tools/art/.motion-promotion.lock';
export const PROOF_PATH = '.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-crouch-correction-candidate.json';
export const PROOF_SHA256 = 'a940064e30d5cdab323459b7828f63e225b1e0a8cbc379d08dd3e7ca56f64f6e';
export const TUPLE_PATHS = Object.freeze({ glbBytes: 'public/models/enemy.glb',
  donorBytes: 'tools/art/sources/motion.blend', manifestBytes: 'tools/art/motion-manifest.json' });
export const ORIGINAL_TUPLE = Object.freeze({
  'public/models/enemy.glb': '8503964441a36d54d9dada52911f4869ce48bf4e32cf403a7836b9cf53c3b936',
  'tools/art/sources/motion.blend': '5a9e8c4c160cd4d7bb072f724e28dbb52b902f05d75d68a37c68d98449470903',
  'tools/art/motion-manifest.json': 'af139b82f372c8b66c994a519fbe5a685cae23dc5b5153c8607578ef02f296c5',
});
export const CORRECTED_TUPLE = Object.freeze({
  'public/models/enemy.glb': '2a6bbab2034b01b1722f35e8afbdac2948978226d780fd43eb9d6df117196e4e',
  'tools/art/sources/motion.blend': '3d1702ccb3915a14f3647e3db9f08ea14fef25ac9eccc696057b401a6471c463',
  'tools/art/motion-manifest.json': '2b5712506a3c9bb9d76f6f9823bd4f07bea0c283613c0f2ea3a21c125d4e60a5',
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// This payload is authored by the reviewed code. The literal digest below, rather
// than any declared hash inside an input record, establishes its exact identity.
export function acceptanceRecordBytes() {
  return Buffer.from(JSON.stringify({ schemaVersion: 1, revision: '07-CR02-directional-crouch',
    original: ORIGINAL_TUPLE, corrected: CORRECTED_TUPLE,
    permittedActions: ['vod7_crouch_back', 'vod7_crouch_left', 'vod7_crouch_right'],
    candidateProof: { path: PROOF_PATH, sha256: PROOF_SHA256 },
    inheritedOccurrences: 48, unchangedOccurrences: 104, totalOccurrences: 107,
    humanMotionAcceptance: 'pending', phaseQualification: 'open',
    provenance: 'historical originalMotion publication retained unchanged' }, null, 2) + '\n');
}
export const ACCEPTANCE_SHA256 = '8f3c519d8fd87a5c1efcf8add162e30be52257534ec7b960b9c2f4c3d88fe155';

// Refuse every linked component (including links within the root). Bounds use
// path-relative boundaries and the actual root, never a textual prefix match.
export function boundedPath(root, relative) {
  const target = path.resolve(root, relative), r = path.relative(root, target);
  assert.ok(r && !r.startsWith('..') && !path.isAbsolute(r), 'Path escapes owned root');
  let current = target;
  while (true) {
    try { assert.equal(lstatSync(current).isSymbolicLink(), false, 'Linked/reparse path'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  assert.equal(realpathSync(root).toLowerCase(), path.resolve(root).toLowerCase(), 'Linked root');
  return target;
}
export function assertNoMotionTransaction(root = ROOT) {
  assert.equal(existsSync(boundedPath(root, LOCK_PATH)), false, 'Active/incomplete motion transaction; owned rollback required');
}
export function excludeGenericPublication() {
  assertNoMotionTransaction();
  throw Error('Frozen Phase7 publication: generic writers excluded; use the exact reviewed CR02 promoter');
}
export function verifyMotionTuple(identities, bytes, { historicalOriginal = false } = {}) {
  // Check identity presence first so omitted runtime dependencies cannot reuse
  // frozen reports. Then bind all actual buffers to exactly one registered tuple.
  for (const [key, file] of Object.entries(TUPLE_PATHS)) {
    assert.ok(Buffer.isBuffer(bytes[key]), 'Missing actual registered tuple bytes: ' + file);
    assert.equal(identities?.[file], hash(bytes[key]), 'Missing/stale runtime ' + (key === 'manifestBytes' ? 'manifest identity' : 'tuple identity: ' + file));
  }
  const tuple = Object.fromEntries(Object.entries(TUPLE_PATHS).map(([key, file]) => [file, hash(bytes[key])]));
  const original = Object.entries(ORIGINAL_TUPLE).every(([file, value]) => tuple[file] === value);
  const corrected = Object.entries(CORRECTED_TUPLE).every(([file, value]) => tuple[file] === value);
  assert.ok(original || corrected, 'Runtime manifest differs from protected accepted bytes or unregistered/mixed motion tuple');
  if (corrected) {
    assert.ok(Buffer.isBuffer(bytes.acceptanceBytes), 'Missing pinned acceptance registry');
    assert.equal(hash(bytes.acceptanceBytes), ACCEPTANCE_SHA256, 'Forged/changed acceptance registry bytes');
    assert.equal(identities[ACCEPTANCE_PATH], ACCEPTANCE_SHA256, 'Missing/stale acceptance registry identity');
  } else if (!historicalOriginal) {
    assert.equal(bytes.acceptanceBytes, undefined, 'Original tuple requires explicit historical verification after correction');
    assert.equal(identities[ACCEPTANCE_PATH], undefined, 'Mixed original tuple and correction registry');
  }
  return { revision: corrected ? '07-CR02-directional-crouch' : 'original107', tuple,
    acceptanceSha256: corrected ? ACCEPTANCE_SHA256 : null, candidateProofSha256: corrected ? PROOF_SHA256 : null };
}
// The frozen form of this unit test asserts that historical provenance equals the
// current donor, export and manifest, which the correction makes false by design.
// Its one reviewed replacement is pinned the same way as the tuple itself.
export const CORRECTION_DEPENDENTS = Object.freeze({ 'src/builders/enemyGLTF.test.js': Object.freeze({
  original: '990e0a628dafab497e6ccc74c20b3fbd82fcf19ccb1bd590e4e37ca2bfa33c3c',
  corrected: '220594a2af5b7c8ff8d74d593b2e170ebc7e95bbc217adcbf35d08ff4767221f' }) });
// Plan 07-21: the reviewed pause-menu pointer-lock correction to one protected source
// file. One exact pair of hashes and nothing else. `corrected` is the committed content:
// the path is pinned with `text eol=lf`, so every checkout holds these bytes. `guardLines`
// is the number of lines the fix added to the frozen content (carriage returns aside);
// the controls in motion-promotion.test.mjs bind both hashes to the preserved copies in
// evidence/07-21-frozen-bytes.json.
export const REVIEWED_SOURCE_EXCEPTIONS = Object.freeze({ 'src/main.js': Object.freeze({
  original: 'c762044675702688313ce81c7812153bdb30bc95951aa1995e69337414a882d3',
  corrected: 'f768954fff3a55b6b53347e062ff4e06de551ea00e921b461b1ac5a4748bc393',
  hashBasis: 'pinned-lf', guardLines: 6,
  review: '.planning/phases/07-movement-matched-and-action-safe-animation/07-21-SOURCE-EXCEPTION-REVIEW.md' }) });
export function exactCorrectionException(name, reference, current, binding) {
  if (binding.revision !== '07-CR02-directional-crouch') return false;
  if (Object.hasOwn(REVIEWED_SOURCE_EXCEPTIONS, name))
    return reference === REVIEWED_SOURCE_EXCEPTIONS[name].original &&
      current === REVIEWED_SOURCE_EXCEPTIONS[name].corrected;
  if (Object.hasOwn(CORRECTION_DEPENDENTS, name))
    return reference === CORRECTION_DEPENDENTS[name].original && current === CORRECTION_DEPENDENTS[name].corrected;
  return Object.hasOwn(CORRECTED_TUPLE, name) && reference === ORIGINAL_TUPLE[name] &&
    current === CORRECTED_TUPLE[name];
}

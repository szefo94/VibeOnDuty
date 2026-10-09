import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ROOT, ACCEPTANCE_PATH, TUPLE_PATHS, boundedPath, assertNoMotionTransaction,
  verifyMotionTuple } from './motion-acceptance.mjs';
import { existsSync } from 'node:fs';

export const MANIFEST_PATH = 'tools/art/motion-manifest.json';
export const PROVENANCE_PATH = 'tools/art/provenance.json';
// Existing immutable V2 reference identity; this is not a newly approved lineage.
export const PROTECTED_PROVENANCE_SHA256 = '7b8b9b5cfb2f86c2d0890dbc7042c1d010a9196ac6fed75b21a54318e4c451f6';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function runtimeDependencyBytes() {
  assertNoMotionTransaction();
  const bytes = {
    provenanceBytes: readFileSync(boundedPath(ROOT, PROVENANCE_PATH)),
    manifestBytes: readFileSync(new URL('./motion-manifest.json', import.meta.url)),
  };
  for (const [key, file] of Object.entries(TUPLE_PATHS)) bytes[key] = readFileSync(boundedPath(ROOT, file));
  const record = boundedPath(ROOT, ACCEPTANCE_PATH);
  if (existsSync(record)) bytes.acceptanceBytes = readFileSync(record);
  assertNoMotionTransaction();
  return bytes;
}

export function runtimeDependencyIdentities(bytes = runtimeDependencyBytes()) {
  return { ...Object.fromEntries(Object.entries(TUPLE_PATHS).map(([key, file]) => [file, hash(bytes[key])])),
    [PROVENANCE_PATH]: hash(bytes.provenanceBytes),
    ...(bytes.acceptanceBytes ? { [ACCEPTANCE_PATH]: hash(bytes.acceptanceBytes) } : {}) };
}

// Explicit bytes allow mutation controls without changing any protected file.
// A self-declared report hash or forged accepted field alone never establishes trust.
export function verifyRuntimeDependencies(identities, bytes = runtimeDependencyBytes(), options) {
  assertNoMotionTransaction();
  assert.equal(identities?.[PROVENANCE_PATH], PROTECTED_PROVENANCE_SHA256,
    'Missing/changed protected provenance identity');
  const provenanceSha256 = hash(bytes.provenanceBytes);
  assert.equal(provenanceSha256, PROTECTED_PROVENANCE_SHA256, 'Changed protected provenance bytes');
  const accepted = JSON.parse(bytes.provenanceBytes).originalMotion;
  assert.equal(accepted?.manifest, MANIFEST_PATH, 'Missing accepted runtime manifest');
  assert.match(accepted.manifestSha256, /^[a-f0-9]{64}$/, 'Invalid accepted manifest hash');
  const manifestSha256 = hash(bytes.manifestBytes);
  assert.equal(identities[MANIFEST_PATH], manifestSha256, 'Missing/stale runtime manifest identity');
  const motion = verifyMotionTuple(identities, bytes, options);
  assertNoMotionTransaction();
  return { manifestPath: MANIFEST_PATH, manifestSha256, provenancePath: PROVENANCE_PATH,
    provenanceSha256, acceptedManifestSha256: accepted.manifestSha256, motion };
}

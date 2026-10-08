import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const MANIFEST_PATH = 'tools/art/motion-manifest.json';
export const PROVENANCE_PATH = 'tools/art/provenance.json';
// Existing immutable V2 reference identity; this is not a newly approved lineage.
export const PROTECTED_PROVENANCE_SHA256 = '7b8b9b5cfb2f86c2d0890dbc7042c1d010a9196ac6fed75b21a54318e4c451f6';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function runtimeDependencyBytes() {
  return {
    provenanceBytes: readFileSync(new URL('./provenance.json', import.meta.url)),
    manifestBytes: readFileSync(new URL('./motion-manifest.json', import.meta.url)),
  };
}

// Explicit bytes allow mutation controls without changing any protected file.
// A self-declared report hash or forged accepted field alone never establishes trust.
export function verifyRuntimeDependencies(identities, bytes = runtimeDependencyBytes()) {
  assert.equal(identities?.[PROVENANCE_PATH], PROTECTED_PROVENANCE_SHA256,
    'Missing/changed protected provenance identity');
  const provenanceSha256 = hash(bytes.provenanceBytes);
  assert.equal(provenanceSha256, PROTECTED_PROVENANCE_SHA256, 'Changed protected provenance bytes');
  const accepted = JSON.parse(bytes.provenanceBytes).originalMotion;
  assert.equal(accepted?.manifest, MANIFEST_PATH, 'Missing accepted runtime manifest');
  assert.match(accepted.manifestSha256, /^[a-f0-9]{64}$/, 'Invalid accepted manifest hash');
  const manifestSha256 = hash(bytes.manifestBytes);
  assert.equal(manifestSha256, accepted.manifestSha256, 'Runtime manifest differs from protected accepted bytes');
  assert.equal(identities[MANIFEST_PATH], manifestSha256, 'Missing/stale runtime manifest identity');
  return { manifestPath: MANIFEST_PATH, manifestSha256, provenancePath: PROVENANCE_PATH,
    provenanceSha256, acceptedManifestSha256: accepted.manifestSha256 };
}

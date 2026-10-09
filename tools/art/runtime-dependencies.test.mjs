import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { animationIdentities } from './review.mjs';
import { sha256 } from './animation-budget-v2.mjs';
import { MANIFEST_PATH, PROVENANCE_PATH, runtimeDependencyBytes,
  runtimeDependencyIdentities, verifyRuntimeDependencies } from './runtime-dependencies.mjs';

const bytes = runtimeDependencyBytes();
const identities = runtimeDependencyIdentities(bytes);
const changedManifest = JSON.parse(bytes.manifestBytes);
changedManifest.actions.find(action => action.id === 'walk_forward').cycleDisplacement = 12;
const changedBytes = Buffer.from(JSON.stringify(changedManifest));

test('current manifest is bound to the registered actual complete tuple', () => {
  const result = verifyRuntimeDependencies(identities, bytes);
  assert.equal(result.manifestSha256, sha256(bytes.manifestBytes));
  assert.equal(result.motion.tuple[MANIFEST_PATH], result.manifestSha256);
});
test('hashed but unaccepted manifest cannot pass the pure validator', () => {
  assert.throws(() => verifyRuntimeDependencies({ ...identities,
    [MANIFEST_PATH]: sha256(changedBytes) }, { ...bytes, manifestBytes: changedBytes }),
  /differs from protected accepted bytes/);
});
test('forged accepted field and report hashes cannot establish new trust', () => {
  const forged = JSON.parse(bytes.provenanceBytes);
  forged.originalMotion.manifestSha256 = sha256(changedBytes);
  const provenanceBytes = Buffer.from(JSON.stringify(forged));
  assert.throws(() => verifyRuntimeDependencies({ ...identities,
    [MANIFEST_PATH]: sha256(changedBytes), [PROVENANCE_PATH]: sha256(provenanceBytes) },
  { manifestBytes: changedBytes, provenanceBytes }), /protected provenance identity/);
  assert.throws(() => verifyRuntimeDependencies(identities,
    { manifestBytes: changedBytes, provenanceBytes }), /protected provenance bytes/);
});
for (const [name, identity] of [['absent', undefined], ['stale', 'b'.repeat(64)]])
  test('runtime dependency identity fails closed when ' + name, () => {
    const changed = { ...identities }; delete changed[MANIFEST_PATH];
    if (identity) changed[MANIFEST_PATH] = identity;
    assert.throws(() => verifyRuntimeDependencies(changed, bytes), /Missing\/stale runtime manifest identity/);
  });
test('collector includes runtime JSON and detects manifest-only mutation without asset writes', async () => {
  const seen = [];
  const current = await animationIdentities(async filename => {
    seen.push(filename); return readFile(filename);
  });
  assert.equal(current[MANIFEST_PATH], identities[MANIFEST_PATH]);
  assert.ok(seen.some(filename => filename.endsWith(path.join('tools', 'art', 'motion-manifest.json'))));
  await assert.rejects(animationIdentities(filename => filename.endsWith(path.join('tools', 'art', 'motion-manifest.json'))
    ? Promise.resolve(changedBytes) : readFile(filename)), /differs from protected accepted bytes/);
});

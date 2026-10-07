import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { freezeBudget, qualify, verifyCandidate, candidateLineage, producerContract, COMPONENTS, sha256 } from './animation-budget-v2.mjs';

const cli = path.resolve('tools/art/animation-budget-v2.mjs');
const reference = path.resolve('.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-09-view-reference-v2.json');
const referenceBytes = await readFile(reference);
const source = JSON.parse(referenceBytes);
const frozen = freezeBudget(source, referenceBytes, path.relative(process.cwd(), reference).replaceAll('\\', '/'));
const budgetBytes = Buffer.from(JSON.stringify(frozen, null, 2) + '\n');

// Synthetic candidates exercise validator branches only. They are never written
// to the canonical post-optimization evidence and never qualify runtime results.
function fixture() {
  const candidate = structuredClone(source);
  candidate.capturedAt = '2026-10-07T00:00:00.000Z';
  candidate.identities['src/builders/enemyGLTF.js'] = 'a'.repeat(64);
  const identity = sha256(JSON.stringify(candidate.identities));
  for (const s of candidate.samples) {
    s.sourceIdentitySha256 = identity;
    s.ownership.actorSkeletons = s.actorCount;
    for (const entry of s.resourceSamples) entry.textures -= 50 * (s.actorCount - 1);
  }
  candidate.producerContract = producerContract(candidate);
  candidate.v2Lineage = candidateLineage(frozen, budgetBytes, candidate);
  return candidate;
}
const verify = candidate => verifyCandidate(frozen, budgetBytes, candidate, Buffer.from(JSON.stringify(candidate)));

function changeIdentity(candidate, name) {
  candidate.identities[name] = 'b'.repeat(64);
  const identity = sha256(JSON.stringify(candidate.identities));
  for (const sample of candidate.samples) sample.sourceIdentitySha256 = identity;
}

for (const name of ['src/builders/enemyAnimations.js', 'src/builders/weaponHandling.js'])
  test(`reviewed owner mutation is permitted: ${name}`, () => {
    const candidate = fixture(); changeIdentity(candidate, name);
    assert.equal(verify(candidate).applicableBudgetPass, true);
  });

for (const name of ['src/shared/combat.js', 'src/artMaterials.js', 'captureSampler',
  'src/builders/weapon.js', 'src/builders/weaponHandling.test.js', 'src/builders/enemyAnimations.test.js'])
  test(`owner correction retains protection: ${name}`, () => {
    assert.ok(Object.hasOwn(source.identities, name));
    const candidate = fixture(); changeIdentity(candidate, name);
    assert.throws(() => verify(candidate));
  });

test('freeze creates an immutable numeric source-eye contract from the qualified twelve profiles', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'vod-budget-v2-'));
  try {
    const budget = path.join(directory, 'budget.json');
    const result = spawnSync(process.execPath, [cli, 'freeze', '--reference', reference, '--budget', budget], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const frozen = JSON.parse(await readFile(budget, 'utf8'));
    assert.equal(frozen.contractVersion, 'source-eye-view-v2');
    assert.equal(frozen.profiles.length, 6);
    const report = JSON.parse(await readFile(reference, 'utf8'));
    const values = report.samples.filter(s => s.tier === 'low' && s.actorCount === 1).map(s => s.timings.correctionMs.median);
    assert.equal(frozen.profiles[0].timings.correctionMs.medianUpperMs, Math.max(...values) + Math.abs(values[0] - values[1]));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('every component/statistic freezes max plus dispersion without rounding or widening zero', () => {
  for (const p of frozen.profiles) for (const name of COMPONENTS) for (const stat of ['median', 'p95']) {
    const [a, b] = source.samples.filter(s => s.tier === p.tier && s.actorCount === p.actorCount).map(s => s.timings[name][stat]);
    assert.equal(p.timings[name][stat + 'UpperMs'], Math.max(a, b) + Math.abs(a - b));
  }
  assert.equal(frozen.profiles[0].timings.inertiaMs.medianUpperMs, 0);
  assert.equal(frozen.producerContract.timer.comparisonEpsilonMs, 1e-7);
});

test('synthetic matched data exercises acceptance and separately records skeleton texture reduction', () => {
  const result = verify(fixture());
  assert.equal(result.applicableBudgetPass, true);
  assert.equal(result.legacyBudgetPass, false);
  assert.equal(result.reductions.length, 6);
});

for (const [name, change] of [
  ['incomplete matrix', r => r.samples.pop()],
  ['duplicate/missing profile', r => r.samples[1] = structuredClone(r.samples[0])],
  ['mixed render scope', r => r.samples[0].renderScope = 'external-third-person-core'],
  ['different FOV', r => r.samples[0].viewEvidence.fov = 44],
  ['different DPR', r => r.samples[0].dpr = 2],
  ['mixed GPU', r => r.samples[1].gpu = 'other GPU'],
  ['mixed transition workload', r => r.samples[1].transitions[0] = 'other action'],
  ['missing essential arms draw', r => r.samples[0].viewEvidence.draws.arms = 0],
  ['missing body geometry', r => r.samples[0].viewEvidence.selectedVisibleMeshes[1] = 0],
  ['missing allocated view textures', r => r.samples[0].viewEvidence.allocatedBoneTextures = 0],
  ['missing pixels', r => r.samples[0].sequence.pop()],
  ['stale source hash', r => r.samples[0].sourceIdentitySha256 = 'b'.repeat(64)],
  ['shared resource disposal', r => r.samples[0].sharedDisposals = 1],
  ['owned listener leak', r => r.samples[0].afterRetirement.listeners = 1],
  ['unstable plateau', r => r.samples[0].resourceSamples[7].textures += 1],
]) test(`qualification rejects ${name}`, () => {
  const report = structuredClone(source); change(report); assert.throws(() => qualify(report));
});

for (const [name, change] of [
  ['changed producer hash', r => r.identities.captureSampler = 'b'.repeat(64)],
  ['changed clock descriptor', r => r.producerContract.workload.seed++],
  ['different device', r => r.device.hostname = 'other-device'],
  ['changed eye/source root', r => r.samples[0].viewEvidence.sourceRoot[1] += .1],
  ['changed skin/export', r => r.identities['public/models/enemy.glb'] = 'b'.repeat(64)],
  ['stale budget hash', r => r.v2Lineage.budgetSha256 = 'b'.repeat(64)],
  ['warmed growth', r => r.samples[0].resourceSamples.forEach(s => s.geometries++)],
  ['unexplained texture reduction', r => r.samples[0].resourceSamples.forEach(s => s.textures--)],
  ['removed charging geometry', r => r.samples[0].ownership.actorGeometries--],
  ['removed view resource', r => r.samples[0].ownership.view.geometries--],
  ['changed retired floor', r => r.samples[0].afterRetirement.resources.textures++],
  ['reference reuse', r => r.capturedAt = source.capturedAt],
]) test(`verification rejects ${name}`, () => {
  const candidate = fixture(); change(candidate); assert.throws(() => verify(candidate));
});

test('numerical overrun in one actor is a failure even with all eight-actor profiles passing', () => {
  const candidate = fixture();
  candidate.samples[0].timings.viewMs.p95 = frozen.profiles[0].timings.viewMs.p95UpperMs + .1;
  const result = verify(candidate); assert.equal(result.applicableBudgetPass, false);
  assert.equal(result.overruns.length, 1); assert.equal(result.overruns[0].actorCount, 1);
});
test('a quantized zero upper bound rejects a measured tenth of a millisecond', () => {
  const candidate = fixture(); candidate.samples[0].timings.inertiaMs.median = .1;
  assert.equal(verify(candidate).applicableBudgetPass, false);
});

test('CLI refuses frozen replacement, altered numeric budgets and stale full pixels', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'vod-budget-v2-'));
  try {
    const budget = path.join(directory, 'budget.json');
    const invoke = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(invoke(['freeze', '--reference', reference, '--budget', budget]).status, 0);
    const before = await readFile(budget);
    assert.notEqual(invoke(['freeze', '--reference', reference, '--budget', budget]).status, 0);
    assert.deepEqual(await readFile(budget), before);
    const changed = JSON.parse(before); changed.profiles[0].timings.viewMs.medianUpperMs += 1;
    await writeFile(budget, JSON.stringify(changed));
    const rejected = invoke(['verify', '--budget', budget, '--candidate', reference]);
    assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /Changed frozen budget/);
    const stale = structuredClone(source); stale.samples[0].sequence[0].sha256 = 'b'.repeat(64);
    const stalePath = path.join(directory, 'stale.json'); await writeFile(stalePath, JSON.stringify(stale));
    const pixel = invoke(['freeze', '--reference', stalePath, '--budget', path.join(directory, 'new.json')]);
    assert.notEqual(pixel.status, 0); assert.match(pixel.stderr, /Stale pixel hash/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

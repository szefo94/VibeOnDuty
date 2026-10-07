import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

export const CONTRACT_VERSION = 'source-eye-view-v2';
export const COMPONENTS = ['frameIntervalMs', 'mixerMs', 'inertiaMs', 'correctionMs',
  'renderMs', 'selectionMs', 'coreCorrectionMs', 'viewMs'];
const STATS = ['median', 'p95'];
const RESOURCES = ['geometries', 'textures', 'programs'];
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EVIDENCE = '.planning/phases/07-movement-matched-and-action-safe-animation/evidence/';
const ORIGINAL = {
  baselineSha256: '177686a0759ca5b7dc4311e2a6e4bdba15b6c9a844546d51ad1690c00b1b0b20',
  budgetSha256: '66722a272115cdc1145cf1af97a1cb583389d7ea5adb75a4534445c15a14e1ff',
};
const MUTABLE_RUNTIME = ['src/builders/characterResources.js', 'src/builders/enemyGLTF.js',
  'src/builders/firstPersonRig.js', 'src/builders/enemyAnimations.js', 'src/builders/weaponHandling.js'];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const digest = value => sha256(canonical(value));
const numeric = value => assert.ok(Number.isFinite(value) && value >= 0, 'Nonfinite numeric evidence');

// Descriptor of the archived sampler, not a whole CLI file hash. Its exact hash
// binds measurement boundaries, layout, draw predicates, transitions and camera;
// unrelated CLI metadata changes cannot alter the measurement contract.
export function producerContract(report) {
  assert.match(report.identities.captureSampler, /^[a-f0-9]{64}$/);
  return {
    contractVersion: CONTRACT_VERSION, captureSamplerSha256: report.identities.captureSampler,
    components: COMPONENTS, acceptedStatistics: STATS,
    statistics: { median: 'sorted[floor(n/2)]', p95: 'sorted[ceil(n*.95)-1]' },
    correctionSum: 'per-frame selectionMs + coreCorrectionMs + viewMs; statistics taken after sum',
    componentDefinitions: {
      selectionMs: 'sum tickPresentation across source actors',
      coreCorrectionMs: 'sum finishPresentation correction across source actors',
      viewMs: 'source-eye setup plus updateFirstPersonRig and watchView',
      mixerMs: 'sum finishPresentation mixer across source actors',
      inertiaMs: 'sum finishPresentation inertia across source actors',
      renderMs: 'renderComicScene/renderFirstPersonRig plus gl.finish',
      frameIntervalMs: 'native RAF interval through completed rendering; PNG encoding excluded',
    },
    workload: { seed: 67245, mode: 'Training Range', sourceCounts: [1, 8], proxyEntities: 1,
      tiers: ['low', 'medium', 'high'], runs: 2, timedFrames: 214, warmupFrames: 12,
      cloneCycles: 8, simulationStepSeconds: 1 / 20, sampleClock: 'simulation-native-RAF',
      actorLayout: 'savedEyeXZ + (index%4-1.5)*.75 X, floor(index/4)*.8 Z; Y=savedEyeY-1.7',
      sourceScale: [1, 1, 1], sourceRoots: 'fixed through moving-pose playback',
      renderScope: 'source-eye-down-view-replaces-source-0',
      viewport: [1280, 960], dpr: 1, fov: 75, pitch: -1.3, sourcePitchClamp: -1.1,
      sourceEyeHeightPolicy: { standing: 1.65, crouched: 0.85, colocatedXZ: true },
      transitions: report.samples[0].transitions,
      drawPredicate: 'main camera; material visible, colorWrite!=false, opacity>0, nonempty group',
      pixelFrames: [0, 100, 180], viewBoneTextures: 2 },
    timer: { limitation: 'Browser quantization can report zero; binary cancellation in millisecond deltas',
      comparisonEpsilonMs: 1e-7, zeroLimitsAreBinding: true },
  };
}

function viewSettings(view) {
  const names = ['cameraEye', 'cameraPitch', 'fov', 'sourceRoot', 'cameraYaw', 'eyeHeight',
    'sourceScale', 'sourceActorCount', 'proxyEntityCount', 'cameraColocatedXZ', 'selectedVisibleMeshes'];
  return Object.fromEntries(names.map(name => [name, view[name]]));
}
function validateView(view, count) {
  assert.equal(view?.attached, true, 'Missing attached essential view');
  assert.equal(view.allocatedBoneTextures, 2, 'Missing allocated view bone textures');
  for (const name of ['arms', 'body', 'weapon']) assert.ok(view.draws?.[name] > 0, 'Missing essential view draws');
  assert.equal(view.selectedVisibleMeshes.length, 2);
  assert.ok(view.selectedVisibleMeshes.every(n => Number.isInteger(n) && n > 0), 'Empty essential view');
  assert.equal(view.sourceActorCount, count); assert.equal(view.proxyEntityCount, 1);
  assert.equal(view.cameraColocatedXZ, true); assert.equal(view.fov, 75);
  assert.equal(view.cameraPitch, -1.3); assert.equal(view.cameraYaw, Math.PI);
  assert.deepEqual(view.sourceScale, [1, 1, 1]);
  assert.equal(view.cameraEye[0], view.sourceRoot[0]); assert.equal(view.cameraEye[2], view.sourceRoot[2]);
  assert.ok([1.65, 0.85].some(n => Math.abs(n - view.eyeHeight) < 1e-12));
  assert.ok(Math.abs(view.cameraEye[1] - view.sourceRoot[1] - view.eyeHeight) < 1e-12);
}

export function qualify(report) {
  assert.equal(report.schemaVersion, 1); assert.equal(report.complete, true, 'Incomplete report');
  assert.equal(report.certification, false); assert.equal(report.humanMotionAcceptance, 'pending');
  assert.deepEqual(report.cleanup, { browserClosed: true, serverClosed: true });
  assert.equal(report.baselineSha256, ORIGINAL.baselineSha256);
  assert.equal(report.comparison.legacyBudgetPass, false, 'Original legacy failure must remain explicit');
  assert.equal(report.comparison.cameraWorkloadComparable, false);
  assert.equal(report.samples.length, 12, 'Incomplete twelve-profile matrix');
  const seen = new Set(), identity = sha256(JSON.stringify(report.identities));
  for (const s of report.samples) {
    const key = `${s.run}/${s.tier}/${s.actorCount}`;
    assert.ok(!seen.has(key), 'Duplicate profile'); seen.add(key);
    assert.ok([1, 2].includes(s.run) && ['low', 'medium', 'high'].includes(s.tier) && [1, 8].includes(s.actorCount));
    assert.equal(s.renderScope, 'source-eye-down-view-replaces-source-0', 'Mixed or wrong render scope');
    assert.equal(s.sourceIdentitySha256, identity, 'Stale source identity');
    assert.equal(s.gpu, report.samples[0].gpu, 'Mixed GPU');
    assert.equal(s.renderer, report.samples[0].renderer, 'Mixed renderer');
    assert.deepEqual(s.transitions, report.samples[0].transitions, 'Mixed transition workload');
    assert.equal(s.browser, report.device.browser); assert.deepEqual(s.viewport, [1280, 960]);
    assert.equal(s.dpr, 1); assert.equal(s.frameCount, 214); assert.equal(s.warmupFrames, 12);
    assert.equal(s.simulationStepSeconds, 1 / 20); assert.ok(s.human && s.packedMaps > 0 && s.keeperIntact && s.restored);
    assert.equal(s.sharedDisposals, 0, 'Shared disposal'); assert.ok(!s.failure);
    assert.ok(s.movingPoseCount > 10); assert.equal(s.resourceSamples.length, 8);
    for (const entry of s.resourceSamples) for (const name of RESOURCES) numeric(entry[name]);
    for (const entry of s.resourceSamples.slice(4)) assert.deepEqual(entry, s.resourceSamples[3], 'Unstable plateau');
    for (const name of ['listeners', 'callbacks', 'props', 'actors', 'activeBindings'])
      assert.equal(s.afterRetirement[name], 0, 'Owned retirement failed');
    for (const name of RESOURCES) numeric(s.afterRetirement.resources[name]);
    for (const name of COMPONENTS) for (const stat of STATS) numeric(s.timings[name]?.[stat]);
    validateView(s.viewEvidence, s.actorCount);
    assert.equal(s.sequence.length, 3, 'Missing pixel evidence');
    assert.deepEqual(s.sequence.map(f => f.frame), [0, 100, 180]);
    for (const frame of s.sequence) {
      validateView(frame.viewEvidence, s.actorCount); assert.equal(frame.simulationTime, frame.frame / 20);
      assert.ok(frame.image); assert.match(frame.sha256, /^[a-f0-9]{64}$/);
    }
  }
  return producerContract(report);
}

export function freezeBudget(reference, referenceBytes, referencePath) {
  const producer = qualify(reference), profiles = [];
  for (const tier of ['low', 'medium', 'high']) for (const actorCount of [1, 8]) {
    const pair = reference.samples.filter(s => s.tier === tier && s.actorCount === actorCount);
    for (const name of ['gpu', 'renderer', 'transitions', 'ownership', 'resourceSamples', 'afterRetirement'])
      assert.deepEqual(pair[0][name], pair[1][name], 'Mixed reference settings/resources');
    assert.deepEqual(viewSettings(pair[0].viewEvidence), viewSettings(pair[1].viewEvidence));
    const timings = Object.fromEntries(COMPONENTS.map(name => [name, Object.fromEntries(STATS.map(stat => {
      const [a, b] = pair.map(s => s.timings[name][stat]);
      return [`${stat}UpperMs`, Math.max(a, b) + Math.abs(a - b)];
    }))]));
    profiles.push({ tier, actorCount, gpu: pair[0].gpu, renderer: pair[0].renderer, timings,
      warmedPlateau: pair[0].resourceSamples[3], afterRetirement: pair[0].afterRetirement.resources,
      ownership: pair[0].ownership, viewSettings: viewSettings(pair[0].viewEvidence),
      pixelSettings: pair[0].sequence.map(f => viewSettings(f.viewEvidence)) });
  }
  return { contractVersion: CONTRACT_VERSION, frozenBeforeRuntimeTuning: true,
    referenceReportSha256: sha256(referenceBytes), referencePath,
    original: ORIGINAL, referenceCapturedAt: reference.capturedAt,
    referenceSourceIdentitySha256: sha256(JSON.stringify(reference.identities)),
    referenceIdentities: reference.identities, device: reference.device,
    producerContract: producer, producerContractSha256: digest(producer),
    formula: 'max(run1, run2) + abs(run1 - run2)', profiles,
    structuralAdditions: { chargingGeometriesPerSource: 1, viewSkeletons: 2, viewMixers: 0,
      viewGeometries: 131, requiredViewParts: ['arms', 'body', 'weapon'] },
    resourceReductionPolicy: 'Per-source exact-equal skeletons 51 to 1; 50 textures per visible source; shared/view/geometry domains unchanged',
    rationale: 'Original external FOV44/legacy selector differs from essential source-eye FOV75/current correction producer. Preserve original false comparisons.',
  };
}

export function candidateLineage(budget, budgetBytes, report) {
  return { contractVersion: CONTRACT_VERSION, referenceReportSha256: budget.referenceReportSha256,
    budgetSha256: sha256(budgetBytes), producerContractSha256: digest(producerContract(report)), original: ORIGINAL };
}

export function verifyCandidate(budget, budgetBytes, candidate, candidateBytes) {
  const producer = qualify(candidate);
  assert.equal(budget.contractVersion, CONTRACT_VERSION);
  assert.deepEqual(budget.original, ORIGINAL); assert.equal(budget.producerContractSha256, digest(budget.producerContract));
  assert.deepEqual(producer, budget.producerContract, 'Producer/settings changed');
  assert.deepEqual(candidate.producerContract, producer, 'Candidate producer descriptor missing/changed');
  assert.deepEqual(candidate.device, budget.device, 'Device changed');
  assert.deepEqual(candidate.v2Lineage, candidateLineage(budget, budgetBytes, candidate), 'Stale lineage/budget hash');
  assert.notEqual(sha256(candidateBytes), budget.referenceReportSha256, 'Reference reused as candidate');
  assert.ok(Date.parse(candidate.capturedAt) > Date.parse(budget.referenceCapturedAt), 'Reference reused as candidate');
  assert.notEqual(sha256(JSON.stringify(candidate.identities)), budget.referenceSourceIdentitySha256, 'Reference source reused as candidate');
  for (const [name, identity] of Object.entries(budget.referenceIdentities))
    if (!MUTABLE_RUNTIME.includes(name)) assert.equal(candidate.identities[name], identity, `Protected source changed: ${name}`);
  const overruns = [], reductions = [];
  for (const s of candidate.samples) {
    const p = budget.profiles.find(p => p.tier === s.tier && p.actorCount === s.actorCount);
    assert.ok(p, 'Missing budget profile'); assert.equal(s.gpu, p.gpu); assert.equal(s.renderer, p.renderer);
    assert.deepEqual(viewSettings(s.viewEvidence), p.viewSettings, 'Camera/settings/essential geometry changed');
    assert.deepEqual(s.sequence.map(f => viewSettings(f.viewEvidence)), p.pixelSettings, 'Pixel settings changed');
    for (const name of COMPONENTS) for (const stat of STATS) {
      const actual = s.timings[name][stat], upper = p.timings[name][`${stat}UpperMs`]; numeric(upper);
      if (actual > upper + budget.producerContract.timer.comparisonEpsilonMs)
        overruns.push({ run: s.run, tier: s.tier, actorCount: s.actorCount, component: name, stat, actualMs: actual, upperMs: upper });
    }
    const ownership = { ...s.ownership, actorSkeletons: p.ownership.actorSkeletons };
    assert.deepEqual(ownership, p.ownership, 'Ownership/essential resource changed');
    assert.equal(s.ownership.actorSkeletons, s.actorCount, 'World skeleton consolidation missing');
    for (const name of RESOURCES) {
      const actual = s.resourceSamples[3][name], before = p.warmedPlateau[name];
      const reduction = name === 'textures' ? 50 * (s.actorCount - 1) : 0;
      assert.equal(actual, before - reduction, 'Unexplained warmed growth/reduction');
      assert.equal(s.afterRetirement.resources[name], p.afterRetirement[name], 'Retired resource plateau changed');
      if (reduction) reductions.push({ run: s.run, tier: s.tier, actorCount: s.actorCount, resource: name, before, after: actual });
    }
  }
  return { ...candidate.v2Lineage, candidateReportSha256: sha256(candidateBytes),
    applicableBudgetPass: overruns.length === 0, legacyBudgetPass: false,
    legacyCameraWorkloadComparable: false, overruns, reductions, certification: false };
}

async function pixels(report) {
  for (const s of report.samples) for (const frame of s.sequence) {
    const filename = path.resolve(ROOT, frame.image), cache = path.resolve(ROOT, '.planning/research/.cache');
    assert.ok(filename.startsWith(cache + path.sep), 'Pixel file outside evidence cache');
    const bytes = await readFile(filename); assert.equal(sha256(bytes), frame.sha256, 'Stale pixel hash');
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), 1280); assert.equal(bytes.readUInt32BE(20), 960);
    assert.equal(bytes[24], 8); assert.ok([2, 6].includes(bytes[25]));
    const compressed = [];
    for (let at = 8; at < bytes.length;) {
      const size = bytes.readUInt32BE(at), type = bytes.toString('ascii', at + 4, at + 8);
      if (type === 'IDAT') compressed.push(bytes.subarray(at + 8, at + 8 + size));
      at += size + 12;
    }
    const raw = inflateSync(Buffer.concat(compressed)), channels = bytes[25] === 6 ? 4 : 3;
    assert.equal(raw.length, (1280 * channels + 1) * 960, 'Truncated full pixel data');
    assert.ok(new Set(raw).size > 16, 'Empty pixel evidence');
  }
}
async function originalFiles() {
  assert.equal(sha256(await readFile(path.join(ROOT, EVIDENCE, '07-baseline.json'))), ORIGINAL.baselineSha256);
  assert.equal(sha256(await readFile(path.join(ROOT, EVIDENCE, '07-budget.json'))), ORIGINAL.budgetSha256);
}
async function verifyFrozen(budget) {
  const referenceBytes = await readFile(path.resolve(ROOT, budget.referencePath));
  assert.equal(sha256(referenceBytes), budget.referenceReportSha256, 'Changed frozen reference');
  assert.equal(sha256(await readFile(path.join(ROOT, EVIDENCE, '07-09-cost-report.json'))),
    budget.referenceReportSha256, 'Changed original failed cost report');
  assert.deepEqual(budget, freezeBudget(JSON.parse(referenceBytes), referenceBytes, budget.referencePath), 'Changed frozen budget');
}
async function cli() {
  const [operation, ...flags] = process.argv.slice(2), values = {};
  assert.ok(['freeze', 'verify'].includes(operation), 'Use freeze --reference --budget or verify --budget --candidate');
  for (let i = 0; i < flags.length; i += 2) {
    assert.ok(['--reference', '--budget', '--candidate'].includes(flags[i]) && flags[i + 1] && !values[flags[i]], 'Invalid arguments');
    values[flags[i]] = flags[i + 1];
  }
  await originalFiles(); assert.ok(values['--budget']);
  if (operation === 'freeze') {
    assert.ok(values['--reference'] && !values['--candidate']);
    const referenceBytes = await readFile(values['--reference']), report = JSON.parse(referenceBytes);
    const budget = freezeBudget(report, referenceBytes, path.relative(ROOT, path.resolve(values['--reference'])).replaceAll('\\', '/'));
    await pixels(report);
    // O_EXCL refuses any overwrite/rebaseline, even identical bytes.
    await writeFile(values['--budget'], JSON.stringify(budget, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ frozen: true, referenceReportSha256: budget.referenceReportSha256,
      budgetSha256: sha256(await readFile(values['--budget'])), producerContractSha256: budget.producerContractSha256 }));
  } else {
    assert.ok(values['--candidate'] && !values['--reference']);
    const budgetBytes = await readFile(values['--budget']), budget = JSON.parse(budgetBytes);
    await verifyFrozen(budget);
    const bytes = await readFile(values['--candidate']), report = JSON.parse(bytes);
    for (const [name, identity] of Object.entries(report.identities)) if (name !== 'captureSampler')
      assert.equal(sha256(await readFile(path.join(ROOT, name))), identity, `Stale current source hash: ${name}`);
    const result = verifyCandidate(budget, budgetBytes, report, bytes); await pixels(report);
    console.log(JSON.stringify(result)); if (!result.applicableBudgetPass) process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error => { console.error(error.message); process.exitCode = 1; });
}

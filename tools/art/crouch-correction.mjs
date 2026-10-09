import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { ROOT, PIN, hash, run, bootstrap, iterationPath } from './pipeline.mjs';
import { MOTION_CACHE, MANIFEST, BASELINE, parseManifest, exportMotion, validateListedMotion } from './motion-pipeline.mjs';
import { parseGLB, encodeGLB, accessor, compareSemanticExports } from './inspect-character.mjs';
import { verifyRuntimeDependencies } from './runtime-dependencies.mjs';
import { ACCEPTANCE_PATH } from './motion-acceptance.mjs';

export const CHANGED = ['vod7_crouch_back', 'vod7_crouch_left', 'vod7_crouch_right'];
const PROTECTED = ['public/models/enemy.glb', 'tools/art/sources/motion.blend',
  'tools/art/motion-manifest.json', 'tools/art/provenance.json', 'tools/art/sources/soldier.blend',
  'tools/art/character-params.json', 'tools/art/build_soldier.py', 'public/textures/comic-slice.png'];
export async function identities() {
  const names = [...PROTECTED];
  try { await fs.access(path.join(ROOT, ACCEPTANCE_PATH)); names.push(ACCEPTANCE_PATH); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return Object.fromEntries(await Promise.all(names.map(async (file) =>
    [file, hash(await fs.readFile(path.join(ROOT, file)))])));
}
export function clipChannels(asset, clip) {
  return clip.channels.map((c) => {
    const s = clip.samplers[c.sampler];
    return { bone: asset.json.nodes[c.target.node].name, path: c.target.path,
      interpolation: s.interpolation, times: accessor(asset, s.input), values: accessor(asset, s.output) };
  });
}
// Independent native mixer evaluation of real exported channel data. Body heading is fixed.
export function sampleCrouch(asset, direction) {
  const root = new THREE.Group();
  const nodes = asset.json.nodes.map((n) => {
    const o = new THREE.Object3D(); o.name = n.name;
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); }
    return o;
  });
  const children = new Set();
  asset.json.nodes.forEach((n, i) => (n.children || []).forEach((j) => { nodes[i].add(nodes[j]); children.add(j); }));
  nodes.forEach((n, i) => { if (!children.has(i)) root.add(n); });
  const a = asset.json.animations.find((n) => n.name === 'vod7_crouch_' + direction);
  assert.ok(a, 'Directional source exists');
  const tracks = clipChannels(asset, a).map((c) => new (c.path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack)(
    c.bone + (c.path === 'rotation' ? '.quaternion' : '.position'), c.times, c.values));
  const clip = new THREE.AnimationClip(a.name, -1, tracks), mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true; action.play();
  const samples = [];
  for (let i = 0; i <= 72; i++) {
    mixer.setTime(clip.duration * i / 72); root.updateMatrixWorld(true);
    const row = { phase: i / 72 };
    for (const bone of ['pelvis', 'thigh_l', 'thigh_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r']) {
      const o = root.getObjectByName(bone); assert.ok(o);
      row[bone] = o.getWorldPosition(new THREE.Vector3()).toArray();
      row[bone + 'Quaternion'] = o.getWorldQuaternion(new THREE.Quaternion()).toArray();
    }
    samples.push(row);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(root); root.clear();
  return { duration: clip.duration, samples };
}
export async function validateCorrection(candidate, accepted) {
  verifyRuntimeDependencies(await identities());
  const read = async (file) => parseGLB(Buffer.isBuffer(file) ? file : await fs.readFile(file));
  const c = await read(candidate), b = await read(accepted);
  const provenance = JSON.parse(await fs.readFile(path.join(ROOT, 'tools/art/provenance.json'), 'utf8'));
  assert.equal(b.byteHash, provenance.originalMotion.publishedSha256, 'Accepted current107 publication identity');
  validateListedMotion(c, parseManifest(await fs.readFile(MANIFEST, 'utf8')), 48);
  assert.equal(c.json.animations.length, 107); assert.equal(b.json.animations.length, 107);
  assert.deepEqual(c.json.animations.map((a) => a.name), b.json.animations.map((a) => a.name), 'Names/occurrence order preserved');
  const changes = [];
  for (let i = 0; i < 107; i++) {
    const ca = clipChannels(c, c.json.animations[i]), ba = clipChannels(b, b.json.animations[i]);
    const changed = JSON.stringify(ca) !== JSON.stringify(ba);
    if (changed) changes.push(c.json.animations[i].name);
    if (CHANGED.includes(c.json.animations[i].name)) {
      assert.ok(changed, 'Unchanged directional correction');
      assert.deepEqual(ca.map(({ bone, path, interpolation }) => ({ bone, path, interpolation })),
        ba.map(({ bone, path, interpolation }) => ({ bone, path, interpolation })), 'Channel targets preserved');
      ca.forEach((channel, j) => assert.equal(channel.times.at(-1), ba[j].times.at(-1), 'Duration preserved'));
      assert.deepEqual(c.json.animations[i].extras, b.json.animations[i].extras, 'Authored slot identity preserved');
    } else assert.equal(changed, false, 'Unrelated motion changed: ' + c.json.animations[i].name);
  }
  assert.deepEqual(changes, CHANGED, 'Exactly three changed actions');
  const without = (a) => { const json = structuredClone(a.json); json.animations = json.animations.filter((n) => !CHANGED.includes(n.name)); return encodeGLB(json, a.binary); };
  const protectedCheck = await compareSemanticExports(without(c), without(b), { tolerance: 0 });
  assert.ok(protectedCheck.equal, 'Protected render/skin/material/image/104-clip domains unchanged');
  const trajectories = Object.fromEntries(['forward', 'back', 'left', 'right'].map((d) => [d, sampleCrouch(c, d)]));
  const sweep = (d, axis) => trajectories[d].samples[18].foot_l[axis] - trajectories[d].samples[54].foot_l[axis];
  assert.ok(sweep('forward', 2) < -.1 && sweep('back', 2) > .1, 'Sagittal stride sign');
  assert.ok(sweep('left', 0) < -.1 && sweep('right', 0) > .1, 'Lateral stride sign');
  for (const d of ['left', 'right']) {
    assert.ok(Math.abs(sweep(d, 2)) < .001, 'Lateral primary movement plane');
    const a = trajectories[d].samples[18].foot_lQuaternion, b = trajectories[d].samples[54].foot_lQuaternion;
    assert.ok(Math.abs(a.reduce((sum, value, i) => sum + value * b[i], 0)) > .999999, 'Counter-rolled contact sole');
  }
  for (const trace of Object.values(trajectories)) {
    for (const sample of trace.samples) for (const axis of [0, 1, 2])
      assert.ok(Math.abs(sample.pelvis[axis] - trace.samples[0].pelvis[axis]) < 1e-5, 'Steady crouch/no root travel');
    for (const bone of ['foot_l', 'foot_r']) trace.samples[0][bone].forEach((v, axis) =>
      assert.ok(Math.abs(v - trace.samples.at(-1)[bone][axis]) < 1e-5, 'Cyclic foot contact'));
  }
  return { changedClips: changes, unchangedOccurrences: 104, inheritedOccurrences: 48,
    otherOriginalActions: 56, protectedCheck, trajectories };
}
export async function buildCorrection() {
  const before = await identities();
  verifyRuntimeDependencies(before);
  // Verify the existing portable qualification before bootstrap; never download a runtime.
  const archive = path.join(ROOT, '.planning/research/.cache/06-art/blender.zip');
  assert.equal(hash(await fs.readFile(archive)), PIN.sha256, 'Existing pinned runtime required');
  const exe = await bootstrap();
  await fs.mkdir(MOTION_CACHE, { recursive: true });
  const directory = await fs.mkdtemp(path.join(MOTION_CACHE, 'crouch-correction-'));
  await iterationPath([MOTION_CACHE], directory);
  const source = path.join(directory, 'motion.blend'), manifestPath = path.join(directory, 'candidate.manifest.json');
  const accepted = path.join(directory, 'accepted107.glb'); await fs.copyFile(BASELINE, accepted);
  const retained = JSON.parse(await fs.readFile(path.join(MOTION_CACHE, 'publication.json'), 'utf8'));
  await iterationPath([MOTION_CACHE], retained.baseline);
  const manifest = parseManifest(await fs.readFile(MANIFEST, 'utf8'));
  assert.equal(manifest.sourceHash, before['tools/art/sources/motion.blend'], 'Accepted donor source identity required');
  assert.equal(hash(await fs.readFile(retained.baseline)), manifest.baselineHash, 'Qualified inherited seam required');
  const baseline = path.join(directory, 'inherited48.glb'); await fs.copyFile(retained.baseline, baseline);
  const blender = async (mode, out) => run(exe, ['--background', '--factory-startup', '--disable-autoexec',
    '--python-exit-code', '1', '--python', 'tools/art/build_motion.py', '--', '--mode', mode,
    '--source', path.join(ROOT, 'tools/art/sources/motion.blend'), '--manifest', MANIFEST,
    '--baseline', baseline, '--out', out]);
  // Try the ordinary neutral/rest generator first; exact comparison decides whether
  // the retained donor requires its narrower action-only edit instead.
  await blender('author', source);
  manifest.sourceHash = hash(await fs.readFile(source));
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  let output = path.join(directory, 'candidate.glb'), fallback = false;
  await exportMotion(source, manifestPath, baseline, output);
  let check;
  try { check = await validateCorrection(output, accepted); }
  catch (error) {
    if (!error.message.startsWith('Unrelated motion changed:')) throw error;
    fallback = true;
    const narrowSource = path.join(directory, 'retained-corrected.blend');
    await blender('correct-crouch', narrowSource);
    manifest.sourceHash = hash(await fs.readFile(narrowSource));
    const narrowManifest = path.join(directory, 'retained-corrected.manifest.json');
    await fs.writeFile(narrowManifest, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    output = path.join(directory, 'retained-corrected.glb');
    await exportMotion(narrowSource, narrowManifest, baseline, output);
    check = await validateCorrection(output, accepted);
  }
  assert.deepEqual(await identities(), before, 'Accepted inputs changed during candidate work');
  const report = { schemaVersion: 1, status: 'candidate_fixed_not_promoted', complete: false,
    pending: ['independent reopened export', 'direction/contact tests', 'actual-browser visual proof', 'parent promotion/lineage review', 'human motion acceptance'],
    directory, source: fallback ? path.join(directory, 'retained-corrected.blend') : source,
    manifest: fallback ? path.join(directory, 'retained-corrected.manifest.json') : manifestPath,
    baseline, accepted, output, fallback, acceptedBefore: before, acceptedAfter: await identities(),
    hashes: { output: hash(await fs.readFile(output)), source: manifest.sourceHash },
    runtime: { version: '4.5.13 LTS', archiveHash: PIN.sha256, executableHash: hash(await fs.readFile(exe)) },
    scripts: Object.fromEntries(await Promise.all(['build_motion.py', 'crouch-correction.mjs', 'motion-pipeline.mjs', 'inspect-character.mjs'].map(async (file) => [file, hash(await fs.readFile(path.join(ROOT, 'tools/art', file)))]))),
    check };
  await fs.writeFile(path.join(directory, 'candidate-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ directory, output, source: report.source, changedClips: check.changedClips, fallback }));
  return report;
}
export async function sealCorrection(directory, mediaDirectory) {
  await iterationPath([MOTION_CACHE], directory);
  assert.ok(path.basename(directory).startsWith('crouch-correction-'));
  await iterationPath([directory], mediaDirectory);
  const initial = JSON.parse(await fs.readFile(path.join(directory, 'candidate-report.json'), 'utf8'));
  for (const key of ['source', 'manifest', 'baseline', 'accepted', 'output']) await iterationPath([directory], initial[key]);
  const manifest = parseManifest(await fs.readFile(initial.manifest, 'utf8'));
  const canonical = parseManifest(await fs.readFile(MANIFEST, 'utf8'));
  assert.deepEqual({ ...manifest, sourceHash: canonical.sourceHash }, canonical, 'Only candidate sourceHash changes');
  assert.equal(hash(await fs.readFile(initial.source)), manifest.sourceHash);
  assert.equal(hash(await fs.readFile(initial.output)), initial.hashes.output);
  const independent = path.join(directory, 'independent.glb'); await iterationPath([directory], independent);
  const comparison = await compareSemanticExports(initial.output, independent, { tolerance: 0 });
  assert.ok(comparison.equal && comparison.byteIdentical, 'Independent reopened export must be byte exact');
  const check = await validateCorrection(initial.output, initial.accepted);
  await validateCorrection(independent, initial.accepted);
  const visualPath = path.join(mediaDirectory, 'visual-report.json');
  const visual = JSON.parse(await fs.readFile(visualPath, 'utf8'));
  assert.equal(visual.complete, true); assert.equal(visual.published, false);
  assert.deepEqual(await identities(), initial.acceptedBefore);
  assert.deepEqual(visual.acceptedAfter, initial.acceptedBefore);
  for (const row of visual.media) {
    await iterationPath([mediaDirectory], row.video.file);
    assert.equal(hash(await fs.readFile(row.video.file)), row.video.hash);
    assert.equal(row.sharedDisposals, 0); assert.equal(row.keeperPreserved, true);
    for (const context of row.rows) for (const frame of context.images) {
      await iterationPath([mediaDirectory], path.join(mediaDirectory, frame.file));
      assert.equal(hash(await fs.readFile(path.join(mediaDirectory, frame.file))), frame.hash);
    }
  }
  const { animationIdentities } = await import('./review.mjs');
  const packet = { ...initial, complete: true, status: 'candidate_fixed_not_promoted',
    published: false, pending: ['parent independent promotion/lineage review', 'human moving quality acceptance', 'existing Phase7/09/10 qualification'],
    sourceHash: manifest.sourceHash, manifestHash: hash(await fs.readFile(initial.manifest)),
    independent, independentHash: hash(await fs.readFile(independent)), independentComparison: comparison,
    check, acceptedAfter: await identities(), currentRuntimeIdentities: await animationIdentities(),
    visual: { report: visualPath, reportHash: hash(await fs.readFile(visualPath)), index: path.join(mediaDirectory, 'index.html'),
      port: visual.port, ownedListenerClosed: visual.ownedListenerClosed, viewport: visual.viewport, tier: visual.tier,
      directions: 8, frames: visual.media.reduce((n, m) => n + m.rows.reduce((v, r) => v + r.samples.length, 0), 0),
      pngs: 24, videos: visual.media.map((m) => m.video), keeperPreserved: true, sharedDisposals: 0,
      physicalGunQuality: 'unmounted-source; no claim', humanAcceptance: 'pending', representativeDeviceFps: 'unqualified' },
    scriptsAtBuild: initial.scripts,
    validatorsAtSeal: Object.fromEntries(await Promise.all(['build_motion.py', 'crouch-correction.mjs', 'crouch-correction-review.mjs',
      'crouch-correction.test.mjs', 'motion-pipeline.mjs', 'inspect-character.mjs'].map(async (file) => [file, hash(await fs.readFile(path.join(ROOT, 'tools/art', file)))]))),
    semantics: 'Only three directional crouch actions were reauthored. Current107 source comparison preserves104 exact inherited/original occurrences and all art/skin/material/image/root domains. Source/manifest/publication/provenance remain unchanged; candidate proof does not authorize publication or replace fixed V2 lineage.' };
  const destination = path.join(ROOT, '.planning/phases/07-movement-matched-and-action-safe-animation/evidence/07-crouch-correction-candidate.json');
  await fs.writeFile(destination, JSON.stringify(packet, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: packet.status, complete: true, report: destination, index: packet.visual.index,
    sourceHash: packet.sourceHash, manifestHash: packet.manifestHash, outputHash: packet.hashes.output }));
  return packet;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let operation;
  if (process.argv.slice(2).join(' ') === 'build --candidate') operation = buildCorrection;
  else if (process.argv.length === 5 && process.argv[2] === 'seal') operation = () => sealCorrection(path.resolve(process.argv[3]), path.resolve(process.argv[4]));
  else throw Error('Use build --candidate or seal <candidate-directory> <owned-media-directory>');
  operation().catch((error) => { console.error(error); process.exitCode = 1; });
}

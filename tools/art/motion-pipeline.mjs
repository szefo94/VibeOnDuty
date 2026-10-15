import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ROOT, SOURCES, PIN, hash, owned, bootstrap, run, iterationPath } from './pipeline.mjs';
import { parseGLB, encodeGLB, accessor, compareSemanticExports, inspectMotionCandidate,
  compareMotionExports } from './inspect-character.mjs';

export const MOTION_CACHE = path.join(ROOT, '.cache/motion');
export const MANIFEST = path.join(ROOT, 'tools/art/motion-manifest.json');
export const BASELINE = path.join(ROOT, 'public/models/enemy.glb');
const SOURCE = path.join(SOURCES, 'motion.blend');
const SCRIPT = path.join(ROOT, 'tools/art/build_motion.py');
const fields = (value, keys, label) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Exact fields: ' + label);
};
const identifier = (s) => typeof s === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(s);
export function validateManifest(m) {
  fields(m, ['schemaVersion', 'source', 'sourceHash', 'baselineHash', 'targetJoints', 'actions'], 'manifest');
  assert.equal(m.schemaVersion, 1);
  assert.equal(m.source, 'tools/art/sources/motion.blend');
  for (const h of [m.sourceHash, m.baselineHash]) assert.match(h, /^[a-f0-9]{64}$/);
  assert.equal(m.targetJoints, 65);
  assert.ok(Array.isArray(m.actions) && m.actions.length > 0 && m.actions.length <= 64);
  for (const key of ['id', 'clip', 'donorAction'])
    assert.equal(new Set(m.actions.map((a) => a[key])).size, m.actions.length, 'Duplicate ' + key);
  for (const a of m.actions) {
    const authored = Object.hasOwn(a, 'kind');
    fields(a, ['id', 'clip', 'donorAction', 'donorSlot', 'boneMap', 'frames', 'fps', 'loop',
      'cycleDisplacement', 'markers', 'torsoLimit', ...(authored ? ['kind', 'weapon',
        'direction', 'aliases', 'previewOnly', 'phaseOwner', 'durationSeconds',
        'contactTargets', 'mechanism', 'bodyDrop'] : [])], 'action');
    for (const key of ['id', 'clip', 'donorAction']) assert.ok(identifier(a[key]), 'Invalid ' + key);
    assert.match(a.donorSlot, /^OB[A-Za-z][A-Za-z0-9_]{0,63}$/);
    assert.ok(Array.isArray(a.frames) && a.frames.length === 2 && a.frames.every(Number.isInteger));
    assert.ok(a.frames[0] >= 1 && a.frames[1] > a.frames[0] && a.frames[1] - a.frames[0] <= 240);
    assert.ok(Number.isInteger(a.fps) && a.fps >= 24 && a.fps <= 60);
    assert.equal(typeof a.loop, 'boolean');
    assert.ok(Number.isFinite(a.cycleDisplacement) && a.cycleDisplacement >= (authored ? 0 : 0.001) && a.cycleDisplacement <= 12);
    assert.ok(Number.isFinite(a.torsoLimit) && a.torsoLimit > 0 && a.torsoLimit <= 1.2);
    if (!authored) fields(a.markers, ['leftContact', 'rightContact'], 'markers');
    else {
      assert.match(a.clip, /^vod7_[a-z0-9_]+$/);
      assert.ok(identifier(a.kind));
      assert.ok(['m4', 'p90', 'awp', 'pistol'].includes(a.weapon));
      assert.ok(['forward', 'back', 'left', 'right', 'none'].includes(a.direction));
      assert.equal(typeof a.previewOnly, 'boolean');
      assert.equal(a.phaseOwner, a.previewOnly ? 'Phase5' : 'Phase7');
      assert.ok(Array.isArray(a.aliases) && a.aliases.every(identifier));
      assert.ok(a.durationSeconds > 0 && a.durationSeconds <= 8);
      assert.ok(Number.isFinite(a.bodyDrop) && a.bodyDrop >= 0 && a.bodyDrop <= 0.8);
      assert.ok(typeof a.mechanism === 'string' && a.mechanism.length <= 96);
      fields(a.contactTargets, ['grip', 'support', 'remove', 'insert', 'charge'], 'contacts');
      for (const v of Object.values(a.contactTargets))
        assert.ok(Array.isArray(v) && v.length === 3 && v.every(n => Number.isFinite(n) && Math.abs(n) <= 2));
      assert.ok(Object.keys(a.markers).length >= 2 && Object.keys(a.markers).length <= 12);
      for (const k of Object.keys(a.markers)) assert.ok(identifier(k));
      if (a.kind === 'reload' || a.kind === 'sprint_reload')
        assert.ok(a.markers.remove < a.markers.insert && a.markers.insert < a.markers.charge && a.markers.charge < a.markers.ready);
    }
    for (const n of Object.values(a.markers)) assert.ok(Number.isFinite(n) && n >= 0 && n <= 1);
    assert.ok(Object.keys(a.boneMap).length >= 1 && Object.keys(a.boneMap).length <= 65);
    for (const [donor, target] of Object.entries(a.boneMap))
      assert.ok(identifier(donor) && identifier(target), 'Invalid bone mapping');
    assert.equal(new Set(Object.values(a.boneMap)).size, Object.keys(a.boneMap).length, 'Duplicate target');
  }
  return m;
}
// Detect repeated JSON fields before JSON.parse discards them. String tokens are parsed
// by JSON itself; object key stacks distinguish legitimate repeated keys in siblings.
export function parseManifest(text) {
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [];
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '{' || t === '[') stack.push(t === '{' ? new Set() : null);
    else if (t === '}' || t === ']') stack.pop();
    else if (t.startsWith('"') && tokens[i + 1] === ':' && stack.at(-1)) {
      const key = JSON.parse(t), keys = stack.at(-1);
      assert.ok(!keys.has(key), 'Duplicate JSON key: ' + key); keys.add(key);
    }
  }
  return validateManifest(JSON.parse(text));
}
function appendAccessor(asset, values, type) {
  const width = type === 'SCALAR' ? 1 : type === 'VEC4' ? 4 : 3;
  const data = Buffer.alloc(values.length * 4);
  values.forEach((n, i) => { assert.ok(Number.isFinite(n)); data.writeFloatLE(n, i * 4); });
  const offset = Math.ceil(asset.binary.length / 4) * 4;
  asset.binary = Buffer.concat([asset.binary, Buffer.alloc(offset - asset.binary.length), data]);
  const view = asset.json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length }) - 1;
  return asset.json.accessors.push({ bufferView: view, componentType: 5126, count: values.length / width,
    type, ...(type === 'SCALAR' ? { min: [Math.min(...values)], max: [Math.max(...values)] } : {}) }) - 1;
}
export async function mergeMotion(baseline, raw, manifest) {
  validateManifest(manifest);
  assert.equal(baseline.json.skins[0].joints.length, manifest.targetJoints, 'Wrong target rig');
  const out = { json: structuredClone(baseline.json), binary: Buffer.from(baseline.binary) };
  const joints = new Map(baseline.json.skins[0].joints.map((i) => [baseline.json.nodes[i].name, i]));
  const rawNames = raw.json.nodes.map((n) => n.name);
  assert.equal(new Set(rawNames).size, rawNames.length, 'Ambiguous raw rig');
  assert.equal(raw.json.animations.length, manifest.actions.length, 'Unlisted raw actions');
  assert.equal(raw.json.skins[0].joints.length, manifest.targetJoints, 'Wrong raw skeleton');
  assert.deepEqual(raw.json.skins[0].joints.map((i) => rawNames[i]).sort(), [...joints.keys()].sort(), 'Wrong raw bone identities');
  for (const a of manifest.actions) {
    assert.ok(!baseline.json.animations.some((clip) => clip.name === a.clip), 'Unlisted replacement');
    const matches = raw.json.animations.filter((clip) => clip.name === a.clip);
    assert.equal(matches.length, 1, 'Missing/duplicate raw clip');
    const anim = { name: a.clip, extras: { motionId: a.id, donorAction: a.donorAction,
      donorSlot: a.donorSlot }, channels: [], samplers: [] };
    for (const c of matches[0].channels) {
      const name = rawNames[c.target.node];
      const sampler = matches[0].samplers[c.sampler];
      const verticalPelvis = name === 'pelvis' && c.target.path === 'translation' && a.bodyDrop > 0;
      if (!Object.values(a.boneMap).includes(name) || (c.target.path !== 'rotation' && !verticalPelvis)) {
        const values = accessor(raw, sampler.output), type = raw.json.accessors[sampler.output].type;
        const width = type === 'VEC4' ? 4 : 3;
        assert.ok(values.every((n, i) => Math.abs(n - values[i % width]) < 1e-6), 'Unlisted changing channel/root travel');
        continue;
      }
      assert.ok(joints.has(name), 'Unsupported target');
      let rawTimes = accessor(raw, sampler.input), rawValues = accessor(raw, sampler.output);
      const width = verticalPelvis ? 3 : 4;
      const constant = rawValues.every((n, i) => Math.abs(n - rawValues[i % width]) < 1e-6);
      // Blender emits STEP/two endpoints for constant held transforms. Retain
      // the non-rest transform and normalize only that proven constant case.
      if (sampler.interpolation === 'STEP') assert.ok(constant, 'Changing STEP motion');
      if (constant && rawTimes.length < 3) {
        rawTimes = [0, rawTimes.at(-1) / 2, rawTimes.at(-1)];
        rawValues = [...rawValues.slice(0, width), ...rawValues.slice(0, width), ...rawValues.slice(0, width)];
      }
      const timeScale = a.durationSeconds ? a.durationSeconds / rawTimes.at(-1) : 1;
      const input = appendAccessor(out, rawTimes.map(t => t * timeScale), 'SCALAR');
      const output = appendAccessor(out, rawValues, verticalPelvis ? 'VEC3' : 'VEC4');
      anim.channels.push({ sampler: anim.samplers.length, target: { node: joints.get(name), path: c.target.path } });
      anim.samplers.push({ input, output, interpolation: constant ? 'LINEAR' : sampler.interpolation || 'LINEAR' });
    }
    out.json.animations.push(anim);
  }
  await validateMotionCandidate(encodeGLB(out.json, out.binary), encodeGLB(baseline.json, baseline.binary), manifest);
  return out;
}
export async function validateMotionCandidate(candidate, baseline, manifest) {
  validateManifest(manifest);
  const read = async (p) => parseGLB(Buffer.isBuffer(p) ? p : await fs.readFile(p));
  const c = await read(candidate), b = await read(baseline);
  assert.equal(b.byteHash, manifest.baselineHash, 'Wrong baseline identity');
  assert.equal(b.json.skins[0].joints.length, manifest.targetJoints, 'Wrong baseline rig');
  assert.equal(c.json.animations.length, b.json.animations.length + manifest.actions.length, 'Missing/unlisted clips');
  const inherited = structuredClone(c.json);
  inherited.animations = inherited.animations.slice(0, b.json.animations.length);
  const protectedCheck = await compareSemanticExports(encodeGLB(inherited, c.binary),
    encodeGLB(b.json, b.binary), { tolerance: 0 });
  assert.ok(protectedCheck.equal, 'Protected domains changed: ' + protectedCheck.differences.join(','));
  const changingClips = validateListedMotion(c, manifest, b.json.animations.length);
  return { schemaVersion: 1, protectedEqual: true, inheritedOccurrences: b.json.animations.length,
    changingClips, candidateHash: c.byteHash, baselineHash: b.byteHash };
}
export function validateListedMotion(c, manifest, inheritedCount = c.json.animations.length - manifest.actions.length) {
  validateManifest(manifest);
  const objects = c.json.nodes.map(n => {
    const o = new THREE.Object3D();
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  c.json.nodes.forEach((n, i) => (n.children || []).forEach(k => objects[i].add(objects[k])));
  objects.filter(o => !o.parent).forEach(o => o.updateMatrixWorld(true));
  let changingClips = 0;
  for (let k = 0; k < manifest.actions.length; k++) {
    const a = manifest.actions[k], clip = c.json.animations[inheritedCount + k];
    assert.equal(c.json.animations.filter((v) => v.name === a.clip).length, 1, 'Missing/duplicate named motion');
    assert.equal(clip.name, a.clip, 'Clip name/order mismatch');
    assert.deepEqual(clip.extras, { motionId: a.id, donorAction: a.donorAction, donorSlot: a.donorSlot }, 'Action/slot mismatch');
    const expected = Object.values(a.boneMap).map(n => n + ':rotation').sort(), seen = [], duration = a.durationSeconds || (a.frames[1] - a.frames[0]) / a.fps;
    if (a.bodyDrop > 0) expected.push('pelvis:translation');
    let changed = false;
    for (const ch of clip.channels) {
      const bone = c.json.nodes[ch.target.node]?.name;
      assert.ok(expected.includes(bone + ':' + ch.target.path), 'Root travel or unlisted target/path');
      seen.push(bone + ':' + ch.target.path);
      const s = clip.samplers[ch.sampler];
      assert.equal(s.interpolation || 'LINEAR', 'LINEAR');
      assert.equal(c.json.accessors[s.input].type, 'SCALAR');
      const translation = ch.target.path === 'translation';
      assert.equal(c.json.accessors[s.output].type, translation ? 'VEC3' : 'VEC4');
      const times = accessor(c, s.input), q = accessor(c, s.output);
      assert.ok(times.length >= 3 && q.length === times.length * (translation ? 3 : 4), 'Incomplete keys');
      assert.ok(Math.abs(times[0]) < 1e-6 && Math.abs(times.at(-1) - duration) < 1e-5, 'Duration mismatch');
      for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1], 'Unordered samples');
      if (translation) {
        const node = objects[ch.target.node], parentQ = node.parent.getWorldQuaternion(new THREE.Quaternion());
        for (let i = 0; i < q.length; i += 3) {
          const delta = new THREE.Vector3().fromArray(q, i).sub(node.position).applyQuaternion(parentQ);
          assert.ok(Math.abs(delta.x) < 1e-5 && Math.abs(delta.z) < 1e-5, 'Horizontal pelvis/root travel');
          assert.ok(delta.y >= -a.bodyDrop - 1e-4 && delta.y <= 1e-4, 'Unbounded vertical body motion');
        }
        continue;
      }
      for (let i = 0; i < times.length; i++) {
        assert.ok(Math.abs(Math.hypot(...q.slice(i * 4, i * 4 + 4)) - 1) < 1e-4, 'Invalid quaternion');
        const dot = Math.abs(q.slice(i * 4, i * 4 + 4).reduce((n, v, j) => n + v * q[j], 0));
        if (dot < 0.99999) changed = true;
        if (bone.startsWith('spine')) assert.ok(2 * Math.acos(Math.min(1, dot)) <= a.torsoLimit + 1e-4, 'Torso limit');
      }
      if (a.loop) {
        const dot = Math.abs(q.slice(-4).reduce((n, v, i) => n + v * q[i], 0));
        assert.ok(dot > 0.9999, 'Loop seam');
      }
    }
    assert.deepEqual(seen.sort(), expected.sort(), 'Missing/duplicate target channels');
    assert.ok(changed, 'Silently unchanged motion'); changingClips++;
  }
  return changingClips;
}
export function fixtureManifest(b) {
  return { schemaVersion: 1, source: 'tools/art/sources/motion.blend', sourceHash: '0'.repeat(64),
    baselineHash: b.byteHash, targetJoints: 65, actions: [{ id: 'original_walk', clip: 'vod_walk_forward',
      donorAction: 'OriginalWalk', donorSlot: 'OBMotionDonor', boneMap: { donor_thigh_l: 'thigh_l' },
      frames: [1, 31], fps: 30, loop: true, cycleDisplacement: 2.4,
      markers: { leftContact: 0, rightContact: 0.5 }, torsoLimit: 0.7 }] };
}
export function fixtureMotion(b, m) {
  const raw = { json: structuredClone(b.json), binary: Buffer.from(b.binary) };
  raw.json.animations = m.actions.map((a) => ({ name: a.clip, channels: [], samplers: [] }));
  for (const [i, a] of m.actions.entries()) for (const name of Object.values(a.boneMap)) {
    const input = appendAccessor(raw, [0, 0.5, 1], 'SCALAR');
    const output = appendAccessor(raw, [0, 0, 0, 1, Math.sin(0.2), 0, 0, Math.cos(0.2), 0, 0, 0, 1], 'VEC4');
    raw.json.animations[i].channels.push({ sampler: raw.json.animations[i].samplers.length,
      target: { node: raw.json.nodes.findIndex((n) => n.name === name), path: 'rotation' } });
    raw.json.animations[i].samplers.push({ input, output, interpolation: 'LINEAR' });
  }
  return raw;
}
async function motionBlender(args) {
  const exe = await bootstrap();
  await run(exe, ['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1',
    '--python', SCRIPT, '--', ...args]);
}
async function unique(label) {
  owned(ROOT, MOTION_CACHE); await fs.mkdir(MOTION_CACHE, { recursive: true });
  return fs.mkdtemp(path.join(MOTION_CACHE, label + '-'));
}
async function acceptedBaseline() {
  // The retained inherited48 seam stays historical; current publication trust
  // comes from the registered actual tuple, including its editable donor.
  await (await import('./pipeline.mjs')).approvedArtMotion();
  const m = parseManifest(await fs.readFile(MANIFEST, 'utf8'));
  if (hash(await fs.readFile(BASELINE)) === m.baselineHash) return BASELINE;
  const publication = path.join(MOTION_CACHE, 'publication.json');
  await iterationPath([MOTION_CACHE], publication);
  const r = JSON.parse(await fs.readFile(publication, 'utf8'));
  assert.equal(r.complete, true, 'Incomplete baseline retention');
  const retained = path.join(r.directory, 'previous-publication.glb');
  await iterationPath([MOTION_CACHE], retained);
  // The accepted baseline is independently retained before the first publish.
  // Later publications keep that baseline rather than promoting runtime motion
  // into the protected inherited domain.
  for (const filename of [r.baseline, retained]) {
    await iterationPath([MOTION_CACHE], filename);
    if (hash(await fs.readFile(filename)) === m.baselineHash) return filename;
  }
  throw Error('Accepted art baseline missing or stale');
}
export async function exportMotion(source, manifestPath, baseline, output) {
  await iterationPath([SOURCES, MOTION_CACHE], source);
  await iterationPath([path.join(ROOT, 'tools/art'), MOTION_CACHE], manifestPath);
  await iterationPath([MOTION_CACHE], output);
  await iterationPath([path.join(ROOT, 'public/models'), MOTION_CACHE], baseline);
  for (const [file, bound] of [[source, 64000000], [manifestPath, 131072]]) {
    const stat = await fs.stat(file);
    assert.ok(stat.isFile() && stat.size > 0 && stat.size <= bound, 'Input size/type bound');
  }
  assert.ok(source.endsWith('.blend') && output.endsWith('.glb'), 'Extensions');
  assert.notEqual(path.resolve(source).toLowerCase(), path.resolve(output).toLowerCase(), 'Output alias');
  await fs.access(output).then(() => { throw Error('Output already exists'); }, (e) => { if (e.code !== 'ENOENT') throw e; });
  const m = parseManifest(await fs.readFile(manifestPath, 'utf8'));
  assert.equal(hash(await fs.readFile(source)), m.sourceHash, 'Stale source hash');
  assert.equal(hash(await fs.readFile(baseline)), m.baselineHash, 'Stale baseline hash');
  const base = parseGLB(await fs.readFile(baseline));
  const targetNames = new Set(base.json.skins[0].joints.map((i) => base.json.nodes[i].name));
  for (const a of m.actions) for (const name of Object.values(a.boneMap))
    assert.ok(targetNames.has(name), 'Unsupported manifest target');
  const rawPath = output + '.raw.glb';
  await iterationPath([MOTION_CACHE], rawPath);
  await fs.access(rawPath).then(() => { throw Error('Raw output exists'); }, (e) => { if (e.code !== 'ENOENT') throw e; });
  await motionBlender(['--mode', 'export', '--source', source, '--manifest', manifestPath,
    '--baseline', baseline, '--out', rawPath]);
  const result = await mergeMotion(parseGLB(await fs.readFile(baseline)), parseGLB(await fs.readFile(rawPath)), m);
  await fs.writeFile(output, encodeGLB(result.json, result.binary), { flag: 'wx' });
  return validateMotionCandidate(output, baseline, m);
}
export async function buildCandidate() {
  const directory = await unique('candidate');
  const baseline = await acceptedBaseline();
  await fs.copyFile(baseline, path.join(directory, 'baseline.glb'));
  // First authoring retains an inspectable saved donor. Subsequent builds preserve edits.
  try { await fs.access(SOURCE); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    await motionBlender(['--mode', 'author', '--manifest', MANIFEST, '--baseline', BASELINE,
      '--out', path.join(directory, 'motion.blend')]);
    await fs.copyFile(path.join(directory, 'motion.blend'), SOURCE, fs.constants.COPYFILE_EXCL);
    const m = parseManifest(await fs.readFile(MANIFEST, 'utf8'));
    m.sourceHash = hash(await fs.readFile(SOURCE));
    await fs.writeFile(MANIFEST, JSON.stringify(m, null, 2) + '\n');
  }
  const source = path.join(directory, 'motion.blend'), manifest = path.join(directory, 'manifest.json');
  await fs.copyFile(SOURCE, source); await fs.copyFile(MANIFEST, manifest);
  const output = path.join(directory, 'candidate.glb');
  const check = await exportMotion(source, manifest, path.join(directory, 'baseline.glb'), output);
  const report = { schemaVersion: 1, complete: true, directory, source, manifest, output,
    baseline: path.join(directory, 'baseline.glb'), check,
    hashes: { source: hash(await fs.readFile(source)), manifest: hash(await fs.readFile(manifest)),
      baseline: hash(await fs.readFile(baseline)), publication: hash(await fs.readFile(BASELINE)), output: hash(await fs.readFile(output)) },
    scriptHashes: await scriptHashes(),
    runtime: { version: '4.5.13 LTS', archiveHash: PIN.sha256 },
    evidence: JSON.parse(await fs.readFile(output + '.raw.glb.evidence.json', 'utf8')) };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(MOTION_CACHE, 'latest.json.tmp'), JSON.stringify(report, null, 2));
  await fs.rename(path.join(MOTION_CACHE, 'latest.json.tmp'), path.join(MOTION_CACHE, 'latest.json'));
  console.log(JSON.stringify(report, null, 2)); return report;
}
async function scriptHashes() {
  return Object.fromEntries(await Promise.all(['build_motion.py', 'motion-pipeline.mjs',
    'inspect-character.mjs'].map(async (name) => [name, hash(await fs.readFile(path.join(ROOT, 'tools/art', name)))])));
}
async function retained(label) {
  const publication = await (await import('./pipeline.mjs')).approvedArtMotion();
  const directory = await unique(label);
  const source = path.join(directory, 'baseline.blend'), manifest = path.join(directory, 'baseline.manifest.json');
  const baseline = path.join(directory, 'baseline.glb');
  await fs.copyFile(SOURCE, source); await fs.copyFile(MANIFEST, manifest); await fs.copyFile(await acceptedBaseline(), baseline);
  return { directory, source, manifest, baseline, publicationBinding: publication.motionBinding };
}
async function saveReport(name, report) {
  await fs.writeFile(path.join(report.directory, 'report.json'), JSON.stringify(report, null, 2));
  const target = path.join(MOTION_CACHE, name + '.json');
  await fs.writeFile(target + '.tmp', JSON.stringify(report, null, 2));
  await fs.rename(target + '.tmp', target);
  console.log(JSON.stringify(report, null, 2)); return report;
}
export async function repeatMotion() {
  const start = Date.now(), r = await retained('repeat');
  const first = path.join(r.directory, 'first.glb'), second = path.join(r.directory, 'second.glb');
  const checks = [await exportMotion(r.source, r.manifest, r.baseline, first),
    await exportMotion(r.source, r.manifest, r.baseline, second)];
  const m = parseManifest(await fs.readFile(r.manifest, 'utf8'));
  assert.equal(hash(await fs.readFile(first)), r.publicationBinding.tuple['public/models/enemy.glb'], 'Reopened export must reproduce current publication exactly');
  assert.equal(hash(await fs.readFile(second)), r.publicationBinding.tuple['public/models/enemy.glb']);
  assert.deepEqual((await (await import('./pipeline.mjs')).approvedArtMotion()).motionBinding, r.publicationBinding);
  return saveReport('repeat', { schemaVersion: 1, complete: true, ...r, first, second, checks,
    comparison: await compareMotionExports(first, second, m), scriptHashes: await scriptHashes(),
    sourceHash: hash(await fs.readFile(r.source)), manifestHash: hash(await fs.readFile(r.manifest)),
    runtime: PIN.sha256, durationMs: Date.now() - start });
}
export async function recoverMotion() {
  const start = Date.now(), publicationHash = hash(await fs.readFile(BASELINE)), r = await retained('recovery');
  const before = path.join(r.directory, 'before.glb'), changed = path.join(r.directory, 'changed.glb');
  await exportMotion(r.source, r.manifest, r.baseline, before);
  const edited = path.join(r.directory, 'edited.blend'), editedManifest = path.join(r.directory, 'edited.manifest.json');
  await motionBlender(['--mode', 'edit', '--source', r.source, '--manifest', r.manifest,
    '--baseline', r.baseline, '--out', edited, '--gain', '1.12']);
  const m = parseManifest(await fs.readFile(r.manifest, 'utf8'));
  const editedSpec = structuredClone(m); editedSpec.sourceHash = hash(await fs.readFile(edited));
  await fs.writeFile(editedManifest, JSON.stringify(editedSpec, null, 2));
  await exportMotion(edited, editedManifest, r.baseline, changed);
  const changedCheck = await compareSemanticExports(before, changed, { tolerance: 0 });
  assert.equal(changedCheck.domains.motion, false, 'Intended numeric edit must change motion');
  for (const d of ['mesh', 'skin', 'materials', 'images']) assert.equal(changedCheck.domains[d], true);
  // Recovery restores retained editable inputs, then exports twice in distinct fresh processes.
  const restoredSource = path.join(r.directory, 'restored.blend'), restoredManifest = path.join(r.directory, 'restored.manifest.json');
  await fs.copyFile(r.source, restoredSource); await fs.copyFile(r.manifest, restoredManifest);
  const restored = path.join(r.directory, 'restored.glb'), regenerated = path.join(r.directory, 'independent.glb');
  await exportMotion(restoredSource, restoredManifest, r.baseline, restored);
  await exportMotion(restoredSource, restoredManifest, r.baseline, regenerated);
  const comparison = await compareMotionExports(before, regenerated, m);
  for (const filename of [before, restored, regenerated])
    assert.equal(hash(await fs.readFile(filename)), r.publicationBinding.tuple['public/models/enemy.glb'], 'Editable recovery must reproduce exact current publication');
  await compareMotionExports(restored, regenerated, m);
  assert.equal(hash(await fs.readFile(SOURCE)), m.sourceHash, 'Accepted source changed');
  assert.equal(hash(await fs.readFile(MANIFEST)), hash(await fs.readFile(r.manifest)), 'Accepted manifest changed');
  assert.equal(hash(await fs.readFile(BASELINE)), publicationHash, 'Publication changed');
  assert.deepEqual((await (await import('./pipeline.mjs')).approvedArtMotion()).motionBinding, r.publicationBinding);
  return saveReport('recovery', { schemaVersion: 1, complete: true, ...r, before, changed, restored,
    regenerated, restoredSource, restoredManifest, changedCheck, comparison, sourceHash: m.sourceHash,
    manifestHash: hash(await fs.readFile(r.manifest)), scriptHashes: await scriptHashes(),
    edit: { operation: 'left-thigh-keyed-quaternion-gain', gain: 1.12 },
    sourceBackupHash: hash(await fs.readFile(r.source)), restoredSourceHash: hash(await fs.readFile(restoredSource)),
    changedSourceHash: hash(await fs.readFile(edited)), durationMs: Date.now() - start });
}
export async function validateLatest(report) {
  assert.equal(report.schemaVersion, 1); assert.equal(report.complete, true, 'Incomplete report');
  await iterationPath([MOTION_CACHE], report.directory);
  assert.ok(path.basename(report.directory).startsWith('candidate-'), 'Foreign report');
  for (const key of ['source', 'manifest', 'baseline', 'output']) {
    await iterationPath([report.directory], report[key]);
    assert.equal(hash(await fs.readFile(report[key])), report.hashes[key], 'Stale ' + key);
  }
  assert.deepEqual(report.scriptHashes, await scriptHashes(), 'Stale authoring/validation scripts');
  assert.equal(hash(await fs.readFile(SOURCE)), report.hashes.source, 'Stale editable source');
  assert.equal(hash(await fs.readFile(MANIFEST)), report.hashes.manifest, 'Stale manifest');
  assert.equal(hash(await fs.readFile(BASELINE)), report.hashes.publication || report.hashes.baseline, 'Stale runtime publication');
  assert.equal(hash(await fs.readFile(await acceptedBaseline())), report.hashes.baseline, 'Stale accepted art baseline');
  assert.equal(report.runtime.archiveHash, PIN.sha256, 'Wrong runtime pin');
  for (const key of ['freshProcess', 'reopened', 'libraryAppended', 'autoexecDisabled'])
    assert.equal(report.evidence[key], true, 'Missing fresh-process evidence');
  assert.equal(report.evidence.sourceScripts, false);
  const m = parseManifest(await fs.readFile(report.manifest, 'utf8'));
  await inspectMotionCandidate(report.output, report.baseline, m);
  return m;
}
export async function publishLatest() {
  (await import('./motion-acceptance.mjs')).excludeGenericPublication();
  await iterationPath([MOTION_CACHE], path.join(MOTION_CACHE, 'latest.json'));
  const r = JSON.parse(await fs.readFile(path.join(MOTION_CACHE, 'latest.json'), 'utf8'));
  const manifest = await validateLatest(r);
  // A candidate is publishable only after matching repeat and editable recovery,
  // including the independent reopened verifier. Historical one-clip evidence
  // cannot authorize a changed repertoire or source.
  for (const label of ['repeat', 'recovery']) {
    const filename = path.join(MOTION_CACHE, label + '.json');
    await iterationPath([MOTION_CACHE], filename);
    const evidence = JSON.parse(await fs.readFile(filename, 'utf8'));
    assert.equal(evidence.complete, true, 'Incomplete ' + label);
    assert.equal(evidence.sourceHash, r.hashes.source, 'Stale ' + label + ' source');
    assert.equal(evidence.manifestHash, r.hashes.manifest, 'Stale ' + label + ' manifest');
    assert.deepEqual(evidence.scriptHashes, r.scriptHashes, 'Stale ' + label + ' scripts');
    for (const key of label === 'repeat' ? ['first', 'second'] : ['before', 'restored', 'regenerated'])
      await iterationPath([MOTION_CACHE], evidence[key]);
    await compareMotionExports(evidence[label === 'repeat' ? 'first' : 'before'],
      evidence[label === 'repeat' ? 'second' : 'regenerated'], manifest);
  }
  const verificationFile = path.join(MOTION_CACHE, 'verification.json');
  await iterationPath([MOTION_CACHE], verificationFile);
  const verification = JSON.parse(await fs.readFile(verificationFile, 'utf8'));
  assert.equal(verification.complete, true, 'Incomplete independent recovery');
  assert.equal(verification.recoveryReportHash, hash(await fs.readFile(path.join(MOTION_CACHE, 'recovery.json'))), 'Stale independent recovery');
  assert.deepEqual(verification.scriptHashes, r.scriptHashes, 'Stale independent scripts');
  await iterationPath([MOTION_CACHE], verification.output);
  assert.equal(hash(await fs.readFile(verification.output)), verification.outputHash, 'Changed independent export');
  await inspectMotionCandidate(verification.output, r.baseline, manifest);
  const backup = await retained('publication');
  await fs.copyFile(BASELINE, path.join(backup.directory, 'previous-publication.glb'));
  const stage = BASELINE + '.motion-stage';
  await iterationPath([path.join(ROOT, 'public/models')], stage);
  await fs.writeFile(stage, await fs.readFile(r.output), { flag: 'wx' });
  try {
    await inspectMotionCandidate(stage, r.baseline, parseManifest(await fs.readFile(r.manifest, 'utf8')));
    await fs.rename(stage, BASELINE);
  } finally { await fs.unlink(stage).catch((e) => { if (e.code !== 'ENOENT') throw e; }); }
  return saveReport('publication', { schemaVersion: 1, complete: true, ...backup,
    previousHash: r.hashes.baseline, publishedHash: hash(await fs.readFile(BASELINE)), candidateReport: path.join(r.directory, 'report.json'),
    recovery: 'Retained editable donor, manifest and previous-publication.glb; publication uses one validated staged atomic rename.' });
}
export async function verifyMotion() {
  const filename = path.join(MOTION_CACHE, 'recovery.json');
  await iterationPath([MOTION_CACHE], filename);
  const r = JSON.parse(await fs.readFile(filename, 'utf8'));
  assert.equal(r.complete, true); assert.deepEqual(r.scriptHashes, await scriptHashes(), 'Stale recovery scripts');
  for (const key of ['source', 'manifest', 'baseline', 'before', 'changed', 'restored', 'restoredSource', 'restoredManifest'])
    await iterationPath([r.directory], r[key]);
  const m = parseManifest(await fs.readFile(r.restoredManifest, 'utf8'));
  assert.equal(hash(await fs.readFile(r.restoredSource)), r.sourceHash);
  assert.equal(hash(await fs.readFile(r.restoredManifest)), r.manifestHash);
  await inspectMotionCandidate(r.changed, r.baseline, m);
  const d = await unique('independent');
  const output = path.join(d, 'regenerated.glb');
  await exportMotion(r.restoredSource, r.restoredManifest, r.baseline, output);
  const comparison = await compareMotionExports(r.before, output, m);
  await compareMotionExports(r.restored, output, m);
  const changed = await compareSemanticExports(r.before, r.changed, { tolerance: 0 });
  assert.equal(changed.domains.motion, false);
  for (const key of ['mesh', 'skin', 'materials', 'images']) assert.equal(changed.domains[key], true);
  return saveReport('verification', { schemaVersion: 1, complete: true, directory: d,
    recoveryReportHash: hash(await fs.readFile(filename)), output, comparison, changed,
    outputHash: hash(await fs.readFile(output)), scriptHashes: await scriptHashes() });
}
export async function selfTest() {
  await run(process.execPath, ['--test', 'tools/art/motion-pipeline.test.mjs']);
  const r = await retained('script-suppression');
  const fixture = path.join(r.directory, 'script-fixture.blend'), fixtureManifest = path.join(r.directory, 'script-fixture.json');
  await motionBlender(['--mode', 'script-fixture', '--source', r.source, '--manifest', r.manifest,
    '--baseline', r.baseline, '--out', fixture]);
  const m = parseManifest(await fs.readFile(r.manifest, 'utf8')); m.sourceHash = hash(await fs.readFile(fixture));
  await fs.writeFile(fixtureManifest, JSON.stringify(m));
  const out = path.join(r.directory, 'suppressed.glb');
  await exportMotion(fixture, fixtureManifest, r.baseline, out);
  const evidence = JSON.parse(await fs.readFile(out + '.raw.glb.evidence.json', 'utf8'));
  assert.equal(evidence.autoexecDisabled, true); assert.equal(evidence.sourceScripts, false);
  const sourceRejections = [];
  for (const corruption of ['slot', 'action', 'rig', 'unchanged']) {
    const invalid = path.join(r.directory, corruption + '.blend');
    const invalidManifest = path.join(r.directory, corruption + '.json');
    const invalidOut = path.join(r.directory, corruption + '.glb');
    await motionBlender(['--mode', 'invalid-fixture', '--source', r.source, '--manifest', r.manifest,
      '--baseline', r.baseline, '--out', invalid, '--corruption', corruption]);
    const badSpec = structuredClone(m); badSpec.sourceHash = hash(await fs.readFile(invalid));
    await fs.writeFile(invalidManifest, JSON.stringify(badSpec));
    await assert.rejects(exportMotion(invalid, invalidManifest, r.baseline, invalidOut));
    await assert.rejects(fs.access(invalidOut));
    sourceRejections.push({ corruption, source: invalid, outputAbsent: true });
  }
  const report = { schemaVersion: 1, complete: true, ...r, sourceScriptFixture: fixture,
    raisingRegisteredTextSuppressed: true, sourceRejections,
    scriptHashes: await scriptHashes(), check: await inspectMotionCandidate(out, r.baseline, m) };
  return saveReport('self-test', report);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commands = { 'build --candidate': buildCandidate, 'self-test': selfTest, repeat: repeatMotion,
    'recover --demo': recoverMotion, 'publish --latest': publishLatest };
  const command = commands[process.argv.slice(2).join(' ')];
  if (command) command().catch((e) => { console.error(e); process.exitCode = 1; });
  else { console.error('Expected build --candidate, self-test, repeat, recover --demo or publish --latest'); process.exitCode = 1; }
}

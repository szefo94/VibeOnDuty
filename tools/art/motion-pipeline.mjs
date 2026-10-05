import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ROOT, SOURCES, PIN, hash, owned, bootstrap, run, iterationPath } from './pipeline.mjs';
import { parseGLB, encodeGLB, accessor, compareSemanticExports } from './inspect-character.mjs';

export const MOTION_CACHE = path.join(ROOT, '.planning/research/.cache/07-motion');
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
  for (const key of ['id', 'clip', 'donorAction', 'donorSlot'])
    assert.equal(new Set(m.actions.map((a) => a[key])).size, m.actions.length, 'Duplicate ' + key);
  for (const a of m.actions) {
    fields(a, ['id', 'clip', 'donorAction', 'donorSlot', 'boneMap', 'frames', 'fps', 'loop',
      'cycleDisplacement', 'markers', 'torsoLimit'], 'action');
    for (const key of ['id', 'clip', 'donorAction']) assert.ok(identifier(a[key]), 'Invalid ' + key);
    assert.match(a.donorSlot, /^OB[A-Za-z][A-Za-z0-9_]{0,63}$/);
    assert.ok(Array.isArray(a.frames) && a.frames.length === 2 && a.frames.every(Number.isInteger));
    assert.ok(a.frames[0] >= 1 && a.frames[1] > a.frames[0] && a.frames[1] - a.frames[0] <= 240);
    assert.ok(Number.isInteger(a.fps) && a.fps >= 24 && a.fps <= 60);
    assert.equal(typeof a.loop, 'boolean');
    assert.ok(Number.isFinite(a.cycleDisplacement) && a.cycleDisplacement > 0 && a.cycleDisplacement <= 12);
    assert.ok(Number.isFinite(a.torsoLimit) && a.torsoLimit > 0 && a.torsoLimit <= 1.2);
    fields(a.markers, ['leftContact', 'rightContact'], 'markers');
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
  for (const a of manifest.actions) {
    assert.ok(!baseline.json.animations.some((clip) => clip.name === a.clip), 'Unlisted replacement');
    const matches = raw.json.animations.filter((clip) => clip.name === a.clip);
    assert.equal(matches.length, 1, 'Missing/duplicate raw clip');
    const anim = { name: a.clip, extras: { motionId: a.id, donorAction: a.donorAction,
      donorSlot: a.donorSlot }, channels: [], samplers: [] };
    for (const c of matches[0].channels) {
      const name = rawNames[c.target.node];
      if (!Object.values(a.boneMap).includes(name) || c.target.path !== 'rotation') continue;
      assert.ok(joints.has(name), 'Unsupported target');
      const sampler = matches[0].samplers[c.sampler];
      const input = appendAccessor(out, accessor(raw, sampler.input), 'SCALAR');
      const output = appendAccessor(out, accessor(raw, sampler.output), 'VEC4');
      anim.channels.push({ sampler: anim.samplers.length, target: { node: joints.get(name), path: 'rotation' } });
      anim.samplers.push({ input, output, interpolation: sampler.interpolation || 'LINEAR' });
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
  assert.equal(b.json.skins[0].joints.length, manifest.targetJoints, 'Wrong baseline rig');
  assert.equal(c.json.animations.length, b.json.animations.length + manifest.actions.length, 'Missing/unlisted clips');
  const inherited = structuredClone(c.json);
  inherited.animations = inherited.animations.slice(0, b.json.animations.length);
  const protectedCheck = await compareSemanticExports(encodeGLB(inherited, c.binary),
    encodeGLB(b.json, b.binary), { tolerance: 0 });
  assert.ok(protectedCheck.equal, 'Protected domains changed: ' + protectedCheck.differences.join(','));
  let changingClips = 0;
  for (let k = 0; k < manifest.actions.length; k++) {
    const a = manifest.actions[k], clip = c.json.animations[b.json.animations.length + k];
    assert.equal(clip.name, a.clip, 'Clip name/order mismatch');
    assert.deepEqual(clip.extras, { motionId: a.id, donorAction: a.donorAction, donorSlot: a.donorSlot }, 'Action/slot mismatch');
    const expected = Object.values(a.boneMap).sort(), seen = [], duration = (a.frames[1] - a.frames[0]) / a.fps;
    let changed = false;
    for (const ch of clip.channels) {
      const bone = c.json.nodes[ch.target.node]?.name;
      assert.ok(expected.includes(bone), 'Unsupported target');
      assert.equal(ch.target.path, 'rotation', 'Root travel or unlisted path'); seen.push(bone);
      const s = clip.samplers[ch.sampler];
      assert.equal(s.interpolation || 'LINEAR', 'LINEAR');
      assert.equal(c.json.accessors[s.input].type, 'SCALAR');
      assert.equal(c.json.accessors[s.output].type, 'VEC4');
      const times = accessor(c, s.input), q = accessor(c, s.output);
      assert.ok(times.length >= 3 && q.length === times.length * 4, 'Incomplete keys');
      assert.ok(Math.abs(times[0]) < 1e-6 && Math.abs(times.at(-1) - duration) < 1e-5, 'Duration mismatch');
      for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1], 'Unordered samples');
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
    assert.deepEqual(seen.sort(), expected, 'Missing/duplicate target channels');
    assert.ok(changed, 'Silently unchanged motion'); changingClips++;
  }
  return { schemaVersion: 1, protectedEqual: true, inheritedOccurrences: b.json.animations.length,
    changingClips, candidateHash: c.byteHash, baselineHash: b.byteHash };
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
export async function exportMotion(source, manifestPath, baseline, output) {
  await iterationPath([SOURCES, MOTION_CACHE], source);
  await iterationPath([path.join(ROOT, 'tools/art'), MOTION_CACHE], manifestPath);
  await iterationPath([MOTION_CACHE], output);
  assert.ok(source.endsWith('.blend') && output.endsWith('.glb'), 'Extensions');
  assert.notEqual(path.resolve(source).toLowerCase(), path.resolve(output).toLowerCase(), 'Output alias');
  await fs.access(output).then(() => { throw Error('Output already exists'); }, (e) => { if (e.code !== 'ENOENT') throw e; });
  const m = parseManifest(await fs.readFile(manifestPath, 'utf8'));
  assert.equal(hash(await fs.readFile(source)), m.sourceHash, 'Stale source hash');
  assert.equal(hash(await fs.readFile(baseline)), m.baselineHash, 'Stale baseline hash');
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
  await fs.copyFile(BASELINE, path.join(directory, 'baseline.glb'));
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
      baseline: hash(await fs.readFile(BASELINE)), output: hash(await fs.readFile(output)), script: hash(await fs.readFile(SCRIPT)) },
    runtime: { version: '4.5.13 LTS', archiveHash: PIN.sha256 },
    evidence: JSON.parse(await fs.readFile(output + '.raw.glb.evidence.json', 'utf8')) };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(MOTION_CACHE, 'latest.json.tmp'), JSON.stringify(report, null, 2));
  await fs.rename(path.join(MOTION_CACHE, 'latest.json.tmp'), path.join(MOTION_CACHE, 'latest.json'));
  console.log(JSON.stringify(report, null, 2)); return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).join(' ') === 'build --candidate')
    await buildCandidate().catch((e) => { console.error(e); process.exitCode = 1; });
  else { console.error('Expected build --candidate'); process.exitCode = 1; }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseGLB, encodeGLB, accessor } from './inspect-character.mjs';
import { run } from './pipeline.mjs';

test('owned subprocess deadline rejects a still-running child instead of reporting completion', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'setTimeout(() => {}, 300)'], process.env,
    { timeoutMs: 20 }), /Process timeout/);
});

const api = await import('./motion-pipeline.mjs').catch(() => ({}));
const inspector = await import('./inspect-character.mjs');
test('motion-only candidate appends changing target keys and preserves protected domains', async () => {
  assert.equal(typeof api.mergeMotion, 'function', 'real bounded motion merge must exist');
  const baseline = parseGLB(await fs.readFile(new URL('../../public/models/enemy.glb', import.meta.url)));
  const manifest = api.fixtureManifest(baseline);
  const raw = api.fixtureMotion(baseline, manifest);
  const candidate = await api.mergeMotion(baseline, raw, manifest);
  assert.equal(candidate.json.animations.length, baseline.json.animations.length + 1);
  const check = await api.validateMotionCandidate(encodeGLB(candidate.json, candidate.binary),
    encodeGLB(baseline.json, baseline.binary), manifest);
  assert.equal(check.protectedEqual, true);
  assert.equal(check.changingClips, 1);
});

const baselineBytes = await fs.readFile(new URL('../../public/models/enemy.glb', import.meta.url));
const baseline = parseGLB(baselineBytes);
const manifest = api.fixtureManifest?.(baseline);
const clean = api.mergeMotion ? await api.mergeMotion(baseline, api.fixtureMotion(baseline, manifest), manifest) : null;
const fixtureDirectory = api.MOTION_CACHE ? (await fs.mkdir(api.MOTION_CACHE, { recursive: true }),
  await fs.mkdtemp(path.join(api.MOTION_CACHE, 'negative-fixtures-'))) : null;
const rejected = [];
const violations = {
  'missing clip': (c) => c.json.animations.pop(),
  'duplicate clip': (c) => c.json.animations.push(structuredClone(c.json.animations.at(-1))),
  'wrong name': (c) => { c.json.animations.at(-1).name = 'wrong'; },
  'wrong action': (c) => { c.json.animations.at(-1).extras.donorAction = 'wrong'; },
  'wrong slot': (c) => { c.json.animations.at(-1).extras.donorSlot = 'OBWrong'; },
  'missing slot': (c) => { delete c.json.animations.at(-1).extras.donorSlot; },
  'unsupported target': (c) => { c.json.animations.at(-1).channels[0].target.node = c.json.nodes.findIndex((n) => n.name === 'pelvis'); },
  'duplicate target channel': (c) => c.json.animations.at(-1).channels.push(structuredClone(c.json.animations.at(-1).channels[0])),
  'wrong rig': (c) => c.json.skins[0].joints.pop(),
  'wrong inverse bind': (c) => corruptAccessor(c, c.json.skins[0].inverseBindMatrices, 0.22),
  'altered mesh': (c) => corruptAccessor(c, c.json.meshes[0].primitives[0].attributes.POSITION, 3),
  'altered skin': (c) => corruptAccessor(c, c.json.meshes[0].primitives[0].attributes.WEIGHTS_0, 0.2),
  'altered paint': (c) => { c.json.materials[0].pbrMetallicRoughness.baseColorFactor = [0.21, 1, 1, 1]; },
  'altered image': (c) => { c.json.images[0].name = 'wrong'; },
  'root travel': (c) => { c.json.animations.at(-1).channels[0].target.path = 'translation'; },
  'nonfinite sample': (c) => corruptAccessor(c, c.json.animations.at(-1).samplers[0].output, NaN),
  'silent unchanged motion': (c) => {
    const index = c.json.animations.at(-1).samplers[0].output;
    const a = c.json.accessors[index], v = c.json.bufferViews[a.bufferView];
    const offset = (v.byteOffset || 0) + (a.byteOffset || 0), q = accessor(c, index).slice(0, 4);
    for (let i = 0; i < a.count * 4; i++) c.binary.writeFloatLE(q[i % 4], offset + i * 4);
  },
  'unlisted inherited replacement': (c) => { c.json.animations[0].name = 'Replaced'; },
};
function corruptAccessor(c, index, value) {
  const a = c.json.accessors[index], v = c.json.bufferViews[a.bufferView];
  c.binary.writeFloatLE(value, (v.byteOffset || 0) + (a.byteOffset || 0));
}
for (const [name, corrupt] of Object.entries(violations)) {
  test('real validator rejects ' + name, async () => {
    assert.ok(clean, 'bounded candidate must exist');
    const c = { json: structuredClone(clean.json), binary: Buffer.from(clean.binary) };
    corrupt(c);
    const bytes = encodeGLB(c.json, c.binary), file = path.join(fixtureDirectory, name.replaceAll(' ', '-') + '.glb');
    await fs.writeFile(file, bytes);
    await assert.rejects(api.validateMotionCandidate(file, baselineBytes, manifest));
    rejected.push({ name, file });
  });
}
for (const [name, corrupt] of Object.entries({
  'unknown fields': (m) => { m.prompt = 'untrusted'; },
  'duplicate action': (m) => m.actions.push(structuredClone(m.actions[0])),
  'malformed slot': (m) => { m.actions[0].donorSlot = '../run'; },
  'malformed name': (m) => { m.actions[0].clip = '../escape'; },
  'duplicate target': (m) => { m.actions[0].boneMap.other = 'thigh_l'; },
  'wrong target count': (m) => { m.targetJoints = 64; },
  'nonfinite bound': (m) => { m.actions[0].torsoLimit = NaN; },
})) test('manifest rejects ' + name, () => {
  const m = structuredClone(manifest); corrupt(m); assert.throws(() => api.validateManifest(m));
});
test('duplicate JSON fields reject before parsing loses them', () => {
  assert.throws(() => api.parseManifest(JSON.stringify(manifest).replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1')), /Duplicate/);
});
test('varying unlisted raw root channels reject instead of silently filtering them', async () => {
  const raw = api.fixtureMotion(baseline, manifest);
  raw.json.animations[0].channels[0].target.path = 'translation';
  await assert.rejects(api.mergeMotion(baseline, raw, manifest), /Unlisted changing/);
});
test('source paths, output aliases, existing output and junction escapes reject before export', async () => {
  await fs.mkdir(api.MOTION_CACHE, { recursive: true });
  const directory = await fs.mkdtemp(path.join(api.MOTION_CACHE, 'path-tests-'));
  const source = path.resolve('tools/art/sources/motion.blend'), m = api.MANIFEST;
  const existing = path.join(directory, 'existing.glb'); await fs.writeFile(existing, 'keep');
  await assert.rejects(api.exportMotion(source, m, api.BASELINE, existing), /already exists/);
  assert.equal(await fs.readFile(existing, 'utf8'), 'keep');
  await assert.rejects(api.exportMotion(source, m, api.BASELINE, source));
  await assert.rejects(api.exportMotion(source, m, api.BASELINE, path.join(api.MOTION_CACHE, '../escaped.glb')), /escapes/);
  await assert.rejects(api.exportMotion(path.resolve('AGENTS.md'), m, api.BASELINE, path.join(directory, 'no.glb')), /escapes/);
  const junction = path.join(directory, 'junction');
  await fs.symlink(path.resolve('public/models'), junction, 'junction');
  await assert.rejects(api.exportMotion(source, m, api.BASELINE, path.join(junction, 'no.glb')), /Linked/);
  await fs.unlink(junction);
  const linked = path.join(directory, 'inside-junction');
  await fs.symlink(directory, linked, 'junction');
  await assert.rejects(api.exportMotion(source, m, api.BASELINE, path.join(linked, 'no.glb')), /Linked/);
  await fs.unlink(linked);
  await assert.rejects(fs.access(path.join(directory, 'no.glb')));
});
test('incomplete and foreign publication reports reject before publication', async () => {
  await assert.rejects(api.validateLatest({ schemaVersion: 1, complete: false }), /Incomplete/);
  await assert.rejects(api.validateLatest({ schemaVersion: 1, complete: true, directory: path.resolve('public') }), /escapes/);
  const stale = JSON.parse(await fs.readFile(path.join(api.MOTION_CACHE, 'latest.json'), 'utf8'));
  stale.hashes.output = '0'.repeat(64);
  await assert.rejects(api.validateLatest(stale), /Stale output/);
});
test('equal corrupt outputs cannot satisfy independent motion comparison', async () => {
  const c = { json: structuredClone(clean.json), binary: Buffer.from(clean.binary) };
  c.json.animations.pop();
  const bytes = encodeGLB(c.json, c.binary);
  await assert.rejects(inspector.compareMotionExports(bytes, bytes, manifest), /Missing/);
});
test('negative-control artifacts retain the clean control and all corruptions', async () => {
  assert.equal(rejected.length, Object.keys(violations).length);
  await fs.writeFile(path.join(fixtureDirectory, 'clean.glb'), encodeGLB(clean.json, clean.binary));
  await fs.writeFile(path.join(fixtureDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(fixtureDirectory, 'negative-report.json'), JSON.stringify({
    complete: true, cleanControl: 'pass', rejected }, null, 2));
});

test('independent motion inspector rejects corrupt candidates and compares fresh exports', async () => {
  assert.equal(typeof inspector.inspectMotionCandidate, 'function', 'independent motion inspector must exist');
  const baselineBytes = await fs.readFile(new URL('../../public/models/enemy.glb', import.meta.url));
  const b = parseGLB(baselineBytes), m = api.fixtureManifest(b);
  const good = await api.mergeMotion(b, api.fixtureMotion(b, m), m);
  const bytes = () => encodeGLB(good.json, good.binary);
  assert.equal((await inspector.inspectMotionCandidate(bytes(), baselineBytes, m)).protectedEqual, true);
  assert.equal((await inspector.compareMotionExports(bytes(), bytes(), m)).equal, true);
  good.json.animations.at(-1).extras.donorSlot = 'OBWrongSlot';
  await assert.rejects(inspector.inspectMotionCandidate(bytes(), baselineBytes, m), /slot mismatch/);
});

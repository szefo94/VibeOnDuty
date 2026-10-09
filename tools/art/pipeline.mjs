import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inflateRawSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { excludeGenericPublication } from './motion-acceptance.mjs';
import { runtimeDependencyBytes, verifyRuntimeDependencies } from './runtime-dependencies.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE = path.join(ROOT, '.planning/research/.cache/06-art');
export const SOURCES = path.join(ROOT, 'tools/art/sources');
export const PIN = {
  url: 'https://download.blender.org/release/Blender4.5/blender-4.5.13-windows-x64.zip',
  sha256: 'b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6',
  bytes: 398648740,
  commit: 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482',
  sourceHashes: {
    'base.obj': '8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c',
    'LICENSE.md': 'edd99571ca62698f78c943fd4fffb159a413c315fa0d4819d3cec5cadaf8b4f1',
    'LICENSE.ASSETS.md': 'f6089cba01cb570a24712b41ab8a586ccd3cc5ef53dc266ca50b95c288956d2c',
  },
  baselineRevision: '8bef7d22a51533cecb1826bb5bd1fe62bb902a95',
  baselineHash: '4074b9f468d6f281abb280c5cf45746e4b7be3b00f9d547c25194127e9d7354c',
};
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function owned(root, target) {
  const absolute = path.resolve(target),
    relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('Path escapes owned root');
  let existing = absolute;
  while (true) {
    try {
      const actual = realpathSync(existing);
      const realRoot = realpathSync(root);
      const r = path.relative(realRoot, actual);
      if (r.startsWith('..') || path.isAbsolute(r)) throw Error('Linked path escapes owned root');
      break;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      existing = path.dirname(existing);
    }
  }
  return absolute;
}
export async function run(exe, args, env = process.env, options = {}) {
  // Bound our own Blender process, including import/bake/export. This generous
  // 15-minute ceiling covers measured contended 220-second exports. No timeout
  // changes a completed proof; an expired child cannot emit a successful report.
  const timeoutMs = options.timeoutMs ?? (/^blender(?:\.exe)?$/i.test(path.basename(exe)) ? 900000 : 0);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 900000 ||
    (Object.hasOwn(options, 'timeoutMs') && timeoutMs === 0)) throw Error('Invalid process deadline');
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: ROOT, env, windowsHide: true, stdio: 'inherit' });
    let timedOut = false;
    const timer = timeoutMs ? setTimeout(() => {
      timedOut = true;
      // The ChildProcess handle names only this invocation. Never kill by name,
      // enumerate sibling jobs, or terminate any other browser/runtime owner.
      child.kill();
    }, timeoutMs) : null;
    const finish = (error) => {
      if (timer) clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    child.on('error', finish);
    child.on('exit', code => finish(timedOut ? Error(`Process timeout: ${timeoutMs}ms`) :
      code === 0 ? null : Error(`Process failed: ${code}`)));
  });
}
async function download(url, destination, digest, maximum) {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw Error(`Download HTTP ${response.status}: ${url}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > maximum) throw Error('Download exceeds bound');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (digest && hash(bytes) !== digest) throw Error('SHA256 mismatch');
  await fs.writeFile(destination, bytes);
  return bytes;
}
// Read central directory before writing anything. Links, traversal, bombs and duplicates fail closed.
export function zipEntries(bytes, root) {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
    throw Error('Invalid ZIP');
  const count = bytes.readUInt16LE(end + 10),
    entries = [],
    names = new Set();
  let cursor = bytes.readUInt32LE(end + 16),
    total = 0;
  if (count < 1 || count > 30000 || count === 65535) throw Error('Archive count bound');
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw Error('Invalid central entry');
    const flags = bytes.readUInt16LE(cursor + 8),
      method = bytes.readUInt16LE(cursor + 10);
    const compressed = bytes.readUInt32LE(cursor + 20),
      size = bytes.readUInt32LE(cursor + 24);
    const n = bytes.readUInt16LE(cursor + 28),
      extra = bytes.readUInt16LE(cursor + 30),
      comment = bytes.readUInt16LE(cursor + 32);
    const mode = bytes.readUInt32LE(cursor + 38) >>> 16,
      offset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + n).toString('utf8');
    if (
      !name ||
      /[\\:]|(^|\/)\.\.(\/|$)|^\//.test(name) ||
      name.includes('\0') ||
      name
        .split('/')
        .some((part) => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)|[. ]$/i.test(part)) ||
      (mode & 0xf000) === 0xa000 ||
      flags & 1 ||
      ![0, 8].includes(method)
    )
      throw Error('Unsafe ZIP entry');
    const target = owned(root, path.join(root, name));
    if (names.has(target.toLowerCase())) throw Error('Duplicate ZIP entry');
    names.add(target.toLowerCase());
    total += size;
    if (size > 600000000 || total > 2000000000) throw Error('Archive size bound');
    if (bytes.readUInt32LE(offset) !== 0x04034b50) throw Error('Invalid local entry');
    const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    if (start + compressed > bytes.length) throw Error('Truncated ZIP entry');
    entries.push({ name, target, size, method, start, compressed });
    cursor += 46 + n + extra + comment;
  }
  return entries;
}
export async function bootstrap() {
  owned(ROOT, CACHE);
  await fs.mkdir(CACHE, { recursive: true });
  const archive = path.join(CACHE, 'blender.zip');
  let bytes;
  try {
    bytes = await fs.readFile(archive);
  } catch {
    bytes = await download(PIN.url, archive, PIN.sha256, PIN.bytes);
  }
  if (bytes.length !== PIN.bytes || hash(bytes) !== PIN.sha256)
    throw Error('Portable runtime pin mismatch');
  const runtime = path.join(CACHE, 'runtime');
  owned(CACHE, runtime);
  await fs.mkdir(runtime, { recursive: true });
  const exe = path.join(runtime, 'blender-4.5.13-windows-x64/blender.exe');
  try {
    await fs.access(exe);
  } catch {
    const entries = zipEntries(bytes, runtime);
    for (const e of entries) {
      if (e.name.endsWith('/')) {
        await fs.mkdir(e.target, { recursive: true });
        continue;
      }
      const raw = bytes.subarray(e.start, e.start + e.compressed);
      const data = e.method === 8 ? inflateRawSync(raw, { maxOutputLength: e.size }) : raw;
      if (data.length !== e.size) throw Error('Archive entry length mismatch');
      await fs.mkdir(path.dirname(e.target), { recursive: true });
      await fs.writeFile(e.target, data);
    }
  }
  const baseUrl = `https://raw.githubusercontent.com/makehumancommunity/makehuman/${PIN.commit}/`;
  for (const [name, suffix] of [
    ['base.obj', 'makehuman/data/3dobjs/base.obj'],
    ['LICENSE.md', 'LICENSE.md'],
    ['LICENSE.ASSETS.md', 'LICENSE.ASSETS.md'],
  ]) {
    const target = path.join(CACHE, name);
    try {
      await fs.access(target);
    } catch {
      await download(baseUrl + suffix, target, PIN.sourceHashes[name], 12000000);
    }
    if (hash(await fs.readFile(target)) !== PIN.sourceHashes[name])
      throw Error('Source pin mismatch');
  }
  const base = await fs.readFile(path.join(CACHE, 'base.obj'));
  if (!base.subarray(0, 3000).toString().includes('CC0'))
    throw Error('Human source lacks asset CC0 header');
  const baseline = path.join(CACHE, 'baseline.glb');
  try {
    await fs.access(baseline);
  } catch {
    const { stdout } = await promisify(execFile)(
      'git',
      ['-c', `safe.directory=${ROOT}`, 'show', `${PIN.baselineRevision}:public/models/enemy.glb`],
      { cwd: ROOT, encoding: 'buffer', maxBuffer: 8000000, windowsHide: true }
    );
    if (hash(stdout) !== PIN.baselineHash) throw Error('Git compatibility source pin mismatch');
    await fs.writeFile(baseline, stdout);
  }
  if (hash(await fs.readFile(baseline)) !== PIN.baselineHash)
    throw Error('Retained compatibility source changed');
  await fs.writeFile(
    path.join(CACHE, 'acquisition.json'),
    JSON.stringify(
      { pin: PIN, base: hash(base), baseline: hash(await fs.readFile(baseline)) },
      null,
      2
    )
  );
  owned(CACHE, exe);
  return realpathSync(exe);
}
export async function blender(args) {
  const exe = await bootstrap();
  await run(exe, [
    '--background',
    '--factory-startup',
    '--disable-autoexec',
    '--python-exit-code',
    '1',
    '--python',
    path.join(ROOT, 'tools/art/build_soldier.py'),
    '--',
    ...args,
  ]);
}
export async function exportSource(source, output, extra = []) {
  try {
    owned(SOURCES, source);
  } catch {
    owned(CACHE, source);
  }
  owned(CACHE, output);
  if (!source.endsWith('.blend') || !output.endsWith('.glb'))
    throw Error('Invalid source/export extension');
  const raw = output + '.raw.glb';
  await blender(['--mode', 'export', '--source', source, '--out', raw, ...extra]);
  const { preserveCompatibility } = await import('./inspect-character.mjs');
  const current = await approvedArtMotion();
  // Keep the historical art exporter and inherited index checks unchanged, then
  // append only the validated approved manifest actions through the motion seam.
  await preserveCompatibility(raw, path.join(CACHE, 'baseline.glb'), output);
  const { parseGLB, encodeGLB } = await import('./inspect-character.mjs');
  const combined = appendApprovedMotion(parseGLB(await fs.readFile(output)),
    parseGLB(await fs.readFile(current.publication)), current.check.inheritedOccurrences);
  await fs.writeFile(output, encodeGLB(combined.json, combined.binary));
  await inspectArtCandidate(output);
}

function appendApprovedMotion(art, approved, inheritedCount) {
  // Already approved floats must not be normalized/resampled a second time.
  // Copy the actual sampled bytes, preserving stride/offset and action metadata.
  const views = new Map(), accessors = new Map();
  const copyAccessor = index => {
    if (accessors.has(index)) return accessors.get(index);
    const source = approved.json.accessors[index];
    assert.equal(source.sparse, undefined, 'Sparse approved motion is unsupported');
    if (!views.has(source.bufferView)) {
      const view = approved.json.bufferViews[source.bufferView];
      assert.equal(view.buffer ?? 0, 0);
      const start = view.byteOffset || 0, offset = Math.ceil(art.binary.length / 4) * 4;
      art.binary = Buffer.concat([art.binary, Buffer.alloc(offset - art.binary.length),
        approved.binary.subarray(start, start + view.byteLength)]);
      views.set(source.bufferView, art.json.bufferViews.push({ ...view, byteOffset: offset }) - 1);
    }
    const result = art.json.accessors.push({ ...source, bufferView: views.get(source.bufferView) }) - 1;
    accessors.set(index, result); return result;
  };
  const joints = new Map(art.json.skins[0].joints.map(index => [art.json.nodes[index].name, index]));
  for (const original of approved.json.animations.slice(inheritedCount)) {
    const clip = structuredClone(original);
    for (const sampler of clip.samplers) {
      sampler.input = copyAccessor(sampler.input); sampler.output = copyAccessor(sampler.output);
    }
    for (const channel of clip.channels) {
      const target = joints.get(approved.json.nodes[channel.target.node].name);
      assert.notEqual(target, undefined, 'Approved motion target missing from inherited rig');
      channel.target.node = target;
    }
    art.json.animations.push(clip);
  }
  art.json.buffers = [{ byteLength: art.binary.length }];
  return art;
}

// Art edits may change the two reviewed art domains. Motion edits remain owned
// by motion-pipeline's separate bounded validator and never enter this seam.
export async function approvedArtMotion() {
  const dependencies = runtimeDependencyBytes();
  const { TUPLE_PATHS, ACCEPTANCE_PATH } = await import('./motion-acceptance.mjs');
  const identities = Object.fromEntries(Object.entries(TUPLE_PATHS).map(([key, file]) => [file, hash(dependencies[key])]));
  identities['tools/art/provenance.json'] = hash(dependencies.provenanceBytes);
  if (dependencies.acceptanceBytes) identities[ACCEPTANCE_PATH] = hash(dependencies.acceptanceBytes);
  const binding = verifyRuntimeDependencies(identities, dependencies);
  const { MANIFEST, BASELINE, MOTION_CACHE, parseManifest, validateMotionCandidate } =
    await import('./motion-pipeline.mjs');
  const manifest = parseManifest(await fs.readFile(MANIFEST, 'utf8'));
  assert.equal(hash(await fs.readFile(path.join(ROOT, manifest.source))), manifest.sourceHash,
    'Stale current motion donor');
  const retained = JSON.parse(await fs.readFile(path.join(MOTION_CACHE, 'publication.json'), 'utf8'));
  assert.equal(retained.complete, true, 'Incomplete approved motion publication');
  const publicationHash = binding.motion.tuple['public/models/enemy.glb'];
  assert.equal(hash(await fs.readFile(BASELINE)), publicationHash, 'Stale approved publication');
  await iterationPath([MOTION_CACHE], retained.baseline);
  assert.equal(hash(await fs.readFile(retained.baseline)), manifest.baselineHash, 'Stale inherited baseline');
  const check = await validateMotionCandidate(BASELINE, retained.baseline, manifest);
  return { publication: BASELINE, inheritedBaseline: retained.baseline,
    publicationHash, sourceHash: manifest.sourceHash, motionBinding: binding.motion,
    manifestHash: hash(await fs.readFile(MANIFEST)), check };
}

export async function inspectArtCandidate(candidate) {
  const current = await approvedArtMotion();
  const { inspectCharacter, parseGLB, encodeGLB, compareSemanticExports } =
    await import('./inspect-character.mjs');
  const { parseManifest, MANIFEST, validateListedMotion } = await import('./motion-pipeline.mjs');
  const bytes = Buffer.isBuffer(candidate) ? candidate : await fs.readFile(candidate);
  const asset = parseGLB(bytes), manifest = parseManifest(await fs.readFile(MANIFEST, 'utf8'));
  assert.equal(asset.json.animations.length, current.check.inheritedOccurrences + manifest.actions.length,
    'Current art candidate loses approved motion clips');
  const inherited = structuredClone(asset.json);
  inherited.animations = inherited.animations.slice(0, current.check.inheritedOccurrences);
  // Historical exact inherited-occurrence/skin/bind/rest checks remain intact.
  await inspectCharacter(encodeGLB(inherited, asset.binary), { baseline: path.join(CACHE, 'baseline.glb') });
  validateListedMotion(asset, manifest, current.check.inheritedOccurrences);
  const comparison = await compareSemanticExports(bytes, current.publication, { tolerance: 0 });
  assert.equal(comparison.domains.skin, true, 'Protected current skin differs');
  assert.equal(comparison.domains.motion, true, 'Protected approved motion differs');
  const result = await inspectCharacter(bytes);
  return { ...result, approvedMotionEqual: true, approvedMotion: current };
}
export async function refreshProvenance() {
  excludeGenericPublication();
  const filename = path.join(ROOT, 'tools/art/provenance.json');
  owned(ROOT, filename);
  let ledger;
  try {
    ledger = JSON.parse(await fs.readFile(filename));
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  for (const asset of ledger.assets)
    if (
      asset.path &&
      ['original-authoring-script', 'editable-mixed-source', 'runtime-mixed-export', 'editable-original-source', 'runtime-original-export'].includes(
        asset.role
      )
    )
      asset.sha256 = hash(await fs.readFile(path.join(ROOT, asset.path)));
  ledger.parameters = {
    path: 'tools/art/character-params.json',
    sha256: hash(await fs.readFile(path.join(ROOT, 'tools/art/character-params.json'))),
  };
  await fs.writeFile(filename, JSON.stringify(ledger, null, 2) + '\n');
}
export const ITERATION_OPERATIONS = Object.freeze({
  'helmet-cheek-guard-offset': [-0.025, 0.025],
  'accent-paint-gain': [0.4, 1.3],
});
// Iteration refuses every linked component, even links pointing inside an owned root.
export async function iterationPath(roots, target) {
  if (typeof target !== 'string' || !target || target.includes('\0'))
    throw Error('Invalid iteration path');
  const absolute = path.resolve(target);
  if (!roots.some((root) => {
    const relative = path.relative(root, absolute);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  })) throw Error('Iteration path escapes owned root');
  let current = absolute;
  while (true) {
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw Error('Linked iteration path');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return absolute;
}
export async function validateIteration({ source, params, request, out }) {
  const inputs = [await iterationPath([SOURCES, CACHE], source),
    await iterationPath([path.join(ROOT, 'tools/art'), CACHE], params),
    await iterationPath([CACHE], request)];
  const output = await iterationPath([CACHE], out);
  if (!inputs[0].endsWith('.blend') || !inputs[1].endsWith('.json') ||
    !inputs[2].endsWith('.json') || !output.endsWith('.blend')) throw Error('Iteration extension');
  for (const filename of inputs) {
    const stat = await fs.stat(filename);
    if (!stat.isFile() || stat.size > (filename.endsWith('.blend') ? 64000000 : 64000))
      throw Error('Iteration input bound');
  }
  for (const filename of [output, output + '.params.json', output + '.operation.json']) {
    await iterationPath([CACHE], filename);
    if (inputs.some((input) => input.toLowerCase() === filename.toLowerCase()))
      throw Error('Iteration output aliases input');
    await fs.access(filename).then(() => { throw Error('Iteration output already exists'); },
      (error) => { if (error.code !== 'ENOENT') throw error; });
  }
  const requestText = await fs.readFile(inputs[2], 'utf8');
  const keys = new Set();
  // Fixed schema keys are unique across both levels; decode escaped JSON keys too.
  for (const match of requestText.matchAll(/"((?:\\.|[^"\\])*)"\s*:/g)) {
    const key = JSON.parse('"' + match[1] + '"');
    if (keys.has(key)) throw Error('Duplicate iteration request key');
    keys.add(key);
  }
  const data = JSON.parse(requestText);
  if (!data || Object.keys(data).sort().join(',') !== 'operations,schemaVersion' ||
    data.schemaVersion !== 1 || !data.operations || Array.isArray(data.operations) ||
    typeof data.operations !== 'object' || !Object.keys(data.operations).length)
    throw Error('Invalid iteration request schema');
  for (const [name, value] of Object.entries(data.operations)) {
    const range = Object.hasOwn(ITERATION_OPERATIONS, name) && ITERATION_OPERATIONS[name];
    if (!range || typeof value !== 'number' || !Number.isFinite(value) ||
      value < range[0] || value > range[1]) throw Error('Unknown/out-of-range iteration operation');
  }
  const parameters = JSON.parse(await fs.readFile(inputs[1], 'utf8'));
  if (parameters.schemaVersion !== 1) throw Error('Invalid authoring parameters');
  return { source: inputs[0], params: inputs[1], request: inputs[2], out: output, data };
}
export async function applyIteration(options, validateOnly = false) {
  const checked = await validateIteration(options);
  if (validateOnly) return checked;
  const exe = await bootstrap();
  await run(exe, ['--background', '--factory-startup', '--disable-autoexec',
    '--python-exit-code', '1', '--python', path.join(ROOT, 'tools/art/iterate.py'), '--',
    '--source', checked.source, '--params', checked.params, '--request', checked.request,
    '--out', checked.out]);
  return checked;
}
export async function iterationDemo() {
  await fs.mkdir(CACHE, { recursive: true });
  const directory = await fs.mkdtemp(path.join(CACHE, 'iteration-'));
  const source = path.join(SOURCES, 'soldier.blend');
  const params = path.join(ROOT, 'tools/art/character-params.json');
  const published = path.join(ROOT, 'public/models/enemy.glb');
  const beforeInputs = { source: hash(await fs.readFile(source)),
    params: hash(await fs.readFile(params)), published: hash(await fs.readFile(published)) };
  const baselineSource = path.join(directory, 'baseline.blend');
  const baselineParams = path.join(directory, 'baseline.params.json');
  await fs.copyFile(source, baselineSource);
  await fs.copyFile(params, baselineParams);
  const before = path.join(directory, 'before.glb');
  await exportSource(baselineSource, before, ['--params', baselineParams]);
  const request = path.join(directory, 'request.json');
  await fs.writeFile(request, JSON.stringify({ schemaVersion: 1,
    operations: { 'helmet-cheek-guard-offset': 0.022, 'accent-paint-gain': 0.55 } }, null, 2));
  const changedSource = path.join(directory, 'changed.blend');
  await applyIteration({ source: baselineSource, params: baselineParams, request, out: changedSource });
  const changed = path.join(directory, 'changed.glb');
  await exportSource(changedSource, changed, ['--params', changedSource + '.params.json']);
  // Recover editable working files from separately retained source/parameters, then REOPEN.
  const restoredSource = path.join(directory, 'restored.blend');
  const restoredParams = path.join(directory, 'restored.params.json');
  await fs.copyFile(baselineSource, restoredSource);
  await fs.copyFile(baselineParams, restoredParams);
  const restored = path.join(directory, 'restored.glb');
  await exportSource(restoredSource, restored, ['--params', restoredParams]);
  const { compareSemanticExports, inspectCharacter } = await import('./inspect-character.mjs');
  const edited = await compareSemanticExports(before, changed);
  const recovered = await compareSemanticExports(before, restored);
  assert.equal(edited.equal, false, 'Edit must change semantic output');
  assert.equal(edited.domains.mesh, false, 'Cheek guard edit must change geometry');
  assert.equal(edited.domains.images, false, 'Accent edit must change painted pixels');
  assert.equal(edited.domains.skin, true); assert.equal(edited.domains.motion, true);
  assert.equal(recovered.equal, true, 'Restored source must regenerate baseline semantics');
  const publishedComparison = await compareSemanticExports(published, before);
  assert.equal(publishedComparison.equal, true, 'Accepted editable source must match published asset');
  for (const candidate of [before, changed, restored]) await inspectArtCandidate(candidate);
  const { reviewIteration } = await import('./review.mjs');
  const review = await reviewIteration(directory, { before, changed, restored });
  assert.equal(hash(await fs.readFile(source)), beforeInputs.source);
  assert.equal(hash(await fs.readFile(params)), beforeInputs.params);
  assert.equal(hash(await fs.readFile(published)), beforeInputs.published);
  const scripts = ['iterate.py', 'pipeline.mjs', 'review.mjs', 'build_soldier.py', 'inspect-character.mjs'];
  const report = { schemaVersion: 1, directory: path.relative(ROOT, directory),
    beforeInputs, operations: JSON.parse(await fs.readFile(request)),
    runtime: { version: '4.5.13 LTS', archiveHash: PIN.sha256, buildHash: 'daeeeca98fb0',
      executableHash: hash(await fs.readFile(await bootstrap())) },
    scriptHashes: Object.fromEntries(await Promise.all(scripts.map(async (name) =>
      [name, hash(await fs.readFile(path.join(ROOT, 'tools/art', name)))]))),
    files: Object.fromEntries(await Promise.all([baselineSource, baselineParams, request, before,
      changedSource, changedSource + '.params.json', changedSource + '.operation.json', changed,
      restoredSource, restoredParams, restored].map(async (filename) =>
      [path.basename(filename), hash(await fs.readFile(filename))]))),
    edited, recovered, publishedComparison, review, publishedAssetsUnchanged: true,
    approvedMotion: await approvedArtMotion() };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(CACHE, 'iteration-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  return report;
}
async function selfTest() {
  await fs.mkdir(CACHE, { recursive: true });
  await run(process.execPath, ['--test', 'tools/art/art-motion.test.mjs']);
  const { test } = await import('node:test');
  await test('bounded iteration accepts only the versioned reviewed edit before mutation', async () => {
    const directory = await fs.mkdtemp(path.join(CACHE, 'iteration-test-'));
    const request = path.join(directory, 'request.json');
    await fs.writeFile(request, JSON.stringify({ schemaVersion: 1,
      operations: { 'helmet-cheek-guard-offset': 0.018, 'accent-paint-gain': 0.7 } }));
    const accepted = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url),
      'iterate', '--validate', '--source', path.join(SOURCES, 'soldier.blend'),
      '--params', path.join(ROOT, 'tools/art/character-params.json'), '--request', request,
      '--out', path.join(directory, 'changed.blend')]).then(() => true, () => false);
    assert.equal(accepted, true, 'Reviewed bounded operation must validate successfully');
    await assert.rejects(fs.access(path.join(directory, 'changed.blend')),
      'Validation must not create editable output');
  });
  await test('iteration rejects unknown/range/path/link requests without changing retained inputs', async () => {
    const directory = await fs.mkdtemp(path.join(CACHE, 'iteration-negative-'));
    const source = path.join(SOURCES, 'soldier.blend');
    const params = path.join(ROOT, 'tools/art/character-params.json');
    const before = [hash(await fs.readFile(source)), hash(await fs.readFile(params))];
    const request = path.join(directory, 'request.json');
    const out = path.join(directory, 'candidate.blend');
    const options = { source, params, request, out };
    for (const operations of [{ unknown: 1 }, { 'accent-paint-gain': 1.31 },
      { 'helmet-cheek-guard-offset': -0.026 }, { 'accent-paint-gain': '0.8' },
      { 'accent-paint-gain': null }, { 'accent-paint-gain': true }, {}]) {
      await fs.writeFile(request, JSON.stringify({ schemaVersion: 1, operations }));
      await assert.rejects(applyIteration(options));
    }
    await fs.writeFile(request, '{"schemaVersion":1,"operations":{"accent-paint-gain":1e999}}');
    await assert.rejects(applyIteration(options));
    await fs.writeFile(request, '{"schemaVersion":1,"operations":{"accent-paint-gain":0.8,"accent-paint-gain":0.9}}');
    await assert.rejects(applyIteration(options));
    await fs.writeFile(request, JSON.stringify({ schemaVersion: 1,
      operations: { 'accent-paint-gain': 0.8 }, script: 'untrusted' }));
    await assert.rejects(applyIteration(options));
    await fs.writeFile(request, JSON.stringify({ schemaVersion: 1, operations: { 'accent-paint-gain': 0.8 } }));
    await assert.rejects(applyIteration({ ...options, out: path.join(CACHE, '../outside.blend') }));
    await assert.rejects(applyIteration({ ...options, out: source }));
    await assert.rejects(applyIteration({ ...options, source: path.join(ROOT, 'AGENTS.md') }));
    const link = path.join(directory, 'linked');
    await fs.symlink(directory, link, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(applyIteration({ ...options, out: path.join(link, 'candidate.blend') }));
    await fs.unlink(link);
    await assert.rejects(fs.access(out));
    assert.deepEqual([hash(await fs.readFile(source)), hash(await fs.readFile(params))], before);
    console.log('Unknown, finite/range/type, escape, alias and real link negatives rejected before Blender');
  });
  assert.throws(() => owned(CACHE, path.join(CACHE, '../outside')));
  assert.throws(() => zipEntries(Buffer.alloc(0), CACHE));
  assert.throws(() => zipEntries(Buffer.from('corrupt'), CACHE));
  function fixture(name, mode = 0x81a4, size = 1) {
    const n = Buffer.from(name),
      local = Buffer.alloc(30),
      central = Buffer.alloc(46),
      end = Buffer.alloc(22);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt32LE(1, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(n.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt32LE(1, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE((mode << 16) >>> 0, 38);
    const first = Buffer.concat([local, n, Buffer.from('x')]);
    const directory = Buffer.concat([central, n]);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(first.length, 16);
    return Buffer.concat([first, directory, end]);
  }
  assert.equal(zipEntries(fixture('valid/file.txt'), CACHE).length, 1);
  for (const unsafe of [
    '../escape',
    '/absolute',
    'C:/escape',
    'folder\\escape',
    'CON.txt',
    'folder/../escape',
  ])
    assert.throws(() => zipEntries(fixture(unsafe), CACHE));
  assert.throws(() => zipEntries(fixture('link', 0xa1ff), CACHE));
  assert.throws(() => zipEntries(fixture('bomb', 0x81a4, 700000000), CACHE));
  assert.equal(owned(CACHE, path.join(CACHE, 'candidate.glb')), path.join(CACHE, 'candidate.glb'));
  const source = path.join(SOURCES, 'soldier.blend');
  let before;
  try {
    before = hash(await fs.readFile(source));
  } catch {
    /* First run has no source. */
  }
  const child = await promisify(execFile)(process.execPath, [
    fileURLToPath(import.meta.url),
    'invalid-operation',
  ]).then(
    () => false,
    () => true
  );
  assert.equal(child, true, 'Unknown operation must reject');
  if (before) assert.equal(hash(await fs.readFile(source)), before, 'Rejection must retain source');
  console.log(
    'pipeline self-test passed: bounded paths, corrupt archive, unknown operation and retained source'
  );
}
async function main() {
  if (['build', 'build-slice'].includes(process.argv[2])) excludeGenericPublication();
  const command = process.argv[2],
    args = process.argv.slice(3);
  if (command === 'self-test') return selfTest();
  if (command === 'iterate') {
    if (args.length === 1 && args[0] === '--demo') return iterationDemo();
    const validateOnly = args[0] === '--validate';
    const fields = validateOnly ? args.slice(1) : args;
    if (fields.length !== 8 || fields[0] !== '--source' || fields[2] !== '--params' ||
      fields[4] !== '--request' || fields[6] !== '--out') throw Error('Invalid iterate arguments');
    return applyIteration({ source: path.resolve(ROOT, fields[1]), params: path.resolve(ROOT, fields[3]),
      request: path.resolve(ROOT, fields[5]), out: path.resolve(ROOT, fields[7]) }, validateOnly);
  }
  if (!['bootstrap', 'build', 'build-slice', 'probe', 'export'].includes(command))
    throw Error('Unknown operation');
  if (
    (command === 'bootstrap' && args.length) ||
    (command === 'build' && args.some((a) => a !== '--probe')) ||
    (command === 'build-slice' && args.some((a) => a !== '--probe')) ||
    (command === 'probe' && args.some((a) => a !== '--provenance')) ||
    (command === 'export' && (args.length !== 4 || args[0] !== '--source' || args[2] !== '--out'))
  )
    throw Error('Unknown/invalid operation arguments');
  await fs.mkdir(CACHE, { recursive: true });
  if (command === 'build-slice') {
    const source = owned(CACHE, path.join(CACHE, 'slice-candidate.blend'));
    const out = owned(CACHE, path.join(CACHE, 'slice-candidate.png'));
    const repeat = owned(CACHE, path.join(CACHE, 'slice-reopened.png'));
    const exe = await bootstrap();
    const invoke = (mode, output) => run(exe, ['--background', '--factory-startup',
      '--disable-autoexec', '--python-exit-code', '1', '--python',
      path.join(ROOT, 'tools/art/build_slice.py'), '--', '--mode', mode,
      '--source', source, '--out', output]);
    await invoke('build', out);
    await invoke('export', repeat);
    const bytes = await fs.readFile(out);
    assert.equal(hash(bytes), hash(await fs.readFile(repeat)), 'Saved source must reproduce atlas bytes');
    assert.equal(bytes.readUInt32BE(16), 1024);
    assert.equal(bytes.readUInt32BE(20), 1024);
    assert.ok(bytes.length > 20000 && bytes.length < 8000000, 'Atlas byte bound');
    await fs.mkdir(owned(ROOT, path.join(ROOT, 'public/textures')), { recursive: true });
    await fs.copyFile(source, owned(SOURCES, path.join(SOURCES, 'slice.blend')));
    await fs.copyFile(out, owned(ROOT, path.join(ROOT, 'public/textures/comic-slice.png')));
    await refreshProvenance();
    console.log('Editable original slice reopened with identical bounded PNG export');
    return;
  }
  if (command === 'bootstrap') {
    await run(await bootstrap(), ['--version']);
    return;
  }
  if (command === 'probe' && args.includes('--provenance')) {
    const ledger = JSON.parse(await fs.readFile(path.join(ROOT, 'tools/art/provenance.json')));
    for (const asset of ledger.assets) {
      if (!asset.terms || !asset.role || !asset.sha256 || !asset.source)
        throw Error('Missing asset provenance');
      if (asset.path && hash(await fs.readFile(path.join(ROOT, asset.path))) !== asset.sha256)
        throw Error(`Provenance hash mismatch: ${asset.path}`);
      if (asset.role.startsWith('inherited') && asset.disposition !== 'unresolved')
        throw Error('Unsupported inherited clearance');
    }
    console.log('Provenance verified');
    return;
  }
  if (command === 'probe') {
    await blender(['--mode', 'probe', '--out', path.join(CACHE, 'probe.json')]);
    return;
  }
  if (command === 'export') {
    const source = args[args.indexOf('--source') + 1],
      out = args[args.indexOf('--out') + 1];
    if (!args.includes('--source') || !args.includes('--out'))
      throw Error('Export needs source/out');
    return exportSource(path.resolve(ROOT, source), path.resolve(ROOT, out));
  }
  owned(ROOT, SOURCES);
  await fs.mkdir(SOURCES, { recursive: true });
  const candidate = path.join(CACHE, 'candidate.glb');
  if (args.includes('--probe')) {
    await blender(['--mode', 'probe', '--out', path.join(CACHE, 'probe.json')]);
    const probe = JSON.parse(await fs.readFile(path.join(CACHE, 'probe.json')));
    if (
      probe.version !== '4.5.13 LTS' ||
      !['export_influence_nb', 'export_extras', 'export_skins'].every((key) =>
        probe.exporterOptions.includes(key)
      )
    )
      throw Error('Runtime/exporter probe mismatch');
  }
  const candidateSource = path.join(CACHE, 'candidate.blend');
  await blender([
    '--mode',
    'build',
    '--baseline',
    path.join(CACHE, 'baseline.glb'),
    '--base',
    path.join(CACHE, 'base.obj'),
    '--source',
    candidateSource,
    '--out',
    candidate + '.raw.glb',
  ]);
  const { preserveCompatibility } = await import('./inspect-character.mjs');
  await preserveCompatibility(candidate + '.raw.glb', path.join(CACHE, 'baseline.glb'), candidate);
  await exportSource(candidateSource, path.join(CACHE, 'reopened.glb'));
  const { inspectCharacter } = await import('./inspect-character.mjs');
  await inspectCharacter(candidate, { baseline: path.join(CACHE, 'baseline.glb') });
  await run(
    process.execPath,
    [
      path.join(ROOT, 'node_modules/@playwright/test/cli.js'),
      'test',
      'tests/character-art.spec.js',
      '--grep',
      'art tracer:',
      '--workers=1',
    ],
    { ...process.env, VOD_ART_CANDIDATE: candidate }
  );
  const staging = path.join(ROOT, 'public/models/enemy.glb.pending');
  owned(ROOT, staging);
  owned(ROOT, path.join(SOURCES, 'soldier.blend.pending'));
  await fs.copyFile(candidateSource, path.join(SOURCES, 'soldier.blend.pending'));
  await fs.rename(path.join(SOURCES, 'soldier.blend.pending'), path.join(SOURCES, 'soldier.blend'));
  await fs.copyFile(candidate, staging);
  await fs.rename(staging, path.join(ROOT, 'public/models/enemy.glb'));
  await refreshProvenance();
  console.log('Built, reopened, checked and atomically published human candidate');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inflateRawSync } from 'node:zlib';
import assert from 'node:assert/strict';

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
  const absolute = path.resolve(target), relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Path escapes owned root');
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
export async function run(exe, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: ROOT, env, windowsHide: true, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(Error(`Process failed: ${code}`)));
  });
}
async function download(url, destination, digest, maximum) {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw Error(`Download HTTP ${response.status}: ${url}`);
  const chunks = []; let length = 0;
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
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw Error('Invalid ZIP');
  const count = bytes.readUInt16LE(end + 10), entries = [], names = new Set();
  let cursor = bytes.readUInt32LE(end + 16), total = 0;
  if (count < 1 || count > 30000 || count === 65535) throw Error('Archive count bound');
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw Error('Invalid central entry');
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const compressed = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const n = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32);
    const mode = bytes.readUInt32LE(cursor + 38) >>> 16, offset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + n).toString('utf8');
    if (!name || /[\\:]|(^|\/)\.\.(\/|$)|^\//.test(name) || name.includes('\0') || name.split('/').some((part) => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)|[. ]$/i.test(part)) || (mode & 0xf000) === 0xa000 || flags & 1 || ![0, 8].includes(method)) throw Error('Unsafe ZIP entry');
    const target = owned(root, path.join(root, name));
    if (names.has(target.toLowerCase())) throw Error('Duplicate ZIP entry');
    names.add(target.toLowerCase()); total += size;
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
  await fs.mkdir(CACHE, { recursive: true });
  const archive = path.join(CACHE, 'blender.zip');
  let bytes;
  try { bytes = await fs.readFile(archive); } catch { bytes = await download(PIN.url, archive, PIN.sha256, PIN.bytes); }
  if (bytes.length !== PIN.bytes || hash(bytes) !== PIN.sha256) throw Error('Portable runtime pin mismatch');
  const runtime = path.join(CACHE, 'runtime');
  await fs.mkdir(runtime, { recursive: true });
  const exe = path.join(runtime, 'blender-4.5.13-windows-x64/blender.exe');
  try { await fs.access(exe); } catch {
    const entries = zipEntries(bytes, runtime);
    for (const e of entries) {
      if (e.name.endsWith('/')) { await fs.mkdir(e.target, { recursive: true }); continue; }
      const raw = bytes.subarray(e.start, e.start + e.compressed);
      const data = e.method === 8 ? inflateRawSync(raw, { maxOutputLength: e.size }) : raw;
      if (data.length !== e.size) throw Error('Archive entry length mismatch');
      await fs.mkdir(path.dirname(e.target), { recursive: true }); await fs.writeFile(e.target, data);
    }
  }
  const baseUrl = `https://raw.githubusercontent.com/makehumancommunity/makehuman/${PIN.commit}/`;
  for (const [name, suffix] of [['base.obj', 'makehuman/data/3dobjs/base.obj'], ['LICENSE.md', 'LICENSE.md'], ['LICENSE.ASSETS.md', 'LICENSE.ASSETS.md']]) {
    const target = path.join(CACHE, name);
    try { await fs.access(target); } catch { await download(baseUrl + suffix, target, PIN.sourceHashes[name], 12000000); }
    if (hash(await fs.readFile(target)) !== PIN.sourceHashes[name]) throw Error('Source pin mismatch');
  }
  const base = await fs.readFile(path.join(CACHE, 'base.obj'));
  if (!base.subarray(0, 3000).toString().includes('CC0')) throw Error('Human source lacks asset CC0 header');
  const baseline = path.join(CACHE, 'baseline.glb');
  try { await fs.access(baseline); } catch {
    const { stdout } = await promisify(execFile)('git', ['-c', `safe.directory=${ROOT}`, 'show', `${PIN.baselineRevision}:public/models/enemy.glb`], { cwd: ROOT, encoding: 'buffer', maxBuffer: 8000000, windowsHide: true });
    if (hash(stdout) !== PIN.baselineHash) throw Error('Git compatibility source pin mismatch');
    await fs.writeFile(baseline, stdout);
  }
  if (hash(await fs.readFile(baseline)) !== PIN.baselineHash) throw Error('Retained compatibility source changed');
  await fs.writeFile(path.join(CACHE, 'acquisition.json'), JSON.stringify({ pin: PIN, base: hash(base), baseline: hash(await fs.readFile(baseline)) }, null, 2));
  return exe;
}
export async function blender(args) {
  const exe = await bootstrap();
  await run(exe, ['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1', '--python', path.join(ROOT, 'tools/art/build_soldier.py'), '--', ...args]);
}
export async function exportSource(source, output, extra = []) {
  owned(ROOT, source); owned(CACHE, output);
  const raw = output + '.raw.glb';
  await blender(['--mode', 'export', '--source', source, '--out', raw, ...extra]);
  const { preserveCompatibility } = await import('./inspect-character.mjs');
  await preserveCompatibility(raw, path.join(CACHE, 'baseline.glb'), output);
}
async function selfTest() {
  await fs.mkdir(CACHE, { recursive: true });
  assert.throws(() => owned(CACHE, path.join(CACHE, '../outside')));
  assert.throws(() => zipEntries(Buffer.alloc(0), CACHE));
  assert.throws(() => zipEntries(Buffer.from('corrupt'), CACHE));
  function fixture(name, mode = 0x81a4, size = 1) {
    const n = Buffer.from(name), local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
    local.writeUInt32LE(0x04034b50); local.writeUInt32LE(1, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(n.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt32LE(1, 20); central.writeUInt32LE(size, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE((mode << 16) >>> 0, 38);
    const first = Buffer.concat([local, n, Buffer.from('x')]);
    const directory = Buffer.concat([central, n]);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(first.length, 16);
    return Buffer.concat([first, directory, end]);
  }
  assert.equal(zipEntries(fixture('valid/file.txt'), CACHE).length, 1);
  for (const unsafe of ['../escape', '/absolute', 'C:/escape', 'folder\\escape', 'CON.txt', 'folder/../escape']) assert.throws(() => zipEntries(fixture(unsafe), CACHE));
  assert.throws(() => zipEntries(fixture('link', 0xa1ff), CACHE));
  assert.throws(() => zipEntries(fixture('bomb', 0x81a4, 700000000), CACHE));
  assert.equal(owned(CACHE, path.join(CACHE, 'candidate.glb')), path.join(CACHE, 'candidate.glb'));
  const source = path.join(SOURCES, 'soldier.blend');
  let before; try { before = hash(await fs.readFile(source)); } catch { /* First run has no source. */ }
  const child = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), 'invalid-operation']).then(() => false, () => true);
  assert.equal(child, true, 'Unknown operation must reject');
  if (before) assert.equal(hash(await fs.readFile(source)), before, 'Rejection must retain source');
  console.log('pipeline self-test passed: bounded paths, corrupt archive, unknown operation and retained source');
}
async function main() {
  const command = process.argv[2], args = process.argv.slice(3);
  if (command === 'self-test') return selfTest();
  if (!['bootstrap', 'build', 'probe', 'export'].includes(command)) throw Error('Unknown operation');
  await fs.mkdir(CACHE, { recursive: true });
  if (command === 'bootstrap') { await run(await bootstrap(), ['--version']); return; }
  if (command === 'probe' && args.includes('--provenance')) {
    const ledger = JSON.parse(await fs.readFile(path.join(ROOT, 'tools/art/provenance.json')));
    for (const asset of ledger.assets) {
      if (!asset.terms || !asset.role || !asset.sha256 || !asset.source) throw Error('Missing asset provenance');
      if (asset.path && hash(await fs.readFile(path.join(ROOT, asset.path))) !== asset.sha256) throw Error(`Provenance hash mismatch: ${asset.path}`);
      if (asset.role.startsWith('inherited') && asset.disposition !== 'unresolved') throw Error('Unsupported inherited clearance');
    }
    console.log('Provenance verified'); return;
  }
  if (command === 'probe') { await blender(['--mode', 'probe', '--out', path.join(CACHE, 'probe.json')]); return; }
  if (command === 'export') {
    const source = args[args.indexOf('--source') + 1], out = args[args.indexOf('--out') + 1];
    if (!args.includes('--source') || !args.includes('--out')) throw Error('Export needs source/out');
    return exportSource(path.resolve(ROOT, source), path.resolve(ROOT, out));
  }
  await fs.mkdir(SOURCES, { recursive: true });
  const candidate = path.join(CACHE, 'candidate.glb');
  const candidateSource = path.join(CACHE, 'candidate.blend');
  await blender(['--mode', 'build', '--baseline', path.join(CACHE, 'baseline.glb'), '--base', path.join(CACHE, 'base.obj'), '--source', candidateSource, '--out', candidate + '.raw.glb']);
  const { preserveCompatibility } = await import('./inspect-character.mjs');
  await preserveCompatibility(candidate + '.raw.glb', path.join(CACHE, 'baseline.glb'), candidate);
  await exportSource(candidateSource, path.join(CACHE, 'reopened.glb'));
  const { inspectCharacter } = await import('./inspect-character.mjs');
  await inspectCharacter(candidate, { baseline: path.join(CACHE, 'baseline.glb') });
  await run(process.execPath, [path.join(ROOT, 'node_modules/@playwright/test/cli.js'), 'test', 'tests/character-art.spec.js', '--grep', 'art tracer:', '--workers=1'], { ...process.env, VOD_ART_CANDIDATE: candidate });
  await fs.copyFile(candidateSource, path.join(SOURCES, 'soldier.blend.pending'));
  await fs.rename(path.join(SOURCES, 'soldier.blend.pending'), path.join(SOURCES, 'soldier.blend'));
  const staging = path.join(ROOT, 'public/models/enemy.glb.pending');
  await fs.copyFile(candidate, staging); await fs.rename(staging, path.join(ROOT, 'public/models/enemy.glb'));
  console.log('Built, reopened, checked and atomically published human candidate');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });

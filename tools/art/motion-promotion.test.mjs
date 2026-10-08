import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runtimeDependencyBytes, verifyRuntimeDependencies } from './runtime-dependencies.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = { glbBytes: 'public/models/enemy.glb', donorBytes: 'tools/art/sources/motion.blend',
  manifestBytes: 'tools/art/motion-manifest.json', provenanceBytes: 'tools/art/provenance.json' };
const bytes = { ...runtimeDependencyBytes(), glbBytes: readFileSync(paths.glbBytes),
  donorBytes: readFileSync(paths.donorBytes) };
const identities = Object.fromEntries(Object.entries(paths).map(([key, file]) => [file, hash(bytes[key])]));

for (const key of ['glbBytes', 'donorBytes']) test('actual ' + key + ' corruption cannot self-qualify', () => {
  const changed = Buffer.from(bytes[key]); changed[changed.length - 17] ^= 1;
  assert.throws(() => verifyRuntimeDependencies({ ...identities, [paths[key]]: hash(changed) },
    { ...bytes, [key]: changed }), /registered|tuple|accepted/);
});

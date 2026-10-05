import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { parseGLB, encodeGLB } from './inspect-character.mjs';

const api = await import('./motion-pipeline.mjs').catch(() => ({}));
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

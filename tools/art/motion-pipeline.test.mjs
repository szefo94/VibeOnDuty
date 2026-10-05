import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { parseGLB, encodeGLB } from './inspect-character.mjs';

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

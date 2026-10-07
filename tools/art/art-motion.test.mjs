import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { parseGLB, encodeGLB, inspectCharacter } from './inspect-character.mjs';
import * as pipeline from './pipeline.mjs';

const bytes = await fs.readFile(new URL('../../public/models/enemy.glb', import.meta.url));
const inspect = candidate => pipeline.inspectArtCandidate
  ? pipeline.inspectArtCandidate(candidate) : inspectCharacter(candidate);
const fixture = edit => {
  const asset = parseGLB(Buffer.from(bytes));
  edit(asset);
  return encodeGLB(asset.json, asset.binary);
};

test('current art recovery rejects old-motion-only output instead of accepting 48 clips', async () => {
  await assert.rejects(inspect(fixture(a => {
    a.json.animations = a.json.animations.filter(c => !c.name.startsWith('vod7_'));
  })), /motion|clips|occurrences/i);
});
test('current art recovery preserves all 107 accepted sampled clips', async () => {
  const result = await inspect(bytes);
  assert.equal(result.animations, 107);
  assert.equal(result.approvedMotionEqual, true);
});
test('current art recovery rejects protected inverse bind corruption', async () => {
  await assert.rejects(inspect(fixture(a => {
    const acc = a.json.accessors[a.json.skins[0].inverseBindMatrices];
    const view = a.json.bufferViews[acc.bufferView];
    a.binary.writeFloatLE(.22, (view.byteOffset || 0) + (acc.byteOffset || 0));
  })), /skin|bind|protected/i);
});
test('current art recovery rejects a changing approved-motion quaternion', async () => {
  await assert.rejects(inspect(fixture(a => {
    const clip = a.json.animations.find(c => c.name.startsWith('vod7_'));
    const acc = a.json.accessors[clip.samplers[0].output];
    const view = a.json.bufferViews[acc.bufferView];
    a.binary.writeFloatLE(.2, (view.byteOffset || 0) + (acc.byteOffset || 0));
  })), /motion|quaternion|protected|action transforms/i);
});

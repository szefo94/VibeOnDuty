import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGLB, accessor } from './inspect-character.mjs';

// The optional path is an unpublished candidate, never a replacement publication.
const asset = parseGLB(readFileSync(process.env.VOD_CROUCH_CANDIDATE || 'public/models/enemy.glb'));
const channels = (name) => {
  const clip = asset.json.animations.find((a) => a.name === 'vod7_crouch_' + name);
  assert.ok(clip, 'Real directional crouch clip exists');
  return clip.channels.map((c) => {
    const s = clip.samplers[c.sampler];
    return { bone: asset.json.nodes[c.target.node].name, path: c.target.path,
      interpolation: s.interpolation, times: accessor(asset, s.input), values: accessor(asset, s.output) };
  });
};

test('actual crouch channel buffers distinguish all four movement directions', () => {
  const names = ['forward', 'back', 'left', 'right'];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++)
    assert.ok(JSON.stringify(channels(names[i])) !== JSON.stringify(channels(names[j])),
      names[i] + ' and ' + names[j] + ' must have distinct sampled motion');
});

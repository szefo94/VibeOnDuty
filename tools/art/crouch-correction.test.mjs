import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGLB, accessor } from './inspect-character.mjs';
import { sampleCrouch, validateCorrection } from './crouch-correction.mjs';

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

test('fixed-heading native mixer trajectories have sagittal/lateral signed stride and cyclic crouch', () => {
  const traces = Object.fromEntries(['forward', 'back', 'left', 'right'].map((d) => [d, sampleCrouch(asset, d)]));
  const excursion = (d, bone, axis) => traces[d].samples[18][bone][axis] - traces[d].samples[54][bone][axis];
  // Model neutral heading is +Z. Back reverses the forward planted foot sweep;
  // left/right use X rather than borrowing the forward/back sagittal channel.
  assert.ok(excursion('forward', 'foot_l', 2) < -.1);
  assert.ok(excursion('back', 'foot_l', 2) > .1);
  assert.ok(excursion('left', 'foot_l', 0) < -.1);
  assert.ok(excursion('right', 'foot_l', 0) > .1);
  for (const d of ['left', 'right']) {
    assert.ok(Math.abs(excursion(d, 'foot_l', 2)) < .001);
    const a = traces[d].samples[18].foot_lQuaternion, b = traces[d].samples[54].foot_lQuaternion;
    assert.ok(Math.abs(a.reduce((sum, v, i) => sum + v * b[i], 0)) > .999999, d + ' counter-rolled contact sole');
  }
  for (const [d, trace] of Object.entries(traces)) {
    assert.ok(Math.abs(trace.duration - 1.2) < 1e-6);
    for (const bone of ['pelvis', 'thigh_l', 'thigh_r', 'foot_l', 'foot_r']) {
      trace.samples[0][bone].forEach((v, axis) => assert.ok(Math.abs(v - trace.samples.at(-1)[bone][axis]) < 1e-5, d + ' cyclic ' + bone));
    }
    // The two feet counterphase, with constant crouch compression/root.
    const ranges = trace.samples.map((s) => s.pelvis[1]);
    assert.ok(Math.max(...ranges) - Math.min(...ranges) < 1e-5, d + ' steady crouch');
    assert.ok(Math.abs(trace.samples[18].foot_l[1] - trace.samples[54].foot_r[1]) < 1e-5, d + ' alternating contact');
    for (const s of trace.samples) for (const axis of [0, 2])
      assert.ok(Math.abs(s.pelvis[axis] - trace.samples[0].pelvis[axis]) < 1e-5, d + ' no horizontal root motion');
  }
});

test('exact correction guard rejects unchanged bad clips and unrelated or protected corruption', async () => {
  const accepted = readFileSync('public/models/enemy.glb');
  await assert.rejects(validateCorrection(accepted, accepted), /Unchanged directional/);
  if (!process.env.VOD_CROUCH_CANDIDATE) return; // RED baseline has no valid corrected fixture yet.
  const { encodeGLB } = await import('./inspect-character.mjs');
  const mutate = () => ({ json: structuredClone(asset.json), binary: Buffer.from(asset.binary) });
  await validateCorrection(encodeGLB(asset.json, asset.binary), accepted);
  const c = mutate(); c.json.nodes[c.json.skins[0].joints[0]].translation = [.01, 0, 0];
  await assert.rejects(validateCorrection(encodeGLB(c.json, c.binary), accepted), /Protected/);
  const n = mutate(), clip = n.json.animations.find((a) => a.name === 'vod7_m4_ready');
  const acc = n.json.accessors[clip.samplers[0].output], view = n.json.bufferViews[acc.bufferView];
  n.binary.writeFloatLE(.2, (view.byteOffset || 0) + (acc.byteOffset || 0));
  await assert.rejects(validateCorrection(encodeGLB(n.json, n.binary), accepted), /Unrelated motion|Invalid quaternion/);
  for (const direction of ['back', 'left', 'right']) {
    const u = mutate(), target = u.json.animations.find((a) => a.name === 'vod7_crouch_' + direction);
    const forward = u.json.animations.find((a) => a.name === 'vod7_crouch_forward');
    target.channels = structuredClone(forward.channels); target.samplers = structuredClone(forward.samplers);
    await assert.rejects(validateCorrection(encodeGLB(u.json, u.binary), accepted), /Unchanged directional/);
  }
  const root = mutate(), target = root.json.animations.find((a) => a.name === 'vod7_crouch_back');
  target.channels[0].target.node = root.json.skins[0].joints[0];
  await assert.rejects(validateCorrection(encodeGLB(root.json, root.binary), accepted));
  const wrongDirection = mutate(), left = wrongDirection.json.animations.find((a) => a.name === 'vod7_crouch_left');
  const right = wrongDirection.json.animations.find((a) => a.name === 'vod7_crouch_right');
  left.channels = structuredClone(right.channels); left.samplers = structuredClone(right.samplers);
  await assert.rejects(validateCorrection(encodeGLB(wrongDirection.json, wrongDirection.binary), accepted), /Lateral stride sign/);
});

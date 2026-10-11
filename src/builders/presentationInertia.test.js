import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  copyPresentationMask, crossfade, inspectPresentationLayers, tickInertia, tickPresentation,
} from './enemyAnimations.js';

// The inertia blend writes bone quaternions after the mixer. Three's PropertyMixer only writes a
// property whose blended value changed, so a bone on an exactly constant track kept the first
// blended pose for good (.planning/debug/phase7-human-motion-review.md, cause 2). These cases
// drive the real skeleton through the exported driver functions only.

const DEG = 180 / Math.PI;
const LEGS = ['thigh_l', 'thigh_r', 'calf_l', 'calf_r'];
// Angle between two rotations in degrees, through the relative rotation so that it stays exact near zero.
const angle = (a, b) => {
  const r = a.clone().invert().multiply(b);
  return 2 * Math.atan2(Math.hypot(r.x, r.y, r.z), Math.abs(r.w)) * DEG;
};
const local = (mesh, name) => mesh.getObjectByName(name).quaternion.clone();

let gltf;
beforeAll(async () => {
  const data = readFileSync('public/models/enemy.glb');
  // Node-only image isolation, as in enemyGLTF.test.js. Browser suites decode the real maps.
  vi.stubGlobal('self', globalThis);
  const images = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    const texture = new THREE.Texture(); queueMicrotask(() => onLoad(texture)); return texture;
  });
  try {
    gltf = await new GLTFLoader().parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  } finally { images.mockRestore(); vi.unstubAllGlobals(); }
});

const named = name => gltf.animations.find(clip => clip.name === name);
function actor(clips) {
  const mesh = skeletonClone(gltf.scene), mixer = new THREE.AnimationMixer(mesh), actions = {};
  for (const [key, clip] of Object.entries(clips)) actions[key] = mixer.clipAction(clip);
  return { mesh, mixer, actions };
}
/** One clock for one actor: every call advances the observed simulation time by dt. */
function clock(e, dt) {
  let frame = 0;
  return (frames, more = {}) => {
    for (let i = 0; i < frames; i++) tickPresentation(e, { identity: 'inertia', generation: 0,
      sampleTimeSeconds: frame++ * dt, position: { x: 0, y: 0, z: 0 }, bodyYaw: 0, aimYaw: 0,
      pitch: 0, alive: true, onGround: true, weapon: 'm4', ...more }, dt);
  };
}
/** Two equal keys per bone: exactly constant tracks, turned away from the rest pose. */
function heldClip(name, mesh, turn) {
  return new THREE.AnimationClip(name, 1, LEGS.map(bone => {
    const q = mesh.getObjectByName(bone).quaternion.clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), turn));
    return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [...q.toArray(), ...q.toArray()]);
  }));
}
const heldValue = (clip, bone) => new THREE.Quaternion().fromArray(
  clip.tracks.find(track => track.name === `${bone}.quaternion`).values);

describe('inertia over the presentation driver', () => {
  it('reaches the selected crouch legs after a transition with inertia on', () => {
    const ready = named('vod7_m4_ready'), crouch = named('vod7_crouch_idle');
    const e = actor({ idle: ready, m4_ready: ready, crouch_idle: crouch });
    const tick = clock(e, 1 / 60);
    tick(30);
    const standing = Object.fromEntries(LEGS.map(bone => [bone, local(e.mesh, bone)]));
    tick(90, { crouching: true });
    const lower = inspectPresentationLayers(e).find(layer => layer.clip.endsWith('_lower'));
    expect(lower.clip).toBe('vod7_crouch_idle_lower');
    expect(lower.weight).toBe(1);
    // The same lower layer, sampled alone at the same time on a second skeleton.
    const alone = skeletonClone(gltf.scene), mixer = new THREE.AnimationMixer(alone);
    const action = mixer.clipAction(copyPresentationMask(crouch, false));
    action.play(); action.time = lower.time; action.setEffectiveTimeScale(0); mixer.update(0);
    for (const bone of LEGS) {
      // The transition is a real one: the layer asks for a clearly different leg pose.
      expect(angle(standing[bone], local(alone, bone)), `${bone} transition size`).toBeGreaterThan(20);
      expect(angle(local(e.mesh, bone), local(alone, bone)), `${bone} after 90 frames`).toBeLessThanOrEqual(0.5);
    }
  });

  it('reaches an exactly constant track and stays there, and still blends on the way', () => {
    const mesh = skeletonClone(gltf.scene), mixer = new THREE.AnimationMixer(mesh);
    const from = heldClip('m4_ready', mesh, 0.1), to = heldClip('crouch_idle', mesh, 0.9);
    const e = { mesh, mixer, actions: { idle: mixer.clipAction(from), m4_ready: mixer.clipAction(from),
      crouch_idle: mixer.clipAction(to) } };
    const tick = clock(e, 1 / 60);
    tick(30);
    for (const bone of LEGS) expect(angle(local(mesh, bone), heldValue(from, bone))).toBeLessThan(1e-3);
    // One frame after the transition the inertia blend is strictly between the two poses.
    tick(1, { crouching: true });
    for (const bone of LEGS) {
      const span = angle(heldValue(from, bone), heldValue(to, bone));
      const left = angle(local(mesh, bone), heldValue(from, bone));
      const right = angle(local(mesh, bone), heldValue(to, bone));
      expect(span).toBeGreaterThan(40);
      expect(left, `${bone} has left the old pose`).toBeGreaterThan(0.5);
      expect(right, `${bone} has not reached the new pose`).toBeGreaterThan(0.5);
      expect(left).toBeLessThan(span); expect(right).toBeLessThan(span);
    }
    tick(89, { crouching: true });
    for (const bone of LEGS)
      expect(angle(local(mesh, bone), heldValue(to, bone)), `${bone} reached`).toBeLessThan(1e-3);
    for (let frame = 0; frame < 60; frame++) {
      tick(1, { crouching: true });
      for (const bone of LEGS)
        expect(angle(local(mesh, bone), heldValue(to, bone)), `${bone} held, frame ${frame}`).toBeLessThan(1e-3);
    }
  });

  it('reaches an exactly constant track for a caller of the exported tickInertia', () => {
    // The legacy order of tools/art/review.mjs: transition, mixer.update, tickInertia.
    const mesh = skeletonClone(gltf.scene), mixer = new THREE.AnimationMixer(mesh);
    const to = heldClip('held', mesh, 0.9), bones = [];
    mesh.traverse(node => { if (node.isBone) bones.push(node); });
    const rest = Object.fromEntries(LEGS.map(bone => [bone, local(mesh, bone)]));
    const e = { mesh, mixer, actions: { held: mixer.clipAction(to) }, currentClip: null, _bones: bones };
    crossfade(e, 'held', 0.2);
    const dt = 1 / 60;
    mixer.update(dt); tickInertia(e, dt);
    for (const bone of LEGS) {
      expect(angle(local(mesh, bone), rest[bone]), `${bone} has left the old pose`).toBeGreaterThan(0.5);
      expect(angle(local(mesh, bone), heldValue(to, bone)), `${bone} still blending`).toBeGreaterThan(0.5);
    }
    for (let frame = 0; frame < 89; frame++) { mixer.update(dt); tickInertia(e, dt); }
    for (const bone of LEGS)
      expect(angle(local(mesh, bone), heldValue(to, bone)), `${bone} reached`).toBeLessThan(1e-3);
    for (let frame = 0; frame < 60; frame++) {
      mixer.update(dt); tickInertia(e, dt);
      for (const bone of LEGS)
        expect(angle(local(mesh, bone), heldValue(to, bone)), `${bone} held, frame ${frame}`).toBeLessThan(1e-3);
    }
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { buildRifleMovementClips, RIFLE_MOVEMENT_CLIPS } from './rifleClips.js';
import { WEAPON3P_ROT } from './weapon3pTransform.js';

let gltf, armed;
beforeAll(async () => {
  const data = readFileSync(new URL('../../public/models/enemy.glb', import.meta.url));
  gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  armed = buildRifleMovementClips(gltf.scene, gltf.animations);
});

function sample(clip, t) {
  const root = clone(gltf.scene), mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.update(t);
  root.updateMatrixWorld(true);
  return root;
}

describe('armed poses on the shipped skeleton', () => {
  it.each(['attack', ...RIFLE_MOVEMENT_CLIPS])('%s holds the rifle forward and upright above the waist', name => {
    const clip = armed.find(c => c.name === `rifle_${name}`) ?? gltf.animations.find(c => c.name === name);
    for (const phase of [0, 0.25, 0.5, 0.9]) {
      const root = sample(clip, clip.duration * phase);
      const hand = root.getObjectByName('hand_r');
      const q = hand.getWorldQuaternion(new THREE.Quaternion())
        .multiply(new THREE.Quaternion().setFromEuler(WEAPON3P_ROT));
      expect(new THREE.Vector3(0, 0, -1).applyQuaternion(q).z).toBeGreaterThan(0.85);
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(q).y).toBeGreaterThan(0.8);
      const wrist = hand.getWorldPosition(new THREE.Vector3());
      const pelvis = root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
      expect(wrist.y - pelvis.y).toBeGreaterThan(0.15);
    }
  });

  it('preserves the source leg/pelvis motion when composing armed variants', () => {
    for (const name of RIFLE_MOVEMENT_CLIPS) {
      const source = gltf.animations.find(c => c.name === name);
      const result = armed.find(c => c.name === `rifle_${name}`);
      for (const phase of [0.2, 0.6, 0.9]) {
        const before = sample(source, source.duration * phase);
        const after = sample(result, result.duration * phase);
        for (const bone of ['pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r']) {
          const a = before.getObjectByName(bone), b = after.getObjectByName(bone);
          expect(a.position.distanceTo(b.position), `${name}:${bone}`).toBeLessThan(1e-6);
          expect(a.quaternion.angleTo(b.quaternion), `${name}:${bone}`).toBeLessThan(1e-3);
        }
      }
    }
  });
});

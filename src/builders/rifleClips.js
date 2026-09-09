import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const RIFLE_MOVEMENT_CLIPS = [
  'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
];

/**
 * Compose armed movement clips once at load. Keep the authored pelvis/legs, and
 * carry the rifle-ready torso above them. The chest orientation is expressed in
 * character-root space, so a crouched pelvis cannot fold the aiming arms downward.
 * This is a pose composition on the current rig, not a retarget/axis correction.
 * Source clips and the template skeleton are never modified.
 */
export function buildRifleMovementClips(root, clips) {
  const aim = clips.find(clip => clip.name === 'attack');
  if (!aim) return [];
  const rig = clone(root), chest = rig.getObjectByName('spine_01');
  if (!chest) return [];
  const mixer = new THREE.AnimationMixer(rig);
  mixer.clipAction(aim).play();
  mixer.update(0);
  rig.updateMatrixWorld(true);
  const chestInRoot = rig.getWorldQuaternion(new THREE.Quaternion()).invert()
    .multiply(chest.getWorldQuaternion(new THREE.Quaternion()));
  const upper = new Map();
  chest.traverse(bone => { if (bone.isBone) upper.set(bone.name, bone.quaternion.clone()); });
  mixer.stopAllAction();

  const result = [];
  for (const name of RIFLE_MOVEMENT_CLIPS) {
    const source = clips.find(clip => clip.name === name);
    if (!source) continue;
    const action = mixer.clipAction(source).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().play();
    const times = [], values = [];
    const steps = Math.max(1, Math.ceil(source.duration * 30));
    const parentQ = new THREE.Quaternion(), desiredQ = new THREE.Quaternion();
    for (let i = 0; i <= steps; i++) {
      const t = source.duration * i / steps;
      mixer.setTime(t);
      rig.updateMatrixWorld(true);
      rig.getWorldQuaternion(desiredQ).multiply(chestInRoot);
      chest.parent.getWorldQuaternion(parentQ).invert();
      const q = parentQ.multiply(desiredQ);
      // Keep neighboring samples on one quaternion hemisphere.
      if (i && q.dot(new THREE.Quaternion().fromArray(values, values.length - 4)) < 0)
        q.set(-q.x, -q.y, -q.z, -q.w);
      times.push(t);
      values.push(q.x, q.y, q.z, q.w);
    }
    mixer.stopAllAction();
    const tracks = source.tracks.filter(track => {
      const dot = track.name.lastIndexOf('.');
      return track.name.slice(dot + 1) !== 'quaternion' || !upper.has(track.name.slice(0, dot));
    }).map(track => track.clone());
    for (const [bone, q] of upper) {
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`,
        bone === chest.name ? times : [0, source.duration],
        bone === chest.name ? values : [...q.toArray(), ...q.toArray()]));
    }
    result.push(new THREE.AnimationClip(`rifle_${name}`, source.duration, tracks));
  }
  mixer.uncacheRoot(rig);
  return result;
}

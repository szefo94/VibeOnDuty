import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { crossfade, enterLocoMode, setLocoWeights, fitActionDuration, copyPresentationMask, tickPresentation } from './enemyAnimations.js';

function actor() {
  const root = new THREE.Object3D();
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const [key, x] of Object.entries({ idle: 1, walk: 2, run: 3, strafe_l: 4, strafe_r: 5, shoot: 6, death: 8 })) {
    const clip = new THREE.AnimationClip(key, 1, [new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [x, x])]);
    actions[key] = mixer.clipAction(clip);
  }
  actions.attack = actions.idle;
  actions.idle.play();
  return { mesh: root, mixer, actions, currentClip: 'idle' };
}

describe('animation ownership across transitions', () => {
  it('copies mask buffers and preserves a lower locomotion contribution during reload', () => {
    const e = actor(), pelvis = new THREE.Bone(), spine = new THREE.Bone();
    pelvis.name = 'pelvis'; spine.name = 'spine_03'; e.mesh.add(pelvis); pelvis.add(spine);
    e._bonesInit = true; e._bones = [pelvis, spine];
    const make = (key, value) => {
      const clip = new THREE.AnimationClip(key, 1, [
        new THREE.NumberKeyframeTrack('pelvis.position[x]', [0,1], [value,value]),
        new THREE.QuaternionKeyframeTrack('spine_03.quaternion', [0,1], [0,0,0,1,0,.2,0,.98]),
      ]);
      e.actions[key] = e.mixer.clipAction(clip); return clip;
    };
    make('walk_forward', 2); const reload = make('m4_reload', 8); make('m4_ready', 0);
    const masked = copyPresentationMask(reload, true);
    masked.tracks[0].values[0] = 1;
    expect(reload.tracks[1].values[0]).toBe(0);
    const r = { identity: 'x', position: {x:0,y:0,z:0}, sampleTimeSeconds:0, onGround:true };
    tickPresentation(e,r,.05);
    const pose=tickPresentation(e,{...r, position:{x:0,y:0,z:-.3}, sampleTimeSeconds:.1,
      action:{kind:'reload',total:1.8,remaining:.9}},.05);
    e._inertia = null; e.mixer.update(0);
    expect(pose.action.phase).toBe(.5); expect(pelvis.position.x).toBeCloseTo(2);
    expect(e.mesh.position.x).toBe(0);
  });
  it('plants stationary feet even if an adapter reports a lateral intention', () => {
    const e = actor();
    enterLocoMode(e);
    setLocoWeights(e.actions, 0, 1);
    e.mixer.update(0.1);
    expect(e.actions.idle.getEffectiveWeight()).toBe(1);
    expect(e.actions.strafe_r.getEffectiveWeight()).toBe(0);
  });
  it('restores idle after an interrupted shooting fade, including after mixer updates', () => {
    const e = actor();
    crossfade(e, 'attack');
    crossfade(e, 'shoot', 0.3);
    e.mixer.update(0.05);
    enterLocoMode(e);
    for (let i = 0; i < 60; i++) {
      setLocoWeights(e.actions, 0, 0);
      e.mixer.update(1 / 60);
    }
    expect(e.actions.idle.enabled).toBe(true);
    expect(e.actions.idle.getEffectiveWeight()).toBe(1);
    expect(e.mesh.position.x).toBeCloseTo(1);
  });

  it('does not fade to the bind pose when two names resolve to the same action', () => {
    const e = actor();
    crossfade(e, 'attack');
    e.mixer.update(0);
    expect(e.mesh.position.x).toBe(1);
  });

  it.each([[0.5, 0], [1, 0], [1, -1], [1, 1]])('death replaces the whole blend tree (%s, %s)', (speed, strafe) => {
    const e = actor();
    enterLocoMode(e);
    setLocoWeights(e.actions, speed, strafe);
    e.mixer.update(0.1);
    crossfade(e, 'death', 0);
    e.mixer.update(0.8);
    expect(e.mesh.position.x).toBeCloseTo(8);
    for (const [key, action] of Object.entries(e.actions)) {
      if (key !== 'death') expect(action.isScheduled(), key).toBe(false);
    }
  });

  it('finishes a one-shot at its gameplay deadline without changing the shared clip', () => {
    const e = actor(), action = e.actions.shoot;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    fitActionDuration(action, 0.9);
    e.mixer.update(0.89);
    expect(action.paused).toBe(false);
    e.mixer.update(0.02);
    expect(action.paused).toBe(true);
    expect(action.getClip().duration).toBe(1);
  });
});

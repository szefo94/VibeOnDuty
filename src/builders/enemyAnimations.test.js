import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { crossfade, enterLocoMode, setLocoWeights, fitActionDuration } from './enemyAnimations.js';

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

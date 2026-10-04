// @ts-check
import { describe, it, expect, vi } from 'vitest';
// @ts-ignore Three vendor declarations are absent.
import * as THREE from 'three';
import { createRemoteActors } from './remoteActors.js';
import { disposeCharacter, preserveTemplateGeometry } from '../builders/characterResources.js';

function fixture() {
  const template = new THREE.Group();
  const shared = new THREE.BoxGeometry();
  template.add(new THREE.Mesh(shared, new THREE.MeshBasicMaterial()));
  preserveTemplateGeometry(template);
  const sharedDispose = vi.spyOn(shared, 'dispose');
  const ownedDispose = vi.fn();
  const create = vi.fn(() => {
    const mesh = template.clone();
    const geometry = new THREE.SphereGeometry();
    geometry.addEventListener('dispose', ownedDispose);
    const material = new THREE.MeshBasicMaterial();
    material.userData.characterOwned = true;
    mesh.add(new THREE.Mesh(geometry, material));
    const mixer = new THREE.AnimationMixer(mesh);
    return { mesh, mixer, actions: {}, muzzleFlash: null, facingOffset: 0 };
  });
  const dispose = vi.fn(disposeCharacter),
    tint = vi.fn(),
    animate = vi.fn();
  const scene = new THREE.Scene();
  const owner = createRemoteActors(scene, { create, dispose, tint, animate });
  const p = /** @type {any} */ ({
    sessionId: 'peer',
    x: 1,
    y: 1.65,
    z: 2,
    lifeGeneration: 1,
    team: 'red',
    alive: true,
  });
  const sync = (/** @type {any[]} */ players = [p], matchGeneration = 1) =>
    owner.syncRemoteActors({ sessionId: 'me', players, matchGeneration }, 0.016);
  return { owner, p, sync, scene, create, dispose, tint, animate, ownedDispose, sharedDispose };
}

describe('remote rig ownership', () => {
  it('retires the old life rig once and preserves shared template geometry for later clones', () => {
    const f = fixture();
    f.sync();
    f.sync();
    expect(f.create).toHaveBeenCalledTimes(1);
    f.p.lifeGeneration++;
    f.sync();
    expect(f.dispose).toHaveBeenCalledTimes(1);
    expect(f.create).toHaveBeenCalledTimes(2);
    f.owner.disposeRemoteActors();
    f.owner.disposeRemoteActors();
    expect(f.dispose).toHaveBeenCalledTimes(2);
    expect(f.ownedDispose).toHaveBeenCalledTimes(2);
    expect(f.sharedDispose).not.toHaveBeenCalled();
    expect(f.scene.children).toHaveLength(0);
    f.sync();
    expect(f.create).toHaveBeenCalledTimes(3);
    expect(f.owner.size).toBe(1);
    f.owner.disposeRemoteActors();
  });
  it('retires match and connection generations and keeps one rig per remote session', () => {
    const f = fixture();
    f.sync([f.p, { ...f.p, sessionId: 'me' }]);
    expect(f.owner.size).toBe(1);
    f.sync([f.p], 2);
    expect(f.dispose).toHaveBeenCalledTimes(1);
    f.owner.syncRemoteActors(
      { sessionId: 'replacement', matchGeneration: 2, players: [f.p] },
      0.016
    );
    expect(f.dispose).toHaveBeenCalledTimes(2);
    expect(f.owner.size).toBe(1);
    f.sync([]);
    expect(f.owner.size).toBe(0);
    expect(f.sharedDispose).not.toHaveBeenCalled();
  });
  it('tints only changed teams and ticks remote cosmetics through dead local snapshots', () => {
    const f = fixture();
    f.sync();
    f.sync();
    expect(f.tint).toHaveBeenCalledTimes(1);
    f.p.team = 'blue';
    f.p.alive = false;
    f.sync();
    expect(f.tint).toHaveBeenCalledTimes(2);
    expect(f.animate).toHaveBeenCalledTimes(3);
    expect(f.animate.mock.calls[2][1].alive).toBe(false);
    f.owner.disposeRemoteActors();
  });
});

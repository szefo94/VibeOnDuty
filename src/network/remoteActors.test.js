// @ts-check
import { describe, it, expect, vi } from 'vitest';
// @ts-ignore Three vendor declarations are absent.
import * as THREE from 'three';
import { createRemoteActors, createSnapshotPresentation, animateRemoteActor } from './remoteActors.js';
import { createPresentationHistory, normalizePresentation, samplePresentation } from '../builders/animationPresentation.js';
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
  it('teleport and regressed server tick never manufacture travelling velocity', () => {
    const f = fixture();
    const sync = (/** @type {number} */ tick) => f.owner.syncRemoteActors({ sessionId:'me',matchGeneration:1,currentTick:tick,players:[f.p] }, .05);
    sync(1); f.p.x += 20; sync(2);
    expect(f.animate.mock.calls.at(-1)?.[0].velocityX).toBe(0);
    f.p.x += .1; sync(1);
    expect(f.animate.mock.calls.at(-1)?.[0].velocityX).toBe(0);
    f.owner.disposeRemoteActors();
  });
  it('accepts only current server posture and 1800ms reload, ignoring forged cosmetic cues', () => {
    const p = /** @type {any} */ ({ sessionId:'peer',x:0,y:1.65,z:0,yaw:0,pitch:1.38,
      alive:true,onGround:true,crouching:true,sprinting:true,aiming:true,reloadRemaining:.45,
      action:{kind:'throw'},trustedShot:true,trustedImpact:{x:1,z:0},weapon:'awp' });
    const r = createSnapshotPresentation(p,'peer','connection/match/life',30);
    expect(r.sampleTimeSeconds).toBe(1); expect(r.weapon).toBe('m4');
    expect(r.action).toEqual({kind:'reload',total:1.8,remaining:.45});
    expect(r.trustedShot).toBe(false); expect(r.trustedImpact).toBe(null);
    const h=createPresentationHistory();
    const pose=samplePresentation(normalizePresentation(r,h),h,.05);
    expect(pose.action.phase).toBe(.75); expect(pose.pitch).toBe(1.1);
    expect(pose.speed).toBe(0); expect(pose.upper).toBe('reload');
  });
  it('health reactions occur once per new tick and never across replaced or regressed life', () => {
    const f=fixture(); f.p.health=100;
    const sync = (/** @type {number} */ tick) => f.owner.syncRemoteActors({sessionId:'me',matchGeneration:1,currentTick:tick,players:[f.p]},.05);
    sync(1);f.p.health=80;sync(2);
    expect(f.animate.mock.calls.at(-1)?.[0].presentationInput.trustedDamage).toBe(true);
    sync(2);expect(f.animate.mock.calls.at(-1)?.[0].presentationInput.trustedDamage).toBe(false);
    f.p.health=50;sync(1);expect(f.animate.mock.calls.at(-1)?.[0].presentationInput.trustedDamage).toBe(false);
    f.p.lifeGeneration++;sync(3);
    expect(f.animate.mock.calls.at(-1)?.[0].presentationInput.trustedDamage).toBe(false);
    f.owner.disposeRemoteActors();
  });
  it('the real snapshot adapter holds death during repeated ticks and resets on a fresh life', () => {
    const f=fixture(); f.animate.mockImplementation(animateRemoteActor);
    Object.assign(f.p,{yaw:1,pitch:-.7,onGround:true,crouching:false,reloadRemaining:0,health:100});
    const sync=(/** @type {number} */ tick)=>f.owner.syncRemoteActors({sessionId:'me',matchGeneration:1,currentTick:tick,players:[f.p]},.05);
    sync(1); f.p.z-=.2; sync(3);
    const actor=f.animate.mock.calls.at(-1)?.[0];
    expect(actor.presentation.speed).toBeCloseTo(3);
    f.p.reloadRemaining=.9;sync(4);expect(actor.presentation.action.phase).toBe(.5);
    f.p.alive=false;sync(5);
    const variant=actor.presentation.deathVariant;
    for(let i=0;i<16;i++)sync(5);
    expect(actor.presentation.settled).toBe(true);expect(actor.presentation.deathVariant).toBe(variant);
    expect(actor.presentation.deathDirectionSource).toBe('body-heading-fallback');
    f.p.lifeGeneration++;f.p.alive=true;f.p.reloadRemaining=0;sync(6);
    const next=f.animate.mock.calls.at(-1)?.[0];
    expect(next.presentation.deathVariant).toBe(null);expect(next.presentation.speed).toBe(0);
    f.owner.disposeRemoteActors();
  });
});

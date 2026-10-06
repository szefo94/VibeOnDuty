import { beforeAll, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { parseGLB, accessor, encodeGLB } from '../../tools/art/inspect-character.mjs';
import { validateListedMotion } from '../../tools/art/motion-pipeline.mjs';
import manifest from '../../tools/art/motion-manifest.json';

vi.mock('../scene.js', () => ({scene:new THREE.Scene()}));
vi.mock('../materials.js', () => ({mm:(color,roughness,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})}));
vi.mock('./enemyAnimations.js', () => ({buildEnemyMixer:vi.fn(),attachSkeletonDebug:vi.fn(),detachSkeletonDebug:vi.fn(),buildGLTFBreathingClip:vi.fn()}));
vi.mock('./enemyWeapon.js', () => ({attachEnemyWeapon:vi.fn()}));
vi.mock('./weaponFBX.js', () => ({attachWeapons3pToHand:vi.fn()}));
import { findMotionClip, getMotionDefinition, prepareEnemyClips } from './enemyGLTF.js';

let gltf;
beforeAll(async () => {
  const data=readFileSync('public/models/enemy.glb');
  // Node-only image isolation. Browser fixtures decode/render the real packed maps.
  vi.stubGlobal('self',globalThis);
  const images=vi.spyOn(THREE.TextureLoader.prototype,'load').mockImplementation((_url,onLoad)=>{
    const texture=new THREE.Texture(); queueMicrotask(()=>onLoad(texture)); return texture;
  });
  try {
    gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  } finally { images.mockRestore(); vi.unstubAllGlobals(); }
});

describe('retained original motion repertoire', () => {
  it('exports complete exact authored action names and weapon phase markers', () => {
    const asset = parseGLB(readFileSync('public/models/enemy.glb'));
    for (const weapon of ['m4', 'p90', 'awp', 'pistol']) {
      for (const kind of ['ready', 'ads', 'fire', 'reload']) {
        const spec = manifest.actions.find((a) => a.id === `${weapon}_${kind}`);
        expect(spec, `${weapon} ${kind} must be retained original motion`).toBeDefined();
        expect(spec.clip).toBe(`vod7_${weapon}_${kind}`);
        expect(asset.json.animations.filter((c) => c.name === spec.clip)).toHaveLength(1);
        if (kind === 'reload') {
          expect(spec.markers.remove).toBeLessThan(spec.markers.insert);
          expect(spec.markers.insert).toBeLessThan(spec.markers.charge);
          expect(spec.markers.charge).toBeLessThan(spec.markers.ready);
          expect(spec.contactTargets.support).toHaveLength(3);
        }
      }
    }
    expect(validateListedMotion(asset, manifest, 48)).toBe(manifest.actions.length);
  });

  it('keeps settled deaths, exact preview reload timing and rejects horizontal body travel', () => {
    const asset = parseGLB(readFileSync('public/models/enemy.glb'));
    for (const spec of manifest.actions.filter((a) => a.kind === 'death')) {
      const clip = asset.json.animations.find((a) => a.name === spec.clip);
      for (const sampler of clip.samplers) {
        const times = accessor(asset, sampler.input), values = accessor(asset, sampler.output);
        const width = values.length / times.length;
        expect(times.at(-1)).toBeCloseTo(.65, 6);
        for (let i = 0; i < times.length; i++) if (times[i] >= .55)
          expect(values.slice(i*width, (i+1)*width)).toEqual(values.slice(-width));
      }
    }
    for (const spec of manifest.actions.filter((a) => a.previewOnly)) {
      expect(spec.phaseOwner).toBe('Phase5');
      expect(spec.aliases).toEqual([]);
      if (spec.kind === 'sprint_reload')
        expect(spec.durationSeconds).toBe(manifest.actions.find(a => a.id === `${spec.weapon}_reload`).durationSeconds * 1.15);
    }
    const bad = parseGLB(encodeGLB(asset.json, asset.binary));
    const death = bad.json.animations.find(a => a.name === 'vod7_death_front');
    const ch = death.channels.find(c => c.target.path === 'translation');
    const a = bad.json.accessors[death.samplers[ch.sampler].output];
    const view = bad.json.bufferViews[a.bufferView];
    bad.binary.writeFloatLE(4, (view.byteOffset || 0) + (a.byteOffset || 0));
    expect(() => validateListedMotion(bad, manifest, 48)).toThrow(/Horizontal|Unbounded/);
  });

  it('prepares actual GLB buffers independently and keeps the template and sibling rig poses intact', () => {
    const original=gltf.animations.map(c=>c.tracks.map(t=>[...t.times,...t.values]));
    const prepared=prepareEnemyClips(gltf), sibling=prepareEnemyClips(gltf);
    expect(gltf.animations.map(c=>c.tracks.map(t=>[...t.times,...t.values]))).toEqual(original);
    const clip=findMotionClip(prepared.animations,'walk');
    expect(clip.name).toBe('vod7_walk_forward');
    const siblingClip=findMotionClip(sibling.animations,'walk');
    for(let i=0;i<clip.tracks.length;i++) {
      expect(clip.tracks[i].times).not.toBe(siblingClip.tracks[i].times);
      expect(clip.tracks[i].values).not.toBe(siblingClip.tracks[i].values);
    }
    const first=clone(gltf.scene), second=clone(gltf.scene);
    const before=second.getObjectByName('thigh_l').quaternion.toArray();
    const mixer=new THREE.AnimationMixer(first);
    mixer.clipAction(clip).play(); mixer.update(.25);
    expect(first.getObjectByName('thigh_l').quaternion.toArray()).not.toEqual(before);
    expect(second.getObjectByName('thigh_l').quaternion.toArray()).toEqual(before);
    expect(gltf.scene.getObjectByName('thigh_l').quaternion.toArray()).toEqual(before);
    mixer.stopAllAction(); mixer.uncacheRoot(first);
  });

  it('retains non-rest constant transforms and uses exact aliases with a usable inherited fallback', () => {
    const scene=new THREE.Group(), bone=new THREE.Bone(); bone.name='testBone'; scene.add(bone);
    const times=new Float32Array([0,1]), values=new Float32Array([0,0,0,1,0,0,0,-1]);
    const input={scene,animations:[new THREE.AnimationClip('walk',1,[
      new THREE.QuaternionKeyframeTrack('testBone.quaternion',times,values),
      new THREE.VectorKeyframeTrack('testBone.position',[0,1],[0,.3,0,0,.3,0]),
      new THREE.VectorKeyframeTrack('testBone.scale',[0,1],[1,1,1,1,1,1])])]};
    const out=prepareEnemyClips(input);
    expect(out.animations[0].tracks.map(t=>t.name)).toEqual(['testBone.quaternion','testBone.position']);
    expect(input.animations[0].tracks).toHaveLength(3);
    expect([...values]).toEqual([0,0,0,1,0,0,0,-1]);
    const exact=findMotionClip(gltf.animations,'walk');
    expect(findMotionClip(gltf.animations.filter(c=>c!==exact),'walk').name).toBe('walk');
    expect(findMotionClip([...gltf.animations,exact.clone()],'walk').name).toBe('walk');
    expect(getMotionDefinition('supersprint').previewOnly).toBe(true);
    expect(findMotionClip(gltf.animations,'reload','p90').name).toBe('vod7_p90_reload');
  });
});

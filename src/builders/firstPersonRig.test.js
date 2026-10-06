import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import * as THREE from 'three';

const path = new URL('./firstPersonRig.js', import.meta.url);
const view = existsSync(path) ? await import(path.href) : {};

describe('first-person view ownership', () => {
  it('creates an owned arm view and world body from a complete skeleton', () => {
    expect(typeof view.createFirstPersonRig).toBe('function');
    const root = new THREE.Group();
    const bones = ['pelvis', 'lowerarm_l', 'hand_l', 'Head'].map(name => {
      const bone = new THREE.Bone(); bone.name = name; root.add(bone); return bone;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array(27).fill(.5), 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(
      [0,0,0,0,0,0,0,0,0,0,0,0, 1,0,0,0,1,0,0,0,1,0,0,0, 3,0,0,0,3,0,0,0,3,0,0,0], 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(
      Array.from({ length: 9 }, () => [1,0,0,0]).flat(), 4));
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
    mesh.material.userData.artDomain='team-accent';
    mesh.userData.enemyGroup = root;
    let sourceDisposals = 0;
    geometry.addEventListener('dispose', () => sourceDisposals++);
    root.add(mesh); mesh.bind(new THREE.Skeleton(bones));
    const rig = view.createFirstPersonRig({ source: root });
    expect(mesh.userData.enemyGroup).toBe(root);
    const originalClone=root.clone, originalData=mesh.userData;
    root.clone=()=>{throw new Error('clone-injected');};
    expect(()=>view.createFirstPersonRig({source:root})).toThrow('clone-injected');
    expect(mesh.userData).toBe(originalData);expect(mesh.userData.enemyGroup).toBe(root);
    root.clone=originalClone;
    expect(rig.arms.getObjectByName('Head').isBone).toBe(true);
    expect(rig.body.getObjectByName('Head').isBone).toBe(true);
    const selected = [];
    rig.arms.traverse(node => { if (node.isSkinnedMesh) selected.push(node); });
    expect(selected[0].geometry).not.toBe(geometry);
    expect(selected[0].geometry.attributes.normal.array.slice(0, 3)).toEqual(geometry.attributes.normal.array.slice(0, 3));
    expect(selected[0].geometry.userData.selectedTriangles).toBe(1);
    expect(geometry.index).toBeNull();
    mesh.material.color.setHex(0x1234ff);
    view.updateFirstPersonRig(rig,{pose:{alive:false},camera:new THREE.PerspectiveCamera(),active:false});
    expect(selected[0].material.color.getHex()).toBe(0x1234ff);
    expect(selected[0].material).not.toBe(mesh.material);
    expect(bones.every(b => b.scale.equals(new THREE.Vector3(1,1,1)))).toBe(true);
    view.disposeFirstPersonRig(rig); view.disposeFirstPersonRig(rig);
    expect(root.children.includes(mesh)).toBe(true);
    expect(sourceDisposals).toBe(0);
    const next = view.createFirstPersonRig({ source:root });
    expect(next.disposed).toBe(false); view.disposeFirstPersonRig(next);
    expect(sourceDisposals).toBe(0);
  });
  it('starts ADS immediately and reaches both endpoints monotonically in 120ms', () => {
    expect(typeof view.sampleFirstPersonMotion).toBe('function');
    const motion = {};
    const pose = { aiming: true, alive: true, upper: 'ads', phase: .2, moving: true };
    const raised = Array.from({ length: 6 }, () => view.sampleFirstPersonMotion(motion, pose, .02).aim);
    expect(raised[0]).toBeGreaterThan(0);
    expect(raised.at(-1)).toBe(1);
    expect(raised.every((n, i) => i === 0 || n >= raised[i-1])).toBe(true);
    const ads = view.sampleFirstPersonMotion(motion, pose, .02);
    expect(ads.sway).toEqual([0,0,0]);
    const lowered = Array.from({ length: 6 }, () => view.sampleFirstPersonMotion(motion, { ...pose, aiming:false }, .02).aim);
    expect(lowered.at(-1)).toBe(0);
    expect(lowered.every((n, i) => i === 0 || n <= lowered[i-1])).toBe(true);
    const reduced = view.sampleFirstPersonMotion(motion, { ...pose, aiming:false, reducedMotion:true }, .02);
    expect(reduced.sway).toEqual([0,0,0]);
  });
});

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
    root.add(mesh); mesh.bind(new THREE.Skeleton(bones));
    const rig = view.createFirstPersonRig({ source: root });
    expect(rig.arms.getObjectByName('Head').isBone).toBe(true);
    expect(rig.body.getObjectByName('Head').isBone).toBe(true);
    const selected = [];
    rig.arms.traverse(node => { if (node.isSkinnedMesh) selected.push(node); });
    expect(selected[0].geometry).not.toBe(geometry);
    expect(selected[0].geometry.attributes.normal.array.slice(0, 3)).toEqual(geometry.attributes.normal.array.slice(0, 3));
    expect(selected[0].geometry.userData.selectedTriangles).toBe(1);
    expect(geometry.index).toBeNull();
    expect(bones.every(b => b.scale.equals(new THREE.Vector3(1,1,1)))).toBe(true);
    view.disposeFirstPersonRig(rig); view.disposeFirstPersonRig(rig);
    expect(root.children.includes(mesh)).toBe(true);
  });
});

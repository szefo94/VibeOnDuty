import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
vi.mock('./enemyAnimations.js', () => ({ detachSkeletonDebug: vi.fn() }));
import { disposeCharacter, preserveTemplateGeometry } from './characterResources.js';

// Exercise the current public tint entry point without browser initialization.
vi.mock('../scene.js', () => ({ scene: new THREE.Scene() }));
vi.mock('./enemy.js', () => ({ buildEnemy: vi.fn() }));
vi.mock('./enemyWeapon.js', () => ({ attachEnemyWeapon: vi.fn() }));
vi.mock('./weaponFBX.js', () => ({ attachWeapons3pToHand: vi.fn() }));
import { tintEnemyMesh } from './enemyGLTF.js';

function fixture() {
  const root = new THREE.Group();
  const materials = ['skin', 'ink', 'fabric', 'weapon', 'team-accent'].map((domain) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xb6a05b, roughness: 0.7 });
    m.userData.artDomain = domain;
    m.map = new THREE.Texture();
    return m;
  });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), materials));
  return { root, materials };
}

describe('character appearance', () => {
  it('changes only the designated accent and keeps material groups and maps', () => {
    const { root, materials } = fixture();
    tintEnemyMesh(root, 0x4488ff);
    const assigned = root.children[0].material;
    expect(assigned).toHaveLength(5);
    for (let i = 0; i < 4; i++) expect(assigned[i]).toBe(materials[i]);
    expect(assigned[4].color.getHex()).toBe(0x4488ff);
    expect(assigned[4].map).toBe(materials[4].map);
    expect(materials[4].color.getHex()).toBe(0xb6a05b);
  });
  it('reuses one owned accent through repeated assignments and restores neutral base', () => {
    const { root } = fixture();
    tintEnemyMesh(root, 0x4488ff);
    const accent = root.children[0].material[4];
    tintEnemyMesh(root, 0x4488ff);
    tintEnemyMesh(root, 0xff5555);
    expect(root.children[0].material[4]).toBe(accent);
    expect(accent.color.getHex()).toBe(0xff5555);
    tintEnemyMesh(root, null);
    expect(accent.color.getHex()).toBe(0xb6a05b);
  });
  it('accepts null roots and empty material arrays', () => {
    expect(() => tintEnemyMesh(null, 0xff5555)).not.toThrow();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), []));
    expect(() => tintEnemyMesh(root, 0xff5555)).not.toThrow();
    expect(root.children[0].material).toEqual([]);
  });
  it('retires one clone twice without freeing sibling/template geometry or maps', () => {
    const { root, materials } = fixture();
    preserveTemplateGeometry(root);
    const sibling = root.clone();
    const geometryDispose = vi.spyOn(root.children[0].geometry, 'dispose');
    const mapDispose = vi.spyOn(materials[4].map, 'dispose');
    tintEnemyMesh(root, 0x4488ff);
    const ownedDispose = vi.spyOn(root.children[0].material[4], 'dispose');
    disposeCharacter(root); disposeCharacter(root);
    expect(ownedDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(mapDispose).not.toHaveBeenCalled();
    expect(sibling.children[0].material[4]).toBe(materials[4]);
  });
});

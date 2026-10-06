import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

const handling = await import('./weaponHandling.js').catch(() => ({}));
function weapon() {
  const root = new THREE.Group();
  for (const name of ['receiver', 'grip', 'support', 'magazine', 'charging']) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.04, .06, .04));
    mesh.name = name; root.add(mesh);
  }
  root.getObjectByName('magazine').position.y = -.08;
  return root;
}
describe('M4 phase-driven presentation', () => {
  it('removes its magazine and restores ready without changing gameplay outcomes', () => {
    expect(handling.createWeaponHandling).toBeTypeOf('function');
    const root = weapon();
    const state = Object.freeze({ weapon: 'm4', alive: true, upper: 'reload',
      action: Object.freeze({ kind: 'reload', phase: .4, total: 1.8 }), ammo: 7 });
    const owner = handling.createWeaponHandling({ weapon: 'm4', root });
    handling.updateWeaponHandling(owner, state);
    expect(root.getObjectByName('magazine').position.y).toBeLessThan(-.15);
    expect(state.ammo).toBe(7);
    expect(owner.sample.support.every(Number.isFinite)).toBe(true);
    handling.updateWeaponHandling(owner, { weapon: 'm4', alive: true, upper: 'ready' });
    expect(root.getObjectByName('magazine').position.y).toBe(-.08);
    expect(owner.props).toHaveLength(0);
    handling.disposeWeaponHandling(owner);
    expect(root.children).toHaveLength(5);
  });
});

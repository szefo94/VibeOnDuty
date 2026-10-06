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
describe('weapon-specific mechanisms', () => {
  it('lifts the P90 top feed while bottom-fed magazines drop', () => {
    const pose = key => ({ weapon: key, alive: true, upper: 'reload', action: { phase: .35 } });
    expect(handling.sampleWeaponHandling('p90', pose('p90'))).not.toBeNull();
    expect(handling.sampleWeaponHandling('p90', pose('p90'))?.magazine[1]).toBeGreaterThan(.1);
    expect(handling.sampleWeaponHandling('awp', pose('awp'))?.magazine[1]).toBeLessThan(-.1);
    expect(handling.sampleWeaponHandling('pistol', pose('pistol'))?.magazine[1]).toBeLessThan(-.1);
  });
  it('samples AWP bolt and M9 slide only in supported firing windows', () => {
    for (const key of ['awp', 'pistol']) {
      const fire = handling.sampleWeaponHandling(key, { weapon: key, alive: true,
        upper: 'fire', action: { kind: 'fire', phase: .42, total: key === 'awp' ? 1.1 : .2 } });
      const ready = handling.sampleWeaponHandling(key, { weapon: key, alive: true, upper: 'ready' });
      expect(fire).not.toBeNull();
      expect(fire?.charging[2]).toBeGreaterThan(ready?.charging[2]);
    }
  });
});

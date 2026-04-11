import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { CELL, RESERVE_AMMO } from '../config.js';
import { hAt } from '../map.js';
import { player } from './player.js';
import { updateHUD, showMsg } from '../hud/overlay.js';

export const ammoDrops = [];
const ammoBoxMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 0.4,
  metalness: 0.7,
  emissive: 0x002200,
  emissiveIntensity: 0.3,
});
const ammoStripMat = new THREE.MeshStandardMaterial({
  color: 0xddaa00,
  roughness: 0.3,
  metalness: 0.2,
  emissive: 0x443300,
  emissiveIntensity: 1.2,
});
const ammoGlowMat = new THREE.MeshBasicMaterial({
  color: 0x88ff44,
  transparent: true,
  opacity: 0.22,
});
export const ammoPointLight = new THREE.PointLight(0x88ff44, 0, 0);
scene.add(ammoPointLight);

export function spawnAmmoDrop(wx, wz) {
  const g = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.38), ammoBoxMat);
  g.add(crate);
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.06), ammoStripMat);
  s1.position.set(0, 0.1, 0.19);
  g.add(s1);
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.06), ammoStripMat);
  s2.position.set(0, 0.1, -0.19);
  g.add(s2);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), ammoGlowMat);
  g.add(halo);
  const eGround = hAt(Math.floor(wx / CELL), Math.floor(wz / CELL));
  g.position.set(wx, eGround + 0.19, wz);
  scene.add(g);
  ammoDrops.push({
    mesh: g,
    x: wx,
    z: wz,
    bobT: Math.random() * Math.PI * 2,
    collected: false,
    baseY: eGround,
  });
}

export function tickAmmoDrops(dt) {
  for (const d of ammoDrops) {
    if (d.collected) continue;
    d.bobT += dt * 1.8;
    d.mesh.position.y = d.baseY + 0.19 + Math.sin(d.bobT) * 0.12;
    d.mesh.rotation.y += dt * 1.2;
    const dx = camera.position.x - d.x,
      dz = camera.position.z - d.z;
    if (Math.sqrt(dx * dx + dz * dz) < 1.4) {
      d.collected = true;
      scene.remove(d.mesh);
      const gained = 15 + Math.floor(Math.random() * 31);
      player.reserve = Math.min(RESERVE_AMMO + 30, player.reserve + gained);
      updateHUD();
      showMsg(`+${gained} AMMO`);
    }
  }
  if (ammoDrops.some((d) => !d.collected)) {
    const nd = ammoDrops.find((d) => !d.collected);
    if (nd) {
      ammoPointLight.position.set(nd.x, nd.baseY + 0.5, nd.z);
      ammoPointLight.intensity = 1.4 * 4 * Math.PI;
      ammoPointLight.distance = 8;
    }
  } else ammoPointLight.intensity = 0;
  for (let i = ammoDrops.length - 1; i >= 0; i--)
    if (ammoDrops[i].collected) ammoDrops.splice(i, 1);
}

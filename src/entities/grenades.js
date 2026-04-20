import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { CELL, GRENADE_ENERGY_COST, MAX_ENERGY, ENERGY_PER_DMG, MAX_HP } from '../config.js';
import { hAt, groundElevation } from '../map.js';
import { mm } from '../materials.js';
import { grenadeFalloff, grenadeEntityDamage, grenadePlayerDamage } from '../combat/damage.js';
import { spawnGrenadeParticles } from '../fx/particles.js';
import { player } from './player.js';
import { enemies, killEnemy, triggerDeath } from './enemies.js';
import { activeDrone, killDrone } from './drone.js';
import { showStatus, triggerHitFlash, updateHUD } from '../hud/overlay.js';

export const grenades = [];
const grenMat = mm(0x2a4a1a, 0.6, 0.4),
  grenPinMat = mm(0xcccc44, 0.3, 0.8);

export function tryThrowGrenade() {
  if (player.dead || player.energy < GRENADE_ENERGY_COST) return;
  player.energy = 0;
  player.throwingNade = true;
  setTimeout(() => { player.throwingNade = false; }, 900); // ~clip duration
  document.getElementById('energy-label').textContent = 'ENERGY: 0%';
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  dir.y += 0.18;
  dir.normalize();
  const g = new THREE.Group();
  g.add(
    Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8), grenMat), {
      castShadow: true,
    })
  );
  const pin = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 4, 8), grenPinMat);
  pin.position.y = 0.08;
  g.add(pin);
  g.position.copy(camera.position).addScaledVector(dir, 0.5);
  scene.add(g);
  grenades.push({ mesh: g, vel: dir.clone().multiplyScalar(12), life: 2.2, exploded: false });
  showStatus('GRENADE!');
}

export function tickGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    if (g.exploded) {
      grenades.splice(i, 1);
      continue;
    }
    g.vel.y -= 12 * dt;
    g.mesh.position.addScaledVector(g.vel, dt);
    g.mesh.rotation.x += dt * 5;
    g.mesh.rotation.z += dt * 3;
    const eGround = hAt(Math.floor(g.mesh.position.x / CELL), Math.floor(g.mesh.position.z / CELL));
    if (g.mesh.position.y < eGround + 0.07) {
      g.mesh.position.y = eGround + 0.07;
      g.vel.y *= -0.38;
      g.vel.x *= 0.75;
      g.vel.z *= 0.75;
    }
    g.life -= dt;
    if (g.life <= 0) explodeGrenade(g);
  }
}

export function explodeGrenade(g) {
  g.exploded = true;
  const ep = g.mesh.position.clone();
  scene.remove(g.mesh);
  const el = new THREE.PointLight(0xff8833, 10 * 4 * Math.PI, 14);
  el.position.copy(ep);
  scene.add(el);
  setTimeout(() => scene.remove(el), 200);
  spawnGrenadeParticles(ep);
  for (const e of enemies) {
    if (e.dead) continue;
    const dist = ep.distanceTo(new THREE.Vector3(e.x, groundElevation(e.x, e.z) + 0.9, e.z));
    const dmg = grenadeEntityDamage(dist, e.maxHp);
    if (dmg > 0) {
      e.hp = Math.max(0, e.hp - dmg);
      e.hpDrain = e.hp;
      player.energy = Math.min(MAX_ENERGY, player.energy + dmg * ENERGY_PER_DMG * 0.5);
      e.state = 'attack';
      e.alertTimer = 9000;
      e.reactDelay = 0;
      if (e.hp <= 0) killEnemy(e);
    }
  }
  if (activeDrone && !activeDrone.dead) {
    const dist = ep.distanceTo(new THREE.Vector3(activeDrone.x, activeDrone.y, activeDrone.z));
    const fo = grenadeFalloff(dist);
    if (fo > 0) killDrone(activeDrone, Math.floor(activeDrone.maxHp * 2 * fo));
  }
  const pDist = ep.distanceTo(camera.position);
  const pDmg = grenadePlayerDamage(pDist, MAX_HP);
  if (pDmg > 0) {
    player.hp = Math.max(1, player.hp - pDmg);
    triggerHitFlash();
    updateHUD();
    if (player.hp <= 0) triggerDeath();
  }
}

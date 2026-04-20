import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { CELL, PLAYER_H } from '../config.js';
import { MAP_W, MAP_H, MAP, isRamp } from '../map.js';
import { buildDrone } from '../builders/drone.js';
import { player } from './player.js';
import { spawnAmmoDrop } from './ammoDrops.js';
import { showMsg } from '../hud/overlay.js';
import { rebuildEHM } from '../combat/shoot.js';
import { gameRunning } from '../input.js';

// ── Walkable cells (local copy — avoids circular dep with enemies.js) ──────
const _WALKABLE = [];
for (let r = 1; r < MAP_H - 1; r++)
  for (let c = 1; c < MAP_W - 1; c++)
    if (MAP[r][c] === 0 || isRamp(MAP[r][c])) _WALKABLE.push([c, r]);

function _randomCell() {
  return _WALKABLE[Math.floor(Math.random() * _WALKABLE.length)];
}

// ── State ─────────────────────────────────────────────────────────────────
export const DRONE_FLY_H = 4.5;
export const dronePool   = [];
export let   activeDrone = null;

export function spawnNewDrone() {
  const [mc, mr] = _randomCell();
  const d = buildDrone(mc * CELL + CELL / 2, DRONE_FLY_H, mr * CELL + CELL / 2);
  d.strafeDir      = Math.random() < 0.5 ? 1 : -1;
  d.strafeDirTimer = 3 + Math.random() * 4;
  d.empCd          = 0;
  dronePool.push(d);
  activeDrone = d;
  d.mesh.traverse((ch) => { if (ch.isMesh) ch.userData.droneRef = d; });
  rebuildEHM();
  return d;
}

export function killDrone(d, dmg) {
  d.hp -= dmg;
  if (d.hp > 0) return;
  d.dead = true;
  scene.remove(d.mesh);
  activeDrone = null;
  player.kills++;
  document.getElementById('kills-num').textContent = player.kills;
  showMsg('DRONE DOWN — NEW DRONE INCOMING', 2000);
  spawnAmmoDrop(d.x, d.z);
  rebuildEHM();
  setTimeout(() => { if (gameRunning) spawnNewDrone(); }, 3000);
}

export function updateDrone(d, dt) {
  if (d.dead) return;
  d.floatT += dt * 0.8;
  const pdx = camera.position.x - d.x,
        pdz = camera.position.z - d.z;
  const dist = Math.sqrt(pdx * pdx + pdz * pdz);
  const targetDist = 8;

  const DRONE_ACCEL     = 4;
  const DRONE_STRAFE    = 2.8;
  const DRONE_DRAG      = 3;
  const DRONE_MAX_SPEED = 5;

  // Approach / retreat
  const radialErr = dist - targetDist;
  if (Math.abs(radialErr) > 1) {
    const sign = radialErr > 0 ? 1 : -1;
    d.velX += (pdx / dist) * sign * DRONE_ACCEL * dt;
    d.velZ += (pdz / dist) * sign * DRONE_ACCEL * dt;
  }

  // Strafe orbit
  if (dist > 1) {
    d.strafeDirTimer -= dt;
    if (d.strafeDirTimer <= 0) {
      d.strafeDir *= -1;
      d.strafeDirTimer = 3 + Math.random() * 4;
    }
    const tangX = -(pdz / dist);
    const tangZ =  pdx / dist;
    d.velX += tangX * d.strafeDir * DRONE_STRAFE * dt;
    d.velZ += tangZ * d.strafeDir * DRONE_STRAFE * dt;
  }

  // Drag + speed cap
  d.velX -= d.velX * DRONE_DRAG * dt;
  d.velZ -= d.velZ * DRONE_DRAG * dt;
  const spd = Math.sqrt(d.velX * d.velX + d.velZ * d.velZ);
  if (spd > DRONE_MAX_SPEED) {
    d.velX = (d.velX / spd) * DRONE_MAX_SPEED;
    d.velZ = (d.velZ / spd) * DRONE_MAX_SPEED;
  }

  // Integrate + clamp
  const nx = d.x + d.velX * dt, nz = d.z + d.velZ * dt;
  const minB = CELL, maxBX = (MAP_W - 2) * CELL, maxBZ = (MAP_H - 2) * CELL;
  d.x = Math.max(minB, Math.min(maxBX, nx));
  d.z = Math.max(minB, Math.min(maxBZ, nz));
  if (d.x !== nx) d.velX = 0;
  if (d.z !== nz) d.velZ = 0;
  d.y = DRONE_FLY_H + Math.sin(d.floatT) * 0.4;
  d.mesh.position.set(d.x, d.y, d.z);
  d.mesh.rotation.y = Math.atan2(pdx, pdz);
  d.mesh.children.forEach((ch) => { if (ch.userData.isRotor) ch.rotation.y += dt * 18; });

  // EMP pulse
  d.empCd = Math.max(0, d.empCd - dt * 1000);
  if (d.hp < d.maxHp * 0.3 && d.empCd <= 0) {
    d.empCd = 5000;
    player.slowTimer = 2.0;
    showMsg('EMP PULSE — SYSTEMS JAMMED', 2200);
  }

  const coneDir = new THREE.Vector3(pdx, camera.position.y - d.y, pdz).normalize();
  d.cone.lookAt(d.cone.position.clone().add(coneDir));
  d.cone.material.opacity = 0.08 + Math.abs(Math.sin(d.floatT * 2)) * 0.07;
  if (d.empCd > 4500) {
    d.eye.material.color.setHex(0xff4400);
  } else {
    d.eye.material.color.setHSL(
      0.55 + Math.sin(d.floatT * 3) * 0.05, 1,
      0.6 + Math.sin(d.floatT * 5) * 0.2
    );
  }
}

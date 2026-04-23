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
import { enemies } from './enemies.js';
import { isSndActive } from '../modes/snd.js';
import { hasLOS } from '../utils/los.js';
import { applyEntityBase } from './entityBase.js';
import { semiAlertEnemy } from '../ai/enemyStates.js';

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

/** @returns {import('../../types/entities').Drone} */
export function spawnNewDrone() {
  const [mc, mr] = _randomCell();
  const d = buildDrone(mc * CELL + CELL / 2, DRONE_FLY_H, mr * CELL + CELL / 2);
  d.strafeDir      = Math.random() < 0.5 ? 1 : -1;
  d.strafeDirTimer = 3 + Math.random() * 4;
  d.empCd          = 0;
  applyEntityBase(d);
  dronePool.push(d);
  activeDrone = d;
  d.mesh.traverse((ch) => { if (ch.isMesh) ch.userData.droneRef = d; });
  rebuildEHM();
  return d;
}

export function killDrone(d) {
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

// ── S&D recon drones ─────────────────────────────────────────────────────────
const RECON_FLY_H  = 4.2;
const RECON_SPEED  = 4.0;
const RECON_SCAN_R = 13;
const RECON_SCAN_CD = 2.5;

// Patrol routes (world coords) — friend sweeps west/sites, enemy sweeps east/player
const _WP = {
  friend: [
    [16 * CELL + CELL / 2,  5 * CELL + CELL / 2],
    [ 9 * CELL + CELL / 2,  5 * CELL + CELL / 2],
    [ 8 * CELL + CELL / 2,  7 * CELL + CELL / 2],  // site A
    [ 8 * CELL + CELL / 2, 17 * CELL + CELL / 2],  // site B
    [ 9 * CELL + CELL / 2, 19 * CELL + CELL / 2],
    [16 * CELL + CELL / 2, 19 * CELL + CELL / 2],
  ],
  enemy: [
    [11 * CELL + CELL / 2,  4 * CELL + CELL / 2],
    [16 * CELL + CELL / 2,  8 * CELL + CELL / 2],
    [16 * CELL + CELL / 2, 11 * CELL + CELL / 2],  // player spawn
    [16 * CELL + CELL / 2, 14 * CELL + CELL / 2],
    [11 * CELL + CELL / 2, 20 * CELL + CELL / 2],
  ],
};

export const sndDrones = [];

export function spawnSndDrones() {
  clearSndDrones();
  _addRecon('friend');
  _addRecon('enemy');
}

export function clearSndDrones() {
  for (const d of sndDrones) scene.remove(d.mesh);
  sndDrones.length = 0;
}

function _addRecon(team) {
  const wps = _WP[team];
  const [sx, sz] = wps[0];
  const color  = team === 'friend' ? 0x00ccff : 0xff3300;
  const emissive = team === 'friend' ? 0x004488 : 0x881100;

  const body = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 })
  );
  // Rotor ring visual
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.04, 6, 18),
    new THREE.MeshBasicMaterial({ color })
  );
  ring.rotation.x = Math.PI / 2;
  body.add(ring);

  const light = new THREE.PointLight(color, 1.2, 5);
  body.add(light);

  body.position.set(sx, RECON_FLY_H, sz);
  scene.add(body);

  sndDrones.push({
    mesh: body, ring, light,
    x: sx, y: RECON_FLY_H, z: sz,
    team,
    waypoints: wps,
    wpIdx: 0,
    scanCd: Math.random() * RECON_SCAN_CD,
    floatT: Math.random() * Math.PI * 2,
  });
}

export function updateSndDrone(d, dt) {
  if (!isSndActive()) return;

  d.floatT += dt * 1.8;
  d.y = RECON_FLY_H + Math.sin(d.floatT) * 0.28;
  d.ring.rotation.z += dt * 3.5;
  d.mesh.rotation.y += dt * 1.2;

  // Waypoint patrol
  const [wx, wz] = d.waypoints[d.wpIdx];
  const dx = wx - d.x, dz = wz - d.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.8) {
    d.wpIdx = (d.wpIdx + 1) % d.waypoints.length;
  } else {
    d.x += (dx / dist) * RECON_SPEED * dt;
    d.z += (dz / dist) * RECON_SPEED * dt;
  }
  d.mesh.position.set(d.x, d.y, d.z);

  // Periodic scan
  d.scanCd = Math.max(0, d.scanCd - dt);
  if (d.scanCd <= 0) {
    d.scanCd = RECON_SCAN_CD;
    _scan(d);
  }
}

function _scan(d) {
  const r2 = RECON_SCAN_R * RECON_SCAN_R;

  if (d.team === 'friend') {
    // Reveal enemy positions on minimap
    for (const e of enemies) {
      if (e.dead || e.sndTeam !== 'enemy') continue;
      const dx = e.x - d.x, dz = e.z - d.z;
      if (dx * dx + dz * dz > r2) continue;
      if (hasLOS(d.x, d.y, d.z, e.x, 1.2, e.z)) e.radarAge = 0;
    }
  } else {
    // Reveal player position to enemy bots
    const pdx = camera.position.x - d.x, pdz = camera.position.z - d.z;
    if (pdx * pdx + pdz * pdz > r2) return;
    if (!hasLOS(d.x, d.y, d.z, camera.position.x, camera.position.y, camera.position.z)) return;
    const alertR2 = 22 * 22;
    let anyAlerted = false;
    for (const e of enemies) {
      if (e.dead || e.sndTeam !== 'enemy') continue;
      const ex = e.x - camera.position.x, ez = e.z - camera.position.z;
      if (ex * ex + ez * ez > alertR2) continue;
      e.alertTimer = Math.max(e.alertTimer ?? 0, 8000);
      semiAlertEnemy(e);
      anyAlerted = true;
    }
    if (anyAlerted) showMsg('ENEMY RECON DRONE — POSITION COMPROMISED', 2200);
  }
}

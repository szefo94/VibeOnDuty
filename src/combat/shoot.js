import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { PLAYER_H, BULLET_DAMAGE, SHOOT_CD, ENERGY_PER_DMG, MAX_ENERGY, PUNCH_RANGE, PUNCH_DAMAGE } from '../config.js';
import { wallMeshes } from '../level.js';
import { wpn, flash, flashMat, muzzleLight } from '../builders/weapon.js';
import { spawnImpact } from '../fx/impacts.js';
import { groundElevation } from '../map.js';
import { player, startReload } from '../entities/player.js';
import { enemies, killEnemy } from '../entities/enemies.js';
import { activeDrone, dronePool, killDrone } from '../entities/drone.js';
import { spawnHitMarker } from '../hud/hitmarker.js';
import { updateHUD } from '../hud/overlay.js';

// ── Enemy hit meshes ─────────────────────────────────────────────────
export let ehm = [];
export function rebuildEHM() {
  ehm = [];
  enemies.forEach((e) => {
    if (!e.dead)
      e.mesh.traverse((c) => {
        if (c.isMesh) ehm.push(c);
      });
  });
  dronePool.forEach((d) => {
    if (!d.dead)
      d.mesh.traverse((c) => {
        if (c.isMesh && !c.userData.isRotor) ehm.push(c);
      });
  });
}

// ── Weapon animation state ────────────────────────────────────────────
export let muzzleT = 0;
export let recoilT = 0;
export let bobT = 0;
export let sprayHeat = 0;
const MAX_SPRAY = 0.055,
  SPRAY_GROW = 0.08;
export const SPRAY_COOL = 0.5;

export function coolSpray(dt) {
  sprayHeat = Math.max(0, sprayHeat - SPRAY_COOL * dt);
}

export function updateWeapon(dt, moving, sprint, crouching, sliding) {
  const spd = sliding ? 4 : sprint ? 3.4 : crouching ? 1.2 : moving ? 2.1 : 0.22;
  bobT += dt * spd;
  const scale = crouching ? 0.4 : sliding ? 0.15 : 1;
  const aimT = player.aimT;
  const hipBobScale = 1 - aimT * 0.9; // damp bob while aiming
  const bY = moving ? Math.sin(bobT) * 0.007 * (sprint ? 1.4 : 1) * scale * hipBobScale : 0;
  const bX = moving ? Math.sin(bobT * 0.5) * 0.003 * scale * hipBobScale : 0;
  const rc = recoilT > 0 ? recoilT / 100 : 0;
  const crOff = crouching ? -0.04 : sliding ? 0.02 : 0;
  // Lerp between hip (0.11, -0.105, -0.2) and ADS centre (0, -0.09, -0.16)
  const wpnX = 0.11 * (1 - aimT) + bX;
  const wpnY = (-0.105 + (-0.09 - -0.105) * aimT) + bY + rc * 0.024 + crOff;
  const wpnZ = (-0.2 + (-0.16 - -0.2) * aimT) - rc * 0.055;
  wpn.position.set(wpnX, wpnY, wpnZ);
  wpn.rotation.x = rc * 0.07 + (sliding ? 0.15 : 0);
  recoilT = Math.max(0, recoilT - dt * 200);
  if (muzzleT > 0) {
    flashMat.opacity = muzzleT / 62;
    flash.scale.setScalar(0.75 + Math.random() * 0.55);
    muzzleLight.intensity = 2.4 * 4 * Math.PI * (muzzleT / 62);
    muzzleLight.position.copy(camera.position);
    muzzleT = Math.max(0, muzzleT - dt * 1000);
  } else {
    flashMat.opacity = 0;
    muzzleLight.intensity = 0;
  }
}

// ── Live bullets ──────────────────────────────────────────────────────
const BULLET_SPEED = 65;
const BULLET_GRAV = 6;
const BULLET_MAX_LIFE = 1.1;
const BULLET_TRAIL = 2.8;
const liveBullets = [];
const _bRc = new THREE.Raycaster();
const _bPM = new THREE.LineBasicMaterial({ color: 0xffee55, transparent: true, opacity: 1 });

export function spawnBullet(origin, dir) {
  const vel = dir.clone().multiplyScalar(BULLET_SPEED);
  const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), origin.clone()]);
  const line = new THREE.Line(geo, _bPM.clone());
  scene.add(line);
  liveBullets.push({
    pos: origin.clone(),
    vel,
    life: BULLET_MAX_LIFE,
    line,
    prevPos: origin.clone(),
  });
}

export function tickBullets(dt) {
  for (let i = liveBullets.length - 1; i >= 0; i--) {
    const b = liveBullets[i];
    b.prevPos.copy(b.pos);
    b.vel.y -= BULLET_GRAV * dt;
    b.pos.addScaledVector(b.vel, dt);
    b.life -= dt;

    const vn = b.vel.clone().normalize();
    const tail = b.pos.clone().addScaledVector(vn, -BULLET_TRAIL);
    const attr = b.line.geometry.attributes.position;
    attr.setXYZ(0, tail.x, tail.y, tail.z);
    attr.setXYZ(1, b.pos.x, b.pos.y, b.pos.z);
    attr.needsUpdate = true;
    b.line.material.opacity = Math.max(0, (b.life / BULLET_MAX_LIFE) * 0.95);

    if (b.life <= 0) {
      _removeBullet(i);
      continue;
    }

    const moveDelta = new THREE.Vector3().subVectors(b.pos, b.prevPos);
    const moveDist = moveDelta.length();
    if (moveDist > 0.001) {
      _bRc.set(b.prevPos, moveDelta.clone().normalize());
      _bRc.far = moveDist + 0.05;
      const wHits = _bRc.intersectObjects(wallMeshes, false);
      if (wHits.length && wHits[0].distance <= moveDist) {
        spawnImpact(wHits[0].point);
        _removeBullet(i);
        continue;
      }
    }

    let hit = false;
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.sndTeam === 'friend') continue; // never shoot allied bots
      const ePos = new THREE.Vector3(e.x, groundElevation(e.x, e.z) + PLAYER_H * 0.6, e.z);
      if (b.pos.distanceTo(ePos) < 0.75) {
        const dmg = BULLET_DAMAGE + Math.floor(Math.random() * 10);
        e.state = 'attack';
        e.alertTimer = 9000;
        e.reactDelay = 0;
        player.energy = Math.min(MAX_ENERGY, player.energy + dmg * ENERGY_PER_DMG);
        // knockback stagger
        const kd = new THREE.Vector3(e.x - camera.position.x, 0, e.z - camera.position.z).normalize();
        e.velX = kd.x * 4;
        e.velZ = kd.z * 4;
        e.stunTimer = 0.28;
        spawnHitMarker();
        e.takeDamage(dmg, killEnemy);
        _removeBullet(i);
        hit = true;
        break;
      }
    }
    if (hit) continue;

    if (activeDrone && !activeDrone.dead) {
      const dPos = new THREE.Vector3(activeDrone.x, activeDrone.y, activeDrone.z);
      if (b.pos.distanceTo(dPos) < 1.2) {
        const dmg = BULLET_DAMAGE + Math.floor(Math.random() * 10);
        player.energy = Math.min(MAX_ENERGY, player.energy + dmg * ENERGY_PER_DMG);
        spawnHitMarker();
        activeDrone.takeDamage(dmg, killDrone);
        _removeBullet(i);
        continue;
      }
    }
  }
}

// ── Melee punch ────────────────────────────────────────────────────────
const _punchFwd = new THREE.Vector3();
export function tryPunchDamage() {
  _punchFwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.sndTeam === 'friend') continue;
    const dx = e.x - camera.position.x;
    const dz = e.z - camera.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > PUNCH_RANGE) continue;
    const dot = _punchFwd.x * (dx / dist) + _punchFwd.z * (dz / dist);
    if (dot < 0.34) continue; // ~120° frontal arc
    e.state = 'attack';
    e.alertTimer = 9000;
    e.reactDelay = 0;
    e.velX = (dx / dist) * 3;
    e.velZ = (dz / dist) * 3;
    e.stunTimer = 0.45;
    spawnHitMarker();
    e.takeDamage(PUNCH_DAMAGE, killEnemy);
  }
}

function _removeBullet(i) {
  const b = liveBullets[i];
  scene.remove(b.line);
  b.line.geometry.dispose();
  b.line.material.dispose();
  liveBullets.splice(i, 1);
}

// ── Try shoot ──────────────────────────────────────────────────────────
export function tryShoot() {
  if (player.dead || player.reloading) return;
  if (player.ammo <= 0) {
    startReload();
    return;
  }
  const now = performance.now();
  if (now - player.shootCd < SHOOT_CD) return;
  player.shootCd = now;
  player.ammo--;
  updateHUD();
  muzzleT = 62;
  recoilT = 1;
  sprayHeat = Math.min(1, sprayHeat + SPRAY_GROW);
  const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const ca = sprayHeat * MAX_SPRAY;
  const dir = baseDir
    .clone()
    .addScaledVector(right, (Math.random() - 0.5) * 2 * ca)
    .addScaledVector(up, (Math.random() - 0.5) * 2 * ca)
    .normalize();

  let origin;
  if (player.thirdPerson) {
    // Spawn bullet at player's gun-hand area; aim toward crosshair target point.
    // camera.position is always the player eye (restored after render).
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const rgt = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    origin = camera.position.clone()
      .addScaledVector(fwd, 0.45)   // in front of body
      .addScaledVector(rgt, 0.28)   // gun-hand side
      .add(new THREE.Vector3(0, -0.28, 0)); // chest height, not eye
    // Correct bullet dir so it still hits crosshair target despite offset origin
    const targetPt = camera.position.clone().addScaledVector(dir, 80);
    dir.copy(targetPt.sub(origin).normalize());
  } else {
    // Always read from the flash mesh world position — stays correct regardless of weapon model
    origin = new THREE.Vector3();
    flash.getWorldPosition(origin);
  }
  spawnBullet(origin, dir);
  if (player.ammo === 0) startReload();
}

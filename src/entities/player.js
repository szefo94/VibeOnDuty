import * as THREE from 'three';
import { camera } from '../scene.js';
import {
  CELL,
  PLAYER_H,
  PLAYER_H_CROUCH,
  MOVE_SPEED,
  SPRINT_MULT,
  MAX_HP,
  MAX_AMMO,
  RESERVE_AMMO,
  RELOAD_MS,
  GRAVITY,
  JUMP_FORCE,
  HEAD_BOB_PITCH,
  SLIDE_SPEED,
  SLIDE_DUR,
  SLIDE_CANCEL_JUMP,
} from '../config.js';
import { MAP_W, MAP_H, hAt, groundElevation, canMoveTo } from '../map.js';
import { keys, locked, mouseHeld } from '../input.js';
import { tickImpacts } from '../fx/impacts.js';
import { tickTracers } from '../fx/tracers.js';
import { tickGrenadeParticles, tickSmokeCloud } from '../fx/particles.js';
import { tickAmmoDrops } from './ammoDrops.js';
import { tickGrenades } from './grenades.js';
import { updateHUD, showMsg, showStatus } from '../hud/overlay.js';
import { tickHitMarker } from '../hud/hitmarker.js';
import { tryShoot, tickBullets, updateWeapon, coolSpray, bobT } from '../combat/shoot.js';

/** @type {import('../../types/entities').Player} */
export const player = /** @type {any} */ ({
  hp: MAX_HP,
  ammo: MAX_AMMO,
  reserve: RESERVE_AMMO,
  kills: 0,
  reloading: false,
  reloadTimer: 0,
  shootCd: 0,
  dead: false,
  yaw: 0,
  pitch: 0,
  lastHitTime: 0,
  velY: 0,
  onGround: true,
  bobPitch: 0,
  crouching: false,
  sliding: false,
  slideVel: null,
  slideTimer: 0,
  slideCancelAvail: false,
  energy: 0,
  airVelX: 0,
  airVelZ: 0,
  slowTimer: 0,  // set by drone EMP pulse
  lean: 0,         // -1 = left (Q), 0 = upright, 1 = right (E), smoothed
  diving: false,
  diveTimer: 0,    // counts down after landing, holds forward pitch
  rollTimer: 0,    // counts down from ROLL_ANIM_DUR; drives roll animation in loop.js
  divePitch: 0,    // extra pitch added to camera during/after dive, lerped out
  moving: false,   // true when player has non-zero horizontal velocity this frame
  aiming: false,   // RMB held
  aimT: 0,         // 0=hip, 1=full ADS — lerped each frame
  thirdPerson: false, // mirror of loop.js tpTransition>0.5 — written by loop.js
});

export const visited = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W));

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const LEAN_ANGLE = 0.28;        // radians of roll at full lean
export const LEAN_SHIFT = 0.38; // camera X offset at full lean (world units), read by loop.js
const LEAN_SPEED = 3.5;         // smoothing speed (lower = slower lean)

const DIVE_SPEED = 12;          // horizontal launch speed
const DIVE_LAUNCH_Y = 2.8;      // upward kick on dive
const DIVE_DUR = 0.55;          // seconds camera stays pitched forward after landing
const ROLL_ANIM_DUR = 1.467;    // Roll clip duration from enemy.glb — slide timed to match

export function startReload() {
  if (player.reloading || player.reserve <= 0) return;
  player.reloading = true;
  player.reloadTimer = RELOAD_MS;
  document.getElementById('reloadwrap').style.display = 'block';
  showMsg('RELOADING');
}

export function updatePlayer(dt) {
  if (player.dead) return;
  if ((mouseHeld || keys['TouchFire']) && locked) tryShoot();
  if (player.slowTimer > 0) player.slowTimer = Math.max(0, player.slowTimer - dt);

  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const wantCrouch = keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC'];
  const movingForward = keys['KeyW'] || keys['ArrowUp'];
  // ── Dive (Z key) ─────────────────────────────────────────────────
  if (keys['KeyZ'] && player.onGround && !player.sliding && !player.diving && !player.crouching) {
    player.diving = true;
    player.onGround = false;
    player.velY = DIVE_LAUNCH_Y;
    player.rollTimer = ROLL_ANIM_DUR;
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    player.airVelX = fwd.x * DIVE_SPEED;
    player.airVelZ = fwd.z * DIVE_SPEED;
    player.divePitch = 0.55; // forward tilt on launch
    showStatus('DIVE');
  }

  const wantSlide =
    movingForward && wantCrouch && !player.sliding && player.onGround && !player.crouching;

  if (wantSlide) {
    player.sliding = true;
    player.slideTimer = SLIDE_DUR;
    player.slideCancelAvail = true;
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    player.slideVel = fwd.multiplyScalar(SLIDE_SPEED);
    showStatus('SLIDE');
  }
  if (player.sliding) {
    player.slideTimer -= dt;
    if (SLIDE_CANCEL_JUMP && player.slideCancelAvail && keys['Space']) {
      player.sliding = false;
      player.slideVel = null;
      player.velY = JUMP_FORCE * 0.85;
      player.onGround = false;
      player.slideCancelAvail = false;
      showStatus('SLIDE CANCEL');
    }
    if (player.slideTimer <= 0) {
      player.sliding = false;
      player.slideVel = null;
    }
  }
  player.crouching = wantCrouch && !player.sliding;

  const groundH = hAt(Math.floor(camera.position.x / CELL), Math.floor(camera.position.z / CELL));
  const groundHSmooth = groundElevation(camera.position.x, camera.position.z);
  const targetH = player.sliding ? PLAYER_H_CROUCH : player.crouching ? PLAYER_H_CROUCH : PLAYER_H;
  const eyeFloor = groundHSmooth + targetH;

  let moving = false;
  let mvX, mvZ;

  if (player.onGround) {
    const empSlow = player.slowTimer > 0 ? 0.4 : 1;
    const moveScale = (player.crouching ? 0.72 : sprint ? SPRINT_MULT : 1) * empSlow;
    const spd = MOVE_SPEED * moveScale * dt;
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const rgt = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const mv = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp']) mv.add(fwd);
    if (keys['KeyS'] || keys['ArrowDown']) mv.sub(fwd);
    if (keys['KeyA'] || keys['ArrowLeft']) mv.sub(rgt);
    if (keys['KeyD'] || keys['ArrowRight']) mv.add(rgt);
    if (mv.length() > 0) {
      mv.normalize();
      mv.multiplyScalar(spd);
      moving = true;
    }
    if (player.sliding && player.slideVel) {
      mv.x += player.slideVel.x * dt;
      mv.z += player.slideVel.z * dt;
      moving = true;
    }
    mvX = mv.x;
    mvZ = mv.z;
    player.airVelX = mvX / dt;
    player.airVelZ = mvZ / dt;
    if (mvX !== 0) {
      const nx = camera.position.x + mvX;
      if (canMoveTo(nx, camera.position.z, groundH)) camera.position.x = nx;
    }
    if (mvZ !== 0) {
      const nz = camera.position.z + mvZ;
      if (canMoveTo(camera.position.x, nz, groundH)) camera.position.z = nz;
    }
  } else {
    mvX = player.airVelX * dt;
    mvZ = player.airVelZ * dt;
    if (player.slideVel) {
      mvX += player.slideVel.x * dt;
      mvZ += player.slideVel.z * dt;
    }
    if (mvX !== 0) {
      const nx = camera.position.x + mvX;
      if (canMoveTo(nx, camera.position.z, groundH, true)) camera.position.x = nx;
    }
    if (mvZ !== 0) {
      const nz = camera.position.z + mvZ;
      if (canMoveTo(camera.position.x, nz, groundH, true)) camera.position.z = nz;
    }
    moving = Math.abs(mvX) + Math.abs(mvZ) > 0.0001;
    player.airVelX *= 1 - dt * 0.4;
    player.airVelZ *= 1 - dt * 0.4;
  }

  if (player.slideVel) {
    const friction = player.onGround ? 3.5 : 0.8;
    player.slideVel.multiplyScalar(1 - dt * friction);
    if (player.slideVel.length() < 0.05) player.slideVel = null;
  }

  if (player.onGround && !player.sliding && keys['Space']) {
    player.velY = JUMP_FORCE;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.velY -= GRAVITY * dt;
    camera.position.y += player.velY * dt;
    if (camera.position.y <= eyeFloor) {
      camera.position.y = eyeFloor;
      player.velY = 0;
      player.onGround = true;
      const airSpd = Math.sqrt(player.airVelX * player.airVelX + player.airVelZ * player.airVelZ);
      // dive landing → always slide with dive momentum
      if (player.diving) {
        player.diving = false;
        player.diveTimer = DIVE_DUR;
        player.sliding = true;
        // Slide lasts exactly as long as the remaining roll animation so they end together
        player.slideTimer = player.rollTimer;
        player.slideCancelAvail = true;
        player.slideVel = new THREE.Vector3(player.airVelX, 0, player.airVelZ)
          .normalize()
          .multiplyScalar(Math.min(airSpd, SLIDE_SPEED * 1.2));
      } else if (wantCrouch && !player.sliding && airSpd > MOVE_SPEED * 0.6) {
        // crouch-landing slide from regular jump
        player.sliding = true;
        player.slideTimer = SLIDE_DUR;
        player.slideCancelAvail = true;
        player.slideVel = new THREE.Vector3(player.airVelX, 0, player.airVelZ)
          .normalize()
          .multiplyScalar(Math.min(airSpd, SLIDE_SPEED));
        showStatus('SLIDE');
      }
    }
  } else {
    camera.position.y += (eyeFloor - camera.position.y) * Math.min(1, dt * 14);
  }

  if (moving && player.onGround) {
    player.bobPitch =
      Math.sin(bobT) * HEAD_BOB_PITCH * (sprint ? 1.4 : 1) * (player.crouching ? 0.4 : 1);
  } else {
    player.bobPitch *= 0.82;
  }

  // ── Dive pitch recovery ──────────────────────────────────────────
  if (player.diveTimer > 0) {
    player.diveTimer -= dt;
    if (player.diveTimer <= 0) player.diveTimer = 0;
  }
  // lerp divePitch toward 0 when in air (in-flight tilt) or after landing (recovery)
  const divePitchTarget = player.diving ? 0.55 : 0;
  player.divePitch += (divePitchTarget - player.divePitch) * Math.min(1, dt * 5);

  // ── Lean (Q / E) ────────────────────────────────────────────────
  const leanTarget = !player.dead && !player.sliding && !player.diving
    ? (keys['KeyQ'] ? -1 : keys['KeyE'] ? 1 : 0)
    : 0;
  player.lean += (leanTarget - player.lean) * Math.min(1, LEAN_SPEED * dt);
  const slideRoll = player.sliding ? 0.04 : 0;
  _euler.set(
    player.pitch + player.bobPitch + player.divePitch,
    player.yaw,
    slideRoll - player.lean * LEAN_ANGLE
  );
  camera.quaternion.setFromEuler(_euler);

  const pc = Math.floor(camera.position.x / CELL),
    pr = Math.floor(camera.position.z / CELL);
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      const vc = pc + dc,
        vr = pr + dr;
      if (vc >= 0 && vr >= 0 && vc < MAP_W && vr < MAP_H) visited[vr][vc] = 1;
    }

  player.moving = moving;
  if (player.rollTimer > 0) player.rollTimer = Math.max(0, player.rollTimer - dt);
  const adsTarget = player.aiming && !player.sliding && !player.diving ? 1 : 0;
  player.aimT += (adsTarget - player.aimT) * Math.min(1, dt * 14);
  updateWeapon(dt, moving, sprint, player.crouching, player.sliding);
  tickImpacts(dt);
  tickTracers(dt);
  tickBullets(dt);
  tickAmmoDrops(dt);
  tickGrenades(dt);
  tickGrenadeParticles(dt);
  tickSmokeCloud(dt);
  coolSpray(dt);

  if (player.reloading) {
    player.reloadTimer -= dt * 1000;
    document.getElementById('reloadbar').style.width =
      (1 - player.reloadTimer / RELOAD_MS) * 100 + '%';
    if (player.reloadTimer <= 0) {
      const take = Math.min(MAX_AMMO - player.ammo, player.reserve);
      player.ammo += take;
      player.reserve -= take;
      player.reloading = false;
      document.getElementById('reloadwrap').style.display = 'none';
      updateHUD();
      showMsg('READY');
    }
  }

  tickHitMarker(dt);

  const now = performance.now();
  if (player.hp > 0 && player.hp < MAX_HP && now - player.lastHitTime > 3000) {
    player.hp = Math.min(MAX_HP, player.hp + 8 * dt);
    updateHUD();
  }
}

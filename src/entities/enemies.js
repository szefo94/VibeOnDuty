import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import {
  CELL,
  PLAYER_H,
  ENEMY_HP,
  ENEMY_SPEED,
  ENEMY_ROT_SPD,
  ENEMY_SIGHT,
  ENEMY_SHOOT_RANGE,
  ENEMY_SHOOT_CD,
  ENEMY_DAMAGE,
  REACT_MIN,
  REACT_MAX,
  AIM_THRESH,
  GRAVITY,
} from '../config.js';
import { MAP_W, MAP_H, MAP, isRamp, mapCell, canMoveTo, hAt } from '../map.js';
import { slerp, normA } from '../math.js';
import { astar } from '../astar.js';
import { buildEnemy } from '../builders/enemy.js';
import { buildDrone } from '../builders/drone.js';
import { wallMeshes } from '../level.js';
import { spawnTracer } from '../fx/tracers.js';
import { player } from './player.js';
import { ammoDrops, spawnAmmoDrop } from './ammoDrops.js';
import { updateHUD, showMsg, triggerHitFlash } from '../hud/overlay.js';
import { setGameRunning, gameRunning } from '../input.js';
import { rebuildEHM } from '../combat/shoot.js';

// ── Wave state ────────────────────────────────────────────────────
export let wave = 1;
export let respawnTimer = -1;

// ── Walkable cells ────────────────────────────────────────────────
export const WALKABLE_CELLS = [];
for (let r = 1; r < MAP_H - 1; r++)
  for (let c = 1; c < MAP_W - 1; c++)
    if (MAP[r][c] === 0 || isRamp(MAP[r][c])) WALKABLE_CELLS.push([c, r]);

function randomSpawnCell(usedCells) {
  const cands = WALKABLE_CELLS.filter(([c, r]) => {
    if (Math.abs(c - 1) + Math.abs(r - 1) < 5) return false;
    for (const [uc, ur] of usedCells) if (Math.abs(c - uc) + Math.abs(r - ur) < 3) return false;
    return true;
  });
  return cands.length
    ? cands[Math.floor(Math.random() * cands.length)]
    : WALKABLE_CELLS[Math.floor(Math.random() * WALKABLE_CELLS.length)];
}
function randomPatrol(sc, sr, rad = 2) {
  return [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a) => {
    let bc = Math.round(sc + Math.cos(a) * rad),
      br = Math.round(sr + Math.sin(a) * rad);
    bc = Math.max(1, Math.min(MAP_W - 2, bc));
    br = Math.max(1, Math.min(MAP_H - 2, br));
    return MAP[br][bc] === 0 ? [bc, br] : [sc, sr];
  });
}
const WP_WAITS = [600, 1200, 500, 900, 1000, 500];
const NUM_ENEMIES = 10;

// ── Enemies array ─────────────────────────────────────────────────
export function spawnEnemyIntoSlot(e) {
  if (e.mesh) scene.remove(e.mesh);
  const used = enemies
    .filter((en) => en !== e && !en.dead)
    .map((en) => [Math.floor(en.x / CELL), Math.floor(en.z / CELL)]);
  const [mc, mr] = randomSpawnCell(used);
  const patrol = randomPatrol(mc, mr, 2);
  const { mesh, muzzleFlash, animT } = buildEnemy(mc * CELL + CELL / 2, mr * CELL + CELL / 2);
  Object.assign(e, {
    mesh,
    muzzleFlash,
    animT,
    x: mc * CELL + CELL / 2,
    z: mr * CELL + CELL / 2,
    hp: ENEMY_HP,
    maxHp: ENEMY_HP,
    hpDrain: ENEMY_HP,
    state: 'patrol',
    facingY: Math.random() * Math.PI * 2,
    alertTimer: 0,
    reactDelay: 0,
    shootCd: 0,
    path: [],
    pathTick: 0,
    pathGoal: null,
    patrolWp: 0,
    patrol: patrol.map(([c, r]) => [c * CELL + CELL / 2, r * CELL + CELL / 2]),
    wpWait: 0,
    bobT: Math.random() * 6,
    dead: false,
    muzzleFlashT: 0,
    radarAge: Infinity,
    crouching: false,
    crouchTimer: 0,
    velX: 0,
    velZ: 0,
    velY: 0,
    stunTimer: 0,
    onGround: true,
    jumpCd: 0,
  });
}

const usedCells = [];
export const enemies = Array.from({ length: NUM_ENEMIES }, (_) => {
  const [mc, mr] = randomSpawnCell(usedCells);
  usedCells.push([mc, mr]);
  const patrol = randomPatrol(mc, mr, 2);
  const { mesh, muzzleFlash, animT } = buildEnemy(mc * CELL + CELL / 2, mr * CELL + CELL / 2);
  return {
    mesh,
    muzzleFlash,
    animT,
    x: mc * CELL + CELL / 2,
    z: mr * CELL + CELL / 2,
    hp: ENEMY_HP,
    maxHp: ENEMY_HP,
    hpDrain: ENEMY_HP,
    state: 'patrol',
    facingY: Math.random() * Math.PI * 2,
    alertTimer: 0,
    reactDelay: 0,
    shootCd: 0,
    path: [],
    pathTick: 0,
    pathGoal: null,
    patrolWp: 0,
    patrol: patrol.map(([c, r]) => [c * CELL + CELL / 2, r * CELL + CELL / 2]),
    wpWait: 0,
    bobT: Math.random() * 6,
    dead: false,
    muzzleFlashT: 0,
    radarAge: Infinity,
    crouching: false,
    crouchTimer: 0,
    velX: 0,
    velZ: 0,
    velY: 0,
    stunTimer: 0,
    onGround: true,
    jumpCd: 0,
  };
});

// ── triggerDeath lives here because it reads wave ─────────────────
export function triggerDeath() {
  player.dead = true;
  setGameRunning(false);
  document.exitPointerLock?.();
  const ov = document.getElementById('overlay');
  ov.style.display = 'flex';
  ov.innerHTML = `<div class="dead-h">KILLED IN ACTION</div><div class="stat">Kills: ${player.kills}</div><div class="stat" style="color:#333;margin-top:6px">Wave ${wave} — the vibes remain hostile</div><button onclick="location.reload()" style="margin-top:28px;padding:12px 52px;background:#e74c3c;color:#fff;border:none;font-family:'Courier New',monospace;font-size:14px;letter-spacing:4px;cursor:pointer">[ REDEPLOY ]</button>`;
}

// ── Kill functions ────────────────────────────────────────────────
export function killEnemy(e) {
  e.dead = true;
  scene.remove(e.mesh);
  player.kills++;
  document.getElementById('kills-num').textContent = player.kills;
  showMsg('ENEMY DOWN');
  rebuildEHM();
  spawnAmmoDrop(e.x, e.z);
  if (enemies.every((en) => en.dead)) {
    wave++;
    showMsg(`ZONE CLEARED — WAVE ${wave - 1} COMPLETE`, 3500);
    respawnTimer = 5000;
  }
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
  setTimeout(() => {
    if (gameRunning) spawnNewDrone();
  }, 3000);
}

// ── Wave countdown (owns respawnTimer mutation) ───────────────────
export function tickWave(dt) {
  if (respawnTimer <= 0) return;
  respawnTimer -= dt * 1000;
  const secs = Math.ceil(respawnTimer / 1000);
  showMsg(`WAVE ${wave} INCOMING IN ${secs}...`, 1100);
  if (respawnTimer <= 0) {
    respawnTimer = -1;
    ammoDrops.forEach((d) => scene.remove(d.mesh));
    ammoDrops.length = 0;
    enemies.forEach((e) => spawnEnemyIntoSlot(e));
    rebuildEHM();
    showMsg(`WAVE ${wave} — ENGAGE!`, 2500);
  }
}

// ── Drone ─────────────────────────────────────────────────────────
export const DRONE_FLY_H = 4.5;
export const dronePool = [];
export let activeDrone = null;

export function spawnNewDrone() {
  const [mc, mr] = randomSpawnCell([]);
  const d = buildDrone(mc * CELL + CELL / 2, DRONE_FLY_H, mr * CELL + CELL / 2);
  // strafe orbit + EMP state
  d.strafeDir = Math.random() < 0.5 ? 1 : -1;
  d.strafeDirTimer = 3 + Math.random() * 4;
  d.empCd = 0; // starts ready so first EMP fires once drone reaches low HP
  dronePool.push(d);
  activeDrone = d;
  d.mesh.traverse((ch) => {
    if (ch.isMesh) ch.userData.droneRef = d;
  });
  rebuildEHM();
  return d;
}

export function updateDrone(d, dt) {
  if (d.dead) return;
  d.floatT += dt * 0.8;
  const pdx = camera.position.x - d.x,
    pdz = camera.position.z - d.z;
  const dist = Math.sqrt(pdx * pdx + pdz * pdz);
  const targetDist = 8;

  // velX/velZ are in units/second — applied as d.x += d.velX * dt
  const DRONE_ACCEL = 4;   // units/s² for approach/retreat
  const DRONE_STRAFE = 2.8; // units/s² for orbit tangent
  const DRONE_DRAG = 3;    // drag coefficient (higher = snappier stop)
  const DRONE_MAX_SPEED = 5; // units/s hard cap

  // ── Approach / retreat to maintain orbit radius ───────────────────
  const radialErr = dist - targetDist;
  if (Math.abs(radialErr) > 1) {
    const sign = radialErr > 0 ? 1 : -1;
    d.velX += (pdx / dist) * sign * DRONE_ACCEL * dt;
    d.velZ += (pdz / dist) * sign * DRONE_ACCEL * dt;
  }

  // ── Strafe orbit: tangential component perpendicular to player dir ─
  if (dist > 1) {
    d.strafeDirTimer -= dt;
    if (d.strafeDirTimer <= 0) {
      d.strafeDir *= -1;
      d.strafeDirTimer = 3 + Math.random() * 4;
    }
    const tangX = -(pdz / dist);
    const tangZ = pdx / dist;
    d.velX += tangX * d.strafeDir * DRONE_STRAFE * dt;
    d.velZ += tangZ * d.strafeDir * DRONE_STRAFE * dt;
  }

  // ── Drag + speed cap ──────────────────────────────────────────────
  d.velX -= d.velX * DRONE_DRAG * dt;
  d.velZ -= d.velZ * DRONE_DRAG * dt;
  const spd = Math.sqrt(d.velX * d.velX + d.velZ * d.velZ);
  if (spd > DRONE_MAX_SPEED) {
    d.velX = (d.velX / spd) * DRONE_MAX_SPEED;
    d.velZ = (d.velZ / spd) * DRONE_MAX_SPEED;
  }

  // ── Integrate + clamp to map; zero velocity on edge collision ─────
  const nx = d.x + d.velX * dt;
  const nz = d.z + d.velZ * dt;
  const minB = CELL, maxBX = (MAP_W - 2) * CELL, maxBZ = (MAP_H - 2) * CELL;
  d.x = Math.max(minB, Math.min(maxBX, nx));
  d.z = Math.max(minB, Math.min(maxBZ, nz));
  if (d.x !== nx) d.velX = 0;
  if (d.z !== nz) d.velZ = 0;
  d.y = DRONE_FLY_H + Math.sin(d.floatT) * 0.4;
  d.mesh.position.set(d.x, d.y, d.z);
  d.mesh.rotation.y = Math.atan2(pdx, pdz);
  d.mesh.children.forEach((ch) => {
    if (ch.userData.isRotor) ch.rotation.y += dt * 18;
  });

  // ── EMP pulse when HP critical (< 30%) ────────────────────────────
  d.empCd = Math.max(0, d.empCd - dt * 1000);
  if (d.hp < d.maxHp * 0.3 && d.empCd <= 0) {
    d.empCd = 5000;
    player.slowTimer = 2.0;
    showMsg('EMP PULSE — SYSTEMS JAMMED', 2200);
  }

  // ── Burst fire (disabled — uncomment to enable) ───────────────────
  // const DRONE_BURST_RANGE = 14;
  // const DRONE_BURST_CD = 2000;   // ms between bursts
  // const DRONE_BURST_COUNT = 3;   // bullets per burst
  // const DRONE_BURST_INTERVAL = 150; // ms between bullets in a burst
  // d.burstCd = (d.burstCd ?? DRONE_BURST_CD) - dt * 1000;
  // d.burstCount = d.burstCount ?? 0;
  // d.burstTimer = (d.burstTimer ?? 0) - dt * 1000;
  // if (d.burstCd <= 0 && dist < DRONE_BURST_RANGE) {
  //   d.burstCd = DRONE_BURST_CD;
  //   d.burstCount = DRONE_BURST_COUNT;
  //   d.burstTimer = 0;
  // }
  // if (d.burstCount > 0 && d.burstTimer <= 0) {
  //   const fireDir = new THREE.Vector3(
  //     camera.position.x - d.x,
  //     camera.position.y - d.y,
  //     camera.position.z - d.z
  //   ).normalize();
  //   spawnBullet(new THREE.Vector3(d.x, d.y, d.z), fireDir);
  //   d.burstCount--;
  //   d.burstTimer = DRONE_BURST_INTERVAL;
  // }

  const coneDir = new THREE.Vector3(pdx, camera.position.y - d.y, pdz).normalize();
  d.cone.lookAt(d.cone.position.clone().add(coneDir));
  d.cone.material.opacity = 0.08 + Math.abs(Math.sin(d.floatT * 2)) * 0.07;
  // eye: orange flash right after an EMP pulse, blue otherwise
  if (d.empCd > 4500) {
    d.eye.material.color.setHex(0xff4400);
  } else {
    d.eye.material.color.setHSL(
      0.55 + Math.sin(d.floatT * 3) * 0.05,
      1,
      0.6 + Math.sin(d.floatT * 5) * 0.2
    );
  }
}

// ── Enemy AI ──────────────────────────────────────────────────────
const _los = new THREE.Raycaster();
const _tv = new THREE.Vector3(),
  _tv2 = new THREE.Vector3();

function hasLOS(ax, ay, az, bx, by, bz) {
  _tv.set(ax, ay, az);
  _tv2.set(bx - ax, by - ay, bz - az);
  const d = _tv2.length();
  _tv2.normalize();
  _los.set(_tv, _tv2);
  _los.far = d - 0.14;
  return _los.intersectObjects(wallMeshes, false).length === 0;
}

function animateEnemyLegs(e, dt, moving) {
  const spd = moving ? (e.state === 'attack' ? 5 : 2.5) : 0;
  e.animT += dt * spd;
  const kids = e.mesh.children;
  const sw = Math.sin(e.animT) * 0.35;
  if (kids[2]) kids[2].rotation.x = sw;
  if (kids[3]) kids[3].rotation.x = -sw;
  if (kids[6]) kids[6].rotation.x = -sw * 0.6;
  if (kids[7]) kids[7].rotation.x = sw * 0.6;
  if (kids[12]) kids[12].rotation.x = -sw * 0.5;
  if (kids[13]) kids[13].rotation.x = sw * 0.5;
}

export function updateEnemies(ts, dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    const pdx = camera.position.x - e.x,
      pdz = camera.position.z - e.z;
    const distP = Math.sqrt(pdx * pdx + pdz * pdz);
    const eGround = hAt(Math.floor(e.x / CELL), Math.floor(e.z / CELL));
    const canSee =
      distP < ENEMY_SIGHT &&
      hasLOS(
        e.x,
        eGround + PLAYER_H * 0.9,
        e.z,
        camera.position.x,
        camera.position.y,
        camera.position.z
      );
    if (canSee) {
      if (e.state === 'patrol') {
        e.state = 'spotted';
        e.reactDelay = REACT_MIN + Math.random() * (REACT_MAX - REACT_MIN);
      } else e.state = 'attack';
      e.alertTimer = 9000;
    }
    if (e.state !== 'patrol' && !canSee) {
      e.alertTimer = Math.max(0, e.alertTimer - dt * 1000);
      if (e.alertTimer <= 0) e.state = 'patrol';
    }
    if (e.state === 'spotted') {
      e.reactDelay = Math.max(0, e.reactDelay - dt * 1000);
      if (e.reactDelay <= 0) e.state = 'attack';
    }

    const desiredY = Math.atan2(-pdx, -pdz);
    let isMoving = false;

    if (e.stunTimer > 0) {
      // ── Stagger: drain knockback velocity, skip normal movement ──────
      e.stunTimer = Math.max(0, e.stunTimer - dt);
      e.velX *= 1 - dt * 8;
      e.velZ *= 1 - dt * 8;
      const nx = e.x + e.velX * dt;
      const nz = e.z + e.velZ * dt;
      if (canMoveTo(nx, e.z, eGround)) e.x = nx;
      if (canMoveTo(e.x, nz, eGround)) e.z = nz;
    } else if (e.state === 'attack' || e.state === 'spotted') {
      // ── Path throttle: recalc only when timer expires OR player cell changes ──
      const goalCell = [
        Math.floor(camera.position.x / CELL),
        Math.floor(camera.position.z / CELL),
      ];
      const goalChanged =
        !e.pathGoal ||
        e.pathGoal[0] !== goalCell[0] ||
        e.pathGoal[1] !== goalCell[1];
      if (e.path.length === 0 || e.pathTick <= 0 || goalChanged) {
        e.path = astar(e.x, e.z, camera.position.x, camera.position.z);
        if (e.path.length > 0) e.path.shift();
        e.pathTick = 600 + Math.random() * 200;
        e.pathGoal = goalCell;
      }
      e.pathTick -= dt * 1000;

      // ── Velocity-based movement with acceleration + drag ──────────────
      if (e.path.length > 0 && distP > CELL * 1.4) {
        const [tx, tz] = e.path[0];
        const ddx = tx - e.x,
          ddz = tz - e.z,
          dd = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dd < 0.18) {
          e.path.shift();
        } else {
          const spd = ENEMY_SPEED * (e.state === 'spotted' ? 0.55 : 1);
          e.velX += ((ddx / dd) * spd - e.velX) * 12 * dt;
          e.velZ += ((ddz / dd) * spd - e.velZ) * 12 * dt;
          const nx = e.x + e.velX * dt,
            nz = e.z + e.velZ * dt;
          if (canMoveTo(nx, e.z, eGround)) e.x = nx;
          if (canMoveTo(e.x, nz, eGround)) e.z = nz;
          isMoving = true;
        }
      } else {
        // decelerate when no path target or close enough to player
        e.velX *= 1 - 10 * dt;
        e.velZ *= 1 - 10 * dt;
      }

      // ── Faster rotation in attack mode ────────────────────────────────
      const rotSpd = e.state === 'attack' ? ENEMY_ROT_SPD * 2.5 : ENEMY_ROT_SPD;
      e.facingY = slerp(e.facingY, desiredY, rotSpd, dt);

      if (
        e.state === 'attack' &&
        distP < ENEMY_SHOOT_RANGE &&
        canSee &&
        Math.abs(normA(e.facingY - desiredY)) < AIM_THRESH
      ) {
        if (ts - e.shootCd > ENEMY_SHOOT_CD) {
          e.shootCd = ts;
          if (
            hasLOS(
              e.x,
              eGround + PLAYER_H * 0.85,
              e.z,
              camera.position.x,
              camera.position.y,
              camera.position.z
            )
          ) {
            player.hp = Math.max(0, player.hp - ENEMY_DAMAGE - Math.floor(Math.random() * 7));
            triggerHitFlash();
            updateHUD();
            if (player.hp <= 0) triggerDeath();
            e.muzzleFlashT = 55;
            spawnTracer(
              new THREE.Vector3(0.295, 1.19, -0.52).applyMatrix4(e.mesh.matrixWorld),
              camera.position.clone()
            );
          }
        }
      }
    } else {
      // ── Patrol ────────────────────────────────────────────────────────
      // bleed off any residual velocity from prior attack state
      e.velX *= 1 - 10 * dt;
      e.velZ *= 1 - 10 * dt;
      if (e.wpWait > 0) {
        e.wpWait = Math.max(0, e.wpWait - dt * 1000);
        e.facingY += dt * 0.55 * Math.sin(performance.now() / 820 + e.bobT);
      } else {
        const wp = e.patrol[e.patrolWp];
        const ddx = wp[0] - e.x,
          ddz = wp[1] - e.z,
          dd = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dd < 0.22) {
          e.patrolWp = (e.patrolWp + 1) % e.patrol.length;
          e.wpWait = WP_WAITS[e.patrolWp % WP_WAITS.length];
        } else {
          const spd2 = ENEMY_SPEED * 0.42 * dt;
          const nx = e.x + (ddx / dd) * spd2,
            nz = e.z + (ddz / dd) * spd2;
          if (canMoveTo(nx, e.z, eGround)) e.x = nx;
          if (canMoveTo(e.x, nz, eGround)) e.z = nz;
          e.facingY = slerp(e.facingY, Math.atan2(-ddx, -ddz), ENEMY_ROT_SPD * 0.5, dt);
          isMoving = true;
        }
      }
    }

    animateEnemyLegs(e, dt, isMoving);
    if (e.state === 'attack') {
      if (!e.crouching && e.crouchTimer <= 0 && Math.random() < 0.008) {
        e.crouching = true;
        e.crouchTimer = 0.8 + Math.random() * 1.2;
      }
      if (e.crouching) {
        e.crouchTimer -= dt;
        if (e.crouchTimer <= 0) e.crouching = false;
      }
      e.jumpCd = Math.max(0, e.jumpCd - dt);
      if (e.onGround && e.jumpCd <= 0 && Math.random() < 0.004) {
        e.velY = 5.5;
        e.onGround = false;
        e.jumpCd = 3 + Math.random() * 3;
      }
    } else {
      e.crouching = false;
    }
    if (!e.onGround) {
      e.velY -= GRAVITY * dt;
      const newY = e.mesh.position.y + e.velY * dt;
      if (newY <= eGround) {
        e.onGround = true;
        e.velY = 0;
        e.mesh.position.y = eGround;
      } else e.mesh.position.y = newY;
    }
    const crOff = e.crouching ? -0.45 : 0;
    e.bobT += dt * (e.state === 'attack' ? 3.8 : 1.6);
    if (e.onGround)
      e.mesh.position.set(
        e.x,
        eGround + crOff + (isMoving ? Math.abs(Math.sin(e.bobT)) * 0.022 : 0),
        e.z
      );
    else {
      e.mesh.position.x = e.x;
      e.mesh.position.z = e.z;
    }
    e.mesh.scale.y += ((e.crouching ? 0.6 : 1) - e.mesh.scale.y) * Math.min(1, dt * 10);
    e.mesh.rotation.y = e.facingY;
    if (e.muzzleFlashT > 0) {
      e.muzzleFlash.material.opacity = e.muzzleFlashT / 55;
      e.muzzleFlashT = Math.max(0, e.muzzleFlashT - dt * 1000);
    } else e.muzzleFlash.material.opacity = 0;
    if (e.hpDrain > e.hp) e.hpDrain = Math.max(e.hp, e.hpDrain - e.maxHp * dt * 0.38);
    if (mapCell(Math.floor(e.x / CELL), Math.floor(e.z / CELL)) === 1) {
      const cx2 = Math.floor(e.x / CELL),
        cz2 = Math.floor(e.z / CELL);
      for (let r = 1; r <= 4; r++) {
        let found = false;
        for (let dc = -r; dc <= r && !found; dc++)
          for (let dr = -r; dr <= r && !found; dr++) {
            if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
            const nc = cx2 + dc,
              nr = cz2 + dr;
            if (nc >= 0 && nr >= 0 && nc < MAP_W && nr < MAP_H && MAP[nr][nc] === 0) {
              e.x = nc * CELL + CELL / 2;
              e.z = nr * CELL + CELL / 2;
              e.path = [];
              e.pathGoal = null;
              found = true;
            }
          }
        if (found) break;
      }
    }
    e.radarAge += dt;
  }
  if (activeDrone && !activeDrone.dead) updateDrone(activeDrone, dt);
}

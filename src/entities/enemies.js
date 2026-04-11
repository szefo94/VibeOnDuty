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
    patrolWp: 0,
    patrol: patrol.map(([c, r]) => [c * CELL + CELL / 2, r * CELL + CELL / 2]),
    wpWait: 0,
    bobT: Math.random() * 6,
    dead: false,
    muzzleFlashT: 0,
    radarAge: Infinity,
    crouching: false,
    crouchTimer: 0,
    velY: 0,
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
    patrolWp: 0,
    patrol: patrol.map(([c, r]) => [c * CELL + CELL / 2, r * CELL + CELL / 2]),
    wpWait: 0,
    bobT: Math.random() * 6,
    dead: false,
    muzzleFlashT: 0,
    radarAge: Infinity,
    crouching: false,
    crouchTimer: 0,
    velY: 0,
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
  if (dist > targetDist + 1) {
    d.velX += (pdx / dist) * 0.5 * dt;
    d.velZ += (pdz / dist) * 0.5 * dt;
  } else if (dist < targetDist - 1) {
    d.velX -= (pdx / dist) * 0.3 * dt;
    d.velZ -= (pdz / dist) * 0.3 * dt;
  }
  d.velX *= 1 - dt * 1.5;
  d.velZ *= 1 - dt * 1.5;
  d.x += d.velX;
  d.z += d.velZ;
  d.x = Math.max(CELL, Math.min((MAP_W - 1) * CELL, d.x));
  d.z = Math.max(CELL, Math.min((MAP_H - 1) * CELL, d.z));
  d.y = DRONE_FLY_H + Math.sin(d.floatT) * 0.4;
  d.mesh.position.set(d.x, d.y, d.z);
  d.mesh.rotation.y = Math.atan2(pdx, pdz);
  d.mesh.children.forEach((ch) => {
    if (ch.userData.isRotor) ch.rotation.y += dt * 18;
  });
  const coneDir = new THREE.Vector3(pdx, camera.position.y - d.y, pdz).normalize();
  d.cone.lookAt(d.cone.position.clone().add(coneDir));
  d.cone.material.opacity = 0.08 + Math.abs(Math.sin(d.floatT * 2)) * 0.07;
  d.eye.material.color.setHSL(
    0.55 + Math.sin(d.floatT * 3) * 0.05,
    1,
    0.6 + Math.sin(d.floatT * 5) * 0.2
  );
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
    if (e.state === 'attack' || e.state === 'spotted') {
      if (e.path.length === 0 || e.pathTick <= 0) {
        e.path = astar(e.x, e.z, camera.position.x, camera.position.z);
        if (e.path.length > 0) e.path.shift();
        e.pathTick = 600 + Math.random() * 200;
      }
      e.pathTick -= dt * 1000;
      if (e.path.length > 0 && distP > CELL * 1.4) {
        const [tx, tz] = e.path[0];
        const ddx = tx - e.x,
          ddz = tz - e.z,
          dd = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dd < 0.18) e.path.shift();
        else {
          const spd2 = ENEMY_SPEED * dt * (e.state === 'spotted' ? 0.55 : 1);
          const nx = e.x + (ddx / dd) * spd2,
            nz = e.z + (ddz / dd) * spd2;
          if (canMoveTo(nx, e.z, eGround)) e.x = nx;
          if (canMoveTo(e.x, nz, eGround)) e.z = nz;
          isMoving = true;
        }
      }
      e.facingY = slerp(e.facingY, desiredY, ENEMY_ROT_SPD, dt);
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

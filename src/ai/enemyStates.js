import * as THREE from 'three';
import {
  CELL, PLAYER_H, ENEMY_SPEED, ENEMY_ROT_SPD, ENEMY_SIGHT,
  ENEMY_SHOOT_RANGE, ENEMY_SHOOT_CD, ENEMY_DAMAGE, REACT_MIN, REACT_MAX, AIM_THRESH,
} from '../config.js';
import { hAt, canMoveTo } from '../map.js';
import { slerp, normA } from '../math.js';
import { astar } from '../astar.js';
import { camera } from '../scene.js';
import { player } from '../entities/player.js';
import { hasLOS } from '../utils/los.js';
import { triggerHitFlash, updateHUD } from '../hud/overlay.js';
import { spawnTracer } from '../fx/tracers.js';
import {
  isSndActive, getSndBombPos, getSndSitePositions, getSndPlantRange,
  getSndDefuseRange, getPlayerRole, markEnemyDefusing, markEnemyPlanting,
} from '../modes/snd.js';

// ctx shape: { ts, dt, eGround, canSee, distP, pdx, pdz, desiredY,
//              enemies, killEnemy, triggerDeath }

const WP_WAITS = [600, 1200, 500, 900, 1000, 500];

// ── Transitions ───────────────────────────────────────────────────────────

export function transitionTo(e, newState, ctx) {
  e._aiState?.exit?.(e, ctx);
  e._aiState = newState;
  e.state    = newState.name;
  newState.enter?.(e, ctx);
}

export function initEnemyState(e) {
  e._aiState = PATROL_STATE;
  e.state    = 'patrol';
}

// Used by shoot.js, grenades.js to instantly alert an enemy
export function alertEnemy(e) {
  if (e._aiState !== ATTACK_STATE) transitionTo(e, ATTACK_STATE);
  e.alertTimer  = 9000;
  e.reactDelay  = 0;
}

// Used by drone.js — softer alert: spotted but not yet fully engaged
export function semiAlertEnemy(e) {
  if (e._aiState === PATROL_STATE) {
    transitionTo(e, SPOTTED_STATE);
    e.reactDelay = Math.min(e.reactDelay ?? Infinity, 400);
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────

// Runs path-finding, S&D actions, bot-vs-bot shooting, movement, rotation.
// Returns isMoving.
function _tickMovement(e, dt, ctx, speedMult, rotMult) {
  const { ts, eGround, pdx, pdz, distP } = ctx;
  const bombPos        = getSndBombPos();
  const isEnemyAtk     = isSndActive() && e.sndTeam === 'enemy' && getPlayerRole() === 'defend';
  const sitePos        = isEnemyAtk ? getSndSitePositions()[e.sndSiteAttack ?? 0] : null;
  const goalX          = sitePos ? sitePos[0] : bombPos ? bombPos[0] : camera.position.x;
  const goalZ          = sitePos ? sitePos[1] : bombPos ? bombPos[1] : camera.position.z;
  const goalCell       = [Math.floor(goalX / CELL), Math.floor(goalZ / CELL)];
  const goalChanged    = !e.pathGoal || e.pathGoal[0] !== goalCell[0] || e.pathGoal[1] !== goalCell[1];

  if (e.path.length === 0 || e.pathTick <= 0 || goalChanged) {
    e.path = astar(e.x, e.z, goalX, goalZ);
    if (e.path.length > 0) e.path.shift();
    e.pathTick = 600 + Math.random() * 200;
    e.pathGoal = goalCell;
  }
  e.pathTick -= dt * 1000;

  // S&D: enemy defuse / plant marks
  if (bombPos) {
    const defR = getSndDefuseRange();
    const bdx = e.x - bombPos[0], bdz = e.z - bombPos[1];
    if (bdx * bdx + bdz * bdz < defR * defR) markEnemyDefusing();
  }
  if (isEnemyAtk && sitePos && !bombPos) {
    const pr = getSndPlantRange();
    const sdx = e.x - sitePos[0], sdz = e.z - sitePos[1];
    if (sdx * sdx + sdz * sdz < pr * pr) markEnemyPlanting(e.x, e.z);
  }

  // Bot-vs-bot shooting (S&D)
  if (isSndActive() && ts - (e.botShootCd ?? 0) > ENEMY_SHOOT_CD) {
    for (const friend of ctx.enemies) {
      if (friend.dead || friend.sndTeam !== 'friend') continue;
      const fdx = friend.x - e.x, fdz = friend.z - e.z;
      if (fdx * fdx + fdz * fdz > ENEMY_SHOOT_RANGE * ENEMY_SHOOT_RANGE) continue;
      const fGround = hAt(Math.floor(friend.x / CELL), Math.floor(friend.z / CELL));
      if (!hasLOS(e.x, eGround + PLAYER_H * 0.85, e.z, friend.x, fGround + PLAYER_H * 0.85, friend.z)) continue;
      e.botShootCd   = ts;
      e.muzzleFlashT = 55;
      friend.takeDamage(ENEMY_DAMAGE + Math.floor(Math.random() * 7), ctx.killEnemy);
      break;
    }
  }

  // Path-following movement
  const goalDist = bombPos ? Math.sqrt((e.x - goalX) ** 2 + (e.z - goalZ) ** 2) : distP;
  let isMoving = false;
  if (e.path.length > 0 && goalDist > CELL * 1.4) {
    const [tx, tz] = e.path[0];
    const ddx = tx - e.x, ddz = tz - e.z, dd = Math.sqrt(ddx * ddx + ddz * ddz);
    if (dd < 0.18) {
      e.path.shift();
    } else {
      const spd = ENEMY_SPEED * speedMult;
      e.velX += ((ddx / dd) * spd - e.velX) * 12 * dt;
      e.velZ += ((ddz / dd) * spd - e.velZ) * 12 * dt;
      const nx = e.x + e.velX * dt, nz = e.z + e.velZ * dt;
      if (canMoveTo(nx, e.z, eGround)) e.x = nx;
      if (canMoveTo(e.x, nz, eGround)) e.z = nz;
      isMoving = true;
    }
  } else {
    e.velX *= 1 - 10 * dt;
    e.velZ *= 1 - 10 * dt;
  }

  // Rotation — face bomb when rushing it, otherwise face player
  const faceX = bombPos ? bombPos[0] : camera.position.x;
  const faceZ = bombPos ? bombPos[1] : camera.position.z;
  e.facingY = slerp(e.facingY, Math.atan2(-(faceX - e.x), -(faceZ - e.z)), ENEMY_ROT_SPD * rotMult, dt);

  return isMoving;
}

function _tickPlayerShoot(e, ctx) {
  const { ts, eGround, canSee, distP, desiredY } = ctx;
  if (getSndBombPos()) return;                                    // rushing bomb — don't stop
  if (distP >= ENEMY_SHOOT_RANGE || !canSee) return;
  if (Math.abs(normA(e.facingY - desiredY)) >= AIM_THRESH) return;
  if (ts - e.shootCd <= ENEMY_SHOOT_CD) return;
  if (!hasLOS(e.x, eGround + PLAYER_H * 0.85, e.z, camera.position.x, camera.position.y, camera.position.z)) return;

  e.shootCd = ts;
  player.hp = Math.max(0, player.hp - ENEMY_DAMAGE - Math.floor(Math.random() * 7));
  triggerHitFlash();
  updateHUD();
  if (player.hp <= 0) ctx.triggerDeath();
  e.muzzleFlashT = 55;
  spawnTracer(
    new THREE.Vector3(0.295, 1.19, -0.52).applyMatrix4(e.mesh.matrixWorld),
    camera.position.clone()
  );
}

// ── States ────────────────────────────────────────────────────────────────

export const PATROL_STATE = {
  name: 'patrol',
  enter(e) { e.path = []; e.pathGoal = null; },
  tick(e, dt, ctx) {
    if (ctx.canSee) {
      e.alertTimer = 9000;
      transitionTo(e, SPOTTED_STATE, ctx);
      return false;
    }
    e.velX *= 1 - 10 * dt;
    e.velZ *= 1 - 10 * dt;
    let isMoving = false;
    if (e.wpWait > 0) {
      e.wpWait = Math.max(0, e.wpWait - dt * 1000);
      e.facingY += dt * 0.55 * Math.sin(performance.now() / 820 + e.bobT);
    } else {
      const wp  = e.patrol[e.patrolWp];
      const ddx = wp[0] - e.x, ddz = wp[1] - e.z, dd = Math.sqrt(ddx * ddx + ddz * ddz);
      if (dd < 0.22) {
        e.patrolWp = (e.patrolWp + 1) % e.patrol.length;
        e.wpWait   = WP_WAITS[e.patrolWp % WP_WAITS.length];
      } else {
        const spd2 = ENEMY_SPEED * 0.42 * dt;
        const nx = e.x + (ddx / dd) * spd2, nz = e.z + (ddz / dd) * spd2;
        if (canMoveTo(nx, e.z, ctx.eGround)) e.x = nx;
        if (canMoveTo(e.x, nz, ctx.eGround)) e.z = nz;
        e.facingY = slerp(e.facingY, Math.atan2(-ddx, -ddz), ENEMY_ROT_SPD * 0.5, dt);
        isMoving = true;
      }
    }
    return isMoving;
  },
  exit() {},
};

export const SPOTTED_STATE = {
  name: 'spotted',
  enter(e) { e.reactDelay = REACT_MIN + Math.random() * (REACT_MAX - REACT_MIN); },
  tick(e, dt, ctx) {
    if (ctx.canSee) {
      e.alertTimer = 9000;
      transitionTo(e, ATTACK_STATE, ctx);
      return false;
    }
    e.alertTimer = Math.max(0, e.alertTimer - dt * 1000);
    if (e.alertTimer <= 0) { transitionTo(e, PATROL_STATE, ctx); return false; }
    e.reactDelay = Math.max(0, e.reactDelay - dt * 1000);
    if (e.reactDelay <= 0) { transitionTo(e, ATTACK_STATE, ctx); return false; }
    return _tickMovement(e, dt, ctx, 0.55, 1.0);
  },
  exit() {},
};

export const ATTACK_STATE = {
  name: 'attack',
  enter() {},
  tick(e, dt, ctx) {
    if (ctx.canSee) {
      e.alertTimer = 9000;
    } else {
      e.alertTimer = Math.max(0, e.alertTimer - dt * 1000);
      if (e.alertTimer <= 0) { transitionTo(e, PATROL_STATE, ctx); return false; }
    }
    const isMoving = _tickMovement(e, dt, ctx, 1.0, 2.5);
    _tickPlayerShoot(e, ctx);
    return isMoving;
  },
  exit() {},
};

export const STATE_MAP = {
  patrol:  PATROL_STATE,
  spotted: SPOTTED_STATE,
  attack:  ATTACK_STATE,
};

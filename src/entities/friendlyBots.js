import { CELL, PLAYER_H, ENEMY_SPEED, ENEMY_ROT_SPD, ENEMY_SHOOT_RANGE, ENEMY_SHOOT_CD, ENEMY_DAMAGE } from '../config.js';
import { MAP_W, MAP_H, MAP, isRamp, hAt, canMoveTo } from '../map.js';
import { slerp } from '../math.js';
import { astar } from '../astar.js';
import { hasLOS } from '../utils/los.js';
import { tickEnemyAnimation } from '../builders/enemyAnimations.js';
import { getSndBombPos, getSndSitePositions } from '../modes/snd.js';
import { getMode } from '../modes/modeManager.js';

// ── Shared helpers ────────────────────────────────────────────────────────

function _moveTo(e, tgX, tgZ, eGround, dt) {
  const goalDist = Math.sqrt((e.x - tgX) ** 2 + (e.z - tgZ) ** 2);

  if (!e.pathGoal || e.pathGoal[0] !== Math.floor(tgX / CELL) || e.pathGoal[1] !== Math.floor(tgZ / CELL) || e.path.length === 0) {
    e.path     = astar(e.x, e.z, tgX, tgZ);
    if (e.path.length > 0) e.path.shift();
    e.pathGoal = [Math.floor(tgX / CELL), Math.floor(tgZ / CELL)];
    e.pathTick = 800;
  }
  e.pathTick = Math.max(0, (e.pathTick ?? 0) - dt * 1000);
  if (e.pathTick <= 0) { e.path = []; e.pathGoal = null; }

  if (e.path.length > 0 && goalDist > CELL * 0.9) {
    const [wx, wz] = e.path[0];
    const dx = wx - e.x, dz = wz - e.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.2) { e.path.shift(); return false; }
    const spd = ENEMY_SPEED * 0.85;
    e.velX += (dx / d * spd - e.velX) * 12 * dt;
    e.velZ += (dz / d * spd - e.velZ) * 12 * dt;
    if (canMoveTo(e.x + e.velX * dt, e.z, eGround)) e.x += e.velX * dt;
    if (canMoveTo(e.x, e.z + e.velZ * dt, eGround)) e.z += e.velZ * dt;
    e.facingY = slerp(e.facingY, Math.atan2(-e.velX, -e.velZ), ENEMY_ROT_SPD, dt);
    return true;
  }
  e.velX *= 1 - 8 * dt;
  e.velZ *= 1 - 8 * dt;
  return false;
}

function _tryShoot(e, eGround, allEnemies, killEnemy) {
  e.shootCd = Math.max(0, (e.shootCd ?? 0) - 1);
  if (e.shootCd > 0) return;
  for (const target of allEnemies) {
    if (target.dead || target.sndTeam !== 'enemy') continue;
    const dx = target.x - e.x, dz = target.z - e.z;
    if (dx * dx + dz * dz > ENEMY_SHOOT_RANGE * ENEMY_SHOOT_RANGE) continue;
    const tGround = hAt(Math.floor(target.x / CELL), Math.floor(target.z / CELL));
    if (!hasLOS(e.x, eGround + PLAYER_H * 0.85, e.z, target.x, tGround + PLAYER_H * 0.85, target.z)) continue;
    e.shootCd      = ENEMY_SHOOT_CD;
    e.facingY      = Math.atan2(e.x - target.x, e.z - target.z);
    e.muzzleFlashT = 55;
    target.takeDamage(ENEMY_DAMAGE, killEnemy);
    break;
  }
}

function _updateMesh(e, eGround, isMoving, dt) {
  tickEnemyAnimation(e, dt, isMoving);
  e.bobT += dt * 1.6;
  const meshY = eGround + (isMoving ? Math.abs(Math.sin(e.bobT)) * 0.022 : 0);
  e.mesh.position.set(e.x, meshY, e.z);
  e.mesh.rotation.y = e.facingY + (e.facingOffset ?? 0);
  e.mesh.scale.y = 1;
  if (e._friendIndicator) {
    e._friendIndicator.position.set(e.x, meshY + 2.2, e.z);
    e._friendIndicator.rotation.y += dt * 1.2;
    e._friendIndicator.visible = !e.dead;
  }
  e.radarAge += dt;
}

// ── S&D tick: escort bomb / rush site ────────────────────────────────────

function _tickSnd(e, dt, allEnemies, killEnemy) {
  const eGround = hAt(Math.floor(e.x / CELL), Math.floor(e.z / CELL));
  const bombPos = getSndBombPos();
  const sites   = getSndSitePositions();
  const [tgX, tgZ] = bombPos ?? sites[e.sndSiteTarget ?? 0];
  const isMoving = _moveTo(e, tgX, tgZ, eGround, dt);
  _tryShoot(e, eGround, allEnemies, killEnemy);
  _updateMesh(e, eGround, isMoving, dt);
}

// ── TDM tick: hunt nearest enemy, scout map when none visible ────────────

function _pickScoutTarget() {
  for (let tries = 0; tries < 30; tries++) {
    const c = 1 + Math.floor(Math.random() * (MAP_W - 2));
    const r = 1 + Math.floor(Math.random() * (MAP_H - 2));
    if (MAP[r]?.[c] === 0 || isRamp(MAP[r]?.[c])) {
      return [c * CELL + CELL / 2, r * CELL + CELL / 2];
    }
  }
  return null;
}

function _tickTdm(e, dt, allEnemies, killEnemy) {
  const eGround = hAt(Math.floor(e.x / CELL), Math.floor(e.z / CELL));

  // Find nearest living enemy bot
  let nearestEnemy = null, nearestDist = Infinity;
  for (const t of allEnemies) {
    if (t.dead || t.sndTeam !== 'enemy') continue;
    const d = (t.x - e.x) ** 2 + (t.z - e.z) ** 2;
    if (d < nearestDist) { nearestDist = d; nearestEnemy = t; }
  }

  let tgX, tgZ;
  if (nearestEnemy) {
    tgX = nearestEnemy.x;
    tgZ = nearestEnemy.z;
    // Re-scout when the enemy we were chasing dies
    e._scoutTarget = null;
  } else {
    // No enemies alive — pick a random walkable cell to scout
    if (!e._scoutTarget) e._scoutTarget = _pickScoutTarget();
    if (e._scoutTarget) {
      [tgX, tgZ] = e._scoutTarget;
      const arrived = (e.x - tgX) ** 2 + (e.z - tgZ) ** 2 < (CELL * 1.2) ** 2;
      if (arrived) e._scoutTarget = null;
    } else {
      tgX = e.x; tgZ = e.z;
    }
  }

  const isMoving = _moveTo(e, tgX, tgZ, eGround, dt);
  _tryShoot(e, eGround, allEnemies, killEnemy);
  _updateMesh(e, eGround, isMoving, dt);
}

// ── Public entry point ────────────────────────────────────────────────────

export function tickFriendlyBot(e, dt, allEnemies, killEnemy) {
  if (e.dead) return;
  if (getMode()?.name === 'tdm') {
    _tickTdm(e, dt, allEnemies, killEnemy);
  } else {
    _tickSnd(e, dt, allEnemies, killEnemy);
  }
}

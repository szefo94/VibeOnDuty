import { CELL, PLAYER_H, ENEMY_SPEED, ENEMY_ROT_SPD, ENEMY_SHOOT_RANGE, ENEMY_SHOOT_CD, ENEMY_DAMAGE } from '../config.js';
import { hAt, canMoveTo } from '../map.js';
import { slerp } from '../math.js';
import { astar } from '../astar.js';
import { hasLOS } from '../utils/los.js';
import { tickEnemyAnimation } from '../builders/enemyAnimations.js';
import { getSndBombPos, getSndSitePositions } from '../modes/snd.js';

// allEnemies + killEnemy injected by enemies.js to avoid a circular import
export function tickFriendlyBot(e, dt, allEnemies, killEnemy) {
  if (e.dead) return;

  // ── Pathfind toward active bomb or assigned site ─────────────────
  const bombPos = getSndBombPos();
  const sites   = getSndSitePositions();
  const [tgX, tgZ] = bombPos ?? sites[e.sndSiteTarget ?? 0];
  const goalCell   = [Math.floor(tgX / CELL), Math.floor(tgZ / CELL)];
  const goalDist   = Math.sqrt((e.x - tgX) ** 2 + (e.z - tgZ) ** 2);

  if (!e.pathGoal || e.pathGoal[0] !== goalCell[0] || e.pathGoal[1] !== goalCell[1] || e.path.length === 0) {
    e.path     = astar(e.x, e.z, tgX, tgZ);
    if (e.path.length > 0) e.path.shift();
    e.pathGoal = goalCell;
    e.pathTick = 800;
  }
  e.pathTick = Math.max(0, (e.pathTick ?? 0) - dt * 1000);
  if (e.pathTick <= 0) { e.path = []; e.pathGoal = null; }

  let isMoving = false;
  const eGround = hAt(Math.floor(e.x / CELL), Math.floor(e.z / CELL));
  if (e.path.length > 0 && goalDist > CELL * 0.9) {
    const [wx, wz] = e.path[0];
    const dx = wx - e.x, dz = wz - e.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.2) {
      e.path.shift();
    } else {
      const spd = ENEMY_SPEED * 0.85;
      e.velX += (dx / d * spd - e.velX) * 12 * dt;
      e.velZ += (dz / d * spd - e.velZ) * 12 * dt;
      if (canMoveTo(e.x + e.velX * dt, e.z, eGround)) e.x += e.velX * dt;
      if (canMoveTo(e.x, e.z + e.velZ * dt, eGround)) e.z += e.velZ * dt;
      e.facingY = slerp(e.facingY, Math.atan2(-e.velX, -e.velZ), ENEMY_ROT_SPD, dt);
      isMoving = true;
    }
  } else {
    e.velX *= 1 - 8 * dt;
    e.velZ *= 1 - 8 * dt;
  }

  // ── Shoot nearby enemy-team bots ────────────────────────────────
  e.shootCd = Math.max(0, (e.shootCd ?? 0) - dt * 1000);
  if (e.shootCd <= 0) {
    for (const target of allEnemies) {
      if (target.dead || target.sndTeam !== 'enemy') continue;
      const dx = target.x - e.x, dz = target.z - e.z;
      if (dx * dx + dz * dz > ENEMY_SHOOT_RANGE * ENEMY_SHOOT_RANGE) continue;
      const tGround = hAt(Math.floor(target.x / CELL), Math.floor(target.z / CELL));
      if (!hasLOS(e.x, eGround + PLAYER_H * 0.85, e.z, target.x, tGround + PLAYER_H * 0.85, target.z)) continue;
      e.shootCd  = ENEMY_SHOOT_CD;
      e.facingY  = Math.atan2(e.x - target.x, e.z - target.z);
      e.muzzleFlashT = 55;
      target.takeDamage(ENEMY_DAMAGE, killEnemy);
      break;
    }
  }

  // ── Animation + mesh ────────────────────────────────────────────
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

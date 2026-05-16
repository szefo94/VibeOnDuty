import { scene, camera } from '../scene.js';
import { CELL, PLAYER_H, ENEMY_SIGHT, GRAVITY } from '../config.js';
import { getDifficulty } from '../difficulty.js';
import { MAP_W, MAP_H, MAP, mapCell, canMoveTo, hAt, worldToCell } from '../map.js';
import { tickEnemyAnimation } from '../builders/enemyAnimations.js';
import { tickFriendlyBot } from './friendlyBots.js';
import { hasLOS } from '../utils/los.js';
import { player } from './player.js';
import { isAnyModeActive } from '../modes/modeManager.js';
import { STATE_MAP, PATROL_STATE } from '../ai/enemyStates.js';
import { applyDrag } from '../math.js';
import { enemies, killEnemy, triggerDeath, dyingEnemies } from './enemies.js';

export function updateEnemies(ts, dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (isAnyModeActive() && e.sndTeam === 'friend') { tickFriendlyBot(e, dt, enemies, killEnemy); continue; }
    const pdx = camera.position.x - e.x,
      pdz = camera.position.z - e.z;
    const distP = Math.sqrt(pdx * pdx + pdz * pdz);
    const eGround = hAt(...worldToCell(e.x, e.z));
    const canSee =
      distP < getDifficulty().sight &&
      hasLOS(
        e.x,
        eGround + PLAYER_H * 0.9,
        e.z,
        camera.position.x,
        camera.position.y,
        camera.position.z
      );
    const desiredY = Math.atan2(-pdx, -pdz);

    // Sync _aiState if external code mutated e.state (e.g. via alertEnemy in an event handler)
    if (e._aiState?.name !== e.state) {
      const next = STATE_MAP[e.state];
      if (!next && import.meta.env.DEV) console.warn(`[Enemy] unknown state "${e.state}", resetting to patrol`);
      e._aiState = next ?? PATROL_STATE;
      e.state    = e._aiState.name;
    }

    let isMoving = false;
    if (e.stunTimer > 0) {
      e.stunTimer = Math.max(0, e.stunTimer - dt);
      e.velX = applyDrag(e.velX, 8, dt);
      e.velZ = applyDrag(e.velZ, 8, dt);
      const nx = e.x + e.velX * dt;
      const nz = e.z + e.velZ * dt;
      if (canMoveTo(nx, e.z, eGround)) e.x = nx;
      if (canMoveTo(e.x, nz, eGround)) e.z = nz;
    } else if (e.state === 'patrol' && distP > ENEMY_SIGHT * 2) {
      // Cull AI tick for distant patrollers — imperceptible at this range
    } else {
      const ctx = { ts, dt, eGround, canSee, distP, pdx, pdz, desiredY, enemies, killEnemy, triggerDeath };
      isMoving = e._aiState.tick(e, dt, ctx) ?? false;
    }

    tickEnemyAnimation(e, dt, isMoving);
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
      if (e.onGround && e.jumpCd <= 0 && Math.random() < 0.0008) {
        e.velY = 5.5;
        e.onGround = false;
        e.jumpCd = 10 + Math.random() * 8;
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
    // crOff compensates for procedural mesh pivot being at centre (scale squash pulls it up).
    // GLTF pivot is at the feet, so no offset needed — animation handles crouch visually.
    const crOff = (!e.facingOffset && e.crouching) ? -0.45 : 0;
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
    // GLTF enemies use Crouch_Idle_Loop/Crouch_Fwd_Loop — skip Y-squash so the rig doesn't deform
    if (!e.facingOffset) {
      e.mesh.scale.y += ((e.crouching ? 0.6 : 1) - e.mesh.scale.y) * Math.min(1, dt * 10);
    } else {
      e.mesh.scale.y = 1;
    }
    e.mesh.rotation.y = e.facingY + (e.facingOffset ?? 0);
    if (e.muzzleFlashT > 0) {
      e.muzzleFlash.material.opacity = e.muzzleFlashT / 55;
      e.muzzleFlashT = Math.max(0, e.muzzleFlashT - dt * 1000);
    } else e.muzzleFlash.material.opacity = 0;
    if (e.hpDrain > e.hp) e.hpDrain = Math.max(e.hp, e.hpDrain - e.maxHp * dt * 0.38);
    const [cx2, cz2] = worldToCell(e.x, e.z);
    if (mapCell(cx2, cz2) === 1) {
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
  // ── Tick dying enemies (death animation plays, then mesh removed) ─────────
  for (let i = dyingEnemies.length - 1; i >= 0; i--) {
    const de = dyingEnemies[i];
    de.mixer.update(dt);
    de.timer -= dt;
    if (de.timer <= 0) {
      scene.remove(de.mesh);
      dyingEnemies.splice(i, 1);
    }
  }
}

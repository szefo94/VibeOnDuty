import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { applyEntityBase } from './entityBase.js';
import { initEnemyState, alertEnemy, STATE_MAP, PATROL_STATE } from '../ai/enemyStates.js';
import { CELL, PLAYER_H, ENEMY_HP, ENEMY_SIGHT, GRAVITY } from '../config.js';
import { MAP_W, MAP_H, MAP, isRamp, mapCell, canMoveTo, hAt } from '../map.js';
import { buildEnemyMesh } from '../builders/enemyGLTF.js';
import { crossfade, tickEnemyAnimation } from '../builders/enemyAnimations.js';
import { tickFriendlyBot } from './friendlyBots.js';
import { hasLOS } from '../utils/los.js';
import { player } from './player.js';
import { spawnAmmoDrop } from './ammoDrops.js';
import { showMsg, showKillFeed } from '../hud/overlay.js';
import { setGameRunning } from '../input.js';
import { isAnyModeActive } from '../modes/modeManager.js';
import { wave } from './waveSystem.js';
import { on, emit } from '../events.js';

// S&D API injected at runtime via 'snd:configure' event (avoids circular dep).
let _snd = null;
on('snd:configure', api => { _snd = api; });

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
const NUM_ENEMIES = 10;

// ── Enemies array ─────────────────────────────────────────────────
/**
 * @param {import('../../types/entities').Enemy} e
 * @param {[number,number]|null} [forcedCell]
 */
export function spawnEnemyIntoSlot(e, forcedCell = null) {
  if (e.mesh) scene.remove(e.mesh);
  if (e.mixer) e.mixer.stopAllAction();
  let mc, mr;
  if (forcedCell) {
    [mc, mr] = forcedCell;
  } else {
    const used = enemies
      .filter((en) => en !== e && !en.dead)
      .map((en) => [Math.floor(en.x / CELL), Math.floor(en.z / CELL)]);
    [mc, mr] = randomSpawnCell(used);
  }
  const patrol = randomPatrol(mc, mr, 2);
  const { mesh, muzzleFlash, mixer, actions, facingOffset = 0 } = buildEnemyMesh(
    mc * CELL + CELL / 2,
    mr * CELL + CELL / 2
  );
  Object.assign(e, {
    mesh,
    muzzleFlash,
    mixer,
    actions,
    facingOffset,
    currentClip: 'idle',
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
    jumpPhase: '',
    jumpPhaseTimer: 0,
  });
  applyEntityBase(e);
  initEnemyState(e);
}

const usedCells = [];
export const enemies = Array.from({ length: NUM_ENEMIES }, (_) => {
  const [mc, mr] = randomSpawnCell(usedCells);
  usedCells.push([mc, mr]);
  const patrol = randomPatrol(mc, mr, 2);
  const { mesh, muzzleFlash, mixer, actions, facingOffset = 0 } = buildEnemyMesh(
    mc * CELL + CELL / 2,
    mr * CELL + CELL / 2
  );
  return {
    mesh,
    muzzleFlash,
    mixer,
    actions,
    facingOffset,
    currentClip: 'idle',
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
    jumpPhase: '',
    jumpPhaseTimer: 0,
  };
});

// ── Rebuild all enemies with the current buildEnemyMesh (call after GLTF loads) ──
// Pass sndSitePositions when S&D is already active so GLTF reload doesn't scatter defenders.
export function rebuildAllEnemies(sndSitePositions = null) {
  if (sndSitePositions) {
    spawnSndEnemies(sndSitePositions);
  } else {
    enemies.forEach((e) => spawnEnemyIntoSlot(e));
  }
}

// ── S&D spawn helpers ─────────────────────────────────────────────────────
// East interior cells — player attack spawn + enemy attack spawn (role=defend)
const ATTACKER_SLOTS = [[15,10],[16,10],[17,10],[15,12],[17,12]];
// Defender spawn offsets relative to site cell (for enemy defenders when player attacks)
const SND_DEF_OFFSETS = [
  [0,-1],[1,-1],   // site A (i=0,1)
  [0, 0],[1, 0],[-1,0], // site B (i=2,3,4)
];
// Friendly defender slots near sites (for friendly bots when player defends)
const DEFENDER_FRIEND_OFFSETS = [
  [-1,0],[0,-1],[1,0],   // near site A
  [-1,0],[0,-1],         // near site B
];

function openNear(cx, cz) {
  const cc = Math.max(1, Math.min(MAP_W - 2, cx));
  const cr = Math.max(1, Math.min(MAP_H - 2, cz));
  const c = MAP[cr][cc];
  return (c === 0 || isRamp(c)) ? [cc, cr] : [Math.floor(cx), Math.floor(cz)];
}

export function spawnSndEnemies(sitePositions) {
  const role = _snd?.getPlayerRole() ?? 'attack';
  const NUM_FRIENDS = 5;
  enemies.forEach((e, i) => {
    if (i < NUM_FRIENDS) {
      // ── Friendly team ──
      if (role === 'attack') {
        // Rush to sites with player (east side)
        spawnEnemyIntoSlot(e, ATTACKER_SLOTS[i % ATTACKER_SLOTS.length]);
      } else {
        // Defend near sites
        const siteIdx = i < 3 ? 0 : 1;
        const [sx, sz] = sitePositions[siteIdx];
        const [dc, dr] = DEFENDER_FRIEND_OFFSETS[i];
        const [fc, fr] = openNear(Math.floor(sx / CELL) + dc, Math.floor(sz / CELL) + dr);
        spawnEnemyIntoSlot(e, [fc, fr]);
      }
      e.sndTeam = 'friend';
      e.sndSiteTarget = i % 2;
      // Remove old world-space indicator before creating fresh one
      if (e._friendIndicator) { scene.remove(e._friendIndicator); e._friendIndicator = null; }
      const ind = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.45, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ccff, depthTest: false })
      );
      // Parented to scene (world-space) so GLTF scale/hierarchy doesn't affect it
      scene.add(ind);
      e._friendIndicator = ind;
    } else {
      // ── Enemy team ──
      const j = i - NUM_FRIENDS;
      if (role === 'attack') {
        // Defenders at sites
        const siteIdx = j < 2 ? 0 : 1;
        const [sx, sz] = sitePositions[siteIdx];
        const [dc, dr] = SND_DEF_OFFSETS[j];
        const [fc, fr] = openNear(Math.floor(sx / CELL) + dc, Math.floor(sz / CELL) + dr);
        spawnEnemyIntoSlot(e, [fc, fr]);
      } else {
        // Attackers — spawn east side, rush sites
        spawnEnemyIntoSlot(e, ATTACKER_SLOTS[j % ATTACKER_SLOTS.length]);
        alertEnemy(e);
      }
      e.sndTeam = 'enemy';
      e.sndSiteAttack = j < 3 ? 0 : 1;
      if (e._friendIndicator) { scene.remove(e._friendIndicator); e._friendIndicator = null; }
    }
  });
}

// ── triggerDeath lives here because it reads wave ─────────────────
export function triggerDeath() {
  player.dead = true;
  if (isAnyModeActive()) {
    document.exitPointerLock?.();
    const allFriendsDead = enemies.every((en) => en.dead || en.sndTeam !== 'friend');
    if (allFriendsDead) emit('round:friendTeamWiped');
    // else game continues — friendlies still alive
    return;
  }
  setGameRunning(false);
  document.exitPointerLock?.();
  const ov = document.getElementById('overlay');
  ov.style.display = 'flex';
  ov.innerHTML = `<div class="dead-h">KILLED IN ACTION</div><div class="stat">Kills: ${player.kills}</div><div class="stat" style="color:#333;margin-top:6px">Wave ${wave} — the vibes remain hostile</div><button onclick="location.reload()" style="margin-top:28px;padding:12px 52px;background:#e74c3c;color:#fff;border:none;font-family:'Courier New',monospace;font-size:14px;letter-spacing:4px;cursor:pointer">[ REDEPLOY ]</button>`;
}

// ── Dying list — dead enemies whose death animation still needs to play ──
const dyingEnemies = [];

// ── Kill functions ────────────────────────────────────────────────
export function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  if (e.sndTeam === 'friend') {
    // Hide indicator immediately on death
    if (e._friendIndicator) e._friendIndicator.visible = false;
    // Play death animation for friendly bots just like enemy bots
    if (e.actions && e.actions.death) {
      const dyingMesh = e.mesh, dyingMixer = e.mixer;
      crossfade(e, 'death', 0);
      dyingEnemies.push({ mesh: dyingMesh, mixer: dyingMixer, timer: 2.2 });
    } else {
      scene.remove(e.mesh);
    }
    if (isAnyModeActive() && player.dead && enemies.every((en) => en.dead || en.sndTeam !== 'friend'))
      emit('round:friendTeamWiped');
    return;
  }
  player.kills++;
  document.getElementById('kills-num').textContent = player.kills;
  showMsg('ENEMY DOWN');
  showKillFeed('ENEMY');
  spawnAmmoDrop(e.x, e.z);

  if (e.actions && e.actions.death) {
    // Snapshot mesh+mixer NOW — spawnEnemyIntoSlot may overwrite e.mesh/e.mixer next round
    const dyingMesh = e.mesh, dyingMixer = e.mixer;
    crossfade(e, 'death', 0);
    dyingEnemies.push({ mesh: dyingMesh, mixer: dyingMixer, timer: 2.2 });
  } else {
    scene.remove(e.mesh);
  }

  if (isAnyModeActive()) {
    if (enemies.every((en) => en.dead || en.sndTeam !== 'enemy')) emit('round:enemyTeamWiped');
    return;
  }
  if (enemies.every((en) => en.dead)) emit('wave:end');
}

// ── Enemy AI ──────────────────────────────────────────────────────

export function updateEnemies(ts, dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (isAnyModeActive() && e.sndTeam === 'friend') { tickFriendlyBot(e, dt, enemies, killEnemy); continue; }
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
    const desiredY = Math.atan2(-pdx, -pdz);

    // Sync _aiState if external code mutated e.state (e.g. shoot.js alertEnemy)
    if (e._aiState?.name !== e.state) {
      const next = STATE_MAP[e.state];
      if (!next && import.meta.env.DEV) console.warn(`[Enemy] unknown state "${e.state}", resetting to patrol`);
      e._aiState = next ?? PATROL_STATE;
      e.state    = e._aiState.name;
    }

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
    } else if (e.state === 'patrol' && distP > ENEMY_SIGHT * 2) {
      // ── Cull AI tick for distant patrollers — imperceptible at this range
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
      e.mesh.scale.y = 1; // always 1 for GLTF; animation handles the visual
    }
    e.mesh.rotation.y = e.facingY + (e.facingOffset ?? 0);
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
  // ── Tick dying enemies (death animation plays, then mesh removed) ─
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

import * as THREE from 'three';
import { scene } from '../scene.js';
import { applyEntityBase } from './entityBase.js';
import { initEnemyState } from '../ai/enemyStates.js';
import { CELL } from '../config.js';
import { getDifficulty } from '../difficulty.js';
import { MAP_W, MAP_H, MAP, isRamp, worldToCell } from '../map.js';
import { buildEnemyMesh } from '../builders/enemyGLTF.js';
import { crossfade } from '../builders/enemyAnimations.js';
import { player } from './player.js';
import { spawnAmmoDrop } from './ammoDrops.js';
import { showMsg, showKillFeed } from '../hud/overlay.js';
import { setGameRunning } from '../input.js';
import { isAnyModeActive, getMode } from '../modes/modeManager.js';
import { wave } from './waveSystem.js';
import { emit } from '../events.js';
import { startKillcam } from '../replay/killcam.js';
import { getSummary } from '../replay/damageTracker.js';

// ── Friend indicator ──────────────────────────────────────────────────────
const _indGeo = new THREE.ConeGeometry(0.22, 0.45, 8);
const _indMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, depthTest: false });
function _attachFriendIndicator(e) {
  if (e._friendIndicator) scene.remove(e._friendIndicator);
  const ind = new THREE.Mesh(_indGeo, _indMat);
  scene.add(ind);
  e._friendIndicator = ind;
}

export function restoreFriendIndicator(e) {
  if (e._friendIndicator) e._friendIndicator.visible = true;
  else _attachFriendIndicator(e);
}

// ── Walkable cells ────────────────────────────────────────────────────────
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

// ── Weapon roles ──────────────────────────────────────────────────────────
const _RAND_ROLES = ['assault', 'assault', 'assault', 'smg', 'smg', 'sniper'];
function randomRole() { return _RAND_ROLES[Math.floor(Math.random() * _RAND_ROLES.length)]; }

// ── Enemy pool ────────────────────────────────────────────────────────────
/**
 * @param {import('../../types/entities').Enemy} e
 * @param {[number,number]|null} [forcedCell]
 */
export function spawnEnemyIntoSlot(e, forcedCell = null, role = null) {
  role = role ?? e.weaponRole ?? randomRole();
  if (e.mesh) scene.remove(e.mesh);
  if (e.mixer) e.mixer.stopAllAction();
  let mc, mr;
  if (forcedCell) {
    [mc, mr] = forcedCell;
  } else {
    const used = enemies
      .filter((en) => en !== e && !en.dead)
      .map((en) => worldToCell(en.x, en.z));
    [mc, mr] = randomSpawnCell(used);
  }
  const patrol = randomPatrol(mc, mr, 2);
  const { mesh, muzzleFlash, mixer, actions, facingOffset = 0 } = buildEnemyMesh(
    mc * CELL + CELL / 2,
    mr * CELL + CELL / 2,
    role
  );
  Object.assign(e, {
    mesh,
    muzzleFlash,
    mixer,
    actions,
    facingOffset,
    weaponRole: role,
    currentClip: 'idle',
    x: mc * CELL + CELL / 2,
    z: mr * CELL + CELL / 2,
    hp: getDifficulty().hp,
    maxHp: getDifficulty().hp,
    hpDrain: getDifficulty().hp,
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
  const role = randomRole();
  const { mesh, muzzleFlash, mixer, actions, facingOffset = 0 } = buildEnemyMesh(
    mc * CELL + CELL / 2,
    mr * CELL + CELL / 2,
    role
  );
  return {
    mesh,
    muzzleFlash,
    mixer,
    actions,
    facingOffset,
    weaponRole: role,
    currentClip: 'idle',
    x: mc * CELL + CELL / 2,
    z: mr * CELL + CELL / 2,
    hp: getDifficulty().hp,
    maxHp: getDifficulty().hp,
    hpDrain: getDifficulty().hp,
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

// ── Dying list — shared with enemyUpdate.js ───────────────────────────────
// Dead enemies whose death animation still needs to play. enemyUpdate ticks them.
export const dyingEnemies = [];

// ── Kill functions ────────────────────────────────────────────────────────
export function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  if (e.sndTeam === 'friend') {
    if (e._friendIndicator) e._friendIndicator.visible = false;
    if (e.actions && e.actions.death) {
      const dyingMesh = e.mesh, dyingMixer = e.mixer;
      crossfade(e, 'death', 0);
      dyingEnemies.push({ mesh: dyingMesh, mixer: dyingMixer, timer: 2.2 });
    } else {
      scene.remove(e.mesh);
    }
    emit('friendly:killed', e);
    if (getMode()?.name === 'snd' && player.dead && enemies.every((en) => en.dead || en.sndTeam !== 'friend'))
      emit('round:friendTeamWiped');
    return;
  }
  player.kills++;
  document.getElementById('kills-num').textContent = player.kills;
  showMsg('ENEMY DOWN');
  showKillFeed('ENEMY');
  spawnAmmoDrop(e.x, e.z);

  if (e.actions && e.actions.death) {
    const dyingMesh = e.mesh, dyingMixer = e.mixer;
    crossfade(e, 'death', 0);
    dyingEnemies.push({ mesh: dyingMesh, mixer: dyingMixer, timer: 2.2 });
  } else {
    scene.remove(e.mesh);
  }

  emit('enemy:killed', e);
  if (getMode()?.name === 'snd') {
    if (enemies.every((en) => en.dead || en.sndTeam !== 'enemy')) emit('round:enemyTeamWiped');
    return;
  }
  if (!isAnyModeActive() && enemies.every((en) => en.dead)) emit('wave:end');
}

export function triggerDeath() {
  if (player.dead) return;
  player.dead = true;
  emit('player:died');
  if (isAnyModeActive()) {
    document.exitPointerLock?.();
    if (getMode()?.name === 'snd') {
      const allFriendsDead = enemies.every((en) => en.dead || en.sndTeam !== 'friend');
      if (allFriendsDead) emit('round:friendTeamWiped');
    }
    return;
  }
  document.exitPointerLock?.();
  const _showWaveOver = () => {
    setGameRunning(false);
    const { player: pd, ally: ad, enemy: ed } = getSummary();
    const dmgLine = `<div class="stat" style="margin-top:10px;color:#aaa;font-size:11px">DMG: YOU ${pd} · ALLIES ${ad} · ENEMIES ${ed}</div>`;
    const ov = document.getElementById('overlay');
    ov.style.display = 'flex';
    ov.innerHTML = `<div class="dead-h">KILLED IN ACTION</div><div class="stat">Kills: ${player.kills}</div><div class="stat" style="color:#555;margin-top:6px">Wave ${wave} — the vibes remain hostile</div>${dmgLine}<button onclick="location.reload()" style="margin-top:28px;padding:12px 52px;background:#e74c3c;color:#fff;border:none;font-family:'Courier New',monospace;font-size:14px;letter-spacing:4px;cursor:pointer">[ REDEPLOY ]</button>`;
  };
  const killer = player.lastAttacker;
  if (killer && !killer.dead) {
    startKillcam(killer, _showWaveOver);
  } else {
    _showWaveOver();
  }
}

export function deactivateAllEnemies() {
  for (const e of enemies) {
    e.dead = true;
    if (e.mesh) e.mesh.visible = false;
  }
}

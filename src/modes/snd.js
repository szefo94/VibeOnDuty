import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import {
  CELL, PLAYER_H, MAX_HP, MAX_AMMO, RESERVE_AMMO,
  SND_PLANT_RANGE, SND_DEFUSE_RANGE, SND_PLANT_TIME, SND_DEFUSE_TIME,
  SND_BOMB_FUSE, SND_ROUND_TIMER, SND_ROUNDS_PER_HALF, SND_TOTAL_ROUNDS, SND_WINS_NEEDED,
} from '../config.js';
import { player } from '../entities/player.js';
import { showMsg, updateHUD } from '../hud/overlay.js';
import {
  setSndHudVisible, updateMatchHUD, updateRoundTimerHUD, updateBombTimerHUD,
  showBombBarWrap, hideBombBarWrap, updatePlantBar, hidePlantBar,
  updateDefuseBar, hideDefuseBar, showPlantHint, hidePlantHint,
  showSndResult, hideSndResult,
} from '../hud/sndHud.js';
import { setGameRunning } from '../input.js';
import { on, emit } from '../events.js';
import { setMode } from './modeManager.js';

export function getSndPlantRange()  { return SND_PLANT_RANGE; }
export function getSndDefuseRange() { return SND_DEFUSE_RANGE; }

// ── Sites and spawns — updated by setSndMap() before each game ────────────
let _sites = [
  { id: 'A', x: 8 * CELL + CELL / 2, z: 7  * CELL + CELL / 2 },
  { id: 'B', x: 8 * CELL + CELL / 2, z: 17 * CELL + CELL / 2 },
];
let _attackerSpawn = { x: 16 * CELL + CELL / 2, z: 11 * CELL + CELL / 2 };
let _defenderSpawn = { x: 7  * CELL + CELL / 2, z: 11 * CELL + CELL / 2 };

export function setSndMap(mapDef) {
  _sites = mapDef.sites.map(s => ({ ...s }));
  _attackerSpawn = mapDef.spawnAttacker;
  _defenderSpawn = mapDef.spawnDefender;
}

export function getSndSitePositions() { return _sites.map((s) => [s.x, s.z]); }

// ── Match state ───────────────────────────────────────────────────────────
let matchRound   = 1;
let playerScore  = 0;
let enemyScore   = 0;
let playerRole   = 'attack';  // 'attack' | 'defend'

export function getPlayerRole()  { return playerRole; }
export function getMatchState()  { return { matchRound, playerScore, enemyScore }; }

// ── Round state ───────────────────────────────────────────────────────────
export let sndState = 'idle';  // 'idle'|'live'|'planted'|'over'

let fuseTimer           = 0;
let roundTimer          = 0;
let bombWorldX          = 0, bombWorldZ = 0;
let plantProgress       = 0;   // player planting (when attacking)
let playerDefuseProg    = 0;   // player defusing (when defending)
let defuseProgress      = 0;   // enemy defusing player bomb (when attacking)
let enemyDefuseFlag     = false;
let enemyPlantFlag      = false;
let enemyPlantX         = 0, enemyPlantZ = 0;

// ── 3D objects ────────────────────────────────────────────────────────────
let bombMesh = null, bombLight = null;

// ── Callbacks from enemies.js ─────────────────────────────────────────────
export function markEnemyDefusing() { enemyDefuseFlag = true; }
export function markEnemyPlanting(ex, ez) { enemyPlantFlag = true; enemyPlantX = ex; enemyPlantZ = ez; }

export function onAllEnemyTeamDead() {
  if (!isSndActive()) return;
  // Whoever was on the enemy team died — player team wins this round
  endRound('team_eliminated');
}

export function onAllFriendsDead() {
  if (!isSndActive()) return;
  // Player + all friendly bots dead — enemy AI wins round
  endRound('friend_team_wiped');
}

on('round:enemyTeamWiped', onAllEnemyTeamDead);
on('round:friendTeamWiped', onAllFriendsDead);

export function isSndActive() { return sndState !== 'idle' && sndState !== 'over'; }
export function getSndBombPos() { return sndState === 'planted' ? [bombWorldX, bombWorldZ] : null; }

let _matchOver = false;
export function isMatchOver() { return _matchOver; }

// ── Match / round lifecycle ───────────────────────────────────────────────
export function startSnd() {
  matchRound  = 1;
  playerScore = 0;
  enemyScore  = 0;
  playerRole  = 'attack';
  _matchOver  = false;
  setMode({ name: 'snd', tick: tickSnd });
  emit('snd:configure', {
    isActive:        isSndActive,
    getBombPos:      getSndBombPos,
    getSitePositions: getSndSitePositions,
    getPlantRange:   getSndPlantRange,
    getDefuseRange:  getSndDefuseRange,
    getPlayerRole,
    markDefusing:    markEnemyDefusing,
    markPlanting:    markEnemyPlanting,
  });
  _startRound();
}

function _startRound() {
  sndState          = 'live';
  fuseTimer         = SND_BOMB_FUSE;
  roundTimer        = SND_ROUND_TIMER;
  plantProgress     = 0;
  playerDefuseProg  = 0;
  defuseProgress    = 0;
  enemyDefuseFlag   = false;
  enemyPlantFlag    = false;
  enemyPlantX = enemyPlantZ = 0;
  bombWorldX  = bombWorldZ  = 0;

  player.dead      = false;
  player.hp        = MAX_HP;
  player.ammo      = MAX_AMMO;
  player.reserve   = RESERVE_AMMO;
  player.reloading = false;
  player.energy    = 0;
  updateHUD();
  const spawn = playerRole === 'attack' ? _attackerSpawn : _defenderSpawn;
  camera.position.set(spawn.x, PLAYER_H, spawn.z);

  removeBombMesh();
  createSiteMarkers();
  setSndHudVisible(true);
  hideSndResult();
  hideBombBarWrap();
  hidePlantBar();
  hideDefuseBar();
  updateMatchHUD(playerRole, matchRound, SND_TOTAL_ROUNDS, playerScore, enemyScore);
  updateRoundTimerHUD(SND_ROUND_TIMER);
  showMsg(
    `ROUND ${matchRound}/${SND_TOTAL_ROUNDS} — ${playerRole === 'attack' ? '⚔ ATTACK: PLANT THE BOMB' : '🛡 DEFEND: STOP THE PLANT'}`,
    3000
  );
}

// Called by main.js "NEXT ROUND" button
export function nextRound() {
  removeBombMesh();
  removeSiteMarkers();
  matchRound++;
  playerRole = matchRound <= SND_ROUNDS_PER_HALF ? 'attack' : 'defend';
  _startRound();
}

// ── Tick ──────────────────────────────────────────────────────────────────
export function tickSnd(dt, keys) {
  if (sndState === 'idle' || sndState === 'over') return;

  if (sndState === 'planted') {
    _tickPlanted(dt, keys);
    return;
  }

  // Pre-plant: pulse beacons, count round timer
  const pulse = 0.5 + 0.35 * Math.abs(Math.sin(performance.now() / 600));
  for (const site of _sites) {
    if (site.ring)  site.ring.material.opacity = pulse;
    if (site.light) site.light.intensity = 1.0 + 1.5 * Math.abs(Math.sin(performance.now() / 450));
  }

  // Round timer (only counts pre-plant)
  if (!player.dead) {
    roundTimer -= dt;
    updateRoundTimerHUD(Math.max(0, roundTimer));
    if (roundTimer <= 0) { endRound('timeout'); return; }
  }

  if (playerRole === 'attack') {
    _tickAttackerPlant(dt, keys);
  } else {
    _tickEnemyAttackerPlant(dt);
  }
}

function _tickPlanted(dt, keys) {
  fuseTimer -= dt;
  updateBombTimerHUD(Math.max(0, fuseTimer), SND_BOMB_FUSE);
  const blinkHz = 1 + (1 - Math.max(0, fuseTimer) / SND_BOMB_FUSE) * 6;
  const blink = Math.abs(Math.sin(performance.now() / 1000 * Math.PI * blinkHz));
  if (bombLight) bombLight.intensity = 1.0 + blink * 2.0;
  if (bombMesh)  bombMesh.material.emissiveIntensity = 0.5 + blink;

  if (playerRole === 'attack') {
    // Enemies try to defuse
    if (enemyDefuseFlag) {
      defuseProgress = Math.min(1, defuseProgress + dt / SND_DEFUSE_TIME);
      updateDefuseBar(defuseProgress);
      if (defuseProgress >= 1) { endRound('bomb_defused'); return; }
    } else {
      defuseProgress = Math.max(0, defuseProgress - dt * 0.3);
      updateDefuseBar(defuseProgress);
    }
    enemyDefuseFlag = false;
  } else {
    // Player tries to defuse
    const px = camera.position.x, pz = camera.position.z;
    const dx = px - bombWorldX, dz = pz - bombWorldZ;
    const nearBomb = dx * dx + dz * dz < SND_DEFUSE_RANGE * SND_DEFUSE_RANGE;
    if (nearBomb && keys['KeyG'] && !player.dead) {
      playerDefuseProg = Math.min(1, playerDefuseProg + dt / SND_DEFUSE_TIME);
      updateDefuseBar(playerDefuseProg);
      showPlantHint('HOLD G — DEFUSING');
      if (playerDefuseProg >= 1) { endRound('bomb_defused'); return; }
    } else {
      playerDefuseProg = Math.max(0, playerDefuseProg - dt * 0.3);
      if (playerDefuseProg < 0.01) hidePlantHint();
      updateDefuseBar(playerDefuseProg);
    }
  }

  if (fuseTimer <= 0) { endRound('bomb_exploded'); return; }
}

function _tickAttackerPlant(dt, keys) {
  const px = camera.position.x, pz = camera.position.z;
  let nearSite = null;
  for (const site of _sites) {
    const dx = px - site.x, dz = pz - site.z;
    if (dx * dx + dz * dz < SND_PLANT_RANGE * SND_PLANT_RANGE) { nearSite = site; break; }
  }

  if (nearSite) showPlantHint(`SITE ${nearSite.id} — HOLD G TO PLANT`);
  else hidePlantHint();

  if (nearSite && keys['KeyG'] && !player.dead) {
    plantProgress = Math.min(1, plantProgress + dt / SND_PLANT_TIME);
    updatePlantBar(plantProgress);
    if (plantProgress >= 1) {
      _plantBomb(nearSite.x, nearSite.z, nearSite);
    }
  } else {
    if (plantProgress > 0) { plantProgress = 0; hidePlantBar(); }
  }
}

function _tickEnemyAttackerPlant(dt) {
  if (!enemyPlantFlag) {
    plantProgress = Math.max(0, plantProgress - dt * 0.5);
    if (plantProgress < 0.01) hidePlantBar();
    return;
  }
  plantProgress = Math.min(1, plantProgress + dt / SND_PLANT_TIME);
  updatePlantBar(plantProgress);
  showPlantHint('ENEMY PLANTING...');
  if (plantProgress >= 1) {
    // Find which site the enemy is at
    const site = _sites.find((s) => {
      const dx = enemyPlantX - s.x, dz = enemyPlantZ - s.z;
      return dx * dx + dz * dz < 4;
    }) ?? _sites[0];
    _plantBomb(enemyPlantX, enemyPlantZ, site);
  }
  enemyPlantFlag = false;
  enemyPlantX = enemyPlantZ = 0;
}

function _plantBomb(bx, bz, site) {
  bombWorldX = bx; bombWorldZ = bz;
  sndState   = 'planted';
  fuseTimer  = SND_BOMB_FUSE;
  hidePlantBar();
  showBombBarWrap();
  if (site?.ring)  { scene.remove(site.ring);  site.ring  = null; }
  if (site?.pole)  { scene.remove(site.pole);  site.pole  = null; }
  if (site?.light) { scene.remove(site.light); site.light = null; }
  createBombMesh(bx, bz);
  if (playerRole === 'attack') {
    showMsg('BOMB PLANTED — ' + SND_BOMB_FUSE + 's TO DETONATE', 3000);
  } else {
    showMsg('BOMB PLANTED — DEFUSE IT! (G near bomb)', 3000);
  }
}

// ── Round end ─────────────────────────────────────────────────────────────
function endRound(result) {
  if (sndState === 'over') return;
  sndState = 'over';
  removeBombMesh();
  removeSiteMarkers();
  setGameRunning(false);
  document.exitPointerLock?.();
  hideBombBarWrap(); hideDefuseBar(); hidePlantBar(); hidePlantHint();

  // team_eliminated = enemy bots (always opposing side) are all dead → player always wins
  // bomb_exploded   = attacker wins → player wins iff attacking
  // bomb_defused / timeout / friend_team_wiped = defender wins → player wins iff defending
  const playerWins =
    result === 'team_eliminated' ||
    (result === 'bomb_exploded' && playerRole === 'attack') ||
    (result === 'bomb_defused'  && playerRole === 'defend') ||
    (result === 'timeout'       && playerRole === 'defend');

  if (playerWins) playerScore++; else enemyScore++;

  _matchOver = playerScore >= SND_WINS_NEEDED || enemyScore >= SND_WINS_NEEDED || matchRound >= SND_TOTAL_ROUNDS;
  const [title, sub, color] = _roundResultText(result, playerWins, _matchOver);
  showSndResult(title, sub, color, _matchOver);
}

function _roundResultText(result, playerWins, matchOver) {
  if (matchOver) {
    return playerScore > enemyScore
      ? ['MATCH WON', `${playerScore} - ${enemyScore}`, '#2ecc71']
      : ['MATCH LOST', `${playerScore} - ${enemyScore}`, '#e74c3c'];
  }
  const subScore = `Score: ${playerScore} - ${enemyScore}  |  Round ${matchRound}/${SND_TOTAL_ROUNDS}`;
  const msgs = {
    bomb_exploded:     ['BOMB DETONATED',   playerWins ? 'YOUR TEAM WINS ROUND' : 'ENEMY TEAM WINS ROUND', playerWins ? '#e74c3c' : '#3498db'],
    bomb_defused:      ['BOMB DEFUSED',     playerWins ? 'YOUR TEAM WINS ROUND' : 'ENEMY TEAM WINS ROUND', playerWins ? '#2ecc71' : '#e74c3c'],
    team_eliminated:   ['TEAM ELIMINATED',  playerWins ? 'YOUR TEAM WINS ROUND' : 'ENEMY TEAM WINS ROUND', playerWins ? '#2ecc71' : '#e74c3c'],
    friend_team_wiped: ['TEAM WIPED',       'ENEMY TEAM WINS ROUND', '#e74c3c'],
    timeout:           ['TIME UP',          playerWins ? 'DEFENSE HOLDS' : 'ATTACKERS FAILED', playerWins ? '#2ecc71' : '#e74c3c'],
    killed:            ['KIA',              'ENEMY TEAM WINS ROUND', '#e74c3c'],
  };
  const [t, s, c] = msgs[result] || ['ROUND OVER', '', '#fff'];
  return [t, `${s}  ·  ${subScore}`, c];
}

// ── 3D helpers ────────────────────────────────────────────────────────────
function createSiteMarkers() {
  for (const site of _sites) {
    const ringGeo = new THREE.RingGeometry(0.8, 1.3, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffcc00, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false,
    }));
    ring.position.set(site.x, 0.05, site.z);
    scene.add(ring);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.6 })
    );
    pole.position.set(site.x, 1.4, site.z);
    scene.add(pole);

    const light = new THREE.PointLight(0xffcc00, 1.5, 6);
    light.position.set(site.x, 2.6, site.z);
    scene.add(light);

    site.ring = ring; site.pole = pole; site.light = light;
  }
}

function createBombMesh(x, z) {
  bombMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.13, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2200, emissiveIntensity: 1 })
  );
  bombMesh.position.set(x, 0.1, z);
  scene.add(bombMesh);
  bombLight = new THREE.PointLight(0xff2200, 2.0, 5);
  bombLight.position.set(x, 0.5, z);
  scene.add(bombLight);
}

function removeBombMesh() {
  if (bombMesh)  { scene.remove(bombMesh);  bombMesh  = null; }
  if (bombLight) { scene.remove(bombLight); bombLight = null; }
}

function removeSiteMarkers() {
  for (const site of _sites) {
    if (site.ring)  { scene.remove(site.ring);  site.ring  = null; }
    if (site.pole)  { scene.remove(site.pole);  site.pole  = null; }
    if (site.light) { scene.remove(site.light); site.light = null; }
  }
}


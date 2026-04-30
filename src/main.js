import * as THREE from 'three';
import { MOUSE_SENS, MAX_AMMO, PLAYER_H, WEAPONS } from './config.js';
import { camera } from './scene.js';
import { debugLines } from './level.js';
import { locked, gameRunning, setGameRunning, setLocked } from './input.js';
import { initTouch, isTouchDevice } from './touch.js';
import { player, startReload } from './entities/player.js';
import { rebuildAllEnemies, spawnSndEnemies, spawnTdmEnemies } from './entities/enemies.js';
import { spawnNewDrone, spawnSndDrones, clearSndDrones } from './entities/drone.js';
import { tryThrowGrenade } from './entities/grenades.js';
import { tryShoot, tryPunchDamage } from './combat/shoot.js';
import { flashMeleeRing } from './fx/meleeRange.js';
import { updateHUD, showMsg, showStatus } from './hud/overlay.js';
import { startLoop, setThirdPerson, getThirdPerson, toggleTpSide } from './loop.js';
import { startSnd, nextRound, getSndSitePositions, isMatchOver, setSndMap } from './modes/snd.js';
import { toggleBuyPanel, isBuyPhaseActive } from './modes/buyMenu.js';
import { startTdm } from './modes/tdm.js';
import { setDifficulty } from './difficulty.js';
import { tryLoadEnemyGLTF, buildPlayerMesh, tintEnemyMesh, playerMesh } from './builders/enemyGLTF.js';
import { show1pWeapon, show3pWeapon, weapon3p } from './builders/weapon.js';
import { playerBody } from './builders/playerBody.js';
import { tryLoadWeaponFBX, tryLoadP90ForHand } from './builders/weaponFBX.js';
import { tryLoadPistolFBX } from './builders/enemyWeapon.js';
import { setSkeletonDebugVisible } from './builders/enemyAnimations.js';
import { register, loadAll } from './builders/assetManager.js';
import { setActiveMap } from './map.js';
import { buildLevel } from './level.js';
import { bunkerMapDef } from './maps/bunker.js';
import { rooftopMapDef } from './maps/rooftop.js';
import { conceptMapDef } from './maps/concept.js';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
let debugVisible = true;

// ── Difficulty selection ───────────────────────────────────────────────
document.querySelectorAll('.diff-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    setDifficulty(card.dataset.diff);
  });
});

// ── Map selection ──────────────────────────────────────────────────────
const _mapRegistry = { bunker: bunkerMapDef, rooftop: rooftopMapDef, concept: conceptMapDef };
let _selectedMap = bunkerMapDef;
document.querySelectorAll('.map-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.map-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    _selectedMap = _mapRegistry[card.dataset.map] ?? bunkerMapDef;
  });
});

function _activateMap() {
  setActiveMap(_selectedMap);
  buildLevel(_selectedMap);
  if (debugLines) debugLines.visible = debugVisible;
}

// ── Weapon switching ───────────────────────────────────────────────
function switchWeapon(key) {
  if (!WEAPONS[key] || player.dead) return;
  showStatus(`[${['m4','p90','awp','pistol'].indexOf(key)+1}] ${WEAPONS[key].name}`);
  if (player.weapon === key) return;
  if (player.reloading) {
    player.reloading = false;
    document.getElementById('reloadwrap').style.display = 'none';
  }
  player.weaponAmmo[player.weapon] = player.ammo;
  player.weaponReserve[player.weapon] = player.reserve;
  player.weapon = key;
  player.ammo = player.weaponAmmo[key];
  player.reserve = player.weaponReserve[key];
  player.shootCd = 0;
  show1pWeapon(key);
  show3pWeapon(key);
  updateHUD();
}

// ── Input: game-action handlers ────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (
    e.code === 'KeyR' &&
    gameRunning &&
    !player.reloading &&
    player.ammo < (WEAPONS[player.weapon]?.maxAmmo ?? MAX_AMMO) &&
    player.reserve > 0
  )
    startReload();
  if (e.code === 'F3') {
    debugVisible = !debugVisible;
    if (debugLines) debugLines.visible = debugVisible;
    setSkeletonDebugVisible(debugVisible);
  }
  if (e.code === 'KeyV') {
    setThirdPerson(!getThirdPerson());
    showStatus(getThirdPerson() ? '3RD PERSON' : '1ST PERSON');
  }
  if (e.code === 'KeyB' && getThirdPerson()) {
    showStatus(toggleTpSide() === 1 ? 'SHOULDER: RIGHT' : 'SHOULDER: LEFT');
  }
  if (e.code === 'KeyB' && !getThirdPerson()) toggleBuyPanel();
  if (e.code === 'KeyT' && !player.dead) {
    player.dancing = !player.dancing;
    showStatus(player.dancing ? '🕺 DANCE' : '');
  }
  if (e.code === 'KeyG') return; // G handled via keys state in tickSnd
  if (e.code === 'Digit1' && gameRunning && !player.dead) switchWeapon('m4');
  if (e.code === 'Digit2' && gameRunning && !player.dead) switchWeapon('p90');
  if (e.code === 'Digit3' && gameRunning && !player.dead) switchWeapon('awp');
  if (e.code === 'Digit4' && gameRunning && !player.dead) switchWeapon('pistol');
  if (e.code === 'KeyF' && !player.dead && !player.punching) {
    player.punching = true;
    player.punchClip = player.punchClip === 'punch_cross' ? 'punch_jab' : 'punch_cross';
    setTimeout(() => {
      tryPunchDamage();
      flashMeleeRing(camera.position.x, camera.position.z);
    }, 350);
    setTimeout(() => { player.punching = false; }, 700);
  }
});
document.addEventListener('mousemove', (e) => {
  if (!locked || !gameRunning || player.dead) return;
  player.yaw -= e.movementX * MOUSE_SENS;
  player.pitch = Math.max(-1.38, Math.min(1.38, player.pitch - e.movementY * MOUSE_SENS));
  _euler.set(player.pitch, player.yaw, 0);
  camera.quaternion.setFromEuler(_euler);
});
document.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    if (!locked && gameRunning) {
      document.getElementById('c').requestPointerLock();
      return;
    }
    if (locked && gameRunning) tryShoot();
  }
  if (e.button === 1 && locked && gameRunning) tryThrowGrenade();
  if (e.button === 2 && locked && gameRunning) player.aiming = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) player.aiming = false;
});

// ── INCURSION (wave) start ─────────────────────────────────────────
document.getElementById('startbtn').addEventListener('click', () => {
  _activateMap();
  rebuildAllEnemies();                     // re-spawn with chosen difficulty HP
  if (_selectedMap.spawnPlayer) {
    camera.position.set(_selectedMap.spawnPlayer.x, PLAYER_H, _selectedMap.spawnPlayer.z);
  }
  document.getElementById('overlay').style.display = 'none';
  if (isTouchDevice) {
    setLocked(true);
  } else {
    document.getElementById('c').requestPointerLock();
  }
  setGameRunning(true);
  updateHUD();
  show1pWeapon(player.weapon);
  show3pWeapon(player.weapon);
  spawnNewDrone();
  showMsg('INCURSION — HOLD THE ZONE', 2500);
  showStatus(`[1] ${WEAPONS[player.weapon].name}`);
});
document.getElementById('c').addEventListener('click', () => {
  if (gameRunning && !player.dead && !locked) document.getElementById('c').requestPointerLock();
});

function sndStart() {
  _activateMap();
  setSndMap(_selectedMap);
  tintEnemyMesh(playerMesh, 0x00bb44);
  document.getElementById('overlay').style.display = 'none';
  if (isTouchDevice) { setLocked(true); } else { document.getElementById('c').requestPointerLock(); }
  setGameRunning(true);
  startSnd();
  spawnSndEnemies(getSndSitePositions());
  spawnSndDrones();
  updateHUD();
  show1pWeapon(player.weapon);
  show3pWeapon(player.weapon);
  showMsg('S&D — PLANT AT SITE A OR B (HOLD G)', 3500);
  showStatus(`[1] ${WEAPONS[player.weapon].name}`);
}

function tdmStart() {
  _activateMap();
  tintEnemyMesh(playerMesh, 0x00bb44);
  spawnTdmEnemies(_selectedMap);             // 5 friendly bots + 5 enemies
  const sp = _selectedMap.spawnAttacker ?? _selectedMap.spawnPlayer ?? { x: 10, z: 10 };
  camera.position.set(sp.x, PLAYER_H, sp.z);
  document.getElementById('overlay').style.display = 'none';
  if (isTouchDevice) { setLocked(true); } else { document.getElementById('c').requestPointerLock(); }
  setGameRunning(true);
  updateHUD();
  show1pWeapon(player.weapon);
  show3pWeapon(player.weapon);
  spawnNewDrone();
  startTdm(sp.x, sp.z);
  showStatus(`[1] ${WEAPONS[player.weapon].name}`);
}

// ── S&D mode start ─────────────────────────────────────────────────
document.getElementById('snd-startbtn').addEventListener('click', sndStart);

// ── TDM mode start ─────────────────────────────────────────────────
document.getElementById('tdm-startbtn').addEventListener('click', tdmStart);

// ── S&D next round ─────────────────────────────────────────────────
document.getElementById('snd-next-btn').addEventListener('click', () => {
  if (isMatchOver()) { location.reload(); return; }
  clearSndDrones();
  nextRound();
  spawnSndEnemies(getSndSitePositions());
  spawnSndDrones();
  updateHUD();
  setGameRunning(true);
  if (isTouchDevice) { setLocked(true); } else { document.getElementById('c').requestPointerLock(); }
});

// ── Touch controls ─────────────────────────────────────────────────
initTouch();

// ── Asset registry ──────────────────────────────────────────────────
register('enemy-glb',  tryLoadEnemyGLTF);
register('weapon-fbx', tryLoadWeaponFBX);
register('pistol-fbx', tryLoadPistolFBX);
register('player-p90', tryLoadP90ForHand);

// ── Kick off ───────────────────────────────────────────────────────
window.loadGLTF = tryLoadEnemyGLTF;

const _startBtn    = document.getElementById('startbtn');
const _sndStartBtn = document.getElementById('snd-startbtn');
const _tdmStartBtn = document.getElementById('tdm-startbtn');
_startBtn.disabled    = true;
_sndStartBtn.disabled = true;
_tdmStartBtn.disabled = true;
_startBtn.textContent    = 'LOADING...';
_sndStartBtn.textContent = 'LOADING...';
_tdmStartBtn.textContent = 'LOADING...';

// Attach player 3p weapon to body BEFORE async block so buildPlayerMesh()
// can reparent it to hand_r without immediately losing it.
weapon3p.position.set(0.30, 0.90, -0.18);
playerBody.add(weapon3p);

(async () => {
  const assets = await loadAll();
  _startBtn.textContent    = 'INCURSION';
  _sndStartBtn.textContent = 'S&D — START';
  _tdmStartBtn.textContent = 'TEAM DEATHMATCH';
  _startBtn.disabled    = false;
  _sndStartBtn.disabled = false;
  _tdmStartBtn.disabled = false;
  if (assets['enemy-glb']) {
    rebuildAllEnemies();
    buildPlayerMesh();
  }
  startLoop();
})();

import * as THREE from 'three';
import { MOUSE_SENS, MAX_AMMO } from './config.js';
import { camera } from './scene.js';
import { debugLines } from './level.js';
import { locked, gameRunning, setGameRunning, setLocked } from './input.js';
import { initTouch, isTouchDevice } from './touch.js';
import { player, startReload } from './entities/player.js';
import { rebuildAllEnemies, spawnSndEnemies } from './entities/enemies.js';
import { spawnNewDrone, spawnSndDrones, clearSndDrones } from './entities/drone.js';
import { tryThrowGrenade } from './entities/grenades.js';
import { tryShoot, tryPunchDamage } from './combat/shoot.js';
import { flashMeleeRing } from './fx/meleeRange.js';
import { updateHUD, showMsg, showStatus } from './hud/overlay.js';
import { startLoop, setThirdPerson, getThirdPerson, toggleTpSide } from './loop.js';
import { startSnd, nextRound, getSndSitePositions, isMatchOver } from './modes/snd.js';
import { tryLoadEnemyGLTF, buildPlayerMesh } from './builders/enemyGLTF.js';
import { tryLoadWeaponFBX, tryLoadP90ForHand } from './builders/weaponFBX.js';
import { tryLoadPistolFBX } from './builders/enemyWeapon.js';
import { setSkeletonDebugVisible } from './builders/enemyAnimations.js';
import { register, loadAll } from './builders/assetManager.js';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
let debugVisible = true; // debug ON by default

// ── Input: game-action handlers ────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (
    e.code === 'KeyR' &&
    gameRunning &&
    !player.reloading &&
    player.ammo < MAX_AMMO &&
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
  if (e.code === 'KeyT' && !player.dead) {
    player.dancing = !player.dancing;
    showStatus(player.dancing ? '🕺 DANCE' : '');
  }
  if (e.code === 'KeyG') return; // G handled via keys state in tickSnd
  if (e.code === 'KeyF' && !player.dead && !player.punching) {
    player.punching = true;
    player.punchClip = player.punchClip === 'punch_cross' ? 'punch_jab' : 'punch_cross';
    // Deal damage at impact frame (~350ms) and flash range ring
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
  if (e.button === 1 && locked && gameRunning) tryThrowGrenade(); // middle mouse
  if (e.button === 2 && locked && gameRunning) player.aiming = true; // RMB aim
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) player.aiming = false;
});

// ── Start button ───────────────────────────────────────────────────
document.getElementById('startbtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  if (isTouchDevice) {
    // Pointer lock is unavailable on mobile — fake it so game logic works
    setLocked(true);
  } else {
    document.getElementById('c').requestPointerLock();
  }
  setGameRunning(true);
  updateHUD();
  spawnNewDrone();
  showMsg('VIBE ON DUTY — LOCK AND LOAD', 2500);
});
document.getElementById('c').addEventListener('click', () => {
  if (gameRunning && !player.dead && !locked) document.getElementById('c').requestPointerLock();
});

function sndStart() {
  document.getElementById('overlay').style.display = 'none';
  if (isTouchDevice) { setLocked(true); } else { document.getElementById('c').requestPointerLock(); }
  setGameRunning(true);
  startSnd();
  spawnSndEnemies(getSndSitePositions());
  spawnSndDrones();
  updateHUD();
  showMsg('S&D — PLANT AT SITE A OR B (HOLD G)', 3500);
}

// ── S&D mode start ─────────────────────────────────────────────────
document.getElementById('snd-startbtn').addEventListener('click', sndStart);

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
if (debugLines) debugLines.visible = debugVisible;
window.loadGLTF = tryLoadEnemyGLTF; // also callable manually from console

const _startBtn    = document.getElementById('startbtn');
const _sndStartBtn = document.getElementById('snd-startbtn');
_startBtn.disabled    = true;
_sndStartBtn.disabled = true;
_startBtn.textContent    = 'LOADING...';
_sndStartBtn.textContent = 'LOADING...';

(async () => {
  const assets = await loadAll();
  _startBtn.textContent    = 'DEPLOY';
  _sndStartBtn.textContent = 'S&D — START';
  _startBtn.disabled    = false;
  _sndStartBtn.disabled = false;
  if (assets['enemy-glb']) {
    rebuildAllEnemies();
    buildPlayerMesh();
  }
  startLoop();
})();

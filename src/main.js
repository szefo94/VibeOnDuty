import * as THREE from 'three';
import { MOUSE_SENS, MAX_AMMO, CELL } from './config.js';
import { camera } from './scene.js';
import { debugLines } from './level.js';
import { locked, gameRunning, setGameRunning, setLocked } from './input.js';
import { initTouch, isTouchDevice } from './touch.js';
import { player, startReload } from './entities/player.js';
import { spawnNewDrone, rebuildAllEnemies, spawnSndEnemies } from './entities/enemies.js';
import { tryThrowGrenade } from './entities/grenades.js';
import { tryShoot, rebuildEHM, tryPunchDamage } from './combat/shoot.js';
import { flashMeleeRing } from './fx/meleeRange.js';
import { updateHUD, showMsg, showStatus } from './hud/overlay.js';
import { startLoop, setThirdPerson, getThirdPerson, toggleTpSide } from './loop.js';
import { startSnd, nextSndRound } from './modes/snd.js';
import { tryLoadEnemyGLTF, buildPlayerMesh } from './builders/enemyGLTF.js';
import { tryLoadWeaponFBX, tryLoadP90ForHand } from './builders/weaponFBX.js';
import { tryLoadPistolFBX } from './builders/enemyWeapon.js';
import { setSkeletonDebugVisible } from './builders/enemyAnimations.js';

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
  rebuildEHM();
  updateHUD();
  spawnNewDrone();
  showMsg('VIBE ON DUTY — LOCK AND LOAD', 2500);
});
document.getElementById('c').addEventListener('click', () => {
  if (gameRunning && !player.dead && !locked) document.getElementById('c').requestPointerLock();
});

// Site positions must match SITES array in snd.js
const SND_SITES = [
  [8 * CELL + CELL / 2, 6 * CELL + CELL / 2],
  [8 * CELL + CELL / 2, 17 * CELL + CELL / 2],
];

function sndStart() {
  document.getElementById('overlay').style.display = 'none';
  if (isTouchDevice) { setLocked(true); } else { document.getElementById('c').requestPointerLock(); }
  setGameRunning(true);
  startSnd();
  spawnSndEnemies(SND_SITES);
  updateHUD();
  showMsg('S&D — PLANT AT SITE A OR B (HOLD G)', 3500);
}

// ── S&D mode start ─────────────────────────────────────────────────
document.getElementById('snd-startbtn').addEventListener('click', sndStart);

// ── S&D next round ─────────────────────────────────────────────────
document.getElementById('snd-next-btn').addEventListener('click', () => {
  nextSndRound();
  spawnSndEnemies(SND_SITES);
  updateHUD();
  setGameRunning(true);
  if (isTouchDevice) { setLocked(true); } else { document.getElementById('c').requestPointerLock(); }
  showMsg('NEXT ROUND — PLANT AT SITE A OR B (HOLD G)', 3000);
});

// ── Touch controls ─────────────────────────────────────────────────
initTouch();

// ── Kick off ───────────────────────────────────────────────────────
if (debugLines) debugLines.visible = debugVisible;
window.loadGLTF = tryLoadEnemyGLTF; // also callable manually from console
(async () => {
  const [enemyLoaded] = await Promise.all([
    tryLoadEnemyGLTF(),
    tryLoadWeaponFBX(),
    tryLoadPistolFBX(),
    tryLoadP90ForHand(),
  ]);
  if (enemyLoaded) {
    rebuildAllEnemies(); // swap procedural placeholders for GLTF enemies
    buildPlayerMesh();   // create the player's own GLTF instance
  }
  startLoop();
})();

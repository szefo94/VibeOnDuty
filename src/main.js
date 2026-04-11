import * as THREE from 'three';
import { MOUSE_SENS, MAX_AMMO } from './config.js';
import { camera } from './scene.js';
import { debugLines } from './level.js';
import { wpn } from './builders/weapon.js';
import { playerBody } from './builders/playerBody.js';
import { locked, gameRunning, setGameRunning } from './input.js';
import { player, startReload } from './entities/player.js';
import { spawnNewDrone } from './entities/enemies.js';
import { tryThrowGrenade } from './entities/grenades.js';
import { tryShoot, rebuildEHM } from './combat/shoot.js';
import { updateHUD, showMsg, showStatus } from './hud/overlay.js';
import { startLoop, setThirdPerson, getThirdPerson } from './loop.js';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
let debugVisible = false;

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
  }
  if (e.code === 'F4') {
    setThirdPerson(!getThirdPerson());
    wpn.visible = !getThirdPerson();
    playerBody.visible = getThirdPerson();
    showStatus(getThirdPerson() ? '3RD PERSON' : '1ST PERSON');
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
  if (e.button === 2 && locked && gameRunning) tryThrowGrenade();
});

// ── Start button ───────────────────────────────────────────────────
document.getElementById('startbtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('c').requestPointerLock();
  setGameRunning(true);
  rebuildEHM();
  updateHUD();
  spawnNewDrone();
  showMsg('VIBE ON DUTY — LOCK AND LOAD', 2500);
});
document.getElementById('c').addEventListener('click', () => {
  if (gameRunning && !player.dead && !locked) document.getElementById('c').requestPointerLock();
});

// ── Kick off ───────────────────────────────────────────────────────
startLoop();

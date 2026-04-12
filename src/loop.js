import { renderer, scene, camera } from './scene.js';
import { PLAYER_H } from './config.js';
import { gameRunning } from './input.js';
import { player, updatePlayer, LEAN_SHIFT } from './entities/player.js';
import { playerBody } from './builders/playerBody.js';
import { wpn } from './builders/weapon.js';
import { updateEnemies, tickWave } from './entities/enemies.js';
import { tickTorches } from './lighting.js';
import { drawHUD } from './hud/hud.js';
import { drawMinimap } from './hud/radar.js';

// ── Third-person state ────────────────────────────────────────────────
// thirdPerson: semantic bool (what mode we're in)
// tpTarget:    0 = 1st person, 1 = 3rd person
// tpTransition: lerped 0→1, drives camera offset + visibility
let thirdPerson = false;
let tpTarget = 0;
let tpTransition = 0;

export function setThirdPerson(v) {
  thirdPerson = v;
  tpTarget = v ? 1 : 0;
}
export function getThirdPerson() {
  return thirdPerson;
}

// shoulder side: target is 1 (right) or -1 (left), tpSideSmooth lerps toward it
let tpSideSign = 1;
let tpSideSmooth = 1;
export function toggleTpSide() {
  tpSideSign *= -1;
  return tpSideSign;
}

// Over-the-shoulder offsets (Fortnite style)
const TP_BACK = 2.6,
  TP_SIDE = 0.85,
  TP_HEIGHT = 0.12;
const TP_SPEED = 4.5; // lerp speed — ~0.5 s end-to-end

let last = 0;
export function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  if (gameRunning) {
    updatePlayer(dt);
    // keep body positioned whenever any transition is active
    if (tpTransition > 0.01) {
      playerBody.position.set(camera.position.x, camera.position.y - PLAYER_H, camera.position.z);
      playerBody.rotation.y = player.yaw + Math.PI;
    }
    updateEnemies(ts, dt);
    tickTorches(dt);
    tickWave(dt);
  }

  // ── Transition lerp + visibility handoff ─────────────────────────
  tpTransition += (tpTarget - tpTransition) * Math.min(1, TP_SPEED * dt);
  // weapon visible in 1st-person region, body visible once camera starts pulling back
  wpn.visible = tpTransition < 0.15;
  playerBody.visible = tpTransition > 0.05;

  drawMinimap(dt);
  const eyeX = camera.position.x,
    eyeY = camera.position.y,
    eyeZ = camera.position.z;

  // ── Lean offset (1st person only) ────────────────────────────────
  const leanOff = player.lean * LEAN_SHIFT * (1 - tpTransition);
  const leanRX = Math.cos(player.yaw) * leanOff;
  const leanRZ = -Math.sin(player.yaw) * leanOff;

  // ── Camera position: lerp from eye to over-the-shoulder ──────────
  tpSideSmooth += (tpSideSign - tpSideSmooth) * Math.min(1, dt * 6);
  const behX = Math.sin(player.yaw);
  const behZ = Math.cos(player.yaw);
  const rgtX = Math.cos(player.yaw);
  const rgtZ = -Math.sin(player.yaw);

  camera.position.set(
    eyeX + behX * TP_BACK * tpTransition + rgtX * TP_SIDE * tpSideSmooth * tpTransition + leanRX,
    eyeY + TP_HEIGHT * tpTransition,
    eyeZ + behZ * TP_BACK * tpTransition + rgtZ * TP_SIDE * tpSideSmooth * tpTransition + leanRZ
  );

  renderer.render(scene, camera);

  // restore eye position (camera.position must stay at player eye for movement)
  camera.position.set(eyeX, eyeY, eyeZ);

  drawHUD();
  requestAnimationFrame(loop);
}

export function startLoop() {
  last = performance.now();
  requestAnimationFrame(loop);
}

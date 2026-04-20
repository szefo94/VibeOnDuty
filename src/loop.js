import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { PLAYER_H, PLAYER_H_CROUCH } from './config.js';
import { touchLook } from './touch.js';
import { gameRunning, keys } from './input.js';
import { player, updatePlayer, LEAN_SHIFT } from './entities/player.js';
import { playerBody } from './builders/playerBody.js';
import { wpn } from './builders/weapon.js';
import { updateEnemies, tickWave } from './entities/enemies.js';
import { activeDrone, updateDrone, sndDrones, updateSndDrone } from './entities/drone.js';
import { tickTorches } from './lighting.js';
import { drawHUD, setDebugAnimClip } from './hud/hud.js';
import { tickMeleeRing } from './fx/meleeRange.js';
import { tickSnd } from './modes/snd.js';
import { drawMinimap } from './hud/radar.js';
import { playerMesh, playerMixer, playerActions } from './builders/enemyGLTF.js';
import { crossfade } from './builders/enemyAnimations.js';

// Shared animation state object for the player — same shape crossfade() expects
const playerAnim = { actions: null, currentClip: 'idle' };

// ── Player jump-phase state ───────────────────────────────────────────────
// Tracks jump_start → jump_loop → jump_land sequence with timers
let prevPlayerOnGround = true;
let jumpPhase = '';       // 'start' | 'loop' | 'land' | ''
let jumpPhaseTimer = 0;
const JUMP_START_DUR = 0.32; // seconds before transitioning start → loop
const JUMP_LAND_DUR  = 0.38; // seconds to hold landing pose

// ── Third-person state ────────────────────────────────────────────────
// thirdPerson: semantic bool (what mode we're in)
// tpTarget:    0 = 1st person, 1 = 3rd person
// tpTransition: lerped 0→1, drives camera offset + visibility
let thirdPerson = false;
let tpTarget = 0;
let tpTransition = 0;

// Smoothed camera Y — slow-lerps during roll so camera flows down/up
// instead of jumping abruptly with the body position.
let tpCamY = 0;
let tpCamYReady = false; // initialised to real eyeY on first frame

export function setThirdPerson(v) {
  thirdPerson = v;
  tpTarget = v ? 1 : 0;
  player.thirdPerson = v;
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

const _tEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const TOUCH_SENS = 0.005;

let last = 0;
export function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;

  // ── Touch look (consumed once per frame) ─────────────────────────
  if ((touchLook.dx || touchLook.dy) && gameRunning && !player.dead) {
    player.yaw  -= touchLook.dx * TOUCH_SENS;
    player.pitch = Math.max(-1.38, Math.min(1.38, player.pitch - touchLook.dy * TOUCH_SENS));
    _tEuler.set(player.pitch, player.yaw, 0);
    camera.quaternion.setFromEuler(_tEuler);
  }
  touchLook.dx = touchLook.dy = 0;

  if (gameRunning) {
    updatePlayer(dt);

    // ── Player body: GLTF mannequin if loaded, else procedural ───────
    const bodyTarget = playerMesh || playerBody;
    if (tpTransition > 0.01) {
      const eyeH = (player.crouching || player.sliding) ? PLAYER_H_CROUCH : PLAYER_H;
      bodyTarget.position.set(camera.position.x, camera.position.y - eyeH, camera.position.z);
      // Mannequin faces +Z at rotation.y=0; player.yaw+PI makes it face forward (same as look dir)
      bodyTarget.rotation.y = player.yaw + Math.PI;
    }

    // ── Player jump-phase bookkeeping ────────────────────────────────
    if (!prevPlayerOnGround && player.onGround) {
      // just landed
      jumpPhase = 'land';
      jumpPhaseTimer = JUMP_LAND_DUR;
    } else if (prevPlayerOnGround && !player.onGround && !player.diving) {
      // just left ground (jumped — not a dive)
      jumpPhase = 'start';
      jumpPhaseTimer = JUMP_START_DUR;
    }
    prevPlayerOnGround = player.onGround;
    if (jumpPhase === 'start') {
      jumpPhaseTimer -= dt;
      if (jumpPhaseTimer <= 0) jumpPhase = player.onGround ? '' : 'loop';
    }
    if (jumpPhase === 'land') {
      jumpPhaseTimer -= dt;
      if (jumpPhaseTimer <= 0) jumpPhase = '';
    }

    // ── Player animation ─────────────────────────────────────────────
    if (!playerMesh || !playerMixer) {
      setDebugAnimClip('no GLTF (procedural)');
    }
    if (playerMesh && playerMixer) {
      // Sync action table once playerActions is populated after load
      if (!playerAnim.actions && playerActions) playerAnim.actions = playerActions;

      if (playerAnim.actions) {
        const a = playerAnim.actions;
        let clip;
        const sprint = keys['ShiftLeft'] || keys['ShiftRight'];

        if (player.dead && a.death) {
          clip = 'death';
        } else if (player.dancing && a.dance) {
          clip = 'dance';
        } else if (player.punching && a[player.punchClip]) {
          clip = player.punchClip;
        } else if (player.rollTimer > 0 && a.roll) {
          clip = 'roll';
        } else if (jumpPhase === 'land' && a.jump_land) {
          clip = 'jump_land';
        } else if (!player.onGround) {
          if (jumpPhase === 'start' && a.jump_start) clip = 'jump_start';
          else clip = a.jump_loop ? 'jump_loop' : 'idle';
        } else if (player.throwingNade && a.nade) {
          clip = 'nade';
        } else if (player.reloading && a.reload) {
          clip = 'reload';
        } else if (player.crouching || player.sliding) {
          clip = player.moving
            ? (a.crouch_walk ? 'crouch_walk' : 'walk')
            : (a.crouch      ? 'crouch'      : 'idle');
        } else if (player.moving) {
          const back  = keys['KeyS'] && !keys['KeyW'];
          const left  = keys['KeyA'] && !keys['KeyD'] && !keys['KeyW'] && !keys['KeyS'];
          const right = keys['KeyD'] && !keys['KeyA'] && !keys['KeyW'] && !keys['KeyS'];
          if (back  && a.walk_back) clip = 'walk_back';
          else if (back  && a.run_back)  clip = 'run_back';
          else if (left  && a.strafe_l)  clip = 'strafe_l';
          else if (right && a.strafe_r)  clip = 'strafe_r';
          else clip = sprint && a.run ? 'run' : 'walk';
        } else if (player.aiming && a.attack) {
          clip = 'attack';
        } else {
          clip = 'idle';
        }
        const SNAP_CLIPS = new Set(['crouch', 'crouch_walk', 'death', 'roll', 'jump_start', 'jump_land', 'dance', 'punch_cross', 'punch_jab']);
        const snapTransition = SNAP_CLIPS.has(clip) || SNAP_CLIPS.has(playerAnim.currentClip);
        crossfade(playerAnim, clip, snapTransition ? 0 : 0.22);
        setDebugAnimClip(clip);
      }
    }

    updateEnemies(ts, dt);
    if (activeDrone && !activeDrone.dead) updateDrone(activeDrone, dt);
    for (const d of sndDrones) updateSndDrone(d, dt);
    tickTorches(dt);
    tickWave(dt);
    tickMeleeRing(dt, camera.position.x, camera.position.z);
    tickSnd(dt, keys);
  }

  // ── Player mixer ticks even when dead so death animation plays ───
  if (playerMesh && playerMixer) playerMixer.update(dt);

  // ── Transition lerp + visibility handoff ─────────────────────────
  tpTransition += (tpTarget - tpTransition) * Math.min(1, TP_SPEED * dt);
  const bodyVisible = tpTransition > 0.05;
  wpn.visible = tpTransition < 0.15;
  // Show GLTF player when loaded, hide procedural fallback, or show procedural if no GLTF
  if (playerMesh) {
    playerMesh.visible = bodyVisible;
    playerBody.visible = false;
  } else {
    playerBody.visible = bodyVisible;
  }

  drawMinimap(dt);
  const eyeX = camera.position.x,
    eyeY = camera.position.y,
    eyeZ = camera.position.z;

  // ── Smoothed camera Y for 3rd-person roll ────────────────────────
  // During roll: slow lerp so camera flows down to crouch level then back up.
  // Normally: fast lerp so camera still follows (prevents drift after mode switch).
  // In 1st person: snap immediately (no visible effect there).
  if (!tpCamYReady) { tpCamY = eyeY; tpCamYReady = true; }
  if (tpTransition > 0.01) {
    const camLerpSpeed = player.rollTimer > 0 ? 3.5 : 9;
    tpCamY += (eyeY - tpCamY) * Math.min(1, dt * camLerpSpeed);
  } else {
    tpCamY = eyeY; // snap in 1st person — no lag when switching
  }

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
    tpCamY + TP_HEIGHT * tpTransition,
    eyeZ + behZ * TP_BACK * tpTransition + rgtZ * TP_SIDE * tpSideSmooth * tpTransition + leanRZ
  );

  // ── ADS FOV ─────────────────────────────────────────────────────────
  const fovTarget = player.aiming ? 50 : 75;
  if (camera.fov !== fovTarget) {
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();
  }

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

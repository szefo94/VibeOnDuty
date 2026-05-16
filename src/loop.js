import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { PLAYER_H, PLAYER_H_CROUCH, WEAPONS } from './config.js';
import { touchLook } from './touch.js';
import { gameRunning, keys } from './input.js';
import { player, updatePlayer, LEAN_SHIFT } from './entities/player.js';
import { playerBody } from './builders/playerBody.js';
import { wpn } from './builders/weapon.js';
import { updateEnemies, enemies, spawnEnemyIntoSlot } from './entities/enemies.js';
import { tickWave } from './entities/waveSystem.js';
import { activeDrone, updateDrone, sndDrones, updateSndDrone } from './entities/drone.js';
import { tickTorches } from './lighting.js';
import { drawHUD, setDebugAnimClip, setDebugFrameMs } from './hud/hud.js';
import { tickMeleeRing } from './fx/meleeRange.js';
import { getMode } from './modes/modeManager.js';
import { tickScreenShake } from './fx/screenShake.js';
import { updateWeaponDeath } from './combat/shoot.js';
import { tickGamepad } from './gamepad.js';
import { drawMinimap } from './hud/radar.js';
import { playerMesh, playerMixer, playerActions } from './builders/enemyGLTF.js';
import { crossfade, tickInertia, setLocoWeights, enterLocoMode, exitLocoMode, tickBoneFlipMonitor } from './builders/enemyAnimations.js';
import { tickKillcam, isKillcamActive } from './replay/killcam.js';
import { adaptTick } from './ai/difficultyAdapter.js';

// Shared animation state object for the player — same shape crossfade() expects
const playerAnim = { actions: null, currentClip: 'idle', _dbgTransitions: false, _dbgFlipMonitor: false };

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

  tickGamepad(dt);

  const _t0 = performance.now();
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
    const _prevJumpPhase = jumpPhase;
    if (!prevPlayerOnGround && player.onGround) {
      jumpPhase = 'land';
      jumpPhaseTimer = JUMP_LAND_DUR;
    } else if (prevPlayerOnGround && !player.onGround && !player.diving) {
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
    if (jumpPhase !== _prevJumpPhase && playerAnim._dbgTransitions) {
      const loopT = playerAnim.actions?.jump_loop?.time?.toFixed(3) ?? '?';
      console.log(`[jumpPhase] ${_prevJumpPhase || 'idle'} → ${jumpPhase || 'idle'}  onGround=${player.onGround}  jump_loop.time=${loopT}`);
    }

    // ── Player animation ─────────────────────────────────────────────
    if (!playerMesh || !playerMixer) {
      setDebugAnimClip('no GLTF (procedural)');
    }
    if (playerMesh && playerMixer) {
      // Sync action table once playerActions is populated after load
      if (!playerAnim.actions && playerActions) playerAnim.actions = playerActions;

      // Lazy bone collection for inertial blending
      if (!playerAnim._bonesInit) {
        playerAnim._bonesInit = true;
        playerAnim._bones = [];
        playerMesh.traverse(obj => {
          if (obj.isSkinnedMesh && obj.skeleton)
            for (const b of obj.skeleton.bones) if (!playerAnim._bones.includes(b)) playerAnim._bones.push(b);
        });
      }

      if (playerAnim.actions) {
        const a = playerAnim.actions;
        let clip = null;
        let locoHandled = false;
        const sprint = keys['ShiftLeft'] || keys['ShiftRight'];

        if (player.dead && a.death) {
          exitLocoMode(playerAnim); clip = 'death';
        } else if (player.dancing && a.dance) {
          exitLocoMode(playerAnim); clip = 'dance';
        } else if (player.punching && a[player.punchClip]) {
          exitLocoMode(playerAnim); clip = player.punchClip;
        } else if (player.rollTimer > 0 && a.roll) {
          exitLocoMode(playerAnim); clip = 'roll';
        } else if (jumpPhase === 'land' && a.jump_land && !player.crouching && !player.sliding) {
          exitLocoMode(playerAnim); clip = 'jump_land';
        } else if (!player.onGround && !player.crouching && !player.sliding) {
          exitLocoMode(playerAnim);
          if (jumpPhase === 'start' && a.jump_start) clip = 'jump_start';
          else clip = a.jump_loop ? 'jump_loop' : 'idle';
        } else if (player.throwingNade && a.nade) {
          exitLocoMode(playerAnim); clip = 'nade';
        } else if (player.reloading && a.reload) {
          exitLocoMode(playerAnim); clip = 'reload';
        } else if (player.crouching || player.sliding) {
          exitLocoMode(playerAnim);
          clip = player.moving
            ? (a.crouch_walk ? 'crouch_walk' : 'walk')
            : (a.crouch      ? 'crouch'      : 'idle');
        } else if (player.moving) {
          const back  = keys['KeyS'] && !keys['KeyW'];
          const left  = keys['KeyA'] && !keys['KeyD'] && !keys['KeyW'] && !keys['KeyS'];
          const right = keys['KeyD'] && !keys['KeyA'] && !keys['KeyW'] && !keys['KeyS'];
          if (back) {
            exitLocoMode(playerAnim);
            clip = a.walk_back ? 'walk_back' : (a.run_back ? 'run_back' : 'idle');
          } else {
            // Use loco blend tree for forward/strafe — same approach as enemies
            const strN = left ? -1 : right ? 1 : 0;
            const speedN = sprint ? 1.0 : 0.45;
            enterLocoMode(playerAnim);
            setLocoWeights(playerAnim.actions, speedN, strN);
            locoHandled = true;
          }
        } else {
          // Idle / aiming: loco at speedN=0 → idle clip gets full weight, no fade artifact
          // idle===attack alias, so the attack/aim pose shows correctly at weight=1
          enterLocoMode(playerAnim);
          setLocoWeights(playerAnim.actions, 0, 0);
          locoHandled = true;
        }

        const SNAP_CLIPS = new Set(['crouch', 'crouch_walk', 'death', 'roll', 'dance', 'punch_cross', 'punch_jab']);
        // Jump phase transitions use a shorter crossfade instead of snap — avoids arm flap at peak and landing
        const JUMP_FADE_CLIPS = new Set(['jump_start', 'jump_loop', 'jump_land']);
        const jumpFade = clip && (JUMP_FADE_CLIPS.has(clip) || JUMP_FADE_CLIPS.has(playerAnim.currentClip));
        const snapTransition = !jumpFade && clip && (SNAP_CLIPS.has(clip) || SNAP_CLIPS.has(playerAnim.currentClip));
        const prevClip = playerAnim.currentClip;
        if (!locoHandled && clip) crossfade(playerAnim, clip, snapTransition ? 0 : jumpFade ? 0.12 : 0.22);

        // Dance plays once then stops — set LoopOnce when first entering the state
        // so it doesn't spin forever when the player forgets to press T again.
        if (clip === 'dance' && prevClip !== 'dance' && a.dance && playerMixer) {
          a.dance.setLoop(THREE.LoopOnce, 1);
          a.dance.clampWhenFinished = true;
          playerMixer.addEventListener('finished', function onDanceEnd(ev) {
            if (ev.action === a.dance) {
              player.dancing = false;
              playerMixer.removeEventListener('finished', onDanceEnd);
            }
          });
        }

        setDebugAnimClip(locoHandled ? `loco[${playerAnim.currentClip}]` : clip);

        // Scale breathing weight: heavier during sprint, lighter while aiming
        if (playerAnim.actions?._breathing) {
          const breathW = player.dead ? 0
            : player.aiming          ? 0.4
            : (sprint && player.moving) ? 1.1
            : 0.75;
          playerAnim.actions._breathing.setEffectiveWeight(breathW);
        }
      }
    }

    updateEnemies(ts, dt);
    if (activeDrone && (!activeDrone.dead || activeDrone.dying)) updateDrone(activeDrone, dt);
    for (const d of sndDrones) updateSndDrone(d, dt);
    tickTorches(dt);
    tickWave(dt, enemies, spawnEnemyIntoSlot);
    adaptTick(dt);
    tickMeleeRing(dt, camera.position.x, camera.position.z);
    getMode()?.tick(dt, keys);
  }

  // ── Player mixer ticks even when dead so death animation plays ───
  if (playerMesh && playerMixer) {
    playerMixer.update(dt);
    tickInertia(playerAnim, dt);
    tickBoneFlipMonitor(playerAnim);
  }

  // ── 1p weapon death drop (runs even when dead) ───────────────────
  updateWeaponDeath(dt);

  // ── Transition lerp + visibility handoff ─────────────────────────
  tpTransition += (tpTarget - tpTransition) * Math.min(1, TP_SPEED * dt);
  const bodyVisible = tpTransition > 0.05;
  // Don't override wpn.visible while death-drop is playing
  if (!player.dead) wpn.visible = tpTransition < 0.15;
  // Show GLTF player when loaded, hide procedural fallback, or show procedural if no GLTF
  if (playerMesh) {
    playerMesh.visible = bodyVisible;
    playerBody.visible = false;
  } else {
    playerBody.visible = bodyVisible;
  }

  // ── AWP scope overlay ────────────────────────────────────────────────
  const _scopeEl  = document.getElementById('scope-overlay');
  const _xhairEl  = document.getElementById('xhair');
  const _awpScoping = player.weapon === 'awp' && player.aimT > 0.05;
  if (_scopeEl) {
    _scopeEl.style.display = _awpScoping ? 'block' : 'none';
    _scopeEl.style.opacity = String(Math.min(1, player.aimT));
  }
  if (_xhairEl) _xhairEl.style.opacity = _awpScoping ? '0' : '1';

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
  const fovTarget = player.aiming ? (WEAPONS[player.weapon]?.adsZoom ?? 50) : 75;
  if (camera.fov !== fovTarget) {
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();
  }

  setDebugFrameMs(performance.now() - _t0);

  // Killcam overrides camera after normal placement; skip eye-restore while active
  if (isKillcamActive()) {
    tickKillcam(dt);
  } else {
    tickScreenShake(dt);
  }

  renderer.render(scene, camera);

  // restore eye position (camera.position must stay at player eye for movement)
  if (!isKillcamActive()) camera.position.set(eyeX, eyeY, eyeZ);

  drawHUD();
  requestAnimationFrame(loop);
}

export function startLoop() {
  last = performance.now();
  requestAnimationFrame(loop);
}

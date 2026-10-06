import * as THREE from 'three';
import { renderComicScene } from './comicOutline.js';
import { renderer, scene, camera } from './scene.js';
import { PLAYER_H, PLAYER_H_CROUCH, WEAPONS, LEAN_SHIFT, ROLL_ANIM_DUR } from './config.js';
import { touchLook } from './touch.js';
import { gameRunning, keys } from './input.js';
import { player, updatePlayer, playerActions as offlineActions } from './entities/player.js';
import { playerBody } from './builders/playerBody.js';
import { wpn, weapon3p as wpn3p, restorePlayerWeaponHandling, updatePlayerWeaponHandling, playerWeaponHandling } from './builders/weapon.js';
import { enemies, spawnEnemyIntoSlot } from './entities/enemies.js';
import { updateEnemies } from './entities/enemyUpdate.js';
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
import { playerMesh, playerMixer, playerActions, playerFirstPersonRig } from './builders/enemyGLTF.js';
import { updateFirstPersonRig, renderFirstPersonRig } from './builders/firstPersonRig.js';
import { tickPresentation, finishPresentation, tickBoneFlipMonitor, inspectPresentationLayers } from './builders/enemyAnimations.js';
import { tickKillcam, isKillcamActive } from './replay/killcam.js';
import { adaptTick } from './ai/difficultyAdapter.js';
import { initOnlineEntry, isOnline, tickOnline, getOnlinePresentation } from './network/onlineSession.js';

// Shared animation state object for the player — same shape crossfade() expects
const playerAnim = { actions: null, currentClip: 'idle', _dbgName: 'player', _dbgTransitions: false, _dbgFlipMonitor: false };

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
let animationReview = null;
export function setAnimationReview(owner) { animationReview = owner; }
export function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  if (import.meta.env.DEV && animationReview) {
    animationReview.tick(dt);
    if (animationReview.getStatus().opened) {
      animationReview.render(); requestAnimationFrame(loop); return;
    }
  }
  restorePlayerWeaponHandling();
  tickOnline(dt);
  const onlinePose = getOnlinePresentation();

  // ── Touch look (consumed once per frame) ─────────────────────────
  if (!isOnline() && (touchLook.dx || touchLook.dy) && gameRunning && !player.dead) {
    player.yaw  -= touchLook.dx * TOUCH_SENS;
    player.pitch = Math.max(-1.38, Math.min(1.38, player.pitch - touchLook.dy * TOUCH_SENS));
    _tEuler.set(player.pitch, player.yaw, 0);
    camera.quaternion.setFromEuler(_tEuler);
  }
  touchLook.dx = touchLook.dy = 0;

  if (!isOnline()) tickGamepad(dt);

  const _t0 = performance.now();
  if (gameRunning || isOnline()) {
    if (!isOnline()) updatePlayer(dt);

    // ── Player body: GLTF mannequin if loaded, else procedural ───────
    // Always track eye position so first-frame 3rd-person switch shows body at the right spot.
    const bodyTarget = playerMesh || playerBody;
    const eyeH = (player.crouching || player.sliding) ? PLAYER_H_CROUCH : PLAYER_H;
    bodyTarget.position.set(camera.position.x, camera.position.y - eyeH, camera.position.z);
    // Mannequin faces +Z at rotation.y=0; player.yaw+PI makes it face forward (same as look dir)
    bodyTarget.rotation.y = (onlinePose?.bodyYaw ?? player.yaw) + Math.PI;

    // Presentation reads the simulation eye before render-only camera offsets.
    if (playerMesh && playerMixer && playerActions) {
      playerAnim.mesh = playerMesh; playerAnim.mixer = playerMixer; playerAnim.actions = playerActions;
      const exclusive = offlineActions.presentation;
      const damaged = playerAnim._previousHealth !== undefined && player.hp < playerAnim._previousHealth;
      playerAnim._previousHealth = player.hp;
      const fireTotal = player.weapon === 'awp' ? WEAPONS.awp.fireRate / 1000 : .2;
      const shotElapsed = (ts - player.shootCd) / 1000;
      if (player.dancing) {
        playerAnim._danceElapsed = (playerAnim._danceElapsed ?? 0) + dt;
        if (playerAnim._danceElapsed >= (playerActions.dance?.getClip().duration ?? 1)) player.dancing = false;
      } else playerAnim._danceElapsed = 0;
      const action = exclusive.kind === 'throw' || exclusive.kind === 'melee'
        ? { kind: exclusive.kind, elapsed: exclusive.elapsed, total: exclusive.duration, variant: player.punchClip }
        : player.reloading ? { kind: 'reload', total: player.reloadTotal / 1000, remaining: player.reloadTimer / 1000 }
        : player.rollTimer > 0 ? { kind: 'roll', total: ROLL_ANIM_DUR, remaining: player.rollTimer }
        : player.dancing ? { kind: 'dance', total: playerActions.dance?.getClip().duration ?? 1,
          elapsed: playerAnim._danceElapsed }
        : player.shootCd > 0 && shotElapsed >= 0 && shotElapsed < fireTotal
          ? { kind: 'fire', total: fireTotal, elapsed: shotElapsed } : { kind: 'ready' };
      tickPresentation(playerAnim, {
        identity: 'local', generation: exclusive.generation,
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        sampleTimeSeconds: ts / 1000, bodyYaw: player.yaw, aimYaw: player.yaw, pitch: player.pitch,
        crouching: player.crouching || player.sliding, onGround: player.onGround,
        verticalVelocity: player.velY, sprinting: !!(keys.ShiftLeft || keys.ShiftRight),
        weapon: player.weapon, alive: !player.dead, aiming: player.aiming, action,
        trustedDamage: damaged,
        ...onlinePose,
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
      }, dt, false);
      setDebugAnimClip(playerAnim.currentClip);
    } else setDebugAnimClip('no GLTF (procedural)');

    if (!isOnline()) {
    updateEnemies(ts, dt);
    if (activeDrone && (!activeDrone.dead || activeDrone.dying)) updateDrone(activeDrone, dt);
    for (const d of sndDrones) updateSndDrone(d, dt);
    tickTorches(dt);
    tickWave(dt, enemies, spawnEnemyIntoSlot);
    adaptTick(dt);
    tickMeleeRing(dt, camera.position.x, camera.position.z);
    getMode()?.tick(dt, keys);
    }
  }

  // ── Player mixer ticks even when dead so death animation plays ───
  if (playerMesh && playerMixer) {
    finishPresentation(playerAnim, dt);
    updatePlayerWeaponHandling(gameRunning || isOnline() ? playerAnim.presentation
      : { weapon: player.weapon, alive: !player.dead, upper: 'ready' }, playerMesh);
    tickBoneFlipMonitor(playerAnim);
  }

  // ── 1p weapon death drop (runs even when dead) ───────────────────
  updateWeaponDeath(dt);

  // ── Transition lerp + visibility handoff ─────────────────────────
  tpTransition += (tpTarget - tpTransition) * Math.min(1, TP_SPEED * dt);
  const bodyVisible = tpTransition > 0.05;
  wpn3p.visible = !player.throwingNade && !player.punching && !player.dancing;
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

  updateFirstPersonRig(playerFirstPersonRig, { pose: playerAnim.presentation,
    camera, weapon: wpn, dt,
    active: (gameRunning || isOnline()) && !isKillcamActive(), thirdPerson: bodyVisible,
    spineQuaternion: playerAnim._presentationCorrection?.get(playerMesh?.getObjectByName('spine_03')),
    rawCorrections: playerWeaponHandling.get(`3p:${player.weapon}`)?.corrections,
    eyeHeight: PLAYER_H });

  try {
    renderFirstPersonRig(playerFirstPersonRig, { weapon: wpn, worldWeapon: wpn3p,
      firstPerson: !bodyVisible, active: (gameRunning || isOnline()) && !isKillcamActive() },
    () => renderComicScene(renderer, scene, camera));
  } finally {
    // Movement reads the simulation eye even if a GPU/render callback throws.
    if (!isKillcamActive()) camera.position.set(eyeX, eyeY, eyeZ);
  }

  drawHUD();
  requestAnimationFrame(loop);
}

// Console helper for third-person problems: reports where the 3p weapon group
// actually lives in the scene graph, whether anything in it is visible, and the
// state of the first/third person blend. window.__debug3p()
// Reads one bone's current local quaternion off the player rig — used by the
// aim-layer test and handy when diagnosing a pose by hand.
window.__THREE = THREE;
window.__handRef = () => playerMesh?.getObjectByName('hand_r');
window.__bodyRef = () => playerMesh;
window.__presentationDebug = () => playerAnim.presentation ? structuredClone({
  ...playerAnim.presentation, layers: inspectPresentationLayers(playerAnim),
}) : null;

window.__debugBone = (name) => {
  const b = playerMesh?.getObjectByName(name);
  return b ? b.quaternion.toArray() : null;
};

window.__debug3p = () => {
  const chain = [];
  for (let n = wpn3p.parent; n; n = n.parent) chain.push(n.name || n.type);
  const groups = wpn3p.children.map(
    (g) => `${g.name || g.type}:vis=${g.visible},meshes=${g.children.length}`
  );
  const wp = new THREE.Vector3(), ws = new THREE.Vector3();
  wpn3p.getWorldPosition(wp);
  wpn3p.getWorldScale(ws);
  const bb = new THREE.Box3().setFromObject(wpn3p);
  const bs = bb.isEmpty() ? new THREE.Vector3() : bb.getSize(new THREE.Vector3());
  const camDist = camera.position.distanceTo(wp);
  const info = {
    thirdPerson, tpTransition: +tpTransition.toFixed(3),
    playerMesh: playerMesh ? `vis=${playerMesh.visible},inScene=${!!playerMesh.parent}` : 'NONE',
    playerBodyVisible: playerBody.visible,
    weapon3pParent: chain.join(' < ') || 'DETACHED',
    weapon3pVisible: wpn3p.visible,
    weapon3pWorldPos: `${wp.x.toFixed(2)},${wp.y.toFixed(2)},${wp.z.toFixed(2)}`,
    weapon3pLocalScale: `${wpn3p.scale.x.toFixed(3)}`,
    weapon3pWORLDscale: `${ws.x.toFixed(4)},${ws.y.toFixed(4)},${ws.z.toFixed(4)}`,
    weapon3pWorldSizeM: `${bs.x.toFixed(3)} x ${bs.y.toFixed(3)} x ${bs.z.toFixed(3)}`,
    distFromCamera: camDist.toFixed(2),
    frustumCulledFlags: wpn3p.children.flatMap(g=>g.children.map(m=>m.frustumCulled)).join(','),
    groups: groups.join(' | '),
    visibleWeaponBox: (() => {
      const g = wpn3p.children.find((c) => c.visible);
      if (!g) return 'none visible';
      const b = new THREE.Box3().setFromObject(g);
      if (b.isEmpty()) return 'empty';
      const s2 = b.getSize(new THREE.Vector3()), c2 = b.getCenter(new THREE.Vector3());
      return `size ${s2.x.toFixed(2)}x${s2.y.toFixed(2)}x${s2.z.toFixed(2)} @ ${c2.x.toFixed(2)},${c2.y.toFixed(2)},${c2.z.toFixed(2)}`;
    })(),
    bodyBox: (() => {
      if (!playerMesh) return 'none';
      const b = new THREE.Box3().setFromObject(playerMesh);
      const s2 = b.getSize(new THREE.Vector3()), c2 = b.getCenter(new THREE.Vector3());
      return `size ${s2.x.toFixed(2)}x${s2.y.toFixed(2)}x${s2.z.toFixed(2)} @ ${c2.x.toFixed(2)},${c2.y.toFixed(2)},${c2.z.toFixed(2)}`;
    })(),
    handWorld: (() => {
      const h = playerMesh?.getObjectByName('hand_r');
      if (!h) return 'none';
      const w = new THREE.Vector3(); h.getWorldPosition(w);
      return `${w.x.toFixed(2)},${w.y.toFixed(2)},${w.z.toFixed(2)}`;
    })(),
    fpWeaponVisible: wpn.visible,
  };
  console.table(info);
  return info;
};

export function startLoop() {
  initOnlineEntry();
  last = performance.now();
  requestAnimationFrame(loop);
}

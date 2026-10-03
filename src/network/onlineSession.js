// @ts-check
// @ts-ignore Three vendor declarations are absent; strict authority uses typed plain numbers.
import * as THREE from 'three';
import { Client } from '@colyseus/sdk';
import { MOUSE_SENS } from '../config.js';
import { camera, scene, renderer } from '../scene.js';
import { player } from '../entities/player.js';
import { keys, locked, setGameRunning, gameRunning } from '../input.js';
import { bunkerMapDef } from '../maps/bunker.js';
import { setActiveMap } from '../map.js';
import { buildLevel } from '../level.js';
import { deactivateAllEnemies } from '../entities/enemies.js';
import { clearAllDrones } from '../entities/drone.js';
import { buildEnemyMesh, disposeEnemyMesh, tintEnemyMesh, usingGLTF } from '../builders/enemyGLTF.js';
import { createRemoteActors, animateRemoteActor } from './remoteActors.js';
import { show1pWeapon, show3pWeapon } from '../builders/weapon.js';
import { spawnHitMarker, tickHitMarker } from '../hud/hitmarker.js';
import { spawnDamageNumber } from '../fx/damageNumbers.js';
import { updateHUD, showStatus } from '../hud/overlay.js';
import { updateWeapon, coolSpray } from '../combat/shoot.js';
import { tickImpacts } from '../fx/impacts.js';
import { tickTracers } from '../fx/tracers.js';
import { tickGrenadeParticles, tickSmokeCloud } from '../fx/particles.js';
import { cancelGrenadeThrow } from '../entities/grenades.js';
import { setMode, getMode } from '../modes/modeManager.js';
import { adaptStop } from '../ai/difficultyAdapter.js';
import { stopKillcam } from '../replay/killcam.js';

/** @typedef {InstanceType<typeof import('../../server/tdmRoom.js').MatchState>} State */
/** @typedef {import('../shared/tdmSimulation.js').Body} Body */
/** @typedef {import('../shared/combat.js').Hit} Hit */
/** @type {import('@colyseus/sdk').Room<State>|null} */ let room = null;
const actors = createRemoteActors(scene, {create:buildEnemyMesh,dispose:disposeEnemyMesh,tint:tintEnemyMesh,animate:animateRemoteActor});
let handlersInstalled = false;
let joining = false,
  seq = 0,
  yaw = 0,
  pitch = 0,
  fire = false,
  held = false,
  reload = false,
  jump = false,
  aiming = false;
let sessionEpoch = 0;
let lastSentTime = 0;
let lastTeamRejection = '';
let inputGeneration = '';
let displayedPhase = '';
let displayedAlive = true;
/** @type {Hit|null} */ let lastConfirmedHit = null;
let lastEventId = 0;
/** @type {string|null} */ let lastInputRejection = null;
/** @type {ReturnType<typeof setInterval>|null} */ let heartbeat = null;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const onlineKeys = /** @type {Record<string,boolean>} */ (keys);
const aimView = /** @type {{aimT:number}} */ (/** @type {unknown} */ (player));
const blockedKeys = new Set([
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'KeyF',
  'KeyG',
  'KeyT',
  'KeyQ',
  'KeyE',
  'KeyZ',
  'KeyB',
]);

export function isOnline() {
  return joining || room !== null;
}
/** @param {KeyboardEvent} event */
function onKeyDown(event) {
  if (!isOnline()) return;
  if (event.code === 'Space' && !event.repeat) jump = true;
  if (event.code === 'KeyR') {
    requestOnlineAction('reload');
    event.stopImmediatePropagation();
    event.preventDefault();
  } else if (blockedKeys.has(event.code)) {
    event.stopImmediatePropagation();
    event.preventDefault();
    showStatus('Online: M4, walk, sprint, jump, crouch, aim and reload');
  } else {
    onlineKeys[event.code] = true;
    sendIntent();
  }
}
/** @param {KeyboardEvent} event */
function onKeyUp(event) {
  if (isOnline()) {
    onlineKeys[event.code] = false;
    sendIntent();
  }
}
/** @param {MouseEvent} event */
function onMouseDown(event) {
  if (!isOnline() || /** @type {HTMLElement} */ (event.target)?.closest('button')) return;
  event.stopImmediatePropagation();
  event.preventDefault();
  if (event.button === 0) {
    held = true;
    requestOnlineAction('fire');
  } else if (event.button === 2) {
    aiming = true;
    sendIntent();
  }
}
/** Capture touch actions before the offline dispatcher; cross-device movement expands later.
 * @param {TouchEvent} event */
function onTouch(event) {
  if (
    !isOnline() ||
    /** @type {HTMLElement} */ (event.target)?.closest(
      '#mp-leave-btn, #pause-mainmenu-btn, #pause-resume-btn, #mp-match-controls button'
    )
  )
    return;
  event.stopImmediatePropagation();
  event.preventDefault();
  if (event.type === 'touchstart') showStatus('Online: use WASD, mouse and R in this slice');
}
/** @param {MouseEvent} event */
function onMouseUp(event) {
  if (isOnline()) {
    if (event.button === 0) held = false;
    if (event.button === 2) aiming = false;
    sendIntent();
    event.stopImmediatePropagation();
  }
}
/** @param {MouseEvent} event */
function onMouseMove(event) {
  if (!isOnline()) return;
  event.stopImmediatePropagation();
  if (!locked || document.hidden) return;
  yaw -= event.movementX * MOUSE_SENS;
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  pitch = Math.max(-1.38, Math.min(1.38, pitch - event.movementY * MOUSE_SENS));
}
function onBlur() {
  held = false;
  fire = false;
  reload = false;
  jump = false;
  aiming = false;
  for (const key of Object.keys(onlineKeys)) onlineKeys[key] = false;
  // Capture can run before the legacy locked binding updates. Retire queued
  // action edges immediately rather than waiting for the next heartbeat.
  sendIntent(true);
}
function onLockChange() {
  if (!document.pointerLockElement) onBlur();
}
function onVisibilityChange() {
  if (document.hidden) onBlur();
}
function installHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  for (const name of /** @type {const} */ (['touchstart', 'touchmove', 'touchend', 'touchcancel']))
    document.addEventListener(name, onTouch, { capture: true, passive: false });
}
function removeHandlers() {
  handlersInstalled = false;
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('keyup', onKeyUp, true);
  document.removeEventListener('mousedown', onMouseDown, true);
  document.removeEventListener('mouseup', onMouseUp, true);
  document.removeEventListener('mousemove', onMouseMove, true);
  window.removeEventListener('blur', onBlur);
  document.removeEventListener('pointerlockchange', onLockChange);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  for (const name of /** @type {const} */ (['touchstart', 'touchmove', 'touchend', 'touchcancel']))
    document.removeEventListener(name, onTouch, true);
}
/** @param {string} action */
export function requestOnlineAction(action) {
  if (!isOnline()) return false;
  if (!locked || document.hidden) return false;
  if (action === 'fire') fire = true;
  else if (action === 'reload') reload = true;
  else return false;
  return true;
}
/** @param {string} message */
function connectionError(message) {
  showStatus(`Online TDM: ${message}`, 5000);
}

export async function joinOnline() {
  if (isOnline()) return;
  joining = true;
  const epoch = ++sessionEpoch;
  onBlur();
  installHandlers();
  // Pointer lock requires the entry click's synchronous user activation.
  const canvas = document.getElementById('c');
  try {
    const lock = canvas?.requestPointerLock();
    lock?.catch(() => {});
  } catch {
    /* Browser may deny headless pointer lock. */
  }
  try {
    /** @type {import('@colyseus/sdk').Room<State>} */
    const joined = await new Client(location.origin).joinOrCreate('tdm', { protocolVersion: 1 });
    if (epoch !== sessionEpoch) {
      await joined.leave();
      return;
    }
    room = joined;
    seq = 0;
    yaw = 0;
    pitch = 0;
    lastConfirmedHit = null;
    lastEventId = 0;
    lastInputRejection = null;
    inputGeneration = '';
    displayedPhase = '';
    displayedAlive = true;
    room.onMessage('inputRejected', (/** @type {{reason:string}} */ rejection) => {
      if (room !== joined || epoch !== sessionEpoch) return;
      lastInputRejection = rejection.reason;
    });
    room.onMessage('teamRejected', (/** @type {{reason:string}} */ rejection) => {
      if (room !== joined || epoch !== sessionEpoch) return;
      lastTeamRejection = rejection.reason;
    });
    heartbeat = setInterval(sendHeartbeat, 1000 / 30);
    room.onMessage(
      'hit-confirmed',
      /** @param {Hit} event */ (event) => {
        if (room !== joined || epoch !== sessionEpoch) return;
        syncInputGeneration();
        const me = room?.state?.players?.get(room.sessionId);
        const target = room?.state.players.get(event.targetSessionId);
        if (
          !me ||
          event.shooterSessionId !== room?.sessionId ||
          event.matchGeneration !== room?.state.matchGeneration ||
          event.lifeGeneration !== me.lifeGeneration ||
          !target ||
          event.targetLifeGeneration !== target.lifeGeneration ||
          event.eventId <= lastEventId
        )
          return;
        lastEventId = event.eventId;
        lastConfirmedHit = event;
        spawnHitMarker();
        spawnDamageNumber(event.impact.x, event.impact.y, event.impact.z, event.damage);
      }
    );
    room.onError((_code, message) => connectionError(message ?? 'Connection failed'));
    room.onLeave(() => {
      if (room === joined) {
        void leaveOnline();
        setGameRunning(false);
        document.getElementById('overlay')?.style.setProperty('display', 'flex');
      }
    });
    cancelGrenadeThrow();
    adaptStop();
    stopKillcam();
    setMode(null);
    setActiveMap(bunkerMapDef);
    buildLevel(bunkerMapDef);
    deactivateAllEnemies();
    clearAllDrones();
    Object.assign(player, {
      weapon: 'm4',
      dead: false,
      sliding: false,
      diving: false,
      crouching: false,
      lean: 0,
      dancing: false,
      punching: false,
      aiming: false,
      aimT: 0,
      energy: 0,
    });
    show1pWeapon('m4');
    show3pWeapon('m4');
    document.getElementById('overlay')?.style.setProperty('display', 'none');
    document.getElementById('pause-menu')?.style.setProperty('display', 'none');
    document.getElementById('mp-leave-btn')?.removeAttribute('hidden');
    document.getElementById('snd-bar')?.style.setProperty('display', 'none');
    document.getElementById('buy-panel')?.style.setProperty('display', 'none');
    document.getElementById('buy-banner')?.style.setProperty('display', 'none');
    setGameRunning(true);
    installMatchControls();
  } catch (error) {
    if (epoch !== sessionEpoch) return;
    room = null;
    removeHandlers();
    connectionError(String(error));
  } finally {
    if (epoch === sessionEpoch) joining = false;
  }
}
function disposeActors() {
  actors.disposeRemoteActors();
}
export async function leaveOnline() {
  sessionEpoch++;
  const previous = room;
  room = null;
  joining = false;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  removeHandlers();
  disposeActors();
  onBlur();
  reload = false;
  lastConfirmedHit = null;
  document.getElementById('mp-leave-btn')?.setAttribute('hidden', '');
  document.getElementById('tdm-bar')?.style.setProperty('display', 'none');
  document.getElementById('mp-match-controls')?.remove();
  if (previous) await previous.leave().catch(() => {});
}

/** @param {boolean} [forceNeutral] */
function sendIntent(forceNeutral = false) {
  if (!room?.state?.players) return;
  syncInputGeneration();
  const me = room.state.players.get(room.sessionId);
  if (!me) return;
  lastSentTime = performance.now();
  if (seq === 2147483647) {
    connectionError('Input sequence exhausted. Leave and join again.');
    void leaveOnline();
    return;
  }
  const active =
    !forceNeutral && locked && !document.hidden && me.alive && room.state.phase === 'active';
  room.send('input', {
    protocolVersion: 1,
    seq: ++seq,
    ackTick: room.state.currentTick ?? 0,
    matchGeneration: room.state.matchGeneration,
    lifeGeneration: me.lifeGeneration,
    moveX: active ? Number(!!onlineKeys.KeyD) - Number(!!onlineKeys.KeyA) : 0,
    moveZ: active ? Number(!!onlineKeys.KeyW) - Number(!!onlineKeys.KeyS) : 0,
    yaw,
    pitch,
    fire: active && (fire || held),
    reload: active && reload,
    sprint: active && !!(onlineKeys.ShiftLeft || onlineKeys.ShiftRight),
    jump: active && jump,
    crouch: active && !!(onlineKeys.ControlLeft || onlineKeys.ControlRight || onlineKeys.KeyC),
    aiming: active && aiming,
    neutral: !active,
  });
  fire = false;
  reload = false;
  jump = false;
}
function sendHeartbeat() {
  if (performance.now() - lastSentTime >= 1000 / 30) sendIntent();
}

/** @param {number} dt */
export function tickOnline(dt) {
  if (!room?.state?.players) return;
  sendHeartbeat();
  tickHitMarker(dt);
  tickImpacts(dt);
  tickTracers(dt);
  tickGrenadeParticles(dt);
  tickSmokeCloud(dt);
  coolSpray(dt);
  const me = room.state.players.get(room.sessionId);
  if (me) {
    camera.position.set(me.x, me.y, me.z);
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);
    Object.assign(player, {
      yaw,
      pitch,
      hp: me.health,
      ammo: me.ammo,
      reserve: me.reserve,
      dead: !me.alive,
      moving: me.moving,
      onGround: me.onGround,
      velY: me.verticalVelocity,
      crouching: me.crouching,
      aiming: me.aiming,
      reloading: me.reloadRemaining > 0,
      reloadTimer: me.reloadRemaining * 1000,
      reloadTotal: 1800,
    });
    aimView.aimT += ((me.aiming ? 1 : 0) - aimView.aimT) * Math.min(1, dt * 14);
    updateHUD();
    document.getElementById('tdm-bar')?.style.setProperty('display', 'block');
    const label = document.getElementById('tdm-label');
    if (label) label.textContent = `ONLINE · ${me.team.toUpperCase()}`;
    const us = document.getElementById('tdm-us'),
      them = document.getElementById('tdm-them');
    if (us)
      us.textContent = String(me.team === 'blue' ? room.state.scoreBlue : room.state.scoreRed);
    if (them)
      them.textContent = String(me.team === 'blue' ? room.state.scoreRed : room.state.scoreBlue);
    const seconds = Math.ceil(room.state.timeRemaining);
    const timer = document.getElementById('tdm-timer');
    if (timer)
      timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const limit = document.getElementById('tdm-limit');
    if (limit) limit.textContent = `FIRST TO ${room.state.settings.killLimit}`;
    document
      .getElementById('reloadwrap')
      ?.style.setProperty('display', me.reloadRemaining > 0 ? 'block' : 'none');
    updateWeapon(dt, me.moving, me.sprinting, me.crouching, false);
    const switchButton = /** @type {HTMLButtonElement|null} */ (
      document.getElementById('mp-switch-team')
    );
    if (switchButton) switchButton.disabled = me.alive && room.state.phase !== 'results';
    const rejection = document.getElementById('mp-team-rejection');
    if (rejection)
      rejection.textContent = lastTeamRejection
        ? `Team switch rejected: ${lastTeamRejection.replace(/_/g, ' ')}`
        : '';
    renderMatchState(me);
  }
  actors.syncRemoteActors({sessionId:room.sessionId,matchGeneration:room.state.matchGeneration,currentTick:room.state.currentTick,players:room.state.players.values()},dt);
}

/** @template T @param {T} value @returns {T} */
function frozen(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
export function getOnlineSnapshot() {
  const s = room?.state;
  // Legacy Player declarations omit these existing presentation fields.
  const view =
    /** @type {{weapon:string,punching:boolean,throwingNade:boolean,dancing:boolean,aiming:boolean}} */ (
      /** @type {unknown} */ (player)
    );
  return frozen({
    sessionId: room?.sessionId ?? null,
    roomId: room?.roomId ?? null,
    mapId: s?.mapId ?? null,
    matchGeneration: s?.matchGeneration ?? 0,
    currentTick: s?.currentTick ?? 0,
    inputSeq: seq,
    inputLocked: locked,
    lastInputRejection,
    simulationEye: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    cameraFov: camera.fov,
    aimT: aimView.aimT,
    phase: s?.phase ?? 'offline',
    score: { alpha: s?.scoreAlpha ?? 0, bravo: s?.scoreBravo ?? 0 },
    timeRemaining: s?.timeRemaining ?? 0,
    settings: s?.settings?.toJSON() ?? null,
    scoreBlue: s?.scoreBlue ?? 0,
    scoreRed: s?.scoreRed ?? 0,
    lastTeamRejection,
    winner: s?.winner ?? '',
    nowMs: s?.nowMs ?? 0,
    startedAtMs: s?.startedAtMs ?? 0,
    endsAtMs: s?.endsAtMs ?? 0,
    resultsEndsAtMs: s?.resultsEndsAtMs ?? 0,
    resultsRemaining: s?.resultsRemaining ?? 0,
    presentation: {
      weapon: view.weapon,
      punching: view.punching,
      throwingNade: view.throwingNade,
      dancing: view.dancing,
      aiming: view.aiming,
      mode: getMode()?.name ?? null,
      gameRunning,
    },
    players: s?.players ? Array.from(s.players.values(), (p) => ({ ...p.toJSON() })) : [],
    remoteActorCount: actors.size,
    remoteActors: actors.inspect().actors,
    remoteResourceCounts: {created:actors.inspect().created,disposed:actors.inspect().disposed},
    renderMemory: { ...renderer.info.memory },
    inputHandlerCount: handlersInstalled ? 12 : 0,
    usingGLTF,
    inputKeys: { ...onlineKeys },
    lastConfirmedHit: lastConfirmedHit ? structuredClone(lastConfirmedHit) : null,
  });
}
Object.defineProperty(window, '__mpDebug', {
  value: getOnlineSnapshot,
  writable: false,
  configurable: false,
});

function installMatchControls() {
  document.getElementById('mp-match-controls')?.remove();
  lastTeamRejection = '';
  const panel = document.createElement('div');
  panel.id = 'mp-match-controls';
  panel.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:120;color:white;font:14px monospace;background:#111b;padding:10px;max-width:320px';
  const button = document.createElement('button');
  button.id = 'mp-switch-team';
  button.textContent = 'Switch team';
  button.addEventListener('click', () => {
    const me = room?.state.players.get(room.sessionId);
    if (!room || !me) return;
    lastTeamRejection = '';
    room.send('switch-team', {
      protocolVersion: 1,
      matchGeneration: room.state.matchGeneration,
      lifeGeneration: me.lifeGeneration,
      team: me.team === 'blue' ? 'red' : 'blue',
    });
  });
  const text = document.createElement('div');
  text.id = 'mp-team-rejection';
  panel.append(button, text);
  const settings = document.createElement('div');
  settings.id = 'mp-rules-label';
  const respawn = document.createElement('div');
  respawn.id = 'mp-respawn';
  const results = document.createElement('section');
  results.id = 'mp-results';
  results.hidden = true;
  for (const id of [
    'mp-result-title',
    'mp-result-score',
    'mp-result-countdown',
    'mp-result-stats',
  ]) {
    const row = document.createElement('div');
    row.id = id;
    results.append(row);
  }
  const resume = document.createElement('button');
  resume.id = 'mp-resume';
  resume.textContent = 'Resume';
  resume.hidden = true;
  resume.addEventListener('click', () => {
    try {
      document
        .getElementById('c')
        ?.requestPointerLock()
        ?.catch(() => {});
    } catch {
      /* Browser reports failed lock. */
    }
  });
  panel.append(settings, respawn, results, resume);
  const leave = document.createElement('button');
  leave.id = 'mp-match-leave';
  leave.textContent = 'Leave online';
  leave.addEventListener('click', () => document.getElementById('pause-mainmenu-btn')?.click());
  panel.append(leave);
  document.body.append(panel);
}

function syncInputGeneration() {
  const me = room?.state.players.get(room.sessionId);
  if (!me || !room) return;
  const generation = `${sessionEpoch}/${room.state.matchGeneration}/${me.lifeGeneration}`;
  if (generation === inputGeneration) return;
  inputGeneration = generation;
  seq = 0;
  lastEventId = 0;
  lastConfirmedHit = null;
  lastTeamRejection = '';
  held = fire = reload = jump = aiming = false;
  for (const key of Object.keys(onlineKeys)) onlineKeys[key] = false;
  yaw = me.yaw;
  pitch = me.pitch;
}

/** @param {InstanceType<typeof import('../../server/tdmRoom.js').PlayerState>} me */
function renderMatchState(me) {
  if (!room) return;
  const state = room.state;
  const results = state.phase === 'results';
  if (!me.alive && displayedAlive) document.exitPointerLock?.();
  displayedAlive = me.alive;
  if (displayedPhase !== state.phase) {
    displayedPhase = state.phase;
    onBlur();
    if (results) document.exitPointerLock?.();
  }
  const panel = document.getElementById('mp-results');
  if (panel) panel.hidden = !results;
  const setText = (/** @type {string} */ id, /** @type {string} */ value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText(
    'mp-rules-label',
    `${state.settings.killLimit} kills · ${state.settings.matchSeconds}s · friendly damage ${state.settings.friendlyFire * 100}%`
  );
  setText(
    'mp-respawn',
    !me.alive && state.phase === 'active'
      ? me.respawnAtMs >= 0
        ? `Respawn in ${Math.ceil(Math.max(0, me.respawnAtMs - state.nowMs) / 1000)}s`
        : 'Waiting for a free spawn'
      : ''
  );
  if (results) {
    document.getElementById('pause-menu')?.style.setProperty('display', 'none');
    setText(
      'mp-result-title',
      state.winner === 'draw' ? 'DRAW' : `${state.winner.toUpperCase()} WINS`
    );
    setText('mp-result-score', `BLUE ${state.scoreBlue} — ${state.scoreRed} RED`);
    setText('mp-result-countdown', `Rematch in ${Math.ceil(state.resultsRemaining)}s`);
    setText(
      'mp-result-stats',
      Array.from(
        state.players.values(),
        (p) => `${p.nickname}: ${p.kills} kills / ${p.deaths} deaths`
      ).join(' · ')
    );
  }
  if (!me.alive) document.getElementById('pause-menu')?.style.setProperty('display', 'none');
  const resume = document.getElementById('mp-resume');
  if (resume) resume.hidden = results || state.phase !== 'active' || locked;
}

// Called by the asset-ready loop; main owns the single explicit entry handler.
export function initOnlineEntry() {
  const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('mp-join-btn'));
  if (button && document.getElementById('mp-leave-btn')) button.disabled = false;
}

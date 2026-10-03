// @ts-check
// @ts-ignore Three vendor declarations are absent; strict authority uses typed plain numbers.
import * as THREE from 'three';
import { Client } from '@colyseus/sdk';
import { PLAYER_H, MOUSE_SENS } from '../config.js';
import { camera } from '../scene.js';
import { player } from '../entities/player.js';
import { keys, setGameRunning, gameRunning } from '../input.js';
import { bunkerMapDef } from '../maps/bunker.js';
import { setActiveMap } from '../map.js';
import { buildLevel } from '../level.js';
import { deactivateAllEnemies } from '../entities/enemies.js';
import { clearAllDrones } from '../entities/drone.js';
import { buildEnemyMesh, disposeEnemyMesh, usingGLTF } from '../builders/enemyGLTF.js';
import { enterLocoMode, setLocoWeights, crossfade } from '../builders/enemyAnimations.js';
import { show1pWeapon, show3pWeapon } from '../builders/weapon.js';
import { spawnHitMarker, tickHitMarker } from '../hud/hitmarker.js';
import { spawnDamageNumber } from '../fx/damageNumbers.js';
import { updateHUD, showStatus } from '../hud/overlay.js';
import { updateWeapon } from '../combat/shoot.js';
import { cancelGrenadeThrow } from '../entities/grenades.js';
import { setMode, getMode } from '../modes/modeManager.js';
import { adaptStop } from '../ai/difficultyAdapter.js';
import { stopKillcam } from '../replay/killcam.js';

/** @typedef {InstanceType<typeof import('../../server/tdmRoom.js').MatchState>} State */
/** @typedef {import('../shared/tdmSimulation.js').Body} Body */
/** @typedef {{targetSessionId:string,matchGeneration:number,lifeGeneration:number,targetLifeGeneration:number,shotId:number,eventId:number,damage:number,impact:{x:number,y:number,z:number}}} Hit */
/** @type {import('@colyseus/sdk').Room<State>|null} */ let room = null;
/** @type {Map<string, ReturnType<typeof buildEnemyMesh> & {currentClip:string}>} */ const actors =
  new Map();
let joining = false,
  seq = 0,
  sendTimer = 0,
  yaw = 0,
  pitch = 0,
  fire = false,
  held = false,
  reload = false;
let sessionEpoch = 0;
/** @type {Hit|null} */ let lastConfirmedHit = null;
let lastEventId = 0;
/** @type {ReturnType<typeof setInterval>|null} */ let heartbeat = null;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const onlineKeys = /** @type {Record<string,boolean>} */ (keys);
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
  'Space',
  'ControlLeft',
  'ControlRight',
  'KeyC',
  'ShiftLeft',
  'ShiftRight',
]);

export function isOnline() {
  return joining || room !== null;
}
/** @param {KeyboardEvent} event */
function onKeyDown(event) {
  if (!isOnline()) return;
  if (event.code === 'KeyR') {
    requestOnlineAction('reload');
    event.stopImmediatePropagation();
    event.preventDefault();
  } else if (blockedKeys.has(event.code)) {
    event.stopImmediatePropagation();
    event.preventDefault();
    showStatus('Online: M4, walk and reload');
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
  } else showStatus('Online: M4, walk and reload');
}
/** Capture touch actions before the offline dispatcher; cross-device movement expands later.
 * @param {TouchEvent} event */
function onTouch(event) {
  if (!isOnline() || /** @type {HTMLElement} */ (event.target)?.closest('#mp-leave-btn, #pause-mainmenu-btn, #pause-resume-btn')) return;
  event.stopImmediatePropagation();
  event.preventDefault();
  if (event.type === 'touchstart') showStatus('Online: use WASD, mouse and R in this slice');
}
/** @param {MouseEvent} event */
function onMouseUp(event) {
  if (isOnline()) {
    if (event.button === 0) held = false;
    event.stopImmediatePropagation();
  }
}
/** @param {MouseEvent} event */
function onMouseMove(event) {
  if (!isOnline()) return;
  event.stopImmediatePropagation();
  yaw -= event.movementX * MOUSE_SENS;
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  pitch = Math.max(-1.38, Math.min(1.38, pitch - event.movementY * MOUSE_SENS));
}
function onBlur() {
  held = false;
  fire = false;
  for (const key of Object.keys(onlineKeys)) onlineKeys[key] = false;
}
function installHandlers() {
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('blur', onBlur);
  for (const name of /** @type {const} */ (['touchstart', 'touchmove', 'touchend', 'touchcancel']))
    document.addEventListener(name, onTouch, { capture: true, passive: false });
}
function removeHandlers() {
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('keyup', onKeyUp, true);
  document.removeEventListener('mousedown', onMouseDown, true);
  document.removeEventListener('mouseup', onMouseUp, true);
  document.removeEventListener('mousemove', onMouseMove, true);
  window.removeEventListener('blur', onBlur);
  for (const name of /** @type {const} */ (['touchstart', 'touchmove', 'touchend', 'touchcancel']))
    document.removeEventListener(name, onTouch, true);
}
/** @param {string} action */
export function requestOnlineAction(action) {
  if (!isOnline()) return false;
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
    if (epoch !== sessionEpoch) { await joined.leave(); return; }
    room = joined;
    seq = 0;
    yaw = 0;
    pitch = 0;
    lastConfirmedHit = null;
    lastEventId = 0;
    heartbeat = setInterval(sendIntent, 1000 / 30);
    room.onMessage(
      'hit',
      /** @param {Hit} event */ (event) => {
        const me = room?.state?.players?.get(room.sessionId);
        if (
          !me ||
          event.matchGeneration !== room?.state.matchGeneration ||
          event.lifeGeneration !== me.lifeGeneration ||
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
  for (const actor of actors.values()) disposeEnemyMesh(actor.mesh, actor.mixer);
  actors.clear();
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
  if (previous) await previous.leave().catch(() => {});
}

function sendIntent() {
  if (!room?.state?.players) return;
  const me = room.state.players.get(room.sessionId);
  if (!me) return;
  room.send('input', {
    protocolVersion: 1,
    seq: ++seq,
    matchGeneration: room.state.matchGeneration,
    lifeGeneration: me.lifeGeneration,
    moveX: Number(!!onlineKeys.KeyD) - Number(!!onlineKeys.KeyA),
    moveZ: Number(!!onlineKeys.KeyW) - Number(!!onlineKeys.KeyS),
    yaw,
    pitch,
    fire: fire || held,
    reload,
  });
  fire = false;
  reload = false;
}

/** @param {number} dt */
export function tickOnline(dt) {
  if (!room?.state?.players) return;
  tickHitMarker(dt);
  const me = room.state.players.get(room.sessionId);
  if (me) {
    sendTimer += dt;
    if (sendTimer >= 1 / 30) {
      sendTimer %= 1 / 30;
      sendIntent();
    }
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
      onGround: true,
      reloading: me.reloadRemaining > 0,
      reloadTimer: me.reloadRemaining * 1000,
      reloadTotal: 1800,
    });
    updateHUD();
    document.getElementById('tdm-bar')?.style.setProperty('display', 'block');
    const label = document.getElementById('tdm-label');
    if (label) label.textContent = `ONLINE · ${me.team.toUpperCase()}`;
    const us = document.getElementById('tdm-us'), them = document.getElementById('tdm-them');
    if (us) us.textContent = String(me.team === 'alpha' ? room.state.scoreAlpha : room.state.scoreBravo);
    if (them) them.textContent = String(me.team === 'alpha' ? room.state.scoreBravo : room.state.scoreAlpha);
    const seconds = Math.ceil(room.state.timeRemaining);
    const timer = document.getElementById('tdm-timer');
    if (timer) timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    document.getElementById('reloadwrap')?.style.setProperty('display', me.reloadRemaining > 0 ? 'block' : 'none');
    updateWeapon(dt, me.moving, false, false, false);
  }
  const active = new Set();
  room.state.players.forEach((p) => {
    if (p.sessionId === room?.sessionId) return;
    active.add(p.sessionId);
    let actor = actors.get(p.sessionId);
    if (!actor) {
      actor = { ...buildEnemyMesh(p.x, p.z, 'assault'), currentClip: 'idle' };
      actors.set(p.sessionId, actor);
    }
    actor.mesh.position.set(p.x, p.y - PLAYER_H, p.z);
    actor.mesh.rotation.y = p.yaw + actor.facingOffset;
    if (!p.alive) crossfade(actor, 'death', 0.2);
    else {
      enterLocoMode(actor);
      setLocoWeights(actor.actions, p.moving ? 0.45 : 0, 0);
    }
    actor.mixer?.update(dt);
  });
  for (const [id, actor] of actors)
    if (!active.has(id)) {
      disposeEnemyMesh(actor.mesh, actor.mixer);
      actors.delete(id);
    }
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
  const view = /** @type {{weapon:string,punching:boolean,throwingNade:boolean,dancing:boolean,aiming:boolean}} */ (/** @type {unknown} */ (player));
  return frozen({
    sessionId: room?.sessionId ?? null,
    roomId: room?.roomId ?? null,
    mapId: s?.mapId ?? null,
    matchGeneration: s?.matchGeneration ?? 0,
    phase: s?.phase ?? 'offline',
    score: { alpha: s?.scoreAlpha ?? 0, bravo: s?.scoreBravo ?? 0 },
    timeRemaining: s?.timeRemaining ?? 0,
    presentation: { weapon: view.weapon, punching: view.punching, throwingNade: view.throwingNade, dancing: view.dancing, aiming: view.aiming, mode: getMode()?.name ?? null, gameRunning },
    players: s?.players ? Array.from(s.players.values(), (p) => ({ ...p.toJSON() })) : [],
    remoteActorCount: actors.size,
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

// Called by the asset-ready loop; main owns the single explicit entry handler.
export function initOnlineEntry() {
  const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('mp-join-btn'));
  if (button && document.getElementById('mp-leave-btn')) button.disabled = false;
}

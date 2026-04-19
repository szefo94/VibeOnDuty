import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { CELL, PLAYER_H, MAX_HP } from '../config.js';
import { player } from '../entities/player.js';
import { showMsg } from '../hud/overlay.js';
import { setGameRunning } from '../input.js';

// ── Constants ─────────────────────────────────────────────────────────────
const PLANT_RANGE = 2.5;
const DEFUSE_RANGE = 2.2;
const PLANT_TIME = 3.0;
const DEFUSE_TIME = 5.0;
const BOMB_FUSE = 40.0;

// ── Bomb sites — west side interior, away from attacker spawn ────────────
// col 8 open cells: rows 7 and 17 both clear in The Ring map
const SITES = [
  { id: 'A', x: 8 * CELL + CELL / 2, z: 7 * CELL + CELL / 2 },
  { id: 'B', x: 8 * CELL + CELL / 2, z: 17 * CELL + CELL / 2 },
];

// Attacker spawn — east side interior, far from both sites
const ATTACKER_X = 16 * CELL + CELL / 2;
const ATTACKER_Z = 11 * CELL + CELL / 2;

// ── State ─────────────────────────────────────────────────────────────────
// 'idle' | 'live' | 'planting' | 'planted' | 'over'
export let sndState = 'idle';
let activeSite = null;
let bombWorldX = 0, bombWorldZ = 0;
let fuseTimer = 0;
let plantProgress = 0;
let defuseProgress = 0;
let enemyDefuseFlag = false;  // set by enemies.js each frame

// ── 3D objects ────────────────────────────────────────────────────────────
let bombMesh = null, bombLight = null;

function createSiteMarkers() {
  for (const site of SITES) {
    // Ground ring — large and bright
    const ringGeo = new THREE.RingGeometry(0.8, 1.3, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(site.x, 0.05, site.z);
    scene.add(ring);

    // Vertical beacon pole
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.6 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(site.x, 1.4, site.z);
    scene.add(pole);

    // Point light beacon
    const light = new THREE.PointLight(0xffcc00, 1.5, 6);
    light.position.set(site.x, 2.6, site.z);
    scene.add(light);

    site.ring = ring;
    site.pole = pole;
    site.light = light;
  }
}

function createBombMesh(x, z) {
  const geo = new THREE.BoxGeometry(0.28, 0.13, 0.18);
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2200, emissiveIntensity: 1 });
  bombMesh = new THREE.Mesh(geo, mat);
  bombMesh.position.set(x, 0.1, z);
  scene.add(bombMesh);

  bombLight = new THREE.PointLight(0xff2200, 2.0, 5);
  bombLight.position.set(x, 0.5, z);
  scene.add(bombLight);
}

function removeBombMesh() {
  if (bombMesh) { scene.remove(bombMesh); bombMesh = null; }
  if (bombLight) { scene.remove(bombLight); bombLight = null; }
}

function removeSiteMarkers() {
  for (const site of SITES) {
    if (site.ring)  { scene.remove(site.ring);  site.ring  = null; }
    if (site.pole)  { scene.remove(site.pole);  site.pole  = null; }
    if (site.light) { scene.remove(site.light); site.light = null; }
  }
}

// ── Public API ────────────────────────────────────────────────────────────
export function getSndSitePositions() {
  return SITES.map((s) => [s.x, s.z]);
}

export function getSndBombPos() {
  return sndState === 'planted' ? [bombWorldX, bombWorldZ] : null;
}

export function isSndActive() {
  return sndState !== 'idle' && sndState !== 'over';
}

// Called from enemies.js when an enemy is within DEFUSE_RANGE of bomb
export function markEnemyDefusing() {
  enemyDefuseFlag = true;
}

export function getSndDefuseRange() { return DEFUSE_RANGE; }

export function onSndPlayerDeath() {
  if (sndState === 'live' || sndState === 'planting') {
    endRound('loss_killed');
  }
  // If 'planted': game keeps running — bomb still ticks, enemies defuse
}

export function startSnd() {
  sndState = 'live';
  plantProgress = 0;
  defuseProgress = 0;
  fuseTimer = 0;
  activeSite = null;
  bombWorldX = bombWorldZ = 0;
  player.dead = false;
  player.hp = MAX_HP;
  camera.position.set(ATTACKER_X, PLAYER_H, ATTACKER_Z);
  removeBombMesh();
  createSiteMarkers();
  setSndHudVisible(true);
  updateBombTimerHUD(BOMB_FUSE, BOMB_FUSE);
  hidePlantBar();
  hideDefuseBar();
  hideSndResult();
  hideBombBarWrap();
}

export function nextSndRound() {
  removeBombMesh();
  removeSiteMarkers();
  plantProgress = 0;
  defuseProgress = 0;
  fuseTimer = 0;
  activeSite = null;
  bombWorldX = bombWorldZ = 0;
  player.dead = false;
  player.hp = MAX_HP;
  camera.position.set(ATTACKER_X, PLAYER_H, ATTACKER_Z);
  sndState = 'live';
  createSiteMarkers();
  setSndHudVisible(true);
  updateBombTimerHUD(BOMB_FUSE, BOMB_FUSE);
  hidePlantBar();
  hideDefuseBar();
  hideSndResult();
  hideBombBarWrap();
}

// ── Main tick — called from loop.js ──────────────────────────────────────
export function tickSnd(dt, keys) {
  if (sndState === 'idle' || sndState === 'over') return;

  if (sndState === 'planted') {
    fuseTimer -= dt;
    updateBombTimerHUD(Math.max(0, fuseTimer), BOMB_FUSE);

    const blinkHz = 1 + (1 - fuseTimer / BOMB_FUSE) * 6;
    const blink = Math.abs(Math.sin(performance.now() / 1000 * Math.PI * blinkHz));
    if (bombLight) bombLight.intensity = 1.0 + blink * 2.0;
    if (bombMesh) bombMesh.material.emissiveIntensity = 0.5 + blink;

    // Enemy defuse
    if (enemyDefuseFlag) {
      defuseProgress += dt / DEFUSE_TIME;
      updateDefuseBar(defuseProgress);
      if (defuseProgress >= 1) { endRound('loss_defused'); return; }
    } else {
      defuseProgress = Math.max(0, defuseProgress - dt * 0.3);
      updateDefuseBar(defuseProgress);
    }
    enemyDefuseFlag = false;

    if (fuseTimer <= 0) { endRound('win_explode'); return; }
    return;
  }

  // Pulse site markers
  const pulse = 0.5 + 0.35 * Math.abs(Math.sin(performance.now() / 600));
  for (const site of SITES) {
    if (site.ring)  site.ring.material.opacity = pulse;
    if (site.light) site.light.intensity = 1.0 + 1.5 * Math.abs(Math.sin(performance.now() / 450));
  }

  // Plant logic
  const px = camera.position.x, pz = camera.position.z;
  let nearSite = null;
  for (const site of SITES) {
    const dx = px - site.x, dz = pz - site.z;
    if (dx * dx + dz * dz < PLANT_RANGE * PLANT_RANGE) { nearSite = site; break; }
  }

  if (nearSite && sndState !== 'planting') showPlantHint(nearSite.id);
  else if (!nearSite) hidePlantHint();

  const gPressed = keys['KeyG'] && !player.dead;

  if (nearSite && gPressed) {
    sndState = 'planting';
    plantProgress = Math.min(1, plantProgress + dt / PLANT_TIME);
    updatePlantBar(plantProgress);
    if (plantProgress >= 1) {
      bombWorldX = nearSite.x;
      bombWorldZ = nearSite.z;
      activeSite = nearSite;
      sndState = 'planted';
      fuseTimer = BOMB_FUSE;

      if (nearSite.ring) { scene.remove(nearSite.ring); nearSite.ring = null; }
      createBombMesh(bombWorldX, bombWorldZ);
      hidePlantBar();
      showBombBarWrap();
      showMsg('BOMB PLANTED — DETONATING IN ' + BOMB_FUSE + 's', 3000);
    }
  } else {
    if (sndState === 'planting') {
      sndState = 'live';
      plantProgress = 0;
      hidePlantBar();
    }
    enemyDefuseFlag = false;
  }
}

// ── Round end ─────────────────────────────────────────────────────────────
function endRound(result) {
  if (sndState === 'over') return;
  sndState = 'over';
  removeBombMesh();
  removeSiteMarkers();
  setGameRunning(false);
  document.exitPointerLock?.();
  hideBombBarWrap();
  hideDefuseBar();
  hidePlantBar();

  const messages = {
    win_explode:  ['BOMB DETONATED', 'MISSION COMPLETE', '#e74c3c'],
    loss_defused: ['BOMB DEFUSED', 'MISSION FAILED', '#3498db'],
    loss_killed:  ['KILLED IN ACTION', 'MISSION ABORTED', '#e74c3c'],
  };
  const [title, sub, color] = messages[result] || ['ROUND OVER', '', '#fff'];
  showSndResult(title, sub, color);
}

// ── HUD helpers ───────────────────────────────────────────────────────────
function setSndHudVisible(v) {
  const el = document.getElementById('snd-bar');
  if (el) el.style.display = v ? 'block' : 'none';
}
function updateBombTimerHUD(remaining, total) {
  const timer = document.getElementById('snd-bomb-timer');
  if (timer) timer.textContent = Math.ceil(remaining) + 's';
  const fill = document.getElementById('snd-bomb-bar-fill');
  if (fill) fill.style.width = (remaining / total * 100) + '%';
}
function showBombBarWrap() {
  const el = document.getElementById('snd-bomb-bar-wrap');
  if (el) el.style.display = 'flex';
}
function hideBombBarWrap() {
  const el = document.getElementById('snd-bomb-bar-wrap');
  if (el) el.style.display = 'none';
}
function updatePlantBar(pct) {
  const wrap = document.getElementById('snd-plant-bar-wrap');
  if (wrap) wrap.style.display = 'flex';
  const fill = document.getElementById('snd-plant-fill');
  if (fill) fill.style.width = (pct * 100) + '%';
}
function hidePlantBar() {
  const el = document.getElementById('snd-plant-bar-wrap');
  if (el) el.style.display = 'none';
}
function updateDefuseBar(pct) {
  const wrap = document.getElementById('snd-defuse-bar-wrap');
  if (wrap) wrap.style.display = pct > 0.01 ? 'flex' : 'none';
  const fill = document.getElementById('snd-defuse-fill');
  if (fill) fill.style.width = (pct * 100) + '%';
}
function hideDefuseBar() {
  const el = document.getElementById('snd-defuse-bar-wrap');
  if (el) el.style.display = 'none';
}
function showSndResult(title, sub, color) {
  const el = document.getElementById('snd-result');
  if (!el) return;
  document.getElementById('snd-result-title').textContent = title;
  document.getElementById('snd-result-title').style.color = color;
  document.getElementById('snd-result-sub').textContent = sub;
  el.style.display = 'flex';
}
function hideSndResult() {
  const el = document.getElementById('snd-result');
  if (el) el.style.display = 'none';
}
function showPlantHint(siteId) {
  const el = document.getElementById('snd-plant-hint');
  if (el) { el.textContent = `SITE ${siteId} — HOLD G TO PLANT`; el.style.opacity = '1'; }
}
function hidePlantHint() {
  const el = document.getElementById('snd-plant-hint');
  if (el) el.style.opacity = '0';
}

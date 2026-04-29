import { setMode } from './modeManager.js';
import { on, emit } from '../events.js';
import { player } from '../entities/player.js';
import { enemies, spawnEnemyIntoSlot } from '../entities/enemies.js';
import { camera } from '../scene.js';
import { PLAYER_H, MAX_HP, WEAPONS, DEFAULT_WEAPON } from '../config.js';
import { updateHUD, showMsg, showStatus } from '../hud/overlay.js';
import { setGameRunning } from '../input.js';
import { isTouchDevice } from '../touch.js';
import { show1pWeapon, show3pWeapon } from '../builders/weapon.js';

const KILL_LIMIT    = 50;
const MATCH_SECS    = 600;   // 10 minutes
const RESPAWN_DELAY = 3;     // seconds

let _playerScore  = 0;
let _enemyScore   = 0;
let _matchTimer   = 0;
let _playerRespawn = -1;     // countdown; -1 = not respawning
let _active       = false;

// Pending respawn queues: [{e, timer}]
const _enemyRespawnQ   = [];
const _friendRespawnQ  = [];

// ── HUD bar ───────────────────────────────────────────────────────────────
function _updateHud() {
  const bar = document.getElementById('tdm-bar');
  if (!bar) return;
  const min = Math.floor(_matchTimer / 60);
  const sec = String(Math.floor(_matchTimer % 60)).padStart(2, '0');
  document.getElementById('tdm-us').textContent  = _playerScore;
  document.getElementById('tdm-them').textContent = _enemyScore;
  document.getElementById('tdm-timer').textContent = `${min}:${sec}`;
}

function _showBar(visible) {
  const bar = document.getElementById('tdm-bar');
  if (bar) bar.style.display = visible ? 'flex' : 'none';
}

// ── End match ─────────────────────────────────────────────────────────────
function _endMatch(reason) {
  _active = false;
  _showBar(false);
  setGameRunning(false);
  document.exitPointerLock?.();
  const won    = _playerScore > _enemyScore;
  const result = document.getElementById('snd-result');
  const title  = document.getElementById('snd-result-title');
  const sub    = document.getElementById('snd-result-sub');
  const btn    = document.getElementById('snd-next-btn');
  if (!result) { location.reload(); return; }
  title.textContent  = won ? 'VICTORY' : 'DEFEAT';
  title.style.color  = won ? '#2ecc71' : '#e74c3c';
  sub.textContent    = `${_playerScore} — ${_enemyScore} | ${reason}`;
  btn.textContent    = '[ PLAY AGAIN ]';
  btn.onclick        = () => location.reload();
  result.style.display = 'flex';
}

// ── Player respawn ────────────────────────────────────────────────────────
function _respawnPlayer(spawnX, spawnZ) {
  player.dead     = false;
  player.hp       = MAX_HP;
  player.ammo     = WEAPONS[player.weapon].maxAmmo;
  player.reloading = false;
  camera.position.set(spawnX, PLAYER_H, spawnZ);
  updateHUD();
  setGameRunning(true);
  show1pWeapon(player.weapon);
  show3pWeapon(player.weapon);
  if (isTouchDevice) {} else document.getElementById('c').requestPointerLock();
  showMsg('BACK IN ACTION', 2000);
}

// ── Mode tick — called by loop.js via getMode().tick(dt) ─────────────────
let _spawnX = 2, _spawnZ = 2;

function tick(dt) {
  if (!_active) return;

  _matchTimer = Math.max(0, _matchTimer - dt);
  _updateHud();

  // Player respawn countdown
  if (_playerRespawn > 0) {
    _playerRespawn -= dt;
    showMsg(`RESPAWNING IN ${Math.ceil(_playerRespawn)}...`, 1100);
    if (_playerRespawn <= 0) {
      _playerRespawn = -1;
      _respawnPlayer(_spawnX, _spawnZ);
    }
  }

  // Enemy respawn queue
  for (let i = _enemyRespawnQ.length - 1; i >= 0; i--) {
    _enemyRespawnQ[i].timer -= dt;
    if (_enemyRespawnQ[i].timer <= 0) {
      spawnEnemyIntoSlot(_enemyRespawnQ[i].e);
      _enemyRespawnQ.splice(i, 1);
    }
  }

  // Friendly respawn queue
  for (let i = _friendRespawnQ.length - 1; i >= 0; i--) {
    _friendRespawnQ[i].timer -= dt;
    if (_friendRespawnQ[i].timer <= 0) {
      const e = _friendRespawnQ[i].e;
      spawnEnemyIntoSlot(e, null, e.weaponRole);
      _friendRespawnQ.splice(i, 1);
    }
  }

  if (_matchTimer <= 0) _endMatch('TIME UP');
}

// ── Start TDM ─────────────────────────────────────────────────────────────
export function startTdm(spawnX, spawnZ) {
  _playerScore  = 0;
  _enemyScore   = 0;
  _matchTimer   = MATCH_SECS;
  _playerRespawn = -1;
  _enemyRespawnQ.length  = 0;
  _friendRespawnQ.length = 0;
  _active    = true;
  _spawnX    = spawnX;
  _spawnZ    = spawnZ;

  setMode({ name: 'tdm', tick });
  _showBar(true);
  _updateHud();
  showMsg('TEAM DEATHMATCH — FIRST TO 50 KILLS', 3500);
}

// ── Event listeners ───────────────────────────────────────────────────────

on('player:died', () => {
  if (!_active) return;
  _enemyScore++;
  _updateHud();
  if (_enemyScore >= KILL_LIMIT) { _endMatch('ENEMY TEAM WINS'); return; }
  _playerRespawn = RESPAWN_DELAY;
});

on('enemy:killed', (e) => {
  if (!_active) return;
  // player.kills already incremented by killEnemy; score is mirrored there
  _playerScore = player.kills;
  _updateHud();
  if (_playerScore >= KILL_LIMIT) { _endMatch('YOUR TEAM WINS'); return; }
  _enemyRespawnQ.push({ e, timer: RESPAWN_DELAY });
});

on('friendly:killed', (e) => {
  if (!_active) return;
  _friendRespawnQ.push({ e, timer: RESPAWN_DELAY + 2 });
});

import { CELL, PLAYER_H, WEAPONS } from '../config.js';
import { camera } from '../scene.js';
import { player } from '../entities/player.js';
import { show1pWeapon, show3pWeapon } from '../builders/weapon.js';
import { updateHUD, showMsg } from '../hud/overlay.js';
import { setMode } from './modeManager.js';
import {
  rangeTargets, spawnRangeTargets, clearRangeTargets,
  tickDummies, popUpTarget, dropTarget, setTargetActive, registerHit,
} from '../entities/targetDummy.js';
import { rangeMapDef } from '../maps/range.js';

// ── Target layout (relative to spawn) ────────────────────────────────────
const SPAWN_X = rangeMapDef.width / 2 * CELL;   // 28
const SPAWN_Z = 2.5 * CELL;                       // 10

const TARGET_DEFS = [
  { id: 0, x: SPAWN_X - 4, z: SPAWN_Z +  5, zone: 'short',  type: 'hostile' },
  { id: 1, x: SPAWN_X,     z: SPAWN_Z +  8, zone: 'short',  type: 'hostage' },
  { id: 2, x: SPAWN_X + 4, z: SPAWN_Z + 11, zone: 'short',  type: 'hostile' },
  { id: 3, x: SPAWN_X - 6, z: SPAWN_Z + 17, zone: 'medium', type: 'hostage' },
  { id: 4, x: SPAWN_X + 5, z: SPAWN_Z + 22, zone: 'medium', type: 'hostile' },
  { id: 5, x: SPAWN_X - 4, z: SPAWN_Z + 27, zone: 'medium', type: 'hostile' },
  { id: 6, x: SPAWN_X + 4, z: SPAWN_Z + 31, zone: 'medium', type: 'hostage' },
  { id: 7, x: SPAWN_X,     z: SPAWN_Z + 41, zone: 'long',   type: 'hostile' },
  { id: 8, x: SPAWN_X,     z: SPAWN_Z + 56, zone: 'long',   type: 'hostile' },
];

// ── Drill constants ───────────────────────────────────────────────────────
const DRILLS     = ['free', 'flick', 'reaction'];
const DRILL_NAMES = { free: 'FREE PRACTICE', flick: 'FLICK DRILL', reaction: 'REACTION DRILL' };
const FLICK_DUR  = 60;    // seconds per flick session
const FLICK_WIN  = 0.80;  // 800 ms to hit the lit target
const REACT_POPS = 20;    // total target appearances in reaction drill
const REACT_UP   = 0.4;   // target stays up (s)
const REACT_GAP_MIN = 0.4;
const REACT_GAP_MAX = 1.8;

// ── State ─────────────────────────────────────────────────────────────────
let _active     = false;
let _drillIdx   = 0;
let _drill      = 'free';

// Shared stats (reset per drill start)
let _shots = 0, _hits = 0, _hs = 0, _streak = 0, _bestStreak = 0, _penalties = 0;
let _reactTimes = [];

// Free practice — per-target respawn timers
const _respawnQ = []; // { target, t }

// Flick drill
let _flickTimer  = 0;  // countdown to end
let _flickTarget = null;
let _flickHitT   = 0;  // time since target became active (reaction stopwatch)
let _flickScore  = 0;

// Reaction drill
let _reactTimer  = 0;  // time until next pop
let _reactPopped = 0;  // total pops so far
let _reactActive = [];  // targets currently up (with their expiry timer)

// DOM
let _domBuilt = false;
let _hudEl, _drillEl, _timerEl, _hitsEl, _accEl, _hsEl, _streakEl, _reactEl, _penEl;

// ── Public API ────────────────────────────────────────────────────────────

export function startTrainingRange() {
  _active = true;
  spawnRangeTargets(TARGET_DEFS);

  // Wire hit callback on each target
  for (const t of rangeTargets) t.onHit = _onTargetHit;

  _buildHUD();
  _startDrill('free');
  setMode({ name: 'range', tick: tickRange });
  showMsg('TRAINING RANGE — [TAB] CHANGE DRILL', 3000);
  updateHUD();

  document.addEventListener('keydown', _onKey);
}

export function stopTrainingRange() {
  _active = false;
  document.removeEventListener('keydown', _onKey);
  clearRangeTargets();
  if (_hudEl) { _hudEl.remove(); _hudEl = null; _domBuilt = false; }
}

export function isRangeActive() { return _active; }

// ── Tick ──────────────────────────────────────────────────────────────────
export function tickRange(dt) {
  if (!_active) return;
  tickDummies(dt);

  // Infinite ammo — top up reserve after each shot without interrupting reload
  if (!player.reloading) {
    const w = WEAPONS[player.weapon];
    if (w) player.reserve = w.reserve;
  }

  if      (_drill === 'free')     _tickFree(dt);
  else if (_drill === 'flick')    _tickFlick(dt);
  else if (_drill === 'reaction') _tickReaction(dt);

  _updateHUD();
}

// ── Drill ticks ───────────────────────────────────────────────────────────

function _tickFree(dt) {
  // Respawn hit targets after delay
  for (let i = _respawnQ.length - 1; i >= 0; i--) {
    _respawnQ[i].t -= dt;
    if (_respawnQ[i].t <= 0) {
      popUpTarget(_respawnQ[i].target);
      _respawnQ.splice(i, 1);
    }
  }
}

function _tickFlick(dt) {
  _flickTimer -= dt;
  if (_flickTimer <= 0) { _endFlick(); return; }

  if (_flickTarget) {
    _flickHitT += dt;
    if (_flickHitT > FLICK_WIN) {
      // Miss — move on
      _streak = 0;
      dropTarget(_flickTarget);
      _flickTarget = null;
      _pickFlickTarget();
    }
  } else {
    _pickFlickTarget();
  }
}

function _tickReaction(dt) {
  if (_reactPopped >= REACT_POPS && _reactActive.length === 0) {
    _endReaction();
    return;
  }

  // Expire targets that have been up too long
  for (let i = _reactActive.length - 1; i >= 0; i--) {
    _reactActive[i].timer -= dt;
    if (_reactActive[i].timer <= 0) {
      dropTarget(_reactActive[i].target);
      _streak = 0;
      _reactActive.splice(i, 1);
    }
  }

  // Pop a new target on timer
  if (_reactPopped < REACT_POPS) {
    _reactTimer -= dt;
    if (_reactTimer <= 0) {
      const t = _randomDownTarget();
      if (t) {
        popUpTarget(t);
        _reactActive.push({ target: t, timer: REACT_UP });
        _reactPopped++;
      }
      _reactTimer = REACT_GAP_MIN + Math.random() * (REACT_GAP_MAX - REACT_GAP_MIN);
    }
  }
}

// ── Hit callback (all drills) ─────────────────────────────────────────────

function _onTargetHit(target, isHead) {
  if (target.type === 'hostage') {
    _penalties++;
    _streak = 0;
    showMsg('HOSTAGE HIT!', 1200);
    if (_drill === 'free') {
      dropTarget(target);
      _respawnQ.push({ target, t: 1.5 });
    } else if (_drill === 'reaction') {
      const idx = _reactActive.findIndex(r => r.target === target);
      if (idx !== -1) { dropTarget(target); _reactActive.splice(idx, 1); }
    }
    // In flick: hostage stays up (distractor) — no drop
    return;
  }

  _hits++;
  if (isHead) _hs++;
  _streak++;
  if (_streak > _bestStreak) _bestStreak = _streak;

  if (_drill === 'free') {
    dropTarget(target);
    _respawnQ.push({ target, t: 1.5 });

  } else if (_drill === 'flick') {
    if (target === _flickTarget) {
      _reactTimes.push(_flickHitT);
      _flickScore++;
      setTargetActive(target, false);
      dropTarget(target);
      _flickTarget = null;
    }

  } else if (_drill === 'reaction') {
    const idx = _reactActive.findIndex(r => r.target === target);
    if (idx !== -1) {
      _reactTimes.push(_reactActive[idx].timer);
      dropTarget(target);
      _reactActive.splice(idx, 1);
    }
  }
}

// ── Drill lifecycle ───────────────────────────────────────────────────────

function _startDrill(name) {
  // Clean up previous state
  for (const t of rangeTargets) { dropTarget(t); setTargetActive(t, false); }
  _respawnQ.length = 0;
  _flickTarget  = null;
  _reactActive.length = 0;

  _shots = 0; _hits = 0; _hs = 0; _streak = 0; _bestStreak = 0; _penalties = 0;
  _reactTimes = [];
  _flickScore = 0;
  _drill = name;
  _drillIdx = DRILLS.indexOf(name);

  if (name === 'free') {
    for (const t of rangeTargets) popUpTarget(t);

  } else if (name === 'flick') {
    _flickTimer = FLICK_DUR;
    _flickTarget = null;
    for (const t of rangeTargets) if (t.type === 'hostage') popUpTarget(t);

  } else if (name === 'reaction') {
    _reactPopped = 0;
    _reactTimer  = 0.5;
  }

  if (_drillEl) _drillEl.textContent = DRILL_NAMES[name] ?? name.toUpperCase();
}

function _endFlick() {
  const avg = _reactTimes.length
    ? Math.round(_reactTimes.reduce((s, v) => s + v, 0) / _reactTimes.length * 1000)
    : 0;
  showMsg(
    `FLICK DONE — ${_flickScore} hits · avg ${avg} ms`,
    4000
  );
  _startDrill('free');
}

function _endReaction() {
  const pct = _reactPopped > 0 ? Math.round(_hits / _reactPopped * 100) : 0;
  showMsg(`REACTION DONE — ${_hits}/${_reactPopped} (${pct}%)`, 4000);
  _startDrill('free');
}

function _pickFlickTarget() {
  const ups = rangeTargets.filter(t => t.state === 'down' && t.type === 'hostile');
  if (!ups.length) { for (const t of rangeTargets) if (t.type === 'hostile') dropTarget(t); return; }
  const t = ups[Math.floor(Math.random() * ups.length)];
  popUpTarget(t);
  setTargetActive(t, true);
  _flickTarget = t;
  _flickHitT  = 0;
}

function _randomDownTarget() {
  const pool = rangeTargets.filter(t => t.state === 'down');
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Key handler ───────────────────────────────────────────────────────────
function _onKey(e) {
  if (!_active) return;
  if (e.code === 'Tab') {
    e.preventDefault();
    _drillIdx = (_drillIdx + 1) % DRILLS.length;
    _startDrill(DRILLS[_drillIdx]);
  }
  if (e.code === 'Escape') {
    location.reload();
  }
}

// Called by shoot.js when a shot fires (to track accuracy)
export function notifyShot() { _shots++; }

// ── DOM HUD ───────────────────────────────────────────────────────────────
function _buildHUD() {
  if (_domBuilt) return;
  _domBuilt = true;

  _hudEl = document.createElement('div');
  _hudEl.id = 'range-hud';
  _hudEl.innerHTML = `
    <div id="range-drill-name">FREE PRACTICE</div>
    <div id="range-timer-row"></div>
    <div class="range-stat-row"><span>HITS</span><span id="rng-hits">0</span></div>
    <div class="range-stat-row"><span>ACCURACY</span><span id="rng-acc">—</span></div>
    <div class="range-stat-row"><span>HEADSHOTS</span><span id="rng-hs">0</span></div>
    <div class="range-stat-row"><span>STREAK</span><span id="rng-streak">×0</span></div>
    <div class="range-stat-row"><span>AVG REACT</span><span id="rng-react">—</span></div>
    <div class="range-stat-row"><span>PENALTIES</span><span id="rng-pen">0</span></div>
    <div id="range-hint">[TAB] NEXT DRILL &nbsp;·&nbsp; [ESC] EXIT</div>
  `;
  document.body.appendChild(_hudEl);

  _drillEl  = document.getElementById('range-drill-name');
  _timerEl  = document.getElementById('range-timer-row');
  _hitsEl   = document.getElementById('rng-hits');
  _accEl    = document.getElementById('rng-acc');
  _hsEl     = document.getElementById('rng-hs');
  _streakEl = document.getElementById('rng-streak');
  _reactEl  = document.getElementById('rng-react');
  _penEl    = document.getElementById('rng-pen');
}

function _updateHUD() {
  if (!_domBuilt) return;

  if (_timerEl) {
    if (_drill === 'flick') {
      _timerEl.textContent = `${Math.max(0, Math.ceil(_flickTimer))}s`;
      _timerEl.style.display = '';
    } else if (_drill === 'reaction') {
      _timerEl.textContent = `${_reactPopped}/${REACT_POPS}`;
      _timerEl.style.display = '';
    } else {
      _timerEl.style.display = 'none';
    }
  }

  if (_hitsEl)   _hitsEl.textContent   = _hits;
  if (_accEl)    _accEl.textContent     = _shots > 0 ? `${Math.round(_hits / _shots * 100)}%` : '—';
  if (_hsEl)     _hsEl.textContent      = `${_hs}  (${_hits > 0 ? Math.round(_hs / _hits * 100) : 0}%)`;
  if (_streakEl) _streakEl.textContent  = `×${_streak}  best ×${_bestStreak}`;
  if (_reactEl) {
    if (_reactTimes.length > 0) {
      const avg = Math.round(_reactTimes.reduce((s, v) => s + v, 0) / _reactTimes.length * 1000);
      _reactEl.textContent = `${avg} ms`;
    } else {
      _reactEl.textContent = '—';
    }
  }
  if (_penEl) {
    _penEl.textContent = _penalties;
    _penEl.style.color = _penalties > 0 ? '#ff4422' : '#e8e8e8';
  }
}

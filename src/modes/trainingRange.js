import { CELL, PLAYER_H, WEAPONS } from '../config.js';
import { camera } from '../scene.js';
import { player } from '../entities/player.js';
import { show1pWeapon, show3pWeapon } from '../builders/weapon.js';
import { updateHUD, showMsg } from '../hud/overlay.js';
import { setMode } from './modeManager.js';
import {
  rangeTargets, spawnRangeTargets, clearRangeTargets,
  tickDummies, popUpTarget, dropTarget, setTargetActive, registerHit, setTargetMoveMode,
} from '../entities/targetDummy.js';
import { rangeMapDef } from '../maps/range.js';

// ── Target layout ─────────────────────────────────────────────────────────
const SPAWN_X = rangeMapDef.width / 2 * CELL;
const SPAWN_Z = 2.5 * CELL;

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

// ── Drills ────────────────────────────────────────────────────────────────
const DRILLS     = ['free', 'flick', 'reaction', 'hostage'];
const DRILL_NAMES = {
  free:     'FREE PRACTICE',
  flick:    'FLICK DRILL',
  reaction: 'REACTION DRILL',
  hostage:  'HOSTAGE GAUNTLET',
};

// ── Difficulty presets ────────────────────────────────────────────────────
const DIFFICULTIES = [
  { id: 'beginner', label: 'BEGINNER', desc: '2.5 s window',  flickWin: 2.5,  reactUp: 0.8,  reactGapMin: 0.8, reactGapMax: 2.5 },
  { id: 'normal',   label: 'NORMAL',   desc: '1.5 s window',  flickWin: 1.5,  reactUp: 0.5,  reactGapMin: 0.5, reactGapMax: 2.0 },
  { id: 'hard',     label: 'HARD',     desc: '0.8 s window',  flickWin: 0.80, reactUp: 0.40, reactGapMin: 0.4, reactGapMax: 1.8 },
  { id: 'elite',    label: 'ELITE',    desc: '0.4 s window',  flickWin: 0.40, reactUp: 0.25, reactGapMin: 0.2, reactGapMax: 1.0 },
];

// ── Target layout presets ─────────────────────────────────────────────────
const PRESETS = [
  { id: 'all',     label: 'FULL RANGE',   desc: '9 targets · all zones'       },
  { id: 'short',   label: 'SHORT RANGE',  desc: 'Close quarters · 5–15 m'     },
  { id: 'medium',  label: 'MEDIUM RANGE', desc: 'Mid range · 17–35 m'         },
  { id: 'long',    label: 'LONG RANGE',   desc: 'Long range · 40–60 m'        },
  { id: 'hostile', label: 'HOSTILE ONLY', desc: 'No hostages · pure accuracy'  },
];

function _presetMatch(t, id) {
  if (id === 'short')   return t.zone === 'short';
  if (id === 'medium')  return t.zone === 'medium';
  if (id === 'long')    return t.zone === 'long';
  if (id === 'hostile') return t.type === 'hostile';
  return true;
}

const FLICK_DUR  = 60;
const REACT_POPS = 20;

// ── State ─────────────────────────────────────────────────────────────────
let _active          = false;
let _drillIdx        = 0;
let _drill           = 'free';
let _presetIdx       = 0;
let _presetPanelOpen = false;
let _diffIdx     = 1;
let _moveH       = false;
let _moveV       = false;
let _moveHMode   = 'sine';   // 'sine' | 'spring'
let _moveHSpeed  = 0;        // 0=slow 1=medium 2=fast

// Difficulty-adjustable params (NORMAL defaults)
let _flickWin    = 1.5;
let _reactUp     = 0.5;
let _reactGapMin = 0.5;
let _reactGapMax = 2.0;

// Shared stats (reset per drill start)
let _shots = 0, _hits = 0, _hs = 0, _streak = 0, _bestStreak = 0, _penalties = 0;
let _reactTimes = [];

// Free — respawn queue
const _respawnQ = [];

// Flick
let _flickTimer = 0, _flickTarget = null, _flickHitT = 0, _flickScore = 0;

// Reaction
let _reactTimer = 0, _reactPopped = 0, _reactActive = [];

// DOM
let _domBuilt = false;
let _hudEl, _drillEl, _timerEl, _hitsEl, _accEl, _hsEl, _streakEl, _reactEl, _penEl;
let _presetPanelEl;

// ── Public API ────────────────────────────────────────────────────────────

export function startTrainingRange() {
  _active = true;
  spawnRangeTargets(TARGET_DEFS);
  for (const t of rangeTargets) t.onHit = _onTargetHit;
  _buildHUD();
  _buildPresetPanel();
  _startDrill('free');
  setMode({ name: 'range', tick: tickRange });
  showMsg('TRAINING RANGE — [TAB] DRILL  [P] PRESETS', 3000);
  updateHUD();
  document.addEventListener('keydown', _onKey);
}

export function stopTrainingRange() {
  _active = false;
  _presetPanelOpen = false;
  _presetIdx = 0;
  _diffIdx = 1;
  _moveH = false; _moveV = false;
  _moveHMode = 'sine'; _moveHSpeed = 0;
  setTargetMoveMode({ h: false, v: false });
  document.removeEventListener('keydown', _onKey);
  clearRangeTargets();
  if (_hudEl) { _hudEl.remove(); _hudEl = null; _domBuilt = false; }
  if (_presetPanelEl) { _presetPanelEl.remove(); _presetPanelEl = null; }
}

export function isRangeActive() { return _active; }

// ── Tick ──────────────────────────────────────────────────────────────────
export function tickRange(dt) {
  if (!_active) return;
  tickDummies(dt);
  if (!player.reloading) {
    const w = WEAPONS[player.weapon];
    if (w) player.reserve = w.reserve;
  }
  if      (_drill === 'free' || _drill === 'hostage') _tickFree(dt);
  else if (_drill === 'flick')                         _tickFlick(dt);
  else if (_drill === 'reaction')                      _tickReaction(dt);
  _updateHUD();
}

// ── Drill ticks ───────────────────────────────────────────────────────────

function _tickFree(dt) {
  for (let i = _respawnQ.length - 1; i >= 0; i--) {
    _respawnQ[i].t -= dt;
    if (_respawnQ[i].t <= 0) {
      if (!_respawnQ[i].target.disabled) popUpTarget(_respawnQ[i].target);
      _respawnQ.splice(i, 1);
    }
  }
}

function _tickFlick(dt) {
  _flickTimer -= dt;
  if (_flickTimer <= 0) { _endFlick(); return; }
  if (_flickTarget) {
    _flickHitT += dt;
    if (_flickHitT > _flickWin) {
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
  if (_reactPopped >= REACT_POPS && _reactActive.length === 0) { _endReaction(); return; }
  for (let i = _reactActive.length - 1; i >= 0; i--) {
    _reactActive[i].timer -= dt;
    if (_reactActive[i].timer <= 0) {
      dropTarget(_reactActive[i].target);
      _streak = 0;
      _reactActive.splice(i, 1);
    }
  }
  if (_reactPopped < REACT_POPS) {
    _reactTimer -= dt;
    if (_reactTimer <= 0) {
      const t = _randomDownTarget();
      if (t) {
        popUpTarget(t);
        _reactActive.push({ target: t, timer: _reactUp });
        _reactPopped++;
      }
      _reactTimer = _reactGapMin + Math.random() * (_reactGapMax - _reactGapMin);
    }
  }
}

// ── Hit callback ──────────────────────────────────────────────────────────

function _onTargetHit(target, isHead) {
  if (target.type === 'hostage') {
    _penalties++;
    _streak = 0;
    showMsg('HOSTAGE HIT!', 1200);
    if (_drill === 'free' || _drill === 'hostage') {
      dropTarget(target);
      _respawnQ.push({ target, t: 1.5 });
    } else if (_drill === 'reaction') {
      const idx = _reactActive.findIndex(r => r.target === target);
      if (idx !== -1) { dropTarget(target); _reactActive.splice(idx, 1); }
    }
    return;
  }

  _hits++;
  if (isHead) _hs++;
  _streak++;
  if (_streak > _bestStreak) _bestStreak = _streak;

  if (_drill === 'free' || _drill === 'hostage') {
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
  for (const t of rangeTargets) { dropTarget(t); setTargetActive(t, false); }
  _respawnQ.length = 0;
  _flickTarget = null;
  _reactActive.length = 0;
  _shots = 0; _hits = 0; _hs = 0; _streak = 0; _bestStreak = 0; _penalties = 0;
  _reactTimes = [];
  _flickScore = 0;
  _drill = name;
  _drillIdx = DRILLS.indexOf(name);

  if (name === 'free' || name === 'hostage') {
    for (const t of rangeTargets) if (!t.disabled) popUpTarget(t);
  } else if (name === 'flick') {
    _flickTimer = FLICK_DUR;
    _flickTarget = null;
    for (const t of rangeTargets) if (!t.disabled && t.type === 'hostage') popUpTarget(t);
  } else if (name === 'reaction') {
    _reactPopped = 0;
    _reactTimer  = 0.5;
  }

  if (_drillEl) _drillEl.textContent = DRILL_NAMES[name] ?? name.toUpperCase();
  _refreshPanel();
}

function _endFlick() {
  const avg = _reactTimes.length
    ? Math.round(_reactTimes.reduce((s, v) => s + v, 0) / _reactTimes.length * 1000) : 0;
  showMsg(`FLICK DONE — ${_flickScore} hits · avg ${avg} ms`, 4000);
  _startDrill('free');
}

function _endReaction() {
  const pct = _reactPopped > 0 ? Math.round(_hits / _reactPopped * 100) : 0;
  showMsg(`REACTION DONE — ${_hits}/${_reactPopped} (${pct}%)`, 4000);
  _startDrill('free');
}

function _pickFlickTarget() {
  const pool = rangeTargets.filter(t => t.state === 'down' && t.type === 'hostile' && !t.disabled);
  if (!pool.length) { for (const t of rangeTargets) if (t.type === 'hostile' && !t.disabled) dropTarget(t); return; }
  const t = pool[Math.floor(Math.random() * pool.length)];
  popUpTarget(t);
  setTargetActive(t, true);
  _flickTarget = t;
  _flickHitT  = 0;
}

function _randomDownTarget() {
  const pool = rangeTargets.filter(t => t.state === 'down' && !t.disabled);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Preset panel ─────────────────────────────────────────────────────────

function _openPresetPanel() {
  _presetPanelOpen = true;
  document.exitPointerLock?.();
  _refreshPanel();
  if (_presetPanelEl) _presetPanelEl.style.display = 'flex';
}

function _closePresetPanel() {
  _presetPanelOpen = false;
  if (_presetPanelEl) _presetPanelEl.style.display = 'none';
  if (_active) document.getElementById('c')?.requestPointerLock();
}

function _setDiff(idx) {
  _diffIdx = idx;
  const d = DIFFICULTIES[idx];
  _flickWin    = d.flickWin;
  _reactUp     = d.reactUp;
  _reactGapMin = d.reactGapMin;
  _reactGapMax = d.reactGapMax;
  _refreshPanel();
}

function _applyMove() {
  setTargetMoveMode({ h: _moveH, v: _moveV, hMode: _moveHMode, hSpeed: _moveHSpeed });
  _refreshPanel();
}

function _toggleMove(axis) {
  if (axis === 'h') _moveH = !_moveH;
  else if (axis === 'v') _moveV = !_moveV;
  else { _moveH = false; _moveV = false; }
  _applyMove();
}

function _setHMode(mode) { _moveHMode = mode; _applyMove(); }
function _setHSpeed(idx) { _moveHSpeed = idx; _applyMove(); }

function _refreshPanel() {
  if (!_presetPanelEl) return;
  _presetPanelEl.querySelectorAll('.rp-row[data-section="drill"]').forEach(r => {
    r.classList.toggle('rp-active', r.dataset.val === _drill);
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="diff"]').forEach((r, i) => {
    r.classList.toggle('rp-active', i === _diffIdx);
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="preset"]').forEach((r, i) => {
    r.classList.toggle('rp-active', i === _presetIdx);
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="move"]').forEach(r => {
    const v = r.dataset.val;
    const on = v === 'h' ? _moveH : v === 'v' ? _moveV : (!_moveH && !_moveV);
    r.classList.toggle('rp-active', on);
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="hmode"]').forEach(r => {
    r.classList.toggle('rp-active', r.dataset.val === _moveHMode);
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="hspeed"]').forEach((r, i) => {
    r.classList.toggle('rp-active', i === _moveHSpeed);
  });
}

function _buildPresetPanel() {
  if (_presetPanelEl) return;
  _presetPanelEl = document.createElement('div');
  _presetPanelEl.id = 'range-preset-panel';
  _presetPanelEl.style.display = 'none';

  const mkRow = (section, val, label, desc) =>
    `<div class="rp-row" data-section="${section}" data-val="${val}">` +
    `<span class="rp-label">${label}</span><span class="rp-desc">${desc}</span></div>`;

  const drillRows = [
    ['free',     'FREE PRACTICE',    'All targets up, respawn on hit'],
    ['flick',    'FLICK DRILL',      'Timed · one lit target at a time'],
    ['reaction', 'REACTION DRILL',   'Pop &amp; shoot · 20 rounds'],
    ['hostage',  'HOSTAGE GAUNTLET', 'Score: +1 hostile / −1 hostage'],
  ].map(([v, l, d]) => mkRow('drill', v, l, d)).join('');

  const diffRows = DIFFICULTIES.map((d, i) =>
    `<div class="rp-row" data-section="diff" data-idx="${i}">` +
    `<span class="rp-label">${d.label}</span><span class="rp-desc">${d.desc}</span></div>`
  ).join('');

  const presetRows = PRESETS.map((p, i) =>
    `<div class="rp-row" data-section="preset" data-idx="${i}">` +
    `<span class="rp-label">${p.label}</span><span class="rp-desc">${p.desc}</span></div>`
  ).join('');

  const moveRows = [
    ['static', 'STATIC',     'Turn off movement'],
    ['h',      'HORIZONTAL', 'Side-to-side · toggle'],
    ['v',      'VERTICAL',   'Up / down · toggle'],
  ].map(([v, l, d]) => mkRow('move', v, l, d)).join('');

  const hmodeRows = [
    ['sine',   'SINE',   'Smooth wave traversal'],
    ['spring', 'SPRING', 'Spring strafing — picks random goals'],
  ].map(([v, l, d]) => mkRow('hmode', v, l, d)).join('');

  const hspeedRows = [
    ['0', 'SLOW',   'Lazy crawl'],
    ['1', 'MEDIUM', 'Combat pace'],
    ['2', 'FAST',   'Erratic sprint'],
  ].map(([v, l, d]) => mkRow('hspeed', v, l, d)).join('');

  _presetPanelEl.innerHTML =
    `<div class="rp-header"><span>TRAINING PRESETS</span><span class="rp-close">[P / ESC]</span></div>` +
    `<div class="rp-body">` +
    `<div class="rp-section-hdr">DRILL</div>${drillRows}` +
    `<div class="rp-section-hdr">DIFFICULTY</div>${diffRows}` +
    `<div class="rp-section-hdr">TARGETS</div>${presetRows}` +
    `<div class="rp-section-hdr">MOVEMENT</div>${moveRows}` +
    `<div class="rp-section-hdr">H PATTERN</div>${hmodeRows}` +
    `<div class="rp-section-hdr">H SPEED</div>${hspeedRows}` +
    `</div>`;

  _presetPanelEl.addEventListener('mousedown', e => e.stopPropagation());
  document.body.appendChild(_presetPanelEl);

  _presetPanelEl.querySelectorAll('.rp-row[data-section="drill"]').forEach(row => {
    row.addEventListener('click', () => { _startDrill(row.dataset.val); _closePresetPanel(); });
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="diff"]').forEach((row, i) => {
    row.addEventListener('click', () => _setDiff(i));
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="preset"]').forEach((row, i) => {
    row.addEventListener('click', () => {
      _presetIdx = i;
      for (const t of rangeTargets) t.disabled = !_presetMatch(t, PRESETS[i].id);
      _startDrill(_drill);
      _refreshPanel();
    });
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="move"]').forEach(row => {
    row.addEventListener('click', () => _toggleMove(row.dataset.val));
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="hmode"]').forEach(row => {
    row.addEventListener('click', () => _setHMode(row.dataset.val));
  });
  _presetPanelEl.querySelectorAll('.rp-row[data-section="hspeed"]').forEach((row, i) => {
    row.addEventListener('click', () => _setHSpeed(i));
  });
}

// ── Key handler ───────────────────────────────────────────────────────────
function _onKey(e) {
  if (!_active) return;
  if (e.code === 'KeyP') {
    e.preventDefault();
    _presetPanelOpen ? _closePresetPanel() : _openPresetPanel();
    return;
  }
  if (_presetPanelOpen) {
    if (e.code === 'Escape') _closePresetPanel();
    return;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    _drillIdx = (_drillIdx + 1) % DRILLS.length;
    _startDrill(DRILLS[_drillIdx]);
  }
  if (e.code === 'Escape') location.reload();
}

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
    <div id="range-hint">[TAB] DRILL &nbsp;·&nbsp; [P] PRESETS &nbsp;·&nbsp; [ESC] EXIT</div>
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
      _timerEl.style.color = '';
      _timerEl.style.display = '';
    } else if (_drill === 'reaction') {
      _timerEl.textContent = `${_reactPopped}/${REACT_POPS}`;
      _timerEl.style.color = '';
      _timerEl.style.display = '';
    } else if (_drill === 'hostage') {
      const score = _hits - _penalties;
      _timerEl.textContent = `SCORE ${score >= 0 ? '+' : ''}${score}`;
      _timerEl.style.color = score >= 0 ? '#00dd44' : '#ff4422';
      _timerEl.style.display = '';
    } else {
      _timerEl.style.display = 'none';
      _timerEl.style.color = '';
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

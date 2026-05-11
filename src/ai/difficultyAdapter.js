import { DIFFICULTY_PRESETS } from '../config.js';
import { setDifficultyOverride, clearDifficultyOverride } from '../difficulty.js';
import { on } from '../events.js';

const EVAL_INTERVAL   = 30;  // seconds between level evaluations
const WINDOW_DURATION = 60;  // seconds of rolling kill/death history

let _active    = false;
let _level     = 5;          // 1 = easiest (Recruit), 10 = hardest (Elite)
let _evalTimer = EVAL_INTERVAL;
const _window  = [];         // [{type:'kill'|'death', ts}]

function _lerp(a, b, t) { return a + (b - a) * t; }

function _applyLevel() {
  const t       = (_level - 1) / 9;
  const recruit = DIFFICULTY_PRESETS.recruit;
  const elite   = DIFFICULTY_PRESETS.elite;
  setDifficultyOverride({
    speedMult:    _lerp(recruit.speedMult,    elite.speedMult,    t),
    damage:       Math.round(_lerp(recruit.damage,       elite.damage,       t)),
    shootCd:      _lerp(recruit.shootCd,      elite.shootCd,      t),
    aimThresh:    _lerp(recruit.aimThresh,    elite.aimThresh,    t),
    reactMin:     _lerp(recruit.reactMin,     elite.reactMin,     t),
    reactMax:     _lerp(recruit.reactMax,     elite.reactMax,     t),
    strafeChance: _lerp(recruit.strafeChance, elite.strafeChance, t),
    hp:           Math.round(_lerp(recruit.hp,           elite.hp,           t)),
    sight:        _lerp(recruit.sight,        elite.sight,        t),
  });
}

export function adaptStart() {
  _active    = true;
  _level     = 5;
  _evalTimer = EVAL_INTERVAL;
  _window.length = 0;
  _applyLevel();
}

export function adaptStop() {
  _active = false;
  _window.length = 0;
  clearDifficultyOverride();
}

export function adaptTick(dt) {
  if (!_active) return;
  _evalTimer -= dt;
  if (_evalTimer > 0) return;
  _evalTimer = EVAL_INTERVAL;

  const now    = performance.now();
  const cutoff = now - WINDOW_DURATION * 1000;
  for (let i = _window.length - 1; i >= 0; i--) {
    if (_window[i].ts < cutoff) _window.splice(i, 1);
  }

  const kills  = _window.filter(e => e.type === 'kill').length;
  const deaths = _window.filter(e => e.type === 'death').length;
  const score  = kills / Math.max(1, deaths);

  let changed = false;
  if (score > 2.0 && _level < 10) { _level++; changed = true; }
  else if (score < 0.5 && _level > 1) { _level--; changed = true; }
  if (changed) _applyLevel();
}

export function getAdaptLevel() { return _level; }
export function isAdaptActive() { return _active; }

on('enemy:killed', () => { if (_active) _window.push({ type: 'kill',  ts: performance.now() }); });
on('player:died',  () => { if (_active) _window.push({ type: 'death', ts: performance.now() }); });

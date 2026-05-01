import { emit } from '../events.js';

let _cash       = 800;
let _lossStreak = 0;

function _set(n) {
  _cash = Math.max(0, Math.min(16000, n));
  emit('economy:updated', _cash);
}

export function resetEconomy() { _lossStreak = 0; _set(3000); }
export function getCash()      { return _cash; }
export function canAfford(n)   { return _cash >= n; }

export function spendCash(n)   { _set(_cash - n); }

export function onKill()   { _set(_cash + 300); }
export function onPlant()  { _set(_cash + 300); }
export function onDefuse() { _set(_cash + 300); }

export function onRoundEnd(playerWon) {
  if (playerWon) {
    _lossStreak = 0;
    _set(_cash + 900);
  } else {
    const bonus = _lossStreak >= 2 ? 2400 : _lossStreak === 1 ? 1900 : 1400;
    _lossStreak = Math.min(_lossStreak + 1, 3);
    _set(_cash + bonus);
  }
  if (_cash < 500) _set(500);
}

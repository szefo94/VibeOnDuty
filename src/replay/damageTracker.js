let _playerDmg = 0, _allyDmg = 0, _enemyDmg = 0;
const _sndRounds = [];   // { player, ally, enemy } — one entry per S&D round

export function resetDamage() {
  _playerDmg = _allyDmg = _enemyDmg = 0;
  _sndRounds.length = 0;
}

export function newRound() {
  _sndRounds.push({ player: 0, ally: 0, enemy: 0 });
}

function _cur() { return _sndRounds[_sndRounds.length - 1] ?? null; }

export function addPlayerDmg(n) {
  _playerDmg += n;
  const r = _cur(); if (r) r.player += n;
}

export function addAllyDmg(n) {
  _allyDmg += n;
  const r = _cur(); if (r) r.ally += n;
}

export function addEnemyDmg(n) {
  _enemyDmg += n;
  const r = _cur(); if (r) r.enemy += n;
}

export function getSummary() {
  return { player: _playerDmg, ally: _allyDmg, enemy: _enemyDmg };
}

export function getRoundBreakdown() {
  return _sndRounds.slice();
}

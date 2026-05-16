const _bus = {};
export const on   = (ev, fn) => (_bus[ev] ??= []).push(fn);
export const off  = (ev, fn) => { _bus[ev] = (_bus[ev] ?? []).filter(f => f !== fn); };
export const emit = (ev, data) => (_bus[ev] ?? []).slice().forEach(f => f(data));

export const EV = {
  WAVE_END:              'wave:end',
  PLAYER_DIED:           'player:died',
  ENEMY_KILLED:          'enemy:killed',
  FRIENDLY_KILLED:       'friendly:killed',
  ROUND_ENEMY_WIPED:     'round:enemyTeamWiped',
  ROUND_FRIEND_WIPED:    'round:friendTeamWiped',
  SND_CONFIGURE:         'snd:configure',
  ECONOMY_UPDATED:       'economy:updated',
};

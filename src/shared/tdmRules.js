// @ts-check
/** @typedef {{killLimit:number,matchSeconds:number,respawnSeconds:number,friendlyFire:number,resultsSeconds:number}} Settings */
/** @typedef {{sessionId:string,team:string,nickname:string,joinOrdinal:number,alive:boolean,lifeGeneration:number,respawnAtMs:number}} Member */
/** @param {unknown} [raw] @returns {Readonly<Settings>} */
export function validateSettings(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Invalid TDM settings');
  const bounds = {
    killLimit: [1, 1000],
    matchSeconds: [1, 3600],
    respawnSeconds: [0, 30],
    friendlyFire: [0, 1],
    resultsSeconds: [15, 15],
  };
  for (const [key, value] of Object.entries(raw)) {
    const range = bounds[/** @type {keyof typeof bounds} */ (key)];
    if (
      !range ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < range[0] ||
      value > range[1] ||
      (key === 'killLimit' && !Number.isInteger(value))
    )
      throw new Error('Invalid TDM settings');
  }
  return Object.freeze({
    killLimit: 50,
    matchSeconds: 600,
    respawnSeconds: 3,
    friendlyFire: 0.25,
    resultsSeconds: 15,
    ...raw,
  });
}
/** Join identity is cosmetic. Trusted settings never come from this object.
 * @param {unknown} raw @param {number} ordinal */
export function guestName(raw, ordinal) {
  if (raw == null) return `Guest-${ordinal}`;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid guest options');
  const name = /** @type {{nickname?:unknown}} */ (raw).nickname;
  if (name === undefined || name === null) return `Guest-${ordinal}`;
  if (typeof name !== 'string' || name.length > 256) throw new Error('Invalid nickname');
  return (
    Array.from(name.replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, '').trim())
      .slice(0, 24)
      .join('') || `Guest-${ordinal}`
  );
}
/** @param {unknown} [settings] */
export function createTdmRules(settings = {}) {
  return {
    settings: validateSettings(settings),
    members: /** @type {Map<string,Member>} */ (new Map()),
    phase: /** @type {'waiting'|'active'|'results'} */ ('waiting'),
    matchGeneration: 1,
    joinOrdinal: 0,
    startedAtMs: 0,
    endsAtMs: 0,
    resultsEndsAtMs: 0,
    scoreBlue: 0,
    scoreRed: 0,
    winner: '',
    retiredLives: /** @type {Map<string,number>} */ (new Map()),
  };
}
/** @typedef {ReturnType<typeof createTdmRules>} Rules */
/** @param {Rules} rules @param {Member} member @param {number} nowMs @param {unknown} [options] */
export function onJoin(rules, member, nowMs, options) {
  const ordinal = rules.joinOrdinal + 1;
  const nickname = guestName(options, ordinal);
  const blue = [...rules.members.values()].filter((p) => p.team === 'blue').length;
  Object.assign(member, {
    team: blue <= rules.members.size - blue ? 'blue' : 'red',
    nickname,
    joinOrdinal: ordinal,
  });
  rules.joinOrdinal = ordinal;
  rules.members.set(member.sessionId, member);
  if (rules.phase === 'waiting') {
    rules.phase = 'active';
    rules.startedAtMs = nowMs;
    rules.endsAtMs = nowMs + rules.settings.matchSeconds * 1000;
  }
}
/** @param {Rules} rules @param {string} id @param {unknown} raw */
export function requestTeamSwitch(rules, id, raw) {
  const member = rules.members.get(id);
  if (!member) return 'not_member';
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.keys(raw).length !== 4 ||
    Object.keys(raw).some(
      (k) => !['protocolVersion', 'matchGeneration', 'lifeGeneration', 'team'].includes(k)
    )
  )
    return 'invalid_shape';
  const c =
    /** @type {{protocolVersion:number,matchGeneration:number,lifeGeneration:number,team:string}} */ (
      raw
    );
  if (c.protocolVersion !== 1 || !['blue', 'red'].includes(c.team) || c.team === member.team)
    return 'invalid_team';
  if (c.matchGeneration !== rules.matchGeneration || c.lifeGeneration !== member.lifeGeneration)
    return 'wrong_generation';
  if (member.alive && rules.phase !== 'results') return 'alive';
  const blue = [...rules.members.values()].filter(
    (p) => (p === member ? c.team : p.team) === 'blue'
  ).length;
  if (Math.abs(2 * blue - rules.members.size) > 1) return 'team_balance';
  member.team = c.team;
  return null;
}

/** Combat sets alive=false before calling this once-per-current-life transition.
 * @param {Rules} rules @param {Member} target @param {import('./combat.js').Projectile} shot @param {number} nowMs */
export function onDeath(rules, target, shot, nowMs) {
  if (
    rules.phase !== 'active' ||
    shot.matchGeneration !== rules.matchGeneration ||
    rules.members.get(target.sessionId) !== target ||
    rules.retiredLives.get(target.sessionId) === target.lifeGeneration
  )
    return false;
  rules.retiredLives.set(target.sessionId, target.lifeGeneration);
  target.alive = false;
  target.respawnAtMs = nowMs + rules.settings.respawnSeconds * 1000;
  const shooter = rules.members.get(shot.shooterSessionId);
  if (
    shooter &&
    shooter.lifeGeneration === shot.lifeGeneration &&
    shooter.team === shot.shooterTeam &&
    shooter.team !== target.team
  ) {
    if (shooter.team === 'blue') rules.scoreBlue++;
    else rules.scoreRed++;
  }
  return true;
}
/** Score is checked after every current-step impact, before time.
 * @param {Rules} rules @param {number} nowMs */
export function tickRules(rules, nowMs) {
  if (!rules.members.size || rules.phase === 'waiting') return 'none';
  if (rules.phase === 'results') {
    if (nowMs + 1e-7 < rules.resultsEndsAtMs) return 'none';
    resetMatch(rules, nowMs);
    return 'rematch';
  }
  if (
    Math.max(rules.scoreBlue, rules.scoreRed) < rules.settings.killLimit &&
    nowMs + 1e-7 < rules.endsAtMs
  )
    return 'none';
  rules.phase = 'results';
  rules.winner =
    rules.scoreBlue === rules.scoreRed ? 'draw' : rules.scoreBlue > rules.scoreRed ? 'blue' : 'red';
  rules.resultsEndsAtMs = nowMs + rules.settings.resultsSeconds * 1000;
  return 'results';
}
/** @param {Rules} rules @param {number} nowMs */
export function resetMatch(rules, nowMs) {
  rules.matchGeneration++;
  rules.scoreBlue = rules.scoreRed = 0;
  rules.winner = '';
  rules.resultsEndsAtMs = 0;
  rules.retiredLives.clear();
  rules.phase = rules.members.size ? 'active' : 'waiting';
  rules.startedAtMs = rules.members.size ? nowMs : 0;
  rules.endsAtMs = rules.members.size ? nowMs + rules.settings.matchSeconds * 1000 : 0;
}
/** @param {Rules} rules @param {string} id @param {number} nowMs */
export function onLeave(rules, id, nowMs) {
  if (!rules.members.delete(id)) return false;
  rules.retiredLives.delete(id);
  if (!rules.members.size) resetMatch(rules, nowMs);
  return true;
}

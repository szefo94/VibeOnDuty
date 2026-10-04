// @ts-check
/** @typedef {import('../shared/combat.js').Hit} Hit */
/** @typedef {{textContent:string|null,hidden:boolean|string}} Element */
/** @typedef {{sessionId:string,matchGeneration:number,lifeGeneration:number,players:{sessionId:string,lifeGeneration:number}[]}} Session */
/** @typedef {{tick:(dt:number)=>boolean,remove:()=>void}} NumberEffect */
/** Project eligibility only; the server remains the final authority.
 * @param {{team:string,alive:boolean}} me
 * @param {string} phase
 * @param {Iterable<{team:string}>} players
 * @returns {string} */
export function teamSwitchReason(me, phase, players) {
  if (me.alive && phase !== 'results') return 'Switch teams when dead or during results.';
  const members = Array.from(players);
  const blue = members.filter((p) => p.team === 'blue').length;
  const projectedBlue = blue + (me.team === 'blue' ? -1 : 1);
  return Math.abs(2 * projectedBlue - members.length) > 1
    ? 'Switch unavailable: teams must stay balanced.'
    : '';
}
/** @param {Record<string,Element|null>} elements
 * @param {{marker:()=>void,number:(x:number,y:number,z:number,damage:number)=>NumberEffect|undefined,tickMarker:(dt:number)=>void,clearMarker:()=>void}} feedback */
export function createOnlineUi(elements, feedback) {
  let generation = '',
    lastEventId = 0;
  const seenShots = new Set();
  /** @type {NumberEffect[]} */ let effects = [];
  /** @param {string} id @param {string} value */
  function text(id, value) {
    const element = elements[id];
    if (element) element.textContent = value;
  }
  function clearFeedback() {
    for (const effect of effects) effect.remove();
    effects = [];
    feedback.clearMarker();
  }
  /** @param {Session} session */
  function presentSnapshot(session) {
    const next = `${session.sessionId}/${session.matchGeneration}/${session.lifeGeneration}`;
    if (next === generation) return;
    generation = next;
    lastEventId = 0;
    seenShots.clear();
    clearFeedback();
  }
  /** @param {Hit} event @param {Session} session */
  function presentConfirmedHit(event, session) {
    if (!event || typeof event !== 'object') return false;
    const positive = (/** @type {number} */ n) => Number.isSafeInteger(n) && n > 0;
    if (
      ![
        event.eventId,
        event.shotId,
        event.matchGeneration,
        event.lifeGeneration,
        event.targetLifeGeneration,
      ].every(positive) ||
      !Number.isFinite(event.damage) ||
      event.damage <= 0 ||
      event.damage > 100 ||
      !event.impact ||
      ![event.impact.x, event.impact.y, event.impact.z].every(Number.isFinite) ||
      !Number.isFinite(event.range) ||
      event.range < 0 ||
      !['body', 'head'].includes(event.region) ||
      typeof event.killed !== 'boolean'
    )
      return false;
    const target = session.players.find((p) => p.sessionId === event.targetSessionId);
    if (
      event.shooterSessionId !== session.sessionId ||
      event.matchGeneration !== session.matchGeneration ||
      event.lifeGeneration !== session.lifeGeneration ||
      !target ||
      event.targetLifeGeneration !== target.lifeGeneration
    )
      return false;
    presentSnapshot(session);
    // Events follow impact order; travelling shots can arrive out of fire order.
    if (event.eventId <= lastEventId || seenShots.has(event.shotId)) return false;
    lastEventId = event.eventId;
    seenShots.add(event.shotId);
    if (seenShots.size > 128) seenShots.delete(seenShots.values().next().value);
    feedback.marker();
    const effect = feedback.number(event.impact.x, event.impact.y, event.impact.z, event.damage);
    if (effect) effects.push(effect);
    return true;
  }
  /** @param {number} dt */
  function tickFeedback(dt) {
    const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    feedback.tickMarker(delta);
    effects = effects.filter((effect) => {
      if (effect.tick(delta)) return true;
      effect.remove();
      return false;
    });
  }
  /** @param {string} code @param {string} [message] */
  function showConnectionError(code, message = '') {
    const labels = /** @type {Record<string,string>} */ ({
      unavailable:
        'Server unavailable. Check the server address; on HTTPS, confirm certificate trust. Retry or return to menu.',
      rejected:
        'Room or protocol rejected. Use the matching game/server version. Retry or return to menu.',
      disconnected:
        'Disconnected from the server. Retry to join a fresh session or return to menu.',
    });
    const label = labels[code] ?? labels.unavailable;
    text(
      'mp-error-message',
      `${label}${message ? ` ${String(message).slice(0, 240)}` : ''}`.slice(0, 400)
    );
    if (elements['mp-error-banner']) elements['mp-error-banner'].hidden = false;
  }
  function clearConnectionError() {
    text('mp-error-message', '');
    if (elements['mp-error-banner']) elements['mp-error-banner'].hidden = true;
  }
  function showPointerLockError() {
    text('mp-input-message', 'Mouse capture failed. The match continues. Select Resume to retry, or leave online.');
  }
  function clearPointerLockError() {
    text('mp-input-message', '');
  }
  function reset() {
    clearFeedback();
    clearConnectionError();
    clearPointerLockError();
    generation = '';
    lastEventId = 0;
    seenShots.clear();
    for (const id of [
      'mp-result-title',
      'mp-result-score',
      'mp-result-countdown',
      'mp-result-stats',
      'mp-respawn',
      'mp-rules-label',
    ])
      text(id, '');
  }
  return {
    presentConfirmedHit,
    presentSnapshot,
    tickFeedback,
    showConnectionError,
    clearConnectionError,
    showPointerLockError,
    clearPointerLockError,
    reset,
  };
}

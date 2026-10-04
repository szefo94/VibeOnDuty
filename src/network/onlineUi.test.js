// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { createOnlineUi, teamSwitchReason } from './onlineUi.js';
import { createSimulation } from '../shared/tdmSimulation.js';
import { requestFire, stepProjectiles } from '../shared/combat.js';
/** @returns {any} */
function fixture() {
  const marker = vi.fn(),
    number = vi.fn(() => ({ tick: vi.fn(() => false), remove: vi.fn() }));
  const tickMarker = vi.fn(),
    clearMarker = vi.fn();
  const elements = Object.fromEntries(
    [
      'mp-error-banner',
      'mp-error-message',
      'mp-result-stats',
      'mp-result-title',
      'mp-result-score',
      'mp-result-countdown',
      'mp-results',
      'mp-match-controls',
      'mp-respawn',
      'mp-rules-label',
      'mp-input-message',
    ].map((id) => [id, { textContent: '', hidden: true }])
  );
  for (const element of Object.values(elements))
    Object.defineProperty(element, 'innerHTML', {
      set() {
        throw new Error('Untrusted HTML sink');
      },
    });
  const ui = createOnlineUi(elements, { marker, number, tickMarker, clearMarker });
  const session = {
    sessionId: 'shooter',
    matchGeneration: 1,
    lifeGeneration: 1,
    players: [{ sessionId: 'target', lifeGeneration: 2 }],
  };
  const event = {
    shooterSessionId: 'shooter',
    targetSessionId: 'target',
    matchGeneration: 1,
    lifeGeneration: 1,
    targetLifeGeneration: 2,
    eventId: 1,
    shotId: 1,
    damage: 28,
    impact: { x: 1, y: 2, z: 3 },
    region: 'body',
    range: 4,
    killed: false,
  };
  return { ui, elements, marker, number, tickMarker, clearMarker, session, event };
}
describe('confirmed online presentation', () => {
  it('disables balanced-team switches even while dead or during results', () => {
    const me = { team: 'blue', alive: false }, peer = { team: 'red', alive: true };
    for (const phase of ['active', 'results'])
      expect(teamSwitchReason(me, phase, [me, peer])).toContain('balanced');
    expect(teamSwitchReason({ ...me, team: 'red' }, 'results', [me, peer])).toContain('balanced');
  });
  it('allows solo results and legal smaller-team switches, while blocking active living players', () => {
    const me = { team: 'blue', alive: true };
    expect(teamSwitchReason(me, 'active', [me])).toContain('dead');
    expect(teamSwitchReason(me, 'results', [me])).toBe('');
    const players = [me, { team: 'blue' }, { team: 'red' }];
    expect(teamSwitchReason({ ...me, alive: false }, 'active', players)).toBe('');
    expect(teamSwitchReason({ team: 'red', alive: false }, 'active', players)).toContain('balanced');
  });
  it('shows mouse recovery without mislabeling the live connection and clears it on capture or teardown', () => {
    const f = fixture();
    f.ui.showPointerLockError();
    expect(f.elements['mp-input-message'].textContent).toContain('match continues');
    expect(f.elements['mp-input-message'].textContent).toContain('Resume');
    expect(f.elements['mp-error-banner'].hidden).toBe(true);
    f.ui.clearPointerLockError();
    expect(f.elements['mp-input-message'].textContent).toBe('');
    f.ui.showPointerLockError();
    f.ui.reset();
    expect(f.elements['mp-input-message'].textContent).toBe('');
  });
  it('presents both real impacts when shot IDs reverse, but never repeats events or seen shots', () => {
    const f = fixture();
    const simulation = createSimulation({ width: 8, height: 8, H2: 1.4, style: 'rooftop',
      tiles: Array.from({ length: 8 }, () => Array(8).fill(0)),
      heightmap: Array.from({ length: 8 }, () => Array(8).fill(0)),
      spawnAttacker: { x: 10, z: 10 }, spawnDefender: { x: 14, z: 10 } });
    const shooter = simulation.addPlayer('shooter'), target = simulation.addPlayer('target');
    shooter.yaw = -Math.PI / 2;
    target.lifeGeneration = 2;
    let shotId = 0, eventId = 0;
    const launch = { active: true, matchGeneration: 1, nextShotId: () => ++shotId, random: () => 0.5 };
    const first = requestFire(shooter, 0, simulation.world, launch);
    const second = requestFire(shooter, 100, simulation.world, launch);
    if (!first || !second) throw new Error('Expected two eligible real M4 shots');
    /** @type {import('../shared/combat.js').Hit[]} */ const events = [];
    stepProjectiles({ players: new Map([['shooter', shooter], ['target', target]]),
      projectiles: [first, second], events, world: simulation.world,
      matchGeneration: 1, phase: 'playing', rules: simulation.rules,
      nextEventId: () => ++eventId, onDeath: () => {} }, 0.1);
    expect(target.health).toBe(44);
    expect(events.map((event) => [event.eventId, event.shotId])).toEqual([[1, 2], [2, 1]]);
    for (const event of events) expect(f.ui.presentConfirmedHit(event, f.session)).toBe(true);
    for (const event of events) expect(f.ui.presentConfirmedHit(event, f.session)).toBe(false);
    expect(f.ui.presentConfirmedHit({ ...events[0], eventId: 3 }, f.session)).toBe(false);
    expect(f.marker).toHaveBeenCalledTimes(2);
    expect(f.number).toHaveBeenCalledTimes(2);
    f.ui.presentSnapshot({ ...f.session, matchGeneration: 2 });
    expect(f.ui.presentConfirmedHit({ ...events[0], matchGeneration: 2 },
      { ...f.session, matchGeneration: 2 })).toBe(true);
  });
  it('rejects malformed current-generation confirmations before marker, number or dedupe changes', () => {
    const f = fixture();
    for (const change of [
      { damage: 999 },
      { damage: 0 },
      { damage: NaN },
      { impact: { x: NaN, y: 0, z: 0 } },
      { shotId: 0 },
      { eventId: 1.5 },
      { region: 'invalid' },
    ])
      expect(f.ui.presentConfirmedHit({ ...f.event, ...change }, f.session)).toBe(false);
    expect(f.marker).not.toHaveBeenCalled();
    expect(f.ui.presentConfirmedHit(f.event, f.session)).toBe(true);
  });
  it('presents only the current shooter once and rejects stale identities and generations', () => {
    const f = fixture();
    for (const change of [
      { shooterSessionId: 'target' },
      { targetSessionId: 'retired' },
      { matchGeneration: 0 },
      { lifeGeneration: 0 },
      { targetLifeGeneration: 1 },
    ])
      expect(f.ui.presentConfirmedHit({ ...f.event, ...change }, f.session)).toBe(false);
    expect(f.ui.presentConfirmedHit(f.event, f.session)).toBe(true);
    expect(f.ui.presentConfirmedHit(f.event, f.session)).toBe(false);
    expect(f.marker).toHaveBeenCalledTimes(1);
    expect(f.number).toHaveBeenCalledWith(1, 2, 3, 28);
    expect(f.session).not.toHaveProperty('health');
  });
  it('bounds error text without an HTML sink and keeps recovery actionable', () => {
    const f = fixture();
    f.ui.showConnectionError('unavailable', '<img src=x onerror=alert(1)>'.repeat(100));
    expect(f.elements['mp-error-banner'].hidden).toBe(false);
    expect(f.elements['mp-error-message'].textContent).toContain('Server unavailable');
    expect(f.elements['mp-error-message'].textContent.length).toBeLessThanOrEqual(400);
    expect(f.elements['mp-error-message'].textContent).toContain('<img');
    f.ui.clearConnectionError();
    expect(f.elements['mp-error-banner'].hidden).toBe(true);
    expect(f.elements['mp-error-message'].textContent).toBe('');
  });
  it('expires feedback by render delta and clears effects across generations', () => {
    const f = fixture();
    f.ui.presentConfirmedHit(f.event, f.session);
    const effect = f.number.mock.results[0].value;
    f.ui.tickFeedback(1);
    expect(effect.tick).toHaveBeenCalledWith(1);
    expect(effect.remove).toHaveBeenCalledTimes(1);
    expect(f.tickMarker).toHaveBeenCalledWith(1);
    f.ui.presentConfirmedHit({ ...f.event, eventId: 2, shotId: 2 }, f.session);
    const second = f.number.mock.results[1].value;
    f.ui.presentSnapshot({ ...f.session, matchGeneration: 2 });
    expect(second.remove).toHaveBeenCalledTimes(1);
    expect(f.clearMarker).toHaveBeenCalled();
    expect(
      f.ui.presentConfirmedHit(
        { ...f.event, matchGeneration: 2 },
        { ...f.session, matchGeneration: 2 }
      )
    ).toBe(true);
  });
});

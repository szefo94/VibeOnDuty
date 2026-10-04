// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { createOnlineUi } from './onlineUi.js';
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

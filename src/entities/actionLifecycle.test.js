import { describe, expect, it, vi } from 'vitest';
import { createActionLifecycle } from './actionLifecycle.js';

describe('simulation action ownership', () => {
  it('fires once at 0.405 seconds, completes at 0.9 and suppresses overlap', () => {
    const action = createActionLifecycle(), release = vi.fn();
    expect(action.begin('throw', 0, 0.9, [{ at: 0.405, run: release }])).toBe(true);
    expect(action.begin('melee', 0, 0.7)).toBe(false);
    expect(action.canAim).toBe(false);
    expect(action.canReload).toBe(false);
    action.tick(0.404); expect(release).not.toHaveBeenCalled();
    action.tick(0.001); expect(release).toHaveBeenCalledTimes(1);
    action.tick(0.495); action.tick(3);
    expect(release).toHaveBeenCalledTimes(1);
    expect(action.presentation.kind).toBe('ready');
    expect(action.canAim).toBe(true);
  });
  it.each(['death', 'menu', 'respawn', 'weapon', 'mode', 'online'])('retires %s before marker', reason => {
    const action = createActionLifecycle(), hit = vi.fn();
    action.begin('melee', 0, 0.7, [{ at: 0.35, run: hit }]);
    action.tick(0.349); action.cancel(reason); action.tick(5);
    expect(hit).not.toHaveBeenCalled();
    expect(action.begin('melee', 0, 0.7)).toBe(false);
    expect(action.begin('melee', action.generation, 0.7)).toBe(true);
  });
  it('retirement within one callback prevents the remaining callback batch', () => {
    const action = createActionLifecycle(), stale = vi.fn();
    action.begin('throw', 0, 0.9, [{ at: 0.405, run: () => action.cancel('death') },
      { at: 0.405, run: stale }]);
    action.tick(0.9); expect(stale).not.toHaveBeenCalled();
  });
  it('chooses deterministic priority for simultaneous requests without a queue', () => {
    const action = createActionLifecycle();
    for (const kinds of [['ads', 'reload', 'melee', 'throw'], ['throw', 'melee', 'reload', 'fire']])
      expect(action.choose(kinds)).toBe('throw');
    action.begin('melee', 0, 0.7);
    expect(action.choose(['throw', 'reload'])).toBe(null);
    expect(action.choose(['throw', 'retire'])).toBe('retire');
    action.tick(0.7); expect(action.presentation.kind).toBe('ready');
  });
  it('sampling or editing read-only presentation cannot release gameplay markers', () => {
    const action = createActionLifecycle(), release = vi.fn();
    action.begin('throw', 0, 0.9, [{ at: 0.405, run: release }]);
    for (let i = 0; i < 100; i++) expect(Object.isFrozen(action.presentation)).toBe(true);
    expect(action.presentation).not.toHaveProperty('markers');
    action.tick(NaN); action.tick(-1);
    expect(release).not.toHaveBeenCalled();
  });
});

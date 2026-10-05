import { describe, expect, it, vi } from 'vitest';
import { createGraphicsQuality, GRAPHICS_QUALITY_KEY } from './graphicsQuality.js';

function renderer(enabled = true) {
  let ratio = 1;
  return { shadowMap: { enabled, type: 7, size: 2048 },
    getPixelRatio: () => ratio, setPixelRatio: vi.fn((next) => { ratio = next; }) };
}

describe('graphics quality policy', () => {
  it.each([null, undefined, '', 'HIGH', ' medium', 'ultra', {}, 2])('defaults invalid preference %s to Medium', (value) => {
    const policy = createGraphicsQuality({ storage: () => ({ getItem: () => value }) });
    expect(policy.getGraphicsQuality()).toBe('medium');
  });

  it.each([['low', 1], ['medium', 1.5], ['high', 2]])('caps %s for initialization, application and new renderers', (tier, cap) => {
    const outline = vi.fn(), setItem = vi.fn();
    const policy = createGraphicsQuality({ storage: () => ({ getItem: () => tier, setItem }), outline });
    const a = renderer();
    expect(policy.applyGraphicsQuality(a, 4)).toEqual({ quality: tier, ratio: cap, shadows: tier !== 'low' });
    expect(policy.applyGraphicsQuality(renderer(), 4).ratio).toBe(cap);
    expect(policy.applyGraphicsQuality(a, 0.75).ratio).toBe(0.75);
    expect(outline).toHaveBeenLastCalledWith(tier);
    expect(policy.setGraphicsQuality(tier)).toEqual({ quality: tier, saved: true });
    expect(setItem).toHaveBeenCalledWith(GRAPHICS_QUALITY_KEY, tier);
  });

  it('restores the original shadow policy without changing type or dimensions', () => {
    const policy = createGraphicsQuality({ storage: () => null, outline: vi.fn() });
    const on = renderer(), off = renderer(false);
    for (const tier of ['medium', 'low', 'high', 'low', 'medium']) {
      policy.setGraphicsQuality(tier);
      policy.applyGraphicsQuality(on, 3); policy.applyGraphicsQuality(off, 3);
      expect(on.shadowMap.enabled).toBe(tier !== 'low');
      expect(off.shadowMap.enabled).toBe(false);
      expect(on.shadowMap.type).toBe(7); expect(on.shadowMap.size).toBe(2048);
    }
  });

  it('bounds invalid DPR and avoids repeated renderer allocations', () => {
    const policy = createGraphicsQuality({ storage: () => null, outline: vi.fn() });
    const r = renderer();
    for (const ratio of [NaN, Infinity, -1, 0, '3', null]) expect(policy.applyGraphicsQuality(r, ratio).ratio).toBe(1);
    for (let i = 0; i < 30; i++) policy.applyGraphicsQuality(r, 3);
    expect(r.setPixelRatio).toHaveBeenCalledTimes(1);
  });

  it('contains read/write/getter failures and validates the session choice', () => {
    for (const storage of [() => { throw new Error('getter'); },
      () => ({ getItem() { throw new Error('read'); }, setItem() { throw new Error('write'); } }),
      () => null]) {
      const policy = createGraphicsQuality({ storage, outline: vi.fn() });
      expect(policy.getGraphicsQuality()).toBe('medium');
      expect(policy.setGraphicsQuality('high')).toEqual({ quality: 'high', saved: false });
      expect(policy.getGraphicsQuality()).toBe('high');
      expect(policy.applyGraphicsQuality(renderer(), 3).ratio).toBe(2);
      expect(policy.setGraphicsQuality('__proto__').quality).toBe('medium');
    }
  });
});

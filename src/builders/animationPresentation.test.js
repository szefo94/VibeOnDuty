import { describe, it, expect } from 'vitest';
import { createPresentationHistory, normalizePresentation, samplePresentation } from './animationPresentation.js';
const raw = (time, x = 0, z = 0) => ({ identity: 'actor', generation: 1,
  position: { x, y: 0, z }, sampleTimeSeconds: time, bodyYaw: 0, alive: true, onGround: true });
const sample = (h, r, dt = .05) => samplePresentation(normalizePresentation(r, h), h, dt);
describe('actual-motion presentation', () => {
  it('plants blocked feet and projects backward and diagonal displacement', () => {
    const h = createPresentationHistory(); sample(h, raw(0));
    expect(sample(h, raw(.1)).cadence).toBe(0);
    const p = sample(h, raw(.2, .3, .3));
    expect(p.forward).toBeCloseTo(-3); expect(p.right).toBeCloseTo(3);
    expect(p.gait).toEqual([{ key: 'walk_back', weight: .5 }, { key: 'walk_right', weight: .5 }]);
    expect(p.cadence * p.cycleMeters).toBeCloseTo(Math.sqrt(18));
  });
  it('resets first/teleport/regression/generation and retains repeated snapshot velocity', () => {
    const h = createPresentationHistory(); sample(h, raw(0)); sample(h, raw(.1, 0, -.3));
    expect(sample(h, raw(.1, 0, -.3)).speed).toBeCloseTo(3);
    for (const r of [raw(.2, 20), raw(.1, 20), { ...raw(.2, 20), generation: 2 }])
      expect(sample(h, r).speed).toBe(0);
  });
  it('is finite for hostile numbers and never mutates input', () => {
    const h = createPresentationHistory(), r = raw(NaN, Infinity, NaN);
    r.pitch = Infinity;
    const p = sample(h, r);
    expect([p.speed, p.pitch, p.phase, p.torsoYaw].every(Number.isFinite)).toBe(true);
    expect(r.position.x).toBe(Infinity);
  });
  it('plants stop and reversal transitions without advancing travelling cadence while blocked', () => {
    const h=createPresentationHistory();sample(h,raw(0));sample(h,raw(.1,0,-.3));
    const stopped=sample(h,raw(.2,0,-.3));
    expect(stopped.transition).toBe('stop');expect(stopped.cadence).toBe(0);
    sample(h,raw(.3,0,-.6));
    expect(sample(h,raw(.4,0,-.3)).transition).toBe('reversal');
  });
  it('bounded torso leads small turns before contact-aware foot repositioning', () => {
    const h = createPresentationHistory(); sample(h, raw(0));
    const small = sample(h, { ...raw(.1), bodyYaw: .2, aimYaw: .2 });
    expect(small.feetYaw).toBe(0); expect(small.torsoYaw).toBeCloseTo(.2);
    let p = sample(h, { ...raw(.2), bodyYaw: 1, aimYaw: 1 });
    expect(p.turn).toBe('turn_right'); expect(p.torsoYaw).toBe(.7);
    for (let i = 0; i < 9; i++) p = sample(h, { ...raw(.3 + i*.05), bodyYaw: 1, aimYaw: 1 });
    expect(p.feetYaw).toBeCloseTo(1);
  });
  it('enters current reload phase and supports compact jump clocks without callbacks', () => {
    const h = createPresentationHistory(); sample(h, raw(0));
    const p = sample(h, { ...raw(.1), action: { kind: 'reload', total: 1.8, remaining: .45 } });
    expect(p.action.phase).toBe(.75); expect(p.upper).toBe('reload');
    expect(sample(h, { ...raw(.2), onGround: false }).jumpTotal).toBe(.32);
    expect(sample(h, raw(.3)).jumpTotal).toBe(.38);
  });
  it.each([[0,-1,'front'], [0,1,'back'], [-1,0,'left'], [1,0,'right']])('settles trusted death %s/%s once', (x,z,variant) => {
    const h = createPresentationHistory(); sample(h, raw(0));
    let p = sample(h, { ...raw(.1), alive: false, trustedImpact: { x, z } });
    expect(p.deathVariant).toBe(variant);
    for (let i=0;i<15;i++) p=sample(h,{...raw(.2+i*.05),alive:false});
    expect(p.deathVariant).toBe(variant); expect(p.deathPhase).toBe(1); expect(p.settled).toBe(true);
    expect(sample(h, { ...raw(1.1), generation: 2 }).deathVariant).toBe(null);
  });
});

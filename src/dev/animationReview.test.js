import { describe, it, expect, vi } from 'vitest';
import { createAnimationReviewOwner, REVIEW_SCENARIOS } from './animationReview.js';

const pending = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const actor = () => ({ duration: 1.8, update: vi.fn(), render: vi.fn(), dispose: vi.fn(), getFrozenDebug: () => ({ joints:65 }) });
describe('isolated animation review ownership', () => {
  it('offers exactly sixteen fixed approved scenarios', () => {
    expect(Object.keys(REVIEW_SCENARIOS)).toHaveLength(16);
    expect(Object.values(REVIEW_SCENARIOS).filter(s => s.startsWith('Preview —'))).toHaveLength(5);
  });
  it('never autoplays and scrub/reset cannot trigger outcome callbacks', async () => {
    const a=actor(), live={ ammo:30, health:100, velocity:0 }, outcome=vi.fn();
    const owner=createAnimationReviewOwner({createActor:async()=>a}); await owner.open();
    owner.tick(.05); expect(owner.getFrozenDebug().phase).toBe(0);
    owner.play(); owner.tick(.05); owner.pause(); owner.scrub(45); owner.reset();
    expect(outcome).not.toHaveBeenCalled(); expect(live).toEqual({ammo:30,health:100,velocity:0});
    expect(a.update.mock.calls.some(([phase])=>phase===.45)).toBe(true);
    owner.close(); owner.close(); expect(a.dispose).toHaveBeenCalledTimes(1);
    owner.tick(.05); expect(owner.getFrozenDebug().actorCount).toBe(0);
  });
  it('invalidates before selection, retry and close; stale actors silently self-retire', async () => {
    const jobs=[pending(),pending(),pending()], changed=vi.fn(), restore=vi.fn(); let i=0;
    const owner=createAnimationReviewOwner({createActor:()=>jobs[i++].promise,changed,restore});
    const first=owner.open(), second=owner.select({weapon:'awp'}), third=owner.retry();
    const stale1=actor(), stale2=actor(), current=actor();
    jobs[1].resolve(stale2); await second; expect(stale2.dispose).toHaveBeenCalledTimes(1);
    jobs[2].resolve(current); await third; expect(owner.getFrozenDebug().actorCount).toBe(1);
    owner.close(); const count=changed.mock.calls.length;
    jobs[0].resolve(stale1); await first;
    expect(stale1.dispose).toHaveBeenCalledTimes(1); expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(count); expect(restore).toHaveBeenCalledTimes(1);
  });
  it('keeps loading/error/empty recoverable with one owned resource', async () => {
    let fail=true; const owner=createAnimationReviewOwner({createActor:async()=>{if(fail)throw Error('load');return null;}});
    await owner.open(); expect(owner.getFrozenDebug().state).toBe('error');
    fail=false; await owner.retry(); expect(owner.getFrozenDebug().state).toBe('empty');
    owner.play(); owner.scrub(100); expect(owner.getFrozenDebug().phase).toBe(0); owner.close();
  });
  it('blocks ineligible open without suspending and rejects arbitrary selections', async () => {
    const suspend=vi.fn(), factory=vi.fn(async()=>actor());
    const denied=createAnimationReviewOwner({createActor:factory,suspend,eligible:()=> 'online'});
    expect(await denied.open()).toBe(false); expect(suspend).not.toHaveBeenCalled();
    const owner=createAnimationReviewOwner({createActor:factory}); await owner.open();
    await owner.select({weapon:'<script>',view:'url',scenario:'arbitrary'});
    expect(owner.getFrozenDebug().selection).toEqual({weapon:'m4',view:'third',scenario:'ready'});
    owner.close();
  });
});

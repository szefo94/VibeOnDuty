const PRIORITY = ['retire', 'throw', 'melee', 'reload', 'fire', 'ads'];

// A presentation snapshot contains no executable markers. Only simulation tick owns them.
export function createActionLifecycle() {
  let generation = 0;
  let active = null;
  let reason = 'ready';
  const snapshot = () => Object.freeze({ generation, kind: active?.kind ?? 'ready',
    elapsed: active?.elapsed ?? 0, duration: active?.duration ?? 0,
    phase: active ? active.elapsed / active.duration : 0, reason });
  return Object.freeze({
    get generation() { return generation; },
    get presentation() { return snapshot(); },
    get canAim() { return active === null; },
    get canReload() { return active === null; },
    choose(requests) {
      if (requests.includes('retire')) return 'retire';
      if (active) return null;
      return PRIORITY.find(kind => requests.includes(kind)) ?? null;
    },
    begin(kind, ownerGeneration, durationSeconds, markers = []) {
      if (active || ownerGeneration !== generation || !['throw', 'melee'].includes(kind) ||
          !Number.isFinite(durationSeconds) || durationSeconds <= 0 ||
          markers.some(marker => !Number.isFinite(marker.at) || marker.at < 0 ||
            marker.at > durationSeconds || typeof marker.run !== 'function')) return false;
      active = { kind, elapsed: 0, duration: durationSeconds,
        markers: markers.map(marker => ({ ...marker, fired: false })).sort((a, b) => a.at - b.at) };
      reason = 'active';
      return true;
    },
    tick(dt) {
      if (!active || !Number.isFinite(dt) || dt <= 0) return snapshot();
      const owner = active;
      owner.elapsed = Math.min(owner.duration, owner.elapsed + dt);
      for (const marker of owner.markers) {
        if (active !== owner) break; // a marker may retire the owner synchronously
        if (!marker.fired && owner.elapsed + 1e-12 >= marker.at) {
          marker.fired = true;
          marker.run();
        }
      }
      if (active === owner && owner.elapsed + 1e-12 >= owner.duration) {
        active = null;
        reason = 'completed';
      }
      return snapshot();
    },
    cancel(why = 'retired') {
      ++generation; // invalidate before releasing marker closures
      active = null;
      reason = why;
      return snapshot();
    },
  });
}

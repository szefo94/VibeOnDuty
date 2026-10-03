// @ts-check
import { GRENADE_RADIUS, GRENADE_PEAK_DMG } from '../config.js';

/** Existing firearm body base and Training Range head multiplier. No current
 * range falloff; the authority supplies region/range, never the browser.
 * @param {number} base @param {'body'|'head'} region @param {number} range */
export function bulletDamage(base, region, range) {
  if (!Number.isFinite(base) || base < 0 || !Number.isFinite(range) || range < 0) return 0;
  return base * (region === 'head' ? 4 : 1);
}

// Returns falloff factor [0..1] at given distance from explosion centre.
// 0 at or beyond GRENADE_RADIUS, 1 at ground zero, quadratic dropoff.
/** @param {number} dist */
export function grenadeFalloff(dist) {
  if (dist >= GRENADE_RADIUS) return 0;
  return (1 - dist / GRENADE_RADIUS) ** 2;
}

// Damage dealt to an entity with given maxHp (enemies, drones)
/** @param {number} dist @param {number} maxHp */
export function grenadeEntityDamage(dist, maxHp) {
  return Math.floor((GRENADE_PEAK_DMG / 100) * maxHp * grenadeFalloff(dist));
}

// Damage dealt to the player (capped formula, not hp-percentage based)
/** @param {number} dist @param {number} maxHp */
export function grenadePlayerDamage(dist, maxHp) {
  return Math.floor(maxHp * 0.4 * grenadeFalloff(dist));
}

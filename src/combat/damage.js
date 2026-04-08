import { GRENADE_RADIUS, GRENADE_PEAK_DMG } from '../config.js';

// Returns falloff factor [0..1] at given distance from explosion centre.
// 0 at or beyond GRENADE_RADIUS, 1 at ground zero, quadratic dropoff.
export function grenadeFalloff(dist){
  if(dist>=GRENADE_RADIUS) return 0;
  return (1-dist/GRENADE_RADIUS)**2;
}

// Damage dealt to an entity with given maxHp (enemies, drones)
export function grenadeEntityDamage(dist,maxHp){
  return Math.floor((GRENADE_PEAK_DMG/100)*maxHp*grenadeFalloff(dist));
}

// Damage dealt to the player (capped formula, not hp-percentage based)
export function grenadePlayerDamage(dist,maxHp){
  return Math.floor(maxHp*0.4*grenadeFalloff(dist));
}

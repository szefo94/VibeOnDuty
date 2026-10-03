// @ts-check
import {
  WEAPONS,
  PLAYER_H,
  PLAYER_H_CROUCH,
  PLAYER_R,
  BULLET_SPEED,
  BULLET_GRAV,
  BULLET_MAX_LIFE,
} from '../config.js';
import { segmentBox } from './world.js';
import { bulletDamage } from '../combat/damage.js';

/** @typedef {{x:number,y:number,z:number}} Point */
/** @typedef {{alive:boolean,weapon:string,ammo:number,reserve:number,yaw:number,pitch:number,x:number,y:number,z:number,sessionId:string,team:string,lifeGeneration:number,crouching:boolean,nextFireAtMs:number,reloadEndsAtMs:number,spread:number,spreadUpdatedAtMs:number,reloadRemaining:number,shootRemaining:number}} WeaponBody */
/** @typedef {{shooterSessionId:string,shooterTeam:string,lifeGeneration:number,matchGeneration:number,shotId:number,pos:Point,origin:Point,vel:Point,life:number}} Projectile */
/** @typedef {{kind:'obstruction',t:number}|{kind:'actor',t:number,sessionId:string,targetLifeGeneration:number,region:'body'|'head'}} Impact */
/** @typedef {{shooterSessionId:string,targetSessionId:string,matchGeneration:number,lifeGeneration:number,targetLifeGeneration:number,shotId:number,eventId:number,damage:number,impact:Point,region:'body'|'head',range:number,killed:boolean}} Hit */
export const IMPACT_EPSILON = 1e-7;

/** Complete reload at its server deadline; cooling matches shoot.js's 0.5/s.
 * @param {WeaponBody} p @param {number} nowMs */
export function updateWeaponState(p, nowMs) {
  p.spread = Math.max(0, p.spread - Math.max(0, nowMs - p.spreadUpdatedAtMs) * 0.0005);
  p.spreadUpdatedAtMs = nowMs;
  if (p.reloadEndsAtMs > 0 && nowMs >= p.reloadEndsAtMs) {
    const take = Math.min(WEAPONS.m4.maxAmmo - p.ammo, p.reserve);
    p.ammo += take;
    p.reserve -= take;
    p.reloadEndsAtMs = 0;
  }
  p.reloadRemaining = Math.max(0, p.reloadEndsAtMs - nowMs) / 1000;
  p.shootRemaining = Math.max(0, p.nextFireAtMs - nowMs) / 1000;
}
/** @param {WeaponBody} p @param {number} nowMs @param {boolean} [active] */
export function requestReload(p, nowMs, active = true) {
  updateWeaponState(p, nowMs);
  if (
    !active ||
    !p.alive ||
    p.weapon !== 'm4' ||
    p.reloadEndsAtMs ||
    p.ammo >= WEAPONS.m4.maxAmmo ||
    p.reserve <= 0
  )
    return false;
  p.reloadEndsAtMs = nowMs + WEAPONS.m4.reload;
  p.reloadRemaining = WEAPONS.m4.reload / 1000;
  return true;
}
/** The server owns the random source and IDs. Aim uses the same right/up spread
 * basis, heat growth and cooling as shoot.js; ADS changes aim presentation but
 * the current M4 source has no ADS accuracy multiplier or range falloff.
 * The muzzle is eye minus 0.28m, with no forward offset that could bypass cover.
 * @param {WeaponBody} p @param {number} nowMs @param {ReturnType<typeof import('./world.js').createWorld>} world
 * @param {{active:boolean,matchGeneration:number,nextShotId:()=>number,random:()=>number}} launch
 * @returns {Projectile|null} */
export function requestFire(p, nowMs, world, launch) {
  updateWeaponState(p, nowMs);
  if (
    !launch.active ||
    !p.alive ||
    p.weapon !== 'm4' ||
    p.ammo <= 0 ||
    p.reloadEndsAtMs ||
    nowMs < p.nextFireAtMs
  )
    return null;
  const origin = { x: p.x, y: p.y - 0.28, z: p.z };
  if (world.sweepObstruction(origin, origin) !== null) return null;
  p.ammo--;
  p.nextFireAtMs = nowMs + WEAPONS.m4.fireRate;
  p.shootRemaining = WEAPONS.m4.fireRate / 1000;
  p.spread = Math.min(1, p.spread + WEAPONS.m4.sprayGrow);
  const ca = p.spread * WEAPONS.m4.sprayMax;
  const rx = (launch.random() - 0.5) * 2 * ca;
  const uy = (launch.random() - 0.5) * 2 * ca;
  const sy = Math.sin(p.yaw),
    cy = Math.cos(p.yaw),
    sp = Math.sin(p.pitch),
    cp = Math.cos(p.pitch);
  const direction = {
    x: -sy * cp + cy * rx + sy * sp * uy,
    y: sp + cp * uy,
    z: -cy * cp - sy * rx + cy * sp * uy,
  };
  const scale = BULLET_SPEED / Math.hypot(direction.x, direction.y, direction.z);
  return {
    shooterSessionId: p.sessionId,
    shooterTeam: p.team,
    lifeGeneration: p.lifeGeneration,
    matchGeneration: launch.matchGeneration,
    shotId: launch.nextShotId(),
    origin,
    pos: { ...origin },
    vel: { x: direction.x * scale, y: direction.y * scale, z: direction.z * scale },
    life: BULLET_MAX_LIFE,
  };
}
/** Choose from the epsilon band around the actual minimum (independent of
 * iteration order, including chained near-ties). Obstruction first, then stable
 * session ID; same actor region ties choose body at the shared boundary.
 * @param {Projectile} projectile @param {Impact[]} candidates @returns {Impact|null} */
export function resolveImpact(projectile, candidates) {
  if (projectile.life <= 0) return null;
  const valid = candidates.filter((c) => Number.isFinite(c.t) && c.t >= 0 && c.t <= 1);
  const minimum = Math.min(...valid.map((c) => c.t));
  return (
    valid
      .filter((c) => c.t <= minimum + IMPACT_EPSILON)
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'obstruction' ? -1 : 1;
        if (a.kind === 'actor' && b.kind === 'actor') {
          if (a.sessionId !== b.sessionId) return a.sessionId < b.sessionId ? -1 : 1;
          if (a.region !== b.region) return a.region === 'body' ? -1 : 1;
        }
        return a.t - b.t;
      })[0] ?? null
  );
}
/** Standing: feet=eye-1.65, body to eye-0.20, radius0.35; head
 * eye-0.20..eye+0.10, radius0.20. Crouched: feet=eye-0.85, same
 * head span/radii. Both use current server-step positions, no rewind.
 * @param {Projectile} b @param {Point} end @param {WeaponBody & {health:number}} p @returns {Impact[]} */
export function actorImpacts(b, end, p) {
  if (!p.alive || p.sessionId === b.shooterSessionId) return [];
  /** @type {Impact[]} */ const hits = [];
  for (const region of /** @type {const} */ (['body', 'head'])) {
    const radius = region === 'head' ? 0.2 : PLAYER_R;
    const low = region === 'head' ? p.y - 0.2 : p.y - (p.crouching ? PLAYER_H_CROUCH : PLAYER_H);
    const high = region === 'head' ? p.y + 0.1 : p.y - 0.2;
    const t = segmentBox(
      b.pos,
      end,
      { x: p.x - radius, y: low, z: p.z - radius },
      { x: p.x + radius, y: high, z: p.z + radius }
    );
    if (t !== null)
      hits.push({
        kind: 'actor',
        t,
        sessionId: p.sessionId,
        targetLifeGeneration: p.lifeGeneration,
        region,
      });
  }
  return hits;
}
/** @typedef {{players:Map<string,WeaponBody & {health:number}>,projectiles:Projectile[],events:Hit[],world:ReturnType<typeof import('./world.js').createWorld>,matchGeneration:number,phase:string,rules:{friendlyDamage:number},nextEventId:()=>number,onDeath:(target:WeaponBody,projectile:Projectile)=>void}} CombatSimulation */
/** @param {CombatSimulation} sim @param {number} dtSeconds */
export function stepProjectiles(sim, dtSeconds) {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0 || dtSeconds > 0.1) return;
  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const b = sim.projectiles[i];
    if (b.matchGeneration !== sim.matchGeneration || sim.phase !== 'playing' || b.life <= 1e-9) {
      sim.projectiles.splice(i, 1);
      continue;
    }
    const dt = Math.min(dtSeconds, b.life);
    b.vel.y -= BULLET_GRAV * dt;
    const end = { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt, z: b.pos.z + b.vel.z * dt };
    /** @type {Impact[]} */ const candidates = [];
    const obstruction = sim.world.sweepObstruction(b.pos, end);
    if (obstruction !== null) candidates.push({ kind: 'obstruction', t: obstruction });
    for (const p of sim.players.values()) candidates.push(...actorImpacts(b, end, p));
    const hit = resolveImpact(b, candidates);
    // Lifetime is half-open: exact exhaustion cannot start a new impact.
    if (hit?.kind === 'actor' && !(dt >= b.life - 1e-9 && hit.t >= 1 - 1e-9)) {
      const target = sim.players.get(hit.sessionId);
      if (
        target?.alive &&
        target.lifeGeneration === hit.targetLifeGeneration &&
        b.matchGeneration === sim.matchGeneration &&
        sim.phase === 'playing'
      ) {
        const impact = {
          x: b.pos.x + (end.x - b.pos.x) * hit.t,
          y: b.pos.y + (end.y - b.pos.y) * hit.t,
          z: b.pos.z + (end.z - b.pos.z) * hit.t,
        };
        const range = Math.hypot(
          impact.x - b.origin.x,
          impact.y - b.origin.y,
          impact.z - b.origin.z
        );
        const amount =
          bulletDamage(WEAPONS.m4.damage, hit.region, range) *
          (b.shooterTeam === target.team ? sim.rules.friendlyDamage : 1);
        const health = Math.max(0, Math.min(100, target.health - amount));
        const damage = target.health - health;
        target.health = health;
        const killed = health === 0;
        if (killed) {
          target.alive = false;
          sim.onDeath(target, b);
        }
        sim.events.push({
          shooterSessionId: b.shooterSessionId,
          targetSessionId: target.sessionId,
          matchGeneration: b.matchGeneration,
          lifeGeneration: b.lifeGeneration,
          targetLifeGeneration: hit.targetLifeGeneration,
          shotId: b.shotId,
          eventId: sim.nextEventId(),
          damage,
          impact,
          region: hit.region,
          range,
          killed,
        });
      }
    }
    b.pos = end;
    b.life = Math.max(0, b.life - dt);
    if (hit || b.life <= 1e-9) sim.projectiles.splice(i, 1);
  }
}

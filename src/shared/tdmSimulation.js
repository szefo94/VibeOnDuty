// @ts-check
import { PLAYER_H, PLAYER_H_CROUCH, WEAPONS } from '../config.js';
import { createWorld, bodiesOverlap } from './world.js';
import { stepMovement } from './movement.js';
import { validateInput } from './protocol.js';
import { requestFire, requestReload, updateWeaponState, stepProjectiles } from './combat.js';
export { segmentBox } from './world.js';

/** @typedef {{x:number,y:number,z:number}} Point */
/** @typedef {import('./world.js').MapData} MapData */
/** @typedef {import('./protocol.js').Command} Command */
/** @typedef {import('./movement.js').MovementBody & import('./combat.js').WeaponBody & {sessionId:string,team:string,health:number,lifeGeneration:number,ammo:number,reserve:number,lastSeq:number,lastConsumedSeq:number,reloadRemaining:number,shootRemaining:number,input:Command|null,inputAge:number}} Body */

/** @param {MapData} mapData @param {{killLimit?:number,matchSeconds?:number,respawnSeconds?:number,friendlyDamage?:number,resultsSeconds?:number}} [settings] @param {{randomSeed?:number}} [options] */
export function createSimulation(mapData, settings = {}, options = {}) {
  const world = createWorld(mapData);
  const rules = {
    killLimit: 50,
    matchSeconds: 600,
    respawnSeconds: 3,
    friendlyDamage: 0.25,
    resultsSeconds: 15,
    ...settings,
  };
  /** @type {Map<string,Body>} */
  const players = new Map();
  /** @type {import('./combat.js').Projectile[]} */
  const projectiles = [];
  /** @type {import('./combat.js').Hit[]} */
  const events = [];
  let timeRemaining = rules.matchSeconds,
    matchGeneration = 1,
    shotId = 0,
    eventId = 0,
    currentTick = 0,
    nowMs = 0;
  let randomState = (options.randomSeed ?? Math.floor(Math.random() * 4294967296)) >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const score = { alpha: 0, bravo: 0 };
  /** @param {string} sessionId */
  function addPlayer(sessionId) {
    if (players.has(sessionId)) return players.get(sessionId);
    const alpha = [...players.values()].filter((p) => p.team === 'alpha').length;
    const team = alpha <= players.size - alpha ? 'alpha' : 'bravo';
    const spawn = world.chooseSpawn(
      team,
      [...players.values()].filter((p) => p.alive)
    );
    /** @type {Body} */
    const body = {
      sessionId,
      team,
      x: spawn?.x ?? 0,
      y: spawn?.y ?? 0,
      z: spawn?.z ?? 0,
      yaw: 0,
      pitch: 0,
      health: 100,
      weapon: 'm4',
      nextFireAtMs: 0,
      reloadEndsAtMs: 0,
      spread: 0,
      spreadUpdatedAtMs: nowMs,
      alive: !!spawn,
      lifeGeneration: 1,
      ammo: WEAPONS.m4.maxAmmo,
      reserve: WEAPONS.m4.reserve,
      lastSeq: -1,
      lastConsumedSeq: -1,
      reloadRemaining: 0,
      shootRemaining: 0,
      moving: false,
      crouching: false,
      onGround: true,
      verticalVelocity: 0,
      aiming: false,
      sprinting: false,
      airVelX: 0,
      airVelZ: 0,
      jumpHeld: false,
      input: null,
      inputAge: 0,
    };
    players.set(sessionId, body);
    return body;
  }
  /** @param {string} sessionId @param {unknown} raw */
  function queueInput(sessionId, raw) {
    const p = players.get(sessionId);
    if (!p) return false;
    const validation = validateInput(raw, {
      currentTick,
      lastSeq: p.lastSeq,
      matchGeneration,
      lifeGeneration: p.lifeGeneration,
    });
    if (!validation.ok) return false;
    const c = validation.command;
    p.lastSeq = c.seq;
    // Latest movement replaces older intent; one fire edge persists until consumed.
    p.input = c.neutral
      ? { ...c }
      : {
          ...c,
          fire: c.fire || !!p.input?.fire,
          reload: c.reload || !!p.input?.reload,
          jump: c.jump || !!p.input?.jump,
        };
    p.inputAge = 0;
    return true;
  }
  /** @param {number} dt */
  function stepSimulation(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
    currentTick++;
    nowMs += dt * 1000;
    events.length = 0;
    if (players.size) timeRemaining = Math.max(0, timeRemaining - dt);
    for (const p of players.values()) {
      if (!p.alive || timeRemaining === 0) {
        p.input = null;
        p.moving = false;
        if (!p.alive && p.health === 100) {
          const spawn = world.chooseSpawn(
            p.team,
            [...players.values()].filter((b) => b.alive)
          );
          if (spawn) {
            Object.assign(p, spawn);
            p.alive = true;
          }
        }
        continue;
      }
      updateWeaponState(p, nowMs);
      const c = p.input;
      p.inputAge += dt;
      p.moving = false;
      const activeInput = c && p.inputAge <= 0.5 ? c : null;
      stepMovement(
        p,
        activeInput,
        {
          groundElevation: world.supportElevation,
          canOccupy: (next, height, allowStep) =>
            world.canOccupy(next, height, allowStep) &&
            [...players.values()].every(
              (b) =>
                b === p ||
                !b.alive ||
                !bodiesOverlap(next, b, height, b.crouching ? PLAYER_H_CROUCH : PLAYER_H)
            ),
        },
        dt
      );
      if (!activeInput || !c) continue;
      p.lastConsumedSeq = c.seq;
      if (c.reload) requestReload(p, nowMs);
      if (c.fire) {
        const projectile = requestFire(p, nowMs, world, {
          active: true,
          matchGeneration,
          nextShotId: () => ++shotId,
          random,
        });
        if (projectile) projectiles.push(projectile);
      }
      c.fire = false;
      c.reload = false;
      c.jump = false;
    }
    // Every actor moves before testing server current-step hit regions.
    stepProjectiles(
      {
        players,
        projectiles,
        events,
        world,
        matchGeneration,
        phase: timeRemaining > 0 && players.size ? 'playing' : 'waiting',
        rules,
        nextEventId: () => ++eventId,
        onDeath: (target, projectile) => {
          clearInput(target.sessionId);
          const shooter = players.get(projectile.shooterSessionId);
          if (
            shooter &&
            shooter.lifeGeneration === projectile.lifeGeneration &&
            shooter.team === projectile.shooterTeam &&
            shooter.team !== target.team
          )
            score[/** @type {'alpha'|'bravo'} */ (shooter.team)]++;
        },
      },
      dt
    );
  }
  function snapshot() {
    return {
      protocolVersion: 1,
      mapId: 'bunker',
      phase: players.size ? 'playing' : 'waiting',
      matchGeneration,
      currentTick,
      timeRemaining,
      score: { ...score },
      players: [...players.values()].map(({ input: _input, inputAge: _age, ...p }) => ({ ...p })),
      projectileCount: projectiles.length,
    };
  }
  /** @param {string} id */
  const removePlayer = (id) => {
    players.delete(id);
  };
  /** Retire held intentions on death, generation change, expiry or leave.
   * @param {string} id */
  function clearInput(id) {
    const body = players.get(id);
    if (body) {
      body.input = null;
      body.inputAge = 0;
      body.jumpHeld = false;
    }
  }
  return {
    addPlayer,
    removePlayer,
    queueInput,
    clearInput,
    stepSimulation,
    snapshot,
    events,
    world,
    rules,
  };
}

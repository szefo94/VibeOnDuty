// @ts-check
import { PLAYER_H, PLAYER_H_CROUCH, WEAPONS } from '../config.js';
import { createWorld, bodiesOverlap } from './world.js';
import { stepMovement } from './movement.js';
import { validateInput } from './protocol.js';
import { requestFire, requestReload, updateWeaponState, stepProjectiles } from './combat.js';
import {
  createTdmRules,
  onJoin,
  requestTeamSwitch,
  onDeath,
  tickRules,
  onLeave,
} from './tdmRules.js';
export { segmentBox } from './world.js';

/** @typedef {import('./world.js').MapData} MapData */
/** @typedef {import('./protocol.js').Command} Command */
/** @typedef {import('./movement.js').MovementBody & import('./combat.js').WeaponBody & import('./tdmRules.js').Member & {health:number,lastSeq:number,lastConsumedSeq:number,input:Command|null,inputAge:number,kills:number,deaths:number}} Body */

/** @param {MapData} mapData @param {{killLimit?:number,matchSeconds?:number,respawnSeconds?:number,friendlyDamage?:number,resultsSeconds?:number}} [settings] @param {{randomSeed?:number}} [options] */
export function createSimulation(mapData, settings = {}, options = {}) {
  const world = createWorld(mapData);
  const { friendlyDamage, ...configured } = settings;
  const lifecycle = createTdmRules({
    ...configured,
    ...(friendlyDamage === undefined ? {} : { friendlyFire: friendlyDamage }),
  });
  const rules = Object.freeze({
    ...lifecycle.settings,
    friendlyDamage: lifecycle.settings.friendlyFire,
  });
  /** @type {Map<string,Body>} */ const players = new Map();
  /** @type {import('./combat.js').Projectile[]} */ const projectiles = [];
  /** @type {import('./combat.js').Hit[]} */ const events = [];
  let shotId = 0,
    eventId = 0,
    currentTick = 0,
    nowMs = 0;
  let randomState = (options.randomSeed ?? Math.floor(Math.random() * 4294967296)) >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  /** Reset every inventory/action field; identity/team/ordinal are preserved.
   * @param {Body} body */
  function resetLife(body) {
    Object.assign(body, {
      health: 100,
      weapon: 'm4',
      ammo: WEAPONS.m4.maxAmmo,
      reserve: WEAPONS.m4.reserve,
      yaw: 0,
      pitch: 0,
      alive: false,
      respawnAtMs: -1,
      nextFireAtMs: 0,
      reloadEndsAtMs: 0,
      spread: 0,
      spreadUpdatedAtMs: nowMs,
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
    });
  }
  /** Bounded stable world candidates; an exhausted map remains pending.
   * @param {Body} body @param {boolean} advanceLife */
  function trySpawn(body, advanceLife) {
    const spawn = world.chooseSpawn(
      body.team,
      [...players.values()].filter((p) => p !== body && p.alive)
    );
    if (!spawn) return false;
    resetLife(body);
    if (advanceLife) body.lifeGeneration++;
    Object.assign(body, spawn, { alive: true });
    return true;
  }
  /** @param {string} sessionId @param {unknown} [options] @returns {Body} */
  function addPlayer(sessionId, options) {
    const existing = players.get(sessionId);
    if (existing) return existing;
    /** @type {Body} */
    const body = {
      sessionId,
      team: '',
      nickname: '',
      joinOrdinal: 0,
      respawnAtMs: -1,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      health: 100,
      weapon: 'm4',
      nextFireAtMs: 0,
      reloadEndsAtMs: 0,
      spread: 0,
      spreadUpdatedAtMs: nowMs,
      alive: false,
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
      kills: 0,
      deaths: 0,
    };
    onJoin(lifecycle, body, nowMs, options);
    players.set(sessionId, body);
    if (lifecycle.phase === 'active') trySpawn(body, false);
    return body;
  }
  /** @param {string} sessionId @param {unknown} raw */
  function queueInput(sessionId, raw) {
    const p = players.get(sessionId);
    if (!p || !p.alive || lifecycle.phase !== 'active') return false;
    const validation = validateInput(raw, {
      currentTick,
      lastSeq: p.lastSeq,
      matchGeneration: lifecycle.matchGeneration,
      lifeGeneration: p.lifeGeneration,
    });
    if (!validation.ok) return false;
    const c = validation.command;
    p.lastSeq = c.seq;
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
  function resetTransients() {
    projectiles.length = events.length = 0;
    shotId = eventId = currentTick = 0;
    for (const p of players.values()) {
      resetLife(p);
      p.lifeGeneration++;
      p.kills = p.deaths = 0;
    }
    if (lifecycle.phase === 'active') for (const p of players.values()) trySpawn(p, false);
  }
  /** @param {number} dt */
  function stepSimulation(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
    currentTick++;
    nowMs += dt * 1000;
    events.length = 0;
    if (lifecycle.phase !== 'active') {
      for (const p of players.values()) clearInput(p.sessionId);
      if (tickRules(lifecycle, nowMs) === 'rematch') resetTransients();
      return;
    }
    for (const p of players.values()) {
      if (!p.alive) {
        clearInput(p.sessionId);
        if (
          (p.health === 100 && p.respawnAtMs < 0) ||
          (p.respawnAtMs >= 0 && nowMs + 1e-7 >= p.respawnAtMs)
        )
          trySpawn(p, p.health !== 100);
        continue;
      }
      updateWeaponState(p, nowMs);
      const c = p.input;
      p.inputAge += dt;
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
          matchGeneration: lifecycle.matchGeneration,
          nextShotId: () => ++shotId,
          random,
        });
        if (projectile) projectiles.push(projectile);
      }
      c.fire = c.reload = c.jump = false;
    }
    // The entire current-step impact batch awards deaths before score/time expiry.
    stepProjectiles(
      {
        players,
        projectiles,
        events,
        world,
        matchGeneration: lifecycle.matchGeneration,
        phase: 'playing',
        rules,
        nextEventId: () => ++eventId,
        onDeath: (target, projectile) => {
          const body = players.get(target.sessionId);
          if (!body || !onDeath(lifecycle, body, projectile, nowMs)) return;
          clearInput(body.sessionId);
          body.deaths++;
          const shooter = players.get(projectile.shooterSessionId);
          if (
            shooter &&
            shooter.lifeGeneration === projectile.lifeGeneration &&
            shooter.team === projectile.shooterTeam &&
            shooter.team !== body.team
          )
            shooter.kills++;
        },
      },
      dt
    );
    if (tickRules(lifecycle, nowMs) === 'results') {
      projectiles.length = 0;
      for (const p of players.values()) {
        clearInput(p.sessionId);
        p.respawnAtMs = -1;
      }
    }
  }
  function snapshot() {
    return {
      protocolVersion: 1,
      mapId: 'bunker',
      phase: lifecycle.phase,
      settings: lifecycle.settings,
      scoreBlue: lifecycle.scoreBlue,
      scoreRed: lifecycle.scoreRed,
      winner: lifecycle.winner,
      startedAtMs: lifecycle.startedAtMs,
      endsAtMs: lifecycle.endsAtMs,
      resultsEndsAtMs: lifecycle.resultsEndsAtMs,
      resultsRemaining:
        lifecycle.phase === 'results' ? Math.max(0, lifecycle.resultsEndsAtMs - nowMs) / 1000 : 0,
      nowMs,
      matchGeneration: lifecycle.matchGeneration,
      currentTick,
      timeRemaining:
        lifecycle.phase === 'waiting'
          ? rules.matchSeconds
          : Math.max(0, lifecycle.endsAtMs - nowMs) / 1000,
      score: { alpha: lifecycle.scoreBlue, bravo: lifecycle.scoreRed },
      players: [...players.values()].map(({ input: _input, inputAge: _age, ...p }) => ({ ...p })),
      projectileCount: projectiles.length,
    };
  }
  /** @param {string} id */
  function removePlayer(id) {
    const body = players.get(id);
    if (!body) return;
    clearInput(id);
    players.delete(id);
    onLeave(lifecycle, id, nowMs);
    if (!players.size) resetTransients();
  }
  /** @param {string} id */
  function clearInput(id) {
    const p = players.get(id);
    if (p) {
      p.input = null;
      p.inputAge = 0;
      p.jumpHeld = false;
      p.moving = p.aiming = p.sprinting = false;
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
    lifecycle,
    requestTeamSwitch: (/** @type {string} */ id, /** @type {unknown} */ c) =>
      requestTeamSwitch(lifecycle, id, c),
  };
}

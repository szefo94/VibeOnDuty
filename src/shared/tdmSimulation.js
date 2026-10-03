// @ts-check
import {
  CELL,
  PLAYER_H,
  PLAYER_R,
  MOVE_SPEED,
  WEAPONS,
  BULLET_SPEED,
  BULLET_GRAV,
  BULLET_MAX_LIFE,
} from '../config.js';
import { rampSurface } from '../tiles.js';

/** @typedef {{x:number,y:number,z:number}} Point */
/** @typedef {{width:number,height:number,tiles:number[][],heightmap:number[][],H2:number,spawnAttacker:{x:number,z:number},spawnDefender:{x:number,z:number},wallHeight?:number}} MapData */
/** @typedef {{protocolVersion:number,seq:number,matchGeneration:number,lifeGeneration:number,moveX:number,moveZ:number,yaw:number,pitch:number,fire:boolean,reload:boolean}} Command */
/** @typedef {{sessionId:string,team:string,x:number,y:number,z:number,yaw:number,pitch:number,health:number,alive:boolean,lifeGeneration:number,ammo:number,reserve:number,lastSeq:number,reloadRemaining:number,shootRemaining:number,moving:boolean,input:Command|null,inputAge:number}} Body */

/** Earliest closed segment / axis-aligned box contact. @param {Point} start @param {Point} end @param {Point} lo @param {Point} hi */
export function segmentBox(start, end, lo, hi) {
  let near = 0,
    far = 1;
  for (const axis of /** @type {const} */ (['x', 'y', 'z'])) {
    const d = end[axis] - start[axis];
    if (Math.abs(d) < 1e-10) {
      if (start[axis] < lo[axis] || start[axis] > hi[axis]) return null;
    } else {
      const a = (lo[axis] - start[axis]) / d,
        b = (hi[axis] - start[axis]) / d;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
  }
  return near;
}

/** Temporary owned tracer world; canonical geometry replaces this in the next task. @param {MapData} data */
function tracerWorld(data) {
  const map = structuredClone({
    width: data.width,
    height: data.height,
    tiles: data.tiles,
    heightmap: data.heightmap,
    H2: data.H2,
    spawnAttacker: data.spawnAttacker,
    spawnDefender: data.spawnDefender,
    wallHeight: data.wallHeight,
  });
  /** @param {number} x @param {number} z */
  const groundElevation = (x, z) => {
    const c = Math.floor(x / CELL),
      r = Math.floor(z / CELL);
    return (
      rampSurface(map.tiles[r]?.[c] ?? 1, x / CELL - c, z / CELL - r, map.H2) ??
      map.heightmap[r]?.[c] ??
      0
    );
  };
  /** @param {Point} body */
  const canOccupy = (body) => {
    const feet = body.y - PLAYER_H;
    if (groundElevation(body.x, body.z) - feet > 0.8) return false;
    for (
      let r = Math.floor((body.z - PLAYER_R) / CELL);
      r <= Math.floor((body.z + PLAYER_R) / CELL);
      r++
    ) {
      for (
        let c = Math.floor((body.x - PLAYER_R) / CELL);
        c <= Math.floor((body.x + PLAYER_R) / CELL);
        c++
      ) {
        const tile = map.tiles[r]?.[c] ?? 1;
        if (tile === 1) return false;
        if (tile === 2 && Math.abs(body.z - (r + 0.5) * CELL) < PLAYER_R + 0.175) return false;
        if (tile === 3 && Math.abs(body.x - (c + 0.5) * CELL) < PLAYER_R + 0.175) return false;
      }
    }
    return true;
  };
  /** @param {Point} start @param {Point} end */
  const sweepObstruction = (start, end) => {
    let best = null;
    for (let r = 0; r < map.height; r++)
      for (let c = 0; c < map.width; c++) {
        const tile = map.tiles[r][c];
        if (tile !== 1 && tile !== 2 && tile !== 3) continue;
        const x = (c + 0.5) * CELL,
          z = (r + 0.5) * CELL;
        const rx = tile === 3 ? 0.175 : CELL / 2,
          rz = tile === 2 ? 0.175 : CELL / 2;
        const spans =
          tile === 1
            ? [[0, 3]]
            : [
                [0, PLAYER_H - 0.28],
                [PLAYER_H + 0.28, PLAYER_H + 0.83],
              ];
        for (const [loY, hiY] of spans) {
          const t = segmentBox(
            start,
            end,
            { x: x - rx, y: loY, z: z - rz },
            { x: x + rx, y: hiY, z: z + rz }
          );
          if (t !== null && (best === null || t < best)) best = t;
        }
      }
    return best;
  };
  /** @param {string} team @param {Point[]} occupied */
  const chooseSpawn = (team, occupied) => {
    const s = team === 'alpha' ? map.spawnAttacker : map.spawnDefender;
    const p = { ...s, y: groundElevation(s.x, s.z) + PLAYER_H };
    return canOccupy(p) && occupied.every((b) => Math.hypot(b.x - p.x, b.z - p.z) >= 2 * PLAYER_R)
      ? p
      : null;
  };
  return { groundElevation, canOccupy, sweepObstruction, chooseSpawn };
}

/** @param {MapData} mapData @param {{killLimit?:number,matchSeconds?:number,respawnSeconds?:number,friendlyDamage?:number,resultsSeconds?:number}} [settings] */
export function createSimulation(mapData, settings = {}) {
  const world = tracerWorld(mapData);
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
  /** @type {Array<{sessionId:string,lifeGeneration:number,shotId:number,pos:Point,vel:Point,life:number}>} */
  const projectiles = [];
  /** @type {Array<{shooterSessionId:string,targetSessionId:string,matchGeneration:number,lifeGeneration:number,targetLifeGeneration:number,shotId:number,eventId:number,damage:number,impact:Point}>} */
  const events = [];
  let timeRemaining = rules.matchSeconds,
    matchGeneration = 1,
    shotId = 0,
    eventId = 0;
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
      alive: !!spawn,
      lifeGeneration: 1,
      ammo: WEAPONS.m4.maxAmmo,
      reserve: WEAPONS.m4.reserve,
      lastSeq: -1,
      reloadRemaining: 0,
      shootRemaining: 0,
      moving: false,
      input: null,
      inputAge: 0,
    };
    players.set(sessionId, body);
    return body;
  }
  /** @param {string} sessionId @param {unknown} raw */
  function queueInput(sessionId, raw) {
    const p = players.get(sessionId);
    if (!p || !raw || typeof raw !== 'object') return false;
    const c = /** @type {Command} */ (raw);
    const fields = [
      'protocolVersion',
      'seq',
      'matchGeneration',
      'lifeGeneration',
      'moveX',
      'moveZ',
      'yaw',
      'pitch',
      'fire',
      'reload',
    ];
    if (Object.keys(c).some((k) => !fields.includes(k))) return false;
    if (
      c.protocolVersion !== 1 ||
      c.matchGeneration !== matchGeneration ||
      c.lifeGeneration !== p.lifeGeneration
    )
      return false;
    if (!Number.isSafeInteger(c.seq) || c.seq < 0 || c.seq <= p.lastSeq) return false;
    if (
      ![c.moveX, c.moveZ, c.yaw, c.pitch].every(Number.isFinite) ||
      Math.abs(c.moveX) > 1 ||
      Math.abs(c.moveZ) > 1 ||
      Math.abs(c.yaw) > Math.PI ||
      Math.abs(c.pitch) > 1.38 ||
      typeof c.fire !== 'boolean' ||
      typeof c.reload !== 'boolean'
    )
      return false;
    p.lastSeq = c.seq;
    // Latest movement replaces older intent; one fire edge persists until consumed.
    p.input = { ...c, fire: c.fire || !!p.input?.fire, reload: c.reload || !!p.input?.reload };
    p.inputAge = 0;
    return true;
  }
  /** @param {number} dt */
  function stepSimulation(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
    events.length = 0;
    if (players.size) timeRemaining = Math.max(0, timeRemaining - dt);
    for (const p of players.values()) {
      if (!p.alive) {
        if (p.health === 100) {
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
      p.shootRemaining = Math.max(0, p.shootRemaining - dt);
      if (p.reloadRemaining > 0) {
        p.reloadRemaining = Math.max(0, p.reloadRemaining - dt);
        if (!p.reloadRemaining) {
          const take = Math.min(WEAPONS.m4.maxAmmo - p.ammo, p.reserve);
          p.ammo += take;
          p.reserve -= take;
        }
      }
      const c = p.input;
      p.inputAge += dt;
      p.moving = false;
      if (!c || p.inputAge > 0.25) continue;
      p.yaw = c.yaw;
      p.pitch = c.pitch;
      const len = Math.max(1, Math.hypot(c.moveX, c.moveZ));
      const dx = ((c.moveX * Math.cos(p.yaw) - c.moveZ * Math.sin(p.yaw)) / len) * MOVE_SPEED * dt;
      const dz = ((-c.moveX * Math.sin(p.yaw) - c.moveZ * Math.cos(p.yaw)) / len) * MOVE_SPEED * dt;
      const oldX = p.x,
        oldZ = p.z;
      for (const axis of ['x', 'z']) {
        const x = p.x + (axis === 'x' ? dx : 0),
          z = p.z + (axis === 'z' ? dz : 0);
        const next = { x, y: p.y, z };
        if (
          world.canOccupy(next) &&
          [...players.values()].every(
            (b) => b === p || !b.alive || Math.hypot(x - b.x, z - b.z) >= PLAYER_R * 2 - 1e-9
          )
        ) {
          p.x = x;
          p.z = z;
        }
      }
      p.y = world.groundElevation(p.x, p.z) + PLAYER_H;
      p.moving = Math.hypot(p.x - oldX, p.z - oldZ) > 1e-6;
      if (c.reload && p.ammo < WEAPONS.m4.maxAmmo && p.reserve > 0 && !p.reloadRemaining)
        p.reloadRemaining = WEAPONS.m4.reload / 1000;
      if (c.fire && p.ammo > 0 && !p.reloadRemaining && !p.shootRemaining) {
        p.ammo--;
        p.shootRemaining = WEAPONS.m4.fireRate / 1000;
        const cp = Math.cos(p.pitch);
        projectiles.push({
          sessionId: p.sessionId,
          lifeGeneration: p.lifeGeneration,
          shotId: ++shotId,
          pos: { x: p.x, y: p.y, z: p.z },
          vel: {
            x: -Math.sin(p.yaw) * cp * BULLET_SPEED,
            y: Math.sin(p.pitch) * BULLET_SPEED,
            z: -Math.cos(p.yaw) * cp * BULLET_SPEED,
          },
          life: BULLET_MAX_LIFE,
        });
      }
      c.fire = false;
      c.reload = false;
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const b = projectiles[i],
        start = { ...b.pos };
      b.vel.y -= BULLET_GRAV * dt;
      const end = {
        x: start.x + b.vel.x * dt,
        y: start.y + b.vel.y * dt,
        z: start.z + b.vel.z * dt,
      };
      let best = world.sweepObstruction(start, end);
      /** @type {Body|null} */ let target = null;
      for (const p of players.values()) {
        if (!p.alive || p.sessionId === b.sessionId) continue;
        const t = segmentBox(
          start,
          end,
          { x: p.x - PLAYER_R, y: p.y - PLAYER_H, z: p.z - PLAYER_R },
          { x: p.x + PLAYER_R, y: p.y + 0.1, z: p.z + PLAYER_R }
        );
        if (t !== null && (best === null || t < best)) {
          best = t;
          target = p;
        }
      }
      if (target && best !== null) {
        const shooter = players.get(b.sessionId);
        const damage =
          WEAPONS.m4.damage * (shooter?.team === target.team ? rules.friendlyDamage : 1);
        target.health = Math.max(0, target.health - damage);
        if (!target.health) {
          target.alive = false;
          if (shooter && shooter.team !== target.team)
            score[/** @type {'alpha'|'bravo'} */ (shooter.team)]++;
        }
        const impact = {
          x: start.x + (end.x - start.x) * best,
          y: start.y + (end.y - start.y) * best,
          z: start.z + (end.z - start.z) * best,
        };
        events.push({
          shooterSessionId: b.sessionId,
          targetSessionId: target.sessionId,
          matchGeneration,
          lifeGeneration: b.lifeGeneration,
          targetLifeGeneration: target.lifeGeneration,
          shotId: b.shotId,
          eventId: ++eventId,
          damage,
          impact,
        });
      }
      b.pos = end;
      b.life -= dt;
      if (best !== null || b.life <= 0) projectiles.splice(i, 1);
    }
  }
  function snapshot() {
    return {
      protocolVersion: 1,
      mapId: 'bunker',
      phase: players.size ? 'playing' : 'waiting',
      matchGeneration,
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
  return { addPlayer, removePlayer, queueInput, stepSimulation, snapshot, events, world, rules };
}

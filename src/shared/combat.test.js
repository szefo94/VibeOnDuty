import { describe, expect, it } from 'vitest';
import { createSimulation } from './tdmSimulation.js';
import {
  requestFire,
  requestReload,
  updateWeaponState,
  stepProjectiles,
  resolveImpact,
  actorImpacts,
} from './combat.js';
import { createWorld, segmentBox } from './world.js';
import { bulletDamage } from '../combat/damage.js';
import { Encoder, Decoder } from '@colyseus/schema';
import { PlayerState } from '../../server/tdmRoom.js';

const map = (height = 0) => ({
  width: 40,
  height: 8,
  H2: 1.4,
  style: 'rooftop',
  tiles: Array.from({ length: 8 }, () => Array(40).fill(0)),
  heightmap: Array.from({ length: 8 }, () => Array(40).fill(height)),
  spawnAttacker: { x: 10, z: 10 },
  spawnDefender: { x: 84, z: 10 },
});
const command = (sim, body, changes = {}) => ({
  protocolVersion: 1,
  seq: body.lastSeq + 1,
  ackTick: sim.snapshot().currentTick,
  matchGeneration: sim.snapshot().matchGeneration,
  lifeGeneration: body.lifeGeneration,
  moveX: 0,
  moveZ: 0,
  yaw: -Math.PI / 2,
  pitch: 0.05,
  fire: false,
  reload: false,
  sprint: false,
  jump: false,
  crouch: false,
  aiming: false,
  neutral: false,
  ...changes,
});

describe('authoritative M4 travel', () => {
  it('clips the final fractional step and cannot hit beyond exact lifetime exhaustion', () => {
    const sim = createSimulation(map(10), {}, { randomSeed: 7 });
    const shooter = sim.addPlayer('a');
    const target = sim.addPlayer('b');
    expect(sim.queueInput('a', command(sim, shooter, { fire: true }))).toBe(true);
    for (let i = 0; i < 12; i++) sim.stepSimulation(0.1);
    expect(target.health).toBe(100);
    expect(sim.snapshot().projectileCount).toBe(0);
  });
});

function fixture() {
  const simulation = createSimulation(map(), {}, { randomSeed: 7 });
  const shooter = simulation.addPlayer('shooter');
  const target = simulation.addPlayer('target');
  Object.assign(target, { x: 14, z: 10 });
  const launch = { active: true, matchGeneration: 1, nextShotId: () => 1, random: () => 0.5 };
  return { simulation, shooter, target, launch, world: simulation.world };
}
function projectile(changes = {}) {
  return {
    shooterSessionId: 'shooter',
    shooterTeam: 'alpha',
    lifeGeneration: 1,
    matchGeneration: 1,
    shotId: 1,
    origin: { x: 10, y: 1, z: 10 },
    pos: { x: 10, y: 1, z: 10 },
    vel: { x: 65, y: 0, z: 0 },
    life: 1.1,
    ...changes,
  };
}
function kernel(changes = {}) {
  const f = fixture();
  let eventId = 0,
    deaths = 0;
  const sim = {
    players: new Map([
      [f.shooter.sessionId, f.shooter],
      [f.target.sessionId, f.target],
    ]),
    projectiles: [projectile()],
    events: [],
    world: f.world,
    matchGeneration: 1,
    phase: 'playing',
    rules: { friendlyDamage: 0.25 },
    nextEventId: () => ++eventId,
    onDeath: () => deaths++,
    ...changes,
  };
  return { ...f, sim, deaths: () => deaths };
}
describe('server M4 timing and spread', () => {
  it.each([
    [87, false],
    [88, true],
    [89, true],
  ])('ready time %ims accepts=%s', (time, accepts) => {
    const { shooter, world, launch } = fixture();
    shooter.nextFireAtMs = 88;
    expect(!!requestFire(shooter, time, world, launch)).toBe(accepts);
    expect(shooter.ammo).toBe(accepts ? 29 : 30);
  });
  it.each([
    [0, false],
    [1, true],
  ])('ammo %i accepts=%s', (ammo, accepts) => {
    const { shooter, world, launch } = fixture();
    shooter.ammo = ammo;
    expect(!!requestFire(shooter, 0, world, launch)).toBe(accepts);
    expect(shooter.ammo).toBe(0);
  });
  it.each(['dead', 'inactive', 'reload', 'weapon'])('rejects %s fire', (state) => {
    const { shooter, world, launch } = fixture();
    if (state === 'dead') shooter.alive = false;
    if (state === 'inactive') launch.active = false;
    if (state === 'reload') shooter.reloadEndsAtMs = 1800;
    if (state === 'weapon') shooter.weapon = 'awp';
    expect(requestFire(shooter, 1, world, launch)).toBeNull();
    expect(shooter.ammo).toBe(30);
  });
  it('reload transfers bounded reserve exactly at deadline and cannot restart', () => {
    const { shooter } = fixture();
    shooter.ammo = 27;
    shooter.reserve = 2;
    expect(requestReload(shooter, 100)).toBe(true);
    expect(requestReload(shooter, 101)).toBe(false);
    updateWeaponState(shooter, 1899);
    expect(shooter.ammo).toBe(27);
    updateWeaponState(shooter, 1900);
    expect([shooter.ammo, shooter.reserve]).toEqual([29, 0]);
    updateWeaponState(shooter, 1901);
    expect([shooter.ammo, shooter.reserve]).toEqual([29, 0]);
  });
  it('derives aim/muzzle/speed and uses source heat growth/recovery including ADS', () => {
    const { shooter, world, launch } = fixture();
    shooter.yaw = -Math.PI / 2;
    shooter.pitch = 0;
    const shot = requestFire(shooter, 0, world, launch);
    expect(shot.origin).toEqual({ x: shooter.x, y: shooter.y - 0.28, z: shooter.z });
    expect(Math.hypot(shot.vel.x, shot.vel.y, shot.vel.z)).toBeCloseTo(65);
    expect(shot.vel.x).toBeCloseTo(65);
    expect(shooter.spread).toBeCloseTo(0.08);
    updateWeaponState(shooter, 100);
    expect(shooter.spread).toBeCloseTo(0.03);
    updateWeaponState(shooter, 200);
    expect(shooter.spread).toBe(0);
  });
  it('seeded room random produces the same production trajectory', () => {
    const outputs = [1, 2].map(() => {
      const sim = createSimulation(map(), {}, { randomSeed: 92 });
      const p = sim.addPlayer('a');
      sim.queueInput('a', command(sim, p, { fire: true }));
      sim.stepSimulation(1 / 30);
      return sim.snapshot();
    });
    expect(outputs[0]).toEqual(outputs[1]);
  });
});
describe('first swept contact', () => {
  const actor = (t, sessionId = 'z') => ({
    kind: 'actor',
    t,
    sessionId,
    targetLifeGeneration: 1,
    region: 'body',
  });
  it.each([
    [0, 0.8, 'actor'],
    [0.2, 0.8, 'actor'],
    [0.9, 0.1, 'obstruction'],
    [1, 1, 'obstruction'],
    [0.5, 0.5 + 0.00000009, 'obstruction'],
    [0.5, 0.5 + 0.00000011, 'actor'],
  ])('actor t%s obstruction t%s chooses %s', (a, wall, kind) => {
    expect(resolveImpact(projectile(), [actor(a), { kind: 'obstruction', t: wall }]).kind).toBe(
      kind
    );
  });
  it('ties use stable session IDs independent of candidate order', () => {
    for (const candidates of [
      [actor(0.5, 'z'), actor(0.50000009, 'a')],
      [actor(0.50000009, 'a'), actor(0.5, 'z')],
    ])
      expect(resolveImpact(projectile(), candidates).sessionId).toBe('a');
  });
  it('box sweeps include exact start/end contacts', () => {
    const lo = { x: 1, y: 0, z: 0 },
      hi = { x: 2, y: 2, z: 2 };
    expect(segmentBox({ x: 1, y: 1, z: 1 }, { x: 0, y: 1, z: 1 }, lo, hi)).toBe(0);
    expect(segmentBox({ x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, lo, hi)).toBe(1);
  });
  it('ramp and slab surfaces block swept projectiles', () => {
    const def = map();
    def.tiles[2][3] = 6;
    def.heightmap[2][4] = 1.4;
    const world = createWorld(def);
    expect(world.sweepObstruction({ x: 14, y: 3, z: 10 }, { x: 14, y: 0.2, z: 10 })).not.toBeNull();
    expect(world.sweepObstruction({ x: 18, y: 3, z: 10 }, { x: 18, y: 0.2, z: 10 })).not.toBeNull();
  });
  it('actual near actor wins before far wall, and near wall stops a far actor', () => {
    for (const nearActor of [true, false]) {
      const def = map();
      def.tiles[2][nearActor ? 4 : 3] = 1;
      const { sim, target } = kernel({ world: createWorld(def) });
      target.x = nearActor ? 13 : 17;
      sim.projectiles[0].vel.x = 100;
      stepProjectiles(sim, 0.1);
      expect(target.health).toBe(nearActor ? 72 : 100);
    }
  });
  it('standing/crouched regions follow feet and server eye height; head helper retains4x', () => {
    const { target } = fixture();
    const b = projectile({ pos: { x: 10, y: target.y, z: 10 } });
    expect(actorImpacts(b, { x: 16, y: target.y, z: 10 }, target)[0].region).toBe('head');
    target.crouching = true;
    target.y = 0.85;
    expect(actorImpacts(b, { x: 16, y: 1.65, z: 10 }, target)).toHaveLength(0);
    expect(bulletDamage(28, 'head', 10)).toBe(112);
    expect(bulletDamage(28, 'body', 70)).toBe(28);
  });
});
describe('authoritative impact lifetime and precision', () => {
  it('replicates fractional health as float64 without rounding it to float32', () => {
    const original = new PlayerState({ health: 92.972 });
    const received = new PlayerState();
    new Decoder(received).decode(new Encoder(original).encodeAll());
    expect(received.health).toBe(original.health);
  });
  it('retains fractional friendly health and actual applied damage', () => {
    const { sim, target } = kernel();
    target.team = 'alpha';
    target.health = 5.125;
    stepProjectiles(sim, 0.1);
    expect(target.health).toBe(0);
    expect(sim.events[0].damage).toBe(5.125);
    const next = kernel({ rules: { friendlyDamage: 0.251 } });
    next.target.team = 'alpha';
    stepProjectiles(next.sim, 0.1);
    expect(next.target.health).toBeCloseTo(92.972);
    expect(next.sim.events[0].damage).toBeCloseTo(7.028);
  });
  it('launched projectile outlives dead shooter and applies only one impact', () => {
    const { sim, shooter, target } = kernel();
    shooter.alive = false;
    stepProjectiles(sim, 0.1);
    stepProjectiles(sim, 0.1);
    expect(target.health).toBe(72);
    expect(sim.events).toHaveLength(1);
    expect(sim.projectiles).toHaveLength(0);
  });
  it('dead target, expired bullet and retired match cannot receive delayed damage', () => {
    for (const mode of ['dead', 'expired', 'match', 'results']) {
      const { sim, target } = kernel();
      if (mode === 'dead') target.alive = false;
      if (mode === 'expired') sim.projectiles[0].life = 0;
      if (mode === 'match') sim.matchGeneration++;
      if (mode === 'results') sim.phase = 'results';
      stepProjectiles(sim, 0.1);
      expect(target.health).toBe(100);
      expect(sim.events).toHaveLength(0);
    }
  });
  it('rechecks candidate target life immediately before damage', () => {
    const { sim, target } = kernel();
    const original = sim.players.get.bind(sim.players);
    sim.players.get = (id) => {
      if (id === target.sessionId) target.lifeGeneration++;
      return original(id);
    };
    stepProjectiles(sim, 0.1);
    expect(target.health).toBe(100);
    expect(sim.events).toHaveLength(0);
  });
  it('final fractional segment hits before expiry but never past or exactly at exhaustion', () => {
    for (const x of [12, 13.6, 13.61]) {
      const { sim, target } = kernel();
      target.x = x;
      sim.projectiles[0].life = 0.05;
      stepProjectiles(sim, 0.1);
      expect(target.health).toBe(x === 12 ? 72 : 100);
      expect(sim.projectiles).toHaveLength(0);
    }
  });
  it('two lethal bullets award one transition for a target life', () => {
    const { sim, target, deaths } = kernel();
    target.health = 20;
    sim.projectiles.push(projectile({ shotId: 2 }));
    stepProjectiles(sim, 0.1);
    expect(deaths()).toBe(1);
    expect(sim.events).toHaveLength(1);
    expect(target.alive).toBe(false);
  });
  it('tests moving target at the current step rather than its previous position', () => {
    const { sim, target } = kernel();
    target.z = 20;
    stepProjectiles(sim, 0.1);
    expect(target.health).toBe(100);
  });
});

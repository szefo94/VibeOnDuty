import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_H, PLAYER_H_CROUCH } from '../config.js';

vi.mock('../scene.js', () => ({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(75, 4 / 3, 0.05, 100) }));
vi.mock('../materials.js', () => ({ mm: (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness }) }));
vi.mock('./weaponFBX.js', () => ({ attachWeapons3pToHand: vi.fn() }));
import * as glb from './enemyGLTF.js';
import * as driver from './enemyAnimations.js';
import * as view from './firstPersonRig.js';
import * as guns from './weapon.js';
import * as handling from './weaponHandling.js';
import { WEAPON3P_GRIP, WEAPON3P_ROT } from './weapon3pTransform.js';

// Guard for owner item L-01 (plan 07-35): "when crouching torso is straight instead of leaning
// slightly forwards". The weapon handler leans the crouched torso by one named amount,
// CROUCH_TORSO_LEAN_RAD: spine_01 forward about the character's lateral axis, clavicle_l, clavicle_r
// and neck_01 back by the same angle, so the chest leans while both arms and the head keep their
// orientation. This file reads the amount from that export and never states it.
// The live player and its first-person rig are driven by one actor object, the way src/loop.js runs a
// frame, with the real handlers of src/builders/weapon.js. Character forward is +Z; "chest pitch" is the
// forward pitch of spine_03 in the character frame; the "torso line" is the angle from vertical of the
// line from the pelvis to spine_03; "weapon forward" is the +Y axis of hand_r in the character frame.
// "The lean undone" is the same pose with the four bones put back to what the handler saved in its
// corrections map before it turned them. Every limit below was fixed in the plan before this file
// existed and is never loosened here.
const LIMIT = Object.freeze({
  leanBand: 1.5, // degrees: the settled chest lean against the constant, the torso line against planning
  standing: 0.05, // degrees: chest pitch and torso line of a standing actor against the lean undone
  weapon: 0.2, // degrees: hand_r orientation against the lean undone
  contact: 0.005, // metres: third-person support contact over the value without the lean
  viewArm: 1e-6, // a view arm bone quaternion component against the player whose handler never leans
  firstTick: 0.25, eased: 0.95, released: 0.05, // shares of the constant: one tick of 1/60 s, 0.5 s, 0.5 s
  degreesFrom: 6, degreesTo: 13, // whole degrees the constant may take (plan 07-35, the body-view guard)
  same: 1e-9, // numeric tolerance of an equality
});
// Planning figures of plan 07-35 ("Design, decided from measurement"): the torso line in degrees of
// the composed crouch by degrees of lean. At the default of 12 degrees this is the 14.4 the plan
// asserts; between rows it is interpolated, so the file also holds for the other values the constant
// may take without a number of this file changing.
const PLANNED_TORSO_LINE = [[0, 6.5], [6, 10.4], [8, 11.7], [10, 13.1], [12, 14.4], [15, 16.3]];
const DEG = 180 / Math.PI;
const ROOT = new THREE.Vector3(3.25, 0.5, -7.75); // away from the origin, so no check passes by a zero
const BREATH_START = 0.875; // seconds into the breathing layer; the builder starts it at a random time
const SLOW = 30000; // milliseconds allowed to a case that builds players and runs hundreds of frames
const LEAN_BONES = ['spine_01', 'clavicle_l', 'clavicle_r', 'neck_01'];
const SOURCE = 'src/builders/weaponHandling.js';

let gltf, log;
const figures = { limits: LIMIT, m4: {}, easing: {}, cadence: {} };
const constant = () => handling.CROUCH_TORSO_LEAN_RAD;
const planned = (table, degrees) => {
  const upper = table.findIndex(([at]) => at >= degrees);
  if (upper <= 0) return table[Math.max(0, upper)][1];
  const [[a, low], [b, high]] = [table[upper - 1], table[upper]];
  return low + (high - low) * (degrees - a) / (b - a);
};

beforeAll(async () => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const data = readFileSync('public/models/enemy.glb');
  // Node-only image isolation, as in the other real-GLB unit tests. Browser suites decode the maps.
  vi.stubGlobal('self', globalThis);
  const images = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    const texture = new THREE.Texture(); queueMicrotask(() => onLoad(texture)); return texture;
  });
  try {
    gltf = await new GLTFLoader().parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  } finally { images.mockRestore(); vi.unstubAllGlobals(); }
  // The builders read their template through tryLoadEnemyGLTF: hand it the parsed asset.
  vi.stubGlobal('fetch', async () => ({ ok: true }));
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  try { expect(await glb.tryLoadEnemyGLTF()).toBe(true); } finally { load.mockRestore(); vi.unstubAllGlobals(); }
});
afterAll(() => {
  log.mockRestore();
  // Optional: the measured figures as a file, for the plan summary. Nothing reads it back.
  if (env.LEAN_FIGURES) writeFileSync(env.LEAN_FIGURES, JSON.stringify(figures, null, 2));
});

// ── The live player and one frame, as src/loop.js runs it ─────────────────
const eyeCamera = () => new THREE.PerspectiveCamera(75, 4 / 3, 0.05, 100);
/** The player actor and the first-person rig that live play builds; one at a time, as in the game. */
function livePlayer() {
  expect(glb.buildPlayerMesh()).toBe(true);
  const actor = { mesh: glb.playerMesh, mixer: glb.playerMixer, actions: glb.playerActions };
  actor.actions._breathing.time = BREATH_START;
  return { actor, rig: glb.playerFirstPersonRig, camera: eyeCamera(), time: 0, x: ROOT.x, z: ROOT.z };
}
const owner3p = weapon => guns.playerWeaponHandling.get(`3p:${weapon}`);
const bone = (mesh, name) => mesh.getObjectByName(name);
/** Radians the handler turned spine_01 on its last update: the bone against the value it saved. */
function applied(mesh, owner) {
  const spine = bone(mesh, 'spine_01'), saved = owner.corrections.get(spine);
  return saved ? saved.angleTo(spine.quaternion) : 0;
}
/** `measure()` on the same pose with the lean undone, then the handler's pose again. */
function undone(mesh, owner, measure) {
  const kept = LEAN_BONES.map(name => [bone(mesh, name), bone(mesh, name).quaternion.clone()]);
  for (const [node] of kept) { const saved = owner.corrections.get(node); if (saved) node.quaternion.copy(saved); }
  mesh.updateMatrixWorld(true);
  try { return measure(); } finally {
    for (const [node, quaternion] of kept) node.quaternion.copy(quaternion);
    mesh.updateMatrixWorld(true);
  }
}
/** Chest, head and weapon of an actor in its own frame: forward +Z, up +Y, metres and degrees. */
function posture(mesh) {
  mesh.updateMatrixWorld(true);
  const frame = mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
  const origin = mesh.getWorldPosition(new THREE.Vector3());
  const at = name => bone(mesh, name).getWorldPosition(new THREE.Vector3()).sub(origin).applyQuaternion(frame);
  const turned = name => frame.clone().multiply(bone(mesh, name).getWorldQuaternion(new THREE.Quaternion()));
  const chest = new THREE.Euler().setFromQuaternion(turned('spine_03'), 'YXZ');
  const pelvis = at('pelvis'), spine = at('spine_03'), hand = turned('hand_r');
  const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(hand);
  return { chestPitch: chest.x * DEG, spineYaw: chest.y * DEG,
    torsoLine: Math.atan2(spine.z - pelvis.z, spine.y - pelvis.y) * DEG,
    chest: spine.toArray(), head: at('Head').toArray(), pelvis: pelvis.toArray(), hand,
    weaponYaw: Math.atan2(forward.x, forward.z) * DEG,
    weaponPitch: Math.asin(Math.max(-1, Math.min(1, forward.y))) * DEG };
}
/**
 * Ticks are plain data, so two players can be given identical input. Per tick: `dt`, `state`, and
 * optionally `crouching` and `pitch`. Body yaw is 0. With `leans: false` the third-person handlers
 * receive the same pose with `crouching: false`; nothing else differs.
 */
function play(player, weapon, ticks, { leans = true } = {}) {
  const { actor, rig, camera } = player, rows = [], owner = owner3p(weapon);
  // The game mounts its one third-person weapon group on the right hand of its one player
  // (attachWeapons3pToHand of weaponFBX.js, mocked above with its FBX loader).
  guns.attachWeapon3pToHand(bone(actor.mesh, 'hand_r'), WEAPON3P_ROT, WEAPON3P_GRIP);
  for (const tick of ticks) {
    const eyeHeight = tick.crouching ? PLAYER_H_CROUCH : PLAYER_H; // eyeH of src/loop.js
    player.time += tick.dt;
    guns.restorePlayerWeaponHandling();
    camera.position.set(player.x, ROOT.y + eyeHeight, player.z);
    camera.quaternion.setFromEuler(new THREE.Euler(tick.pitch ?? 0, 0, 0, 'YXZ'));
    camera.updateMatrixWorld(true);
    actor.mesh.position.set(camera.position.x, camera.position.y - eyeHeight, camera.position.z);
    actor.mesh.rotation.y = Math.PI;
    driver.tickPresentation(actor, { identity: 'local', generation: 0,
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      sampleTimeSeconds: player.time, bodyYaw: 0, aimYaw: 0, pitch: tick.pitch ?? 0,
      crouching: tick.crouching === true, onGround: true, sprinting: false,
      weapon, alive: true, aiming: false, action: { kind: 'ready' } }, tick.dt, false);
    driver.finishPresentation(actor, tick.dt);
    guns.updatePlayerWeaponHandling(leans ? actor.presentation : { ...actor.presentation, crouching: false }, actor.mesh);
    const lean = posture(actor.mesh), plain = undone(actor.mesh, owner, () => posture(actor.mesh));
    const row = { state: tick.state, gait: actor.presentation.gait.map(entry => entry.key).join('+'),
      upper: actor.presentation.upper, applied: applied(actor.mesh, owner), amount: owner.crouchLean,
      leaners: [...guns.playerWeaponHandling.values()].filter(each => each.corrections.has(bone(actor.mesh, 'spine_01'))).length,
      lean, plain, handTurn: lean.hand.angleTo(plain.hand) * DEG, left: owner.contacts?.leftError };
    view.updateFirstPersonRig(rig, { pose: actor.presentation, camera, weapon: guns.wpn, dt: tick.dt,
      active: true, thirdPerson: false,
      spineQuaternion: actor._presentationCorrection?.get(bone(actor.mesh, 'spine_03')),
      rawCorrections: owner.corrections, eyeHeight: PLAYER_H });
    const contacts = [...rig.handlers].find(each => each.weapon === weapon).contacts;
    row.viewLeft = contacts?.leftError; row.viewRight = contacts?.rightError;
    row.arms = rig.armPairs.flatMap(([, node]) => node.quaternion.toArray());
    rows.push(row);
  }
  return rows;
}
/** One more update of the real handlers on the pose the mixer left, in the order of the loop. */
function again(player, pose) {
  guns.restorePlayerWeaponHandling();
  guns.updatePlayerWeaponHandling(pose, player.actor.mesh);
  return applied(player.actor.mesh, owner3p(pose.weapon));
}
const repeat = (state, count, tick) => Array.from({ length: count }, () => ({ state, ...tick }));
const DT = 1 / 60;
/** Standing, a crouch pressed from standing and held for 200 ticks, then released. */
const crouchPress = dt => [...repeat('standing', 60, { dt }),
  ...repeat('first crouch tick', 1, { dt, crouching: true }),
  ...repeat('crouch ticks 2 to 199', 198, { dt, crouching: true }),
  ...repeat('settled crouch after 200 ticks', 1, { dt, crouching: true }),
  ...repeat('released', 60, { dt })];
const of = (rows, state) => rows.filter(row => row.state === state);
const finite = quaternion => quaternion.toArray().every(Number.isFinite);

// ── Tracer: an M4 crouch, end to end ──────────────────────────────────────
describe('the amount', () => {
  it('is one exported number of whole degrees on one line of the handler', () => {
    expect(constant()).toBeTypeOf('number');
    const lines = readFileSync(SOURCE, 'utf8').split(/\r?\n/).filter(line => line.includes('CROUCH_TORSO_LEAN_RAD ='));
    expect(lines).toHaveLength(1);
    const written = /^export const CROUCH_TORSO_LEAN_RAD = (\d+) \* Math\.PI \/ 180;$/.exec(lines[0]);
    expect(written, lines[0]).not.toBeNull();
    expect(Number(written[1]) * Math.PI / 180).toBe(constant());
    expect(Number(written[1])).toBeGreaterThanOrEqual(LIMIT.degreesFrom);
    expect(Number(written[1])).toBeLessThanOrEqual(LIMIT.degreesTo);
  });
});

describe('an M4 crouch driven as the loop drives it', () => {
  let leaned, plain;
  beforeAll(() => {
    leaned = play(livePlayer(), 'm4', crouchPress(DT));
    plain = play(livePlayer(), 'm4', crouchPress(DT), { leans: false });
    const settled = of(leaned, 'settled crouch after 200 ticks')[0], standing = of(leaned, 'standing').at(-1);
    const show = row => ({ chestPitch: row.lean.chestPitch, chestPitchUndone: row.plain.chestPitch,
      torsoLine: row.lean.torsoLine, torsoLineUndone: row.plain.torsoLine, chest: row.lean.chest, head: row.lean.head,
      chestUndone: row.plain.chest, headUndone: row.plain.head, pelvis: row.lean.pelvis,
      weaponYaw: row.lean.weaponYaw, weaponPitch: row.lean.weaponPitch,
      weaponYawUndone: row.plain.weaponYaw, weaponPitchUndone: row.plain.weaponPitch,
      handTurn: row.handTurn, applied: row.applied * DEG, left: row.left, viewLeft: row.viewLeft, viewRight: row.viewRight });
    figures.m4 = { constantDegrees: constant() * DEG, standing: show(standing), settledCrouch: show(settled),
      handTurnLargest: Math.max(...leaned.map(row => row.handTurn)),
      leftLargest: Math.max(...leaned.map(row => row.left)), leftLargestWithoutLean: Math.max(...plain.map(row => row.left)),
      leftOverLargest: Math.max(...leaned.map((row, tick) => row.left - plain[tick].left)),
      viewArmLargest: Math.max(...leaned.map((row, tick) => Math.max(...row.arms.map((value, i) => Math.abs(value - plain[tick].arms[i]))))) };
  }, 4 * SLOW);

  it('runs the states it names, and both players were given the same run', () => {
    expect(leaned).toHaveLength(320);
    expect(plain).toHaveLength(320);
    leaned.forEach((row, tick) => expect([plain[tick].state, plain[tick].gait, plain[tick].upper], `tick ${tick}`)
      .toEqual([row.state, row.gait, row.upper]));
    expect(of(leaned, 'standing').at(-1).gait).toBe('m4_ready');
    expect(of(leaned, 'settled crouch after 200 ticks')[0].gait).toBe('crouch_idle');
    expect(of(leaned, 'released').at(-1).gait).toBe('m4_ready');
    // The player whose handler is told `crouching: false` never leans: it is the reference without the lean.
    for (const row of plain) expect(row.applied).toBe(0);
  });

  it('leans the settled chest forward by the constant', () => {
    const row = of(leaned, 'settled crouch after 200 ticks')[0], degrees = constant() * DEG;
    expect(row.applied * DEG, 'radians the handler turned spine_01').toBeCloseTo(degrees, 6);
    expect(Math.abs(row.lean.chestPitch - row.plain.chestPitch - degrees), 'chest pitch over the lean undone')
      .toBeLessThanOrEqual(LIMIT.leanBand);
    expect(Math.abs(row.lean.torsoLine - planned(PLANNED_TORSO_LINE, degrees)), 'torso line')
      .toBeLessThanOrEqual(LIMIT.leanBand);
    // Forward, not back: the chest is ahead of where it is with the lean undone.
    expect(row.lean.chest[2]).toBeGreaterThan(row.plain.chest[2]);
  });

  it('does not lean a standing actor', () => {
    const rows = of(leaned, 'standing').slice(30);
    expect(rows).toHaveLength(30);
    for (const row of rows) {
      expect(row.applied).toBe(0);
      expect(Math.abs(row.lean.chestPitch - row.plain.chestPitch)).toBeLessThanOrEqual(LIMIT.standing);
      expect(Math.abs(row.lean.torsoLine - row.plain.torsoLine)).toBeLessThanOrEqual(LIMIT.standing);
    }
  });

  it('keeps the weapon pointing where it pointed, and the support hand on it', () => {
    leaned.forEach((row, tick) => {
      expect(row.handTurn, `${row.state}, tick ${tick}: hand_r against the lean undone`).toBeLessThanOrEqual(LIMIT.weapon);
      expect(Number.isFinite(row.left) && Number.isFinite(plain[tick].left), `tick ${tick}: a measured error`).toBe(true);
      expect(row.left, `${row.state}, tick ${tick}: third-person support hand`).toBeLessThanOrEqual(plain[tick].left + LIMIT.contact);
    });
    // The crouch ticks did lean, so the comparison above is not one pose against itself.
    expect(of(leaned, 'settled crouch after 200 ticks')[0].applied).toBeGreaterThan(0.5 * constant());
  });

  it('leaves every bone of the view arms where the player without the lean has it', () => {
    expect(leaned[0].arms.length).toBeGreaterThan(4 * 40);
    leaned.forEach((row, tick) => {
      const difference = Math.max(...row.arms.map((value, i) => Math.abs(value - plain[tick].arms[i])));
      expect(difference, `${row.state}, tick ${tick}: a view arm bone`).toBeLessThanOrEqual(LIMIT.viewArm);
      expect(Math.abs(row.viewLeft - plain[tick].viewLeft), `tick ${tick}: view support hand`).toBeLessThanOrEqual(LIMIT.viewArm);
      expect(Math.abs(row.viewRight - plain[tick].viewRight), `tick ${tick}: view trigger hand`).toBeLessThanOrEqual(LIMIT.viewArm);
    });
  });

  it('eases the lean in and out', () => {
    const share = row => row.applied / constant();
    const crouch = leaned.filter(row => row.state !== 'standing' && row.state !== 'released'), released = of(leaned, 'released');
    figures.easing.local = { secondsPerTick: DT, firstTick: share(crouch[0]), after30Ticks: share(crouch[29]),
      released1Tick: share(released[0]), released30Ticks: share(released[29]),
      ticksTo95Percent: crouch.findIndex(row => share(row) > LIMIT.eased) + 1 };
    expect(share(crouch[0]), 'one tick of 1/60 s after the press').toBeLessThan(LIMIT.firstTick);
    expect(share(crouch[0]), 'one tick of 1/60 s after the press').toBeGreaterThan(0);
    expect(share(crouch[29]), '0.5 s after the press').toBeGreaterThan(LIMIT.eased);
    expect(share(released[29]), '0.5 s after the release').toBeLessThan(LIMIT.released);
    // Monotonic both ways: no step back while it rises, none forward while it falls.
    crouch.forEach((row, i) => { if (i) expect(row.applied, `crouch tick ${i}`).toBeGreaterThanOrEqual(crouch[i - 1].applied - LIMIT.same); });
    released.forEach((row, i) => { if (i) expect(row.applied, `released tick ${i}`).toBeLessThanOrEqual(released[i - 1].applied + LIMIT.same); });
    for (const row of leaned) expect(Number.isFinite(row.amount), 'the stored amount').toBe(true);
  });

  it('leans once: only the handler of the weapon in hand turns the torso', () => {
    const row = of(leaned, 'settled crouch after 200 ticks')[0];
    expect(row.leaners).toBe(1);
    expect(row.applied * DEG).toBeCloseTo(constant() * DEG, 6);
    for (const each of leaned) expect(each.leaners).toBeLessThanOrEqual(1);
  });
});

// ── Easing, one rule for every caller ─────────────────────────────────────
describe('the easing rule on the real handler', () => {
  /** A standing M4 player, settled, and the pose its handler was last given. */
  function settledPlayer() {
    const player = livePlayer();
    play(player, 'm4', repeat('standing', 60, { dt: DT }));
    return { player, pose: player.actor.presentation, mesh: player.actor.mesh };
  }
  const share = radians => radians / constant();
  const allFinite = owner => [...owner.corrections].every(([node, saved]) => finite(node.quaternion) && finite(saved));

  it('takes the target at once on a reset pose', () => {
    const { player, pose } = settledPlayer(), time = pose.sampleTimeSeconds;
    expect(again(player, { ...pose, sampleTimeSeconds: time + DT })).toBe(0);
    expect(share(again(player, { ...pose, crouching: true, reset: true, sampleTimeSeconds: time + 2 * DT }))).toBeCloseTo(1, 9);
    // And the first tick of a player that starts crouched: its presentation is a reset.
    const fresh = livePlayer(), rows = play(fresh, 'm4', repeat('crouched from the first tick', 3, { dt: DT, crouching: true }));
    expect(fresh.actor.presentation.crouching).toBe(true);
    expect(share(rows[0].applied)).toBeCloseTo(1, 9);
  }, SLOW);

  it('stays finite and snaps on poses without a sample time', () => {
    const { player, pose, mesh } = settledPlayer(), owner = owner3p('m4');
    // The pose of the paused loop (src/loop.js): no crouching state and no time.
    expect(again(player, { weapon: 'm4', alive: true, upper: 'ready' })).toBe(0);
    expect(owner.crouchLean).toBe(0);
    expect(allFinite(owner)).toBe(true);
    // A crouched presentation pose after it: nothing to measure a step from, so the target at once.
    expect(share(again(player, { ...pose, crouching: true, sampleTimeSeconds: pose.sampleTimeSeconds + DT }))).toBeCloseTo(1, 9);
    expect(owner.crouchLean).toBe(1);
    expect(allFinite(owner)).toBe(true);
    for (const name of LEAN_BONES) expect(finite(bone(mesh, name).quaternion), name).toBe(true);
    // The paused pose while crouched stands the torso upright at once; so does a dead pose without a time.
    expect(again(player, { weapon: 'm4', alive: true, upper: 'ready' })).toBe(0);
    expect(share(again(player, { ...pose, crouching: true, sampleTimeSeconds: pose.sampleTimeSeconds + 2 * DT }))).toBeCloseTo(1, 9);
    expect(again(player, { weapon: 'm4', alive: false })).toBe(0);
    expect(owner.crouchLean).toBe(0);
    expect(allFinite(owner)).toBe(true);
    // A time that is not a number is a missing time.
    expect(share(again(player, { ...pose, crouching: true, sampleTimeSeconds: NaN }))).toBeCloseTo(1, 9);
    expect(Number.isFinite(owner.crouchLean)).toBe(true);
  }, SLOW);

  it('holds on a repeated sample time and rises smoothly at the cadence of a remote actor', () => {
    const { player, pose } = settledPlayer(), start = pose.sampleTimeSeconds, shares = [];
    // Snapshots 1/30 s apart, each presented on two updates (src/network/remoteActors.js).
    for (let update = 0; update < 40; update++)
      shares.push(share(again(player, { ...pose, crouching: true, sampleTimeSeconds: start + Math.ceil((update + 1) / 2) / 30 })));
    figures.cadence.remote = { firstUpdate: shares[0], secondUpdate: shares[1], after15Snapshots: shares[29],
      largestStep: Math.max(...shares.map((value, i) => value - (shares[i - 1] ?? 0))) };
    expect(shares[0], 'first update after the press').toBeGreaterThan(0);
    expect(shares[0], 'first update after the press').toBeLessThan(0.5);
    shares.forEach((value, update) => {
      const previous = shares[update - 1] ?? 0;
      if (update % 2) expect(Math.abs(value - previous), `update ${update}: a repeated sample time`).toBeLessThanOrEqual(1e-6);
      else expect(value - previous, `update ${update}: a new sample time`).toBeGreaterThan(0);
      expect(value - previous, `update ${update}: one step`).toBeLessThan(0.5);
      expect(value, `update ${update}`).toBeLessThanOrEqual(1 + 1e-9);
    });
    expect(shares[29], '0.5 s after the press').toBeGreaterThan(LIMIT.eased);
  }, SLOW);

  it('is at the target from the first update of a handler that was not the active one', () => {
    const { player, pose } = settledPlayer(), time = pose.sampleTimeSeconds + 5;
    // The review panel paused on its crouch entry, or a weapon switch while crouched: the handler of
    // the pistol becomes the active one, and every update carries the same sample time.
    const shares = Array.from({ length: 5 }, () => share(again(player, { ...pose, weapon: 'pistol', crouching: true, sampleTimeSeconds: time })));
    figures.cadence.panel = { shares };
    for (const value of shares) expect(value).toBeCloseTo(1, 9);
    expect(owner3p('m4').corrections.size, 'the handler of the weapon that was put away').toBe(0);
  }, SLOW);

  it('takes the target at once on a backward step and on a step above 0.1 s', () => {
    const { player, pose } = settledPlayer(), time = pose.sampleTimeSeconds;
    expect(share(again(player, { ...pose, crouching: true, sampleTimeSeconds: time - 0.5 }))).toBeCloseTo(1, 9);
    expect(again(player, { ...pose, sampleTimeSeconds: time - 0.3 })).toBe(0);
    // A step of 0.09 s still eases; one of 0 holds, whatever the target is.
    const eased = share(again(player, { ...pose, crouching: true, sampleTimeSeconds: time - 0.21 }));
    figures.easing.stepOf90Milliseconds = eased;
    expect(eased).toBeGreaterThan(0.5);
    expect(eased).toBeLessThan(0.75);
    expect(share(again(player, { ...pose, crouching: false, sampleTimeSeconds: time - 0.21 }))).toBeCloseTo(eased, 6);
  }, SLOW);
});

describe('figures for the summary', () => {
  it('prints what the M4 crouch measured', () => {
    const { standing, settledCrouch } = figures.m4, fixed = (value, digits = 3) => value.toFixed(digits);
    const line = (label, row) => `${label}: chest pitch ${fixed(row.chestPitch, 1)} (lean undone ${fixed(row.chestPitchUndone, 1)}), ` +
      `torso line ${fixed(row.torsoLine, 1)} (${fixed(row.torsoLineUndone, 1)}), chest ${fixed(row.chest[2])} ahead ${fixed(row.chest[1])} high, ` +
      `head ${fixed(row.head[2])} ahead ${fixed(row.head[1])} high, weapon yaw ${fixed(row.weaponYaw, 2)} pitch ${fixed(row.weaponPitch, 2)} ` +
      `(${fixed(row.weaponYawUndone, 2)}, ${fixed(row.weaponPitchUndone, 2)})`;
    console.info(`[crouch lean] constant ${fixed(figures.m4.constantDegrees, 1)} degrees; ${line('standing', standing)}; ${line('settled crouch', settledCrouch)}; ` +
      `largest hand_r turn ${figures.m4.handTurnLargest.toExponential(1)} degrees; third-person support hand ${figures.m4.leftLargest.toExponential(1)} m ` +
      `(without the lean ${figures.m4.leftLargestWithoutLean.toExponential(1)}); view arm bone difference ${figures.m4.viewArmLargest.toExponential(1)}`);
    expect(Number.isFinite(settledCrouch.chestPitch)).toBe(true);
  });
});

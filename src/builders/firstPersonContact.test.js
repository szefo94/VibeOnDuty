import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import manifest from '../../tools/art/motion-manifest.json';
import { MOVE_SPEED, PLAYER_H, PLAYER_H_CROUCH, SPRINT_MULT, WEAPONS } from '../config.js';

vi.mock('../scene.js', () => ({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(75, 4 / 3, 0.05, 100) }));
vi.mock('../materials.js', () => ({ mm: (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness }) }));
vi.mock('./enemyWeapon.js', () => ({ attachEnemyWeapon: vi.fn() }));
vi.mock('./weaponFBX.js', () => ({ attachWeapons3pToHand: vi.fn() }));
import * as glb from './enemyGLTF.js';
import * as driver from './enemyAnimations.js';
import * as view from './firstPersonRig.js';
import * as guns from './weapon.js';
import { WEAPON3P_GRIP, WEAPON3P_ROT } from './weapon3pTransform.js';
import { consolidateCharacterSkeletons } from './characterResources.js';

// Guard for the first-person contact regression of plan 07-27, found in a browser by plan 07-29
// (.planning/debug/phase7-repair-browser-failures.md) and closed by plan 07-34: the composed crouch
// carried the inherited pelvis 0.23 m behind the root, the view arms copy the shoulders that ride on
// it, and the support hand ended 0.14 m short of the weapon.
// One actor object drives the live player the way src/loop.js runs a frame, tick after tick; no second
// driver object ever touches its mixer. The view weapon is the real one of src/builders/weapon.js.
// An error is the distance in metres between a view hand and its contact target on the view weapon,
// as updateWeaponHandling reports it (contacts.leftError: support hand, contacts.rightError: trigger
// hand). The limits were fixed in the plan before this file existed and are never loosened here.
const LIMIT = Object.freeze({
  contact: 0.005, // largest error of either view hand, M4 and pistol
  overAuthored: 0.005, // every weapon: an error may exceed the authored-clip player's by at most this
  control: 0.10, // the control must report a support hand error above this
  same: 1e-9, // numeric tolerance of an equality between two players built the same way
});
const RATES = [['1/60 s', 1 / 60], ['0.05 s', 0.05]]; // seconds per tick: the display rate and the loop's cap
const ROOT = new THREE.Vector3(3.25, 0.5, -7.75); // away from the origin, so no check passes by a zero
const BREATH_START = 0.875; // seconds into the breathing layer; the builder starts it at a random time
const SLOW = 30000; // milliseconds allowed to a case that builds players and runs hundreds of frames
const LEGACY_KEYS = ['idle', 'walk', 'run', 'attack', 'shoot', 'crouch', 'crouch_walk', 'death', 'hit', 'roll',
  'jump_start', 'jump_loop', 'jump_land', 'reload', 'run_back', 'walk_back', 'strafe_l', 'strafe_r', 'nade',
  'dance', 'punch_cross', 'punch_jab'];
const KEYS = [...new Set([...LEGACY_KEYS, ...manifest.actions.map(action => action.id)])];

let gltf, prepared, live, log;
const figures = { limits: LIMIT, tracer: {}, control: {}, weapons: {}, controlEveryState: {}, lookDown: {} };
const named = name => prepared.animations.find(clip => clip.name === name);

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
  // The same preparation again, for players whose action map is made by a resolver of this file.
  prepared = glb.prepareEnemyClips(gltf);
  live = glb.buildLiveClips(prepared.scene, prepared.animations);
});
afterAll(() => {
  log.mockRestore();
  // Optional: the measured figures as a file, for the plan summary. Nothing reads it back.
  if (env.CONTACT_FIGURES) writeFileSync(env.CONTACT_FIGURES, JSON.stringify(figures, null, 2));
});

// ── Players ───────────────────────────────────────────────────────────────
const eyeCamera = () => new THREE.PerspectiveCamera(75, 4 / 3, 0.05, 100);
/** The player actor and the first-person rig that live play builds; one at a time, as in the game. */
function livePlayer() {
  expect(glb.buildPlayerMesh()).toBe(true);
  const actor = { mesh: glb.playerMesh, mixer: glb.playerMixer, actions: glb.playerActions };
  actor.actions._breathing.time = BREATH_START;
  return { actor, rig: glb.playerFirstPersonRig, camera: eyeCamera() };
}
/**
 * A separately built player with its own first-person rig: the same skeleton clone, mixer, breathing
 * layer and rig factory as buildPlayerMesh, with an action map made by `resolve`. It shares no object
 * with the live player; the one module state both use, the handlers of weapon.js, is used one frame
 * at a time exactly as the loop uses it.
 */
function playerFrom(resolve) {
  const mesh = skeletonClone(gltf.scene);
  consolidateCharacterSkeletons(mesh);
  const mixer = new THREE.AnimationMixer(mesh), actions = {};
  for (const key of KEYS) { const clip = resolve(key); if (clip) actions[key] = mixer.clipAction(clip); }
  const breathing = mixer.clipAction(driver.buildGLTFBreathingClip());
  breathing.blendMode = THREE.AdditiveAnimationBlendMode;
  breathing.time = BREATH_START; breathing.setEffectiveWeight(0.75); breathing.play();
  actions._breathing = breathing;
  return { actor: { mesh, mixer, actions }, rig: view.createFirstPersonRig({ source: mesh }), camera: eyeCamera() };
}
const liveClip = key => glb.findLiveClip(prepared.animations, key);

// The composed clips plan 07-34 changed, and the inherited source of each.
const INHERITED = { crouch_idle: 'rifle_Crouch_Idle_Loop', crouch_forward: 'rifle_Crouch_Fwd_Loop',
  crouch_back: 'rifle_Crouch_Fwd_Loop', crouch_left: 'rifle_Crouch_Fwd_Loop', crouch_right: 'rifle_Crouch_Fwd_Loop',
  jump_start: 'rifle_Jump_Start', jump_loop: 'rifle_Jump_Loop', jump_land: 'rifle_Jump_Land' };
/**
 * The composition of plan 07-27 for a control, built here: a composed crouch or jump clip with the
 * pelvis position its inherited source has on all three axes (in the rifle crouch 0.23 m behind the
 * root). Only the position track is replaced. The leg rotations stay those of the built clip: the view
 * arms copy the upper body only, so the legs do not reach the measured error.
 */
function inheritedPelvis(id) {
  const clip = live.get(id).clone(), source = named(INHERITED[id]);
  const position = clip.tracks.find(track => track.name === 'pelvis.position');
  const inherited = source.tracks.find(track => track.name === 'pelvis.position').createInterpolant();
  position.times.forEach((time, key) =>
    position.values.set(inherited.evaluate(time * source.duration / clip.duration), key * 3));
  clip.name = `control_inherited_pelvis_${id}`;
  return clip;
}

// ── One frame, as src/loop.js runs it ─────────────────────────────────────
/**
 * Ticks are plain data, so two players can be given identical input. Per tick: `dt`, and optionally
 * `crouching`, `pitch`, `velocity` [x, z] in m/s, `onGround`, `sprinting`, `aiming`, `action`.
 * Body yaw is 0: forward is -Z of the simulated position and right is +X.
 */
function play(player, weapon, ticks) {
  const { actor, rig, camera } = player, rows = [];
  let time = 0, x = ROOT.x, z = ROOT.z;
  // The game mounts its one third-person weapon group on the right hand of its one player
  // (attachWeapons3pToHand of weaponFBX.js, mocked above with its FBX loader). The player that is
  // driven now gets it the same way, so the third-person handling of the loop runs on a mounted gun.
  guns.attachWeapon3pToHand(actor.mesh.getObjectByName('hand_r'), WEAPON3P_ROT, WEAPON3P_GRIP);
  for (const tick of ticks) {
    const eyeHeight = tick.crouching ? PLAYER_H_CROUCH : PLAYER_H; // eyeH of src/loop.js
    time += tick.dt; x += (tick.velocity?.[0] ?? 0) * tick.dt; z += (tick.velocity?.[1] ?? 0) * tick.dt;
    guns.restorePlayerWeaponHandling();
    camera.position.set(x, ROOT.y + eyeHeight, z);
    camera.quaternion.setFromEuler(new THREE.Euler(tick.pitch ?? 0, 0, 0, 'YXZ'));
    camera.updateMatrixWorld(true);
    actor.mesh.position.set(camera.position.x, camera.position.y - eyeHeight, camera.position.z);
    actor.mesh.rotation.y = Math.PI;
    driver.tickPresentation(actor, { identity: 'local', generation: 0,
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      sampleTimeSeconds: time, bodyYaw: 0, aimYaw: 0, pitch: tick.pitch ?? 0,
      crouching: tick.crouching === true, onGround: tick.onGround !== false, sprinting: tick.sprinting === true,
      weapon, alive: true, aiming: tick.aiming === true, action: tick.action ?? { kind: 'ready' } }, tick.dt, false);
    driver.finishPresentation(actor, tick.dt);
    guns.updatePlayerWeaponHandling(actor.presentation, actor.mesh);
    view.updateFirstPersonRig(rig, { pose: actor.presentation, camera, weapon: guns.wpn, dt: tick.dt,
      active: true, thirdPerson: false,
      spineQuaternion: actor._presentationCorrection?.get(actor.mesh.getObjectByName('spine_03')),
      rawCorrections: guns.playerWeaponHandling.get(`3p:${weapon}`)?.corrections, eyeHeight: PLAYER_H });
    const pose = actor.presentation, contacts = [...rig.handlers].find(owner => owner.weapon === weapon).contacts;
    // The view shoulders: the midpoint of the two upper arm bones of the arms view, in camera space.
    const shoulder = rig.armBones.get('upperarm_l').getWorldPosition(new THREE.Vector3())
      .add(rig.armBones.get('upperarm_r').getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5)
      .sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
    // A jump tick is named after the phase the driver itself is in: start, loop or land.
    const state = tick.state.includes(JUMP) ? tick.state.replace(JUMP, pose.jump ? `jump ${pose.jump}` : 'standing') : tick.state;
    rows.push({ state, left: contacts?.leftError, right: contacts?.rightError,
      phase: pose.jump ? pose.jumpPhase : pose.upper === 'reload' ? pose.action.phase : pose.phase,
      gait: pose.gait.map(entry => entry.key).join('+'), upper: pose.upper, jump: pose.jump,
      shoulder: shoulder.toArray(), pelvis: actor.mesh.getObjectByName('pelvis').position.toArray() });
    // Where four leg bones of the body view fall on the screen (-1 to 1 on both axes is inside).
    if (tick.screen) rows.at(-1).screen = Object.fromEntries(['calf_l', 'calf_r', 'foot_l', 'foot_r'].map(name =>
      [name, rig.body.getObjectByName(name).getWorldPosition(new THREE.Vector3()).project(camera).toArray().slice(0, 2)]));
  }
  return rows;
}
const JUMP = '<jump>';
const repeat = (state, count, tick) => Array.from({ length: count }, () => ({ state, ...tick }));
/** Standing, then a crouch pressed from standing and held for 200 ticks. */
const crouchPress = dt => [...repeat('standing', 30, { dt }),
  ...repeat('first crouch tick', 1, { dt, crouching: true }),
  ...repeat('next 30 crouch ticks', 30, { dt, crouching: true }),
  ...repeat('crouch ticks 32 to 199', 168, { dt, crouching: true }),
  ...repeat('crouch after 200 ticks', 1, { dt, crouching: true })];
const span = values => [Math.min(...values), Math.max(...values)];
/** Per state: smallest and largest error of each hand, and where the view shoulders and the pelvis were. */
function summary(rows) {
  const out = {};
  for (const state of new Set(rows.map(row => row.state))) {
    const of = rows.filter(row => row.state === state);
    out[state] = { ticks: of.length, left: span(of.map(row => row.left)), right: span(of.map(row => row.right)),
      shoulderForward: span(of.map(row => -row.shoulder[2])), gait: [...new Set(of.map(row => row.gait))],
      pelvis: of.at(-1).pelvis };
  }
  return out;
}

// ── Tracer: an M4 crouch, end to end ──────────────────────────────────────
describe('an M4 crouch driven as the loop drives it', () => {
  it.each(RATES)('at %s per tick both view hands stay on the weapon from the first crouch tick to the 200th', (label, dt) => {
    const rows = play(livePlayer(), 'm4', crouchPress(dt));
    figures.tracer[label] = summary(rows);
    expect(rows).toHaveLength(230);
    expect(rows.at(-1).gait).toBe('crouch_idle');
    expect(rows.at(-1).upper).toBe('ready');
    rows.forEach((row, tick) => {
      expect(row.left, `${row.state}, tick ${tick}: support hand`).toBeLessThanOrEqual(LIMIT.contact);
      expect(row.right, `${row.state}, tick ${tick}: trigger hand`).toBeLessThanOrEqual(LIMIT.contact);
    });
  }, SLOW);

  it.each(RATES)('control at %s per tick: a crouch that carries the inherited pelvis position leaves the support hand short', (label, dt) => {
    const withdrawn = inheritedPelvis('crouch_idle');
    const rows = play(playerFrom(key => (key === 'crouch' || key === 'crouch_idle' ? withdrawn : liveClip(key))),
      'm4', crouchPress(dt));
    figures.control[label] = summary(rows);
    expect(rows.at(-1).gait).toBe('crouch_idle');
    // The control clip is what was selected, and it holds the pelvis behind the root (local y is fore and aft).
    expect(rows.at(-1).pelvis[1], 'pelvis fore and aft, bone local').toBeGreaterThan(0.25);
    for (const row of rows.filter(entry => entry.state === 'standing'))
      expect(row.left, 'standing: support hand').toBeLessThanOrEqual(LIMIT.contact);
    rows.forEach((row, tick) => {
      if (row.state !== 'standing')
        expect(row.left, `${row.state}, tick ${tick}: support hand`).toBeGreaterThan(LIMIT.control);
    });
  }, SLOW);

  it.each(RATES)('at %s per tick a player built here from the live clips is the live player', (label, dt) => {
    // The control and every reference player of this file come from playerFrom. Given the clips live
    // play selects, it must measure what the real builder's player measures.
    const built = play(livePlayer(), 'm4', crouchPress(dt)), mine = play(playerFrom(liveClip), 'm4', crouchPress(dt));
    built.forEach((row, tick) => {
      expect(Math.abs(row.left - mine[tick].left), `tick ${tick}: support hand`).toBeLessThanOrEqual(LIMIT.same);
      expect(Math.abs(row.right - mine[tick].right), `tick ${tick}: trigger hand`).toBeLessThanOrEqual(LIMIT.same);
      row.shoulder.forEach((value, axis) =>
        expect(Math.abs(value - mine[tick].shoulder[axis]), `tick ${tick}: shoulder axis ${axis}`).toBeLessThanOrEqual(LIMIT.same));
    });
  }, SLOW);
});

// ── Every weapon and state ────────────────────────────────────────────────
// One continuous run per weapon and tick rate, state after state, as one life of play. Every tick is
// measured, also the ticks in which the driver blends from one state into the next. The same ticks
// are given to a second, separately built player whose action map is resolved with findMotionClip:
// the authored clips, which is what live play showed before plan 07-27.
const WEAPON_KEYS = ['m4', 'pistol', 'awp', 'p90'];
const ABSOLUTE = ['m4', 'pistol']; // the weapons the plan also limits absolutely
const PHASES = 12;
const PITCH_LIMIT = 1.38; // player.pitch is clamped to this (src/main.js, src/loop.js)
const PITCHES = [-PITCH_LIMIT, -0.9, 0, PITCH_LIMIT]; // the four of tests/first-person-rig.spec.js
const DIRECTIONS = [['forward', [0, -1]], ['back', [0, 1]], ['left', [-1, 0]], ['right', [1, 0]]];
// Speeds in m/s: the game's walk, sprint and crouch walk (src/entities/player.js). The driver shows
// the run family above 6.5 m/s; without the sprint key the run speed of the route guard is used.
const WALK = MOVE_SPEED, SPRINT = MOVE_SPEED * SPRINT_MULT, CROUCH = MOVE_SPEED * 0.72;
const RUN = 2.4 * manifest.actions.find(action => action.id === 'run_forward').cycleDisplacement;
const JUMP_START = 0.32, JUMP_LAND = 0.38; // seconds, as src/builders/animationPresentation.js times them
const STATES = ['standing', 'first crouch tick', 'crouch idle', 'settled crouch after 200 ticks', 'crouched ADS',
  'crouched reload', 'crouch walk', ...DIRECTIONS.map(([name]) => `walk ${name}`),
  ...DIRECTIONS.map(([name]) => `run ${name}`), 'sprint', 'jump start', 'jump loop', 'jump land',
  'jump start, 12 phases', 'jump loop, 12 phases', 'jump land, 12 phases'];

function everyState(dt, weapon) {
  const seconds = duration => Math.ceil(duration / dt - 1e-9);
  const moving = (direction, speed) => direction.map(axis => axis * speed);
  const crouching = true, reload = WEAPONS[weapon].reload / 1000, loop = live.get('jump_loop').duration;
  const still = (duration, more = {}) =>
    repeat(more.crouching ? 'crouch idle' : 'standing', seconds(duration), { dt, ...more });
  return [
    ...repeat('standing', 30, { dt }),
    ...PITCHES.map(pitch => ({ state: 'standing', dt, pitch })),
    // A crouch pressed from standing: its first tick, 198 more, and the 200th.
    ...repeat('first crouch tick', 1, { dt, crouching }),
    ...repeat('crouch idle', 198, { dt, crouching }),
    ...repeat('settled crouch after 200 ticks', 1, { dt, crouching }),
    ...PITCHES.map(pitch => ({ state: 'crouch idle', dt, crouching, pitch, screen: pitch === -PITCH_LIMIT })),
    ...repeat('crouched ADS', seconds(1), { dt, crouching, aiming: true }),
    ...still(0.5, { crouching }),
    ...Array.from({ length: PHASES }, (_, i) => ({ state: 'crouched reload', dt, crouching,
      action: { kind: 'reload', total: reload, elapsed: reload * i / PHASES } })),
    ...still(0.5, { crouching }),
    ...repeat('crouch walk', seconds(1.5), { dt, crouching, velocity: moving(DIRECTIONS[0][1], CROUCH) }),
    ...still(0.5, { crouching }),
    ...still(1),
    ...DIRECTIONS.flatMap(([name, direction]) =>
      [...repeat(`walk ${name}`, seconds(1.5), { dt, velocity: moving(direction, WALK) }), ...still(0.6)]),
    ...DIRECTIONS.flatMap(([name, direction]) =>
      [...repeat(`run ${name}`, seconds(1.2), { dt, velocity: moving(direction, RUN) }), ...still(0.6)]),
    ...repeat('sprint', seconds(1.2), { dt, sprinting: true, velocity: moving(DIRECTIONS[0][1], SPRINT) }),
    ...still(0.6),
    // A jump at the tick rate: take-off, airborne, landing, standing again.
    ...repeat(JUMP, seconds(JUMP_START + 0.6), { dt, onGround: false }),
    ...repeat(JUMP, seconds(JUMP_LAND + 0.6), { dt }),
    // The same chain at 12 even phases of each of its three clips.
    ...repeat(`${JUMP}, 12 phases`, PHASES, { dt: JUMP_START / PHASES, onGround: false }),
    ...repeat(JUMP, 8, { dt: loop / PHASES, onGround: false }),
    ...repeat(`${JUMP}, 12 phases`, PHASES, { dt: loop / PHASES, onGround: false }),
    ...repeat(`${JUMP}, 12 phases`, PHASES, { dt: JUMP_LAND / PHASES }),
    ...still(0.6),
  ];
}
const authoredPlayer = () => playerFrom(key => glb.findMotionClip(prepared.animations, key));
const worst = (rows, state, hand) => Math.max(...rows.filter(row => row.state === state).map(row => row[hand]));
const least = (rows, state, hand) => Math.min(...rows.filter(row => row.state === state).map(row => row[hand]));
/** Per state: the errors of the composed player beside those of the authored-clip player, tick for tick. */
function table(composed, authored) {
  const out = {};
  composed.forEach((row, tick) => {
    const entry = out[row.state] ??= { ticks: 0, left: 0, right: 0, authoredLeft: 0, authoredRight: 0,
      overLeft: -Infinity, overRight: -Infinity, shoulderForward: [], authoredShoulderForward: [] };
    const reference = authored[tick];
    entry.ticks++;
    entry.left = Math.max(entry.left, row.left); entry.right = Math.max(entry.right, row.right);
    entry.authoredLeft = Math.max(entry.authoredLeft, reference.left);
    entry.authoredRight = Math.max(entry.authoredRight, reference.right);
    entry.overLeft = Math.max(entry.overLeft, row.left - reference.left);
    entry.overRight = Math.max(entry.overRight, row.right - reference.right);
    entry.shoulderForward.push(-row.shoulder[2]); entry.authoredShoulderForward.push(-reference.shoulder[2]);
  });
  for (const entry of Object.values(out)) {
    entry.shoulderForward = span(entry.shoulderForward);
    entry.authoredShoulderForward = span(entry.authoredShoulderForward);
  }
  return out;
}
/** A tick outside a limit, with what a report of it needs. */
const miss = (row, reference, tick) => ({ state: row.state, tick, phase: row.phase, gait: row.gait, upper: row.upper,
  left: row.left, right: row.right, authoredLeft: reference.left, authoredRight: reference.right,
  shoulder: row.shoulder, authoredShoulder: reference.shoulder });

describe.each(WEAPON_KEYS)('%s through every state, one driver as the loop', weapon => {
  const runs = {};
  beforeAll(() => {
    for (const [label, dt] of RATES) {
      const ticks = everyState(dt, weapon);
      runs[label] = { ticks, composed: play(livePlayer(), weapon, ticks), authored: play(authoredPlayer(), weapon, ticks) };
      (figures.weapons[weapon] ??= {})[label] = table(runs[label].composed, runs[label].authored);
    }
  }, 4 * SLOW);

  it.each(RATES)('at %s per tick the run is every listed state, and both players were given the same one', label => {
    const { ticks, composed, authored } = runs[label];
    expect(composed).toHaveLength(ticks.length);
    expect(authored).toHaveLength(ticks.length);
    expect([...new Set(composed.map(row => row.state))].sort()).toEqual([...STATES].sort());
    composed.forEach((row, tick) => {
      const reference = authored[tick];
      expect([reference.state, reference.gait, reference.upper, reference.jump, reference.phase], `tick ${tick}`)
        .toEqual([row.state, row.gait, row.upper, row.jump, row.phase]);
      for (const value of [row.left, row.right, reference.left, reference.right])
        expect(Number.isFinite(value), `tick ${tick}, ${row.state}: a measured error`).toBe(true);
    });
    const last = state => composed.findLast(row => row.state === state);
    expect([last('standing').gait, last('standing').upper]).toEqual([`${weapon}_ready`, 'ready']);
    expect([last('settled crouch after 200 ticks').gait, last('settled crouch after 200 ticks').upper]).toEqual(['crouch_idle', 'ready']);
    expect([last('crouched ADS').gait, last('crouched ADS').upper]).toEqual(['crouch_idle', 'ads']);
    expect([last('crouch walk').gait, last('crouch walk').upper]).toEqual(['crouch_forward', 'ready']);
    for (const [name] of DIRECTIONS) {
      expect([last(`walk ${name}`).gait, last(`walk ${name}`).upper]).toEqual([`walk_${name}`, 'ready']);
      expect([last(`run ${name}`).gait, last(`run ${name}`).upper]).toEqual([`run_${name}`, 'ready']);
    }
    expect([last('sprint').gait, last('sprint').upper]).toEqual(['run_forward', 'sprint']);
    // Twelve phases each: the reload by its observed phase, the jump clips by the driver's own clock.
    const evenly = Array.from({ length: PHASES }, (_, i) => expect.closeTo(i / PHASES, 9));
    const reload = composed.filter(row => row.state === 'crouched reload');
    expect(reload.map(row => row.upper)).toEqual(Array(PHASES).fill('reload'));
    expect(reload.map(row => row.phase)).toEqual(evenly);
    for (const jump of ['start', 'loop', 'land']) {
      const rows = composed.filter(row => row.state === `jump ${jump}, 12 phases`);
      expect(rows.map(row => row.jump), `jump ${jump}`).toEqual(Array(PHASES).fill(jump));
      if (jump !== 'loop') expect(rows.map(row => row.phase), `jump ${jump}`).toEqual(evenly);
      expect(composed.some(row => row.state === `jump ${jump}`), `jump ${jump} at the tick rate`).toBe(true);
    }
  });

  it.each(RATES)('at %s per tick no view hand is further from its contact than with the authored clips, plus 0.005 m', label => {
    const { composed, authored } = runs[label];
    const misses = composed.flatMap((row, tick) => (row.left <= authored[tick].left + LIMIT.overAuthored &&
      row.right <= authored[tick].right + LIMIT.overAuthored ? [] : [miss(row, authored[tick], tick)]));
    expect(misses, `${weapon}: ticks over the authored-clip error plus ${LIMIT.overAuthored} m`).toEqual([]);
  });

  if (ABSOLUTE.includes(weapon))
    it.each(RATES)('at %s per tick both view hands are within 0.005 m of their contacts in every state', label => {
      const { composed, authored } = runs[label];
      const misses = composed.flatMap((row, tick) => (row.left <= LIMIT.contact && row.right <= LIMIT.contact
        ? [] : [miss(row, authored[tick], tick)]));
      expect(misses, `${weapon}: ticks over ${LIMIT.contact} m`).toEqual([]);
    });

  it('prints the largest authored-clip error, for the summary', () => {
    const largest = hand => RATES.flatMap(([label]) => Object.entries(figures.weapons[weapon][label])
      .map(([state, entry]) => ({ metres: entry[hand], state, rate: label }))).sort((a, b) => b.metres - a.metres)[0];
    const report = { authoredLeft: largest('authoredLeft'), authoredRight: largest('authoredRight'),
      left: largest('left'), right: largest('right'), overLeft: largest('overLeft'), overRight: largest('overRight') };
    figures.weapons[weapon].largest = report;
    const metres = value => (Math.abs(value) < 1e-4 ? value.toExponential(1) : value.toFixed(4));
    const show = entry => `${metres(entry.metres)} m (${entry.state}, ${entry.rate} per tick)`;
    console.info(`[first-person contact] ${weapon}: largest authored-clip error, support hand ${show(report.authoredLeft)}, ` +
      `trigger hand ${show(report.authoredRight)}; composed, support hand ${show(report.left)}, trigger hand ${show(report.right)}; ` +
      `largest composed minus authored on one tick, support hand ${show(report.overLeft)}, trigger hand ${show(report.overRight)}`);
    for (const entry of Object.values(report)) expect(Number.isFinite(entry.metres)).toBe(true);
  });

  if (weapon === 'm4')
    it('records where the legs of the body view fall on the screen in the settled crouch at the lowest pitch, and asserts nothing about them', () => {
      for (const [label] of RATES) {
        const row = runs[label].composed.find(entry => entry.screen);
        expect(row.state).toBe('crouch idle');
        figures.lookDown[label] = row.screen;
      }
      expect(Object.keys(figures.lookDown)).toHaveLength(RATES.length);
    });
});

describe('control: the composition of plan 07-27 through every state', () => {
  it.each(RATES)('at %s per tick the inherited pelvis position breaks the M4 limit in every crouch state and around a jump', (label, dt) => {
    const withdrawn = new Map(Object.keys(INHERITED).map(id => [id, inheritedPelvis(id)]));
    const rows = play(playerFrom(key => withdrawn.get(glb.getMotionDefinition(key)?.id) ?? liveClip(key)), 'm4', everyState(dt, 'm4'));
    figures.controlEveryState[label] = Object.fromEntries([...new Set(rows.map(row => row.state))].map(state =>
      [state, { left: [least(rows, state, 'left'), worst(rows, state, 'left')], right: [least(rows, state, 'right'), worst(rows, state, 'right')] }]));
    for (const state of ['first crouch tick', 'settled crouch after 200 ticks', 'crouched ADS', 'crouch walk'])
      expect(least(rows, state, 'left'), `${state}: support hand on every tick`).toBeGreaterThan(LIMIT.control);
    expect(worst(rows, 'crouch idle', 'left'), 'crouch idle: support hand').toBeGreaterThan(LIMIT.control);
    for (const state of ['jump start', 'jump land'])
      expect(worst(rows, state, 'left'), `${state}: support hand`).toBeGreaterThan(LIMIT.contact);
    // What plan 07-34 did not touch stays inside the limit under the same control.
    for (const state of [...DIRECTIONS.flatMap(([name]) => [`walk ${name}`, `run ${name}`]), 'sprint'])
      expect(worst(rows, state, 'left'), `${state}: support hand`).toBeLessThanOrEqual(LIMIT.contact);
  }, SLOW);
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import manifest from '../../tools/art/motion-manifest.json';
import { PLAYER_H, PLAYER_H_CROUCH } from '../config.js';

vi.mock('../scene.js', () => ({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(75, 4 / 3, 0.05, 100) }));
vi.mock('../materials.js', () => ({ mm: (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness }) }));
vi.mock('./enemyWeapon.js', () => ({ attachEnemyWeapon: vi.fn() }));
vi.mock('./weaponFBX.js', () => ({ attachWeapons3pToHand: vi.fn() }));
import * as glb from './enemyGLTF.js';
import * as driver from './enemyAnimations.js';
import * as view from './firstPersonRig.js';
import * as guns from './weapon.js';
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
  contact: 0.005, // largest error of either view hand
  control: 0.10, // the control must report a support hand error above this
  same: 1e-9, // numeric tolerance of an equality between two players built the same way
});
const RATES = [['1/60 s', 1 / 60], ['0.05 s', 0.05]]; // seconds per tick: the display rate and the loop's cap
const ROOT = new THREE.Vector3(3.25, 0.5, -7.75); // away from the origin, so no check passes by a zero
const BREATH_START = 0.875; // seconds into the breathing layer; the builder starts it at a random time
const LEGACY_KEYS = ['idle', 'walk', 'run', 'attack', 'shoot', 'crouch', 'crouch_walk', 'death', 'hit', 'roll',
  'jump_start', 'jump_loop', 'jump_land', 'reload', 'run_back', 'walk_back', 'strafe_l', 'strafe_r', 'nade',
  'dance', 'punch_cross', 'punch_jab'];
const KEYS = [...new Set([...LEGACY_KEYS, ...manifest.actions.map(action => action.id)])];

let gltf, prepared, live, log;
const figures = { limits: LIMIT, tracer: {}, control: {} };
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

/**
 * Today's composition for the control, built here: the composed crouch with the pelvis position the
 * inherited rifle crouch has on all three axes, 0.23 m behind the root, which is what plan 07-27
 * composed. Only the position track is replaced. The leg rotations stay those of the built clip:
 * the view arms copy the upper body only, so the legs do not reach the measured error.
 */
function inheritedPelvisCrouch() {
  const clip = live.get('crouch_idle').clone(), source = named('rifle_Crouch_Idle_Loop');
  const position = clip.tracks.find(track => track.name === 'pelvis.position');
  const inherited = source.tracks.find(track => track.name === 'pelvis.position').createInterpolant();
  position.times.forEach((time, key) =>
    position.values.set(inherited.evaluate(time * source.duration / clip.duration), key * 3));
  clip.name = 'control_inherited_pelvis_crouch';
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
    rows.push({ state: tick.state, left: contacts?.leftError, right: contacts?.rightError,
      phase: pose.jump ? pose.jumpPhase : pose.upper === 'reload' ? pose.action.phase : pose.phase,
      gait: pose.gait.map(entry => entry.key).join('+'), upper: pose.upper, jump: pose.jump,
      shoulder: shoulder.toArray(), pelvis: actor.mesh.getObjectByName('pelvis').position.toArray() });
  }
  return rows;
}
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
  });

  it.each(RATES)('control at %s per tick: a crouch that carries the inherited pelvis position leaves the support hand short', (label, dt) => {
    const today = inheritedPelvisCrouch();
    const rows = play(playerFrom(key => (key === 'crouch' || key === 'crouch_idle' ? today : liveClip(key))),
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
  });

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
  });
});

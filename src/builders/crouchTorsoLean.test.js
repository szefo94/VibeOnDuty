import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import manifest from '../../tools/art/motion-manifest.json';
import { HEAD_BOB_PITCH, MOVE_SPEED, PLAYER_H, PLAYER_H_CROUCH, SPRINT_MULT, WEAPONS } from '../config.js';

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
// corrections map before it turned them. "The player without the lean" is a second player given the
// same ticks whose handler receives the same pose with `crouching: false`.
// Every limit below was fixed in the plan before this file existed and is never loosened here. One
// guard was reworded after a failing run, by Amendment 1 of the plan (orchestrator's decision): the
// first-person body view. It first read "no torso vertex nearer than 0.30 m", which fails with no lean
// at all (standing and looking down; crouch-walking and looking straight up). It now compares both of
// its halves with the same sample with the lean undone. The distances themselves did not change.
const LIMIT = Object.freeze({
  leanBand: 1.5, // degrees: the settled chest lean against the constant, the torso line against planning
  standing: 0.05, // degrees: chest pitch and torso line of a standing actor against the lean undone
  weapon: 0.2, // degrees: hand_r orientation, weapon yaw and pitch, spine_03 yaw against the lean undone
  contact: 0.005, // metres: a contact error over the value without the lean
  viewArm: 1e-6, // a view arm bone quaternion component against the player without the lean
  firstTick: 0.25, eased: 0.95, released: 0.05, // shares of the constant: one tick of 1/60 s, 0.5 s, 0.5 s
  degreesFrom: 6, degreesTo: 13, // whole degrees the constant may take (the body-view guard below)
  fadeStart: 0.3, fadeEnd: 0.8, // radians of upward aim: the lean is whole up to the first, gone from the second
  fadedOut: 0.2, // degrees of chest lean left from the fade end upward
  // The first-person body view (Amendment 1): no more torso vertices inside the frustum between the
  // near plane and `far` than with the lean undone, and no more of them nearer than `close`.
  near: 0.05, close: 0.30, far: 0.6, // metres along the view axis; `near` is the near plane of src/scene.js
  sweepStep: 0.05, // radians between neighbouring pitches of a sweep, at most
  nearestChest: 0.10, farthestChest: 0.60, // metres: the eye in front of spine_03 of the body view
  // The settled crouch at the default of 12 degrees: spine_03 and the head bone ahead of the root, head height.
  chestAhead: [0.03, 0.07], headAhead: [0.07, 0.12], headHigh: [1.09, 1.13],
  phase: 1e-6, // a sample taken at a key is within this of the key, as a share of the clip
  same: 1e-9, // numeric tolerance of an equality
});
// Planning figures of plan 07-35 ("Design, decided from measurement") for the composed crouch, by
// degrees of lean: torso line (degrees), spine_03 ahead of the root, head ahead, head height (metres).
// At the default of 12 degrees these are the 14.4 and the three bands the plan asserts; for another
// value the constant may take, a band moves by the difference of its planning figure to the row of
// 12, interpolated between rows, so no number of this file changes when the one line changes.
const PLANNED = [[0, 6.5, -0.005, 0.005, 1.121], [6, 10.4, 0.023, 0.051, 1.118], [8, 11.7, 0.032, 0.066, 1.116],
  [10, 13.1, 0.041, 0.081, 1.114], [12, 14.4, 0.050, 0.096, 1.111], [15, 16.3, 0.063, 0.118, 1.105]];
const DEG = 180 / Math.PI;
const DT = 1 / 60, STEP = 0.05; // seconds per tick: the display rate, and the cap of src/loop.js
const ROOT = new THREE.Vector3(3.25, 0.5, -7.75); // away from the origin, so no check passes by a zero
const BREATH_START = 0.875; // seconds into the breathing layer; the builder starts it at a random time
const SLOW = 30000; // milliseconds allowed to a case that builds players and runs hundreds of frames
const LEAN_BONES = ['spine_01', 'clavicle_l', 'clavicle_r', 'neck_01'];
const SOURCE = 'src/builders/weaponHandling.js';
const WEAPON_KEYS = ['m4', 'pistol', 'awp', 'p90'];
const DIRECTIONS = [['forward', [0, -1]], ['back', [0, 1]], ['left', [-1, 0]], ['right', [1, 0]]];
const cycle = family => manifest.actions.find(action => action.id === `${family}_forward`).cycleDisplacement;
// Speeds in m/s: the game's walk, sprint and crouch walk (src/entities/player.js). The driver shows
// the run family above 6.5 m/s; without the sprint key the run speed of the route guard is used.
const SPEED = { walk: MOVE_SPEED, run: 2.4 * cycle('run'), sprint: MOVE_SPEED * SPRINT_MULT, crouch: MOVE_SPEED * 0.72 };
const JUMP_SECONDS = { start: 0.32, land: 0.38 }; // as src/builders/animationPresentation.js times them
const LAST = 1 - 1e-6; // a looping layer wraps at its last key, so that key is sampled this far before it
// player.pitch is clamped to this (src/main.js, src/loop.js); offline the camera adds the head bob.
const PITCH_LIMIT = 1.38;
const LOWEST_CAMERA_PITCH = -(PITCH_LIMIT + HEAD_BOB_PITCH * 1.4);
const SWEEP = [...Array.from({ length: Math.ceil(2 * PITCH_LIMIT / LIMIT.sweepStep) }, (_, i) => PITCH_LIMIT - i * LIMIT.sweepStep), -PITCH_LIMIT];
const PLANNING_PITCHES = [1.38, 1.1, 0.9]; // upward pitches of the plan's table without a fade
const AIM_PITCHES = [0.3, 0.4, 0.6, 0.8]; // upward aim at which the summary states the third-person lean
const LOOK_DOWN = [0, -0.4, -0.8, -1.1, -1.3, -PITCH_LIMIT, LOWEST_CAMERA_PITCH];
// The real camera of src/scene.js: 75 degrees of vertical field of view, near plane 0.05 m.
const FOV_TAN = Math.tan(75 / 2 / DEG);
const ASPECTS = [['4:3', 4 / 3], ['16:9', 16 / 9], ['21:9', 21 / 9]];
const TORSO = /^(spine|clavicle|pelvis)/; // a vertex counts when its heaviest bone is one of these
const VARIANT_DEGREES = [6, 8, 10, 12, 13, 14]; // leans this file applies itself on the body view

let gltf, log;
const figures = { limits: LIMIT, weapons: {}, easing: {}, cadence: {}, crouchWalk: {}, actions: {}, absent: {},
  bodyView: {}, aim: {}, lookDown: {}, enemies: {} };
const constant = () => handling.CROUCH_TORSO_LEAN_RAD;
const planned = (degrees, column) => {
  const upper = PLANNED.findIndex(([at]) => at >= degrees);
  if (upper <= 0) return PLANNED[Math.max(0, upper)][column];
  const low = PLANNED[upper - 1], high = PLANNED[upper];
  return low[column] + (high[column] - low[column]) * (degrees - low[0]) / (high[0] - low[0]);
};
/** A band the plan states for 12 degrees, moved to where planning puts it for the constant. */
const band = ([from, to], column) => {
  const moved = planned(constant() * DEG, column) - planned(12, column);
  return [from + moved, to + moved];
};
/** The share of the lean the plan leaves at a pose pitch: whole to the fade start, none from its end, a smoothstep between. */
const fadeOf = pitch => {
  const t = Math.max(0, Math.min(1, ((Number.isFinite(pitch) ? pitch : 0) - LIMIT.fadeStart) / (LIMIT.fadeEnd - LIMIT.fadeStart)));
  return 1 - t * t * (3 - 2 * t);
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

// ── Measurement ───────────────────────────────────────────────────────────
const bone = (mesh, name) => mesh.getObjectByName(name);
const owner3p = weapon => guns.playerWeaponHandling.get(`3p:${weapon}`);
const span = values => [Math.min(...values), Math.max(...values)];
const finite = quaternion => quaternion.toArray().every(Number.isFinite);
const largest = (values, others) => values.reduce((most, value, i) => Math.max(most, Math.abs(value - others[i])), 0);
/** Radians between two rotations. Mixer output is not exactly unit length, so this does not assume it. */
function turn(from, to) {
  const d = from.clone().conjugate().multiply(to);
  return 2 * Math.atan2(Math.hypot(d.x, d.y, d.z), Math.abs(d.w));
}
/** Radians the handler turned spine_01 on its last update: the bone against the value it saved. */
function applied(mesh, owner) {
  const spine = bone(mesh, 'spine_01'), saved = owner.corrections.get(spine);
  return saved ? turn(saved, spine.quaternion) : 0;
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
/** A measured pose beside the same pose with the lean undone, with the differences the limits name. */
function leanOf(mesh, owner) {
  const lean = posture(mesh), plain = undone(mesh, owner, () => posture(mesh));
  const degrees = a => Math.abs(Math.atan2(Math.sin(a / DEG), Math.cos(a / DEG)) * DEG);
  return { lean, plain, applied: applied(mesh, owner), chestLean: lean.chestPitch - plain.chestPitch,
    handTurn: turn(plain.hand, lean.hand) * DEG, weaponYawTurn: degrees(lean.weaponYaw - plain.weaponYaw),
    weaponPitchTurn: Math.abs(lean.weaponPitch - plain.weaponPitch), spineYawTurn: degrees(lean.spineYaw - plain.spineYaw) };
}

// ── The first-person body view ────────────────────────────────────────────
const torsoOf = new WeakMap(), viewBones = new WeakMap();
const viewBone = (rig, name) => {
  if (!viewBones.has(rig)) viewBones.set(rig, new Map(rig.bodyPairs.map(([, node]) => [node.name, node])));
  return viewBones.get(rig).get(name);
};
/** The drawn vertices of the body view whose heaviest bone is a spine, clavicle or pelvis bone. */
function torsoVertices(rig) {
  if (torsoOf.has(rig)) return torsoOf.get(rig);
  const meshes = [];
  rig.body.traverse(mesh => {
    if (!mesh.isSkinnedMesh || !mesh.geometry.index) return;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes, vertices = [], used = new Set();
    for (const vertex of new Set(mesh.geometry.index.array)) {
      let best = -1, name = '';
      for (let j = 0; j < 4; j++) {
        const weight = skinWeight.getComponent(vertex, j);
        if (weight > best) { best = weight; name = mesh.skeleton.bones[skinIndex.getComponent(vertex, j)]?.name ?? ''; }
      }
      if (!TORSO.test(name)) continue;
      const bones = [], weights = [];
      for (let j = 0; j < 4; j++) {
        const weight = skinWeight.getComponent(vertex, j);
        if (weight !== 0) { bones.push(skinIndex.getComponent(vertex, j)); weights.push(weight); used.add(bones.at(-1)); }
      }
      vertices.push({ vertex, at: [position.getX(vertex), position.getY(vertex), position.getZ(vertex)], bones, weights });
    }
    if (vertices.length) meshes.push({ mesh, vertices, used: [...used] });
  });
  torsoOf.set(rig, meshes);
  return meshes;
}
/** Torso vertices in view space (camera at the origin looking along -Z), as the skinning shader places them. */
function torsoInViewSpace(rig, camera) {
  rig.body.updateMatrixWorld(true);
  const out = [], matrix = new THREE.Matrix4(), matrices = new Map();
  for (const { mesh, vertices, used } of torsoVertices(rig)) {
    const toView = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
    matrices.clear();
    for (const index of used) matrices.set(index, matrix.clone().multiplyMatrices(toView, mesh.skeleton.bones[index].matrixWorld)
      .multiply(mesh.skeleton.boneInverses[index]).multiply(mesh.bindMatrix).elements);
    for (const { at: [x, y, z], bones, weights } of vertices) {
      let vx = 0, vy = 0, vz = 0;
      for (let j = 0; j < bones.length; j++) {
        const e = matrices.get(bones[j]), weight = weights[j];
        vx += weight * (e[0] * x + e[4] * y + e[8] * z + e[12]);
        vy += weight * (e[1] * x + e[5] * y + e[9] * z + e[13]);
        vz += weight * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      }
      out.push(vx, vy, vz);
    }
  }
  return out;
}
/** Per aspect ratio: torso vertices inside the frustum between the near plane and `far`, and those nearer than `close`. */
function torsoInView(rig, camera) {
  const points = torsoInViewSpace(rig, camera), count = ASPECTS.map(() => 0), close = ASPECTS.map(() => 0);
  let nearest = Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const depth = -points[i + 2];
    if (depth < LIMIT.near || depth > LIMIT.far || Math.abs(points[i + 1]) >= depth * FOV_TAN) continue;
    ASPECTS.forEach(([, aspect], a) => {
      if (Math.abs(points[i]) >= depth * FOV_TAN * aspect) return;
      count[a]++; if (depth < LIMIT.close) close[a]++;
      nearest = Math.min(nearest, depth);
    });
  }
  return { count, close, nearest: Number.isFinite(nearest) ? nearest : null };
}
/** The eye in front of spine_03 of the body view, along the body's forward axis, in metres. */
function chestAhead(rig, camera) {
  rig.body.updateMatrixWorld(true);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.body.getWorldQuaternion(new THREE.Quaternion()));
  return camera.position.clone().sub(viewBone(rig, 'spine_03').getWorldPosition(new THREE.Vector3())).dot(forward);
}
/** This file's own rotation of a body-view bone about a world axis; the handler's code is not used. */
function worldTurn(node, axis, radians) {
  const parent = node.parent.getWorldQuaternion(new THREE.Quaternion());
  node.quaternion.premultiply(parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, radians)).multiply(parent));
  node.updateWorldMatrix(false, true);
}
/**
 * What the body view shows on this update, measured several ways. `handler`: as updateFirstPersonRig
 * left it. `undone`: the four lean bones as the handler found them, the reference of the guard.
 * `restored`: every correction of the handler put back, the arm solves included; recorded, asserted
 * against nothing. `variants[d]`: the lean undone, then the four rotations applied here at d degrees
 * times the eased amount and the fade. `full`: the same at the constant without the fade, and
 * `control` at the 12 degrees of the plan's control without the fade. `own`: the largest difference
 * between the handler's four bones and this file's rotations at the constant with the fade, which
 * shows the two are one rule.
 */
function bodyViews(rig, camera, owner, pitch, aim) {
  const kept = rig.bodyPairs.map(([, node]) => [node, node.quaternion.clone()]);
  const reset = () => { for (const [node, quaternion] of kept) node.quaternion.copy(quaternion); };
  const corrected = names => {
    reset();
    for (const [source, saved] of owner.corrections) if (!names || names.includes(source.name)) viewBone(rig, source.name)?.quaternion.copy(saved);
    rig.body.updateMatrixWorld(true);
  };
  const leaned = radians => {
    corrected(LEAN_BONES);
    if (radians > 0.0005) { // the handler turns no bone below this
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.body.getWorldQuaternion(new THREE.Quaternion()));
      worldTurn(viewBone(rig, 'spine_01'), axis, radians);
      for (const name of LEAN_BONES.slice(1)) worldTurn(viewBone(rig, name), axis, -radians);
    }
    rig.body.updateMatrixWorld(true);
  };
  const out = { pitch, aim, handler: torsoInView(rig, camera), ahead: chestAhead(rig, camera), variants: {} };
  const amount = owner.crouchLean ?? 0, fade = fadeOf(pitch), theirs = LEAN_BONES.map(name => viewBone(rig, name).quaternion.clone());
  corrected(LEAN_BONES); out.undone = torsoInView(rig, camera);
  corrected(null); out.restored = torsoInView(rig, camera);
  leaned(amount * constant() * fade);
  out.own = Math.max(...LEAN_BONES.map((name, i) => largest(viewBone(rig, name).quaternion.toArray(), theirs[i].toArray())));
  for (const degrees of VARIANT_DEGREES) { leaned(amount * degrees / DEG * fade); out.variants[degrees] = torsoInView(rig, camera); }
  leaned(amount * constant()); out.full = torsoInView(rig, camera);
  leaned(amount * 12 / DEG); out.control = torsoInView(rig, camera);
  reset(); rig.body.updateMatrixWorld(true);
  return out;
}
/** A sample breaks the body-view guard when more torso vertices are in view, or more are nearer than `close`, than with the lean undone. */
const breaksView = (counts, reference) => counts.close.some((n, a) => n > reference.close[a]) || counts.count.some((n, a) => n > reference.count[a]);
/** The guard as the plan first worded it: any torso vertex nearer than `close`. Recorded for the summary, asserted against nothing. */
const breaksFirstWording = (counts, reference) => counts.close.some(n => n > 0) || counts.count.some((n, a) => n > reference.count[a]);

// ── The live player and one frame, as src/loop.js runs it ─────────────────
const eyeCamera = () => new THREE.PerspectiveCamera(75, 4 / 3, LIMIT.near, 100);
/** The player actor and the first-person rig that live play builds; one at a time, as in the game. */
function livePlayer() {
  expect(glb.buildPlayerMesh()).toBe(true);
  const actor = { mesh: glb.playerMesh, mixer: glb.playerMixer, actions: glb.playerActions }, bones = [];
  actor.actions._breathing.time = BREATH_START;
  actor.mesh.traverse(node => { if (node.isBone) bones.push(node); });
  return { actor, rig: glb.playerFirstPersonRig, camera: eyeCamera(), bones, time: 0, x: ROOT.x, z: ROOT.z };
}
const layerAction = (actor, upper) => [...actor._presentationActive.keys()]
  .find(action => action.getClip().name.endsWith(upper ? '_upper' : '_lower'));
/** What a keyed tick steps, read back from the driver after the tick; a share of a clip or cycle. */
const READ = {
  gait: actor => actor.presentation.phase,
  jump: actor => actor.presentation.jumpPhase,
  action: actor => actor.presentation.action.phase,
  upper: actor => layerAction(actor, true).time / layerAction(actor, true).getClip().duration,
  lower: actor => layerAction(actor, false).time / layerAction(actor, false).getClip().duration,
};
/** Every key time of the layer the driver plays, as shares of its clip, in order. */
function phasesOf(actor, upper) {
  const clip = layerAction(actor, upper).getClip(), times = new Set();
  for (const track of clip.tracks) for (const time of track.times) times.add(time);
  return [...new Set([...times].sort((a, b) => a - b).map(time => Math.min(time / clip.duration, LAST)))];
}
const circular = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
/**
 * Ticks are plain data, so a second player can be given the ticks of the first. Per tick: `dt`,
 * `state`, and optionally `crouching`, `pitch`, `cameraPitch`, `velocity` [x, z] in m/s, `onGround`,
 * `sprinting`, `aiming`, `action`, `view` (measure the body view), `reads` and `phase` (the tick was
 * timed to land on a key). Body yaw is 0: forward is -Z of the simulated position and right is +X.
 * `script` is a list of ticks or a generator that reads the player between ticks. With
 * `leans: false` the third-person handlers receive the same pose with `crouching: false`.
 */
function play(player, weapon, script, { leans = true } = {}) {
  const { actor, rig, camera, bones } = player, rows = [], owner = owner3p(weapon);
  const source = typeof script === 'function' ? script(player) : script[Symbol.iterator]();
  rows.ticks = [];
  // The game mounts its one third-person weapon group on the right hand of its one player
  // (attachWeapons3pToHand of weaponFBX.js, mocked above with its FBX loader).
  guns.attachWeapon3pToHand(bone(actor.mesh, 'hand_r'), WEAPON3P_ROT, WEAPON3P_GRIP);
  for (let next = source.next(); !next.done; next = source.next()) {
    const tick = next.value, eyeHeight = tick.crouching ? PLAYER_H_CROUCH : PLAYER_H; // eyeH of src/loop.js
    rows.ticks.push(tick);
    player.time += tick.dt; player.x += (tick.velocity?.[0] ?? 0) * tick.dt; player.z += (tick.velocity?.[1] ?? 0) * tick.dt;
    guns.restorePlayerWeaponHandling();
    camera.position.set(player.x, ROOT.y + eyeHeight, player.z);
    camera.quaternion.setFromEuler(new THREE.Euler(tick.cameraPitch ?? tick.pitch ?? 0, 0, 0, 'YXZ'));
    camera.updateMatrixWorld(true);
    actor.mesh.position.set(camera.position.x, camera.position.y - eyeHeight, camera.position.z);
    actor.mesh.rotation.y = Math.PI;
    driver.tickPresentation(actor, { identity: 'local', generation: 0,
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      sampleTimeSeconds: player.time, bodyYaw: 0, aimYaw: 0, pitch: tick.pitch ?? 0,
      crouching: tick.crouching === true, onGround: tick.onGround !== false, sprinting: tick.sprinting === true,
      weapon, alive: true, aiming: tick.aiming === true, action: tick.action ?? { kind: 'ready' } }, tick.dt, false);
    driver.finishPresentation(actor, tick.dt);
    const pose = actor.presentation;
    guns.updatePlayerWeaponHandling(leans ? pose : { ...pose, crouching: false }, actor.mesh);
    const row = { state: tick.state, phase: tick.phase, seen: tick.reads ? READ[tick.reads](actor) : undefined,
      gait: pose.gait.map(entry => entry.key).join('+'), upper: pose.upper, jump: pose.jump, pitch: pose.pitch,
      amount: owner.crouchLean, left: owner.contacts?.leftError, ...leanOf(actor.mesh, owner),
      leaners: [...guns.playerWeaponHandling.values()].filter(each => each.corrections.has(bone(actor.mesh, 'spine_01'))).length,
      bones: bones.flatMap(node => node.quaternion.toArray()) };
    view.updateFirstPersonRig(rig, { pose, camera, weapon: guns.wpn, dt: tick.dt,
      active: true, thirdPerson: false,
      spineQuaternion: actor._presentationCorrection?.get(bone(actor.mesh, 'spine_03')),
      rawCorrections: owner.corrections, eyeHeight: PLAYER_H });
    const contacts = [...rig.handlers].find(each => each.weapon === weapon).contacts;
    row.viewLeft = contacts?.leftError; row.viewRight = contacts?.rightError;
    row.arms = rig.armPairs.flatMap(([, node]) => node.quaternion.toArray());
    if (tick.view) row.view = bodyViews(rig, camera, owner, pose.pitch, tick.cameraPitch ?? tick.pitch ?? 0);
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
const repeat = (state, count, tick) => Array.from({ length: count }, () => ({ state, dt: DT, ...tick }));
/**
 * Ticks timed so that each lands on one key of what `reads` names: `seconds` is how long one whole
 * clip or cycle takes. The order starts after the phase the player is in; a step longer than the cap
 * of the loop is split, and the ticks in between are named "between keys" and measure no view.
 */
function* keys(player, state, base, { reads, phases, seconds, wrap = true }) {
  const read = () => READ[reads](player.actor), now = read();
  const order = [...phases.filter(phase => phase > now + 1e-9), ...(wrap ? phases.filter(phase => phase <= now + 1e-9) : [])];
  for (const phase of order) {
    let left = ((((phase - read()) % 1) + 1) % 1) * seconds;
    for (; left > STEP; left -= STEP) yield { ...base, view: false, dt: STEP, state: `${state}, between keys` };
    yield { ...base, dt: left, state, reads, phase };
  }
}
const of = (rows, state) => rows.filter(row => row.state === state);
const moving = (direction, speed) => direction.map(axis => axis * speed);
/** Standing, a crouch pressed from standing and held for 200 ticks, then released. */
const crouchPress = () => [...repeat('standing', 60),
  ...repeat('first crouch tick', 1, { crouching: true }),
  ...repeat('crouch ticks 2 to 199', 198, { crouching: true }),
  ...repeat('settled crouch after 200 ticks', 1, { crouching: true }),
  ...repeat('released', 60)];
/** Every keyed row landed on its key; returns how many keys each state was sampled at. */
function expectOnKeys(rows) {
  const counts = {};
  for (const row of rows) {
    if (row.phase === undefined) continue;
    expect(circular(row.seen, row.phase), `${row.state}: sampled at ${row.seen}, key at ${row.phase}`).toBeLessThanOrEqual(LIMIT.phase);
    counts[row.state] = (counts[row.state] ?? 0) + 1;
  }
  return counts;
}

// ── The amount ────────────────────────────────────────────────────────────
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

  it('fades between two named pitches that are not part of the one-line adjustment', () => {
    expect(handling.CROUCH_LEAN_FADE_START_RAD).toBe(LIMIT.fadeStart);
    expect(handling.CROUCH_LEAN_FADE_END_RAD).toBe(LIMIT.fadeEnd);
  });
});

// ── Every weapon: a crouch pressed, held and released ─────────────────────
describe.each(WEAPON_KEYS)('a %s crouch driven as the loop drives it', weapon => {
  let leaned, plain;
  const settledRow = () => of(leaned, 'settled crouch after 200 ticks')[0];
  beforeAll(() => {
    leaned = play(livePlayer(), weapon, crouchPress());
    plain = play(livePlayer(), weapon, leaned.ticks, { leans: false });
    const settled = settledRow(), standing = of(leaned, 'standing').at(-1), reference = of(plain, 'settled crouch after 200 ticks')[0];
    const show = row => ({ chestPitch: row.lean.chestPitch, chestPitchUndone: row.plain.chestPitch,
      torsoLine: row.lean.torsoLine, torsoLineUndone: row.plain.torsoLine, chest: row.lean.chest, head: row.lean.head,
      chestUndone: row.plain.chest, headUndone: row.plain.head, pelvis: row.lean.pelvis,
      weaponYaw: row.lean.weaponYaw, weaponPitch: row.lean.weaponPitch,
      weaponYawUndone: row.plain.weaponYaw, weaponPitchUndone: row.plain.weaponPitch,
      handTurn: row.handTurn, applied: row.applied * DEG, chestLean: row.chestLean,
      left: row.left, viewLeft: row.viewLeft, viewRight: row.viewRight });
    figures.weapons[weapon] = { constantDegrees: constant() * DEG, standing: show(standing), settledCrouch: show(settled),
      settledCrouchWithoutLean: { left: reference.left, viewLeft: reference.viewLeft, viewRight: reference.viewRight },
      handTurnLargest: Math.max(...leaned.map(row => row.handTurn)),
      thirdPersonSupport: { withLean: Math.max(...leaned.map(row => row.left)), withoutLean: Math.max(...plain.map(row => row.left)),
        largestOver: Math.max(...leaned.map((row, tick) => row.left - plain[tick].left)) },
      firstPersonSupport: { withLean: Math.max(...leaned.map(row => row.viewLeft)), withoutLean: Math.max(...plain.map(row => row.viewLeft)) },
      firstPersonTrigger: { withLean: Math.max(...leaned.map(row => row.viewRight)), withoutLean: Math.max(...plain.map(row => row.viewRight)) },
      viewArmLargest: Math.max(...leaned.map((row, tick) => largest(row.arms, plain[tick].arms))) };
  }, 4 * SLOW);

  it('runs the states it names, and both players were given the same run', () => {
    expect(leaned).toHaveLength(320);
    expect(plain).toHaveLength(320);
    leaned.forEach((row, tick) => expect([plain[tick].state, plain[tick].gait, plain[tick].upper], `tick ${tick}`)
      .toEqual([row.state, row.gait, row.upper]));
    expect(of(leaned, 'standing').at(-1).gait).toBe(`${weapon}_ready`);
    expect(settledRow().gait).toBe('crouch_idle');
    expect(of(leaned, 'released').at(-1).gait).toBe(`${weapon}_ready`);
    // The player whose handler is told `crouching: false` never leans: it is the reference without the lean.
    for (const row of plain) expect(row.applied).toBe(0);
  });

  it('leans the settled chest forward by the constant', () => {
    const row = settledRow(), degrees = constant() * DEG;
    expect(row.applied * DEG, 'degrees the handler turned spine_01').toBeCloseTo(degrees, 6);
    expect(Math.abs(row.chestLean - degrees), 'chest pitch over the lean undone').toBeLessThanOrEqual(LIMIT.leanBand);
    // Forward, not back: the chest is ahead of where it is with the lean undone.
    expect(row.lean.chest[2]).toBeGreaterThan(row.plain.chest[2]);
  });

  if (weapon === 'm4')
    it('puts the torso line, the chest and the head where planning has them', () => {
      const row = settledRow(), degrees = constant() * DEG;
      expect(Math.abs(row.lean.torsoLine - planned(degrees, 1)), 'torso line').toBeLessThanOrEqual(LIMIT.leanBand);
      const within = (value, [from, to], label) => {
        expect(value, label).toBeGreaterThanOrEqual(from); expect(value, label).toBeLessThanOrEqual(to);
      };
      within(row.lean.chest[2], band(LIMIT.chestAhead, 2), 'spine_03 ahead of the root');
      within(row.lean.head[2], band(LIMIT.headAhead, 3), 'head bone ahead of the root');
      within(row.lean.head[1], band(LIMIT.headHigh, 4), 'head bone height');
    });

  it('does not lean a standing actor', () => {
    const rows = of(leaned, 'standing').slice(30);
    expect(rows).toHaveLength(30);
    for (const row of rows) {
      expect(row.applied).toBe(0);
      expect(Math.abs(row.chestLean)).toBeLessThanOrEqual(LIMIT.standing);
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
    expect(settledRow().applied).toBeGreaterThan(0.5 * constant());
  });

  it('leaves every bone of the view arms where the player without the lean has it', () => {
    expect(leaned[0].arms.length).toBeGreaterThan(4 * 40);
    leaned.forEach((row, tick) => {
      expect(largest(row.arms, plain[tick].arms), `${row.state}, tick ${tick}: a view arm bone`).toBeLessThanOrEqual(LIMIT.viewArm);
      expect(Math.abs(row.viewLeft - plain[tick].viewLeft), `tick ${tick}: view support hand`).toBeLessThanOrEqual(LIMIT.viewArm);
      expect(Math.abs(row.viewRight - plain[tick].viewRight), `tick ${tick}: view trigger hand`).toBeLessThanOrEqual(LIMIT.viewArm);
    });
  });

  it('eases the lean in and out', () => {
    const share = row => row.applied / constant();
    const crouch = leaned.filter(row => row.state !== 'standing' && row.state !== 'released'), released = of(leaned, 'released');
    if (weapon === 'm4') figures.easing.local = { secondsPerTick: DT, firstTick: share(crouch[0]), after30Ticks: share(crouch[29]),
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
    expect(settledRow().leaners).toBe(1);
    expect(settledRow().applied * DEG).toBeCloseTo(constant() * DEG, 6);
    for (const each of leaned) expect(each.leaners).toBeLessThanOrEqual(1);
  });
});

// ── Easing, one rule for every caller ─────────────────────────────────────
describe('the easing rule on the real handler', () => {
  /** A standing M4 player, settled, and the pose its handler was last given. */
  function settledPlayer() {
    const player = livePlayer();
    play(player, 'm4', repeat('standing', 60));
    return { player, pose: player.actor.presentation, mesh: player.actor.mesh };
  }
  const share = radians => radians / constant();
  const allFinite = owner => [...owner.corrections].every(([node, saved]) => finite(node.quaternion) && finite(saved));

  it('takes the target at once on a reset pose', () => {
    const { player, pose } = settledPlayer(), time = pose.sampleTimeSeconds;
    expect(again(player, { ...pose, sampleTimeSeconds: time + DT })).toBe(0);
    expect(share(again(player, { ...pose, crouching: true, reset: true, sampleTimeSeconds: time + 2 * DT }))).toBeCloseTo(1, 9);
    // And the first tick of a player that starts crouched: its presentation is a reset.
    const fresh = livePlayer(), rows = play(fresh, 'm4', repeat('crouched from the first tick', 3, { crouching: true }));
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

// ── Crouch walk at every key, four directions ─────────────────────────────
describe('an M4 crouch walk at every key of the clip the driver plays', () => {
  let rows, sampled;
  const layers = {};
  beforeAll(() => {
    rows = play(livePlayer(), 'm4', function* (player) {
      yield* repeat('standing', 30);
      for (const [name, direction] of DIRECTIONS) {
        const base = { crouching: true, velocity: moving(direction, SPEED.crouch) };
        yield* repeat(`crouch walk ${name}, settling`, 90, base);
        layers[name] = { clip: layerAction(player.actor, false).getClip().name, keys: phasesOf(player.actor, false).length };
        yield* keys(player, `crouch walk ${name}`, base,
          { reads: 'gait', phases: phasesOf(player.actor, false), seconds: cycle('crouch') / SPEED.crouch });
      }
    });
    sampled = expectOnKeys(rows);
    for (const [name] of DIRECTIONS) {
      const at = of(rows, `crouch walk ${name}`);
      figures.crouchWalk[name] = { keys: at.length, chestLean: span(at.map(row => row.chestLean)), torsoLine: span(at.map(row => row.lean.torsoLine)),
        weaponYawTurn: Math.max(...at.map(row => row.weaponYawTurn)), weaponPitchTurn: Math.max(...at.map(row => row.weaponPitchTurn)),
        spineYawTurn: Math.max(...at.map(row => row.spineYawTurn)), handTurn: Math.max(...at.map(row => row.handTurn)),
        spineYaw: span(at.map(row => row.lean.spineYaw)), chestAhead: span(at.map(row => row.lean.chest[2])),
        headAhead: span(at.map(row => row.lean.head[2])), headHigh: span(at.map(row => row.lean.head[1])) };
    }
  }, 4 * SLOW);

  it.each(DIRECTIONS)('%s: leans by the constant and leaves weapon and chest direction alone', name => {
    const at = of(rows, `crouch walk ${name}`);
    // Every key of the composed crouch walk, not 12 phases: the lower layer of live_crouch_<direction>,
    // which the four directions share key for key (39 keys in the shipped asset).
    expect(layers[name].clip).toBe(`live_crouch_${name}_lower`);
    expect(layers[name].keys).toBe(layers.forward.keys);
    expect(layers.forward.keys).toBeGreaterThanOrEqual(30);
    expect(sampled[`crouch walk ${name}`]).toBe(layers[name].keys);
    expect(at).toHaveLength(layers[name].keys);
    at.forEach((row, key) => {
      expect(row.gait, `key ${key}`).toBe(`crouch_${name}`);
      expect(Math.abs(row.chestLean - constant() * DEG), `key ${key}: chest lean`).toBeLessThanOrEqual(LIMIT.leanBand);
      expect(row.weaponYawTurn, `key ${key}: weapon yaw against the lean undone`).toBeLessThanOrEqual(LIMIT.weapon);
      expect(row.weaponPitchTurn, `key ${key}: weapon pitch against the lean undone`).toBeLessThanOrEqual(LIMIT.weapon);
      expect(row.spineYawTurn, `key ${key}: spine_03 yaw against the lean undone`).toBeLessThanOrEqual(LIMIT.weapon);
    });
  });
});

// ── Crouched ADS, fire and reload at every key of the action clip ─────────
describe('M4 crouched actions at every key of the upper clip', () => {
  const ACTIONS = ['crouched ADS', 'crouched fire', 'crouched reload'];
  let leaned, plain;
  beforeAll(() => {
    const crouching = true, reload = { kind: 'reload', total: WEAPONS.m4.reload / 1000 }, fire = { kind: 'fire', total: 0.2 };
    leaned = play(livePlayer(), 'm4', function* (player) {
      yield* repeat('standing', 30);
      yield* repeat('crouch idle', 90, { crouching });
      yield* repeat('crouched ADS, settling', 60, { crouching, aiming: true });
      const ads = layerAction(player.actor, true);
      yield* keys(player, 'crouched ADS', { crouching, aiming: true },
        { reads: 'upper', phases: phasesOf(player.actor, true), seconds: ads.getClip().duration });
      for (const [state, action] of [['crouched fire', fire], ['crouched reload', reload]]) {
        yield* repeat('crouch idle', 36, { crouching });
        // Held at its first key until the blend of the entry has expired, then one tick per key.
        yield* repeat(`${state}, settling`, 60, { crouching, action: { ...action, elapsed: 0 } });
        for (const phase of phasesOf(player.actor, true))
          yield { crouching, dt: DT, state, reads: 'action', phase, action: { ...action, elapsed: action.total * phase } };
      }
    });
    plain = play(livePlayer(), 'm4', leaned.ticks, { leans: false });
    const sampled = expectOnKeys(leaned);
    for (const state of ACTIONS) {
      const at = leaned.map((row, tick) => [row, plain[tick]]).filter(([row]) => row.state === state);
      figures.actions[state] = { keys: sampled[state], upper: [...new Set(at.map(([row]) => row.upper))],
        handTurn: Math.max(...at.map(([row]) => row.handTurn)), applied: span(at.map(([row]) => row.applied * DEG)),
        thirdPersonSupport: { withLean: Math.max(...at.map(([row]) => row.left)), withoutLean: Math.max(...at.map(([, other]) => other.left)) },
        firstPersonSupport: { withLean: Math.max(...at.map(([row]) => row.viewLeft)), withoutLean: Math.max(...at.map(([, other]) => other.viewLeft)) },
        firstPersonTrigger: { withLean: Math.max(...at.map(([row]) => row.viewRight)), withoutLean: Math.max(...at.map(([, other]) => other.viewRight)) } };
    }
  }, 4 * SLOW);

  it.each([['crouched ADS', 'ads'], ['crouched fire', 'fire'], ['crouched reload', 'reload']])('%s keeps hand_r and both views on the weapon', (state, upper) => {
    const at = of(leaned, state);
    expect(at.length).toBeGreaterThanOrEqual(2);
    leaned.forEach((row, tick) => {
      if (row.state !== state) return;
      const other = plain[tick];
      expect([row.upper, row.gait, other.upper, other.state], `tick ${tick}`).toEqual([upper, 'crouch_idle', upper, state]);
      expect(row.applied, `tick ${tick}: the lean is on`).toBeGreaterThan(0.9 * constant());
      expect(row.handTurn, `tick ${tick}: hand_r against the lean undone`).toBeLessThanOrEqual(LIMIT.weapon);
      for (const error of ['left', 'viewLeft', 'viewRight']) {
        expect(Number.isFinite(row[error]) && Number.isFinite(other[error]), `tick ${tick}: ${error}`).toBe(true);
        expect(row[error], `tick ${tick}: ${error} over the value without the lean`).toBeLessThanOrEqual(other[error] + LIMIT.contact);
      }
    });
  });
});

// ── Standing, the gaits, sprint and the jump chain: exactly no lean ───────
describe('M4 standing, gaits, sprint and jump at every key', () => {
  const GAITS = ['walk', 'run'].flatMap(family => DIRECTIONS.map(([name, direction]) => [`${family} ${name}`, family, direction]));
  const STATES = ['standing idle', ...GAITS.map(([state]) => state), 'sprint', 'jump start', 'jump loop', 'jump land'];
  let leaned, plain, sampled;
  beforeAll(() => {
    leaned = play(livePlayer(), 'm4', function* (player) {
      const { actor } = player;
      yield* repeat('standing', 30);
      // A crouch first, so the handler has leaned before; 1 s after the release nothing is left of it.
      yield* repeat('crouched before', 60, { crouching: true });
      yield* repeat('released', 60);
      yield* keys(player, 'standing idle', {}, { reads: 'upper', phases: phasesOf(actor, true), seconds: layerAction(actor, true).getClip().duration });
      for (const [state, family, direction] of GAITS) {
        const base = { velocity: moving(direction, SPEED[family]) };
        yield* repeat(`${state}, settling`, 60, base);
        yield* keys(player, state, base, { reads: 'gait', phases: phasesOf(actor, false), seconds: cycle(family) / SPEED[family] });
        yield* repeat('standing between', 36);
      }
      const sprint = { sprinting: true, velocity: moving(DIRECTIONS[0][1], SPEED.sprint) };
      yield* repeat('sprint, settling', 60, sprint);
      yield* keys(player, 'sprint', sprint, { reads: 'gait', phases: phasesOf(actor, false), seconds: cycle('run') / SPEED.sprint });
      yield* repeat('standing between', 36);
      // Take-off: the tick that leaves the ground is the first key; the chain does not wrap.
      yield { dt: DT, onGround: false, state: 'jump start', reads: 'jump', phase: 0 };
      yield* keys(player, 'jump start', { onGround: false }, { reads: 'jump', phases: phasesOf(actor, false), seconds: JUMP_SECONDS.start, wrap: false });
      yield* repeat('jump loop, settling', 36, { onGround: false });
      yield* keys(player, 'jump loop', { onGround: false }, { reads: 'lower', phases: phasesOf(actor, false), seconds: layerAction(actor, false).getClip().duration });
      yield { dt: DT, state: 'jump land', reads: 'jump', phase: 0 };
      yield* keys(player, 'jump land', {}, { reads: 'jump', phases: phasesOf(actor, false), seconds: JUMP_SECONDS.land, wrap: false });
      yield* repeat('standing after', 30);
    });
    plain = play(livePlayer(), 'm4', leaned.ticks, { leans: false });
    sampled = expectOnKeys(leaned);
    figures.absent = Object.fromEntries(STATES.map(state => [state, { keys: sampled[state],
      gait: [...new Set(of(leaned, state).map(row => row.gait))], jump: [...new Set(of(leaned, state).map(row => row.jump))],
      applied: Math.max(...of(leaned, state).map(row => row.applied)),
      boneDifference: Math.max(...leaned.map((row, tick) => (row.state === state ? largest(row.bones, plain[tick].bones) : 0))) }]));
  }, 8 * SLOW);

  it('samples each state at every key of the layer the driver plays', () => {
    expect(Object.keys(sampled).sort()).toEqual([...STATES].sort());
    for (const state of STATES) expect(sampled[state], state).toBeGreaterThanOrEqual(2);
    expect(of(leaned, 'standing idle').every(row => row.gait === 'm4_ready' && row.upper === 'ready')).toBe(true);
    for (const [state, family, , name = state.split(' ')[1]] of GAITS)
      expect(of(leaned, state).every(row => row.gait === `${family}_${name}`), state).toBe(true);
    expect(of(leaned, 'sprint').every(row => row.gait === 'run_forward' && row.upper === 'sprint')).toBe(true);
    for (const jump of ['start', 'loop', 'land'])
      expect(of(leaned, `jump ${jump}`).every(row => row.jump === jump), `jump ${jump}`).toBe(true);
    // The crouch before it did lean, so "no lean" below is not a handler that never leans.
    expect(of(leaned, 'crouched before').at(-1).applied).toBeGreaterThan(0.9 * constant());
  });

  it.each(STATES)('%s: no bone differs from the player whose handler is never told of a crouch', state => {
    leaned.forEach((row, tick) => {
      if (row.state !== state) return;
      expect(row.applied, `tick ${tick}: radians the handler turned spine_01`).toBe(0);
      expect(row.leaners, `tick ${tick}: handlers that turned the torso`).toBe(0);
      expect(largest(row.bones, plain[tick].bones), `tick ${tick}: a bone`).toBe(0);
    });
  });
});

// ── The first-person body view, upward aim and the look-down limits ───────
// Named for what it is (plan 07-38, review B-02): the two guard cases of Amendment 1 below count torso
// vertices in view, inside the frustum between the near plane and 0.6 m, and those of them nearer than
// 0.30 m. They measure neither the distance from the eye to a surface nor whether the eye is inside a
// mesh; src/builders/firstPersonBodyView.test.js measures both.
describe('the first-person body view with the lean on', () => {
  const VIEW_STATES = ['standing sweep', 'crouched sweep', 'crouched, planning pitches', 'look down', 'crouch walk sweep'];
  const MEASURES = [['handler', v => v.handler], ['lean undone', v => v.undone], ['corrections restored', v => v.restored],
    ['constant without fade', v => v.full], ['12 degrees without fade', v => v.control], ...VARIANT_DEGREES.map(degrees => [`${degrees} degrees with fade`, v => v.variants[degrees]])];
  let rows, viewed;
  const label = row => `${row.state} ${row.view.aim.toFixed(2)}`;
  /** The largest value of one measure over the samples of a state, per aspect ratio. */
  const worst = (state, pick, field = 'count') => ASPECTS.map((_, a) => Math.max(...of(rows, state).map(row => pick(row.view)[field][a])));
  /** The largest excess of one measure over the same sample with the lean undone, over the aspect ratios. */
  const over = (state, pick, field = 'count') => Math.max(...of(rows, state)
    .map(row => Math.max(...pick(row.view)[field].map((n, a) => n - row.view.undone[field][a]))));
  beforeAll(() => {
    rows = play(livePlayer(), 'm4', function* (player) {
      yield* repeat('standing', 60);
      for (const pitch of SWEEP) yield { dt: DT, pitch, state: 'standing sweep', view: true };
      yield* repeat('crouch, settling', 120, { crouching: true });
      for (const pitch of SWEEP) yield { dt: DT, pitch, crouching: true, state: 'crouched sweep', view: true };
      for (const pitch of PLANNING_PITCHES) yield { dt: DT, pitch, crouching: true, state: 'crouched, planning pitches', view: true };
      // Up and down on single updates: the fade follows the pitch at once.
      for (const pitch of [0, 1, 0, -1, 0, ...AIM_PITCHES, 0]) yield { dt: DT, pitch, crouching: true, state: 'aim steps' };
      // The camera can go below the clamped pitch by the head bob (src/entities/player.js).
      for (const pitch of LOOK_DOWN)
        yield { dt: DT, pitch: Math.max(-PITCH_LIMIT, pitch), cameraPitch: pitch, crouching: true, state: 'look down', view: true };
      const base = { crouching: true, velocity: moving(DIRECTIONS[0][1], SPEED.crouch) };
      yield* repeat('crouch walk, settling', 90, base);
      // For every pitch one whole cycle through every key of the crouch walk.
      for (const pitch of SWEEP) yield* keys(player, 'crouch walk sweep', { ...base, pitch, view: true },
        { reads: 'gait', phases: phasesOf(player.actor, false), seconds: cycle('crouch') / SPEED.crouch });
    });
    expectOnKeys(rows);
    viewed = rows.filter(row => row.view);
    const perPitch = (state, pick, field = 'count') => Object.fromEntries(of(rows, state).map(row => [row.view.aim.toFixed(2), pick(row.view)[field]]));
    const broken = breaks => Object.fromEntries(VARIANT_DEGREES.map(degrees => {
      const at = viewed.filter(row => breaks(row.view.variants[degrees], row.view.undone));
      return [`${degrees} degrees`, { samples: at.length, states: [...new Set(at.map(row => row.state))], first: at.slice(0, 6).map(row =>
        `${label(row)}: ${row.view.variants[degrees].count.join('/')} in view, ${row.view.variants[degrees].close.join('/')} nearer than ${LIMIT.close} m; ` +
        `lean undone ${row.view.undone.count.join('/')}, ${row.view.undone.close.join('/')}`) }];
    }));
    figures.bodyView = { aspects: ASPECTS.map(([name]) => name), samples: Object.fromEntries(VIEW_STATES.map(state => [state, of(rows, state).length])),
      torsoVertices: torsoVertices(glb.playerFirstPersonRig).reduce((sum, entry) => sum + entry.vertices.length, 0),
      states: Object.fromEntries(VIEW_STATES.map(state => [state, Object.fromEntries(MEASURES.map(([name, pick]) => [name, {
        inView: worst(state, pick), nearerThanClose: worst(state, pick, 'close'), inViewOverLeanUndone: over(state, pick),
        nearerOverLeanUndone: over(state, pick, 'close'), nearest: Math.min(...of(rows, state).map(row => pick(row.view).nearest ?? Infinity)) }]))])),
      crouchedSweep: Object.fromEntries(MEASURES.map(([name, pick]) => [name, perPitch('crouched sweep', pick)])),
      standingSweep: { inView: perPitch('standing sweep', v => v.handler), nearerThanClose: perPitch('standing sweep', v => v.handler, 'close'),
        inViewLeanUndone: perPitch('standing sweep', v => v.undone), inViewCorrectionsRestored: perPitch('standing sweep', v => v.restored) },
      planningPitches: Object.fromEntries(MEASURES.slice(0, 5).map(([name, pick]) => [name, perPitch('crouched, planning pitches', pick)])),
      // Per pitch, the largest figure over the keys of the crouch walk, at 4:3 / 16:9 / 21:9.
      crouchWalkSweep: Object.fromEntries(SWEEP.map(pitch => {
        const at = of(rows, 'crouch walk sweep').filter(row => row.view.aim === pitch);
        const most = (pick, field) => ASPECTS.map((_, a) => Math.max(...at.map(row => pick(row.view)[field][a])));
        return [pitch.toFixed(2), { keys: at.length, inView: most(v => v.handler, 'count'), nearerThanClose: most(v => v.handler, 'close'),
          inViewLeanUndone: most(v => v.undone, 'count'), nearerLeanUndone: most(v => v.undone, 'close'),
          appliedDegrees: span(at.map(row => row.applied * DEG)) }];
      })),
      // The guard of Amendment 1, and (asserted against nothing) the wording it replaced.
      breaksAgainstLeanUndone: broken(breaksView),
      breaksFirstWording: broken(breaksFirstWording) };
    figures.lookDown = { crouched: Object.fromEntries(of(rows, 'look down').map((row, i) => [LOOK_DOWN[i].toFixed(3), row.view.ahead])),
      crouchedSweep: span(of(rows, 'crouched sweep').map(row => row.view.ahead)), standingSweep: span(of(rows, 'standing sweep').map(row => row.view.ahead)),
      crouchWalkSweep: span(of(rows, 'crouch walk sweep').map(row => row.view.ahead)) };
    const steps = of(rows, 'aim steps');
    figures.aim = { thirdPerson: Object.fromEntries(AIM_PITCHES.map((pitch, i) => [pitch.toFixed(1),
      { appliedDegrees: steps[5 + i].applied * DEG, chestLean: steps[5 + i].chestLean, torsoLine: steps[5 + i].lean.torsoLine }])),
    sweep: Object.fromEntries(of(rows, 'crouched sweep').map(row => [row.view.aim.toFixed(2), row.applied * DEG])) };
  }, 20 * SLOW);

  it('sweeps every pitch the game allows, standing, crouched and through the crouch walk', () => {
    expect(SWEEP[0]).toBe(PITCH_LIMIT); expect(SWEEP.at(-1)).toBe(-PITCH_LIMIT);
    for (let i = 1; i < SWEEP.length; i++) expect(SWEEP[i - 1] - SWEEP[i]).toBeLessThanOrEqual(LIMIT.sweepStep + 1e-12);
    expect(of(rows, 'standing sweep')).toHaveLength(SWEEP.length);
    expect(of(rows, 'crouched sweep')).toHaveLength(SWEEP.length);
    const walk = of(rows, 'crouch walk sweep'), keysPerCycle = walk.length / SWEEP.length;
    expect(Number.isInteger(keysPerCycle) && keysPerCycle >= 30, `${walk.length} crouch walk samples`).toBe(true);
    expect(walk.every(row => row.gait === 'crouch_forward')).toBe(true);
    expect(of(rows, 'crouched sweep').every(row => row.gait === 'crouch_idle')).toBe(true);
    expect(of(rows, 'standing sweep').every(row => row.gait === 'm4_ready')).toBe(true);
    // The measurement sees the torso at all: looking straight down while standing it is in view.
    expect(figures.bodyView.torsoVertices).toBeGreaterThan(500);
    expect(Math.max(...worst('standing sweep', v => v.handler))).toBeGreaterThan(0);
  });

  it('places a vertex where the skinning of three places it', () => {
    const rig = glb.playerFirstPersonRig, camera = eyeCamera();
    camera.position.copy(ROOT).add(new THREE.Vector3(0, PLAYER_H_CROUCH, 0)); camera.updateMatrixWorld(true);
    const points = torsoInViewSpace(rig, camera), point = new THREE.Vector3();
    let index = 0, difference = 0;
    for (const { mesh, vertices } of torsoVertices(rig)) for (const { vertex } of vertices) {
      mesh.applyBoneTransform(vertex, point.fromBufferAttribute(mesh.geometry.attributes.position, vertex));
      point.applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      difference = Math.max(difference, Math.abs(point.x - points[index]), Math.abs(point.y - points[index + 1]), Math.abs(point.z - points[index + 2]));
      index += 3;
    }
    expect(index).toBe(points.length);
    expect(difference).toBeLessThanOrEqual(1e-6);
  });

  it('applies in this file the rotations the handler applies', () => {
    // The variants below are this file's own four rotations; at the constant, with the fade, they are the handler's.
    for (const row of viewed) expect(row.view.own, label(row)).toBeLessThanOrEqual(LIMIT.same);
  });

  it.each(VIEW_STATES)('%s: no more torso vertices are in view than with the lean undone', state => {
    const at = of(rows, state);
    expect(at.length).toBeGreaterThan(0);
    for (const row of at) ASPECTS.forEach(([aspect], a) =>
      expect(row.view.handler.count[a], `${label(row)}, ${aspect}: torso vertices between ${LIMIT.near} and ${LIMIT.far} m`)
        .toBeLessThanOrEqual(row.view.undone.count[a]));
  });

  it.each(VIEW_STATES)('%s: no more torso vertices are nearer than 0.30 m than with the lean undone', state => {
    for (const row of of(rows, state)) ASPECTS.forEach(([aspect], a) =>
      expect(row.view.handler.close[a], `${label(row)}, ${aspect}: torso vertices nearer than ${LIMIT.close} m`)
        .toBeLessThanOrEqual(row.view.undone.close[a]));
  });

  it('control: the four rotations at 12 degrees without a fade put the torso into the view at pitch +0.9', () => {
    // The plan's control, at the plan's 12 degrees whatever the one line holds now.
    const row = of(rows, 'crouched, planning pitches')[PLANNING_PITCHES.indexOf(0.9)];
    expect(row.view.aim).toBeCloseTo(0.9, 9);
    expect(row.amount).toBeGreaterThan(0.99);
    expect(breaksView(row.view.control, row.view.undone)).toBe(true);
    expect(row.view.control.count[0], 'torso vertices in view at 4:3 without a fade').toBeGreaterThan(row.view.undone.count[0]);
    // And the constant itself without a fade at the highest pitch.
    const highest = of(rows, 'crouched, planning pitches')[0];
    expect(highest.view.full.count[0], 'the constant without a fade at pitch +1.38').toBeGreaterThan(highest.view.undone.count[0]);
  });

  it('holds at both ends of the range the constant may take, and binds above it', () => {
    const breaks = degrees => viewed.filter(row => breaksView(row.view.variants[degrees], row.view.undone));
    expect(breaks(LIMIT.degreesFrom).map(label), `${LIMIT.degreesFrom} degrees`).toEqual([]);
    expect(breaks(LIMIT.degreesTo).map(label), `${LIMIT.degreesTo} degrees`).toEqual([]);
    expect(breaks(LIMIT.degreesTo + 1).length, `${LIMIT.degreesTo + 1} degrees breaks the guard`).toBeGreaterThan(0);
  });

  it('fades the third-person lean with upward aim, on the same update', () => {
    const degrees = constant() * DEG, sweep = of(rows, 'crouched sweep');
    for (const row of sweep) {
      const at = `pitch ${row.view.aim.toFixed(2)}`;
      if (row.pitch <= LIMIT.fadeStart + 1e-9) {
        expect(Math.abs(row.chestLean - degrees), `${at}: chest lean`).toBeLessThanOrEqual(LIMIT.leanBand);
        expect(row.applied / constant(), `${at}: share of the constant`).toBeGreaterThan(0.999);
      }
      if (row.pitch >= LIMIT.fadeEnd - 1e-9) {
        expect(Math.abs(row.chestLean), `${at}: chest lean`).toBeLessThanOrEqual(LIMIT.fadedOut);
        expect(row.applied, `${at}: radians the handler turned spine_01`).toBe(0);
      }
    }
    // The sweep goes from the highest pitch to the lowest, so the lean never decreases along it.
    sweep.forEach((row, i) => { if (i) expect(row.applied, `pitch ${row.view.aim.toFixed(2)}`).toBeGreaterThanOrEqual(sweep[i - 1].applied - LIMIT.same); });
    // Strictly between none and all inside the fade, and strictly rising as the pitch comes down. The
    // handler turns no bone below 0.0005 rad, so the last 0.1 rad before the fade end is left out here.
    const between = sweep.filter(row => row.pitch > LIMIT.fadeStart + 0.01 && row.pitch < LIMIT.fadeEnd - 0.1);
    expect(between.length).toBeGreaterThanOrEqual(5);
    between.forEach((row, i) => {
      expect(row.applied).toBeGreaterThan(0); expect(row.applied).toBeLessThan(constant());
      if (i) expect(row.applied, `pitch ${row.view.aim.toFixed(2)}`).toBeGreaterThan(between[i - 1].applied);
    });
    // One update each: level, up, level, down, level, then the four pitches of the summary.
    const steps = of(rows, 'aim steps'), [level, up, levelAgain, down] = steps;
    expect(level.applied / constant()).toBeCloseTo(1, 6);
    expect(up.applied).toBe(0);
    expect(levelAgain.applied / constant()).toBeCloseTo(1, 6);
    expect(down.applied / constant()).toBeCloseTo(1, 6);
    expect(Math.abs(steps[5].chestLean - degrees), 'pose pitch +0.3').toBeLessThanOrEqual(LIMIT.leanBand);
    expect(Math.abs(steps[8].chestLean), 'pose pitch +0.8').toBeLessThanOrEqual(LIMIT.fadedOut);
    for (let i = 6; i <= 8; i++) expect(steps[i].applied).toBeLessThan(steps[i - 1].applied);
    // The weapon keeps its direction through the fade as well.
    for (const row of [...sweep, ...steps]) expect(row.handTurn, `pitch ${row.pitch.toFixed(2)}`).toBeLessThanOrEqual(LIMIT.weapon);
  });

  it('keeps the eye in front of the crouched chest when looking down', () => {
    const at = of(rows, 'look down');
    expect(at).toHaveLength(LOOK_DOWN.length);
    at.forEach((row, i) => {
      expect(row.applied / constant(), `pitch ${LOOK_DOWN[i]}: the lean is whole`).toBeGreaterThan(0.999);
      expect(row.view.ahead, `pitch ${LOOK_DOWN[i]}`).toBeGreaterThanOrEqual(LIMIT.nearestChest);
      expect(row.view.ahead, `pitch ${LOOK_DOWN[i]}`).toBeLessThanOrEqual(LIMIT.farthestChest);
    });
  });
});

// ── Enemies and remote players: the driver alone ──────────────────────────
describe('an enemy-style actor with a mounted weapon, through the driver only', () => {
  const ROLES = [['assault', 'm4'], ['smg', 'p90'], ['sniper', 'awp'], ['pistol', 'pistol']];
  /** The real builder's actor with the real enemy weapon mount; tickPresentation and nothing else. */
  function enemy(role, weapon) {
    const { mesh, mixer, actions } = glb.buildEnemyMesh(0, 0, role), actor = { mesh, mixer, actions };
    actions._breathing.time = BREATH_START;
    const mount = bone(mesh, 'enemyWeaponMount'), owner = handling.getWeaponHandling(mount?.children[0]);
    let time = 0;
    const tick = (crouching, sampleTime = null, alive = true) => {
      time += DT;
      driver.tickPresentation(actor, { identity: 'bot', generation: 0, sampleTimeSeconds: sampleTime ?? time,
        position: { x: 0, y: 0, z: 0 }, bodyYaw: 0, aimYaw: 0, pitch: 0, alive, crouching, onGround: true, weapon,
        action: { kind: 'ready' } }, DT);
      return { crouching, gait: actor.presentation.gait.map(entry => entry.key).join('+'), left: owner.contacts?.leftError,
        amount: owner.crouchLean, ...leanOf(mesh, owner) };
    };
    return { mount, owner, tick };
  }

  it.each(ROLES)('%s: leans by the constant when crouching and not otherwise', (role, weapon) => {
    const { mount, owner, tick } = enemy(role, weapon), degrees = constant() * DEG;
    expect(mount, 'the enemy weapon mount, built in Node').toBeTruthy();
    expect(owner?.weapon).toBe(weapon);
    const standing = Array.from({ length: 60 }, () => tick(false));
    const crouched = Array.from({ length: 200 }, () => tick(true));
    const released = Array.from({ length: 60 }, () => tick(false));
    figures.enemies[role] = { weapon, standingApplied: Math.max(...standing.map(row => row.applied)),
      firstTick: crouched[0].applied / constant(), after30Ticks: crouched[29].applied / constant(), released30Ticks: released[29].applied / constant(),
      settled: { appliedDegrees: crouched.at(-1).applied * DEG, chestLean: crouched.at(-1).chestLean, chestPitch: crouched.at(-1).lean.chestPitch,
        torsoLine: crouched.at(-1).lean.torsoLine, chest: crouched.at(-1).lean.chest, head: crouched.at(-1).lean.head,
        handTurn: crouched.at(-1).handTurn, left: crouched.at(-1).left } };
    for (const row of standing.slice(30)) expect(row.applied).toBe(0);
    expect(standing.at(-1).gait).toBe(`${weapon}_ready`);
    expect(crouched.at(-1).gait).toBe('crouch_idle');
    expect(crouched.at(-1).applied * DEG).toBeCloseTo(degrees, 6);
    expect(Math.abs(crouched.at(-1).chestLean - degrees), 'chest pitch over the lean undone').toBeLessThanOrEqual(LIMIT.leanBand);
    expect(crouched[0].applied / constant(), 'one tick after the press').toBeLessThan(LIMIT.firstTick);
    expect(crouched[29].applied / constant(), '0.5 s after the press').toBeGreaterThan(LIMIT.eased);
    expect(released[29].applied / constant(), '0.5 s after the release').toBeLessThan(LIMIT.released);
    for (const row of [...crouched, ...released]) expect(row.handTurn, 'hand_r against the lean undone').toBeLessThanOrEqual(LIMIT.weapon);
    expect(released.at(-1).applied).toBe(0);
  }, SLOW);

  it('rises smoothly when each snapshot is presented on two updates', () => {
    const { tick } = enemy('assault', 'm4'), shares = [];
    // The sample time of src/network/remoteActors.js is the snapshot tick over 30; each snapshot is
    // presented on two updates of 1/60 s. Snapshots 0 to 29 standing, then the crouch.
    for (let i = 0; i < 60; i++) tick(false, Math.floor(i / 2) / 30);
    for (let i = 0; i < 40; i++) shares.push(tick(true, (29 + Math.ceil((i + 1) / 2)) / 30).applied / constant());
    figures.cadence.remoteThroughDriver = { firstUpdate: shares[0], secondUpdate: shares[1], after15Snapshots: shares[29],
      largestStep: Math.max(...shares.map((value, i) => value - (shares[i - 1] ?? 0))) };
    expect(shares[0]).toBeGreaterThan(0);
    expect(shares[0], 'first update after the press').toBeLessThan(0.5);
    shares.forEach((value, update) => {
      const previous = shares[update - 1] ?? 0;
      if (update % 2) expect(Math.abs(value - previous), `update ${update}: a repeated sample time`).toBeLessThanOrEqual(1e-6);
      else expect(value - previous, `update ${update}: a new sample time`).toBeGreaterThan(0);
      expect(value - previous, `update ${update}: one step`).toBeLessThan(0.5);
    });
    expect(shares[29]).toBeGreaterThan(LIMIT.eased);
  }, SLOW);
});

// ── Three conditions under which a handler must not lean (plan 07-38, review W-10) ──
describe('a handler that must not lean', () => {
  /**
   * A copy of the conditions of the handler's rule (crouchLean of weaponHandling.js): whether a handler
   * given this pose leans the skeleton it holds. `without` leaves one condition out, as a handler that
   * lost it would decide.
   */
  const leansByRule = (owner, pose, without = '') =>
    !(!owner.skeleton || (without !== 'anchor' && owner.fixedAnchor === true) || (without !== 'weapon' && pose.weapon !== owner.weapon))
    && (without === 'alive' || pose.alive !== false) && pose.crouching === true;
  /** The largest turn, in radians, of the given bones away from the given rotations. */
  const turnedFrom = (bones, rotations) => Math.max(...bones.map((node, i) => turn(rotations[i], node.quaternion)));
  /** This file's four rotations on a skeleton, as a handler without the condition would apply them; returns the undo. */
  function leanHere(root, bones, radians) {
    const kept = bones.map(node => node.quaternion.clone());
    root.updateMatrixWorld(true);
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    bones.forEach((node, i) => worldTurn(node, axis, i ? -radians : radians));
    return () => { bones.forEach((node, i) => node.quaternion.copy(kept[i])); root.updateMatrixWorld(true); };
  }
  /** A crouched M4 player, settled, with the lean on. */
  function crouchedPlayer() {
    const player = livePlayer(), rows = play(player, 'm4', [...repeat('standing', 30), ...repeat('crouch, settling', 120, { crouching: true })]);
    expect(rows.at(-1).applied / constant(), 'the third-person handler leans the crouched player').toBeGreaterThan(0.99);
    return player;
  }

  it('a fixed-anchor handler of the first-person view never leans the arms view it holds', () => {
    const player = crouchedPlayer(), { rig, actor } = player, pose = actor.presentation;
    const viewOwner = [...rig.handlers].find(each => each.weapon === 'm4'), sourceOwner = owner3p('m4');
    expect(viewOwner.fixedAnchor).toBe(true);
    expect(viewOwner.skeleton, 'the view handler holds the arms view').toBe(rig.arms);
    expect(pose.crouching === true && pose.alive !== false && pose.weapon === viewOwner.weapon).toBe(true);
    const armBones = LEAN_BONES.map(name => rig.armPairs.find(([, node]) => node.name === name)[1]);
    // What updateFirstPersonRig gives the arms view: the rotations the source had before its handler leaned it.
    const unleaned = LEAN_BONES.map(name => sourceOwner.corrections.get(bone(actor.mesh, name)));
    expect(unleaned.every(Boolean)).toBe(true);
    expect(viewOwner.crouchLean).toBe(0);
    for (const node of armBones) expect(viewOwner.corrections.has(node), node.name).toBe(false);
    expect(turnedFrom(armBones, unleaned)).toBeLessThanOrEqual(LIMIT.same);
    // The copy of the rule agrees with both handlers, and without the condition it leans the arms view.
    expect(leansByRule(sourceOwner, pose)).toBe(true);
    expect(leansByRule(viewOwner, pose)).toBe(false);
    expect(leansByRule(viewOwner, pose, 'anchor')).toBe(true);
    // Control: the rotations that decision applies to the arms view fail the measure asserted above.
    const undo = leanHere(rig.arms, armBones, constant());
    try { expect(turnedFrom(armBones, unleaned)).toBeGreaterThan(0.9 * constant()); } finally { undo(); }
    expect(turnedFrom(armBones, unleaned)).toBeLessThanOrEqual(LIMIT.same);
  }, SLOW);

  it('a handler whose weapon is not the weapon of the pose never leans the skeleton it holds', () => {
    const player = crouchedPlayer(), { actor } = player, pose = actor.presentation, other = owner3p('pistol');
    guns.restorePlayerWeaponHandling();
    const bones = LEAN_BONES.map(name => bone(actor.mesh, name)), found = bones.map(node => node.quaternion.clone());
    const mount = other.mountRest;
    // The game hands the skeleton to the handler of the pose's weapon only (updatePlayerWeaponHandling of
    // src/builders/weapon.js). Here the pistol's handler holds it while the pose carries the M4.
    other.skeleton = actor.mesh;
    try {
      expect(pose.crouching === true && pose.alive !== false && pose.weapon === 'm4' && other.weapon === 'pistol').toBe(true);
      for (let update = 1; update <= 3; update++) {
        handling.updateWeaponHandling(other, { ...pose, sampleTimeSeconds: pose.sampleTimeSeconds + update * DT });
        expect(other.crouchLean, `update ${update}`).toBe(0);
        for (const node of bones) expect(other.corrections.has(node), `update ${update}: ${node.name}`).toBe(false);
        expect(turnedFrom(bones, found), `update ${update}`).toBeLessThanOrEqual(LIMIT.same);
      }
      expect(leansByRule(other, pose)).toBe(false);
      expect(leansByRule(other, pose, 'weapon')).toBe(true);
      // Control: the rotations that decision applies to the skeleton fail the measure asserted above.
      const undo = leanHere(actor.mesh, bones, constant());
      try { expect(turnedFrom(bones, found)).toBeGreaterThan(0.9 * constant()); } finally { undo(); }
    } finally {
      handling.restoreWeaponHandlingBones(other);
      other.skeleton = null; other.mountRest = mount;
    }
    expect(turnedFrom(bones, found)).toBeLessThanOrEqual(LIMIT.same);
  }, SLOW);

  it('a pose that is not alive never leans', () => {
    const player = livePlayer();
    play(player, 'm4', repeat('standing', 60));
    const { actor } = player, pose = actor.presentation, time = pose.sampleTimeSeconds, owner = owner3p('m4');
    const bones = LEAN_BONES.map(name => bone(actor.mesh, name));
    // A reset pose takes its target at once: dead and crouching, the target is no lean.
    const dead = { ...pose, crouching: true, alive: false, reset: true, sampleTimeSeconds: time + DT };
    expect(again(player, dead)).toBe(0);
    expect(owner.crouchLean).toBe(0);
    for (const node of bones) expect(owner.corrections.has(node), node.name).toBe(false);
    expect(leansByRule(owner, dead)).toBe(false);
    expect(leansByRule(owner, dead, 'alive')).toBe(true);
    // The same pose alive leans by the constant, so the case above measured a handler that can lean.
    const alive = { ...dead, alive: true, sampleTimeSeconds: time + 2 * DT };
    expect(leansByRule(owner, alive)).toBe(true);
    expect(again(player, alive) / constant()).toBeCloseTo(1, 9);
    // Dying while crouched: the lean is gone 0.5 s later, as after a release.
    let left;
    for (let update = 3; update <= 32; update++) left = again(player, { ...pose, crouching: true, alive: false, sampleTimeSeconds: time + update * DT });
    expect(left / constant(), '0.5 s after the death').toBeLessThan(LIMIT.released);
    // Control: the rotations a handler without the condition applies fail the measure of a pose that does not lean.
    guns.restorePlayerWeaponHandling();
    const found = bones.map(node => node.quaternion.clone()), undo = leanHere(actor.mesh, bones, constant());
    try { expect(turnedFrom(bones, found)).toBeGreaterThan(0.9 * constant()); } finally { undo(); }
  }, SLOW);
});

describe('figures for the summary', () => {
  it('holds a finite figure for every weapon', () => {
    for (const weapon of WEAPON_KEYS) {
      const { settledCrouch, thirdPersonSupport, firstPersonSupport } = figures.weapons[weapon];
      for (const value of [settledCrouch.chestPitch, settledCrouch.torsoLine, thirdPersonSupport.withLean, firstPersonSupport.withLean])
        expect(Number.isFinite(value), weapon).toBe(true);
    }
  });
});

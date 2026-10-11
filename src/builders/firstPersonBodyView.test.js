import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import manifest from '../../tools/art/motion-manifest.json';
import { MOVE_SPEED, PLAYER_H, PLAYER_H_CROUCH, WEAPONS } from '../config.js';

vi.mock('../scene.js', () => ({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(75, 4 / 3, 0.05, 100) }));
vi.mock('../materials.js', () => ({ mm: (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness }) }));
vi.mock('./weaponFBX.js', () => ({ attachWeapons3pToHand: vi.fn() }));
import * as glb from './enemyGLTF.js';
import * as driver from './enemyAnimations.js';
import * as view from './firstPersonRig.js';
import * as guns from './weapon.js';
import { WEAPON3P_GRIP, WEAPON3P_ROT } from './weapon3pTransform.js';

// Guard for blockers B-01 and B-02 of the delta review of the crouch lean (plan 07-38): the lean of
// plan 07-35 must not reach the first-person body view, and a test must measure what that protects.
// The live player and its first-person rig are driven by one actor object, the way src/loop.js runs a
// frame, with the real handlers of src/builders/weapon.js and the real meshes of the body view.
// "The lean undone" is the same frame with the handler's four lean rotations put back on the source
// skeleton before updateFirstPersonRig copies the pose. A "drawn mesh" is a skinned mesh of the body
// view that first person draws (its own visible flag). Surfaces are the triangles of those meshes,
// skinned here as the shader skins them. A mesh is "closed" when every edge of its drawn triangles,
// welded by position, belongs to exactly two of them; the eye is inside a closed mesh when an odd
// number of its triangles cross any of three fixed rays from the eye.
// Every limit was fixed in the plan before this file existed and is never loosened here.
const LIMIT = Object.freeze({
  bone: 1e-5, // an element of a body-view bone's world matrix against the lean undone
  pitchStep: 0.1, // radians between neighbouring pitches of a sweep, at most
  skinning: 1e-4, // metres: this file's skinning of a vertex against the skinning of three
  phase: 1e-6, // a sample taken at a key is within this of the key, as a share of the clip
});
const DT = 1 / 60, STEP = 0.05; // seconds per tick: the display rate, and the cap of src/loop.js
const ROOT = new THREE.Vector3(3.25, 0.5, -7.75); // away from the origin, so no check passes by a zero
const BREATH_START = 0.875; // seconds into the breathing layer; the builder starts it at a random time
const SLOW = 30000; // milliseconds allowed to a case that builds players and runs hundreds of frames
const WEAPON = 'm4';
const LEAN_BONES = ['spine_01', 'clavicle_l', 'clavicle_r', 'neck_01'];
const PITCH_LIMIT = 1.38; // player.pitch is clamped to this (src/main.js, src/loop.js)
const PITCHES = [...Array.from({ length: Math.ceil(2 * PITCH_LIMIT / LIMIT.pitchStep) },
  (_, i) => +(PITCH_LIMIT - i * LIMIT.pitchStep).toFixed(2)), -PITCH_LIMIT];
const DIRECTIONS = [['forward', [0, 1]], ['back', [0, -1]], ['left', [-1, 0]], ['right', [1, 0]]]; // [right, forward]
const cycle = family => manifest.actions.find(action => action.id === `${family}_forward`).cycleDisplacement;
const CROUCH_SPEED = MOVE_SPEED * 0.72; // the game's crouch walk (src/entities/player.js)
const LAST = 1 - 1e-6; // a looping layer wraps at its last key, so that key is sampled this far before it
// The view turning: radians per second one way, and a swing of 4 rad/s that reverses every 0.5 s.
const TURNS = [['turning 1 rad/s', () => 1, 30], ['turning 3 rad/s', () => 3, 30],
  ['swinging 4 rad/s', seconds => (Math.floor(seconds * 2) % 2 ? -4 : 4), 60]];
const RAYS = [[0.267, 0.535, 0.802], [-0.816, 0.408, -0.408], [0.426, -0.64, -0.64]].map(d => new THREE.Vector3(...d).normalize());
const CROUCHED = ['crouch idle', ...DIRECTIONS.map(([name]) => `crouch walk ${name}`), 'crouched ADS', 'crouched fire', 'crouched reload'];
const STILL = ['standing', ...CROUCHED];

let gltf, log;
const rows = [], figures = { limits: LIMIT, pitches: PITCHES, meshes: [], lean: {}, clearance: {}, turning: {}, inside: {} };

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
  if (env.BODY_VIEW_FIGURES) writeFileSync(env.BODY_VIEW_FIGURES, JSON.stringify(figures, null, 1));
});

// ── Surfaces of the body view ─────────────────────────────────────────────
const bone = (mesh, name) => mesh.getObjectByName(name);
const owner3p = () => guns.playerWeaponHandling.get(`3p:${WEAPON}`);
const partsOf = new WeakMap();
/** The drawn meshes of the body view, each with its drawn triangles and whether they close a volume. */
function drawnParts(rig) {
  if (partsOf.has(rig)) return partsOf.get(rig);
  const parts = [];
  rig.body.traverse(mesh => {
    if (!mesh.isSkinnedMesh || !mesh.visible || !mesh.geometry.index) return;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes, index = Uint32Array.from(mesh.geometry.index.array);
    const vertices = Uint32Array.from(new Set(index)), used = new Set(), edges = new Map();
    for (const vertex of vertices) for (let j = 0; j < 4; j++) if (skinWeight.getComponent(vertex, j) !== 0) used.add(skinIndex.getComponent(vertex, j));
    const key = vertex => `${Math.round(position.getX(vertex) * 1e5)}/${Math.round(position.getY(vertex) * 1e5)}/${Math.round(position.getZ(vertex) * 1e5)}`;
    for (let t = 0; t < index.length; t += 3) for (let j = 0; j < 3; j++) {
      const a = key(index[t + j]), b = key(index[t + (j + 1) % 3]);
      if (a === b) continue; // a triangle folded onto a welded seam has no edge there
      const edge = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
    const open = [...edges.values()].filter(count => count !== 2).length;
    parts.push({ mesh, name: mesh.name, position, skinIndex, skinWeight, index, vertices, used: [...used],
      world: new Float64Array(position.count * 3), closed: open === 0, openEdges: open, triangles: index.length / 3 });
  });
  partsOf.set(rig, parts);
  return parts;
}
/** Every drawn vertex in world space minus the eye, as the skinning shader places it. */
function skin(part, eye) {
  const { mesh, position, skinIndex, skinWeight, world } = part, matrices = new Map(), matrix = new THREE.Matrix4();
  const toWorld = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
  for (const index of part.used) matrices.set(index, matrix.clone().multiplyMatrices(toWorld, mesh.skeleton.bones[index].matrixWorld)
    .multiply(mesh.skeleton.boneInverses[index]).multiply(mesh.bindMatrix).elements);
  for (const vertex of part.vertices) {
    const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
    let wx = 0, wy = 0, wz = 0;
    for (let j = 0; j < 4; j++) {
      const weight = skinWeight.getComponent(vertex, j);
      if (weight === 0) continue;
      const e = matrices.get(skinIndex.getComponent(vertex, j));
      wx += weight * (e[0] * x + e[4] * y + e[8] * z + e[12]);
      wy += weight * (e[1] * x + e[5] * y + e[9] * z + e[13]);
      wz += weight * (e[2] * x + e[6] * y + e[10] * z + e[14]);
    }
    world[vertex * 3] = wx - eye.x; world[vertex * 3 + 1] = wy - eye.y; world[vertex * 3 + 2] = wz - eye.z;
  }
  return world;
}
/** Squared distance from the origin to the nearest point of a triangle. */
function nearestSquared(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const d1 = -(abx * ax + aby * ay + abz * az), d2 = -(acx * ax + acy * ay + acz * az);
  if (d1 <= 0 && d2 <= 0) return ax * ax + ay * ay + az * az;
  const d3 = -(abx * bx + aby * by + abz * bz), d4 = -(acx * bx + acy * by + acz * bz);
  if (d3 >= 0 && d4 <= d3) return bx * bx + by * by + bz * bz;
  let px, py, pz;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); px = ax + v * abx; py = ay + v * aby; pz = az + v * abz; return px * px + py * py + pz * pz; }
  const d5 = -(abx * cx + aby * cy + abz * cz), d6 = -(acx * cx + acy * cy + acz * cz);
  if (d6 >= 0 && d5 <= d6) return cx * cx + cy * cy + cz * cz;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); px = ax + w * acx; py = ay + w * acy; pz = az + w * acz; return px * px + py * py + pz * pz; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); px = bx + w * (cx - bx); py = by + w * (cy - by); pz = bz + w * (cz - bz);
    return px * px + py * py + pz * pz;
  }
  const denominator = 1 / (va + vb + vc), v = vb * denominator, w = vc * denominator;
  px = ax + abx * v + acx * w; py = ay + aby * v + acy * w; pz = az + abz * v + acz * w;
  return px * px + py * py + pz * pz;
}
/** Whether a ray from the origin crosses a triangle (either face). */
function crosses(d, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  const hx = d.y * e2z - d.z * e2y, hy = d.z * e2x - d.x * e2z, hz = d.x * e2y - d.y * e2x;
  const det = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(det) < 1e-18) return false;
  const u = -(ax * hx + ay * hy + az * hz) / det;
  if (u < 0 || u > 1) return false;
  const qx = -ay * e1z + az * e1y, qy = -az * e1x + ax * e1z, qz = -ax * e1y + ay * e1x;
  const v = (d.x * qx + d.y * qy + d.z * qz) / det;
  if (v < 0 || u + v > 1) return false;
  return (e2x * qx + e2y * qy + e2z * qz) / det > 0;
}
/**
 * The drawn body view against an eye: the nearest surface point (metres, and its mesh), and the closed
 * meshes that hold the eye. `eye` defaults to the camera; a control passes another point.
 */
function surfaces(rig, camera, eye = camera.position) {
  let nearest = Infinity, nearestMesh = '';
  const inside = [];
  for (const part of drawnParts(rig)) {
    const at = skin(part, eye), { index } = part, odd = [0, 0, 0];
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
      const squared = nearestSquared(at[a], at[a + 1], at[a + 2], at[b], at[b + 1], at[b + 2], at[c], at[c + 1], at[c + 2]);
      if (squared < nearest) { nearest = squared; nearestMesh = part.name; }
      if (part.closed) for (let r = 0; r < 3; r++)
        if (crosses(RAYS[r], at[a], at[a + 1], at[a + 2], at[b], at[b + 1], at[b + 2], at[c], at[c + 1], at[c + 2])) odd[r] ^= 1;
    }
    if (odd.some(Boolean)) inside.push(`${part.name} (${odd.join('')})`);
  }
  return { clearance: Math.sqrt(nearest), nearestMesh, inside };
}

// ── The live player and one frame, as src/loop.js runs it ─────────────────
/** The player actor and the first-person rig that live play builds; one at a time, as in the game. */
function livePlayer() {
  expect(glb.buildPlayerMesh()).toBe(true);
  const actor = { mesh: glb.playerMesh, mixer: glb.playerMixer, actions: glb.playerActions };
  actor.actions._breathing.time = BREATH_START;
  // The game mounts its one third-person weapon group on the right hand of its one player.
  guns.attachWeapon3pToHand(bone(actor.mesh, 'hand_r'), WEAPON3P_ROT, WEAPON3P_GRIP);
  return { actor, rig: glb.playerFirstPersonRig, camera: new THREE.PerspectiveCamera(75, 4 / 3, 0.05, 100),
    time: 0, x: ROOT.x, z: ROOT.z, yaw: 0, turning: 0 };
}
const layerAction = (actor, upper) => [...actor._presentationActive.keys()]
  .find(action => action.getClip().name.endsWith(upper ? '_upper' : '_lower'));
const READ = {
  gait: actor => actor.presentation.phase,
  action: actor => actor.presentation.action.phase,
  upper: actor => layerAction(actor, true).time / layerAction(actor, true).getClip().duration,
};
/** Every key time of the layer the driver plays, as shares of its clip, in order. */
function phasesOf(actor, upper) {
  const clip = layerAction(actor, upper).getClip(), times = new Set();
  for (const track of clip.tracks) for (const time of track.times) times.add(time);
  return [...new Set([...times].sort((a, b) => a - b).map(time => Math.min(time / clip.duration, LAST)))];
}
const circular = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
function turn(from, to) {
  const d = from.clone().conjugate().multiply(to);
  return 2 * Math.atan2(Math.hypot(d.x, d.y, d.z), Math.abs(d.w));
}
const matricesOf = rig => rig.bodyPairs.flatMap(([, node]) => node.matrixWorld.elements);
/**
 * One frame. A tick is plain data: `dt`, `state`, and optionally `crouching`, `pitch`, `turn` (rad/s,
 * or a function of the seconds turned so far), `velocity` [right, forward] in m/s, `aiming`, `action`,
 * `reads` and `phase` (the tick was timed to land on a key). `measure: false` runs the frame only.
 */
function frame(player, tick) {
  const { actor, rig, camera } = player, owner = owner3p(), dt = tick.dt ?? DT, pitch = tick.pitch ?? 0;
  const crouching = tick.crouching === true, eyeHeight = crouching ? PLAYER_H_CROUCH : PLAYER_H; // eyeH of src/loop.js
  player.time += dt;
  if (tick.turn) { player.yaw += tick.turn(player.turning) * dt; player.turning += dt; } else player.turning = 0;
  const [right, forward] = tick.velocity ?? [0, 0], sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  player.x += (right * cos - forward * sin) * dt; player.z += (-right * sin - forward * cos) * dt;
  guns.restorePlayerWeaponHandling();
  camera.position.set(player.x, ROOT.y + eyeHeight, player.z);
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, player.yaw, 0, 'YXZ'));
  camera.updateMatrixWorld(true);
  actor.mesh.position.set(player.x, ROOT.y, player.z);
  actor.mesh.rotation.y = player.yaw + Math.PI;
  driver.tickPresentation(actor, { identity: 'local', generation: 0,
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    sampleTimeSeconds: player.time, bodyYaw: player.yaw, aimYaw: player.yaw, pitch,
    crouching, onGround: true, sprinting: false, weapon: WEAPON, alive: true,
    aiming: tick.aiming === true, action: tick.action ?? { kind: 'ready' } }, dt, false);
  driver.finishPresentation(actor, dt);
  const pose = actor.presentation;
  guns.updatePlayerWeaponHandling(pose, actor.mesh);
  const update = step => view.updateFirstPersonRig(rig, { pose, camera, weapon: guns.wpn, dt: step,
    active: true, thirdPerson: false, spineQuaternion: actor._presentationCorrection?.get(bone(actor.mesh, 'spine_03')),
    rawCorrections: owner.corrections, eyeHeight: PLAYER_H });
  if (tick.measure === false) { update(dt); return null; }
  const spine = bone(actor.mesh, 'spine_01'), saved = owner.corrections.get(spine);
  const row = { state: tick.state, pitch, phase: tick.phase, seen: tick.reads ? READ[tick.reads](actor) : undefined,
    gait: pose.gait.map(entry => entry.key).join('+'), upper: pose.upper, crouching: pose.crouching,
    applied: saved ? turn(saved, spine.quaternion) : 0 };
  // The lean undone: the four bones as the handler found them, before the pose is copied.
  const kept = LEAN_BONES.map(name => bone(actor.mesh, name)).map(node => [node, node.quaternion.clone()]);
  for (const [node] of kept) { const before = owner.corrections.get(node); if (before) node.quaternion.copy(before); }
  update(0);
  const undone = matricesOf(rig);
  for (const [node, quaternion] of kept) node.quaternion.copy(quaternion);
  update(dt);
  const shown = matricesOf(rig);
  row.difference = 0;
  for (let i = 0; i < shown.length; i++) {
    const difference = Math.abs(shown[i] - undone[i]);
    if (difference > row.difference) { row.difference = difference; row.differs = rig.bodyPairs[Math.floor(i / 16)][1].name; }
  }
  return Object.assign(row, surfaces(rig, camera));
}
const repeat = (count, tick) => Array.from({ length: count }, () => ({ dt: DT, measure: false, ...tick }));
/** Ticks timed so that each lands on one key of what `reads` names; `seconds` is one whole clip or cycle. */
function* keys(player, state, base, { reads, phases, seconds }) {
  const read = () => READ[reads](player.actor), now = read();
  const order = [...phases.filter(phase => phase > now + 1e-9), ...phases.filter(phase => phase <= now + 1e-9)];
  for (const phase of order) {
    let left = ((((phase - read()) % 1) + 1) % 1) * seconds;
    for (; left > STEP; left -= STEP) yield { ...base, measure: false, dt: STEP };
    yield { ...base, dt: left, state, reads, phase };
  }
}
/** Runs a script of ticks (a list, or a generator that reads the player between ticks) and keeps the measured rows. */
function play(script) {
  const player = livePlayer(), source = typeof script === 'function' ? script(player) : script[Symbol.iterator]();
  for (let next = source.next(); !next.done; next = source.next()) { const row = frame(player, next.value); if (row) rows.push(row); }
  return player;
}
const of = state => rows.filter(row => row.state === state);
const worst = (list, pick) => list.reduce((most, row) => (most === null || pick(row) > pick(most) ? row : most), null);

describe('the first-person body view on the real rig and meshes', () => {
  const counts = {};
  let lastPlayer;
  beforeAll(() => {
    const crouching = true, reload = { kind: 'reload', total: WEAPONS.m4.reload / 1000 }, fire = { kind: 'fire', total: 0.2 };
    // Standing, the settled crouch and the crouched actions, at every pitch.
    play(function* (player) {
      yield* repeat(30, {});
      for (const pitch of PITCHES) { yield* repeat(2, { pitch }); yield { dt: DT, state: 'standing', pitch }; }
      yield* repeat(120, { crouching });
      for (const pitch of PITCHES) { yield* repeat(2, { crouching, pitch }); yield { dt: DT, state: 'crouch idle', crouching, pitch }; }
      yield* repeat(60, { crouching, aiming: true });
      const ads = layerAction(player.actor, true);
      counts['crouched ADS'] = phasesOf(player.actor, true).length;
      for (const pitch of PITCHES) yield* keys(player, 'crouched ADS', { crouching, aiming: true, pitch },
        { reads: 'upper', phases: phasesOf(player.actor, true), seconds: ads.getClip().duration });
      for (const [state, action] of [['crouched fire', fire], ['crouched reload', reload]]) {
        yield* repeat(36, { crouching });
        // Held at its first key until the blend of the entry has expired, then one tick per key.
        yield* repeat(60, { crouching, action: { ...action, elapsed: 0 } });
        const phases = phasesOf(player.actor, true);
        counts[state] = phases.length;
        for (const pitch of PITCHES) for (const phase of phases)
          yield { crouching, pitch, dt: DT, state, reads: 'action', phase, action: { ...action, elapsed: action.total * phase } };
      }
    });
    // The crouch walk in four directions, at every key of the clip and every pitch.
    play(function* (player) {
      yield* repeat(30, {});
      for (const [name, [right, forward]] of DIRECTIONS) {
        const base = { crouching, velocity: [right * CROUCH_SPEED, forward * CROUCH_SPEED] };
        yield* repeat(90, base);
        counts[`crouch walk ${name}`] = phasesOf(player.actor, false).length;
        for (const pitch of PITCHES) yield* keys(player, `crouch walk ${name}`, { ...base, pitch },
          { reads: 'gait', phases: phasesOf(player.actor, false), seconds: cycle('crouch') / CROUCH_SPEED });
      }
    });
    // The view turning, standing and crouched: the feet stay planted and the body yaw lags.
    for (const stance of ['standing', 'crouched']) lastPlayer = play(function* () {
      yield* repeat(30, {});
      if (stance === 'crouched') yield* repeat(120, { crouching });
      for (const [name, rate, ticks] of TURNS) {
        yield* repeat(30, { crouching: stance === 'crouched' });
        for (const pitch of PITCHES) for (let i = 0; i < ticks; i++)
          yield { dt: DT, state: `${stance}, ${name}`, crouching: stance === 'crouched', pitch, turn: rate };
      }
    });
    figures.meshes = drawnParts(lastPlayer.rig).map(part => ({ name: part.name, triangles: part.triangles, closed: part.closed, openEdges: part.openEdges }));
    for (const state of STILL) {
      const at = of(state), leaned = worst(at, row => row.difference);
      figures.lean[state] = { samples: at.length, appliedDegrees: [Math.min(...at.map(row => row.applied)), Math.max(...at.map(row => row.applied))].map(r => r * 180 / Math.PI),
        largestDifference: leaned.difference, bone: leaned.differs, atPitch: leaned.pitch };
      figures.clearance[state] = PITCHES.map(pitch => { const near = worst(at.filter(row => row.pitch === pitch), row => -row.clearance);
        return { pitch, nearest: +near.clearance.toFixed(4), mesh: near.nearestMesh, inside: at.filter(row => row.pitch === pitch && row.inside.length).length,
          samples: at.filter(row => row.pitch === pitch).length }; });
      figures.inside[state] = { samples: at.length, inside: at.filter(row => row.inside.length).length, meshes: [...new Set(at.flatMap(row => row.inside.map(name => name.split(' ')[0])))] };
    }
    for (const stance of ['standing', 'crouched']) for (const [name] of TURNS) {
      const state = `${stance}, ${name}`, at = of(state);
      figures.turning[state] = PITCHES.map(pitch => { const here = at.filter(row => row.pitch === pitch), near = worst(here, row => -row.clearance);
        return { pitch, nearest: +near.clearance.toFixed(4), mesh: near.nearestMesh, inside: here.filter(row => row.inside.length).length, samples: here.length }; });
      figures.inside[state] = { samples: at.length, inside: at.filter(row => row.inside.length).length, meshes: [...new Set(at.flatMap(row => row.inside.map(mesh => mesh.split(' ')[0])))] };
    }
  }, 20 * SLOW);

  it('samples the states it names, each walk and action at every key, at pitches at most 0.1 rad apart', () => {
    expect(PITCHES[0]).toBe(PITCH_LIMIT);
    expect(PITCHES.at(-1)).toBe(-PITCH_LIMIT);
    for (let i = 1; i < PITCHES.length; i++) expect(PITCHES[i - 1] - PITCHES[i]).toBeLessThanOrEqual(LIMIT.pitchStep + 1e-9);
    for (const row of rows) {
      if (row.phase === undefined) continue;
      expect(circular(row.seen, row.phase), `${row.state}: sampled at ${row.seen}, key at ${row.phase}`).toBeLessThanOrEqual(LIMIT.phase);
    }
    expect(of('standing')).toHaveLength(PITCHES.length);
    expect(of('crouch idle')).toHaveLength(PITCHES.length);
    for (const row of of('standing')) expect([row.gait, row.upper, row.crouching]).toEqual([`${WEAPON}_ready`, 'ready', false]);
    for (const row of of('crouch idle')) expect([row.gait, row.upper, row.crouching]).toEqual(['crouch_idle', 'ready', true]);
    for (const [name] of DIRECTIONS) {
      expect(counts[`crouch walk ${name}`]).toBeGreaterThanOrEqual(30);
      expect(of(`crouch walk ${name}`)).toHaveLength(counts[`crouch walk ${name}`] * PITCHES.length);
      for (const row of of(`crouch walk ${name}`)) expect(row.gait).toBe(`crouch_${name}`);
    }
    for (const [state, upper] of [['crouched ADS', 'ads'], ['crouched fire', 'fire'], ['crouched reload', 'reload']]) {
      expect(counts[state]).toBeGreaterThanOrEqual(2);
      expect(of(state)).toHaveLength(counts[state] * PITCHES.length);
      for (const row of of(state)) expect([row.gait, row.upper]).toEqual(['crouch_idle', upper]);
    }
    for (const stance of ['standing', 'crouched']) for (const [name, , ticks] of TURNS)
      expect(of(`${stance}, ${name}`)).toHaveLength(ticks * PITCHES.length);
  });

  it('measures a lean that is on: the handler turns the crouched source by its constant at a level view', () => {
    for (const state of CROUCHED) {
      const level = of(state).filter(row => row.pitch === 0 || Math.abs(row.pitch) < 0.05);
      expect(level.length).toBeGreaterThan(0);
      for (const row of level) expect(row.applied, state).toBeGreaterThan(0.1);
    }
    for (const row of of('standing')) expect(row.applied).toBe(0);
  });

  it.each(CROUCHED)('%s: every bone of the body view is where the lean undone puts it', state => {
    const at = of(state), most = worst(at, row => row.difference);
    expect(at.length).toBeGreaterThan(0);
    expect(most.difference, `${most.differs} at pitch ${most.pitch}`).toBeLessThanOrEqual(LIMIT.bone);
  });

  it.each(STILL)('%s: the eye is inside no closed mesh of the body view', state => {
    const held = of(state).filter(row => row.inside.length);
    expect(held.map(row => `pitch ${row.pitch}: ${row.inside.join(', ')}`).slice(0, 5)).toEqual([]);
  });

  it('finds closed meshes to test: the fabric torso and both chest plates', () => {
    const closed = figures.meshes.filter(part => part.closed).map(part => part.name);
    for (const name of ['ChestPlate', 'LowerChestPlate']) expect(closed).toContain(name);
    expect(closed.some(name => name.startsWith('Anatomical_human_topology'))).toBe(true);
  });

  it('places a vertex where the skinning of three places it', () => {
    const { rig, camera } = lastPlayer, vector = new THREE.Vector3();
    let largest = 0, checked = 0;
    for (const part of drawnParts(rig)) {
      part.mesh.skeleton.update();
      const at = skin(part, camera.position);
      for (let i = 0; i < part.vertices.length; i += 37) {
        const vertex = part.vertices[i];
        part.mesh.getVertexPosition(vertex, vector).applyMatrix4(part.mesh.matrixWorld).sub(camera.position);
        largest = Math.max(largest, Math.hypot(vector.x - at[vertex * 3], vector.y - at[vertex * 3 + 1], vector.z - at[vertex * 3 + 2]));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(largest).toBeLessThanOrEqual(LIMIT.skinning);
  });

  it('control: an eye 2 mm under the chest plate is found inside it, 2 mm over it outside, and on it the clearance is zero', () => {
    const { rig, camera } = lastPlayer, plate = drawnParts(rig).find(part => part.name === 'ChestPlate');
    const at = skin(plate, new THREE.Vector3()), corner = i => new THREE.Vector3(at[i * 3], at[i * 3 + 1], at[i * 3 + 2]);
    // The largest triangle of the plate; its front face looks out of the closed mesh.
    let largest = null;
    for (let t = 0; t < plate.index.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map(j => corner(plate.index[t + j])), normal = b.clone().sub(a).cross(c.clone().sub(a));
      if (!largest || normal.length() > largest.normal.length()) largest = { centre: a.add(b).add(c).divideScalar(3), normal };
    }
    const out = largest.normal.clone().normalize();
    const under = surfaces(rig, camera, largest.centre.clone().addScaledVector(out, -0.002));
    const over = surfaces(rig, camera, largest.centre.clone().addScaledVector(out, 0.002));
    expect(under.inside.some(name => name.startsWith('ChestPlate'))).toBe(true);
    expect(over.inside.some(name => name.startsWith('ChestPlate'))).toBe(false);
    expect(under.clearance).toBeCloseTo(0.002, 6);
    expect(over.clearance).toBeCloseTo(0.002, 6);
    expect(surfaces(rig, camera, largest.centre).clearance).toBeLessThan(1e-9);
  });

  it('control: a body view that takes the leaned pose differs from the lean undone', () => {
    // The same comparison on one settled crouched frame, with the four bones of the body view set by
    // hand: first to what the handler saved (the lean undone), then to the source's leaned rotations.
    const player = livePlayer();
    for (const tick of repeat(30, {})) frame(player, tick);
    for (const tick of repeat(120, { crouching: true })) frame(player, tick);
    const row = frame(player, { dt: DT, state: 'control', crouching: true });
    const { rig, actor } = player, owner = owner3p();
    const viewBone = name => rig.bodyPairs.find(([, node]) => node.name === name)[1];
    for (const name of LEAN_BONES) viewBone(name).quaternion.copy(owner.corrections.get(bone(actor.mesh, name)));
    rig.body.updateMatrixWorld(true);
    const undone = matricesOf(rig);
    for (const name of LEAN_BONES) viewBone(name).quaternion.copy(bone(actor.mesh, name).quaternion);
    rig.body.updateMatrixWorld(true);
    const leaned = matricesOf(rig);
    expect(row.applied).toBeGreaterThan(0.1);
    expect(Math.max(...leaned.map((value, i) => Math.abs(value - undone[i])))).toBeGreaterThan(1000 * LIMIT.bone);
  }, SLOW);

  it('records the clearance of the eye from the drawn body view, still and turning', () => {
    for (const row of rows) expect(Number.isFinite(row.clearance) && row.clearance >= 0, row.state).toBe(true);
    for (const state of STILL) expect(figures.clearance[state]).toHaveLength(PITCHES.length);
    for (const state of Object.keys(figures.turning)) expect(figures.turning[state]).toHaveLength(PITCHES.length);
  });
});

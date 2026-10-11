import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

vi.mock('../scene.js', () => ({ scene: new THREE.Scene() }));
vi.mock('../materials.js', () => ({ mm: (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness }) }));
vi.mock('./enemyWeapon.js', () => ({ attachEnemyWeapon: vi.fn() }));
vi.mock('./weaponFBX.js', () => ({ attachWeapons3pToHand: vi.fn() }));
import * as glb from './enemyGLTF.js';
import * as driver from './enemyAnimations.js';
import { PRESENTATION_LIMITS } from './animationPresentation.js';

// Guard for Amendment 2 of plan 07-38, decision F: a crouched character that turns on the spot keeps
// its crouched legs. When the aim has twisted more than the foot-turn threshold from planted feet, the
// presentation names a foot turn of 0.4 s. Both turn clips are the held frame of the standing idle, so
// a crouched actor stood up on its legs for each turn (pelvis 0.47 m to 0.877 m above the root). The
// driver now leaves the crouched locomotion on the leg layer while the pose is crouching.
// The real actor out of buildEnemyMesh is driven through tickPresentation and finishPresentation, its
// root turned to the body yaw as src/loop.js turns it. Heights are above the root. A knee offset is the
// distance of the knee in front of the hip to ankle line, along the direction the feet face.
// The crouch limits are those of src/builders/liveClipRoute.test.js; the pelvis band was fixed in the
// amendment from the measured crouch (0.47 m). None is loosened here.
const LIMIT = Object.freeze({
  pelvisBand: [0.465, 0.525], // metres above the root on every tick of a crouched turn
  crouchPelvis: 0.55, crouchKnee: 0.12, lowestFoot: -0.03, // metres, as in the route guard
  standingPelvis: 0.85, // a standing pelvis is above this
});
const DT = 1 / 60;
const BREATH_START = 0.875; // seconds into the breathing layer; the builder starts it at a random time
const SIDES = ['l', 'r'];
const CROUCH_LOWER = 'live_crouch_idle_lower';
// The view turning: one twist of 1 rad held, 1 and 3 rad/s one way, and 4 rad/s reversing every 0.5 s.
const TURNS = [['one twist of 1 rad', seconds => (seconds === 0 ? 1 / DT : 0), 60], ['turning 1 rad/s', () => 1, 120],
  ['turning 3 rad/s', () => 3, 120], ['swinging 4 rad/s', seconds => (Math.floor(seconds * 2 + 1e-9) % 2 ? -4 : 4), 120]];

let gltf, log;
const runs = {}, figures = { limits: LIMIT, footTurnThreshold: PRESENTATION_LIMITS.footTurn, runs: {} };

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
  vi.stubGlobal('fetch', async () => ({ ok: true }));
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  try { expect(await glb.tryLoadEnemyGLTF()).toBe(true); } finally { load.mockRestore(); vi.unstubAllGlobals(); }
  for (const stance of ['crouched', 'standing']) for (const [name, rate, ticks] of TURNS)
    runs[`${stance}, ${name}`] = play(stance === 'crouched', rate, ticks);
  for (const [name, rows] of Object.entries(runs)) figures.runs[name] = {
    ticks: rows.length, turnTicks: rows.filter(row => row.turn).length,
    lower: [...new Set(rows.flatMap(row => row.lower))],
    pelvis: [Math.min(...rows.map(row => row.pelvis)), Math.max(...rows.map(row => row.pelvis))],
    knee: Math.min(...rows.flatMap(row => [row.knee.l, row.knee.r])), lowestFoot: Math.min(...rows.map(row => row.lowestFoot)),
    largestFeetLag: Math.max(...rows.map(row => Math.abs(row.feetLag))) };
});
afterAll(() => {
  log.mockRestore();
  // Optional: the figures, and every bone of every tick, as files. Nothing reads them back here.
  if (env.FOOT_TURN_FIGURES) writeFileSync(env.FOOT_TURN_FIGURES, JSON.stringify(figures, null, 1));
  if (env.FOOT_TURN_BONES) writeFileSync(env.FOOT_TURN_BONES, JSON.stringify(Object.fromEntries(
    Object.entries(runs).map(([name, rows]) => [name, rows.map(row => row.bones)]))));
});

/** Pelvis, knees and feet of an actor above its root, the legs measured along the direction the feet face. */
function measure(mesh, feetYaw) {
  mesh.updateMatrixWorld(true);
  const root = mesh.getWorldPosition(new THREE.Vector3());
  const position = name => mesh.getObjectByName(name).getWorldPosition(new THREE.Vector3()).sub(root);
  const ahead = new THREE.Vector3(-Math.sin(feetYaw), 0, -Math.cos(feetYaw)); // the look direction of a yaw (src/loop.js)
  const out = { pelvis: position('pelvis').y, knee: {} };
  const heights = [];
  for (const side of SIDES) {
    const hip = position(`thigh_${side}`), knee = position(`calf_${side}`), ankle = position(`foot_${side}`);
    const line = ankle.clone().sub(hip), along = knee.clone().sub(hip).dot(line) / line.lengthSq();
    out.knee[side] = knee.clone().sub(hip.clone().addScaledVector(line, along)).dot(ahead);
    heights.push(ankle.y, position(`ball_${side}`).y);
  }
  out.lowestFoot = Math.min(...heights);
  return out;
}
/** 90 settled ticks, then `ticks` with the view turning; one row per turning tick. */
function play(crouching, rate, ticks) {
  const { mesh, mixer, actions } = glb.buildEnemyMesh(0, 0, 'assault'), actor = { mesh, mixer, actions }, bones = [];
  actions._breathing.time = BREATH_START;
  mesh.traverse(node => { if (node.isBone) bones.push(node); });
  let time = 0, yaw = 0;
  const tick = () => {
    time += DT;
    mesh.rotation.y = yaw + Math.PI;
    driver.tickPresentation(actor, { identity: 'foot-turn', generation: 0, sampleTimeSeconds: time,
      position: { x: 0, y: 0, z: 0 }, bodyYaw: yaw, aimYaw: yaw, pitch: 0, alive: true, onGround: true,
      weapon: 'm4', crouching }, DT, false);
    driver.finishPresentation(actor, DT);
    return actor.presentation;
  };
  for (let i = 0; i < 90; i++) tick();
  const rows = [];
  for (let i = 0; i < ticks; i++) {
    yaw += rate(i * DT) * DT;
    const pose = tick(), feetLag = Math.atan2(Math.sin(pose.feetYaw - pose.bodyYaw), Math.cos(pose.feetYaw - pose.bodyYaw));
    rows.push({ turn: pose.turn, crouching: pose.crouching, feetLag,
      lower: driver.inspectPresentationLayers(actor).filter(layer => layer.scheduled && layer.weight > 0.01 && layer.clip.endsWith('_lower')).map(layer => layer.clip),
      ...measure(mesh, pose.feetYaw), bones: bones.flatMap(node => node.quaternion.toArray().map(value => +value.toFixed(9))) });
  }
  return rows;
}
const crouched = TURNS.map(([name]) => `crouched, ${name}`), standing = TURNS.map(([name]) => `standing, ${name}`);

describe('a crouched character turning on the spot', () => {
  it.each(crouched)('%s: the presentation names foot turns, so the case exercises one', name => {
    const rows = runs[name];
    expect(rows.every(row => row.crouching)).toBe(true);
    expect(rows.filter(row => row.turn).length, 'ticks with a foot turn').toBeGreaterThanOrEqual(10);
    expect(Math.max(...rows.map(row => Math.abs(row.feetLag))), 'largest feet lag').toBeGreaterThan(PRESENTATION_LIMITS.footTurn);
  });

  it.each(crouched)('%s: the crouched idle is the only leg layer on every tick', name => {
    runs[name].forEach((row, tick) => expect(row.lower, `tick ${tick}, turn "${row.turn}"`).toEqual([CROUCH_LOWER]));
  });

  it.each(crouched)('%s: the pelvis stays in the crouch band on every tick', name => {
    runs[name].forEach((row, tick) => {
      expect(row.pelvis, `tick ${tick}, turn "${row.turn}"`).toBeGreaterThanOrEqual(LIMIT.pelvisBand[0]);
      expect(row.pelvis, `tick ${tick}, turn "${row.turn}"`).toBeLessThanOrEqual(LIMIT.pelvisBand[1]);
      expect(row.pelvis).toBeLessThanOrEqual(LIMIT.crouchPelvis);
    });
  });

  it.each(crouched)('%s: both knees stay forward and no foot goes under the floor', name => {
    runs[name].forEach((row, tick) => {
      for (const side of SIDES) expect(row.knee[side], `tick ${tick}: knee ${side}`).toBeGreaterThanOrEqual(LIMIT.crouchKnee);
      expect(row.lowestFoot, `tick ${tick}: lowest foot`).toBeGreaterThanOrEqual(LIMIT.lowestFoot);
    });
  });
});

describe('a standing character turning on the spot', () => {
  it.each(standing)('%s: the foot turn still plays on the leg layer and the pelvis stays standing', name => {
    const rows = runs[name], turning = rows.filter(row => row.turn);
    expect(rows.every(row => !row.crouching)).toBe(true);
    expect(turning.length).toBeGreaterThanOrEqual(10);
    for (const row of turning) expect(row.lower, `turn "${row.turn}"`).toEqual([`live_${row.turn}_lower`]);
    for (const row of rows) expect(row.pelvis).toBeGreaterThan(LIMIT.standingPelvis);
  });
});

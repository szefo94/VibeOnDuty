import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HEAD_BOB_PITCH, PLAYER_H, PLAYER_H_CROUCH } from '../config.js';

vi.mock('../scene.js', () => ({ scene: new THREE.Scene() }));
vi.mock('../materials.js', () => ({ mm: (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness }) }));
vi.mock('./enemyWeapon.js', () => ({ attachEnemyWeapon: vi.fn() }));
vi.mock('./weaponFBX.js', () => ({ attachWeapons3pToHand: vi.fn() }));
import * as glb from './enemyGLTF.js';
import * as driver from './enemyAnimations.js';
import * as view from './firstPersonRig.js';

// Guard for owner item H-13 (plan 07-28): looking down in first person showed the character's back.
// The real player actor and its real first-person rig are driven as src/loop.js drives them. A
// distance is the eye minus the body view's spine_03 bone along the body's forward axis, in metres:
// positive means the eye is in front of the chest. The limits in metres and radians were fixed in
// the plan from measurement, before this file existed, and are never loosened here.
const LIMIT = Object.freeze({
  nearest: 0.10, farthest: 0.60, // eye in front of the chest
  level: -0.18, levelTolerance: 0.001, // body offset at a level view, as before this plan
  step: 0.05, stepChange: 0.03, // radians between neighbouring samples; largest change of the offset
  exact: 1e-9, // numeric tolerance of an equality: the arms formula, an offset that must not differ
});
const DEG = 180 / Math.PI;
const DT = 1 / 60;
// player.pitch is clamped to this in src/main.js (mouse), src/loop.js (touch) and
// src/network/onlineSession.js; offline the camera adds the head bob to it (src/entities/player.js).
const PITCH_LIMIT = 1.38;
const LOWEST_CAMERA_PITCH = -(PITCH_LIMIT + HEAD_BOB_PITCH * 1.4);
const PITCHES = [0, -0.4, -0.8, -1.1, -1.3, -PITCH_LIMIT, LOWEST_CAMERA_PITCH];
const PANEL_PITCH = -1.3; // the review panel's "Looking down" view (src/dev/animationReview.js)
const STANCES = ['standing', 'crouched'];
const YAWS = [0, 90, 180, 270];
const CASES = STANCES.flatMap(stance => YAWS.map(yaw => [stance, yaw]));
const EYE = { standing: PLAYER_H, crouched: PLAYER_H_CROUCH }; // eyeH of src/loop.js
const ROOT = new THREE.Vector3(3.25, 0.5, -7.75); // away from the origin, so no check passes by a zero
const BREATH_START = 0.875; // seconds into the breathing layer; the builder starts it at a random time
const RELOAD_SECONDS = 1.8, PHASES = 12;
// Owner item H-01. The online collector levels the view of the client that films the other one
// (tools/art/moving-online.mjs, aim: movementY = pitch / MOUSE_SENS); the client that reloads had
// pitch 0.423 in all three tiers of evidence/07-motion-review.json (online.observations, seen.reload).
const COLLECTOR_PITCHES = [0, 0.423];
// The offset this plan withdraws: it moved the body forward under the camera as the pitch went down.
const withdrawnOffset = pitch => -0.18 + 0.43 * Math.max(0, Math.min(1, -pitch / 1.1));

let gltf, log;
const runs = new Map(), figures = { limits: LIMIT, pitches: PITCHES, runs: {}, reload: {} };

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
  for (const [stance, yaw] of CASES) {
    runs.set(`${stance}/${yaw}`, play(stance, yaw));
    figures.runs[`${stance}/${yaw}`] = runs.get(`${stance}/${yaw}`);
  }
});
afterAll(() => {
  log.mockRestore();
  // Optional: the measured figures as a file, for the plan summary. Nothing reads it back.
  if (env.LOOK_DOWN_FIGURES) writeFileSync(env.LOOK_DOWN_FIGURES, JSON.stringify(figures, null, 2));
});

// ── The live player and its view ──────────────────────────────────────────
/** The player actor and the first-person rig that live play builds; one at a time, as in the game. */
function livePlayer() {
  expect(glb.buildPlayerMesh()).toBe(true);
  const actor = { mesh: glb.playerMesh, mixer: glb.playerMixer, actions: glb.playerActions };
  actor.actions._breathing.time = BREATH_START;
  return { actor, rig: glb.playerFirstPersonRig };
}
const viewBone = (rig, name) => rig.bodyPairs.find(([, bone]) => bone.name === name)[1];
const armBone = (rig, name) => rig.armPairs.find(([, bone]) => bone.name === name)[1];
const world = node => node.getWorldPosition(new THREE.Vector3());
/** The eye in front of a bone of the body view, along the body's forward axis, in metres. */
function ahead(rig, camera, name) {
  rig.body.updateMatrixWorld(true);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.body.getWorldQuaternion(new THREE.Quaternion()));
  return camera.position.clone().sub(world(viewBone(rig, name))).dot(forward);
}
/** What the arms formula of updateFirstPersonRig gives from the camera and the eye height alone. */
function armsFormula(rig, camera, eyeHeight) {
  rig.arms.updateMatrixWorld(true);
  const placed = camera.position.clone().add(new THREE.Vector3(0, -eyeHeight, -0.25).applyQuaternion(camera.quaternion));
  // The shoulder centre keeps its place against the view root when the root is translated.
  const centre = world(armBone(rig, 'upperarm_l')).add(world(armBone(rig, 'upperarm_r'))).multiplyScalar(0.5)
    .sub(world(rig.arms)).add(placed);
  const local = centre.sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
  return placed.add(new THREE.Vector3(0, -0.22 - local.y, 0).applyQuaternion(camera.quaternion));
}

/**
 * One stance at one yaw, as src/loop.js runs a frame: body root under the eye and turned to the
 * look direction, the presentation driver with the same pitch, then updateFirstPersonRig with the
 * camera. `action` adds an upper body action at 12 phases of its own for every pitch of `pitches`.
 */
function play(stance, yawDegrees, action = null, pitches = PITCHES) {
  const yaw = yawDegrees / DEG, { actor, rig } = livePlayer();
  const camera = new THREE.PerspectiveCamera(75, 4 / 3, 0.1, 100);
  actor.mesh.position.copy(ROOT); actor.mesh.rotation.y = yaw + Math.PI;
  let time = 0, crouching = false;
  const frame = (pitch, more = {}) => {
    time += DT;
    camera.position.copy(ROOT).add(new THREE.Vector3(0, crouching ? EYE.crouched : EYE.standing, 0));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    driver.tickPresentation(actor, { identity: 'local', generation: 0, sampleTimeSeconds: time,
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      bodyYaw: yaw, aimYaw: yaw, pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch)),
      crouching, onGround: true, weapon: 'm4', alive: true, ...more }, DT, false);
    driver.finishPresentation(actor, DT);
    const before = { source: rig.source.position.clone(), turn: rig.source.quaternion.clone(),
      eye: camera.position.clone(), look: camera.quaternion.clone() };
    view.updateFirstPersonRig(rig, { pose: actor.presentation, camera, dt: DT, active: true, thirdPerson: false,
      spineQuaternion: actor._presentationCorrection?.get(actor.mesh.getObjectByName('spine_03')),
      eyeHeight: PLAYER_H });
    const offset = rig.body.position.clone().sub(rig.source.position).applyQuaternion(rig.source.quaternion.clone().invert());
    const sample = { pitch, chest: ahead(rig, camera, 'spine_03'), neck: ahead(rig, camera, 'neck_01'),
      offset: offset.z, offsetAside: Math.hypot(offset.x, offset.y),
      sourceMoved: rig.source.position.distanceTo(before.source), sourceTurned: !rig.source.quaternion.equals(before.turn),
      cameraMoved: camera.position.distanceTo(before.eye), cameraTurned: !camera.quaternion.equals(before.look),
      bodyTurned: !rig.body.quaternion.equals(rig.source.quaternion), bodyScaled: rig.body.scale.distanceTo(rig.source.scale),
      armsFromFormula: world(rig.arms).distanceTo(armsFormula(rig, camera, PLAYER_H)),
      upper: actor.presentation.upper, gait: actor.presentation.gait.map(entry => entry.key).join('+') };
    // The same pose under the withdrawn offset, measured the same way, then put back.
    const kept = rig.body.position.clone();
    rig.body.position.copy(rig.source.position).add(new THREE.Vector3(0, 0, withdrawnOffset(pitch)).applyQuaternion(rig.source.quaternion));
    sample.withdrawnChest = ahead(rig, camera, 'spine_03');
    rig.body.position.copy(kept); rig.body.updateMatrixWorld(true);
    return sample;
  };
  // Standing first; a crouch is pressed from standing and 120 frames let its inertia expire by itself.
  for (let i = 0; i < 30; i++) frame(0);
  if (stance === 'crouched') { crouching = true; for (let i = 0; i < 120; i++) frame(0); }
  if (action) return pitches.map(pitch => Array.from({ length: PHASES }, (_, i) =>
    frame(pitch, { action: { ...action, elapsed: action.total * i / PHASES } })));
  const samples = PITCHES.map(pitch => frame(pitch));
  // Every pitch the camera can have, 0.05 rad apart, from the highest to the lowest.
  const sweep = [];
  for (let pitch = -LOWEST_CAMERA_PITCH; pitch > LOWEST_CAMERA_PITCH; pitch -= LIMIT.step) sweep.push(frame(pitch));
  sweep.push(frame(LOWEST_CAMERA_PITCH));
  return { stance, yaw: yawDegrees, eyeHeight: EYE[stance], samples, sweep };
}
const every = run => [...run.samples, ...run.sweep];
const at = (run, pitch) => run.samples.find(sample => sample.pitch === pitch);

describe('first-person look-down view on the real rig', () => {
  it('poses the live player standing and in the composed crouch', () => {
    for (const [stance, yaw] of CASES) {
      const run = runs.get(`${stance}/${yaw}`);
      expect(run.samples.map(sample => sample.pitch)).toEqual(PITCHES);
      expect(run.sweep.length).toBeGreaterThan(50);
      for (const sample of every(run)) {
        expect(sample.gait, `${stance}, yaw ${yaw}`).toBe(stance === 'crouched' ? 'crouch_idle' : 'm4_ready');
        expect(sample.upper).toBe('ready');
      }
    }
    // The pose itself, level view: the chest of the composed crouch is over the root, where the standing
    // chest is (plan 07-34; under plan 07-27 it was 0.235 m behind the root).
    const standing = at(runs.get('standing/0'), 0), crouched = at(runs.get('crouched/0'), 0);
    expect(-standing.offset - standing.chest, 'standing chest in front of the root').toBeCloseTo(-0.005, 2);
    expect(-crouched.offset - crouched.chest, 'crouched chest in front of the root').toBeCloseTo(-0.005, 2);
  });

  it.each(CASES)('%s, yaw %i: the eye stays at least 0.10 m in front of the chest at every pitch', (stance, yaw) => {
    for (const sample of every(runs.get(`${stance}/${yaw}`)))
      expect(sample.chest, `pitch ${sample.pitch.toFixed(2)}`).toBeGreaterThanOrEqual(LIMIT.nearest);
  });

  it.each(CASES)('%s, yaw %i: the eye is never more than 0.60 m in front of the chest', (stance, yaw) => {
    for (const sample of every(runs.get(`${stance}/${yaw}`)))
      expect(sample.chest, `pitch ${sample.pitch.toFixed(2)}`).toBeLessThanOrEqual(LIMIT.farthest);
  });

  it.each(CASES)('%s, yaw %i: a level view keeps the body offset it had', (stance, yaw) => {
    const level = at(runs.get(`${stance}/${yaw}`), 0);
    expect(Math.abs(level.offset - LIMIT.level)).toBeLessThanOrEqual(LIMIT.levelTolerance);
  });

  it.each(CASES)('%s, yaw %i: the body offset is continuous in pitch', (stance, yaw) => {
    const { sweep } = runs.get(`${stance}/${yaw}`);
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i - 1].pitch - sweep[i].pitch).toBeLessThanOrEqual(LIMIT.step + 1e-12);
      expect(Math.abs(sweep[i].offset - sweep[i - 1].offset), `pitch ${sweep[i].pitch.toFixed(2)}`).toBeLessThan(LIMIT.stepChange);
    }
  });

  it.each(STANCES)('%s: the body offset does not depend on yaw', stance => {
    const reference = every(runs.get(`${stance}/0`));
    for (const yaw of YAWS.slice(1)) every(runs.get(`${stance}/${yaw}`)).forEach((sample, i) => {
      expect(sample.pitch).toBe(reference[i].pitch);
      expect(Math.abs(sample.offset - reference[i].offset), `yaw ${yaw}, pitch ${sample.pitch.toFixed(2)}`).toBeLessThanOrEqual(LIMIT.exact);
      expect(Math.abs(sample.chest - reference[i].chest), `yaw ${yaw}, pitch ${sample.pitch.toFixed(2)}`).toBeLessThanOrEqual(1e-6);
    });
  });

  it.each(CASES)('%s, yaw %i: the update moves the body view only, and only along its forward axis', (stance, yaw) => {
    for (const sample of every(runs.get(`${stance}/${yaw}`))) {
      const label = `pitch ${sample.pitch.toFixed(2)}`;
      expect(sample.sourceMoved, `${label}: source position`).toBe(0);
      expect(sample.sourceTurned, `${label}: source rotation`).toBe(false);
      expect(sample.cameraMoved, `${label}: camera position`).toBe(0);
      expect(sample.cameraTurned, `${label}: camera rotation`).toBe(false);
      expect(sample.armsFromFormula, `${label}: arms view against its formula`).toBeLessThanOrEqual(LIMIT.exact);
      expect(sample.offsetAside, `${label}: body offset off its forward axis`).toBeLessThanOrEqual(LIMIT.exact);
      expect(sample.bodyTurned, `${label}: body view rotation`).toBe(false);
      expect(sample.bodyScaled, `${label}: body view scale`).toBe(0);
    }
  });

  it('control: the withdrawn forward term puts the eye behind the standing chest and too near the crouched one', () => {
    for (const yaw of YAWS) {
      const standing = runs.get(`standing/${yaw}`), crouched = runs.get(`crouched/${yaw}`);
      expect(at(standing, PANEL_PITCH).withdrawnChest, `standing, yaw ${yaw}`).toBeLessThan(0);
      expect(at(standing, -PITCH_LIMIT).withdrawnChest, `standing, yaw ${yaw}`).toBeLessThan(0);
      expect(at(crouched, -PITCH_LIMIT).withdrawnChest, `crouched, yaw ${yaw}`).toBeLessThan(LIMIT.nearest);
      // A level view was never the defect.
      expect(at(standing, 0).withdrawnChest).toBeGreaterThanOrEqual(LIMIT.nearest);
    }
  });
});

describe('figures for the summary', () => {
  it('measures the reload pose for owner item H-01 and asserts no limit on it', () => {
    const pitches = [...COLLECTOR_PITCHES, ...PITCHES.slice(1)];
    for (const stance of STANCES) {
      const phases = play(stance, 0, { kind: 'reload', total: RELOAD_SECONDS }, pitches);
      figures.reload[stance] = pitches.map((pitch, i) => ({ pitch,
        chest: [Math.min(...phases[i].map(sample => sample.chest)), Math.max(...phases[i].map(sample => sample.chest))],
        withdrawnChest: [Math.min(...phases[i].map(sample => sample.withdrawnChest)),
          Math.max(...phases[i].map(sample => sample.withdrawnChest))],
        neck: [Math.min(...phases[i].map(sample => sample.neck)), Math.max(...phases[i].map(sample => sample.neck))] }));
      for (const samples of phases) {
        expect(samples).toHaveLength(PHASES);
        for (const sample of samples) expect(sample.upper).toBe('reload');
      }
    }
    expect(Object.keys(figures.reload)).toEqual(STANCES);
  });
});

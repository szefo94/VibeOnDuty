import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import manifest from '../../tools/art/motion-manifest.json';

vi.mock('../scene.js', () => ({ scene: new THREE.Scene() }));
vi.mock('../materials.js', () => ({ mm: (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness }) }));
vi.mock('./enemyWeapon.js', () => ({ attachEnemyWeapon: vi.fn() }));
vi.mock('./weaponFBX.js', () => ({ attachWeapons3pToHand: vi.fn() }));
import * as glb from './enemyGLTF.js';
import * as driver from './enemyAnimations.js';
import { RIFLE_MOVEMENT_CLIPS } from './rifleClips.js';

// Guards on the real skeleton for the pose live play shows after the driver ran (plan 07-27).
// Character forward is +Z; "weapon forward" is the +Y axis of hand_r in the character frame; a knee
// offset is the distance of the knee from the hip to ankle line along +Z. Every limit below was
// fixed in the plan from measurement, before this file existed, and is never loosened here.
const LIMIT = Object.freeze({
  weaponYaw: 3.5, weaponYawRange: 6.3, weaponPitch: 2.5, spineYaw: 3.5, // degrees
  kneeForward: 0.06, crouchKnee: 0.15, crouchPelvis: 0.55, standingPelvis: 0.85, // metres
  ankleFromInherited: 0.03, crouchBall: 0.03, idleBall: 0.05, lowestFoot: -0.03,
  stillFoot: 1e-6, upperBone: 1e-6,
  // The blocked-feet browser test (tests/animation-presentation.spec.js) allows a foot bone
  // quaternion component to change by less than this over 8 frames.
  plantedFootTurn: 0.001,
});
const DEG = 180 / Math.PI;
const SIDES = ['l', 'r'];
const LOWER_TRACKS = ['pelvis.position', 'pelvis.quaternion', 'thigh_l.quaternion', 'thigh_r.quaternion',
  'calf_l.quaternion', 'calf_r.quaternion', 'foot_l.quaternion', 'foot_r.quaternion',
  'ball_l.quaternion', 'ball_r.quaternion'];
const LEGACY_KEYS = ['idle', 'walk', 'run', 'attack', 'shoot', 'crouch', 'crouch_walk', 'death', 'hit', 'roll',
  'jump_start', 'jump_loop', 'jump_land', 'reload', 'run_back', 'walk_back', 'strafe_l', 'strafe_r', 'nade',
  'dance', 'punch_cross', 'punch_jab'];
const KEYS = [...new Set([...LEGACY_KEYS, ...manifest.actions.map(action => action.id)])];
const BREATH_START = 0.875; // seconds into the breathing layer, so both actors breathe in step

let gltf, prepared, live, upperBones, log;
const named = name => prepared.animations.find(clip => clip.name === name);
const findLive = (key, weapon) => glb.findLiveClip?.(prepared.animations, key, weapon);
const findAuthored = (key, weapon) => glb.findMotionClip(prepared.animations, key, weapon);

beforeAll(async () => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const data = readFileSync('public/models/enemy.glb');
  // Node-only image isolation, as in enemyGLTF.test.js. Browser suites decode the real maps.
  vi.stubGlobal('self', globalThis);
  const images = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    const texture = new THREE.Texture(); queueMicrotask(() => onLoad(texture)); return texture;
  });
  try {
    gltf = await new GLTFLoader().parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  } finally { images.mockRestore(); vi.unstubAllGlobals(); }
  // The builders read their template through tryLoadEnemyGLTF: hand it the parsed asset, so the
  // composed actors below come out of the real buildEnemyMesh.
  vi.stubGlobal('fetch', async () => ({ ok: true }));
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  try { expect(await glb.tryLoadEnemyGLTF()).toBe(true); } finally { load.mockRestore(); vi.unstubAllGlobals(); }
  // The same preparation again, for clip level checks and for the actors of before this plan.
  prepared = glb.prepareEnemyClips(gltf);
  live = typeof glb.buildLiveClips === 'function'
    ? glb.buildLiveClips(prepared.scene, prepared.animations) : new Map();
  // The bones the driver's own upper mask covers.
  const bones = [];
  gltf.scene.traverse(node => { if (node.isBone) bones.push(node.name); });
  upperBones = driver.copyPresentationMask(new THREE.AnimationClip('probe', 1, bones.map(name =>
    new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, [0], [0, 0, 0, 1]))), true)
    .tracks.map(track => track.name.replace('.quaternion', ''));
});
afterAll(() => log.mockRestore());

// ── Actors ────────────────────────────────────────────────────────────────
/** Out of the real builder: whatever live play selects on this source. */
function builtActor(role = 'assault') {
  const { mesh, mixer, actions } = glb.buildEnemyMesh(0, 0, role);
  actions._breathing.time = BREATH_START; // the builder starts it at a random time
  return { mesh, mixer, actions };
}
/** The same action map made from any resolver; `findAuthored` gives the actor of before this plan. */
function actorFrom(resolve) {
  const mesh = skeletonClone(gltf.scene), mixer = new THREE.AnimationMixer(mesh), actions = {};
  for (const key of KEYS) { const clip = resolve(key); if (clip) actions[key] = mixer.clipAction(clip); }
  const breathing = mixer.clipAction(driver.buildGLTFBreathingClip());
  breathing.blendMode = THREE.AdditiveAnimationBlendMode;
  breathing.time = BREATH_START; breathing.setEffectiveWeight(0.75); breathing.play();
  actions._breathing = breathing;
  return { mesh, mixer, actions };
}
const authoredActor = () => actorFrom(key => findAuthored(key));

/** One observed simulation for several actors: identical observations, frame by frame. */
function simulation(actors) {
  let time = 0, x = 0, z = 0;
  return (frames, dt, more = {}, velocity = [0, 0], each = null) => {
    let pose;
    for (let i = 0; i < frames; i++) {
      time += dt; x += velocity[0] * dt; z += velocity[1] * dt;
      for (const actor of actors) pose = driver.tickPresentation(actor, { identity: 'guard', generation: 0,
        sampleTimeSeconds: time, position: { x, y: 0, z }, bodyYaw: 0, aimYaw: 0, pitch: 0, alive: true,
        onGround: true, weapon: 'm4', ...more }, dt);
      each?.(pose, i);
    }
    return pose;
  };
}

// ── Measurement ───────────────────────────────────────────────────────────
/** A clip alone on a fresh skeleton, held at one time. */
function sampleClip(clip, time) {
  const mesh = skeletonClone(gltf.scene), mixer = new THREE.AnimationMixer(mesh);
  const action = mixer.clipAction(clip);
  action.play(); action.time = time; action.setEffectiveTimeScale(0); mixer.update(0);
  return mesh;
}
function measure(mesh) {
  mesh.updateMatrixWorld(true);
  const position = name => mesh.getObjectByName(name).getWorldPosition(new THREE.Vector3());
  const rotation = name => mesh.getObjectByName(name).getWorldQuaternion(new THREE.Quaternion());
  const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation('hand_r'));
  const out = { weaponYaw: Math.atan2(forward.x, forward.z) * DEG, weaponPitch: Math.asin(forward.y) * DEG,
    spineYaw: new THREE.Euler().setFromQuaternion(rotation('spine_03'), 'YXZ').y * DEG,
    pelvis: position('pelvis').y, head: position('Head'), chest: position('spine_03'),
    knee: {}, ankle: {}, ball: {}, upper: {},
    feet: SIDES.map(side => mesh.getObjectByName(`foot_${side}`).quaternion.toArray()) };
  for (const side of SIDES) {
    const hip = position(`thigh_${side}`), knee = position(`calf_${side}`), ankle = position(`foot_${side}`);
    const line = ankle.clone().sub(hip), along = knee.clone().sub(hip).dot(line) / line.lengthSq();
    out.knee[side] = knee.clone().sub(hip.clone().addScaledVector(line, along)).z;
    out.ankle[side] = ankle; out.ball[side] = position(`ball_${side}`);
  }
  out.lowestFoot = Math.min(...SIDES.flatMap(side => [out.ankle[side].y, out.ball[side].y]));
  for (const bone of upperBones) out.upper[bone] = mesh.getObjectByName(bone).quaternion.toArray();
  return out;
}
const turn = degrees => Math.atan2(Math.sin(degrees / DEG), Math.cos(degrees / DEG)) * DEG;
/** Weapon and chest direction of one pose against another, in degrees. */
const direction = (pose, reference) => ({ weaponYaw: turn(pose.weaponYaw - reference.weaponYaw),
  weaponPitch: pose.weaponPitch - reference.weaponPitch, spineYaw: turn(pose.spineYaw - reference.spineYaw) });
const withinWeaponLimits = d => Math.abs(d.weaponYaw) <= LIMIT.weaponYaw &&
  Math.abs(d.weaponPitch) <= LIMIT.weaponPitch && Math.abs(d.spineYaw) <= LIMIT.spineYaw;
const upperDifference = (pose, reference) => Math.max(...upperBones.flatMap(bone =>
  pose.upper[bone].map((value, axis) => Math.abs(value - reference.upper[bone][axis]))));
/** Largest movement in metres of an ankle or a ball over a run of measured poses. */
const footTravel = poses => Math.max(...poses.flatMap(pose => SIDES.flatMap(side =>
  [pose.ankle[side].distanceTo(poses[0].ankle[side]), pose.ball[side].distanceTo(poses[0].ball[side])])));
/** Largest change of a foot bone quaternion component over a run, as the browser test measures it. */
const footTurn = poses => Math.max(...poses.flatMap(pose => pose.feet.flatMap((q, foot) =>
  q.map((value, axis) => Math.abs(value - poses[0].feet[foot][axis])))));
/** A standing, still actor: the feet of `frames` frames after `lead` frames. */
function standStill(actor, dt, lead, frames) {
  const run = simulation([actor]), poses = [];
  run(lead, dt);
  run(frames, dt, {}, [0, 0], () => poses.push(measure(actor.mesh)));
  return poses;
}
const constantTrack = track => {
  const width = track.getValueSize();
  return track.times.length === 2 && track.values.length === 2 * width &&
    Array.from(track.values.slice(0, width)).every((value, i) => value === track.values[width + i]);
};

// ── Tracer: one action, crouch, end to end ────────────────────────────────
describe('crouch on the real skeleton, composed, with inertia on', () => {
  let composed, today, layers, pose, before, sequence;
  beforeAll(() => {
    composed = builtActor(); today = authoredActor(); sequence = [];
    const run = simulation([composed, today]);
    const record = presentation => {
      const key = `${composed.currentClip}:${presentation.gait.map(gait => gait.key).join('+')}`;
      if (sequence.at(-1) !== key) sequence.push(key);
    };
    run(30, 1 / 60, {}, [0, 0], record);
    // A crouch press from standing; 120 frames let the inertia of the transition expire by itself.
    run(120, 1 / 60, { crouching: true }, [0, 0], record);
    layers = driver.inspectPresentationLayers(composed);
    pose = measure(composed.mesh); before = measure(today.mesh);
  });

  it('exposes the live route beside an unchanged prepared set', () => {
    expect(glb.buildLiveClips).toBeTypeOf('function');
    expect(glb.findLiveClip).toBeTypeOf('function');
    const names = [...gltf.animations.map(clip => clip.name), ...RIFLE_MOVEMENT_CLIPS.map(name => `rifle_${name}`)];
    expect(names).toHaveLength(112);
    expect(prepared.animations.map(clip => clip.name)).toEqual(names);
    expect(glb.prepareEnemyClips(gltf).animations.map(clip => clip.name)).toEqual(names);
    expect(findAuthored('walk').name).toBe('vod7_walk_forward');
    expect(findAuthored('crouch').name).toBe('vod7_crouch_idle');
    expect(findLive('crouch_idle')?.name).toBe('live_crouch_idle');
    expect(findLive('crouch')).toBe(findLive('crouch_idle'));
    for (const weapon of ['m4', 'p90', 'awp', 'pistol']) {
      expect(findLive(`${weapon}_ready`)?.name).toBe(`live_${weapon}_ready`);
      expect(findLive('idle', weapon)).toBe(findLive(`${weapon}_ready`));
    }
    for (const key of ['attack', 'shoot', 'reload', 'roll', 'dance', 'm4_ads', 'supersprint'])
      expect(findLive(key), key).toBe(findAuthored(key));
    expect([...live.values()].every(clip => !prepared.animations.includes(clip) || !clip.name.startsWith('live_'))).toBe(true);
  });

  it('selects the composed crouch legs under the upper body of the ready clip', () => {
    const lower = layers.find(layer => layer.clip.endsWith('_lower'));
    const upper = layers.find(layer => layer.clip.endsWith('_upper'));
    expect(layers).toHaveLength(2);
    expect(lower.clip).toBe('live_crouch_idle_lower');
    expect([...lower.tracks].sort()).toEqual([...LOWER_TRACKS].sort());
    expect(lower.tracks).toHaveLength(10);
    expect(upper.clip).toBe('live_m4_ready_upper');
    expect(upper.tracks).toEqual(driver.copyPresentationMask(named('vod7_m4_ready'), true).tracks.map(track => track.name));
    expect(lower.weight).toBe(1); expect(upper.weight).toBe(1);
  });

  it('keeps weapon and chest forward and puts the knees, feet and pelvis where a crouch has them', () => {
    const d = direction(pose, before);
    expect(Math.abs(d.weaponYaw), 'weapon yaw against the authored pose').toBeLessThanOrEqual(LIMIT.weaponYaw);
    expect(Math.abs(d.weaponPitch), 'weapon pitch against the authored pose').toBeLessThanOrEqual(LIMIT.weaponPitch);
    expect(Math.abs(d.spineYaw), 'spine_03 yaw against the authored pose').toBeLessThanOrEqual(LIMIT.spineYaw);
    const time = layers.find(layer => layer.clip.endsWith('_lower')).time;
    const inherited = measure(sampleClip(named('rifle_Crouch_Idle_Loop'), time));
    for (const side of SIDES) {
      expect(pose.knee[side], `knee ${side} in front of the hip to ankle line`).toBeGreaterThanOrEqual(LIMIT.crouchKnee);
      expect(pose.ankle[side].y, `ankle ${side}`).toBeGreaterThanOrEqual(LIMIT.lowestFoot);
      expect(pose.ball[side].y, `ball ${side}`).toBeGreaterThanOrEqual(LIMIT.lowestFoot);
      expect(pose.ball[side].y, `ball ${side} planted`).toBeLessThanOrEqual(LIMIT.crouchBall);
      expect(pose.ankle[side].distanceTo(inherited.ankle[side]), `ankle ${side} from the inherited ankle`)
        .toBeLessThanOrEqual(LIMIT.ankleFromInherited);
    }
    expect(pose.pelvis).toBeLessThanOrEqual(LIMIT.crouchPelvis);
  });

  it('leaves every upper body bone where the authored crouched pose has it', () => {
    expect(upperBones).toContain('hand_r'); expect(upperBones).toContain('spine_01');
    expect(upperBones).not.toContain('pelvis'); expect(upperBones).not.toContain('thigh_l');
    expect(upperDifference(pose, before)).toBeLessThanOrEqual(LIMIT.upperBone);
  });

  it('presents a crouch press of a grounded actor without a jump', () => {
    // Recorded for the summary: the driver itself goes from standing to crouch directly.
    expect(sequence).toEqual(['loco:m4_ready', 'loco:crouch_idle']);
  });
});

describe('standing idle legs are a still pose', () => {
  it('holds every lower track of each ready clip at one value', () => {
    for (const weapon of ['m4', 'p90', 'awp', 'pistol']) {
      const clip = live.get(`${weapon}_ready`);
      expect(clip, `live_${weapon}_ready`).toBeDefined();
      const lower = driver.copyPresentationMask(clip, false).tracks;
      expect(lower.map(track => track.name).sort()).toEqual([...LOWER_TRACKS].sort());
      for (const track of lower) expect(constantTrack(track), `${clip.name} ${track.name}`).toBe(true);
    }
  });

  it.each([60, 30, 15])('does not move a foot of a standing, still actor at %i frames per second', rate => {
    const dt = 1 / rate;
    for (const lead of [0, 11, 29]) {
      // 120 frames; the first 30 are left to any inertia, the feet of the other 90 are compared.
      const poses = standStill(builtActor(), dt, lead + 30, 90);
      expect(footTravel(poses), `start after ${lead} frames`).toBeLessThan(LIMIT.stillFoot);
      expect(footTurn(poses), `start after ${lead} frames`).toBeLessThan(LIMIT.plantedFootTurn);
      for (const side of SIDES) expect(poses[0].ball[side].y, `ball ${side}`).toBeLessThanOrEqual(LIMIT.idleBall);
    }
  });

  it('control: the whole inherited idle under the same driver moves a foot', () => {
    const idle = named('attack'), ready = named('vod7_m4_ready');
    const moving = new THREE.AnimationClip('control_inherited_idle', idle.duration, [
      ...driver.copyPresentationMask(idle, false).tracks, ...driver.copyPresentationMask(ready, true).tracks]);
    for (const lead of [0, 11, 29]) {
      const actor = actorFrom(key => (key === 'idle' || key === 'm4_ready' ? moving : findAuthored(key)));
      const poses = standStill(actor, 1 / 15, lead + 30, 9); // 8 frames after the first
      // It breaks the guard above by far, and the browser test's own criterion at every start.
      // In metres it moves 0.0007 to 0.0020 m here, so 0.001 m is not reached at every start.
      expect(footTravel(poses), `start after ${lead} frames`).toBeGreaterThan(500 * LIMIT.stillFoot);
      expect(footTurn(poses), `start after ${lead} frames`).toBeGreaterThan(LIMIT.plantedFootTurn);
    }
  });
});

describe('controls that must fail the crouch guards', () => {
  it('control: inherited crouch legs under the authored upper mask point the weapon away', () => {
    const swap = actorFrom(key => (key === 'crouch' || key === 'crouch_idle'
      ? named('rifle_Crouch_Idle_Loop') : findAuthored(key)));
    const today = authoredActor(), run = simulation([swap, today]);
    run(30, 1 / 60); run(120, 1 / 60, { crouching: true });
    const d = direction(measure(swap.mesh), measure(today.mesh));
    expect(withinWeaponLimits(d)).toBe(false);
    expect(Math.abs(d.weaponPitch)).toBeGreaterThan(LIMIT.weaponPitch);
  });

  it('control: the authored crouch clip has its knees behind the line and its feet below the floor', () => {
    const authored = measure(sampleClip(named('vod7_crouch_idle'), 0));
    for (const side of SIDES) expect(authored.knee[side]).toBeLessThan(LIMIT.crouchKnee);
    expect(authored.lowestFoot).toBeLessThan(LIMIT.lowestFoot);
    expect(authored.pelvis).toBeGreaterThan(LIMIT.crouchPelvis);
  });

  it('control: the composition without the leg solve lifts a planted foot', () => {
    // Inherited leg rotations under the authored pelvis orientation, hips where that pelvis puts them.
    const source = sampleClip(named('rifle_Crouch_Idle_Loop'), 0), rig = skeletonClone(gltf.scene);
    const world = (mesh, name) => mesh.getObjectByName(name).getWorldQuaternion(new THREE.Quaternion());
    source.updateMatrixWorld(true);
    const pelvis = rig.getObjectByName('pelvis');
    pelvis.position.copy(source.getObjectByName('pelvis').position);
    pelvis.quaternion.fromArray(named('vod7_crouch_idle').tracks.find(track => track.name === 'pelvis.quaternion').values);
    rig.updateMatrixWorld(true);
    for (const side of SIDES) {
      const thigh = rig.getObjectByName(`thigh_${side}`);
      thigh.quaternion.copy(world(rig, 'pelvis').invert().multiply(world(source, `thigh_${side}`)));
      for (const bone of ['calf', 'foot', 'ball'])
        rig.getObjectByName(`${bone}_${side}`).quaternion.copy(source.getObjectByName(`${bone}_${side}`).quaternion);
    }
    const unsolved = measure(rig), inherited = measure(source);
    expect(inherited.ball.l.y).toBeLessThanOrEqual(LIMIT.crouchBall);
    expect(unsolved.ball.l.y).toBeGreaterThan(LIMIT.crouchBall);
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
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
  landFoot: -0.02, airborneFoot: -0.12, deathPelvis: 0.12,
  hitDegrees: 30, hitFactor: 5, // largest bone rotation of the damage additive, and against the authored one
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
  return (frames, dt, more = {}, velocity = [0, 0], each = null, cut = false) => {
    let pose;
    for (let i = 0; i < frames; i++) {
      time += dt; x += velocity[0] * dt; z += velocity[1] * dt;
      for (const actor of actors) {
        pose = driver.tickPresentation(actor, { identity: 'guard', generation: 0,
          sampleTimeSeconds: time, position: { x, y: 0, z }, bodyYaw: 0, aimYaw: 0, pitch: 0, alive: true,
          onGround: true, weapon: 'm4', ...more }, dt, false);
        // `cut` drops an entry blend that outlasts the state itself (jump start and landing).
        if (cut) actor._inertia = null;
        driver.finishPresentation(actor, dt);
      }
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

// ── Every in-scope state ──────────────────────────────────────────────────
// Each pose case is the final pose after tickPresentation and finishPresentation at 12 evenly
// spaced phases, with the inertia of the entry expired, on two actors that receive identical
// observations: the builder's, and one whose action map is made with findMotionClip as before
// this plan. Body yaw is 0, so forward is -Z of the simulated position and right is +X.
const PHASES = 12;
const FORWARD = [0, -1], BACK = [0, 1], LEFT = [-1, 0], RIGHT = [1, 0];
const cycleMeters = family => manifest.actions.find(action => action.id === `${family}_forward`).cycleDisplacement;
const WALK = cycleMeters('walk'), RUN = 2.4 * cycleMeters('run'), CROUCH = cycleMeters('crouch'); // m/s
const STATES = {
  idle: {},
  walk_forward: { move: FORWARD, speed: WALK, family: 'walk', facing: true },
  walk_back: { move: BACK, speed: WALK, family: 'walk' },
  walk_left: { move: LEFT, speed: WALK, family: 'walk' },
  walk_right: { move: RIGHT, speed: WALK, family: 'walk' },
  run_forward: { move: FORWARD, speed: RUN, family: 'run', facing: true },
  run_back: { move: BACK, speed: RUN, family: 'run' },
  run_left: { move: LEFT, speed: RUN, family: 'run' },
  run_right: { move: RIGHT, speed: RUN, family: 'run' },
  sprint: { move: FORWARD, speed: RUN, family: 'run', facing: true, more: { sprinting: true } },
  crouch_idle: { more: { crouching: true }, loops: 'rifle_Crouch_Idle_Loop', crouch: true },
  crouch_walk: { move: FORWARD, speed: CROUCH, family: 'crouch', facing: true, more: { crouching: true }, crouch: true },
  jump_start: { jump: 'start', floor: LIMIT.airborneFoot },
  jump_loop: { jump: 'loop', floor: LIMIT.airborneFoot },
  jump_land: { jump: 'land', floor: LIMIT.landFoot },
};
const span = values => [Math.min(...values), Math.max(...values)];
const figures = { states: {}, actions: {}, clips: {}, death: {}, controls: {} };

/** Twelve phases of one state for every actor; `action` adds an upper body action at 12 phases of its own. */
function playState(name, actors, action = null) {
  const state = STATES[name], run = simulation(actors), poses = actors.map(() => []), seen = [];
  const record = pose => { seen.push(pose); actors.forEach((actor, i) => poses[i].push(measure(actor.mesh))); };
  const act = phase => (action ? { action: { ...action, elapsed: action.total * phase } } : {});
  if (state.jump) {
    // Start and landing are shorter than the inertia of their entry, so that blend is cut here;
    // the airborne loop is entered early enough for it to expire by itself.
    const loop = named('rifle_Jump_Loop').duration / PHASES;
    run(30, 1 / 60);
    for (let i = 0; i < PHASES; i++)
      run(1, 0.32 / PHASES, { onGround: false }, [0, 0], state.jump === 'start' ? record : null, true);
    run(8, loop, { onGround: false });
    for (let i = 0; i < PHASES; i++) run(1, loop, { onGround: false }, [0, 0], state.jump === 'loop' ? record : null);
    for (let i = 0; i < PHASES; i++)
      run(1, 0.38 / PHASES, {}, [0, 0], state.jump === 'land' ? record : null, true);
  } else {
    // One gait cycle in 12 frames; a still state steps through the clip its legs loop in real time.
    const dt = state.speed ? cycleMeters(state.family) / state.speed / PHASES
      : (state.loops ? named(state.loops).duration : 1) / PHASES;
    const velocity = (state.move ?? [0, 0]).map(axis => axis * (state.speed ?? 0));
    run(Math.ceil(1 / dt) + 2, dt, { ...state.more, ...act(0) }, velocity);
    for (let i = 0; i < PHASES; i++) run(1, dt, { ...state.more, ...act(i / PHASES) }, velocity, record);
  }
  return { poses, seen, layers: actors.map(actor => driver.inspectPresentationLayers(actor)) };
}
/** Weapon and chest of the composed actor against the actor of before this plan, phase by phase. */
function expectDirection(label, composed, before, facing = false) {
  const deltas = composed.map((pose, i) => direction(pose, before[i]));
  deltas.forEach((d, phase) => {
    expect(Math.abs(d.weaponYaw), `${label}: weapon yaw, phase ${phase}`).toBeLessThanOrEqual(LIMIT.weaponYaw);
    expect(Math.abs(d.weaponPitch), `${label}: weapon pitch, phase ${phase}`).toBeLessThanOrEqual(LIMIT.weaponPitch);
    expect(Math.abs(d.spineYaw), `${label}: spine_03 yaw, phase ${phase}`).toBeLessThanOrEqual(LIMIT.spineYaw);
  });
  const yaw = span(deltas.map(d => d.weaponYaw));
  expect(yaw[1] - yaw[0], `${label}: weapon yaw range over the cycle`).toBeLessThanOrEqual(LIMIT.weaponYawRange);
  // Level view and forward movement: the driver adds no correction, so the facing itself is the reference.
  if (facing) composed.forEach((pose, phase) =>
    expect(Math.abs(turn(pose.weaponYaw)), `${label}: weapon yaw against the facing, phase ${phase}`)
      .toBeLessThanOrEqual(LIMIT.weaponYaw));
  return { weaponYaw: yaw, weaponPitch: span(deltas.map(d => d.weaponPitch)), spineYaw: span(deltas.map(d => d.spineYaw)),
    weaponYawAbsolute: span(composed.map(pose => turn(pose.weaponYaw))),
    weaponPitchAbsolute: span(composed.map(pose => pose.weaponPitch)) };
}
const legFigures = poses => ({ pelvis: span(poses.map(pose => pose.pelvis)),
  lowestFoot: Math.min(...poses.map(pose => pose.lowestFoot)),
  kneeLargest: Math.max(...poses.flatMap(pose => SIDES.map(side => pose.knee[side]))),
  kneeSmallest: Math.min(...poses.flatMap(pose => SIDES.map(side => pose.knee[side]))),
  ball: Object.fromEntries(SIDES.map(side => [side, span(poses.map(pose => pose.ball[side].y))])) });
/** A clip alone at 12 phases of its own length. */
const clipPoses = clip => Array.from({ length: PHASES }, (_, i) => measure(sampleClip(clip, clip.duration * i / PHASES)));
const layerSizes = layers => Object.fromEntries(layers.map(layer => [layer.clip, layer.tracks.length]));
const largestRotation = clip => Math.max(...clip.tracks.filter(track => track.name.endsWith('.quaternion'))
  .flatMap(track => Array.from({ length: track.values.length / 4 }, (_, i) => {
    const [x, y, z, w] = track.values.slice(i * 4, i * 4 + 4);
    return 2 * Math.atan2(Math.hypot(x, y, z), Math.abs(w)) * DEG;
  })));

// action id -> [inherited source of the legs, timing]. 'held': one frame of the source, held.
// 'upper': the driver plays this clip's upper mask in real time, so the clip keeps the authored length.
const ROUTE = {
  m4_ready: ['attack', 'held'], p90_ready: ['attack', 'held'], awp_ready: ['attack', 'held'], pistol_ready: ['attack', 'held'],
  stop: ['attack', 'held'], reversal: ['attack', 'held'], turn_left: ['attack', 'held'], turn_right: ['attack', 'held'],
  walk_forward: ['walk'], walk_back: ['walk_back'], walk_left: ['strafe_l'], walk_right: ['strafe_r'],
  run_forward: ['run'], run_back: ['run_back'], run_left: ['strafe_l'], run_right: ['strafe_r'], sprint: ['run', 'upper'],
  crouch_idle: ['rifle_Crouch_Idle_Loop'], crouch_forward: ['rifle_Crouch_Fwd_Loop'], crouch_back: ['rifle_Crouch_Fwd_Loop'],
  crouch_left: ['rifle_Crouch_Fwd_Loop'], crouch_right: ['rifle_Crouch_Fwd_Loop'],
  jump_start: ['rifle_Jump_Start'], jump_loop: ['rifle_Jump_Loop'], jump_land: ['rifle_Jump_Land'],
};
const LEGACY_ROUTE = { idle: 'm4_ready', walk: 'walk_forward', walk_back: 'walk_back', strafe_l: 'walk_left',
  strafe_r: 'walk_right', run: 'run_forward', run_back: 'run_back', crouch: 'crouch_idle', crouch_walk: 'crouch_forward' };
const WHOLE = { death: 'Death01', death_front: 'Death01', death_back: 'Death01', death_left: 'Death01',
  death_right: 'Death01', hit: 'hit', damage: 'hit' };
const valueAt = (track, time) => Array.from(track.createInterpolant().evaluate(time));
const authoredOf = id => named(manifest.actions.find(action => action.id === id).clip);

describe('the live route, clip by clip', () => {
  it('composes every routed action from its inherited legs and its authored upper body', () => {
    for (const [id, [source, timing]] of Object.entries(ROUTE)) {
      const clip = live.get(id), inherited = named(source), authored = authoredOf(id);
      expect(clip, `live_${id}`).toBeDefined();
      expect(clip.name).toBe(`live_${id}`);
      expect(findLive(id)).toBe(clip);
      expect(prepared.animations).not.toContain(clip);
      const keep = timing === 'held' || timing === 'upper';
      expect(clip.duration, `${id} duration`).toBe(keep ? authored.duration : inherited.duration);
      const lower = driver.copyPresentationMask(clip, false).tracks, upper = driver.copyPresentationMask(clip, true).tracks;
      expect(lower.map(track => track.name).sort(), id).toEqual([...LOWER_TRACKS].sort());
      // Upper tracks: the authored ones, same names and values; only their key times follow the length.
      const expected = driver.copyPresentationMask(authored, true).tracks;
      expect(upper.map(track => track.name)).toEqual(expected.map(track => track.name));
      upper.forEach((track, i) => {
        expect(Array.from(track.values), `${id} ${track.name}`).toEqual(Array.from(expected[i].values));
        const scale = clip.duration / authored.duration;
        expected[i].times.forEach((time, k) => expect(track.times[k]).toBeCloseTo(time * scale, 5));
      });
      // Lower tracks: keyed at the inherited key times, pelvis height and ball rotation as inherited.
      const stamps = inherited.tracks.find(track => track.name === 'pelvis.quaternion').times;
      const height = inherited.tracks.find(track => track.name === 'pelvis.position');
      const position = lower.find(track => track.name === 'pelvis.position');
      for (const track of lower) {
        if (timing === 'held') { expect(constantTrack(track), `${id} ${track.name}`).toBe(true); continue; }
        expect(track.times).toHaveLength(stamps.length);
        stamps.forEach((time, k) => expect(track.times[k]).toBeCloseTo(time * clip.duration / inherited.duration, 5));
      }
      const keys = timing === 'held' ? 1 : stamps.length;
      for (let k = 0; k < keys; k++) {
        const theirs = valueAt(height, stamps[k]);
        for (let axis = 0; axis < 3; axis++) expect(position.values[k * 3 + axis]).toBeCloseTo(theirs[axis], 6);
      }
      for (const side of SIDES) {
        const mine = lower.find(track => track.name === `ball_${side}.quaternion`).values;
        const source = inherited.tracks.find(track => track.name === `ball_${side}.quaternion`);
        for (let k = 0; k < keys; k++) {
          const theirs = valueAt(source, stamps[k]);
          const dot = [0, 1, 2, 3].reduce((sum, axis) => sum + mine[k * 4 + axis] * theirs[axis], 0);
          expect(Math.abs(dot), `${id} ball_${side}, key ${k}`).toBeGreaterThan(1 - 1e-6);
        }
      }
    }
    expect([...live.keys()].sort()).toEqual([...Object.keys(ROUTE), 'death_front', 'death_back', 'death_left',
      'death_right', 'damage'].sort());
  });

  it('resolves legacy keys, the whole inherited death and hit, and leaves every other key alone', () => {
    for (const [key, id] of Object.entries(LEGACY_ROUTE)) expect(findLive(key), key).toBe(live.get(id));
    for (const weapon of ['m4', 'p90', 'awp', 'pistol']) expect(findLive('idle', weapon)).toBe(live.get(`${weapon}_ready`));
    for (const [key, name] of Object.entries(WHOLE)) {
      expect(findLive(key)?.name, key).toBe(name);
      expect(findLive(key), key).toBe(named(name));
    }
    const untouched = ['attack', 'shoot', 'reload', 'melee_cross', 'melee_jab', 'throw', 'punch_cross', 'punch_jab',
      'nade', 'roll', 'dance', ...manifest.actions.filter(action => action.previewOnly ||
        ['ads', 'fire', 'reload'].includes(action.kind)).map(action => action.id)];
    expect(untouched).toHaveLength(11 + 12 + 14);
    for (const key of untouched) for (const weapon of ['m4', 'p90', 'awp', 'pistol']) {
      expect(findAuthored(key, weapon), key).not.toBeNull();
      expect(findLive(key, weapon), key).toBe(findAuthored(key, weapon));
    }
    // The authored repertoire stays resolvable, clip for clip.
    for (const action of manifest.actions) expect(findAuthored(action.id).name).toBe(action.clip);
  });

  it('puts each ankle of every composed clip where the inherited clip has it', () => {
    for (const [id, [source, timing]] of Object.entries(ROUTE)) {
      const clip = live.get(id), inherited = named(source);
      expect(clip, `live_${id}`).toBeDefined();
      let farthest = 0;
      for (let i = 0; i < PHASES; i++) {
        const mine = measure(sampleClip(clip, clip.duration * i / PHASES));
        const theirs = measure(sampleClip(inherited, timing === 'held' ? 0 : inherited.duration * i / PHASES));
        for (const side of SIDES) {
          const distance = mine.ankle[side].distanceTo(theirs.ankle[side]);
          farthest = Math.max(farthest, distance);
          expect(distance, `${id} ankle ${side}, phase ${i}`).toBeLessThanOrEqual(LIMIT.ankleFromInherited);
        }
      }
      figures.clips[id] = { source, duration: clip.duration, farthestAnkle: farthest };
    }
  });

  it('holds the idle legs under stop, reversal and both turns', () => {
    const ready = driver.copyPresentationMask(live.get('m4_ready'), false).tracks;
    for (const id of ['stop', 'reversal', 'turn_left', 'turn_right']) {
      const clip = live.get(id);
      expect(clip, `live_${id}`).toBeDefined();
      for (const track of driver.copyPresentationMask(clip, false).tracks) {
        expect(constantTrack(track), `${id} ${track.name}`).toBe(true);
        const same = ready.find(other => other.name === track.name);
        expect(Array.from(track.values), `${id} ${track.name}`).toEqual(Array.from(same.values));
      }
    }
  });

  it('keeps the jump chain on one hemisphere across both boundaries', () => {
    const [start, loop, land] = ['jump_start', 'jump_loop', 'jump_land'].map(id => live.get(id));
    for (const clip of [start, loop, land]) expect(clip).toBeDefined();
    const dot = (a, at, b, bt) => [0, 1, 2, 3].reduce((sum, axis) => sum + a.values[at + axis] * b.values[bt + axis], 0);
    for (const next of loop.tracks.filter(track => track.name.endsWith('.quaternion'))) {
      const prior = start.tracks.find(track => track.name === next.name);
      if (prior) expect(dot(prior, prior.values.length - 4, next, 0), `start to loop, ${next.name}`).toBeGreaterThanOrEqual(0);
    }
    for (const next of land.tracks.filter(track => track.name.endsWith('.quaternion'))) {
      const prior = loop.tracks.find(track => track.name === next.name);
      if (!prior) continue;
      expect(dot(prior, 0, next, 0), `loop to land, ${next.name}`).toBeGreaterThanOrEqual(0);
      expect(dot(prior, prior.values.length - 4, next, 0), `loop end to land, ${next.name}`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('every in-scope state through the driver', () => {
  it.each(Object.keys(STATES))('%s: weapon and chest forward, knees forward, feet and pelvis in place, upper body unchanged', name => {
    const state = STATES[name], composed = builtActor(), today = authoredActor();
    const { poses: [mine, before], seen, layers } = playState(name, [composed, today]);
    expect(mine).toHaveLength(PHASES);
    if (state.jump) for (const pose of seen) expect(pose.jump, name).toBe(state.jump);
    const seenDirection = expectDirection(name, mine, before, state.facing);
    const legs = legFigures(mine);
    expect(legs.kneeLargest, `${name}: largest forward knee offset`).toBeGreaterThanOrEqual(LIMIT.kneeForward);
    // Jump start and loop leave the root plane while the game lifts the root: an airborne bound, not ground contact.
    expect(legs.lowestFoot, `${name}: ${state.jump && state.jump !== 'land' ? 'airborne bound' : 'lowest foot'}`)
      .toBeGreaterThanOrEqual(state.floor ?? LIMIT.lowestFoot);
    if (state.crouch) {
      expect(legs.kneeSmallest, `${name}: smallest knee offset`).toBeGreaterThanOrEqual(LIMIT.crouchKnee);
      expect(legs.pelvis[1], `${name}: pelvis`).toBeLessThanOrEqual(LIMIT.crouchPelvis);
    }
    if (name === 'crouch_idle') for (const side of SIDES) expect(legs.ball[side][1]).toBeLessThanOrEqual(LIMIT.crouchBall);
    if (name === 'idle') {
      expect(legs.pelvis[0], 'standing pelvis').toBeGreaterThanOrEqual(LIMIT.standingPelvis);
      for (const side of SIDES) expect(legs.ball[side][1]).toBeLessThanOrEqual(LIMIT.idleBall);
    }
    const upper = Math.max(...mine.map((pose, i) => upperDifference(pose, before[i])));
    expect(upper, `${name}: upper body against the pose of before`).toBeLessThanOrEqual(LIMIT.upperBone);
    figures.states[name] = { ...seenDirection, ...legs, upperDifference: upper,
      head: mine[0].head.toArray(), chest: mine[0].chest.toArray(),
      layersBefore: layerSizes(layers[1]), layersAfter: layerSizes(layers[0]), authored: legFigures(before) };
  });

  it.each(['walk_forward', 'walk_right', 'run_forward', 'crouch_idle'].flatMap(name =>
    [['reload', 1.8], ['fire', 0.2]].map(([kind, total]) => [name, kind, total])))(
    '%s with an M4 %s layer keeps weapon and chest forward', (name, kind, total) => {
      const composed = builtActor(), today = authoredActor();
      const { poses: [mine, before], seen } = playState(name, [composed, today], { kind, total });
      for (const pose of seen) expect(pose.upper).toBe(kind);
      expect(seen.map(pose => pose.action.phase)).toEqual(Array.from({ length: PHASES }, (_, i) => expect.closeTo(i / PHASES, 9)));
      figures.actions[`${name}+${kind}`] = expectDirection(`${name}+${kind}`, mine, before);
    });

  it.each([['front', [0, -1]], ['back', [0, 1]], ['left', [-1, 0]], ['right', [1, 0]]])(
    'death %s plays the whole inherited death down to the ground', (variant, [x, z]) => {
      const actor = builtActor(), run = simulation([actor]), poses = [];
      run(30, 1 / 60);
      const last = run(14, 0.65 / PHASES, { alive: false, trustedImpact: { x, z } }, [0, 0], () => poses.push(measure(actor.mesh)));
      expect(last.deathVariant).toBe(variant);
      expect(last.deathPhase).toBe(1);
      const layers = driver.inspectPresentationLayers(actor);
      expect(layers).toHaveLength(1);
      expect(layers[0].clip).toBe('Death01');
      expect(layers[0].weight).toBe(1);
      expect(layers[0].time).toBeCloseTo(named('Death01').duration, 6);
      expect(poses.at(-1).pelvis, 'final pelvis').toBeLessThanOrEqual(LIMIT.deathPelvis);
      expect(poses.at(-1).lowestFoot, 'final lowest foot').toBeGreaterThanOrEqual(LIMIT.lowestFoot);
      figures.death[variant] = { finalPelvis: poses.at(-1).pelvis, finalLowestFoot: poses.at(-1).lowestFoot,
        lowestFootOnTheWay: Math.min(...poses.map(pose => pose.lowestFoot)) };
    });

  it('builds the damage reaction from the inherited hit against the inherited idle', () => {
    const additive = builtActor().actions._hitAdditive.getClip();
    const expected = THREE.AnimationUtils.makeClipAdditive(named('hit').clone(), 0, named('attack'));
    expect(additive.tracks.map(track => track.name)).toEqual(expected.tracks.map(track => track.name));
    additive.tracks.forEach((track, i) =>
      expect(Array.from(track.values), track.name).toEqual(Array.from(expected.tracks[i].values)));
    const authored = THREE.AnimationUtils.makeClipAdditive(named('vod7_damage').clone(), 0, named('vod7_m4_ready'));
    const inherited = largestRotation(additive), before = largestRotation(authored);
    expect(inherited).toBeGreaterThanOrEqual(LIMIT.hitDegrees);
    expect(inherited).toBeGreaterThanOrEqual(LIMIT.hitFactor * before);
    figures.damage = { inheritedLargestRotation: inherited, authoredLargestRotation: before, factor: inherited / before,
      hitDuration: named('hit').duration };
  });
});

describe('controls that must fail the guards of every state', () => {
  it.each(['vod7_walk_forward', 'vod7_crouch_idle', 'vod7_jump_start'])('control: %s keeps its knees behind the limit', name => {
    const legs = legFigures(clipPoses(named(name)));
    expect(legs.kneeLargest).toBeLessThan(LIMIT.kneeForward);
    figures.controls[name] = legs;
  });

  it.each([['walk_forward', 'walk', ['walk', 'walk_forward']], ['walk_right', 'strafe_r', ['strafe_r', 'walk_right']]])(
    'control: %s on the whole inherited %s legs under the authored upper mask turns the weapon away', (name, source, keys) => {
      const swap = actorFrom(key => (keys.includes(key) ? named(source) : findAuthored(key)));
      const { poses: [mine, before] } = playState(name, [swap, authoredActor()]);
      const deltas = mine.map((pose, i) => direction(pose, before[i]));
      expect(deltas.some(withinWeaponLimits)).toBe(false);
      for (const d of deltas) expect(Math.abs(d.weaponYaw)).toBeGreaterThan(LIMIT.weaponYaw);
      figures.controls[`mask swap ${name}`] = { weaponYaw: span(deltas.map(d => d.weaponYaw)),
        weaponPitch: span(deltas.map(d => d.weaponPitch)), spineYaw: span(deltas.map(d => d.spineYaw)) };
    });

  it('control: vod7_death_front ends above the death limit', () => {
    const clip = named('vod7_death_front'), end = measure(sampleClip(clip, clip.duration));
    expect(end.pelvis).toBeGreaterThan(LIMIT.deathPelvis);
    figures.controls.vod7_death_front = { finalPelvis: end.pelvis, finalLowestFoot: end.lowestFoot };
  });
});

describe('figures for the summary', () => {
  it('measures what is reported and asserts nothing about motion', () => {
    // Head and chest in crouch: composed, the whole rifle crouch of before e08e0ac, and the authored clip.
    const place = mesh => { const m = measure(mesh); return { headHeight: m.head.y, headForward: m.head.z,
      chestForward: m.chest.z, pelvis: m.pelvis }; };
    figures.crouchHeadAndChest = { composed: place(sampleClip(findLive('crouch_idle') ?? named('vod7_crouch_idle'), 0)),
      wholeRifleCrouch: place(sampleClip(named('rifle_Crouch_Idle_Loop'), 0)),
      authored: place(sampleClip(named('vod7_crouch_idle'), 0)) };
    // Unchanged authored clips whose legs stay in play.
    for (const name of ['vod7_melee_cross', 'vod7_melee_jab', 'vod7_throw'])
      figures.clips[name] = legFigures(clipPoses(named(name)));
    for (const name of ['Death01', 'hit', 'attack']) figures.clips[name] = legFigures(clipPoses(named(name)));
    expect(Object.keys(figures.crouchHeadAndChest)).toHaveLength(3);
  });
});
afterAll(() => {
  // Optional: the measured figures as a file, for the plan summary. Nothing reads it back.
  if (env.LIVE_CLIP_FIGURES) writeFileSync(env.LIVE_CLIP_FIGURES, JSON.stringify(figures, null, 2));
});

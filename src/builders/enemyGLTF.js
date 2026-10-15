/**
 * enemyGLTF.js — Phase 6.1
 *
 * Loads public/models/enemy.glb on startup.
 * Falls back to procedural enemies if file is absent.
 *
 * This file is tuned for the Mannequin rig (Quaternius-style):
 *   root bone applies -90° X rotation (Blender Z-up → GLTF Y-up)
 *   Mesh: "Mannequin"   Skin: "Armature"
 *   Muzzle attaches to "hand_r" bone
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { scene } from '../scene.js';
import { buildEnemy } from './enemy.js';
import { buildEnemyMixer, attachSkeletonDebug, buildGLTFBreathingClip, copyPresentationMask } from './enemyAnimations.js';
import { attachEnemyWeapon } from './enemyWeapon.js';
import { attachWeapons3pToHand } from './weaponFBX.js';
import { buildRifleMovementClips } from './rifleClips.js';
import { preserveTemplateGeometry, disposeCharacter, consolidateCharacterSkeletons } from './characterResources.js';
import { applyCharacterAppearance, tintCharacterAccents } from './characterAppearance.js';
import motionManifest from '../../tools/art/motion-manifest.json';
import { createFirstPersonRig, disposeFirstPersonRig } from './firstPersonRig.js';
export { disposeCharacter as disposeEnemyMesh } from './characterResources.js';

// ── State ──────────────────────────────────────────────────────────────────
let gltfTemplate = null;
export let usingGLTF = false;

// ── Player GLTF instance (built once after GLB loads) ─────────────────────
export let playerMesh = null;
export let playerMixer = null;
export let playerActions = null;
export let playerFirstPersonRig = null;

// ── Clip aliases — maps internal state names to GLB clip names ────────────
// Retargeted rifle clips listed first so they win over old pistol clips.
const ALIASES = {
  idle:        ['attack',           'Idle_Loop',        'Idle',   'idle',   'T-Pose', 'A_TPose'],
  walk:        ['walk',             'Walk_Loop',        'Walk',   'Walking'],
  run:         ['run',              'Jog_Fwd_Loop',     'Sprint_Loop',  'Run'],
  attack:      ['attack',           'Pistol_Aim_Neutral', 'Pistol_Idle_Loop'],
  shoot:       ['shoot',            'Pistol_Shoot',     'Shoot',  'Fire'],
  crouch:      ['rifle_Crouch_Idle_Loop', 'Crouch_Idle_Loop', 'Crouch_Idle', 'Crouch'],
  crouch_walk: ['rifle_Crouch_Fwd_Loop', 'Crouch_Fwd_Loop',  'Crouch_Walk'],
  death:       ['Death01',          'Death',  'death',  'Die'],
  hit:         ['hit',              'Hit_Chest',        'Hit_Head'],
  roll:        ['Roll',             'roll',   'Dive'],
  jump_start:  ['rifle_Jump_Start', 'Jump_Start',       'Jump_start',       'jump_loop'],
  // Armed variants preserve the original jump chain's lower-body motion.
  jump_loop:   ['rifle_Jump_Loop', 'Jump_Loop',        'Jump_loop',        'jump_loop'],
  jump_land:   ['rifle_Jump_Land', 'Jump_Land',        'Jump_land'],
  reload:      ['reload',           'Pistol_Reload'],
  run_back:    ['run_back'],
  walk_back:   ['walk_back'],
  strafe_l:    ['strafe_l'],
  strafe_r:    ['strafe_r'],
  nade:        ['nade'],
  dance:       ['Dance_Loop'],
  punch_cross: ['Punch_Cross'],
  punch_jab:   ['Punch_Jab'],
};

// All clip keys to attempt loading
const CLIP_KEYS = [...new Set([
  'idle', 'walk', 'run', 'attack', 'shoot', 'crouch', 'crouch_walk',
  'death', 'hit', 'roll', 'jump_start', 'jump_loop', 'jump_land', 'reload',
  'run_back', 'walk_back', 'strafe_l', 'strafe_r', 'nade', 'dance', 'punch_cross', 'punch_jab',
  ...motionManifest.actions.map((action) => action.id),
])];
// Minimum clips required — fall back to procedural if none of these match
const REQUIRED_KEYS = ['idle', 'walk'];

export function getMotionDefinition(key, weapon = 'm4') {
  const handling = { idle: 'ready', attack: 'ads', shoot: 'fire', reload: 'reload' };
  return motionManifest.actions.find((a) => a.id === key) ||
    motionManifest.actions.find((a) => !a.previewOnly && a.weapon === weapon && a.kind === handling[key]) ||
    motionManifest.actions.find((a) => !a.previewOnly && a.aliases.includes(key)) || null;
}

export function findMotionClip(animations, key, weapon = 'm4') {
  const spec = getMotionDefinition(key, weapon);
  if (spec) {
    const matches = animations.filter((c) => c.name === spec.clip);
    if (matches.length === 1) return matches[0];
  }
  for (const alias of (ALIASES[key] || [])) {
    const found = animations.find((c) => c.name === alias);
    if (found) return found;
  }
  return null;
}
const findClip = findMotionClip;

// ── Live composition ───────────────────────────────────────────────────────
// The owner's motion review found the authored vod7_ legs unusable in play: the
// knees bend backwards and the pelvis never moves. Live play therefore gets clips
// composed once at load, with the inherited motion-captured legs and pelvis height
// under the authored upper body. Swapping the lower mask alone is not enough: the
// mocap pelvis is turned about 40 degrees and the authored spine and arms would
// carry the weapon off with it. So the pelvis keeps the authored orientation and
// each leg is solved again, to put its ankle back where the inherited clip has it.
// These clips exist at runtime only. The GLB, the prepared set and findMotionClip
// are unchanged, and the vod7_ clips stay resolvable through them.
//
// action id -> [legacy key of the inherited source, pelvis sway, timing]
//   sway    share of the inherited pelvis's deviation from its own clip mean: a
//           quarter for the gaits, none for crouch and jump, whose rifle_ sources
//           already hold the chest fixed in the character frame
//           Crouch and jump also keep the pelvis over the root: it takes only its
//           height from the inherited clip and its horizontal position from the
//           authored one. The rifle_ crouch has the pelvis 0.23 m behind the root,
//           and the first-person arms copy the shoulders that ride on it, which put
//           the support hand out of reach of the weapon. The ankles stay where the
//           inherited clip has them; the legs are solved to them from the held hips.
//   'held'  the legs are one frame of the source, with two equal keys: the driver
//           plays a standing lower layer in real time and a blocked player must
//           not move a foot. The clip keeps the authored duration, so the upper
//           body the driver plays from it is frame for frame what it was.
//   'upper' the driver plays this clip's upper mask in real time (sprint carry),
//           so it keeps the authored duration too and the leg keys are scaled to it.
// Every other clip keeps the inherited duration; the authored upper keys follow it.
const LIVE_SWAY = 0.25;
const LIVE_ROUTE = {
  walk_forward: ['walk', LIVE_SWAY], walk_back: ['walk_back', LIVE_SWAY],
  walk_left: ['strafe_l', LIVE_SWAY], walk_right: ['strafe_r', LIVE_SWAY],
  run_forward: ['run', LIVE_SWAY], run_back: ['run_back', LIVE_SWAY],
  run_left: ['strafe_l', LIVE_SWAY], run_right: ['strafe_r', LIVE_SWAY],
  sprint: ['run', LIVE_SWAY, 'upper'],
  // The inherited set has one crouch walk; every crouch direction shows it.
  crouch_idle: ['crouch', 0], crouch_forward: ['crouch_walk', 0], crouch_back: ['crouch_walk', 0],
  crouch_left: ['crouch_walk', 0], crouch_right: ['crouch_walk', 0],
  jump_start: ['jump_start', 0], jump_loop: ['jump_loop', 0], jump_land: ['jump_land', 0],
  // Stop, reversal and turns show the idle legs under their own authored upper body.
  stop: ['idle', 0, 'held'], reversal: ['idle', 0, 'held'],
  turn_left: ['idle', 0, 'held'], turn_right: ['idle', 0, 'held'],
};
for (const action of motionManifest.actions)
  if (action.kind === 'ready' && !action.previewOnly) LIVE_ROUTE[action.id] = ['idle', 0, 'held'];
// Played whole, not composed: one inherited death for every direction, and the
// inherited hit as the damage source.
const LIVE_WHOLE = { death_front: 'death', death_back: 'death', death_left: 'death',
  death_right: 'death', damage: 'hit' };
const LIVE_LEGS = ['l', 'r'].map((side) => ['thigh', 'calf', 'foot', 'ball'].map((bone) => `${bone}_${side}`));
const _liveClips = new WeakMap(); // prepared animations -> Map(action id -> clip)

/** The clip a legacy key had before the authored repertoire: its inherited source. */
function inheritedClip(animations, key) {
  for (const alias of (ALIASES[key] || [])) {
    const found = animations.find((c) => c.name === alias);
    if (found) return found;
  }
  return null;
}

/**
 * Compose the live clips for a prepared set, once, and keep them beside it.
 * Every composed clip is `live_<action id>` with ten lower tracks (pelvis position and
 * the rotations of pelvis, thighs, calves, feet and balls) and the authored upper tracks.
 */
export function buildLiveClips(scene, animations) {
  const live = new Map();
  _liveClips.set(animations, live);
  const source = skeletonClone(scene), target = skeletonClone(scene);
  const pelvis = target.getObjectByName('pelvis');
  if (!pelvis || LIVE_LEGS.flat().some((name) => !target.getObjectByName(name))) return live;
  target.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(source);
  const Q = () => new THREE.Quaternion(), V = () => new THREE.Vector3();
  const worldQ = (name) => source.getObjectByName(name).getWorldQuaternion(Q());
  const worldP = (name) => source.getObjectByName(name).getWorldPosition(V());
  const rootQ = pelvis.parent.getWorldQuaternion(Q());
  const rest = pelvis.position.clone(); // the target is a fresh clone: its bind pose

  // The inherited pose at each key time, in the character frame.
  const sample = (clip, times) => {
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().play();
    const keys = times.map((time) => {
      mixer.setTime(time);
      source.updateMatrixWorld(true);
      return { position: source.getObjectByName('pelvis').position.clone(), pelvis: worldQ('pelvis'),
        legs: LIVE_LEGS.map(([thigh, calf, foot, ball]) => ({
          hip: worldP(thigh), knee: worldP(calf), ankle: worldP(foot),
          thigh: worldQ(thigh), calf: worldQ(calf), foot: worldQ(foot),
          ball: source.getObjectByName(ball).quaternion.clone() })) };
    });
    mixer.stopAllAction();
    return keys;
  };

  // One key: [pelvis, then thigh, calf, foot, ball of each side] as local rotations.
  const solve = (key, authoredPelvis, mean, sway) => {
    let local = authoredPelvis;
    if (sway) {
      const deviation = key.pelvis.clone().multiply(mean.clone().invert());
      if (deviation.w < 0) deviation.set(-deviation.x, -deviation.y, -deviation.z, -deviation.w);
      const world = Q().slerp(deviation, sway).multiply(rootQ).multiply(authoredPelvis);
      local = rootQ.clone().invert().multiply(world);
    }
    pelvis.position.copy(key.position);
    pelvis.quaternion.copy(local);
    pelvis.updateWorldMatrix(false, true);
    const pelvisQ = pelvis.getWorldQuaternion(Q()), out = [local.clone()];
    key.legs.forEach((leg, side) => {
      // Turning the pelvis moved the hip. Two-bone solve with the inherited bone lengths
      // and knee plane; out of reach, the leg stays fully extended toward the ankle.
      const hip = target.getObjectByName(LIVE_LEGS[side][0]).getWorldPosition(V());
      const upper = leg.knee.distanceTo(leg.hip), lower = leg.ankle.distanceTo(leg.knee);
      const along = leg.ankle.clone().sub(hip);
      const reach = Math.min(along.length(), upper + lower - 1e-4);
      along.normalize();
      const a = (upper * upper - lower * lower + reach * reach) / (2 * reach);
      const h = Math.sqrt(Math.max(0, upper * upper - a * a));
      const inheritedAlong = leg.ankle.clone().sub(leg.hip).normalize();
      const bend = leg.knee.clone().sub(leg.hip);
      bend.addScaledVector(inheritedAlong, -bend.dot(inheritedAlong));
      bend.addScaledVector(along, -bend.dot(along)).normalize();
      const knee = hip.clone().addScaledVector(along, a).addScaledVector(bend, h);
      const ankle = hip.clone().addScaledVector(along, reach);
      const thigh = Q().setFromUnitVectors(leg.knee.clone().sub(leg.hip).normalize(),
        knee.clone().sub(hip).normalize()).multiply(leg.thigh);
      const calf = Q().setFromUnitVectors(leg.ankle.clone().sub(leg.knee).normalize(),
        ankle.clone().sub(knee).normalize()).multiply(leg.calf);
      // The foot keeps its inherited orientation in the character frame.
      out.push(pelvisQ.clone().invert().multiply(thigh), thigh.clone().invert().multiply(calf),
        calf.clone().invert().multiply(leg.foot), leg.ball);
    });
    return out;
  };

  const composed = [];
  for (const [id, [key, sway, timing]] of Object.entries(LIVE_ROUTE)) {
    const spec = motionManifest.actions.find((a) => a.id === id);
    const authored = animations.filter((c) => c.name === spec?.clip);
    const inherited = inheritedClip(animations, key);
    const authoredPelvis = authored[0]?.tracks.find((t) => t.name === 'pelvis.quaternion');
    const stamps = inherited?.tracks.find((t) => t.name === 'pelvis.quaternion')?.times;
    if (authored.length !== 1 || !authoredPelvis || !stamps) continue;
    const held = timing === 'held';
    const keys = sample(inherited, held ? [0] : Array.from(stamps));
    if (!sway && !held) {
      // Crouch and jump: the pelvis is a child of the turned root, so local z is its height.
      // Local x and y come from the authored clip at the same point of the clip, or from
      // the rest position where that clip keys no pelvis position (jump_loop).
      const level = authored[0].tracks.find((t) => t.name === 'pelvis.position')?.createInterpolant();
      keys.forEach((k, i) => {
        const [x, y] = level?.evaluate(stamps[i] * authored[0].duration / inherited.duration) ?? [rest.x, rest.y];
        k.position.x = x; k.position.y = y;
      });
    }
    const mean = Q().set(0, 0, 0, 0);
    for (const { pelvis: q } of keys) {
      const sign = mean.lengthSq() && mean.dot(q) < 0 ? -1 : 1;
      mean.set(mean.x + sign * q.x, mean.y + sign * q.y, mean.z + sign * q.z, mean.w + sign * q.w);
    }
    mean.normalize();
    const base = Q().fromArray(authoredPelvis.values);
    const duration = held || timing === 'upper' ? authored[0].duration : inherited.duration;
    const solved = keys.map((k) => solve(k, base, mean, sway));
    if (held) { keys.push(keys[0]); solved.push(solved[0]); }
    const times = held ? [0, duration] : Array.from(stamps, (t) => t * duration / inherited.duration);
    const names = ['pelvis', ...LIVE_LEGS.flat()];
    const upper = copyPresentationMask(authored[0], true).tracks;
    // Authored upper keys follow the composed duration; their values are untouched.
    if (authored[0].duration !== duration)
      for (const track of upper) track.times = track.times.map((t) => t * duration / authored[0].duration);
    const clip = new THREE.AnimationClip(`live_${id}`, duration, [
      new THREE.VectorKeyframeTrack('pelvis.position', times, keys.flatMap((k) => k.position.toArray())),
      ...names.map((name, i) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times,
        solved.flatMap((rotations) => rotations[i].toArray()))),
      ...upper]);
    live.set(id, clip);
    composed.push(clip);
  }
  mixer.uncacheRoot(source);
  for (const [id, key] of Object.entries(LIVE_WHOLE)) {
    const inherited = inheritedClip(animations, key);
    if (inherited) live.set(id, inherited);
  }
  // Same hemisphere rules as the prepared set, against the same reference clip.
  normaliseClipQuatSigns(composed, findClip(animations, 'idle'));
  // The jump chain: every shared rotation stays on one hemisphere across both boundaries.
  const align = (from, to, firstFrame) => {
    for (const track of (from && to ? to.tracks : [])) {
      const prior = track.name.endsWith('.quaternion') && from.tracks.find((t) => t.name === track.name);
      if (!prior) continue;
      const v = track.values, r = prior.values, at = firstFrame ? 0 : r.length - 4;
      if (r[at] * v[0] + r[at + 1] * v[1] + r[at + 2] * v[2] + r[at + 3] * v[3] < 0)
        for (let i = 0; i < v.length; i++) v[i] = -v[i];
    }
  };
  align(live.get('jump_start'), live.get('jump_loop'), false);
  align(live.get('jump_loop'), live.get('jump_land'), true);
  return live;
}

/** The clip live play shows for a key: the composed one where routed, else findMotionClip's. */
export function findLiveClip(animations, key, weapon = 'm4') {
  const id = getMotionDefinition(key, weapon)?.id;
  return _liveClips.get(animations)?.get(id) ?? findMotionClip(animations, key, weapon);
}

// ── Note on the "+90°X CORR" theory (disproven) ───────────────────────────
// Earlier revisions assumed merge_animations.py had baked a +90°X rotation into the
// 12 retargeted clips (walk/run/attack/shoot/reload/hit/jump_loop/nade/run_back/
// walk_back/strafe_l/strafe_r), and tried to add or remove it (applyCORR /
// undoMergeCORR). Measuring the GLB directly disproves this: premultiplying either
// +90°X or -90°X moves EVERY clip further from the reference pose, never closer
// (mean bone angle vs Idle_Loop: raw 18°/66°, after ±90°X 79°-124°).
//
// The real split is a per-bone retarget offset, ~180° on the limb-root bones
// (thigh/upperarm/clavicle/ball) and near 0 on the spine. It is not expressible as
// one global rotation, which is why every ±90°X attempt was reverted. See
// docs/legacy/ANIMATION-SPACES.md for the measurements and the upstream fix.

// ── Quaternion sign normalisation ──────────────────────────────────────────
// Three.js blends bone quaternions from two clips during crossfade. If the
// same bone's quaternion is on opposite hemispheres in different clips the
// weighted average takes the long path (270° instead of 90°).
//
// Strategy (order matters):
//   1. Within-track continuity first — ensures all frames in a clip are on
//      the same hemisphere as the previous frame.
//   2. Whole-track flip based on frame-0 vs reference — ensures frame-0 of
//      every clip agrees with the reference clip. Because continuity is
//      already fixed, flipping the whole track keeps all frames consistent.
//
// Result: walk at ANY frame T is on the same hemisphere as crouch at frame 0.
function normaliseClipQuatSigns(clips, refClip = findClip(clips, 'idle')) {
  const ref = {};
  if (refClip) {
    for (const track of refClip.tracks) {
      if (!track.name.endsWith('.quaternion')) continue;
      ref[track.name] = [track.values[0], track.values[1], track.values[2], track.values[3]];
    }
  }

  for (const clip of clips) {
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.quaternion')) continue;
      const v = track.values;
      if (v.length < 4) continue;

      // Step 1: within-track continuity (forward pass)
      for (let i = 4; i < v.length; i += 4) {
        const dot = v[i-4]*v[i] + v[i-3]*v[i+1] + v[i-2]*v[i+2] + v[i-1]*v[i+3];
        if (dot < 0) {
          v[i] = -v[i]; v[i+1] = -v[i+1]; v[i+2] = -v[i+2]; v[i+3] = -v[i+3];
        }
      }

      // Step 2: flip whole track if frame-0 disagrees with reference
      const r = ref[track.name];
      if (r) {
        const dot = r[0]*v[0] + r[1]*v[1] + r[2]*v[2] + r[3]*v[3];
        if (dot < 0) {
          for (let i = 0; i < v.length; i++) v[i] = -v[i];
        }
      }

      // Step 1b: loop-seam fix — must run AFTER step 2 so step 2 can't undo it.
      // If the last keyframe and first keyframe are on opposite hemispheres, the
      // mixer output sign-flips at every loop boundary, causing blend artifacts.
      // Fix: negate only the last frame. Three.js slerpFlat takes the short path
      // between consecutive keyframes, so the N-1→N span interpolates correctly
      // despite the stored sign mismatch.
      if (v.length >= 8) {
        const n = v.length - 4;
        const seamDot = v[n]*v[0] + v[n+1]*v[1] + v[n+2]*v[2] + v[n+3]*v[3];
        if (seamDot < 0) {
          v[n] = -v[n]; v[n+1] = -v[n+1]; v[n+2] = -v[n+2]; v[n+3] = -v[n+3];
        }
      }
    }
  }
}

// ── Cross-clip boundary alignment ──────────────────────────────────────────
// During crossfade, Three.js blends two simultaneously-running actions.
// If bone B in clipA ends on +q and clipB starts on -q (same rotation, opposite
// stored sign), slerpFlat short-paths toward -q. The blend output reaches -qB
// just as clipA fades to zero, then snaps to +qB the next frame → visible flap.
// Fix: flip the ENTIRE clipB track for any bone whose first keyframe disagrees
// in sign with clipA's LAST keyframe. Uniform flip preserves intra-clip dot
// products (step 1) and the seam (step 1b) so nothing else breaks.
function alignClipBoundaries(animations, fromKey, toKey, { useFirstFrame = false } = {}) {
  const clipA = findClip(animations, fromKey);
  const clipB = findClip(animations, toKey);
  if (!clipA || !clipB) return;

  const refA = {};
  for (const track of clipA.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const v = track.values;
    // Last frame: use first frame when explicitly requested (loop clips where last≈first)
    const off = useFirstFrame ? 0 : v.length - 4;
    refA[track.name] = [v[off], v[off+1], v[off+2], v[off+3]];
  }

  const flipped = [];
  for (const track of clipB.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const ref = refA[track.name];
    if (!ref) continue;
    const v = track.values;
    const dot = ref[0]*v[0] + ref[1]*v[1] + ref[2]*v[2] + ref[3]*v[3];
    const angleDeg = Math.round(Math.acos(Math.max(-1, Math.min(1, Math.abs(dot)))) * 2 * 180 / Math.PI);
    // Extract bone name from track name (e.g. "pelvis.quaternion" → "pelvis")
    const bone = track.name.replace('.quaternion', '').split('.').pop();
    if (dot < 0) {
      for (let i = 0; i < v.length; i++) v[i] = -v[i];
      flipped.push(`${bone}(${angleDeg}°flip)`);
    } else if (angleDeg > 5) {
      flipped.push(`${bone}(${angleDeg}°ok)`);
    }
  }
  console.log(`[alignBoundary] ${fromKey}→${toKey} (${useFirstFrame ? 'firstFrame' : 'lastFrame'}): ${flipped.length ? flipped.join(' ') : 'all clean'}`);
}

// ── Additive layer setup (GLTF only) ──────────────────────────────────────
// Called after all base actions are registered. Adds:
//   actions._breathing   — always-on gentle spine/shoulder sway
//   actions._hitAdditive — hit clip converted to additive delta (vs idle pose)
// AnimationClips are immutable inputs — one instance can back every character's
// mixer. Building them per enemy re-ran makeClipAdditive over a 382-keyframe clip
// (and a full clip.clone()) on every spawn *and* every wave respawn.
let _breathClip = null, _hitAddClip = null;
function _sharedBreathClip() {
  return (_breathClip ??= buildGLTFBreathingClip());
}
function _sharedHitAdditiveClip() {
  if (_hitAddClip !== null) return _hitAddClip;
  // The inherited hit against the inherited idle, as before the authored repertoire.
  const hitClip  = inheritedClip(gltfTemplate.animations, 'hit');
  const idleClip = inheritedClip(gltfTemplate.animations, 'idle');
  if (!hitClip || !idleClip) return (_hitAddClip = false);
  _hitAddClip = THREE.AnimationUtils.makeClipAdditive(hitClip.clone(), 0, idleClip);
  _hitAddClip.name = '_hit_additive';
  return _hitAddClip;
}

function _addAdditiveLayer(mixer, actions) {
  // Breathing
  const breathAction = mixer.clipAction(_sharedBreathClip());
  breathAction.blendMode = THREE.AdditiveAnimationBlendMode;
  breathAction.time = Math.random() * 3.5;
  breathAction.setEffectiveWeight(0.75);
  breathAction.play();
  actions._breathing = breathAction;

  // Hit additive — convert hit clip to delta-from-idle so it layers on top
  // of any locomotion state without replacing it.
  const hitAddClip = _sharedHitAdditiveClip();
  if (hitAddClip) {
    const hitAddAction = mixer.clipAction(hitAddClip);
    hitAddAction.blendMode = THREE.AdditiveAnimationBlendMode;
    hitAddAction.setLoop(THREE.LoopOnce);
    hitAddAction.clampWhenFinished = true;
    actions._hitAdditive = hitAddAction;
  }
}

// ── Dead-track stripping ───────────────────────────────────────────────────
// The Blender exporter bakes translation + scale keyframes for all 65 bones into
// every clip, so each clip carries 195 channels when only ~66 do anything:
//   - all 2340 scale tracks are exactly 1.0
//   - 2321 of 2340 translation tracks are constant (only the pelvis actually moves)
// AnimationMixer evaluates every track of every *active* action each frame, and the
// loco blend tree keeps 5 actions running at once per character. Dropping the inert
// tracks removes ~2/3 of that work with no visual change.
//
// Safety rule: a constant track is only dropped when its value matches the node's
// rest transform, so removing it cannot move the bone. (This deliberately keeps the
// five Pistol_* pelvis tracks, which hold a constant *non-rest* height.)
const _EPS = 1e-4;
function stripRedundantTracks(gltf) {
  let dropped = 0, kept = 0;
  for (const clip of gltf.animations) {
    clip.tracks = clip.tracks.filter((track) => {
      const dot = track.name.lastIndexOf('.');
      const prop = track.name.slice(dot + 1);
      if (prop !== 'position' && prop !== 'scale') return true;
      const node = gltf.scene.getObjectByName(track.name.slice(0, dot));
      if (!node) return true;                       // unknown target — never risk it
      const v = track.values;
      const rest = prop === 'position' ? node.position : node.scale;
      const r = [rest.x, rest.y, rest.z];
      for (let i = 0; i < v.length; i += 3)
        for (let k = 0; k < 3; k++)
          if (Math.abs(v[i + k] - r[k]) > _EPS) { return true; }
      dropped++;
      return false;
    });
    kept += clip.tracks.length;
  }
  console.log(`[GLTF] stripped ${dropped} inert position/scale tracks (${kept} live tracks remain)`);
}

// ── Load ───────────────────────────────────────────────────────────────────
export function prepareEnemyClips(input) {
  // Preparation owns its clip/track arrays. The parsed template and siblings
  // keep their authored buffers even when sign alignment or stripping mutates.
  const gltf = { ...input, animations: input.animations.map((clip) => clip.clone()) };
  stripRedundantTracks(gltf);
  gltf.animations.push(...buildRifleMovementClips(gltf.scene, gltf.animations));
  normaliseClipQuatSigns(gltf.animations);
  alignClipBoundaries(gltf.animations, 'jump_start', 'jump_loop');
  alignClipBoundaries(gltf.animations, 'jump_loop', 'jump_land', { useFirstFrame: true });
  return gltf;
}

export async function tryLoadEnemyGLTF() {
  // HEAD probe first so no 404 noise when file is absent
  try {
    const probe = await fetch(import.meta.env.BASE_URL + 'models/enemy.glb', { method: 'HEAD' });
    if (!probe.ok) return false;
  } catch {
    return false;
  }

  try {
    const loader = new GLTFLoader();
    const gltf = prepareEnemyClips(await loader.loadAsync(import.meta.env.BASE_URL + 'models/enemy.glb'));
    buildLiveClips(gltf.scene, gltf.animations);
    preserveTemplateGeometry(gltf.scene);
    // Align jump phase clip boundaries — sign-flip guard after shared-space normalisation.
    gltfTemplate = gltf;
    usingGLTF = true;
    const found = CLIP_KEYS.filter((k) => findClip(gltf.animations, k));
    console.log('[GLTF] enemy.glb loaded — matched clips:', found.join(', '));
    console.log('[GLTF] all clips in file:', gltf.animations.map((c) => c.name).join(', '));
    return true;
  } catch (err) {
    console.warn('[GLTF] failed to load enemy.glb:', err);
    return false;
  }
}

// The GLB declares both character materials doubleSided, so every character fragment
// is shaded twice and back faces fight the shadow depth pass. The mannequin is a
// closed solid — front faces are enough.
function _setFrontSide(mesh) {
  for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
    if (m) m.side = THREE.FrontSide;
}

// ── Build ─────────────────────────────────────────────────────────────────
// Returns { mesh, muzzleFlash, mixer, actions, facingOffset }
// facingOffset: 0 for procedural (faces -Z), Math.PI for GLTF (faces +Z by export default)
export function buildEnemyMesh(wx, wz, role = 'assault') {

  // ── Procedural fallback ───────────────────────────────────────────────
  if (!usingGLTF || !gltfTemplate) {
    const { mesh, muzzleFlash } = buildEnemy(wx, wz);
    const { mixer, actions } = buildEnemyMixer(mesh);
    attachSkeletonDebug(mesh);
    return { mesh, muzzleFlash, mixer, actions, facingOffset: 0 };
  }

  // ── GLTF path ─────────────────────────────────────────────────────────
  const clone = skeletonClone(gltfTemplate.scene);
  consolidateCharacterSkeletons(clone);
  clone.position.set(wx, 0, wz);
  clone.traverse((ch) => {
    if (ch.isMesh) {
      ch.castShadow = true;
      ch.userData.enemyGroup = clone;
      ch.frustumCulled = false; // SkinnedMesh bounding sphere is bind-pose only; disable culling
      _setFrontSide(ch);
    }
  });
  scene.add(clone);

  // Build AnimationMixer — load every clip we recognise
  const mixer = new THREE.AnimationMixer(clone);
  const actions = {};
  const weaponKey = { assault: 'm4', smg: 'p90', sniper: 'awp', pistol: 'pistol' }[role] || 'm4';

  for (const key of CLIP_KEYS) {
    const clip = findLiveClip(gltfTemplate.animations, key, weaponKey);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    if (['death', 'hit', 'shoot', 'roll', 'jump_start', 'jump_land', 'reload', 'punch_cross', 'punch_jab', 'nade'].includes(key) || getMotionDefinition(key, weaponKey)?.loop === false) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }
    if (motionManifest.actions.some(a => a.id === key) && Object.values(actions).includes(action)) {
      // A named source ID can refer to the same mixer action as its live alias.
      // Keep that lookup without duplicating semantic entries during gameplay
      // weight/retirement scans (notably death versus death_front).
      Object.defineProperty(actions, key, { value: action, enumerable: false });
    } else actions[key] = action;
  }


  // Require at least idle + walk — otherwise fall back to procedural
  if (REQUIRED_KEYS.some((k) => !actions[k])) {
    console.warn('[GLTF] Required clips missing — falling back to procedural');
    disposeCharacter(clone, mixer);
    usingGLTF = false;
    const { mesh, muzzleFlash } = buildEnemy(wx, wz);
    const { mixer: m2, actions: a2 } = buildEnemyMixer(mesh);
    attachSkeletonDebug(mesh);
    return { mesh, muzzleFlash, mixer: m2, actions: a2, facingOffset: 0 };
  }

  // Start idle with a random phase offset so enemies don't step in sync
  const idleClip = findClip(gltfTemplate.animations, 'idle');
  if (idleClip) actions.idle.time = Math.random() * idleClip.duration;
  actions.idle.play();

  // Pre-start loco blend-tree clips at weight 0 so setEffectiveWeight works immediately
  for (const key of ['walk', 'run', 'strafe_l', 'strafe_r']) {
    if (!actions[key]) continue;
    const dur = actions[key].getClip().duration;
    actions[key].time = Math.random() * dur;
    actions[key].setEffectiveWeight(0);
    actions[key].play();
  }

  _addAdditiveLayer(mixer, actions);

  // ── Muzzle flash ──────────────────────────────────────────────────────
  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 5, 5),
    new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0 })
  );
  muzzleFlash.material.userData.characterOwned = true;
  // Mannequin rig: right hand bone is "hand_r"
  const muzzleBone =
    clone.getObjectByName('hand_r') ||
    clone.getObjectByName('hand_l') ||
    clone.getObjectByName('muzzle') ||
    clone.getObjectByName('Muzzle');
  if (muzzleBone) {
    muzzleBone.add(muzzleFlash);
    muzzleFlash.position.set(0, 0.05, -0.35); // forward from the right hand
  } else {
    clone.add(muzzleFlash);
    muzzleFlash.position.set(0.3, 1.4, -0.5); // fallback world-space offset
  }

  attachSkeletonDebug(clone);
  attachEnemyWeapon(clone, role, muzzleFlash);
  applyCharacterAppearance(clone);

  // Quaternius mannequin faces +Z at rotation.y=0; game convention is -Z forward.
  // Callers add facingOffset to e.mesh.rotation.y so enemies face the right direction.
  return { mesh: clone, muzzleFlash, mixer, actions, facingOffset: Math.PI };
}

// ── Player GLTF instance ──────────────────────────────────────────────────
// Call once after tryLoadEnemyGLTF() succeeds. Adds the mesh to the scene
// (visible=false) and sets up mixer + actions identical to enemy build.
export function buildPlayerMesh() {
  if (!usingGLTF || !gltfTemplate) return false;

  if (playerFirstPersonRig) disposeFirstPersonRig(playerFirstPersonRig);

  const clone = skeletonClone(gltfTemplate.scene);
  consolidateCharacterSkeletons(clone);
  clone.visible = false;
  clone.traverse((ch) => {
    if (ch.isMesh) {
      ch.castShadow = true;
      ch.frustumCulled = false; // SkinnedMesh bounding sphere is bind-pose only; disable culling
      _setFrontSide(ch);
    }
  });
  scene.add(clone);

  const mixer = new THREE.AnimationMixer(clone);
  const actions = {};
  for (const key of CLIP_KEYS) {
    const clip = findLiveClip(gltfTemplate.animations, key);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    if (['death', 'hit', 'shoot', 'roll', 'jump_start', 'jump_land', 'reload', 'punch_cross', 'punch_jab', 'nade'].includes(key) || getMotionDefinition(key)?.loop === false) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }
    if (motionManifest.actions.some(a => a.id === key) && Object.values(actions).includes(action)) {
      Object.defineProperty(actions, key, { value: action, enumerable: false });
    } else actions[key] = action;
  }

  // Start idle
  const idleClip = findClip(gltfTemplate.animations, 'idle');
  if (idleClip && actions.idle) actions.idle.time = Math.random() * idleClip.duration;
  if (actions.idle) actions.idle.play();

  // Pre-start loco blend-tree clips at weight 0
  for (const key of ['walk', 'run', 'strafe_l', 'strafe_r']) {
    if (!actions[key]) continue;
    const dur = actions[key].getClip().duration;
    actions[key].time = Math.random() * dur;
    actions[key].setEffectiveWeight(0);
    actions[key].play();
  }

  _addAdditiveLayer(mixer, actions);

  playerFirstPersonRig = createFirstPersonRig({ source: clone });
  scene.add(playerFirstPersonRig.arms, playerFirstPersonRig.body);
  attachSkeletonDebug(clone);
  attachWeapons3pToHand(clone);
  applyCharacterAppearance(clone);

  playerMesh = clone;
  playerMixer = mixer;
  playerActions = actions;
  return true;
}

// ── Team tint ─────────────────────────────────────────────────────────────
export function tintEnemyMesh(mesh, hexColor) {
  tintCharacterAccents(mesh, hexColor);
}

/** Template-only inspection factory: no scene, pool, gameplay or random state. */
export function createReviewCharacter(weapon = 'm4') {
  if (!gltfTemplate) throw new Error('Character asset unavailable');
  const mesh = skeletonClone(gltfTemplate.scene);
  consolidateCharacterSkeletons(mesh);
  const mixer = new THREE.AnimationMixer(mesh), actions = {};
  for (const key of CLIP_KEYS) {
    const clip = findLiveClip(gltfTemplate.animations, key, weapon);
    if (clip) actions[key] = mixer.clipAction(clip);
  }
  mesh.traverse(node => { if (node.isMesh) { node.frustumCulled = false; node.castShadow = true; } });
  applyCharacterAppearance(mesh);
  return { mesh, mixer, actions };
}

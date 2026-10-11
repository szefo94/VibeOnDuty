import * as THREE from 'three';
import { createPresentationHistory, normalizePresentation, samplePresentation } from './animationPresentation.js';
import { getWeaponHandling, restoreWeaponHandlingBones, updateWeaponHandling } from './weaponHandling.js';
import { WEAPONS } from '../config.js';
import { registerCharacterDisposer } from './characterResources.js';

// ── Additive breathing clips ──────────────────────────────────────────────
// Procedural rig: target the arm-swing meshes with a slow sine oscillation.
// makeClipAdditive subtracts frame-0 (which is 0 for a sine starting at 0),
// so the values remain as-is and play correctly in AdditiveAnimationBlendMode.
function buildProceduralBreathingClip() {
  const T = 3.5;
  const N = 32;
  const times = [], vL = [], vR = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * T;
    times.push(t);
    vL.push(Math.sin((i / N) * Math.PI * 2) * 0.022);
    vR.push(Math.sin((i / N) * Math.PI * 2 + Math.PI * 0.6) * 0.022);
  }
  const clip = new THREE.AnimationClip('_breathing', T, [
    new THREE.NumberKeyframeTrack('armSwingL.rotation[x]', times, vL),
    new THREE.NumberKeyframeTrack('armSwingR.rotation[x]', times, vR),
  ]);
  return THREE.AnimationUtils.makeClipAdditive(clip);
}

// GLTF rig: target spine_01 + upperarms using quaternion tracks.
// Same makeClipAdditive treatment — frame-0 is identity, so deltas are
// identical to the original values (no distortion).
export function buildGLTFBreathingClip() {
  const T = 3.5;
  const N = 32;
  const times = [];
  for (let i = 0; i <= N; i++) times.push((i / N) * T);

  function qTrack(boneName, ampX, ampZ, phase = 0) {
    const vals = [];
    for (let i = 0; i <= N; i++) {
      const s = Math.sin((i / N) * Math.PI * 2 + phase);
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(s * ampX, 0, s * ampZ, 'YXZ')
      );
      vals.push(q.x, q.y, q.z, q.w);
    }
    return new THREE.QuaternionKeyframeTrack(boneName + '.quaternion', times, vals);
  }

  const clip = new THREE.AnimationClip('_breathing_gltf', T, [
    qTrack('spine_01',   0.010, 0.004),
    qTrack('upperarm_l', 0.008, 0, Math.PI * 0.3),
    qTrack('upperarm_r', 0.008, 0, Math.PI * 0.3),
  ]);
  return THREE.AnimationUtils.makeClipAdditive(clip);
}

// ── Helpers ───────────────────────────────────────────────────────────────
// Build a NumberKeyframeTrack that follows a sine wave over one period T.
// phase shifts the wave start so legs can swing opposite each other.
function sineTrack(name, T, amp, phase = 0, N = 16) {
  const times = [];
  const values = [];
  for (let i = 0; i <= N; i++) {
    times.push((i / N) * T);
    values.push(Math.sin((i / N) * Math.PI * 2 + phase) * amp);
  }
  return new THREE.NumberKeyframeTrack(name, times, values);
}

// Build the six leg+arm tracks that make up a walk-style cycle.
// T = period (seconds), amp = peak leg rotation (radians).
function walkTracks(T, amp) {
  return [
    sineTrack('legL.rotation[x]',      T, amp,        0),           // L leg swings forward
    sineTrack('legR.rotation[x]',      T, amp,        Math.PI),     // R leg opposite
    sineTrack('thighL.rotation[x]',    T, amp * 0.55, 0),           // thighs follow legs
    sineTrack('thighR.rotation[x]',    T, amp * 0.55, Math.PI),
    sineTrack('kneeL.rotation[x]',     T, amp * 0.6,  Math.PI),     // knees counter-swing
    sineTrack('kneeR.rotation[x]',     T, amp * 0.6,  0),
    sineTrack('armSwingL.rotation[x]', T, amp * 0.45, Math.PI),     // chest/torso counter
    sineTrack('armSwingR.rotation[x]', T, amp * 0.45, 0),           // shoulder bar
  ];
}

// ── Shared clips (created once, reused by every enemy's mixer) ────────────
const CLIPS = {
  idle:   new THREE.AnimationClip('idle',   3.2, walkTracks(3.2, 0.04)),
  walk:   new THREE.AnimationClip('walk',   0.9, walkTracks(0.9, 0.38)),
  run:    new THREE.AnimationClip('run',    0.52, walkTracks(0.52, 0.54)),
  attack: new THREE.AnimationClip('attack', 0.68, walkTracks(0.68, 0.28)),
};

// ── Per-enemy mixer factory ───────────────────────────────────────────────
// Returns { mixer, actions } where actions is { idle, walk, run, attack }.
// All actions are pre-started with weight=0 (idle starts at weight=1).
// Stagger start time so 10 enemies don't step in unison.
export function buildEnemyMixer(mesh) {
  const mixer = new THREE.AnimationMixer(mesh);
  const actions = {};

  for (const [name, clip] of Object.entries(CLIPS)) {
    const action = mixer.clipAction(clip);
    action.time = Math.random() * clip.duration; // random start offset
    action.play();
    action.setEffectiveWeight(name === 'idle' ? 1 : 0);
    actions[name] = action;
  }

  // Additive breathing — runs on top of all base clips, always active
  const breathAction = mixer.clipAction(buildProceduralBreathingClip());
  breathAction.blendMode = THREE.AdditiveAnimationBlendMode;
  breathAction.time = Math.random() * 3.5;
  breathAction.setEffectiveWeight(0.75);
  breathAction.play();
  actions._breathing = breathAction;

  return { mixer, actions };
}

// ── Locomotion blend tree helpers ─────────────────────────────────────────
// LOCO_CLIPS run simultaneously with direct weight control (no crossfade).
// Override clips (death, jump, hit, crouch, shoot, attack-idle) use crossfade.
const LOCO_CLIPS = new Set(['idle', 'walk', 'run', 'strafe_l', 'strafe_r']);

function _applyLocoWeight(action, w) {
  if (!action) return;
  // Locomotion owns these weights. Cancel a previous override's fade (idle and
  // attack can be the same action) and restore actions disabled by completed fades.
  action.enabled = true;
  action.paused = false;
  action.setEffectiveTimeScale(1).setEffectiveWeight(w).play();
}

function _setLocoWeights(actions, speedN, strN) {
  if (speedN <= 0) strN = 0;
  // Procedural/minimal rigs may have no lateral or run clips.
  if ((strN < 0 && !actions.strafe_l) || (strN > 0 && !actions.strafe_r)) strN = 0;
  if (!actions.run) speedN = Math.min(speedN, 0.5);
  const strAmt = Math.abs(strN);
  const fwdFrac = Math.max(0, 1 - strAmt);

  const idleW = Math.max(0, 1 - speedN * 3);
  const walkW = Math.max(0, 1 - Math.abs(speedN * 2 - 1)) * fwdFrac;
  const runW  = Math.max(0, speedN * 2 - 1) * fwdFrac;
  const strLW = Math.max(0, -strN);
  const strRW = Math.max(0,  strN);

  const sum = idleW + walkW + runW + strLW + strRW || 1;

  _applyLocoWeight(actions.idle,     idleW / sum);
  _applyLocoWeight(actions.walk,     walkW / sum);
  _applyLocoWeight(actions.run,      runW  / sum);
  _applyLocoWeight(actions.strafe_l, strLW / sum);
  _applyLocoWeight(actions.strafe_r, strRW / sum);
}

function _exitLocoMode(e) {
  if (!e._inLocoMode) return;
  // Build debug label BEFORE zeroing weights (otherwise always shows loco[]).
  if (e._dbgTransitions) e._dbgPrevClip = `loco[${Object.entries(e.actions ?? {}).filter(([k,a]) => LOCO_CLIPS.has(k) && !k.startsWith('_') && a?.weight > 0.01).map(([k,a]) => `${k}:${a.weight.toFixed(2)}`).join('+')}]`;
  for (const n of LOCO_CLIPS) { const a = e.actions[n]; if (a) a.setEffectiveWeight(0); }
  e._inLocoMode = false;
  // Nullify currentClip so the next crossfade() call doesn't skip the incoming clip
  // due to the "to === currentClip" early-return guard.
  e.currentClip = null;
}

function _snapBones(e, omega = INERTIA_OMEGA) {
  if (!e._bones?.length) return;
  e._inertia = new Map();
  e._inertiaT = 0;
  e._inertiaOmega = omega;
  for (const bone of e._bones) e._inertia.set(bone.uuid, bone.quaternion.clone());
}

function _enterLocoMode(e) {
  if (e._inLocoMode) return;
  const a = e.actions[e.currentClip];
  if (a && !LOCO_CLIPS.has(e.currentClip)) {
    const instantSnap = INSTANT_SNAP_CLIPS.has(e.currentClip);
    _snapBones(e, instantSnap ? INERTIA_OMEGA_SNAP : INERTIA_OMEGA);
  }
  const locoActions = new Set([...LOCO_CLIPS].map(k => e.actions[k]));
  for (const [key, action] of Object.entries(e.actions)) {
    if (!key.startsWith('_') && !locoActions.has(action)) action.stop();
  }
  if (_dbgWants(e)) console.log(`[loco:${e._dbgName ?? 'enemy'}] enter (from ${e.currentClip ?? 'none'})`);
  e._inLocoMode = true;
  e.currentClip = 'idle';
}

// ── Inertial blending ──────────────────────────────────────────────────────
// Critically-damped spring: settles bone pose from snapshot toward new clip.
// Applied after mixer.update() so the correction overrides the mixer output.
// Normal returns settle over ~0.35s; override entries use ~0.10s. Roll changes
// the whole body orientation and uses a near-instant settle to avoid a long sweep.
const INERTIA_OMEGA = 22;
const INERTIA_OMEGA_FAST = 80;
const INERTIA_OMEGA_SNAP = 300;
const INSTANT_SNAP_CLIPS = new Set(['roll']);

// Three's PropertyMixer writes a property only when its blended value changed, so a bone on an
// exactly constant track would keep an inertia blend for good. Every blend therefore remembers
// what the mixer had left under it, and that value goes back before the mixer runs again.
// Only a bone that still holds the blend is touched; whatever was written since stays.
function _restoreInertia(e) {
  const held = e._inertiaHeld;
  if (!held?.written) return;
  held.written = false;
  for (let i = 0; i < held.bones.length; i++)
    if (held.bones[i].quaternion.equals(held.blended[i])) held.bones[i].quaternion.copy(held.mixed[i]);
}

function _tickInertia(e, dt) {
  // Cancelled since the last blend: the caller has driven the bones again, nothing goes back.
  if (!e._inertia) { if (e._inertiaHeld) e._inertiaHeld.written = false; return; }
  // A caller that ran its mixer without a restore (tickInertia, a loop that only finishes).
  _restoreInertia(e);
  e._inertiaT += dt;
  const omega = e._inertiaOmega ?? INERTIA_OMEGA;
  const decay = (1 + omega * e._inertiaT) * Math.exp(-omega * e._inertiaT);
  if (decay < 0.001) { e._inertia = null; return; }
  let held = e._inertiaHeld;
  if (held?.bones !== e._bones || held.mixed.length !== e._bones.length) {
    // Once per skeleton, never per frame.
    held = e._inertiaHeld = { bones: e._bones, written: false,
      mixed: e._bones.map(() => new THREE.Quaternion()),
      blended: e._bones.map(() => new THREE.Quaternion()) };
  }
  for (let i = 0; i < e._bones.length; i++) {
    const bone = e._bones[i];
    const snap = e._inertia.get(bone.uuid);
    // A bone the presentation correction turned has the mixer's own value saved there.
    held.mixed[i].copy(e._presentationCorrection?.get(bone) ?? bone.quaternion);
    if (snap) bone.quaternion.copy(snap.clone().slerp(bone.quaternion, 1 - decay));
    held.blended[i].copy(bone.quaternion);
  }
  held.written = true;
}

export function tickInertia(e, dt) { _tickInertia(e, dt); }
export function setLocoWeights(actions, speedN, strN) { _setLocoWeights(actions, speedN, strN); }
export function enterLocoMode(e) { _enterLocoMode(e); }
export function exitLocoMode(e) { _exitLocoMode(e); }

/** Match a one-shot to its gameplay window, without changing the shared clip. */
export function fitActionDuration(action, seconds) {
  if (action && seconds > 0) action.setEffectiveTimeScale(action.getClip().duration / seconds);
}

// ── Per-frame bone-flip monitor ───────────────────────────────────────────
// Detects quaternion sign flips (dot < 0 vs previous frame) in any bone.
// Logs the bone name + dot product so we know which bone is flipping and when.
// Only active when e._dbgFlipMonitor = true.
const _FLIP_MON_RE = /arm|hand|shoulder|spine|neck|clavicle/i;
export function tickBoneFlipMonitor(e) {
  if (!e._dbgFlipMonitor || !e._bones?.length) return;
  if (!e._prevBoneQ) {
    e._prevBoneQ = new Map();
    for (const b of e._bones) if (_FLIP_MON_RE.test(b.name)) e._prevBoneQ.set(b.uuid, b.quaternion.clone());
    return;
  }
  for (const b of e._bones) {
    if (!_FLIP_MON_RE.test(b.name)) continue;
    const prev = e._prevBoneQ.get(b.uuid);
    if (!prev) { e._prevBoneQ.set(b.uuid, b.quaternion.clone()); continue; }
    const dot = prev.x*b.quaternion.x + prev.y*b.quaternion.y + prev.z*b.quaternion.z + prev.w*b.quaternion.w;
    if (dot < 0) console.log(`[flipMonitor] ${b.name} dot=${dot.toFixed(3)} clip=${e.currentClip ?? 'loco'}`);
    prev.copy(b.quaternion);
  }
}

// ── Runtime animation debug switch ────────────────────────────────────────
// Transition logging used to be gated on a per-object _dbgTransitions flag that
// nothing exposed, so it was unreachable from the console on a deployed build.
// This module-level switch turns it on for the player and every enemy at once.
//   window.__animDebug(true)      every character
//   window.__animDebug('player')  player only
//   window.__animDebug(false)     off
let _dbgMode = false;
export function setAnimDebug(mode = true) {
  _dbgMode = mode;
  console.log(`[animDebug] ${mode === false ? 'off' : `on (${mode === true ? 'all characters' : mode})`}`);
  return mode;
}
function _dbgWants(e) {
  if (e._dbgTransitions) return true;
  if (_dbgMode === false) return false;
  if (_dbgMode === true) return true;
  return (e._dbgName ?? 'enemy') === _dbgMode;   // string mode = match this name only
}

// ── Crossfade helper ──────────────────────────────────────────────────────
// Call once per frame after computing the desired clip name.
// e must have { actions, currentClip } on it.
export function crossfade(e, to, dur = 0.16) {
  if (!e.actions[to]) return;
  // Callers such as killEnemy can enter an override directly from the blend tree.
  _exitLocoMode(e);
  if (to === e.currentClip) return;
  if (to === 'death') {
    _restoreInertia(e);
    e.mixer?.stopAllAction(); // includes copied mask actions not enumerated in source aliases
    for (const action of new Set(Object.values(e.actions))) action.stop();
    e._inertia = null;
    e.actions.death.setLoop(THREE.LoopOnce, 1);
    e.actions.death.clampWhenFinished = true;
    e.actions.death.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    fitActionDuration(e.actions.death, 0.65);
    e.currentClip = to;
    return;
  }
  // Snap (dur=0) between two non-loco clips: always snap bones so inertia can smooth
  // the sudden switch. currentClip=null means we just exited loco — handled in the
  // else branch below which handles leaving the blend tree.
  if (dur === 0 && e.currentClip !== null) {
    const isSnap   = INSTANT_SNAP_CLIPS.has(to) || INSTANT_SNAP_CLIPS.has(e.currentClip);
    const omega = isSnap ? INERTIA_OMEGA_SNAP : INERTIA_OMEGA_FAST;
    _snapBones(e, omega);
  }
  const from = e.actions[e.currentClip];
  const toAct = e.actions[to];
  if (from === toAct) {
    toAct.enabled = true;
    toAct.paused = false;
    toAct.setEffectiveWeight(1).play();
    e.currentClip = to;
    return;
  }
  // An interrupted crossfade must not leave an older base clip contributing too.
  for (const [key, action] of Object.entries(e.actions)) {
    if (!key.startsWith('_') && action !== from && action !== toAct) action.stop();
  }
  // Standard Three.js crossfade pattern: fade out old, reset + fade in new.
  // crossFadeTo(warp=true) was avoided — it warps the incoming clip's timeScale 0→1,
  // freezing it at frame 0 (bind/T-pose) for the entire blend duration.
  if (from) {
    from.fadeOut(dur);
    // setEffectiveWeight(1) restores this.weight=1 before fadeIn schedules its 0→1 interpolant.
    // Phase 41 pre-started loco clips at weight=0; without this, effectiveWeight = 0 * interpolant = 0 forever.
    toAct.reset().setEffectiveWeight(1).fadeIn(dur).play();
  } else {
    // No prior clip (just exited loco). Use instant-snap omega when entering a large-pose clip.
    const omega = INSTANT_SNAP_CLIPS.has(to) ? INERTIA_OMEGA_SNAP : INERTIA_OMEGA_FAST;
    _snapBones(e, omega);
    // Skipping fadeIn: starting at weight 0 and ramping would show bind/T-pose for the duration.
    toAct.reset().setEffectiveWeight(1).play();
  }
  e.currentClip = to;

  // Debug: log transitions + full-skeleton angle audit
  if (_dbgWants(e) && e._bones?.length) {
    const fromLabel = e._dbgPrevClip ?? 'loco';
    e._dbgPrevClip = to;
    const toClip = toAct.getClip();

    // Check every bone — compute angle in degrees between current pose and incoming clip frame-0
    const results = [];
    for (const b of e._bones) {
      const track = toClip.tracks.find(t => t.name.includes(b.name) && t.name.endsWith('.quaternion'));
      if (!track || track.values.length < 4) continue;
      const q = b.quaternion;
      const rawDot = q.x*track.values[0] + q.y*track.values[1] + q.z*track.values[2] + q.w*track.values[3];
      const dot = Math.max(-1, Math.min(1, rawDot));
      // acos(|dot|)*2 = rotation angle represented by quaternion half-angle * 2
      const angleDeg = Math.acos(Math.abs(dot)) * 2 * (180 / Math.PI);
      if (angleDeg > 3) results.push({ name: b.name, dot, angleDeg: Math.round(angleDeg) });
    }
    results.sort((a, b) => b.angleDeg - a.angleDeg);

    const tags = results.slice(0, 10).map(r =>
      `${r.name}(${r.angleDeg}°${r.dot < 0 ? ',flip' : ''})`
    );
    console.log(`[crossfade:${e._dbgName ?? 'enemy'}] ${fromLabel} → ${to} dur=${dur.toFixed(2)} | ${tags.length ? tags.join(' ') : 'clean'}`);
  }
}

const UPPER_TRACK = /(?:spine|neck|head|clavicle|upperarm|lowerarm|hand|finger|thumb|index|middle|ring|pinky)/i;
/** Mask copies preserve shared prepared buffers and action aliases. */
export function copyPresentationMask(clip, upper) {
  return new THREE.AnimationClip(`${clip.name}_${upper ? 'upper' : 'lower'}`, clip.duration,
    clip.tracks.filter(track => UPPER_TRACK.test(track.name) === upper).map(track => track.clone()));
}
function presentationAction(e, key, upper) {
  const fallback = { walk_forward: 'walk', run_forward: 'run', walk_left: 'strafe_l',
    walk_right: 'strafe_r', run_left: 'strafe_l', run_right: 'strafe_r',
    crouch_forward: 'crouch_walk', crouch_back: 'crouch_walk', crouch_left: 'crouch_walk',
    crouch_right: 'crouch_walk', crouch_idle: 'crouch', sprint: 'run',
    melee_cross: 'punch_cross', melee_jab: 'punch_jab', throw: 'nade' };
  const generic = key.endsWith('_reload') ? 'reload' : key.endsWith('_ads') ? 'attack'
    : key.endsWith('_fire') ? 'shoot' : key.endsWith('_ready') ? 'idle' : null;
  const source = e.actions[key] || e.actions[fallback[key]] || e.actions[generic] || e.actions.idle;
  if (!source) return null;
  if (upper === null || !e._bones?.length) return source;
  e._presentationMasks ??= new Map();
  let pair = e._presentationMasks.get(source);
  if (!pair) { pair = {}; e._presentationMasks.set(source, pair); }
  const side = upper ? 'upper' : 'lower';
  if (!pair[side]) {
    const clip = copyPresentationMask(source.getClip(), upper);
    pair[side] = clip.tracks.length ? e.mixer.clipAction(clip) : null;
  }
  return pair[side];
}
function collectPresentationBones(e) {
  if (e._bonesInit) return;
  e._bonesInit = true; e._bones = [];
  e.mesh?.traverse(obj => {
    if (obj.isSkinnedMesh && obj.skeleton)
      for (const bone of obj.skeleton.bones) if (!e._bones.includes(bone)) e._bones.push(bone);
  });
}
function restorePresentationCorrection(e) {
  if (e._presentationCorrection)
    for (const [bone, quaternion] of e._presentationCorrection) bone.quaternion.copy(quaternion);
  e._presentationCorrection = new Map();
}
function correctPresentationBones(e, pose) {
  if (!pose.alive) return;
  const root = e.mesh;
  root?.updateMatrixWorld(true);
  const pelvis = e._bones?.find(b => b.name === 'pelvis');
  const spine = e._bones?.find(b => b.name === 'spine_03');
  // Apply bounded deltas in the parent's space; authored rest rolls are retained.
  const apply = (bone, worldAxis, value) => {
    if (!bone || Math.abs(value) < 1e-6) return;
    e._presentationCorrection.set(bone, bone.quaternion.clone());
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const axis = worldAxis.clone().applyQuaternion(parentQ).normalize();
    bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, value));
    bone.updateWorldMatrix(false, true);
  };
  const lowerYaw = Math.atan2(Math.sin(pose.feetYaw - pose.bodyYaw), Math.cos(pose.feetYaw - pose.bodyYaw));
  apply(pelvis, new THREE.Vector3(0, 1, 0), lowerYaw);
  // The upper chain counteracts planted pelvis yaw and leads the aim.
  if (spine) {
    const q = spine.quaternion.clone();
    apply(spine, new THREE.Vector3(0, 1, 0), pose.torsoYaw);
    apply(spine, new THREE.Vector3(Math.cos(pose.bodyYaw), 0, -Math.sin(pose.bodyYaw)), pose.pitch * .55);
    e._presentationCorrection.set(spine, q);
  }
}

/** Read-only common rig driver. Order: restore -> mixer -> rest-aware correction -> inertia. */
export function tickPresentation(e, raw, dt, updateMixer = true) {
  restoreWeaponHandlingBones(actorHandling(e));
  if (e._presentationMixer !== e.mixer) {
    e._releasePresentation?.();
    if (e._presentationMixer) { e._bonesInit = false; e._bones = []; }
    e._presentationMixer = e.mixer;
    e._presentationMasks = new Map();
    e._presentationCorrection = new Map();
    e._presentationHistory = createPresentationHistory();
    e._presentationKey = null;
    e._presentationDamageRemaining = 0;
    e._inertia = null;
    e._releasePresentation = registerCharacterDisposer(e.mesh, () => {
      e._presentationMasks?.clear(); e._presentationCorrection?.clear(); e._presentationActive?.clear();
      e._presentationHistory = null; e._presentationMixer = null; e._presentationKey = null;
      _restoreInertia(e); e._inertiaHeld = null;
      e._bones = []; e._bonesInit = false; e._inertia = null; e.presentation = null;
      e._releasePresentation = null;
    });
  }
  collectPresentationBones(e);
  e._presentationHistory ??= createPresentationHistory();
  const normalized = normalizePresentation(raw, e._presentationHistory);
  const pose = samplePresentation(normalized, e._presentationHistory, dt);
  e.presentation = pose;
  restorePresentationCorrection(e);
  if (normalized.reset) { e._inertia = null; e._presentationKey = null; }
  const selected = new Map();
  const add = (key, upper, weight, phase = null, cadence = null) => {
    const action = presentationAction(e, key, upper);
    if (!action) return;
    selected.set(action, (selected.get(action) ?? 0) + weight);
    action.enabled = true; action.paused = false; action.stopFading().stopWarping();
    action.setEffectiveWeight(selected.get(action)).play();
    if (phase !== null) {
      action.time = action.getClip().duration * phase;
      // The observed simulation phase wins, including late reload receipts.
      action.setEffectiveTimeScale(0);
    } else if (cadence !== null) {
      action.time = action.getClip().duration * pose.phase;
      action.setEffectiveTimeScale(0);
    } else action.setEffectiveTimeScale(1);
  };
  let key;
  if (!pose.alive) {
    key = `death_${pose.deathVariant}`;
    add(e.actions[key] ? key : 'death', null, 1, pose.deathPhase);
    e._inertia = null;
  } else if (['throw', 'melee', 'roll', 'dance'].includes(pose.upper)) {
    key = pose.upper === 'melee' ? (pose.action.variant === 'punch_jab' ? 'melee_jab' : 'melee_cross') : pose.upper;
    add(key, null, 1, pose.action.total > 0 ? pose.action.phase : null);
  } else {
    key = pose.jump ? `jump_${pose.jump}` : (!pose.crouching && pose.turn) || pose.transition || 'loco';
    if (pose.jump) add(key, false, 1, pose.jump === 'loop' ? null : pose.jumpPhase);
    else if (pose.turn && !pose.crouching) add(key, false, 1, pose.turnPhase); // both turn clips stand
    else if (pose.transition) add(key, false, 1, pose.transitionPhase);
    else for (const gait of pose.gait) add(gait.key, false, gait.weight,
      pose.moving ? pose.phase : null, pose.moving ? pose.cadence : null);
    const upperKey = pose.upper === 'sprint' ? 'sprint' : `${pose.weapon}_${pose.upper}`;
    add(upperKey, true, 1, pose.upper === 'reload' || pose.upper === 'fire' && pose.action.total > 0
      ? pose.action.phase : null);
  }
  const all = new Set(Object.values(e.actions));
  for (const pair of e._presentationMasks?.values() ?? []) for (const action of Object.values(pair)) if (action) all.add(action);
  for (const action of all) {
    if (action === e.actions._breathing || action === e.actions._hitAdditive) continue;
    if (!selected.has(action)) action.stop();
  }
  e._presentationActive = selected;
  const transitionKey = `${key}/${pose.upper}/${pose.gait.map(g => g.key).join('+')}`;
  if (e._presentationKey !== transitionKey && pose.alive && !normalized.reset) _snapBones(e, INERTIA_OMEGA);
  // Order per frame: inertia restore -> mixer -> rest-aware correction -> inertia.
  _restoreInertia(e);
  e._presentationKey = transitionKey;
  e.currentClip = pose.alive && pose.upper === 'reload' ? 'reload' : key;
  e._inLocoMode = key === 'loco';
  if (e.actions._breathing) {
    e.actions._breathing.setEffectiveWeight(!pose.alive || pose.reducedMotion ? 0 : pose.aiming ? .4 : .75);
    if (pose.alive) e.actions._breathing.play(); else e.actions._breathing.stop();
  }
  if (e.actions._hitAdditive) {
    if (pose.alive && pose.damage && !pose.reducedMotion) {
      e._presentationDamageRemaining = .3;
      e.actions._hitAdditive.reset().setEffectiveWeight(.25).play();
    } else e._presentationDamageRemaining = Math.max(0, (e._presentationDamageRemaining ?? 0) - dt);
    if (!pose.alive || pose.reducedMotion || !e._presentationDamageRemaining) e.actions._hitAdditive.stop();
  }
  if (updateMixer) finishPresentation(e, dt);
  return pose;
}
export function finishPresentation(e, dt, measurement = null) {
  // Optional offline measurement; the production path reads no timer and owns no clock.
  const clock = () => measurement ? performance.now() : 0;
  let start = clock();
  restorePresentationCorrection(e);
  const restored = clock();
  e.mixer?.update(dt);
  const mixed = clock();
  if (e.presentation) correctPresentationBones(e, e.presentation);
  const corrected = clock();
  _tickInertia(e, dt);
  const inertial = clock();
  if (e.presentation) updateWeaponHandling(actorHandling(e), e.presentation);
  if (measurement) {
    measurement.mixerMs = mixed - restored;
    measurement.inertiaMs = inertial - corrected;
    measurement.correctionMs = restored - start + corrected - mixed + clock() - inertial;
  }
}
function actorHandling(e) {
  const root = e.mesh?.getObjectByName('enemyWeaponMount')?.children[0];
  return root ? getWeaponHandling(root) : null;
}
/** Observation of the actual contributing actions, without exposing live bindings. */
export function inspectPresentationLayers(e) {
  return Array.from(e._presentationActive?.keys() ?? [], action => ({
    clip: action.getClip().name, duration: action.getClip().duration, time: action.time,
    weight: action.getEffectiveWeight(), scheduled: action.isScheduled(),
    tracks: action.getClip().tracks.map(track => track.name),
  }));
}

// ── Skeleton debug ────────────────────────────────────────────────────────
// Attaches AxesHelper (XYZ arrows) to each animated node so you can see the
// pivot points moving in real time. Toggled by F3 alongside wall-mesh debug.
//
// Uses child indices directly (more reliable than name lookup on first run):
//   [2]=legL  [3]=legR  [4]=thighL  [5]=thighR
//   [6]=kneeL [7]=kneeR [12]=armSwingL [13]=armSwingR
// Indices of animated child meshes inside the enemy Group (mirrors enemy.js build order)
const ANIM_INDICES = [2, 3, 4, 5, 6, 7, 12, 13];
let _skeletonDebugOn = false; // toggle with F3
const _allHelpers = [];

function makeAxes(size = 0.5) {
  const ax = new THREE.AxesHelper(size);
  ax.material.userData.characterOwned = true;
  // Render on top of all geometry so they're never hidden inside a mesh
  ax.material.depthTest = false;
  ax.material.depthWrite = false;
  ax.renderOrder = 999;
  ax.visible = _skeletonDebugOn;
  return ax;
}

// Helpers are retained here so F3 can toggle them all. Each helper holds a parent
// chain back to its enemy's skeleton, so entries for despawned enemies would pin the
// whole mesh graph in memory — every wave respawn leaked 10 skeletons. Drop detached
// entries on each attach so the list only ever holds live helpers.
function _pruneHelpers() {
  for (let i = _allHelpers.length - 1; i >= 0; i--) {
    let n = _allHelpers[i], inScene = false;
    while (n) { if (n.isScene) { inScene = true; break; } n = n.parent; }
    if (!inScene) _allHelpers.splice(i, 1);
  }
}

export function attachSkeletonDebug(mesh) {
  _pruneHelpers();
  let attached = 0;
  // Procedural enemies: use fixed child indices (guaranteed by enemy.js build order)
  for (const idx of ANIM_INDICES) {
    const node = mesh.children[idx];
    if (!node) continue;
    const ax = makeAxes();
    node.add(ax);
    _allHelpers.push(ax);
    attached++;
  }
  // GLTF enemies: search by actual Quaternius/UE4 bone names
  if (attached === 0) {
    const names = [
      'thigh_l', 'thigh_r', 'calf_l', 'calf_r',
      'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r',
      'spine_01', 'pelvis', 'Head',
    ];
    for (const name of names) {
      const node = mesh.getObjectByName(name);
      if (!node) continue;
      const ax = makeAxes(0.18); // smaller axes — GLTF bones are dense
      node.add(ax);
      _allHelpers.push(ax);
    }
  }
}

export function detachSkeletonDebug(mesh) {
  const nodes = new Set();
  mesh.traverse(node => nodes.add(node));
  for (let i = _allHelpers.length - 1; i >= 0; i--) {
    if (nodes.has(_allHelpers[i])) _allHelpers.splice(i, 1);
  }
}

export function setSkeletonDebugVisible(v) {
  _skeletonDebugOn = v;
  for (const h of _allHelpers) h.visible = v;
}

// ── Per-enemy animation tick ──────────────────────────────────────────────
// Drives jump-phase + locomotion blend tree + override clip selection.
// Called every frame by both enemy-bot and friendly-bot tickers.
export function tickEnemyAnimation(e, dt) {
  if (e._botMesh !== e.mesh) {
    e._botMesh = e.mesh; e._botTime = 0; e._botHealth = e.hp;
    e._botMuzzle = 0; e._botShotAt = null; e._botStun = 0;
  }
  e._botTime += dt;
  const shot = e.muzzleFlashT > 0 && e.muzzleFlashT > e._botMuzzle;
  if (shot) e._botShotAt = e._botTime;
  const elapsed = e._botShotAt === null ? Infinity : e._botTime - e._botShotAt;
  const damage = e.hp < e._botHealth || e.stunTimer > 0 && e._botStun <= 0;
  e._botHealth = e.hp; e._botMuzzle = e.muzzleFlashT; e._botStun = e.stunTimer;
  const weapon = {assault:'m4',smg:'p90',sniper:'awp',pistol:'pistol'}[e.weaponRole] ?? 'm4';
  const fireTotal = weapon === 'awp' ? WEAPONS.awp.fireRate / 1000 : .2;
  // No bot reload state exists. Muzzle/stun/health observations are cosmetics only.
  return tickPresentation(e, { identity: 'bot', generation: e.mesh.uuid,
    sampleTimeSeconds: e._botTime, position: {x:e.x,y:e.mesh.position.y,z:e.z},
    bodyYaw: e.facingY, aimYaw: e.facingY, pitch: 0, alive: !e.dead,
    crouching: e.crouching, onGround: e.onGround, verticalVelocity: e.velY,
    weapon, aiming: e.state === 'attack' || e.state === 'spotted',
    trustedDamage: damage, action: elapsed < fireTotal
      ? {kind:'fire',total:fireTotal,elapsed} : {kind:'ready'},
    reducedMotion: typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true }, dt);
}

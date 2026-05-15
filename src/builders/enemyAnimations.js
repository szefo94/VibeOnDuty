import * as THREE from 'three';

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
const MAX_ENEMY_SPEED = 3.6; // ENEMY_SPEED * max speedMult

function _setLocoWeights(actions, speedN, strN) {
  const strAmt = Math.abs(strN);
  const fwdFrac = Math.max(0, 1 - strAmt);

  const idleW = Math.max(0, 1 - speedN * 3);
  const walkW = Math.max(0, 1 - Math.abs(speedN * 2 - 1)) * fwdFrac;
  const runW  = Math.max(0, speedN * 2 - 1) * fwdFrac;
  const strLW = Math.max(0, -strN);
  const strRW = Math.max(0,  strN);

  const sum = idleW + walkW + runW + strLW + strRW || 1;

  if (actions.idle)     actions.idle    .setEffectiveWeight(idleW / sum);
  if (actions.walk)     actions.walk    .setEffectiveWeight(walkW / sum);
  if (actions.run)      actions.run     .setEffectiveWeight(runW  / sum);
  if (actions.strafe_l) {
    if (!actions.strafe_l.isRunning()) actions.strafe_l.play();
    actions.strafe_l.setEffectiveWeight(strLW / sum);
  }
  if (actions.strafe_r) {
    if (!actions.strafe_r.isRunning()) actions.strafe_r.play();
    actions.strafe_r.setEffectiveWeight(strRW / sum);
  }
}

function _exitLocoMode(e) {
  if (!e._inLocoMode) return;
  for (const n of LOCO_CLIPS) { const a = e.actions[n]; if (a) a.setEffectiveWeight(0); }
  e._inLocoMode = false;
}

function _snapBones(e) {
  if (!e._bones?.length) return;
  e._inertia = new Map();
  e._inertiaT = 0;
  for (const bone of e._bones) e._inertia.set(bone.uuid, bone.quaternion.clone());
}

function _enterLocoMode(e) {
  if (e._inLocoMode) return;
  const a = e.actions[e.currentClip];
  if (a && !LOCO_CLIPS.has(e.currentClip)) { _snapBones(e); a.setEffectiveWeight(0); }
  e._inLocoMode = true;
  e.currentClip = 'idle';
}

// ── Inertial blending ──────────────────────────────────────────────────────
// Critically-damped spring: settles bone pose from snapshot toward new clip.
// Applied after mixer.update() so the correction overrides the mixer output.
const INERTIA_OMEGA = 22;

function _tickInertia(e, dt) {
  if (!e._inertia) return;
  e._inertiaT += dt;
  const decay = (1 + INERTIA_OMEGA * e._inertiaT) * Math.exp(-INERTIA_OMEGA * e._inertiaT);
  if (decay < 0.001) { e._inertia = null; return; }
  for (const bone of e._bones) {
    const snap = e._inertia.get(bone.uuid);
    if (!snap) continue;
    bone.quaternion.copy(snap.clone().slerp(bone.quaternion, 1 - decay));
  }
}

export function tickInertia(e, dt) { _tickInertia(e, dt); }

// ── Crossfade helper ──────────────────────────────────────────────────────
// Call once per frame after computing the desired clip name.
// e must have { actions, currentClip } on it.
export function crossfade(e, to, dur = 0.22) {
  if (to === e.currentClip || !e.actions[to]) return;
  // Snap transitions: snapshot bones so inertial blending can soften the pop.
  if (dur === 0) _snapBones(e);
  const from = e.actions[e.currentClip];
  const toAct = e.actions[to];
  // Standard Three.js crossfade pattern: fade out old, reset + fade in new.
  // crossFadeTo(warp=true) was avoided — it warps the incoming clip's timeScale 0→1,
  // freezing it at frame 0 (bind/T-pose) for the entire blend duration.
  if (from) from.fadeOut(dur);
  // setEffectiveWeight(1) restores this.weight=1 before fadeIn schedules its 0→1 interpolant.
  // Phase 41 pre-started loco clips at weight=0; without this, effectiveWeight = 0 * interpolant = 0 forever.
  toAct.reset().setEffectiveWeight(1).fadeIn(dur).play();
  e.currentClip = to;
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
let _skeletonDebugOn = true; // ON by default — toggle with F3
const _allHelpers = [];

function makeAxes(size = 0.5) {
  const ax = new THREE.AxesHelper(size);
  // Render on top of all geometry so they're never hidden inside a mesh
  ax.material.depthTest = false;
  ax.material.depthWrite = false;
  ax.renderOrder = 999;
  ax.visible = _skeletonDebugOn;
  return ax;
}

export function attachSkeletonDebug(mesh) {
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

export function setSkeletonDebugVisible(v) {
  _skeletonDebugOn = v;
  for (const h of _allHelpers) h.visible = v;
}

// ── Per-enemy animation tick ──────────────────────────────────────────────
// Drives jump-phase + locomotion blend tree + override clip selection.
// Called every frame by both enemy-bot and friendly-bot tickers.
const E_JUMP_START_DUR = 0.32;
const E_JUMP_LAND_DUR  = 0.38;
const SNAP_CLIPS = new Set(['crouch', 'crouch_walk', 'death', 'hit', 'roll', 'jump_start', 'jump_land']);

export function tickEnemyAnimation(e, dt, isMoving) {
  const nowOnGround = e.onGround;

  // Jump phase bookkeeping
  if (!e._prevOnGround && nowOnGround)      { e.jumpPhase = 'land';  e.jumpPhaseTimer = E_JUMP_LAND_DUR; }
  else if (e._prevOnGround && !nowOnGround) { e.jumpPhase = 'start'; e.jumpPhaseTimer = E_JUMP_START_DUR; }
  e._prevOnGround = nowOnGround;
  if (e.jumpPhase === 'start') { e.jumpPhaseTimer -= dt; if (e.jumpPhaseTimer <= 0) e.jumpPhase = nowOnGround ? '' : 'loop'; }
  if (e.jumpPhase === 'land')  { e.jumpPhaseTimer -= dt; if (e.jumpPhaseTimer <= 0) e.jumpPhase = ''; }

  // Additive hit reaction — GLTF only; procedural falls through to full hit clip below
  if (e.actions._hitAdditive) {
    if (e.stunTimer > 0) {
      if (!e._hitAddPlaying) { e.actions._hitAdditive.reset().fadeIn(0.03).play(); e._hitAddPlaying = true; }
    } else if (e._hitAddPlaying) {
      e.actions._hitAdditive.fadeOut(0.12); e._hitAddPlaying = false;
    }
  }

  // Lazy bone collection for inertial blending (SkinnedMesh skeleton, GLTF only)
  if (!e._bonesInit) {
    e._bonesInit = true;
    e._bones = [];
    e.mesh.traverse(obj => {
      if (obj.isSkinnedMesh && obj.skeleton) {
        for (const b of obj.skeleton.bones) if (!e._bones.includes(b)) e._bones.push(b);
      }
    });
  }

  // Position-derived velocity — captures strafe + knockback (velX/velZ miss direct-pos moves)
  const prevX = e._prevX ?? e.x, prevZ = e._prevZ ?? e.z;
  e._prevX = e.x; e._prevZ = e.z;
  const velX = dt > 0 ? (e.x - prevX) / dt : 0;
  const velZ = dt > 0 ? (e.z - prevZ) / dt : 0;
  const speed  = Math.sqrt(velX * velX + velZ * velZ);
  const speedN = Math.min(1, speed / MAX_ENEMY_SPEED);

  // Strafe component: project velocity onto entity's right axis
  // forward = (-sin(facingY), -cos(facingY)), right = (-cos(facingY), sin(facingY))
  const rgtX  = -Math.cos(e.facingY), rgtZ = Math.sin(e.facingY);
  const strN  = speed > 0.05 ? Math.max(-1, Math.min(1, (velX * rgtX + velZ * rgtZ) / MAX_ENEMY_SPEED)) : 0;

  // ── Override clip selection (non-locomotion states) ────────────────────
  let overrideClip = null;
  if (e.jumpPhase === 'land' && e.actions.jump_land) {
    overrideClip = 'jump_land';
  } else if (!nowOnGround) {
    overrideClip = e.jumpPhase === 'start' && e.actions.jump_start ? 'jump_start'
                 : e.actions.jump_loop ? 'jump_loop' : null;
  } else if (e.stunTimer > 0 && e.actions.hit && !e.actions._hitAdditive) {
    overrideClip = 'hit'; // procedural fallback — GLTF uses additive layer above
  } else if (e.crouching) {
    overrideClip = speedN > 0.05
      ? (e.actions.crouch_walk ? 'crouch_walk' : 'walk')
      : (e.actions.crouch      ? 'crouch'      : null);
  } else if (e.muzzleFlashT > 0 && e.actions.shoot) {
    overrideClip = 'shoot';
  } else if ((e.state === 'attack' || e.state === 'spotted') && speedN < 0.05 && e.actions.attack) {
    overrideClip = 'attack'; // standing still in attack stance
  }

  // ── Drive animation ────────────────────────────────────────────────────
  if (overrideClip) {
    _exitLocoMode(e);
    const snap = SNAP_CLIPS.has(overrideClip) || SNAP_CLIPS.has(e.currentClip);
    crossfade(e, overrideClip, snap ? 0 : 0.22);
  } else {
    _enterLocoMode(e);
    _setLocoWeights(e.actions, speedN, strN);
  }

  e.mixer.update(dt);
  _tickInertia(e, dt);
}

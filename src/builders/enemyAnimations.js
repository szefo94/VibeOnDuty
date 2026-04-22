import * as THREE from 'three';

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

  return { mixer, actions };
}

// ── Crossfade helper ──────────────────────────────────────────────────────
// Call once per frame after computing the desired clip name.
// e must have { actions, currentClip } on it.
export function crossfade(e, to, dur = 0.22) {
  if (to === e.currentClip || !e.actions[to]) return;
  const from = e.actions[e.currentClip];
  const toAct = e.actions[to];
  // Standard Three.js crossfade pattern: fade out old, reset + fade in new.
  // crossFadeTo(warp=true) was avoided — it warps the incoming clip's timeScale 0→1,
  // freezing it at frame 0 (bind/T-pose) for the entire blend duration.
  if (from) from.fadeOut(dur);
  toAct.reset().fadeIn(dur).play();
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
// Drives jump-phase state machine + selects and crossfades to the right clip.
// Called every frame by both enemy-bot and friendly-bot tickers.
const E_JUMP_START_DUR = 0.32;
const E_JUMP_LAND_DUR  = 0.38;

export function tickEnemyAnimation(e, dt, isMoving) {
  const nowOnGround = e.onGround;
  if (!e._prevOnGround && nowOnGround) {
    e.jumpPhase = 'land';
    e.jumpPhaseTimer = E_JUMP_LAND_DUR;
  } else if (e._prevOnGround && !nowOnGround) {
    e.jumpPhase = 'start';
    e.jumpPhaseTimer = E_JUMP_START_DUR;
  }
  e._prevOnGround = nowOnGround;
  if (e.jumpPhase === 'start') {
    e.jumpPhaseTimer -= dt;
    if (e.jumpPhaseTimer <= 0) e.jumpPhase = nowOnGround ? '' : 'loop';
  }
  if (e.jumpPhase === 'land') {
    e.jumpPhaseTimer -= dt;
    if (e.jumpPhaseTimer <= 0) e.jumpPhase = '';
  }

  let clip;
  if (e.jumpPhase === 'land' && e.actions.jump_land) {
    clip = 'jump_land';
  } else if (!nowOnGround) {
    if (e.jumpPhase === 'start' && e.actions.jump_start) clip = 'jump_start';
    else clip = e.actions.jump_loop ? 'jump_loop' : 'idle';
  } else if (e.stunTimer > 0 && e.actions.hit) {
    clip = 'hit';
  } else if (e.crouching) {
    clip = isMoving
      ? (e.actions.crouch_walk ? 'crouch_walk' : 'walk')
      : (e.actions.crouch      ? 'crouch'      : 'idle');
  } else if (e.state === 'attack' || e.state === 'spotted') {
    if (isMoving) {
      clip = e.actions.run ? 'run' : 'walk';
    } else if (e.muzzleFlashT > 0 && e.actions.shoot) {
      clip = 'shoot';
    } else {
      clip = 'attack';
    }
  } else {
    clip = isMoving ? 'walk' : 'idle';
  }
  const SNAP_CLIPS = new Set(['crouch', 'crouch_walk', 'death', 'hit', 'roll', 'jump_start', 'jump_land']);
  const snapTransition = SNAP_CLIPS.has(clip) || SNAP_CLIPS.has(e.currentClip);
  crossfade(e, clip, snapTransition ? 0 : 0.22);
  e.mixer.update(dt);
}

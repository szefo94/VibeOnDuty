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
import { buildEnemyMixer, attachSkeletonDebug, buildGLTFBreathingClip } from './enemyAnimations.js';
import { attachEnemyWeapon } from './enemyWeapon.js';
import { attachWeapons3pToHand } from './weaponFBX.js';

// ── State ──────────────────────────────────────────────────────────────────
let gltfTemplate = null;
export let usingGLTF = false;

// ── Player GLTF instance (built once after GLB loads) ─────────────────────
export let playerMesh = null;
export let playerMixer = null;
export let playerActions = null;

// ── Clip aliases — maps internal state names to GLB clip names ────────────
// Retargeted rifle clips listed first so they win over old pistol clips.
const ALIASES = {
  idle:        ['attack',           'Idle_Loop',        'Idle',   'idle',   'T-Pose', 'A_TPose'],
  walk:        ['walk',             'Walk_Loop',        'Walk',   'Walking'],
  run:         ['run',              'Jog_Fwd_Loop',     'Sprint_Loop',  'Run'],
  attack:      ['attack',           'Pistol_Aim_Neutral', 'Pistol_Idle_Loop'],
  shoot:       ['shoot',            'Pistol_Shoot',     'Shoot',  'Fire'],
  crouch:      ['Crouch_Idle_Loop', 'Crouch_Idle', 'Crouch'],
  crouch_walk: ['Crouch_Fwd_Loop',  'Crouch_Walk'],
  death:       ['Death01',          'Death',  'death',  'Die'],
  hit:         ['hit',              'Hit_Chest',        'Hit_Head'],
  roll:        ['Roll',             'roll',   'Dive'],
  jump_start:  ['Jump_Start',       'Jump_start',       'jump_loop'],
  // Prefer uppercase Jump_Loop (original, no CORR) so all three jump clips share
  // the same coordinate space as Jump_Start and Jump_Land — the retargeted
  // lowercase jump_loop has +90°X baked in, causing ~180° mismatches on crossfade.
  jump_loop:   ['Jump_Loop',        'Jump_loop',        'jump_loop'],
  jump_land:   ['Jump_Land',        'Jump_land'],
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
const CLIP_KEYS = [
  'idle', 'walk', 'run', 'attack', 'shoot', 'crouch', 'crouch_walk',
  'death', 'hit', 'roll', 'jump_start', 'jump_loop', 'jump_land', 'reload',
  'run_back', 'walk_back', 'strafe_l', 'strafe_r', 'nade', 'dance', 'punch_cross', 'punch_jab',
];
// Minimum clips required — fall back to procedural if none of these match
const REQUIRED_KEYS = ['idle', 'walk'];

function findClip(animations, key) {
  for (const alias of (ALIASES[key] || [])) {
    const found = animations.find((c) => c.name === alias);
    if (found) return found;
  }
  return null;
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
// docs/ANIMATION-SPACES.md for the measurements and the upstream fix.

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
function normaliseClipQuatSigns(clips) {
  const refClip = clips.find((c) => c.name === 'attack' || c.name === 'Idle_Loop' || c.name === 'idle');
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
  const hitClip  = findClip(gltfTemplate.animations, 'hit');
  const idleClip = findClip(gltfTemplate.animations, 'idle');
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

// ── EXPERIMENTAL: retarget-space correction (default OFF) ──────────────────
// enemy.glb holds two clip families that were retargeted differently. Measured mean
// bone angle from each clip to the idle anchor (`attack`):
//
//   already aligned : shoot 0.4  reload 3.5  nade 6.2  strafe_l 4.2  walk 6.7  run 8.9
//   misaligned      : Jump_Loop 39.9  Death01 42.4  Jump_Start 44.9  Crouch 45.7/46.3
//                     Roll 48.5  Jump_Land 62.1  Punch 66.0/66.1  Dance_Loop 67.6
//
// Every override transition therefore blends across 38-68 deg, which is what the
// INSTANT_SNAP/omega machinery in enemyAnimations.js exists to hide.
//
// The two families differ by a per-bone rotation, recoverable from a pair of clips
// that are the same animation in both spaces (fitting walk<-Walk_Loop reproduces the
// retargeted clip to 3.2 deg, and predicts a held-out pair to 9.8 deg vs 70.4 deg
// uncorrected). Applying it drops the misaligned clips to roughly 10-26 deg.
//
// It is OFF by default because the best-fitting delta differs per clip family, so it
// is partly curve-fitting rather than a pure space transform, and the result needs a
// human eye on it. The real fix is upstream: re-export from Blender against one rest
// pose. See docs/ANIMATION-SPACES.md.
//
// Enable for a session with:  localStorage.animSpaceFix = 1  (then reload)
const SPACE_FIX_SOURCES = {
  // targetClip -> [retargetedClip, originalClip] pair to fit the delta from,
  // chosen per clip by measured post-fix distance to the idle anchor.
  Crouch_Idle_Loop: ['jump_loop', 'Jump_Loop'],   // 46.3 -> 19.3
  Crouch_Fwd_Loop:  ['jump_loop', 'Jump_Loop'],   // 45.7 -> 18.1
  Roll:             ['jump_loop', 'Jump_Loop'],   // 48.5 -> 25.8
  Jump_Start:       ['jump_loop', 'Jump_Loop'],   // 44.9 -> 14.5
  Jump_Loop:        ['jump_loop', 'Jump_Loop'],   // 39.9 ->  9.7
  Death01:          ['jump_loop', 'Jump_Loop'],   // 42.4 -> 23.4
  Jump_Land:        ['walk',      'Walk_Loop'],   // 62.1 -> 14.9
  Dance_Loop:       ['walk',      'Walk_Loop'],   // 67.6 ->  9.2
  Punch_Cross:      ['walk',      'Walk_Loop'],   // 66.1 -> 11.9
  Punch_Jab:        ['walk',      'Walk_Loop'],   // 66.0 -> 11.7
};

function spaceFixEnabled() {
  try { return localStorage.getItem('animSpaceFix') === '1'; } catch { return false; }
}

// Sample a quaternion track at normalised phase u in [0,1).
function _sampleQ(track, u, out) {
  const t = track.times, v = track.values;
  const x = u * t[t.length - 1];
  let i = 0;
  while (i < t.length - 2 && t[i + 1] < x) i++;
  const a = t[i], b = t[i + 1] ?? a;
  const f = b > a ? (x - a) / (b - a) : 0;
  THREE.Quaternion.slerpFlat(_sfArr, 0, v, i * 4, v, (i + 1) * 4 < v.length ? (i + 1) * 4 : i * 4, f);
  return out.fromArray(_sfArr);
}
const _sfArr = [0, 0, 0, 1];

// Fit D_bone so that  q_retargeted(t) ~= D_bone * q_original(t), searching phase offset.
function fitSpaceDelta(clips, retName, origName) {
  const R = clips.find(c => c.name === retName), O = clips.find(c => c.name === origName);
  if (!R || !O) return null;
  const qt = (clip) => Object.fromEntries(clip.tracks
    .filter(t => t.name.endsWith('.quaternion'))
    .map(t => [t.name.slice(0, -'.quaternion'.length), t]));
  const rT = qt(R), oT = qt(O);
  const bones = Object.keys(oT).filter(b => rT[b]);
  const N = 24, qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), acc = new THREE.Quaternion();

  let best = null;
  for (let p = 0; p < 24; p++) {
    const shift = p / 24, D = {};
    let err = 0, n = 0;
    for (const b of bones) {
      let ax = 0, ay = 0, az = 0, aw = 0;
      for (let i = 0; i < N; i++) {
        const u = i / N;
        _sampleQ(rT[b], (u + shift) % 1, qa);
        _sampleQ(oT[b], u, qb);
        acc.copy(qa).multiply(qb.invert());          // D = q_ret * q_orig^-1
        const sgn = (ax * acc.x + ay * acc.y + az * acc.z + aw * acc.w) < 0 ? -1 : 1;
        ax += sgn * acc.x; ay += sgn * acc.y; az += sgn * acc.z; aw += sgn * acc.w;
      }
      const d = new THREE.Quaternion(ax, ay, az, aw).normalize();
      D[b] = d;
      for (let i = 0; i < N; i++) {
        const u = i / N;
        _sampleQ(oT[b], u, qb);
        _sampleQ(rT[b], (u + shift) % 1, qa);
        qb.premultiply(d);
        err += Math.acos(Math.min(1, Math.abs(qa.dot(qb)))) * 2; n++;
      }
    }
    const mean = err / n;
    if (!best || mean < best.mean) best = { D, mean };
  }
  return best;
}

function applySpaceFix(clips) {
  const cache = new Map(), q = new THREE.Quaternion();
  let done = 0;
  for (const [target, [ret, orig]] of Object.entries(SPACE_FIX_SOURCES)) {
    const clip = clips.find(c => c.name === target);
    if (!clip) continue;
    const key = ret + '|' + orig;
    if (!cache.has(key)) {
      const f = fitSpaceDelta(clips, ret, orig);
      if (f) console.log(`[GLTF] space delta ${ret} <- ${orig}: fit residual ${(f.mean * 180 / Math.PI).toFixed(1)} deg`);
      cache.set(key, f);
    }
    const fit = cache.get(key);
    if (!fit) continue;
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.quaternion')) continue;
      const D = fit.D[track.name.slice(0, -'.quaternion'.length)];
      if (!D) continue;
      const v = track.values;
      for (let i = 0; i < v.length; i += 4) {
        q.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(D);
        v[i] = q.x; v[i + 1] = q.y; v[i + 2] = q.z; v[i + 3] = q.w;
      }
    }
    done++;
  }
  console.log(`[GLTF] anim space fix applied to ${done} clips (experimental; unset localStorage.animSpaceFix to disable)`);
}

// ── Load ───────────────────────────────────────────────────────────────────
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
    const gltf = await loader.loadAsync(import.meta.env.BASE_URL + 'models/enemy.glb');
    // GLB reuses the same Float32Array between clips that share a GLTF accessor.
    // Clone all track data before any mutation so each clip owns its arrays.
    for (const clip of gltf.animations)
      for (const track of clip.tracks) {
        track.values = track.values.slice();
        track.times  = track.times.slice();
      }
    stripRedundantTracks(gltf);
    if (spaceFixEnabled()) applySpaceFix(gltf.animations);
    normaliseClipQuatSigns(gltf.animations);
    // Align jump phase clip boundaries — sign-flip guard after shared-space normalisation.
    alignClipBoundaries(gltf.animations, 'jump_start', 'jump_loop');
    alignClipBoundaries(gltf.animations, 'jump_loop',  'jump_land', { useFirstFrame: true });
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

  for (const key of CLIP_KEYS) {
    const clip = findClip(gltfTemplate.animations, key);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    if (['death', 'hit', 'shoot', 'roll', 'jump_start', 'jump_land', 'reload', 'punch_cross', 'punch_jab', 'nade'].includes(key)) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }
    actions[key] = action;
  }


  // Require at least idle + walk — otherwise fall back to procedural
  if (REQUIRED_KEYS.some((k) => !actions[k])) {
    console.warn('[GLTF] Required clips missing — falling back to procedural');
    scene.remove(clone);
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
  attachEnemyWeapon(clone, role);

  // Quaternius mannequin faces +Z at rotation.y=0; game convention is -Z forward.
  // Callers add facingOffset to e.mesh.rotation.y so enemies face the right direction.
  return { mesh: clone, muzzleFlash, mixer, actions, facingOffset: Math.PI };
}

// ── Player GLTF instance ──────────────────────────────────────────────────
// Call once after tryLoadEnemyGLTF() succeeds. Adds the mesh to the scene
// (visible=false) and sets up mixer + actions identical to enemy build.
export function buildPlayerMesh() {
  if (!usingGLTF || !gltfTemplate) return false;

  const clone = skeletonClone(gltfTemplate.scene);
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
    const clip = findClip(gltfTemplate.animations, key);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    if (['death', 'hit', 'shoot', 'roll', 'jump_start', 'jump_land', 'reload', 'punch_cross', 'punch_jab', 'nade'].includes(key)) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }
    actions[key] = action;
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

  attachSkeletonDebug(clone);
  attachWeapons3pToHand(clone);

  playerMesh = clone;
  playerMixer = mixer;
  playerActions = actions;
  return true;
}

// ── Team tint ─────────────────────────────────────────────────────────────
// Clones every material on the mesh so siblings are unaffected, then
// applies an emissive tint (preserves GLTF textures). Falls back to color.
export function disposeEnemyMaterials(mesh) {
  _disposeTinted(mesh);
}

function _disposeTinted(mesh) {
  mesh.traverse((ch) => {
    if (!ch.isMesh || !ch.material) return;
    for (const m of (Array.isArray(ch.material) ? ch.material : [ch.material]))
      if (m?.userData?._tinted) m.dispose();
  });
}

function _applyTint(mat, col) {
  const c = mat.clone();
  c.userData._tinted = true;   // marks a clone this module owns, safe to dispose
  // Set base color for full-body recolor (multiplies with texture if present)
  if (c.color !== undefined) c.color.set(col);
  // Add mild emissive so team color reads in dark areas
  if (c.emissive !== undefined) { c.emissive.set(col); c.emissiveIntensity = 0.18; }
  return c;
}

export function tintEnemyMesh(mesh, hexColor) {
  if (!mesh) return;
  // Free the previous tint clones first — tintEnemyMesh runs on every spawn and every
  // team reassignment, so without this each wave leaked a full material set per enemy
  // (plus its compiled GPU program).
  _disposeTinted(mesh);
  const col = new THREE.Color(hexColor);
  mesh.traverse((ch) => {
    if (!ch.isMesh || !ch.material) return;
    // Preserve array vs single to avoid breaking geometry group rendering
    if (Array.isArray(ch.material)) {
      ch.material = ch.material.map((m) => _applyTint(m, col));
    } else {
      ch.material = _applyTint(ch.material, col);
    }
  });
}

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
import { buildEnemyMixer, attachSkeletonDebug } from './enemyAnimations.js';
import { attachPistolToHand } from './enemyWeapon.js';
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
  jump_start:  ['jump_loop',        'Jump_Start',       'Jump_start'],
  jump_loop:   ['jump_loop',        'Jump_Loop',        'Jump_loop'],
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

// ── Undo merge-script CORR on retargeted clips ────────────────────────────
// merge_animations.py applied qmul(CORR, q) where CORR = +90° X to every
// rotation keyframe in the 12 retargeted clips. The original 45 clips have
// no such correction. This puts them in incompatible spaces → 270° spins on
// any crossfade between them. Fix: premultiply the inverse (-90° X) at load
// time so all clips end up in the same coordinate space.
const RETARGETED_CLIPS = new Set([
  'walk','run','attack','shoot','reload','hit',
  'jump_loop','nade','run_back','walk_back','strafe_l','strafe_r',
]);
const _corrInv = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2); // -90° X
const _qTmp    = new THREE.Quaternion();

function undoMergeCORR(clips) {
  for (const clip of clips) {
    if (!RETARGETED_CLIPS.has(clip.name)) continue;
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.quaternion')) continue;
      const v = track.values;
      for (let i = 0; i < v.length; i += 4) {
        _qTmp.set(v[i], v[i+1], v[i+2], v[i+3]).premultiply(_corrInv);
        v[i] = _qTmp.x; v[i+1] = _qTmp.y; v[i+2] = _qTmp.z; v[i+3] = _qTmp.w;
      }
    }
  }
}

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

      // Step 1: within-track continuity
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
    }
  }
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
    normaliseClipQuatSigns(gltf.animations);
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

// ── Build ─────────────────────────────────────────────────────────────────
// Returns { mesh, muzzleFlash, mixer, actions, facingOffset }
// facingOffset: 0 for procedural (faces -Z), Math.PI for GLTF (faces +Z by export default)
export function buildEnemyMesh(wx, wz) {

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
  attachPistolToHand(clone);

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
  clone.traverse((ch) => { if (ch.isMesh) ch.castShadow = true; });
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

  attachSkeletonDebug(clone);
  attachWeapons3pToHand(clone);

  playerMesh = clone;
  playerMixer = mixer;
  playerActions = actions;
  return true;
}

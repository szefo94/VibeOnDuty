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
import { attachP90ToPlayerHand } from './weaponFBX.js';
import { loadFBXAnimations } from './animLoader.js';

// ── State ──────────────────────────────────────────────────────────────────
let gltfTemplate = null;
export let usingGLTF = false;
let _fbxClips = {};   // extra clips loaded from FBX pack (run_back, strafe_l/r, shoot)

// ── Player GLTF instance (built once after GLB loads) ─────────────────────
export let playerMesh = null;
export let playerMixer = null;
export let playerActions = null;

// ── Clip aliases — maps internal state names to GLB clip names ────────────
const ALIASES = {
  idle:        ['Idle_Loop',        'Idle',   'idle',   'T-Pose', 'A_TPose', 'Armature|Idle'],
  walk:        ['Walk_Loop',        'Walk',   'walk',   'Walking', 'Walk_Formal_Loop'],
  run:         ['Jog_Fwd_Loop',     'Sprint_Loop', 'Run', 'run', 'Running'],
  attack:      ['Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Aim', 'Attack', 'attack'],
  shoot:       ['Pistol_Shoot',     'Shoot',  'shoot',  'Fire',   'fire'],
  crouch:      ['Crouch_Idle_Loop', 'Crouch_Idle',  'Crouch'],
  crouch_walk: ['Crouch_Fwd_Loop',  'Crouch_Walk'],
  death:       ['Death01',          'Death',  'death',  'Die'],
  hit:         ['Hit_Chest',        'Hit_Head', 'Hit',  'hit'],
  roll:        ['Roll',             'roll',   'Dive',   'dive'],
  jump_start:  ['Jump_Start',       'Jump_start', 'JumpStart'],
  jump_loop:   ['Jump_Loop',        'Jump_loop',  'JumpLoop', 'InAir'],
  jump_land:   ['Jump_Land',        'Jump_land',  'JumpLand', 'Landing'],
  reload:      ['Pistol_Reload',    'Reload', 'reload'],
};

// All clip keys to attempt loading
const CLIP_KEYS = [
  'idle', 'walk', 'run', 'attack', 'shoot', 'crouch', 'crouch_walk',
  'death', 'hit', 'roll', 'jump_start', 'jump_loop', 'jump_land', 'reload',
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
    gltfTemplate = gltf;
    usingGLTF = true;
    const found = CLIP_KEYS.filter((k) => findClip(gltf.animations, k));
    console.log('[GLTF] enemy.glb loaded — matched clips:', found.join(', '));
    console.log('[GLTF] all clips in file:', gltf.animations.map((c) => c.name).join(', '));
    _fbxClips = await loadFBXAnimations();
    console.log('[GLTF] FBX extra clips:', Object.keys(_fbxClips).join(', ') || 'none');
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
    if (['death', 'hit', 'shoot', 'roll', 'jump_start', 'jump_land', 'reload'].includes(key)) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }
    actions[key] = action;
  }

  // Merge FBX extra clips (run_back, strafe_l, strafe_r, shoot override)
  for (const [key, clip] of Object.entries(_fbxClips)) {
    const action = mixer.clipAction(clip);
    if (key === 'shoot') { action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; }
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
    if (['death', 'hit', 'shoot', 'roll', 'jump_start', 'jump_land', 'reload'].includes(key)) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }
    actions[key] = action;
  }

  // Merge FBX extra clips
  for (const [key, clip] of Object.entries(_fbxClips)) {
    const action = mixer.clipAction(clip);
    if (key === 'shoot') { action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; }
    actions[key] = action;
  }

  // Start idle
  const idleClip = findClip(gltfTemplate.animations, 'idle');
  if (idleClip && actions.idle) actions.idle.time = Math.random() * idleClip.duration;
  if (actions.idle) actions.idle.play();

  attachSkeletonDebug(clone);
  attachP90ToPlayerHand(clone);

  playerMesh = clone;
  playerMixer = mixer;
  playerActions = actions;
  return true;
}

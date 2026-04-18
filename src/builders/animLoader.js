import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Mixamo (mixamorig1:*) → Quaternius/UE4 bone name map
const BONE_MAP = {
  'mixamorig1:Hips':           'pelvis',
  'mixamorig1:Spine':          'spine_01',
  'mixamorig1:Spine1':         'spine_02',
  'mixamorig1:Spine2':         'spine_03',
  'mixamorig1:Neck':           'neck_01',
  'mixamorig1:Head':           'Head',
  'mixamorig1:HeadTop_End':    'Head',
  'mixamorig1:LeftShoulder':   'clavicle_l',
  'mixamorig1:LeftArm':        'upperarm_l',
  'mixamorig1:LeftForeArm':    'lowerarm_l',
  'mixamorig1:LeftHand':       'hand_l',
  'mixamorig1:RightShoulder':  'clavicle_r',
  'mixamorig1:RightArm':       'upperarm_r',
  'mixamorig1:RightForeArm':   'lowerarm_r',
  'mixamorig1:RightHand':      'hand_r',
  'mixamorig1:LeftUpLeg':      'thigh_l',
  'mixamorig1:LeftLeg':        'calf_l',
  'mixamorig1:LeftFoot':       'foot_l',
  'mixamorig1:LeftToeBase':    'ball_l',
  'mixamorig1:RightUpLeg':     'thigh_r',
  'mixamorig1:RightLeg':       'calf_r',
  'mixamorig1:RightFoot':      'foot_r',
  'mixamorig1:RightToeBase':   'ball_r',
};

function remapClip(clip, name) {
  const tracks = [];
  for (const track of clip.tracks) {
    // Track names: "mixamorig1:Hips.position", "mixamorig1:Spine.quaternion" etc.
    const dot = track.name.indexOf('.');
    if (dot === -1) { tracks.push(track); continue; }
    const boneName = track.name.slice(0, dot);
    const prop     = track.name.slice(dot);       // ".quaternion", ".position" etc.
    const mapped   = BONE_MAP[boneName];
    if (!mapped) continue;                         // drop finger/unknown bones
    const t = track.clone();
    t.name  = mapped + prop;
    tracks.push(t);
  }
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

// FBX file → internal clip name
// Keys that match existing GLB aliases override the GLB clip.
// New keys (run_back, strafe_l/r, walk_back, nade) add new states.
const ANIM_FILES = {
  // Directional movement
  walk:      'walking.fbx',           // overrides Walk_Loop
  run:       'rifle run.fbx',         // overrides Jog_Fwd_Loop
  run_back:  'run backwards.fbx',
  walk_back: 'walking backwards.fbx',
  strafe_l:  'strafe left.fbx',
  strafe_r:  'strafe right.fbx',
  // Combat
  attack:    'rifle aiming idle.fbx', // overrides Pistol_Aim_Neutral (rifle stance)
  shoot:     'firing rifle.fbx',      // overrides Pistol_Shoot
  reload:    'reloading.fbx',         // overrides Pistol_Reload
  // Reactions
  hit:       'hit reaction.fbx',      // overrides Hit_Chest
  jump_loop: 'rifle jump.fbx',        // overrides Jump_Loop
  nade:      'toss grenade.fbx',      // new — triggered on grenade throw
};

const BASE = import.meta.env.BASE_URL + 'models/animations/';
const loader = new FBXLoader();

export async function loadFBXAnimations() {
  const clips = {};
  for (const [key, file] of Object.entries(ANIM_FILES)) {
    try {
      const probe = await fetch(BASE + encodeURIComponent(file), { method: 'HEAD' });
      if (!probe.ok) continue;
      const fbx    = await loader.loadAsync(BASE + encodeURIComponent(file));
      const src    = fbx.animations[0];
      if (!src) continue;
      clips[key] = remapClip(src, key);
      console.log(`[AnimLoader] ${key} — ${clips[key].tracks.length} tracks, ${src.duration.toFixed(2)}s`);
    } catch (err) {
      console.warn(`[AnimLoader] failed: ${file}`, err);
    }
  }
  return clips;
}

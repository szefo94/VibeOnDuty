import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { flash, replaceFbxModel, attachWeapon3pToHand } from './weapon.js';

// ── Tuning constants — FPV P90 ────────────────────────────────────────────────
// P90.fbx is ~1108 FBX units long → ~0.55 m at this scale
const SCALE   = 0.0005;
// Flip if barrel faces the wrong way after loading (try Math.PI if it's backwards)
const ROT_Y   = 0;
// Nudge the model so the grip sits at the wpn group origin
const OFFSET  = new THREE.Vector3(0.01, -0.04, 0.04);
// Muzzle flash position in wpn-local space — adjust to sit at barrel tip
const MUZZLE  = new THREE.Vector3(0, 0.012, -0.25);

// ── Material palette (keyed by FBX material name) ────────────────────────────
// MeshStandardMaterial for PBR lighting — roughness/metalness per part
const PALETTE = {
  'Material.001': new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.55, metalness: 0.7 }), // body
  'Material.002': new THREE.MeshStandardMaterial({ color: 0x111314, roughness: 0.75, metalness: 0.3 }), // grip/stock
  'Material.003': new THREE.MeshStandardMaterial({ color: 0x2c3035, roughness: 0.35, metalness: 0.9 }), // barrel/metal
  'Material.004': new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.6,  metalness: 0.5 }), // rail/details
};

export async function tryLoadWeaponFBX(path = import.meta.env.BASE_URL + 'models/FBX/P90.fbx') {
  try {
    const probe = await fetch(path, { method: 'HEAD' });
    if (!probe.ok) return false;
  } catch { return false; }

  try {
    const loader = new FBXLoader();
    const fbx   = await loader.loadAsync(path);

    fbx.scale.setScalar(SCALE);
    fbx.rotation.set(0, ROT_Y, 0);
    fbx.position.copy(OFFSET);

    fbx.traverse(ch => {
      if (!ch.isMesh) return;
      ch.castShadow    = false;
      ch.receiveShadow = false;
      ch.renderOrder   = 2;
      // Apply palette — replace each sub-material by name
      const remap = m => PALETTE[m?.name] ?? m;
      ch.material = Array.isArray(ch.material)
        ? ch.material.map(remap)
        : remap(ch.material);
    });

    replaceFbxModel(fbx);

    // Move flash to FBX barrel tip
    flash.position.copy(MUZZLE);

    console.log('[Weapon] P90.fbx loaded — adjust SCALE/ROT_Y/OFFSET/MUZZLE in weaponFBX.js if needed');
    return true;
  } catch (err) {
    console.warn('[Weapon] Failed to load P90.fbx:', err);
    return false;
  }
}

// ── P90 in player hand (3rd-person) ──────────────────────────────────────────
// Separate from FPV weapon — baked plain Mesh, auto-scaled, attached to hand_r.

// Longest axis of P90 (barrel along Z) mapped to TARGET_LEN world units
const _P90_TARGET_LEN = 0.52; // ~52 cm — realistic SMG length in scene

// Rotation in hand_r bone-local space.
// hand_r palm faces roughly +Y, fingers point +X in Quaternius rig.
// P90 barrel runs along +Z in FBX → rotate so barrel goes along +X (finger dir).
const P90_ROT = new THREE.Euler(Math.PI / 2, 0, Math.PI / 2);

// Nudge so grip sits in palm
const P90_GRIP = new THREE.Vector3(-0.02, 0.0, 0.05);

// NOTE: there used to be a tryLoadP90ForHand() here that fetched and parsed P90.fbx a
// second time to build a hand-attachable template. Nothing ever read that template —
// attachWeapons3pToHand() below uses the shared weapon3p object from weapon.js — so it
// was a duplicate download + FBXLoader parse on the boot critical path. Removed.

export function attachWeapons3pToHand(playerRoot) {
  const hand = playerRoot.getObjectByName('hand_r');
  if (!hand) { console.warn('[Weapon3p] hand_r not found in player mesh'); return; }
  attachWeapon3pToHand(hand, P90_ROT, P90_GRIP);
}

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ── Tuning ────────────────────────────────────────────────────────────────────
const TARGET_LENGTH = 0.17; // pistol longest axis in Three.js world units (~17 cm)

// Rotation inside hand_r bone-local space — adjust if barrel faces wrong way
const ROT = new THREE.Euler(Math.PI / 2, 0, Math.PI / 2);

// Nudge so grip sits in palm after centering
const GRIP_OFFSET = new THREE.Vector3(0.05, 0.0, 0.01);

// ── Material palette ──────────────────────────────────────────────────────────
const PALETTE = {
  Muzzle:         new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.3,  metalness: 0.95 }),
  Magazine:       new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.65, metalness: 0.45 }),
  Metal:          new THREE.MeshStandardMaterial({ color: 0x323840, roughness: 0.25, metalness: 0.9  }),
  Wood:           new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.8,  metalness: 0.1  }),
  'Material.003': new THREE.MeshStandardMaterial({ color: 0x222528, roughness: 0.5,  metalness: 0.6  }),
  DarkerMetal:    new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.4,  metalness: 0.85 }),
};

let _template = null;

export async function tryLoadPistolFBX() {
  try {
    const probe = await fetch(import.meta.env.BASE_URL + 'models/FBX/Pistol.fbx', { method: 'HEAD' });
    if (!probe.ok) return false;
  } catch { return false; }

  try {
    const loader = new FBXLoader();
    const fbx    = await loader.loadAsync(import.meta.env.BASE_URL + 'models/FBX/Pistol.fbx');

    // ── 1. Collect all SkinnedMeshes with their full world transforms ────────
    //    The FBX has nested groups (scale:100 inside scale:100) that push the
    //    mesh far from origin. We bake every parent transform into a plain Mesh
    //    so the result is safe to .clone() and sits at the correct position.
    fbx.updateMatrixWorld(true);

    const group = new THREE.Group();

    fbx.traverse(ch => {
      if (!ch.isSkinnedMesh) return;

      // Remap materials by name
      const remap = m => PALETTE[m?.name] ?? m;
      const mats  = Array.isArray(ch.material)
        ? ch.material.map(remap)
        : remap(ch.material);

      // Plain Mesh — bake the skinned mesh's full world matrix into geometry transform
      const mesh = new THREE.Mesh(ch.geometry, mats);
      mesh.applyMatrix4(ch.matrixWorld); // folds nested scale/position into the mesh
      mesh.castShadow = mesh.receiveShadow = false;
      group.add(mesh);
    });

    if (!group.children.length) {
      console.warn('[EnemyWeapon] No SkinnedMesh found in Pistol.fbx');
      return false;
    }

    // ── 2. Auto-scale to TARGET_LENGTH ──────────────────────────────────────
    const rawBox  = new THREE.Box3().setFromObject(group);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const longest = Math.max(rawSize.x, rawSize.y, rawSize.z);
    group.scale.setScalar(TARGET_LENGTH / longest);

    // ── 3. Center at origin then apply grip nudge ────────────────────────────
    group.updateMatrixWorld(true);
    const centeredBox = new THREE.Box3().setFromObject(group);
    const center      = centeredBox.getCenter(new THREE.Vector3());
    group.position.sub(center).add(GRIP_OFFSET);
    group.rotation.copy(ROT);

    _template = group;

    const s = TARGET_LENGTH / longest;
    console.log(`[EnemyWeapon] Pistol loaded — ${(rawSize.x*s).toFixed(3)} × ${(rawSize.y*s).toFixed(3)} × ${(rawSize.z*s).toFixed(3)} m`);
    return true;
  } catch (err) {
    console.warn('[EnemyWeapon] Failed to load Pistol.fbx:', err);
    return false;
  }
}

export function attachPistolToHand(enemyRoot) {
  if (!_template) return;
  const hand = enemyRoot.getObjectByName('hand_r');
  if (!hand) { console.warn('[EnemyWeapon] hand_r not found in enemy mesh'); return; }
  hand.add(_template.clone());
}

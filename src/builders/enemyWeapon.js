import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { WEAPON3P_ROT, WEAPON3P_GRIP, WEAPON3P_BARREL_SHIFT } from './weapon3pTransform.js';
import { preserveTemplateGeometry } from './characterResources.js';

// ── Tuning ────────────────────────────────────────────────────────────────────
const TARGET_LENGTH = 0.17; // pistol longest axis in Three.js world units (~17 cm)

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

    // Center inside a separate wrapper. The hand mount can then set its own
    // transform without overwriting the FBX centering or unit conversion.
    group.updateMatrixWorld(true);
    const centeredBox = new THREE.Box3().setFromObject(group);
    const center      = centeredBox.getCenter(new THREE.Vector3());
    group.position.sub(center);
    const canonical = new THREE.Group();
    canonical.add(group);
    canonical.rotation.y = Math.PI / 2; // FBX barrel +X -> model barrel -Z
    _template = new THREE.Group();
    _template.add(canonical);
    preserveTemplateGeometry(_template);

    const s = TARGET_LENGTH / longest;
    console.log(`[EnemyWeapon] Pistol loaded — ${(rawSize.x*s).toFixed(3)} × ${(rawSize.y*s).toFixed(3)} × ${(rawSize.z*s).toFixed(3)} m`);
    return true;
  } catch (err) {
    console.warn('[EnemyWeapon] Failed to load Pistol.fbx:', err);
    return false;
  }
}

// ── Procedural enemy weapons (role-based 3p models) ───────────────────────
const _eGun  = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.35, metalness: 0.85 });
const _eGun2 = new THREE.MeshStandardMaterial({ color: 0x201810, roughness: 0.70, metalness: 0.20 });
const _eScope= new THREE.MeshStandardMaterial({ color: 0x0e1218, roughness: 0.18, metalness: 0.80 });

function _mesh(geo, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  return m;
}

export function buildEnemyWeapon3p(role = 'assault') {
  const g = new THREE.Group();
  const P2 = Math.PI / 2;
  switch (role) {
    case 'smg':
      g.add(_mesh(new THREE.BoxGeometry(0.050, 0.048, 0.28), _eGun,  0,  0,      0));
      g.add(_mesh(new THREE.BoxGeometry(0.038, 0.020, 0.22), _eGun,  0,  0.028, -0.02)); // top feed
      g.add(_mesh(new THREE.BoxGeometry(0.028, 0.058, 0.026),_eGun2, 0, -0.044,  0.04)); // grip
      g.add(_mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), _eGun, 0, 0.005, -0.22, P2));
      break;
    case 'sniper':
      g.add(_mesh(new THREE.BoxGeometry(0.042, 0.048, 0.50), _eGun,  0,  0,      0));
      g.add(_mesh(new THREE.BoxGeometry(0.035, 0.048, 0.20), _eGun2, 0,  0,      0.30)); // stock
      g.add(_mesh(new THREE.BoxGeometry(0.028, 0.028, 0.16), _eScope,0,  0.038, -0.01)); // scope
      g.add(_mesh(new THREE.BoxGeometry(0.026, 0.058, 0.026),_eGun2, 0, -0.058,  0.06)); // grip
      g.add(_mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.55, 6), _eGun, 0, 0.005, -0.50, P2));
      break;
    case 'pistol':
      g.add(_mesh(new THREE.BoxGeometry(0.032, 0.048, 0.16), _eGun,  0,  0,      0));
      g.add(_mesh(new THREE.BoxGeometry(0.028, 0.062, 0.028),_eGun2, 0, -0.052,  0.04)); // grip
      g.add(_mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), _eGun, 0, 0.005, -0.15, P2));
      break;
    default: // assault
      g.add(_mesh(new THREE.BoxGeometry(0.055, 0.055, 0.38), _eGun,  0,  0,      0));
      g.add(_mesh(new THREE.BoxGeometry(0.025, 0.088, 0.024),_eGun2, 0, -0.066,  0.05)); // magazine
      g.add(_mesh(new THREE.BoxGeometry(0.030, 0.058, 0.026),_eGun2, 0, -0.052, -0.04)); // grip
      g.add(_mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.30, 6), _eGun, 0, 0.010, -0.28, P2));
      break;
  }
  return g;
}

const ROLE_WEAPON = { assault: 'm4', smg: 'p90', sniper: 'awp', pistol: 'pistol' };
const MUZZLE_Z = { assault: -0.43, smg: -0.31, sniper: -0.775, pistol: -0.21 };

export function attachEnemyWeapon(enemyRoot, role = 'assault', muzzleFlash = null) {
  const hand = enemyRoot.getObjectByName('hand_r');
  if (!hand) return;
  const wpn = (role === 'pistol' && _template) ? _template.clone() : buildEnemyWeapon3p(role);
  const mount = new THREE.Group();
  mount.name = 'enemyWeaponMount';
  mount.rotation.copy(WEAPON3P_ROT);
  mount.position.copy(WEAPON3P_GRIP);
  wpn.position.z = WEAPON3P_BARREL_SHIFT[ROLE_WEAPON[role] ?? 'm4'];
  mount.add(wpn);
  hand.add(mount);
  if (muzzleFlash) {
    wpn.add(muzzleFlash);
    const tip = role === 'pistol' && _template ? -TARGET_LENGTH / 2 : MUZZLE_Z[role] ?? MUZZLE_Z.assault;
    muzzleFlash.position.set(0, 0.01, tip);
  }
}

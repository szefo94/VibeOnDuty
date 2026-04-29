import * as THREE from 'three';
import { mm } from '../materials.js';
import { scene, camera } from '../scene.js';

const mGun  = mm(0x181818, 0.30, 0.85);
const mGun2 = mm(0x221810, 0.60, 0.20);
const mGunW = mm(0x2a1a0a, 0.50, 0.05);
const mGunL = mm(0x2a3a1a, 0.55, 0.30); // AWP stock green
const mGunS = mm(0x1a1a22, 0.25, 0.90); // scope glass

// ── Outer group — position/rotation driven by updateWeapon() ─────────
export const wpn = new THREE.Group();
wpn.position.set(0.11, -0.105, -0.2);
camera.add(wpn);

// Helpers
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, l, s = 8) => new THREE.CylinderGeometry(rt, rb, l, s);
const mk = (g, geo, mat, x, y, z) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
};
const brl = (g, rt, rb, l, x, y, z) => {
  const m = new THREE.Mesh(cyl(rt, rb, l), mGun);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  g.add(m);
};

// ── 1st-person groups ─────────────────────────────────────────────────
const _w1 = {};

// M4A1
_w1.m4 = new THREE.Group();
mk(_w1.m4, box(0.055, 0.064, 0.38),  mGun,  0,      0,       0);
mk(_w1.m4, box(0.044, 0.050, 0.18),  mGun2, 0,      0.004,  -0.15);
mk(_w1.m4, box(0.044, 0.055, 0.11),  mGunW, 0,     -0.008,   0.22);
mk(_w1.m4, box(0.034, 0.092, 0.037), mGun2, 0,     -0.074,   0.06);
mk(_w1.m4, box(0.027, 0.058, 0.036), mGun2, 0,     -0.060,  -0.04);
brl(_w1.m4, 0.009, 0.009, 0.36, 0, 0.012, -0.33);
brl(_w1.m4, 0.013, 0.013, 0.04, 0, 0.012, -0.51); // muzzle device

// P90 — procedural fallback; FBX replaces children if loaded
_w1.p90 = new THREE.Group();
mk(_w1.p90, box(0.058, 0.055, 0.32), mGun,  0,      0,       0);
mk(_w1.p90, box(0.042, 0.028, 0.26), mGun,  0,      0.033,  -0.04); // top feed
mk(_w1.p90, box(0.034, 0.072, 0.040),mGun2, 0,     -0.052,   0.06);
brl(_w1.p90, 0.007, 0.007, 0.22, 0, 0.006, -0.27);

// AWP
_w1.awp = new THREE.Group();
mk(_w1.awp, box(0.048, 0.055, 0.52),  mGun,  0,      0,       0);
mk(_w1.awp, box(0.038, 0.048, 0.22),  mGunL, 0,      0.004,   0.32); // stock
mk(_w1.awp, box(0.034, 0.080, 0.036), mGun2, 0,     -0.070,   0.08); // grip
mk(_w1.awp, box(0.034, 0.034, 0.18),  mGunS, 0,      0.048,  -0.01); // scope tube
brl(_w1.awp, 0.016, 0.016, 0.014, 0, 0.048, -0.098); // front lens cap
brl(_w1.awp, 0.012, 0.012, 0.012, 0, 0.048,  0.088); // rear lens cap
brl(_w1.awp, 0.008, 0.010, 0.62,  0, 0.006, -0.57);  // long barrel

// Pistol (M9)
_w1.pistol = new THREE.Group();
mk(_w1.pistol, box(0.038, 0.056, 0.18),  mGun,  0,      0,       0);
mk(_w1.pistol, box(0.034, 0.075, 0.040), mGun2, 0,     -0.062,   0.05);
mk(_w1.pistol, box(0.026, 0.012, 0.040), mGun2, 0,     -0.012,  -0.11); // trigger guard
brl(_w1.pistol, 0.007, 0.007, 0.16, 0, 0.008, -0.20);

for (const [k, g] of Object.entries(_w1)) { g.visible = k === 'm4'; wpn.add(g); }

// ── Muzzle flash (shared; Z updated on weapon switch) ────────────────
export const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0 });
export const flash = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 6), flashMat);
flash.position.set(0, 0.012, -0.54);
wpn.add(flash);
export const muzzleLight = new THREE.PointLight(0xffaa22, 0, 4);
scene.add(muzzleLight);

const _muzzleZ = { m4: -0.54, p90: -0.27, awp: -0.90, pistol: -0.30 };

// ── 3rd-person weapon group ───────────────────────────────────────────
// Added to playerBody by main.js (procedural) or reparented to hand_r (GLTF).
export const weapon3p = new THREE.Group();
export let weapon3pAttached = false;

const _w3 = {};
const b3 = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); g.add(m); };
const r3 = (g, rt, rb, l, x, y, z) => { const m = new THREE.Mesh(cyl(rt,rb,l), mGun); m.rotation.x=Math.PI/2; m.position.set(x,y,z); g.add(m); };

// M4 (3p)
_w3.m4 = new THREE.Group();
b3(_w3.m4, box(0.060, 0.060, 0.44), mGun,  0, 0,     0);
b3(_w3.m4, box(0.050, 0.070, 0.19), mGunW, 0, 0,  0.23); // stock
r3(_w3.m4, 0.010, 0.010, 0.36,      0, 0.010, -0.35);

// P90 (3p)
_w3.p90 = new THREE.Group();
b3(_w3.p90, box(0.060, 0.058, 0.32),  mGun, 0, 0,     0);
b3(_w3.p90, box(0.044, 0.030, 0.26),  mGun, 0, 0.034, -0.04);
r3(_w3.p90, 0.008, 0.008, 0.20,       0, 0.008, -0.25);

// AWP (3p)
_w3.awp = new THREE.Group();
b3(_w3.awp, box(0.050, 0.058, 0.52),  mGun,  0, 0,     0);
b3(_w3.awp, box(0.040, 0.050, 0.22),  mGunL, 0, 0.004, 0.32);
b3(_w3.awp, box(0.036, 0.036, 0.18),  mGunS, 0, 0.050, -0.01);
r3(_w3.awp, 0.009, 0.011, 0.58,       0, 0.006, -0.56);

// Pistol (3p)
_w3.pistol = new THREE.Group();
b3(_w3.pistol, box(0.040, 0.058, 0.18),  mGun,  0, 0,      0);
b3(_w3.pistol, box(0.036, 0.070, 0.042), mGun2, 0, -0.064, 0.05);
r3(_w3.pistol, 0.008, 0.008, 0.14,       0, 0.008, -0.18);

for (const [k, g] of Object.entries(_w3)) { g.visible = k === 'm4'; weapon3p.add(g); }

// ── Switch helpers ────────────────────────────────────────────────────
export function show1pWeapon(key) {
  for (const [k, g] of Object.entries(_w1)) g.visible = k === key;
  flash.position.z = _muzzleZ[key] ?? -0.54;
}

export function show3pWeapon(key) {
  for (const [k, g] of Object.entries(_w3)) g.visible = k === key;
}

// Called by weaponFBX.js after FBX loads — replaces P90 procedural meshes
export function replaceFbxModel(fbxGroup) {
  while (_w1.p90.children.length) _w1.p90.remove(_w1.p90.children[0]);
  _w1.p90.add(fbxGroup);
}

// Called by weaponFBX.js once hand_r bone is available
export function attachWeapon3pToHand(hand, rotation, offset) {
  weapon3p.rotation.copy(rotation);
  weapon3p.position.copy(offset);
  hand.add(weapon3p);
  weapon3pAttached = true;
}

import * as THREE from 'three';
import { mm } from '../materials.js';
import { scene } from '../scene.js';

export const playerBody = new THREE.Group();

// ── Materials ──────────────────────────────────────────────────────
const mUnif   = mm(0x2c3e50, 0.88, 0.02);   // dark tactical uniform
const mUnifL  = mm(0x34495e, 0.82, 0.04);   // lighter panel
const mUnifD  = mm(0x1a252f, 0.90, 0.02);   // dark seams / knees
const mVest   = mm(0x3d5a3e, 0.78, 0.06);   // olive plate carrier
const mVestD  = mm(0x2e4230, 0.84, 0.04);   // vest details
const mHelm   = mm(0x2e3d2e, 0.62, 0.22);   // matte helmet
const mVisor  = mm(0x0a1520, 0.10, 0.75);   // visor
const mGlove  = mm(0x1a1a1a, 0.70, 0.08);   // gloves
const mBoots  = mm(0x111111, 0.78, 0.10);   // boots
const mGun    = mm(0x0f0f0f, 0.25, 0.80);   // rifle body
const mGunW   = mm(0x1a1410, 0.55, 0.12);   // reserved (unused after weapon3p)
const mPad    = mm(0x4a6741, 0.80, 0.03);   // knee/elbow pads

function p(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  playerBody.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, s = 8) => new THREE.SphereGeometry(r, s, s);

// ── Feet / boots ───────────────────────────────────────────────────
p(box(0.18, 0.07, 0.28), mBoots, -0.13,  0.035,  0.02);
p(box(0.18, 0.07, 0.28), mBoots,  0.13,  0.035,  0.02);

// ── Lower legs ────────────────────────────────────────────────────
p(cyl(0.08, 0.09, 0.28), mUnifD, -0.13, 0.19, 0);
p(cyl(0.08, 0.09, 0.28), mUnifD,  0.13, 0.19, 0);

// ── Knee pads ─────────────────────────────────────────────────────
p(box(0.17, 0.10, 0.13), mPad, -0.13, 0.34, -0.04);
p(box(0.17, 0.10, 0.13), mPad,  0.13, 0.34, -0.04);

// ── Thighs ────────────────────────────────────────────────────────
p(cyl(0.09, 0.08, 0.34), mUnif, -0.13, 0.56, 0);
p(cyl(0.09, 0.08, 0.34), mUnif,  0.13, 0.56, 0);

// ── Hip / belt area ───────────────────────────────────────────────
p(box(0.40, 0.12, 0.24), mUnifD, 0, 0.76, 0);
// belt buckle
p(box(0.06, 0.06, 0.06), mGun,   0, 0.76, -0.12);

// ── Plate carrier / chest ─────────────────────────────────────────
p(box(0.52, 0.38, 0.26), mVest,  0,  1.04, 0);
// front plate ridge
p(box(0.36, 0.30, 0.05), mVestD, 0,  1.04, -0.14);
// side panels
p(box(0.06, 0.28, 0.22), mVestD, -0.29, 1.04, 0);
p(box(0.06, 0.28, 0.22), mVestD,  0.29, 1.04, 0);
// back plate
p(box(0.48, 0.34, 0.06), mVestD,  0,  1.04,  0.14);

// ── Shoulders (pauldrons) ─────────────────────────────────────────
p(sph(0.14, 8), mVest, -0.37, 1.23, 0);
p(sph(0.14, 8), mVest,  0.37, 1.23, 0);

// ── Upper arms ────────────────────────────────────────────────────
p(cyl(0.09, 0.10, 0.32), mUnifL, -0.37, 1.04, 0);
p(cyl(0.09, 0.10, 0.32), mUnifL,  0.37, 1.04, 0);

// ── Elbow pads ────────────────────────────────────────────────────
p(box(0.18, 0.09, 0.14), mPad, -0.38, 0.86, 0);
p(box(0.18, 0.09, 0.14), mPad,  0.38, 0.86, 0);

// ── Forearms ──────────────────────────────────────────────────────
p(cyl(0.075, 0.085, 0.28), mUnif, -0.38, 0.68, 0);
p(cyl(0.075, 0.085, 0.28), mUnif,  0.38, 0.68, 0);

// ── Gloved hands ──────────────────────────────────────────────────
p(box(0.11, 0.09, 0.12), mGlove, -0.38, 0.52, -0.02);
p(box(0.11, 0.09, 0.12), mGlove,  0.38, 0.52, -0.02);

// ── Neck ──────────────────────────────────────────────────────────
p(cyl(0.07, 0.08, 0.14), mUnif, 0, 1.30, 0);

// ── Head (balaclava base) ─────────────────────────────────────────
p(cyl(0.13, 0.14, 0.26, 10), mUnifD, 0, 1.50, 0);

// ── Helmet ────────────────────────────────────────────────────────
p(cyl(0.17, 0.18, 0.10, 10), mHelm, 0, 1.56, 0);   // brim
p(cyl(0.17, 0.14, 0.18, 10), mHelm, 0, 1.67, 0);   // dome lower
p(sph(0.155, 10),             mHelm, 0, 1.76, 0);   // dome top
// helmet straps / cheek pads
p(box(0.04, 0.16, 0.04), mHelm, -0.16, 1.55, 0);
p(box(0.04, 0.16, 0.04), mHelm,  0.16, 1.55, 0);

// ── Visor ─────────────────────────────────────────────────────────
p(box(0.28, 0.07, 0.04), mVisor, 0, 1.62, -0.17);

// weapon3p group is added here by main.js after assets load

playerBody.visible = false;
scene.add(playerBody);

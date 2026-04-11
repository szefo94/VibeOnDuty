import * as THREE from 'three';
import { mm } from '../materials.js';
import { scene } from '../scene.js';

const mSkin = mm(0xc8845a, 0.8),
  mUnif = mm(0x2c3c2c, 0.88, 0.02),
  mUnifD = mm(0x1e2a1e, 0.9, 0.02);
const mUnifL = mm(0x364836, 0.84, 0.04),
  mBoots = mm(0x181818, 0.78, 0.12);
const mHelm = mm(0x1a2a1a, 0.62, 0.22),
  mVisor = mm(0x0a1a2a, 0.2, 0.6);
const mGunE = mm(0x0f0f0f, 0.3, 0.8),
  mGunEW = mm(0x1a1410, 0.58, 0.1),
  mGunEM = mm(0x222222, 0.4, 0.5);

export function buildEnemy(wx, wz) {
  const g = new THREE.Group();
  const p = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  p(box(0.17, 0.06, 0.26), mBoots, -0.115, 0.03, 0.02);
  p(box(0.17, 0.06, 0.26), mBoots, 0.115, 0.03, 0.02);
  p(cyl(0.085, 0.095, 0.22), mBoots, -0.115, 0.15, 0);
  p(cyl(0.085, 0.095, 0.22), mBoots, 0.115, 0.15, 0);
  p(cyl(0.075, 0.092, 0.38), mUnifD, -0.115, 0.46, 0);
  p(cyl(0.075, 0.092, 0.38), mUnifD, 0.115, 0.46, 0);
  p(box(0.13, 0.1, 0.13), mUnif, -0.115, 0.66, 0.02);
  p(box(0.13, 0.1, 0.13), mUnif, 0.115, 0.66, 0.02);
  p(cyl(0.105, 0.082, 0.36), mUnif, -0.115, 0.875, 0);
  p(cyl(0.105, 0.082, 0.36), mUnif, 0.115, 0.875, 0);
  p(cyl(0.19, 0.17, 0.14, 10), mUnif, 0, 1.07, 0);
  p(cyl(0.135, 0.17, 0.16, 10), mUnif, 0, 1.225, 0);
  p(cyl(0.22, 0.145, 0.28, 10), mUnifL, 0, 1.43, 0);
  p(box(0.52, 0.1, 0.22), mUnif, 0, 1.6, 0);
  p(box(0.18, 0.32, 0.16), mUnif, -0.36, 1.46, 0);
  p(box(0.18, 0.32, 0.16), mUnif, 0.36, 1.46, 0);
  p(box(0.13, 0.12, 0.14), mUnifD, -0.38, 1.27, 0);
  p(box(0.13, 0.12, 0.14), mUnifD, 0.38, 1.27, 0);
  p(box(0.12, 0.28, 0.12), mUnif, -0.38, 1.1, 0);
  p(box(0.12, 0.28, 0.12), mUnif, 0.38, 1.1, 0);
  p(box(0.1, 0.09, 0.11), mSkin, -0.38, 0.94, 0);
  p(box(0.1, 0.09, 0.11), mSkin, 0.38, 0.94, 0);
  p(cyl(0.065, 0.075, 0.14), mSkin, 0, 1.69, 0);
  p(cyl(0.12, 0.13, 0.26, 10), mSkin, 0, 1.84, 0);
  p(cyl(0.145, 0.155, 0.22, 10), mHelm, 0, 1.93, 0);
  p(box(0.32, 0.05, 0.3), mHelm, 0, 1.82, 0);
  p(box(0.22, 0.05, 0.04), mVisor, 0, 1.87, -0.14);
  p(box(0.045, 0.05, 0.36), mGunE, 0.295, 1.18, -0.14);
  const eb = new THREE.Mesh(cyl(0.008, 0.009, 0.26, 7), mGunE);
  eb.rotation.x = Math.PI / 2;
  eb.position.set(0.295, 1.19, -0.38);
  eb.castShadow = true;
  g.add(eb);
  p(box(0.038, 0.042, 0.18), mGunEM, 0.295, 1.194, -0.24);
  p(box(0.034, 0.04, 0.12), mGunEW, 0.295, 1.172, 0.06);
  p(box(0.026, 0.078, 0.028), mGunEW, 0.295, 1.118, -0.01);
  p(box(0.022, 0.062, 0.03), mGunEM, 0.295, 1.126, -0.09);
  const ef = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 5, 5),
    new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0 })
  );
  ef.position.set(0.295, 1.19, -0.52);
  g.add(ef);
  g.position.set(wx, 0, wz);
  scene.add(g);
  g.traverse((ch) => {
    if (ch.isMesh) ch.userData.enemyGroup = g;
  });
  return { mesh: g, muzzleFlash: ef, animT: Math.random() * Math.PI * 2 };
}

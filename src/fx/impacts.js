import * as THREE from 'three';
import { scene } from '../scene.js';

const impPool = [];
const impMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });

export function spawnImpact(pos) {
  let m = impPool.find((p) => !p.visible);
  if (!m) {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), impMat);
    scene.add(m);
    impPool.push(m);
  }
  m.position.copy(pos);
  m.visible = true;
  m.userData.life = 0.09;
}

export function tickImpacts(dt) {
  impPool.forEach((m) => {
    if (!m.visible) return;
    m.userData.life -= dt;
    if (m.userData.life <= 0) m.visible = false;
  });
}

import * as THREE from 'three';
import { scene } from '../scene.js';
import { TRACER_LIFE } from '../config.js';

const tracers = [];
const _trMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 1 });
const _up = new THREE.Vector3(0, 1, 0);

export function spawnTracer(a, b) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 0.01) return;
  const geo = new THREE.CylinderGeometry(0.045, 0.045, len, 6, 1);
  const mat = _trMat.clone();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(_up, dir.clone().normalize());
  scene.add(mesh);
  tracers.push({ mesh, life: TRACER_LIFE });
}

export function tickTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, (t.life / TRACER_LIFE) * 0.85);
    if (t.life <= 0) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

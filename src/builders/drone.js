import * as THREE from 'three';
import { mm } from '../materials.js';
import { scene } from '../scene.js';

const droneMat = mm(0x1a2a3a, 0.4, 0.7),
  droneAccent = mm(0x003366, 0.3, 0.8);
const droneLightMat = new THREE.MeshBasicMaterial({
  color: 0x00ccff,
  transparent: true,
  opacity: 0.9,
});
const droneConeMatBase = new THREE.MeshBasicMaterial({
  color: 0x00aaff,
  transparent: true,
  opacity: 0.12,
  side: THREE.DoubleSide,
});

export function buildDrone(wx, wy, wz) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), droneMat);
  body.scale.y = 0.55;
  g.add(body);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.06), droneMat);
    arm.rotation.y = Math.PI / 4 + (i * Math.PI) / 2;
    g.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 8), droneAccent);
    rotor.position.set(
      Math.cos(Math.PI / 4 + (i * Math.PI) / 2) * 0.27,
      0.04,
      Math.sin(Math.PI / 4 + (i * Math.PI) / 2) * 0.27
    );
    g.add(rotor);
    rotor.userData.isRotor = true;
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), droneLightMat);
  eye.position.set(0, -0.1, 0.18);
  g.add(eye);
  const coneGeo = new THREE.ConeGeometry(1.2, 3.5, 16, 1, true);
  const cone = new THREE.Mesh(coneGeo, droneConeMatBase.clone());
  cone.rotation.x = Math.PI;
  cone.position.y = -1.75;
  g.add(cone);
  g.position.set(wx, wy, wz);
  scene.add(g);
  return {
    mesh: g,
    cone,
    eye,
    x: wx,
    y: wy,
    z: wz,
    hp: 40,
    maxHp: 40,
    hpDrain: 40,
    dead: false,
    floatT: Math.random() * Math.PI * 2,
    velX: 0,
    velZ: 0,
    radarAge: Infinity,
  };
}

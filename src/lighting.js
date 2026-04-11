import * as THREE from 'three';
import { CELL } from './config.js';
import { scene } from './scene.js';

// r155+ uses physical light units — multiply by Math.PI (directional/ambient) or 4*Math.PI (point)
scene.add(new THREE.AmbientLight(0x8ab4d4, 0.65 * Math.PI));
const sun = new THREE.DirectionalLight(0xffe0a0, 2.0 * Math.PI);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.001;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x6080a0, 0.4 * Math.PI);
fill.position.set(-30, 20, -20);
scene.add(fill);
const torchLights = [];
[
  [3, 4],
  [11, 3],
  [20, 4],
  [5, 11],
  [18, 11],
  [3, 19],
  [11, 20],
  [20, 20],
  [11, 12],
].forEach(([tc, tr]) => {
  const tl = new THREE.PointLight(0xff8822, 1.8 * 4 * Math.PI, 12);
  tl.position.set(tc * CELL, 2.2, tr * CELL);
  tl.userData.base = 1.8 * 4 * Math.PI;
  tl.userData.ft = Math.random() * 100;
  scene.add(tl);
  torchLights.push(tl);
});

function tickTorches(dt) {
  torchLights.forEach((tl) => {
    tl.userData.ft += dt * 8;
    tl.intensity =
      tl.userData.base *
      (0.82 + Math.sin(tl.userData.ft) * 0.12 + Math.sin(tl.userData.ft * 2.3) * 0.06);
  });
}

export { torchLights, tickTorches };
